import type { CaptureAdapter, ScreenshotPlatform } from "../types";
import { createLinuxCaptureAdapter } from "./linux";
import { createMacosCaptureAdapter } from "./macos";
import { createWindowsCaptureAdapter } from "./windows";

export function createCaptureAdapter(platform: ScreenshotPlatform): CaptureAdapter {
  switch (platform) {
    case "macos":
      return createMacosCaptureAdapter();
    case "linux":
      return createLinuxCaptureAdapter();
    case "windows":
      return createWindowsCaptureAdapter();
  }
}

export type { CaptureAdapter } from "./types";
