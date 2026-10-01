#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod applications;
mod auth;
mod commands;
mod health;
mod provider_vault;
mod providers;
mod shell;
#[cfg(windows)]
mod windows_icon;
mod wsl;

use std::sync::{Arc, Mutex};
use tauri::{webview::NewWindowResponse, Manager, WebviewWindowBuilder};

fn navigation_allowed(url: &tauri::Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let packaged = url.scheme() == "http"
        && url.host_str() == Some("tauri.localhost")
        && url.port_or_known_default() == Some(80);
    let development = cfg!(debug_assertions)
        && url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.port() == Some(1420);
    packaged || development
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::auth_status,
            commands::create_password,
            commands::unlock,
            commands::lock,
            commands::rotation_status,
            commands::enroll_rotation,
            commands::unlock_rotation,
            shell::shell_mode,
            shell::shell_action,
            commands::check_health,
            commands::applications,
            providers::provider_settings,
        ])
        .setup(|app| {
            let path = app.path().app_local_data_dir()?.join("password.phc");
            app.manage(Arc::new(Mutex::new(auth::Access::new(path))));
            app.manage(Arc::new(providers::ProviderStore::new(
                app.path().app_local_data_dir()?,
            )));
            app.manage(applications::ApplicationStore(Arc::new(Mutex::new(
                applications::Workspace::from_app_data(&app.path().app_local_data_dir()?)?,
            ))));
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("Oracle window configuration is missing")?;
            let window = WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(navigation_allowed)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_download(|_, _| false)
                .build()?;
            #[cfg(windows)]
            windows_icon::configure(&window)?;
            shell::initialize(&window)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Oracle could not start");
}

#[cfg(test)]
mod tests {
    use super::navigation_allowed;

    #[test]
    fn allows_packaged_assets() {
        assert!(navigation_allowed(
            &"http://tauri.localhost/index.html".parse().unwrap()
        ));
    }

    #[test]
    fn development_origin_depends_on_build_mode() {
        assert_eq!(
            navigation_allowed(&"http://127.0.0.1:1420/".parse().unwrap()),
            cfg!(debug_assertions)
        );
    }

    #[test]
    fn blocks_remote_and_unexpected_navigation() {
        for url in [
            "https://example.com/",
            "http://tauri.localhost.evil.example/",
            "http://tauri.localhost:8080/",
            "http://user@tauri.localhost/",
            "http://127.0.0.1:8000/health",
            "http://localhost:1420/",
            "file:///C:/Windows/win.ini",
            "data:text/html,hello",
        ] {
            assert!(!navigation_allowed(&url.parse().unwrap()), "allowed {url}");
        }
    }
}
