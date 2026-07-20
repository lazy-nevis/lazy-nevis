//! Screenshot demo gate, seed, poses, capture, and in-process catalog runner.
//!
//! Active only with `--screenshot-demo` and/or `LAZYNEVIS_DEMO=1`, and always
//! requires an isolated `--data-dir` / `LAZYNEVIS_DATA_DIR`.

mod capture;
pub mod catalog;
pub mod seed;

pub use catalog::{run_catalog, CatalogFile};
pub use seed::apply_demo_seed;

use crate::error::{AppError, Result};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct DemoLaunchConfig {
    pub active: bool,
    pub data_dir: Option<PathBuf>,
    pub catalog_path: Option<PathBuf>,
    pub out_dir: Option<PathBuf>,
}

impl DemoLaunchConfig {
    /// True when the operator requested an automated catalog capture run.
    pub fn wants_catalog_run(&self) -> bool {
        self.active && self.catalog_path.is_some() && self.out_dir.is_some()
    }

    pub fn validate(&self) -> std::result::Result<(), String> {
        if !self.active {
            return Ok(());
        }
        if self.data_dir.is_none() {
            return Err(
                "Screenshot demo requires --data-dir or LAZYNEVIS_DATA_DIR (isolated profile)"
                    .into(),
            );
        }
        if self.catalog_path.is_some() ^ self.out_dir.is_some() {
            return Err(
                "Screenshot demo catalog runs require both --catalog and --out (or LAZYNEVIS_CATALOG / LAZYNEVIS_SCREENSHOT_OUT)"
                    .into(),
            );
        }
        Ok(())
    }
}

pub fn parse_demo_launch() -> DemoLaunchConfig {
    let args: Vec<String> = std::env::args().collect();
    let flag_demo = args.iter().any(|a| a == "--screenshot-demo");
    let env_demo = std::env::var("LAZYNEVIS_DEMO")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let active = flag_demo || env_demo;

    let data_dir = arg_value(&args, "--data-dir")
        .or_else(|| std::env::var_os("LAZYNEVIS_DATA_DIR").map(PathBuf::from));
    let catalog_path = arg_value(&args, "--catalog")
        .or_else(|| std::env::var_os("LAZYNEVIS_CATALOG").map(PathBuf::from));
    let out_dir = arg_value(&args, "--out")
        .or_else(|| std::env::var_os("LAZYNEVIS_SCREENSHOT_OUT").map(PathBuf::from));

    DemoLaunchConfig {
        active,
        data_dir,
        catalog_path,
        out_dir,
    }
}

fn arg_value(args: &[String], flag: &str) -> Option<PathBuf> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from)
}

pub fn require_demo_active(active: bool) -> Result<()> {
    if active {
        Ok(())
    } else {
        Err(AppError::DemoInactive)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inactive_config_validates() {
        let cfg = DemoLaunchConfig {
            active: false,
            data_dir: None,
            catalog_path: None,
            out_dir: None,
        };
        assert!(cfg.validate().is_ok());
        assert!(!cfg.wants_catalog_run());
    }

    #[test]
    fn active_without_data_dir_fails() {
        let cfg = DemoLaunchConfig {
            active: true,
            data_dir: None,
            catalog_path: None,
            out_dir: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn catalog_requires_both_paths() {
        let cfg = DemoLaunchConfig {
            active: true,
            data_dir: Some(PathBuf::from("/tmp/demo")),
            catalog_path: Some(PathBuf::from("catalog.json")),
            out_dir: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn catalog_run_when_complete() {
        let cfg = DemoLaunchConfig {
            active: true,
            data_dir: Some(PathBuf::from("/tmp/demo")),
            catalog_path: Some(PathBuf::from("catalog.json")),
            out_dir: Some(PathBuf::from("/tmp/out")),
        };
        assert!(cfg.validate().is_ok());
        assert!(cfg.wants_catalog_run());
    }
}
