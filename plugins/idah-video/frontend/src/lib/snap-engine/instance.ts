// ---------------------------------------------------------------------------
// snap-engine/instance.ts — Global SnapEngine singleton for video plugin
//
// Import this from ShapesContainer instead of from src/lib/index.ts,
// so index.ts stays default-export-only (avoiding the Vite lib-mode
// mixed-exports warning).
// ---------------------------------------------------------------------------

import { SnapEngine } from "./index";

export const snapEngine = new SnapEngine();
