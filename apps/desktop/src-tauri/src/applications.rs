//! Private desktop-to-Python pipe transport for application records.
//! The renderer cannot select an executable, module, database path, or shell command.

use serde_json::Value;
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};

const FAILED: &str =
    "Oracle could not access your applications. Check the local Python setup and retry.";
const MAX_REQUEST: usize = 512 * 1024;
const MAX_RESPONSE: u64 = 2 * 1024 * 1024;

pub struct ApplicationStore(pub Arc<Mutex<Workspace>>);

pub struct Workspace {
    path: PathBuf,
    prepared: bool,
    linux: Option<crate::wsl::Runtime>,
    unavailable: bool,
}

impl Workspace {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            prepared: false,
            linux: None,
            unavailable: false,
        }
    }

    pub fn from_app_data(directory: &Path) -> Result<Self, &'static str> {
        let mut workspace = Self::new(directory.join("oracle.sqlite3"));
        workspace.linux = crate::wsl::Runtime::load(directory)?;
        Ok(workspace)
    }

    #[cfg(test)]
    pub(crate) fn synthetic_linux() -> Self {
        Self {
            path: PathBuf::new(),
            prepared: false,
            linux: Some(crate::wsl::synthetic_runtime()),
            unavailable: false,
        }
    }

    pub fn initialize(&mut self) -> Result<(), &'static str> {
        if self.linux.is_some() {
            return Err("Linux workspaces require a verified restore before activation.");
        }
        maintenance(&self.path, "initialize")?;
        self.prepared = true;
        Ok(())
    }

    pub fn request(&mut self, payload: Value) -> Result<Value, &'static str> {
        if self.unavailable {
            return Err("Oracle's runtime stopped unexpectedly. Close and reopen Oracle before checking the last operation. It was not retried.");
        }
        if self.linux.is_some() {
            if !self.prepared {
                self.linux_request("prepare", Vec::new())?;
                self.prepared = true;
            }
            let bytes = serde_json::to_vec(&payload).map_err(|_| FAILED)?;
            if bytes.len() > MAX_REQUEST {
                return Err("Application details are too large.");
            }
            return self.linux_request("request", bytes);
        }
        if !self.prepared {
            maintenance(&self.path, "prepare")?;
            self.prepared = true;
        }
        request(&self.path, payload)
    }

    fn linux_request(&mut self, operation: &str, bytes: Vec<u8>) -> Result<Value, &'static str> {
        match self.linux.as_ref().ok_or(FAILED)?.invoke(operation, bytes) {
            Ok(data) => decode(&data),
            Err(error) => {
                self.unavailable = true;
                Err(error)
            }
        }
    }
}

pub fn request(database: &Path, payload: Value) -> Result<Value, &'static str> {
    let bytes = serde_json::to_vec(&payload).map_err(|_| FAILED)?;
    if bytes.len() > MAX_REQUEST {
        return Err("Application details are too large.");
    }
    let mut command = worker_command();
    command
        .args(["-I", "-m", "app.desktop_bridge"])
        .arg(database);
    run(command, bytes, Duration::from_secs(15))
}

fn maintenance(database: &Path, operation: &str) -> Result<Value, &'static str> {
    let mut command = worker_command();
    command
        .args(["-I", "-m", "app.workspace", operation])
        .arg(database);
    run(command, Vec::new(), Duration::from_secs(15))
}

fn worker_command() -> Command {
    // This development build uses the repository's fixed virtual environment.
    // Packaging Python alongside the executable is a separate release milestone.
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let python = root.join(".venv/Scripts/python.exe");
    let mut command = Command::new(python);
    command
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command
}

fn run(mut command: Command, bytes: Vec<u8>, timeout: Duration) -> Result<Value, &'static str> {
    let mut child = command.spawn().map_err(|_| FAILED)?;
    let mut input = child.stdin.take().ok_or(FAILED)?;
    let output = child.stdout.take().ok_or(FAILED)?;
    let (sender, receiver) = mpsc::channel();
    // Read concurrently with writing: neither a full pipe nor an unresponsive
    // child can block the Tauri command indefinitely.
    let reader = thread::spawn(move || {
        let mut data = Vec::new();
        let result = output.take(MAX_RESPONSE + 1).read_to_end(&mut data);
        let _ = sender.send(result.map(|_| data));
    });
    let writer = thread::spawn(move || input.write_all(&bytes)); // closes stdin on return
    let response = receiver.recv_timeout(timeout);
    // After EOF a worker should already be exiting. Kill/reap it even on errors
    // or oversize output so there are no orphan workers or inherited pipe handles.
    terminate(&mut child);
    let _ = child.wait();
    let written = writer.join().map_err(|_| FAILED)?;
    let _ = reader.join();
    written.map_err(|_| FAILED)?;
    let data = response.map_err(|_| FAILED)?.map_err(|_| FAILED)?;
    if data.len() as u64 > MAX_RESPONSE {
        return Err(FAILED);
    }
    decode(&data)
}

pub(crate) fn terminate(child: &mut std::process::Child) {
    if matches!(child.try_wait(), Ok(Some(_))) {
        return;
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // The Windows venv launcher may own a second Python process. Killing
        // only the launcher leaves its child (and pipes) alive after a timeout.
        if let Ok(mut killer) =
            Command::new(concat!(env!("SystemRoot"), "\\System32\\taskkill.exe"))
                .args(["/PID", &child.id().to_string(), "/T", "/F"])
                .creation_flags(0x08000000)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
        {
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while std::time::Instant::now() < deadline {
                if matches!(killer.try_wait(), Ok(Some(_))) {
                    break;
                }
                thread::sleep(Duration::from_millis(20));
            }
            let _ = killer.kill();
            let _ = killer.wait();
        }
    }
    let _ = child.kill();
}

pub(crate) fn decode(data: &[u8]) -> Result<Value, &'static str> {
    let response: Value = serde_json::from_slice(data).map_err(|_| FAILED)?;
    let envelope = response.as_object().ok_or(FAILED)?;
    if response.get("protocol_version").and_then(Value::as_u64) != Some(1) || envelope.len() != 3 {
        return Err(FAILED);
    }
    if response.get("ok").and_then(Value::as_bool) == Some(true) {
        return response.get("result").cloned().ok_or(FAILED);
    }
    if response.get("ok").and_then(Value::as_bool) != Some(false) {
        return Err(FAILED);
    }
    Err(match response.get("error").and_then(Value::as_str) {
        Some("workspace_missing") => "Oracle's database is missing. Restore your workspace; an empty replacement has not been created.",
        Some("workspace_identity") => "Oracle's workspace identity is missing or does not match. Close Oracle and restore the matching workspace files.",
        Some("workspace_schema") => "This workspace needs a compatible Oracle version or a reviewed migration. Its schema was not reset.",
        Some("workspace_exists") => "An Oracle workspace already exists. Initialization will not replace it.",
        Some("workspace_invalid" | "workspace_unavailable" | "workspace_backup") => "Oracle could not safely open the workspace. Close Oracle and check database access or restore a verified backup.",
        Some("conflict") => "This entry changed. Reload it before saving again.",
        Some("not_found") => "This application could not be found. Refresh the list.",
        Some("invalid") => {
            "Check your entry: a job title or company is required, and fields have length limits."
        }
        _ => FAILED,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_terminates_python_and_closes_inherited_pipes() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let mut command = Command::new(root.join(".venv/Scripts/python.exe"));
        command
            .args(["-I", "-c", "import time; time.sleep(60)"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let start = std::time::Instant::now();
        assert!(run(command, Vec::new(), Duration::from_millis(250)).is_err());
        assert!(start.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn never_exposes_worker_errors() {
        assert_eq!(
            decode(br#"{"ok":false,"error":"private database path"}"#),
            Err(FAILED)
        );
        assert_eq!(decode(b"not json"), Err(FAILED));
        assert!(decode(br#"{"ok":true}"#).is_err());
        assert!(decode(br#"{"protocol_version":2,"ok":true,"result":{}}"#).is_err());
        assert!(decode(br#"{"protocol_version":1,"ok":true,"result":{},"extra":1}"#).is_err());
    }

    #[test]
    fn reports_edit_conflicts() {
        assert_eq!(
            decode(br#"{"protocol_version":1,"ok":false,"error":"conflict"}"#),
            Err("This entry changed. Reload it before saving again.")
        );
    }

    #[test]
    fn a_prepared_workspace_never_recreates_missing_data() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("oracle.sqlite3");
        let mut workspace = Workspace::new(database.clone());
        workspace.initialize().unwrap();
        assert!(workspace
            .request(serde_json::json!({"action":"list"}))
            .is_ok());
        std::fs::rename(&database, directory.path().join("preserved.sqlite3")).unwrap();
        let error = workspace
            .request(serde_json::json!({"action":"list"}))
            .unwrap_err();
        assert!(error.contains("database is missing"));
        assert!(!database.exists());
        assert!(workspace.initialize().is_err());
        assert!(!database.exists());
    }

    #[test]
    fn real_python_worker_uses_only_the_selected_database() {
        let directory = tempfile::tempdir().unwrap();
        let database = directory.path().join("oracle.sqlite3");
        assert!(request(&database, serde_json::json!({"action":"list"})).is_err());
        assert!(!database.exists());
        maintenance(&database, "initialize").unwrap();
        let result = request(&database, serde_json::json!({"action":"list"})).unwrap();
        assert_eq!(result, serde_json::json!({"total":0,"items":[]}));
        let documents = request(&database, serde_json::json!({"action":"documents_list"})).unwrap();
        assert_eq!(documents, serde_json::json!({"items":[]}));
        assert!(request(
            &database,
            serde_json::json!({"action":"documents_list","path":"private"})
        )
        .is_err());
        assert!(database.is_file());
        assert!(request(&database, serde_json::json!({"action":"delete_all"})).is_err());
    }
}
