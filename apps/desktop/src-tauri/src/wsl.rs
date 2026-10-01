//! Explicit, fail-closed WSL transport. Credentials remain in the Windows app.
use serde_json::Value;
use std::{
    fs::File,
    io::{Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

const FAILED: &str = "Oracle's Linux runtime is unavailable. Close Oracle and check WSL before retrying. No Windows fallback was used.";
const CONFIG_FAILED: &str = "Oracle's runtime configuration is invalid. Restore the reviewed configuration; no alternate workspace was opened.";
const MAX_RESPONSE: u64 = 2 * 1024 * 1024;

pub struct Runtime {
    distribution: String,
    user: String,
    project: String,
    database: String,
    identity: String,
}

impl Runtime {
    pub fn load(directory: &Path) -> Result<Option<Self>, &'static str> {
        if directory
            .join("runtime-transition.pending")
            .try_exists()
            .map_err(|_| CONFIG_FAILED)?
        {
            return Err("Oracle's runtime transition is incomplete. Finish or recover the migration before reopening the workspace.");
        }
        let file = match File::open(directory.join("runtime.json")) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                if directory
                    .join("runtime-wsl.selected")
                    .try_exists()
                    .map_err(|_| CONFIG_FAILED)?
                {
                    return Err(CONFIG_FAILED);
                }
                return Ok(None);
            }
            Err(_) => return Err(CONFIG_FAILED),
        };
        let mut data = Vec::new();
        file.take(4097)
            .read_to_end(&mut data)
            .map_err(|_| CONFIG_FAILED)?;
        if data.len() > 4096 {
            return Err(CONFIG_FAILED);
        }
        Self::parse(&data).map(Some)
    }

    fn parse(data: &[u8]) -> Result<Self, &'static str> {
        let value: Value = serde_json::from_slice(data).map_err(|_| CONFIG_FAILED)?;
        let object = value.as_object().ok_or(CONFIG_FAILED)?;
        let field = |name: &str| value[name].as_str().ok_or(CONFIG_FAILED);
        if object.len() != 7
            || !matches!(value["version"].as_u64(), Some(1 | 2))
            || field("runtime")? != "wsl"
            || field("distribution")? != "Ubuntu"
        {
            return Err(CONFIG_FAILED);
        }
        let user = field("user")?;
        if user.is_empty()
            || user.len() > 32
            || !user
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_' || c == b'-')
            || !user.as_bytes()[0].is_ascii_lowercase()
        {
            return Err(CONFIG_FAILED);
        }
        let project = field("project")?.to_owned();
        let valid_project = if value["version"] == 1 {
            project == format!("/home/{user}/projects/oracle")
        } else {
            let prefix = format!("/home/{user}/.local/share/oracle/runtime/releases/");
            project.strip_prefix(&prefix).is_some_and(|release| {
                release.len() == 64
                    && release
                        .bytes()
                        .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
            })
        };
        let database = format!("/home/{user}/.local/share/oracle/oracle.sqlite3");
        if !valid_project || field("database")? != database {
            return Err(CONFIG_FAILED);
        }
        let identity = field("workspace_id")?;
        if identity.len() != 36
            || !identity.bytes().enumerate().all(|(i, c)| {
                if [8, 13, 18, 23].contains(&i) {
                    c == b'-'
                } else {
                    c.is_ascii_digit() || (b'a'..=b'f').contains(&c)
                }
            })
        {
            return Err(CONFIG_FAILED);
        }
        Ok(Self {
            distribution: "Ubuntu".into(),
            user: user.into(),
            project,
            database,
            identity: identity.into(),
        })
    }

    fn command(&self) -> Command {
        // Never resolve wsl.exe from the repository or the renderer's PATH.
        let mut command = Command::new(concat!(env!("SystemRoot"), "\\System32\\wsl.exe"));
        command
            .args([
                "--distribution",
                &self.distribution,
                "--user",
                &self.user,
                "--exec",
            ])
            .arg(format!("{}/.venv/bin/python", self.project))
            .args(["-I", "-m", "app.wsl_worker"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        command
    }

    pub fn invoke(&self, operation: &str, bytes: Vec<u8>) -> Result<Vec<u8>, &'static str> {
        if !matches!(operation, "request" | "prepare") || bytes.len() > 512 * 1024 {
            return Err(FAILED);
        }
        let mut command = self.command();
        command.args([operation, &self.database, &self.identity]);
        exchange(command, bytes, Duration::from_secs(40))
    }
}

fn exchange(
    mut command: Command,
    bytes: Vec<u8>,
    timeout: Duration,
) -> Result<Vec<u8>, &'static str> {
    let mut child = command.spawn().map_err(|_| FAILED)?;
    let mut input = child.stdin.take().ok_or(FAILED)?;
    let output = child.stdout.take().ok_or(FAILED)?;
    let (sender, receiver) = mpsc::channel();
    let (cancel, lease) = mpsc::channel::<()>();
    let reader = thread::spawn(move || {
        let mut data = Vec::new();
        let result = output.take(MAX_RESPONSE + 1).read_to_end(&mut data);
        let _ = sender.send(result.map(|_| data));
    });
    let writer = thread::spawn(move || {
        let result = input
            .write_all(&(bytes.len() as u32).to_be_bytes())
            .and_then(|_| input.write_all(&bytes))
            .and_then(|_| input.flush());
        if result.is_ok() {
            let _ = lease.recv();
        }
        // Closing this handle cancels the Linux worker, including on host error.
        drop(input);
        result
    });
    let response = receiver.recv_timeout(timeout);
    drop(cancel);
    // The Linux supervisor owns a 15-second deadline. After cancelling, allow
    // that deadline plus cleanup to expire before releasing the native auth lock.
    // Never automatically retry a write whose outcome may be unknown.
    let grace = if response.is_ok() {
        Duration::from_secs(2)
    } else {
        Duration::from_secs(17)
    };
    let until = Instant::now() + grace;
    while Instant::now() < until {
        if response.is_ok()
            && matches!(child.try_wait(), Ok(Some(_)))
            && reader.is_finished()
            && writer.is_finished()
        {
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }
    crate::applications::terminate(&mut child);
    let _ = child.wait();
    // Do not let a broken OS transport turn thread joins into an unbounded wait.
    if !reader.is_finished() || !writer.is_finished() {
        return Err(FAILED);
    }
    writer.join().map_err(|_| FAILED)?.map_err(|_| FAILED)?;
    reader.join().map_err(|_| FAILED)?;
    let data = response.map_err(|_| FAILED)?.map_err(|_| FAILED)?;
    if data.len() as u64 > MAX_RESPONSE {
        return Err(FAILED);
    }
    let envelope: Value = serde_json::from_slice(&data).map_err(|_| FAILED)?;
    if envelope["error"] == "runtime_unavailable" {
        return Err(FAILED);
    }
    // Also reject malformed envelopes as transport errors, not retryable input errors.
    let keys = envelope.as_object().ok_or(FAILED)?;
    if keys.len() != 3
        || envelope["protocol_version"].as_u64() != Some(1)
        || envelope["ok"].as_bool().is_none()
        || (envelope["ok"] == true && !keys.contains_key("result"))
        || (envelope["ok"] == false && !envelope["error"].is_string())
    {
        return Err(FAILED);
    }
    Ok(data)
}

#[cfg(test)]
pub(crate) fn synthetic_runtime() -> Runtime {
    let database = std::env::var("ORACLE_WSL_TEST_DATABASE").expect("synthetic fixture required");
    let parent = std::path::Path::new(&database).parent().unwrap();
    assert_eq!(
        parent.parent().unwrap().to_str().unwrap(),
        "/home/lethargic/projects/oracle/.cache"
    );
    assert!(parent
        .file_name()
        .unwrap()
        .to_str()
        .unwrap()
        .starts_with("oracle-wsl-native-"));
    assert_eq!(
        std::path::Path::new(&database).file_name().unwrap(),
        "oracle.sqlite3"
    );
    assert!(!database.contains(".."));
    Runtime {
        distribution: "Ubuntu".into(),
        user: "lethargic".into(),
        project: std::env::var("ORACLE_WSL_TEST_PROJECT")
            .unwrap_or_else(|_| "/home/lethargic/projects/oracle".into()),
        database,
        identity: std::env::var("ORACLE_WSL_TEST_IDENTITY").unwrap(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn configuration() -> Value {
        serde_json::json!({"version":1,"runtime":"wsl","distribution":"Ubuntu",
            "user":"lethargic","project":"/home/lethargic/projects/oracle",
            "database":"/home/lethargic/.local/share/oracle/oracle.sqlite3",
            "workspace_id":"12345678-1234-1234-1234-123456789abc"})
    }

    #[test]
    fn configuration_cannot_select_shells_modules_or_mounted_databases() {
        let original = configuration();
        assert!(Runtime::parse(&serde_json::to_vec(&original).unwrap()).is_ok());
        for (key, bad) in [
            ("user", "root;id"),
            ("project", "/tmp/other"),
            ("database", "/mnt/c/live.sqlite3"),
            ("distribution", "other"),
            ("workspace_id", "unexpected"),
            ("runtime", "windows"),
        ] {
            let mut value = original.clone();
            value[key] = bad.into();
            assert!(Runtime::parse(&serde_json::to_vec(&value).unwrap()).is_err());
        }
        let mut extra = original;
        extra["module"] = "app.other".into();
        assert!(Runtime::parse(&serde_json::to_vec(&extra).unwrap()).is_err());
    }

    #[test]
    fn installed_runtime_requires_an_exact_release_and_never_changes_database() {
        let mut value = configuration();
        value["version"] = 2.into();
        let prefix = "/home/lethargic/.local/share/oracle/runtime/releases/";
        value["project"] = format!("{prefix}{}", "a".repeat(64)).into();
        let runtime = Runtime::parse(&serde_json::to_vec(&value).unwrap()).unwrap();
        assert_eq!(
            runtime.database,
            configuration()["database"].as_str().unwrap()
        );
        for bad in [
            "/home/lethargic/projects/oracle".to_owned(),
            format!("{prefix}current"),
            format!("{prefix}{}", "a".repeat(63)),
            format!("{prefix}{}/../other", "a".repeat(64)),
            format!("{prefix}{}", "A".repeat(64)),
        ] {
            value["project"] = bad.into();
            assert!(Runtime::parse(&serde_json::to_vec(&value).unwrap()).is_err());
        }
        value["version"] = 3.into();
        assert!(Runtime::parse(&serde_json::to_vec(&value).unwrap()).is_err());
    }

    #[test]
    fn missing_configuration_defaults_but_invalid_configuration_never_does() {
        let dir = tempfile::tempdir().unwrap();
        assert!(Runtime::load(dir.path()).unwrap().is_none());
        std::fs::write(dir.path().join("runtime.json"), b"partial").unwrap();
        assert!(Runtime::load(dir.path()).is_err());
        std::fs::write(dir.path().join("runtime.json"), vec![b' '; 4097]).unwrap();
        assert!(Runtime::load(dir.path()).is_err());
    }

    #[test]
    fn interrupted_cutover_and_missing_selected_configuration_fail_closed() {
        let dir = tempfile::tempdir().unwrap();
        let pending = dir.path().join("runtime-transition.pending");
        std::fs::write(&pending, b"pending").unwrap();
        assert!(Runtime::load(dir.path()).is_err());
        std::fs::remove_file(&pending).unwrap();
        std::fs::write(dir.path().join("runtime-wsl.selected"), b"selected").unwrap();
        assert!(Runtime::load(dir.path()).is_err());
        std::fs::write(
            dir.path().join("runtime.json"),
            serde_json::to_vec(&configuration()).unwrap(),
        )
        .unwrap();
        assert!(Runtime::load(dir.path()).unwrap().is_some());
        std::fs::write(pending, b"pending").unwrap();
        assert!(Runtime::load(dir.path()).is_err());
    }

    #[test]
    #[ignore = "Requires Ubuntu and a disposable synthetic fixture supplied by the integration probe"]
    fn real_wsl_transport_reads_writes_and_fails_closed() {
        let mut runtime = synthetic_runtime();
        let invoke = |runtime: &Runtime, payload: Value| {
            crate::applications::decode(
                &runtime
                    .invoke("request", serde_json::to_vec(&payload).unwrap())
                    .unwrap(),
            )
        };
        assert_eq!(
            invoke(&runtime, serde_json::json!({"action":"list"})).unwrap()["total"],
            0
        );
        let create = serde_json::json!({"action":"create","id":"12345678-1234-1234-1234-123456789abc",
            "version":0,"data":{"company":"Synthetic native WSL test"}});
        assert!(invoke(&runtime, create.clone()).is_ok());
        // Existing application id is not duplicated by a retry.
        assert!(invoke(&runtime, create).is_ok());
        assert_eq!(
            invoke(&runtime, serde_json::json!({"action":"list"})).unwrap()["total"],
            1
        );
        assert!(invoke(&runtime, serde_json::json!({"action":"not_an_action"})).is_err());
        assert!(invoke(&runtime, serde_json::json!({"action":"profile_get"})).is_ok());
        runtime.identity = "00000000-0000-0000-0000-000000000000".into();
        assert!(runtime
            .invoke("request", br#"{"action":"list"}"#.to_vec())
            .is_err());
        runtime.distribution = "Oracle-Synthetic-Does-Not-Exist".into();
        assert!(runtime
            .invoke("request", br#"{"action":"list"}"#.to_vec())
            .is_err());
    }
}
