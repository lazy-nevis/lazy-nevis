# Frontend Architecture

React 19 starts in `src/main.tsx`; `src/App.tsx` owns routing and the single `useFocusSession()` registration. Pages compose custom primitives, feature components, and pure SVG charts. Zustand stores hold session/settings/UI state; hooks coordinate Tauri calls; every invoke wrapper lives in `src/services/tauri.ts`, with payloads mirrored in `src/types/index.ts`.

User text belongs in both locale JSON files and uses `t()`. Formatting belongs in `src/utils`. Visual work follows `DESIGN.md`. Hook/store tests use Vitest and Testing Library. See `RTK.md` for live event and recovery details.
