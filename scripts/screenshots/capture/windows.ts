import type { CaptureAdapter } from "./types";
import { unsupportedCapture } from "./types";

/** See macos.ts — capture is in-process via Rust `xcap`. */
export function createWindowsCaptureAdapter(): CaptureAdapter {
  return unsupportedCapture("windows");
}
