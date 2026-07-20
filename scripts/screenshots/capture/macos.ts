import type { CaptureAdapter } from "./types";
import { unsupportedCapture } from "./types";

/**
 * OS-level capture adapters remain stubs.
 * Production screenshot runs capture inside the Rust binary via `xcap`
 * (`src-tauri/src/demo/capture.rs`) during `--screenshot-demo` catalog runs.
 */
export function createMacosCaptureAdapter(): CaptureAdapter {
  return unsupportedCapture("macos");
}
