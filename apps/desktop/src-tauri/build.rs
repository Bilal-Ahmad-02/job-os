fn main() {
    // Rebuild the executable's Windows resource when the icon changes, not only
    // the window icon embedded by generate_context! in the application code.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "auth_status",
            "create_password",
            "unlock",
            "lock",
            "check_health",
            "applications",
        ]),
    ))
    .expect("Could not build Oracle permissions");
}
