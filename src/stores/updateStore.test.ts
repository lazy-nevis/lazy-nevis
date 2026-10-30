import { beforeEach, describe, expect, it } from "vitest";
import {
  resetUpdateStoreForTests,
  selectAlertRelease,
  selectUnseenVersion,
  useUpdateStore,
} from "./updateStore";

const release = { version: "0.10.0-rc.5", url: "https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.10.0-rc.5" };

describe("updateStore", () => {
  beforeEach(() => resetUpdateStoreForTests());

  it("announces a new release until dismissed", () => {
    useUpdateStore.getState().setRelease(release);
    expect(selectAlertRelease(useUpdateStore.getState())).toEqual(release);
    useUpdateStore.getState().dismiss();
    expect(selectAlertRelease(useUpdateStore.getState())).toBeNull();
    // Dismissing the alert keeps the badge/tray dot until About is opened.
    expect(selectUnseenVersion(useUpdateStore.getState())).toBe("0.10.0-rc.5");
  });

  it("clears the unseen marker once About marks it seen", () => {
    useUpdateStore.getState().setRelease(release);
    useUpdateStore.getState().markSeen();
    expect(selectUnseenVersion(useUpdateStore.getState())).toBeNull();
    expect(selectAlertRelease(useUpdateStore.getState())).toBeNull();
  });

  it("re-arms the notice for a newer version", () => {
    useUpdateStore.getState().setRelease(release);
    useUpdateStore.getState().markSeen();
    useUpdateStore.getState().setRelease({ ...release, version: "0.10.0-rc.6" });
    expect(selectUnseenVersion(useUpdateStore.getState())).toBe("0.10.0-rc.6");
    expect(selectAlertRelease(useUpdateStore.getState())?.version).toBe("0.10.0-rc.6");
  });
});
