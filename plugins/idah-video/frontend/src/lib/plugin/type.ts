/** MODES */
export const IDAH_VISUAL = "visual"
export type IdahVisual = "visual"

export const IDAH_VIDEO_BOUNDING_BOX = "idah-video:bounding-box";
export type IdahVideoBoundingBox = "idah-video:bounding-box";

export const IDAH_VIDEO_POLYGON = "idah-video:polygon";
export type IdahVideoPolygon = "idah-video:polygon";

export const IDAH_NOTE = "note";
export type IdahNote = "note";

/** DEFAULT MODE */
export const DEFAULT_MODE = IDAH_VISUAL;
export type DefaultMode = IdahVisual;

/** EDITOR MODE */
export const EDITOR_MODE_TOOLS = [IDAH_VIDEO_BOUNDING_BOX, IDAH_VIDEO_POLYGON];

// TODO: review mode name
/** VIEW MODE */
export const VIEW_MODE_TOOLS = [IDAH_NOTE];

/** ENTRY ROOT */
export const ENTRY_ROOT = "entry:root";
export type EntryRoot = "entry:root";

/** SETTINGS */
export const IDAH_VIDEO_LOCALSTORAGE_FRAME_STEP = "idah-video:settings:frame-step";
