import { create } from "zustand";
import type { ReleaseInfo } from "@/services/updates";

const DISMISSED_KEY = "lazynevis.update.dismissed";
const SEEN_KEY = "lazynevis.update.seen";

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable; the notice just re-appears next launch.
  }
}

interface UpdateStore {
  /** Newest release found by the background or manual check; null when current. */
  release: ReleaseInfo | null;
  /** Version whose dashboard alert the user closed. */
  dismissedVersion: string | null;
  /** Version whose details (About) the user already opened. */
  seenVersion: string | null;
  setRelease: (release: ReleaseInfo | null) => void;
  dismiss: () => void;
  markSeen: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  release: null,
  dismissedVersion: readKey(DISMISSED_KEY),
  seenVersion: readKey(SEEN_KEY),
  setRelease: (release) => set({ release }),
  dismiss: () => {
    const version = get().release?.version;
    if (!version) return;
    writeKey(DISMISSED_KEY, version);
    set({ dismissedVersion: version });
  },
  markSeen: () => {
    const version = get().release?.version;
    if (!version) return;
    writeKey(SEEN_KEY, version);
    // Opening the details also settles the dashboard alert for this version.
    writeKey(DISMISSED_KEY, version);
    set({ seenVersion: version, dismissedVersion: version });
  },
}));

/** Release to announce on the dashboard, or null once dismissed. */
export const selectAlertRelease = (s: UpdateStore): ReleaseInfo | null =>
  s.release && s.release.version !== s.dismissedVersion ? s.release : null;

/** Version awaiting attention (badge, tray dot), or null once the details were opened. */
export const selectUnseenVersion = (s: UpdateStore): string | null =>
  s.release && s.release.version !== s.seenVersion ? s.release.version : null;

export function resetUpdateStoreForTests() {
  try {
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
  useUpdateStore.setState({ release: null, dismissedVersion: null, seenVersion: null });
}
