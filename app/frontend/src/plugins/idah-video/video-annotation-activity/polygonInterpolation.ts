import { type Point, type InterpolatedVertex, type VideoFrameSelection } from "./VideoAnnotationContext";
import {
  distance,
  midpoint,
  projectPointOnSegment,
  circularDistance,
} from "./geometryUtils";

// -----------------
// Polygon helper functions
// -----------------

function polygonBarycenter(points: Point[]): Point {
  const pts = [...points, points[0]];
  const x = pts.map((p) => p[0]);
  const y = pts.map((p) => p[1]);

  let crossSum = 0,
    cxSum = 0,
    cySum = 0;

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
    return Math.abs(angleDiff) <
      Math.abs(Math.atan2(Math.sin(polarSorted[bestIdx][1] - target), Math.cos(polarSorted[bestIdx][1] - target)))
      ? idx
      : bestIdx;
  }, 0);

  const polarRotated = polarSorted.slice(startIdx).concat(polarSorted.slice(0, startIdx));
  const reorderedPoints = polarRotated.map(([oldIdx]) => points[oldIdx]);
  const polarReindexed = polarRotated.map(([_, angle, radius], i) => [i, angle, radius] as [number, number, number]);

  return [reorderedPoints, polarReindexed];
}

function matchVerticesByBarycenter(
  polyMin: Point[],
  polyMax: Point[]
): [Point[], Point[], Record<number, number>] {
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
    if (bestJ !== null) {
      // check if bestJ is already matched
      const alreadyMatched = Object.values(matches).includes(bestJ);
      // if already matched, check who is closer
      if (alreadyMatched) {
        const currentMatch = Object.entries(matches).find(([_, v]) => v === bestJ);
        if (currentMatch) {
          const [currentIminStr, _] = currentMatch;
          const currentImin = parseInt(currentIminStr);
          const angCurrent = polarMin.find(([i]) => i === currentImin)![1];
          const distCurrent = Math.abs(Math.atan2(Math.sin(angCurrent - polarMax[bestJ][1]), Math.cos(angCurrent - polarMax[bestJ][1])));
          if (bestDist < distCurrent) {
            // replace match
            delete matches[currentImin];
            matches[iMin] = bestJ;
          }
        }
      } else  {
        matches[iMin] = bestJ;
      }
    }
  }

  return [polyMinRe, polyMaxRe, matches];
}

function expandPolygonUsingMatches(
  polyMin: Point[],
  polyMax: Point[],
  matches: Record<number, number>,
): [ InterpolatedVertex[], Point[] ] {
  const nMax = polyMax.length;
  const expanded: (InterpolatedVertex | null)[] = Array(nMax).fill(null);

  for (const minIdx in matches) {
    const maxIdx = matches[minIdx];
    expanded[maxIdx] = {
      point: polyMin[parseInt(minIdx)],
      matched: true,
    };
  }

  // Find unmatched vertices from polyMin
  const matchedMinIndices = new Set(Object.keys(matches).map(k => parseInt(k)));
  const unmatchedMinIndices: number[] = [];
  for (let i = 0; i < polyMin.length; i++) {
    if (!matchedMinIndices.has(i)) {
      unmatchedMinIndices.push(i);
    }
  }

  for (let i = 0; i < nMax; i++) {
    if (expanded[i] === null) {
      let prevI = (i - 1 + nMax) % nMax;
      while (expanded[prevI] === null) prevI = (prevI - 1 + nMax) % nMax;

      let nextI = (i + 1) % nMax;
      while (expanded[nextI] === null) nextI = (nextI + 1) % nMax;

      const pPrev = expanded[prevI]!;
      const pNext = expanded[nextI]!;

      const total = circularDistance(prevI, nextI, nMax);
      const cur = circularDistance(prevI, i, nMax);
      const t = total > 0 ? cur / total : 0;

      expanded[i] = {
        point: [(1 - t) * pPrev.point[0] + t * pNext.point[0], (1 - t) * pPrev.point[1] + t * pNext.point[1]],
        matched: false,
      };
    }
  }

  const generatePolyMax = [...polyMax];

  for (const insertIdx of unmatchedMinIndices) {
    const target = polyMin[insertIdx];

    let bestSegIdx = -1;
    let bestDist = Infinity;

    const n = expanded.length;

    // find closest segment (including last -> first)
    for (let i = 0; i < n; i++) {
      if (expanded[i] === null || expanded[(i + 1) % n] === null) continue;
      const a = expanded[i]!.point;
      const b = expanded[(i + 1) % n]!.point;

      const { point: proj } = projectPointOnSegment(target, a, b);
      const d = distance(target, proj);

      if (d < bestDist) {
        bestDist = d;
        bestSegIdx = i;
      }
    }

    if (bestSegIdx === -1) continue;

    const insertAt = bestSegIdx + 1;

    // last -> first segment
    if (insertAt === expanded.length) {
      expanded.push({
        point: polyMin[insertIdx],
        matched: false,
      });

      // add point to polyMax but in middle of last and first
      generatePolyMax.push(midpoint(generatePolyMax[0], generatePolyMax[generatePolyMax.length - 1]));

    } else {
      expanded.splice(insertAt, 0, {
        point: polyMin[insertIdx],
        matched: false,
      });

      // add point to generatePolyMax but in middle of neighbors
      generatePolyMax.splice(insertAt, 0, midpoint(generatePolyMax[insertAt - 1], generatePolyMax[insertAt]));
    }
  }

  return [ expanded as InterpolatedVertex[], generatePolyMax as Point[] ];
}

function toPoint(v: InterpolatedVertex | Point): Point {
  return 'point' in v ? v.point : v;
}

function lerpVertices(A: InterpolatedVertex[], B: InterpolatedVertex[] | Point[], t: number): InterpolatedVertex[] {
  return A.map((a, i) => {
    const [bx, by] = toPoint(B[i]);

    return {
      point: [
        (1 - t) * a.point[0] + t * bx,
        (1 - t) * a.point[1] + t * by,
      ],
      matched: a.matched,
    };
  });
}

export function interpolatePolygonAtFrame(
  frameStart: VideoFrameSelection,
  frameEnd: VideoFrameSelection,
  current_frame: number,
): InterpolatedVertex[] {
  let maxFrame;
  let minFrame;

  if (frameStart.points.length < frameEnd.points.length) {
    minFrame = frameStart;
    maxFrame = frameEnd;
  } else {
    minFrame = frameEnd;
    maxFrame = frameStart;
  }

  const [frameStartRe, frameEndRe, matches] = matchVerticesByBarycenter(minFrame.points, maxFrame.points);

  // Expand both polygons using matches
  const [P1, generatePolyMax] = expandPolygonUsingMatches(frameStartRe, frameEndRe, matches);

  // linear interpolation
  const alpha = (current_frame - minFrame.frame) / (maxFrame.frame - minFrame.frame);

  const t = Math.min(Math.max(alpha, 0), 1);

  const interpolazed = lerpVertices(P1, generatePolyMax, t);

  const cInterp = polygonBarycenter(interpolazed.map(v => v.point));
  const P1_old_index = interpolazed.map((v, i) => [i, v.point] as [number, Point]);
  const [P1Reordered, _] = reorderByAngle(interpolazed.map(v => v.point), cInterp);

  const P1_final: InterpolatedVertex[] = P1_old_index.sort((a, b) => {
    const idxA = P1Reordered.findIndex(p => p[0] === a[1][0] && p[1] === a[1][1]);
    const idxB = P1Reordered.findIndex(p => p[0] === b[1][0] && p[1] === b[1][1]);
    return idxA - idxB;
  }).map(([_, point]) => {
    const originalVertex = interpolazed.find(v => v.point[0] === point[0] && v.point[1] === point[1])!;
    return {
      point: originalVertex.point,
      matched: originalVertex.matched,
    };
  });

  return P1_final;
}
