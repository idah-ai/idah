import { type Point, type VideoFrameSelection } from "./VideoAnnotationContext";

// -----------------
// Polygon helper functions
// -----------------

function polygonBarycenter(points: Point[]): Point {
  const pts = [...points, points[0]];
  const x = pts.map(p => p[0]);
  const y = pts.map(p => p[1]);

  let crossSum = 0, cxSum = 0, cySum = 0;

  for (let i = 0; i < x.length - 1; i++) {
    const cross = x[i] * y[i + 1] - x[i + 1] * y[i];
    crossSum += cross;
    cxSum += (x[i] + x[i + 1]) * cross;
    cySum += (y[i] + y[i + 1]) * cross;
  }

  const area = 0.5 * crossSum;
  return [cxSum / (6 * area), cySum / (6 * area)];
}

function verticesToPolar(points: Point[], center: Point): [number, number, number][] {
  return points.map((p, i) => {
    const v: Point = [p[0] - center[0], p[1] - center[1]];
    const angle = Math.atan2(v[1], v[0]);
    const radius = Math.hypot(v[0], v[1]);
    return [i, angle, radius];
  });
}

function reorderByAngle(points: Point[], center: Point): [Point[], [number, number, number][]] {
  const polar = verticesToPolar(points, center);
  const polarSorted = [...polar].sort((a, b) => b[1] - a[1]);
  const target = Math.PI / 2;

  const startIdx = polarSorted.reduce((bestIdx, curr, idx) => {
    const angleDiff = Math.atan2(Math.sin(curr[1] - target), Math.cos(curr[1] - target));
    return Math.abs(angleDiff) < Math.abs(Math.atan2(Math.sin(polarSorted[bestIdx][1] - target), Math.cos(polarSorted[bestIdx][1] - target))) ? idx : bestIdx;
  }, 0);

  const polarRotated = polarSorted.slice(startIdx).concat(polarSorted.slice(0, startIdx));
  const reorderedPoints = polarRotated.map(([oldIdx]) => points[oldIdx]);
  const polarReindexed = polarRotated.map(([_, angle, radius], i) => [i, angle, radius] as [number, number, number]);

  return [reorderedPoints, polarReindexed];
}

function matchVerticesByBarycenter(polyMin: Point[], polyMax: Point[]): [Point[], Point[], Record<number, number>] {
  const cMin = polygonBarycenter(polyMin);
  const cMax = polygonBarycenter(polyMax);

  const [polyMinRe, polarMin] = reorderByAngle(polyMin, cMin);
  const [polyMaxRe, polarMax] = reorderByAngle(polyMax, cMax);

  const matches: Record<number, number> = {};

  for (const [iMin, angMin] of polarMin) {
    let bestJ: number | null = null;
    let bestDist = Infinity;

    for (const [iMax, angMax] of polarMax) {
      const d = Math.abs(Math.atan2(Math.sin(angMin - angMax), Math.cos(angMin - angMax)));
      if (d < bestDist) {
        bestDist = d;
        bestJ = iMax;
      }
    }
    if (bestJ !== null) matches[iMin] = bestJ;
  }

  return [polyMinRe, polyMaxRe, matches];
}

function expandPolygonUsingMatches(polyMin: Point[], polyMax: Point[], matches: Record<number, number>): Point[] {
  const nMax = polyMax.length;
  const expanded: (Point | null)[] = Array(nMax).fill(null);

  for (const minIdx in matches) {
    const maxIdx = matches[minIdx];
    expanded[maxIdx] = polyMin[parseInt(minIdx)];
  }

  const circDist = (a: number, b: number, n: number) => (b - a + n) % n;

  for (let i = 0; i < nMax; i++) {
    if (expanded[i] === null) {
      let prevI = (i - 1 + nMax) % nMax;
      while (expanded[prevI] === null) prevI = (prevI - 1 + nMax) % nMax;

      let nextI = (i + 1) % nMax;
      while (expanded[nextI] === null) nextI = (nextI + 1) % nMax;

      const pPrev = expanded[prevI]!;
      const pNext = expanded[nextI]!;
      const total = circDist(prevI, nextI, nMax);
      const cur = circDist(prevI, i, nMax);
      const t = total > 0 ? cur / total : 0;

      expanded[i] = [
        (1 - t) * pPrev[0] + t * pNext[0],
        (1 - t) * pPrev[1] + t * pNext[1]
      ];
    }
  }

  return expanded as Point[];
}

function lerpPolygons(P1: Point[], P2: Point[], alpha: number): Point[] {
  return P1.map((p, i) => [
    (1 - alpha) * p[0] + alpha * P2[i][0],
    (1 - alpha) * p[1] + alpha * P2[i][1]
  ]);
}

// -----------------
// Main currentShape-style function
// -----------------

export function interpolatePolygonAtFrame(
  frameStart: VideoFrameSelection,
  frameEnd: VideoFrameSelection,
  current_frame: number
): Point[] {
  let maxFrame
  let minFrame
  if (frameStart.points.length < frameEnd.points.length) {
    minFrame = frameStart
    maxFrame = frameEnd
  } else {
    minFrame = frameEnd
    maxFrame = frameStart
  }

  // match vertices and expand
  const [frameStartRe, frameEndRe, matches] = matchVerticesByBarycenter(minFrame.points, maxFrame.points);
  const P1 = expandPolygonUsingMatches(frameStartRe, frameEndRe, matches);

  // linear interpolation
  const alpha = (current_frame - minFrame.frame) / (maxFrame.frame - minFrame.frame);

  const t = Math.min(Math.max(alpha, 0), 1);

  return lerpPolygons(P1, frameEndRe, t);
}
