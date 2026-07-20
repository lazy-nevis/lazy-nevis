import type { CaptureRequest, CaptureResult, ScreenshotPlatform } from "../types";

/**
 * Platform capture adapter contract.
 * Implementations write a PNG to `request.outPath` and return dimensions.
 */
export interface CaptureAdapter {
  readonly platform: ScreenshotPlatform;
  capture(request: CaptureRequest): Promise<CaptureResult>;
}

export function unsupportedCapture(platform: ScreenshotPlatform): CaptureAdapter {
  return {
    platform,
    async capture(request: CaptureRequest): Promise<CaptureResult> {
      throw new Error(
        `Screenshot capture is not implemented for ${platform} (shot=${request.shotId}). ` +
          `See openspec/changes/2026-07-screenshot-automation/design.md Phase C.`,
      );
    },
  };
}
