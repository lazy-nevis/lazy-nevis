/**
 * Types for the screenshot catalog (input) and manifest (output).
 * Keep in sync with schemas/*.schema.json.
 */

export type ScreenshotPlatform = "macos" | "linux" | "windows";
export type ScreenshotLocale = "en-US" | "pt-BR";
export type ScreenshotTheme = "light" | "dark";
export type ScreenshotWindow = "main" | "overlay" | "tray" | "secondary";
export type ScreenshotAppMode = "full" | "compact";
export type SessionPose =
  | "idle"
  | "running_focused"
  | "running_distracted"
  | "paused";
export type OverlayPose = "none" | "fullscreen" | "notification";
export type ShotStatus = "captured" | "skipped" | "failed";

export interface CatalogDefaults {
  locale?: ScreenshotLocale;
  settleMs?: number;
  window?: ScreenshotWindow;
  mode?: ScreenshotAppMode;
  required?: boolean;
}

export interface CatalogShot {
  id: string;
  file: string;
  legacyFilenames?: string[];
  window?: ScreenshotWindow;
  route?: string;
  pane?: "settings" | "history" | "checklist-history";
  feature: string;
  state: string;
  theme: ScreenshotTheme;
  locale?: ScreenshotLocale;
  mode?: ScreenshotAppMode;
  sessionPose?: SessionPose;
  overlayPose?: OverlayPose;
  settingsTab?: string;
  /** Open History session detail for the seeded hero session. */
  historyDetail?: boolean;
  settleMs?: number;
  required?: boolean;
  title: string;
  tags: string[];
  notes?: string;
}

export interface ScreenshotCatalog {
  version: 1;
  defaults: CatalogDefaults;
  shots: CatalogShot[];
}

export interface ManifestShot {
  id: string;
  file: string;
  window?: ScreenshotWindow;
  route?: string;
  pane?: string;
  feature: string;
  state: string;
  theme: ScreenshotTheme;
  locale?: ScreenshotLocale;
  mode?: ScreenshotAppMode;
  sessionPose?: string;
  title: string;
  tags: string[];
  status: ShotStatus;
  skipReason?: string;
  error?: string;
  width?: number;
  height?: number;
}

export interface ScreenshotManifest {
  schemaVersion: 1;
  appVersion: string;
  platform: ScreenshotPlatform;
  locale?: ScreenshotLocale;
  capturedAt: string;
  scaleFactor?: number;
  catalogVersion?: number;
  binaryPath?: string;
  dataDir?: string;
  shots: ManifestShot[];
}

export interface CaptureRequest {
  shotId: string;
  window: ScreenshotWindow;
  outPath: string;
  settleMs: number;
}

export interface CaptureResult {
  outPath: string;
  width: number;
  height: number;
}
