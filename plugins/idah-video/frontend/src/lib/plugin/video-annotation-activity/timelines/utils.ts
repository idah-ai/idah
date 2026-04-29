/**
 * Check if two ranges overlap
 * @param start1 - Start of first range
 * @param end1 - End of first range
 * @param start2 - Start of second range
 * @param end2 - End of second range
 */
export function rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Check if a range is within a viewport
 * @param itemStart - Start of item range
 * @param itemEnd - End of item range
 * @param viewportStart - Start of viewport
 * @param viewportEnd - End of viewport
 */
export function isInViewport(itemStart: number, itemEnd: number, viewportStart: number, viewportEnd: number): boolean {
  return rangesOverlap(itemStart, itemEnd, viewportStart, viewportEnd);
}
