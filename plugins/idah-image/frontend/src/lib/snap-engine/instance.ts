// ---------------------------------------------------------------------------
// snap-engine/instance.ts — Global SnapEngine singleton
//
// Import this from ShapesContainer and other components instead of
// importing from src/lib/index.ts, so index.ts stays default-export-only
// (avoiding the Vite lib-mode mixed-exports warning).
// ---------------------------------------------------------------------------

import { SnapEngine } from "./index";

export const snapEngine = new SnapEngine();
