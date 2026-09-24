fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_status",
            "create_password",
            "unlock",
            "lock",
            "check_health",
        ]),
    ))
    .expect("Could not build Oracle permissions");
}
