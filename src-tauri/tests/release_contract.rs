use std::fs;
use std::path::PathBuf;

fn project_file(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    fs::read_to_string(root.join(path)).expect("release contract file must be readable")
}

#[test]
fn release_versions_are_synchronized() {
    let package: serde_json::Value = serde_json::from_str(&project_file("package.json")).unwrap();
    let tauri: serde_json::Value =
        serde_json::from_str(&project_file("src-tauri/tauri.conf.json")).unwrap();
    assert_eq!(package["version"], tauri["version"]);
    assert!(project_file("src-tauri/Cargo.toml").contains(&format!(
        "version = \"{}\"",
        package["version"].as_str().unwrap()
    )));
}

#[test]
fn overlay_capability_excludes_privileged_plugins() {
    let overlay = project_file("src-tauri/capabilities/overlay.json");
    for forbidden in [
        "shell",
        "opener",
        "dialog",
        "store",
        "notification",
        "global-shortcut",
    ] {
        assert!(
            !overlay.contains(forbidden),
            "overlay unexpectedly grants {forbidden}"
        );
    }
}

#[test]
fn every_numbered_migration_is_wired() {
    let db = project_file("src-tauri/src/db/mod.rs");
    for migration in [
        "0001_initial.sql",
        "0002_session_runtime.sql",
        "0003_recent_audio_files.sql",
    ] {
        assert!(
            db.contains(migration),
            "migration {migration} is not executed"
        );
    }
}
