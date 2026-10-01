//! Explicit key-only connection checks. No record access or model execution lives here.
use crate::{auth::Access, commands::SharedAccess, provider_vault};
use serde_json::{json, Value};
use std::{
    fs::{File, OpenOptions},
    io::Read,
    os::windows::fs::OpenOptionsExt,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{State, WebviewWindow};
use zeroize::Zeroizing;

const INVALID: &str = "Invalid provider settings request.";
const CORRUPT: &str = "Oracle's provider settings are unreadable. No connection was attempted.";
const CONFLICT: &str = "Provider settings changed. Refresh before continuing.";
const ENDPOINT: &str = "https://api.openai.com/v1/models";
const MAX_VERSION: u64 = 9_007_199_254_740_991;
const MAX_RESPONSE: u64 = 512 * 1024;

struct Settings {
    revision: u64,
    allow_test: bool,
    key: Zeroizing<String>,
}
impl Settings {
    fn empty() -> Self {
        Self {
            revision: 0,
            allow_test: false,
            key: Zeroizing::new(String::new()),
        }
    }
    fn decode(raw: &[u8]) -> Result<Self, &'static str> {
        if raw.len() < 13 || raw.len() > 1037 || &raw[..4] != b"ORC1" || raw[12] > 1 {
            return Err(CORRUPT);
        }
        let revision = u64::from_le_bytes(raw[4..12].try_into().map_err(|_| CORRUPT)?);
        let key = Zeroizing::new(
            std::str::from_utf8(&raw[13..])
                .map_err(|_| CORRUPT)?
                .to_owned(),
        );
        if revision == 0 || revision > MAX_VERSION || (!key.is_empty() && !valid_key(&key)) {
            return Err(CORRUPT);
        }
        Ok(Self {
            revision,
            allow_test: raw[12] == 1,
            key,
        })
    }
    fn encode(&self) -> Zeroizing<Vec<u8>> {
        let mut bytes = Zeroizing::new(b"ORC1".to_vec());
        bytes.extend_from_slice(&self.revision.to_le_bytes());
        bytes.push(u8::from(self.allow_test));
        bytes.extend_from_slice(self.key.as_bytes());
        bytes
    }
    fn status(&self) -> Value {
        json!({"provider":"openai", "revision":self.revision, "key_present":!self.key.is_empty(),
               "connection_tests_allowed":self.allow_test, "record_access":"none"})
    }
}

fn valid_key(key: &str) -> bool {
    (16..=1024).contains(&key.len())
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
}

pub struct ProviderStore {
    directory: PathBuf,
    target: String,
}
impl ProviderStore {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            target: "Oracle.Provider.OpenAI.v1".into(),
        }
    }
    fn lease(&self) -> Result<File, &'static str> {
        // Windows sharing denial serializes read/check/write across Oracle instances.
        OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .share_mode(0)
            .open(self.directory.join("provider-settings.lock"))
            .map_err(|_| {
                "Provider settings are busy or unavailable. Close the key dialog, then refresh."
            })
    }
    fn execute(
        &self,
        payload: Value,
        prompt: impl FnOnce() -> Result<Option<Zeroizing<String>>, &'static str>,
        probe: impl FnOnce(&str) -> Result<(), &'static str>,
    ) -> Result<Value, &'static str> {
        let object = payload.as_object().ok_or(INVALID)?;
        let action = payload["action"].as_str().ok_or(INVALID)?;
        let fields: &[&str] = match action {
            "status" => &["action"],
            "permission" => &["action", "revision", "allowed"],
            "enter_key" | "remove_key" | "test" => &["action", "revision"],
            _ => return Err(INVALID),
        };
        if object.len() != fields.len() || !fields.iter().all(|key| object.contains_key(*key)) {
            return Err(INVALID);
        }
        let _lease = self.lease()?;
        let mut settings = match provider_vault::read(&self.target)? {
            Some(raw) => Settings::decode(&raw)?,
            None => Settings::empty(),
        };
        if action == "status" {
            return Ok(settings.status());
        }
        if payload["revision"].as_u64() != Some(settings.revision) {
            return Err(CONFLICT);
        }
        match action {
            "permission" => settings.allow_test = payload["allowed"].as_bool().ok_or(INVALID)?,
            "enter_key" => {
                let Some(key) = prompt()? else {
                    return Ok(settings.status());
                };
                if !valid_key(&key) {
                    return Err("The API key format was not accepted. No key was saved.");
                }
                settings.key = key;
                settings.allow_test = false;
            }
            "remove_key" => {
                settings.key = Zeroizing::new(String::new());
                settings.allow_test = false;
            }
            "test" => {
                if !settings.allow_test || settings.key.is_empty() {
                    return Err("Save a key and explicitly allow connection tests first.");
                }
                probe(&settings.key)?;
                return Ok(json!({"connected":true,"revision":settings.revision}));
            }
            _ => return Err(INVALID),
        }
        if settings.revision >= MAX_VERSION {
            return Err(CORRUPT);
        }
        settings.revision += 1;
        provider_vault::write(&self.target, &mut settings.encode())?;
        Ok(settings.status())
    }
}

fn validate_models(raw: &[u8]) -> Result<(), &'static str> {
    let failure = "The provider returned an unexpected response.";
    if raw.len() as u64 > MAX_RESPONSE {
        return Err(failure);
    }
    let value: Value = serde_json::from_slice(raw).map_err(|_| failure)?;
    let models = value["data"].as_array().ok_or(failure)?;
    if value["object"] != "list"
        || models.len() > 5000
        || !models.iter().all(|row| {
            row["object"] == "model"
                && row["id"]
                    .as_str()
                    .is_some_and(|id| !id.is_empty() && id.len() <= 256)
        })
    {
        return Err(failure);
    }
    Ok(())
}

fn probe(key: &str) -> Result<(), &'static str> {
    let failed = "The connection check failed. Check your network and provider status, then retry explicitly.";
    let client = reqwest::blocking::Client::builder()
        .https_only(true)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(10))
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .map_err(|_| failed)?;
    let bearer = Zeroizing::new(format!("Bearer {key}"));
    let mut header = reqwest::header::HeaderValue::from_str(&bearer).map_err(|_| INVALID)?;
    header.set_sensitive(true);
    let response = client
        .get(ENDPOINT)
        .header(reqwest::header::AUTHORIZATION, header)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .map_err(|_| failed)?;
    match response.status().as_u16() {
        200 => {}
        401 => return Err("OpenAI did not accept this API key."),
        403 => return Err("This API key cannot list models. Check its provider permissions."),
        429 => return Err("The provider limited this request. Wait before trying again."),
        _ => return Err(failed),
    }
    if response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .is_none_or(|h| h.split(';').next() != Some("application/json"))
    {
        return Err(failed);
    }
    let mut body = Vec::new();
    response
        .take(MAX_RESPONSE + 1)
        .read_to_end(&mut body)
        .map_err(|_| failed)?;
    validate_models(&body)
}

fn guarded<T>(
    access: &Mutex<Access>,
    action: impl FnOnce() -> Result<T, &'static str>,
) -> Result<T, &'static str> {
    let guard = access.lock().map_err(|_| "Oracle access is unavailable.")?;
    guard.require_unlocked()?;
    action() // Hold authorization until key entry or the bounded connection check finishes.
}

#[tauri::command]
pub async fn provider_settings(
    payload: Value,
    window: WebviewWindow,
    access: State<'_, SharedAccess>,
    store: State<'_, Arc<ProviderStore>>,
) -> Result<Value, &'static str> {
    let parent = window.hwnd().map_err(|_| INVALID)?.0 as usize;
    let access = access.inner().clone();
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        guarded(&access, || {
            store.execute(payload, || provider_vault::prompt(parent), probe)
        })
    })
    .await
    .map_err(|_| "Oracle could not complete the provider operation.")?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    const KEY: &str = "synthetic-never-a-real-key-123456";

    struct Fixture {
        store: ProviderStore,
        _directory: tempfile::TempDir,
    }
    impl Fixture {
        fn new() -> Self {
            let directory = tempfile::tempdir().unwrap();
            let store = ProviderStore {
                directory: directory.path().into(),
                target: format!(
                    "Oracle.Tests.Provider.{}",
                    directory.path().file_name().unwrap().to_str().unwrap()
                ),
            };
            Self {
                store,
                _directory: directory,
            }
        }
        fn call(&self, payload: Value) -> Result<Value, &'static str> {
            self.store.execute(
                payload,
                || Ok(Some(Zeroizing::new(KEY.into()))),
                |_| panic!("No network expected"),
            )
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            provider_vault::remove_synthetic(&self.store.target);
        }
    }

    #[test]
    fn vault_round_trip_exposes_only_status_and_replacement_revokes_permission() {
        let fixture = Fixture::new();
        let initial = fixture.call(json!({"action":"status"})).unwrap();
        assert_eq!(initial["revision"], 0);
        assert_eq!(initial["connection_tests_allowed"], false);
        let saved = fixture
            .call(json!({"action":"enter_key","revision":0}))
            .unwrap();
        assert_eq!(saved["key_present"], true);
        assert!(!saved.to_string().contains(KEY));
        assert!(fixture.call(json!({"action":"test","revision":1})).is_err());
        fixture
            .call(json!({"action":"permission","revision":1,"allowed":true}))
            .unwrap();
        let called = AtomicBool::new(false);
        let connected = fixture
            .store
            .execute(
                json!({"action":"test","revision":2}),
                || panic!("No key prompt expected"),
                |key| {
                    assert_eq!(key, KEY);
                    called.store(true, Ordering::SeqCst);
                    Ok(())
                },
            )
            .unwrap();
        assert!(called.load(Ordering::SeqCst));
        assert_eq!(connected, json!({"connected":true,"revision":2}));
        let replaced = fixture
            .call(json!({"action":"enter_key","revision":2}))
            .unwrap();
        assert_eq!(replaced["connection_tests_allowed"], false);
        let removed = fixture
            .call(json!({"action":"remove_key","revision":3}))
            .unwrap();
        assert_eq!(removed["key_present"], false);
        assert_eq!(removed["revision"], 4);
        assert!(!provider_vault::read(&fixture.store.target)
            .unwrap()
            .unwrap()
            .windows(KEY.len())
            .any(|s| s == KEY.as_bytes()));
    }

    #[test]
    fn cancelled_prompt_and_stale_revision_never_overwrite_settings() {
        let fixture = Fixture::new();
        fixture
            .call(json!({"action":"enter_key","revision":0}))
            .unwrap();
        let before = provider_vault::read(&fixture.store.target)
            .unwrap()
            .unwrap();
        fixture
            .store
            .execute(
                json!({"action":"enter_key","revision":1}),
                || Ok(None),
                |_| panic!(),
            )
            .unwrap();
        assert_eq!(
            fixture.call(json!({"action":"remove_key","revision":0})),
            Err(CONFLICT)
        );
        assert_eq!(
            *provider_vault::read(&fixture.store.target)
                .unwrap()
                .unwrap(),
            *before
        );
    }

    #[test]
    fn malformed_ipc_cannot_select_endpoints_or_send_secrets() {
        let fixture = Fixture::new();
        for payload in [
            json!({"action":"status","key":KEY}),
            json!({"action":"test","revision":0,"url":"http://localhost"}),
            json!({"action":"run_model","revision":0}),
            json!({"action":"permission","revision":0,"allowed":"yes"}),
        ] {
            assert!(fixture.call(payload).is_err());
        }
        assert!(provider_vault::read(&fixture.store.target)
            .unwrap()
            .is_none());
    }

    #[test]
    fn damaged_vault_fails_closed_and_is_not_reinitialized() {
        let fixture = Fixture::new();
        let mut raw = b"damaged synthetic credential".to_vec();
        provider_vault::write(&fixture.store.target, &mut raw).unwrap();
        assert_eq!(fixture.call(json!({"action":"status"})), Err(CORRUPT));
        assert_eq!(
            fixture.call(json!({"action":"remove_key","revision":0})),
            Err(CORRUPT)
        );
        assert_eq!(
            *provider_vault::read(&fixture.store.target)
                .unwrap()
                .unwrap(),
            raw
        );
    }

    #[test]
    fn separate_instances_cannot_interleave_credential_updates() {
        let fixture = Fixture::new();
        let lease = fixture.store.lease().unwrap();
        assert!(fixture.call(json!({"action":"status"})).is_err());
        drop(lease);
        assert!(fixture.call(json!({"action":"status"})).is_ok());
    }

    #[test]
    fn locked_session_cannot_read_prompt_write_or_probe() {
        let directory = tempfile::tempdir().unwrap();
        let access = Mutex::new(Access::new(directory.path().join("password.phc")));
        let called = AtomicBool::new(false);
        let result = guarded(&access, || {
            called.store(true, Ordering::SeqCst);
            Ok(())
        });
        assert!(result.is_err());
        assert!(!called.load(Ordering::SeqCst));
    }

    #[test]
    fn key_and_response_validation_is_bounded() {
        for key in [
            "",
            "too-short",
            "synthetic-key-with\nnewline",
            "synthetic-key-with space",
            "非ascii-password-123456",
        ] {
            assert!(!valid_key(key));
        }
        assert!(!valid_key(&"a".repeat(1025)));
        assert!(validate_models(
            br#"{"object":"list","data":[{"object":"model","id":"synthetic"}]}"#
        )
        .is_ok());
        for raw in [
            b"null".as_slice(),
            br#"{"object":"list","data":[{}]}"#,
            b"private error response",
        ] {
            assert!(validate_models(raw).is_err());
        }
        assert!(validate_models(&vec![b' '; MAX_RESPONSE as usize + 1]).is_err());
    }

    #[test]
    fn lock_waits_for_admitted_provider_work_and_rejects_later_work() {
        let directory = tempfile::tempdir().unwrap();
        let mut access = Access::new(directory.path().join("password.phc"));
        access
            .create_password("Synthetic provider gate password")
            .unwrap();
        access
            .unlock(
                "Synthetic provider gate password",
                std::time::Instant::now(),
            )
            .unwrap();
        let access = Mutex::new(access);
        let (started, ready) = std::sync::mpsc::channel();
        let (release, proceed) = std::sync::mpsc::channel();
        let (locked, finished) = std::sync::mpsc::channel();
        std::thread::scope(|scope| {
            let access_ref = &access;
            let worker = scope.spawn(move || {
                guarded(access_ref, || {
                    started.send(()).unwrap();
                    proceed.recv_timeout(Duration::from_secs(3)).unwrap();
                    Ok(())
                })
            });
            ready.recv_timeout(Duration::from_secs(3)).unwrap();
            scope.spawn(move || {
                access_ref.lock().unwrap().lock();
                locked.send(()).unwrap();
            });
            assert!(finished.recv_timeout(Duration::from_millis(30)).is_err());
            release.send(()).unwrap();
            worker.join().unwrap().unwrap();
            finished.recv_timeout(Duration::from_secs(3)).unwrap();
        });
        assert!(guarded(&access, || Ok(())).is_err());
    }
}
