use crate::{auth::Access, health};
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};
use tauri::State;
use zeroize::Zeroizing;

pub type SharedAccess = Arc<Mutex<Access>>;
const FAILED: &str = "Oracle could not complete this operation. Access remains restricted.";

#[tauri::command]
pub fn rotation_status(access: State<'_, SharedAccess>) -> Result<bool, &'static str> {
    access.lock().map_err(|_| FAILED)?.rotation_configured()
}

#[tauri::command]
pub async fn enroll_rotation(
    steps: Vec<i32>,
    confirmation: Vec<i32>,
    access: State<'_, SharedAccess>,
) -> Result<(), &'static str> {
    let steps = Zeroizing::new(steps);
    let confirmation = Zeroizing::new(confirmation);
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access
            .lock()
            .map_err(|_| FAILED)?
            .enroll_rotation(&steps, &confirmation)
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub async fn unlock_rotation(
    steps: Vec<i32>,
    access: State<'_, SharedAccess>,
) -> Result<(), &'static str> {
    let steps = Zeroizing::new(steps);
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access
            .lock()
            .map_err(|_| FAILED)?
            .unlock_rotation(&steps, Instant::now())
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub fn auth_status(access: State<'_, SharedAccess>) -> Result<&'static str, &'static str> {
    access.lock().map_err(|_| FAILED)?.status()
}

#[tauri::command]
pub async fn create_password(
    password: String,
    access: State<'_, SharedAccess>,
    store: State<'_, crate::applications::ApplicationStore>,
) -> Result<(), &'static str> {
    let password = Zeroizing::new(password);
    let access = access.inner().clone();
    let workspace = store.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut access = access.lock().map_err(|_| FAILED)?;
        access.create_password(&password)?;
        // Only a successful first password setup can initialize a new workspace.
        // Existing credentials never authorize automatic recreation of a missing DB.
        workspace.lock().map_err(|_| FAILED)?.initialize().map_err(|_| {
            "Password created, but workspace setup failed. Close and reopen Oracle to check recovery."
        })
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub async fn unlock(password: String, access: State<'_, SharedAccess>) -> Result<(), &'static str> {
    let password = Zeroizing::new(password);
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access
            .lock()
            .map_err(|_| FAILED)?
            .unlock(&password, Instant::now())
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub async fn lock(access: State<'_, SharedAccess>) -> Result<(), &'static str> {
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access.lock().map_err(|_| FAILED)?.lock();
        Ok(())
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub async fn check_health(access: State<'_, SharedAccess>) -> Result<(), &'static str> {
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access.lock().map_err(|_| FAILED)?.require_unlocked()?;
        health::check()?;
        // Discard an in-flight result if the user locked Oracle meanwhile.
        access.lock().map_err(|_| FAILED)?.require_unlocked()
    })
    .await
    .map_err(|_| FAILED)?
}

#[tauri::command]
pub async fn applications(
    payload: serde_json::Value,
    access: State<'_, SharedAccess>,
    store: State<'_, crate::applications::ApplicationStore>,
) -> Result<serde_json::Value, &'static str> {
    let access = access.inner().clone();
    let workspace = store.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Serialize the operation with lock/unlock. Once lock returns, no earlier
        // mutation is still running. AccessGate removes records immediately.
        guarded_applications(&access, &workspace, payload)
    })
    .await
    .map_err(|_| FAILED)?
}

fn guarded_applications(
    access: &Mutex<Access>,
    workspace: &Mutex<crate::applications::Workspace>,
    payload: serde_json::Value,
) -> Result<serde_json::Value, &'static str> {
    let guard = access.lock().map_err(|_| FAILED)?;
    guard.require_unlocked()?;
    workspace.lock().map_err(|_| FAILED)?.request(payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "Requires the disposable WSL integration fixture"]
    fn wsl_mutation_finishes_before_lock_returns() {
        use std::{
            sync::atomic::{AtomicBool, Ordering},
            thread,
            time::Duration,
        };
        let folder = tempfile::tempdir().unwrap();
        let access = Arc::new(Mutex::new(Access::new(folder.path().join("password.phc"))));
        let workspace = Arc::new(Mutex::new(crate::applications::Workspace::synthetic_linux()));
        let payload = serde_json::json!({"action":"profile_save","version":0,
            "data":{"full_name":"Synthetic WSL lock test"}});
        assert!(guarded_applications(&access, &workspace, payload.clone()).is_err());
        access
            .lock()
            .unwrap()
            .create_password("Synthetic WSL passphrase 42")
            .unwrap();
        let held = workspace.lock().unwrap();
        let finished = Arc::new(AtomicBool::new(false));
        let (a, w, done) = (access.clone(), workspace.clone(), finished.clone());
        let mutation = thread::spawn(move || {
            let result = guarded_applications(&a, &w, payload);
            done.store(true, Ordering::SeqCst);
            result
        });
        let deadline = Instant::now() + Duration::from_secs(3);
        while access.try_lock().is_ok() {
            assert!(Instant::now() < deadline);
            thread::sleep(Duration::from_millis(5));
        }
        let a = access.clone();
        let locked = thread::spawn(move || {
            a.lock().unwrap().lock();
        });
        assert!(!finished.load(Ordering::SeqCst));
        drop(held);
        assert_eq!(mutation.join().unwrap().unwrap()["version"], 1);
        locked.join().unwrap();
        assert!(guarded_applications(
            &access,
            &workspace,
            serde_json::json!({"action":"profile_get"})
        )
        .is_err());
    }

    #[test]
    fn application_data_requires_an_unlocked_native_session() {
        let folder = tempfile::tempdir().unwrap();
        let database = folder.path().join("oracle.sqlite3");
        let access = Mutex::new(Access::new(folder.path().join("password.phc")));
        let workspace = Mutex::new(crate::applications::Workspace::new(database.clone()));
        let payload = serde_json::json!({"action":"list"});
        assert!(guarded_applications(&access, &workspace, payload.clone()).is_err());
        for action in [
            "profile_get",
            "profile_save",
            "profile_draft_get",
            "profile_review_get",
            "profile_review_save",
        ] {
            assert!(guarded_applications(
                &access,
                &workspace,
                serde_json::json!({"action":action,"version":0,"data":{}})
            )
            .is_err());
        }
        assert!(!database.exists());
        access
            .lock()
            .unwrap()
            .create_password("Synthetic test passphrase 42")
            .unwrap();
        workspace.lock().unwrap().initialize().unwrap();
        assert!(guarded_applications(&access, &workspace, payload.clone()).is_ok());
        let profile = guarded_applications(
            &access,
            &workspace,
            serde_json::json!({"action":"profile_get"}),
        )
        .unwrap();
        assert_eq!(profile["version"], 0);
        let saved = guarded_applications(
            &access, &workspace, serde_json::json!({"action":"profile_save","version":0,"data":{"full_name":"Synthetic Candidate"}})
        ).unwrap();
        assert_eq!(saved["version"], 1);
        access.lock().unwrap().lock();
        assert!(guarded_applications(&access, &workspace, payload).is_err());
        assert!(guarded_applications(
            &access,
            &workspace,
            serde_json::json!({"action":"profile_get"})
        )
        .is_err());
    }

    #[test]
    fn existing_data_does_not_allow_password_reinitialization() {
        let folder = tempfile::tempdir().unwrap();
        std::fs::write(folder.path().join("oracle.sqlite3"), b"existing data").unwrap();
        let mut access = Access::new(folder.path().join("password.phc"));
        assert!(access.status().is_err());
        assert!(access
            .create_password("Synthetic test passphrase 42")
            .is_err());
        assert!(!folder.path().join("password.phc").exists());
    }
}
