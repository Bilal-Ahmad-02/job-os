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
pub fn auth_status(access: State<'_, SharedAccess>) -> Result<&'static str, &'static str> {
    access.lock().map_err(|_| FAILED)?.status()
}

#[tauri::command]
pub async fn create_password(
    password: String,
    access: State<'_, SharedAccess>,
) -> Result<(), &'static str> {
    let password = Zeroizing::new(password);
    let access = access.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        access
            .lock()
            .map_err(|_| FAILED)?
            .create_password(&password)
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
pub fn lock(access: State<'_, SharedAccess>) -> Result<(), &'static str> {
    access.lock().map_err(|_| FAILED)?.lock();
    Ok(())
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
