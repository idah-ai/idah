import {
  circularDistance,
  distance,
  midpoint,
  projectPointOnSegment,
} from "$lib/utils/math/geometry";

import type { InterpolatedVertex, Point } from "$lib/utils/math/point";

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

function rotateVerticesByStartAngle(points: Point[], center: Point): [Point[], [number, number, number][]] {
  const polar = verticesToPolar(points, center);
  const target = Math.PI / 2;

  const angleDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  // Find the point closest to PI/2 in the original order
  const startIdx = polar.reduce((bestIdx, curr, idx) => {
    const angleDiff = angleDistance(curr[1], target);
    return angleDiff < angleDistance(polar[bestIdx][1], target) ? idx : bestIdx;
  }, 0);

  // Rotate the array to start from that point, keeping the original order
  const polarRotated = polar.slice(startIdx).concat(polar.slice(0, startIdx));
  const reorderedPoints = polarRotated.map(([oldIdx]) => points[oldIdx]);
  const polarReindexed = polarRotated.map(([_, angle, radius], i) => [i, angle, radius] as [number, number, number]);

  return [reorderedPoints, polarReindexed];
}

// Longest Increasing/Decreasing Subsequence (LIS) algorithm
function lisIndices(arr: number[], increasing: boolean) {
  const n = arr.length;
  const dp = Array(n).fill(1);
  const prev = Array(n).fill(-1);

  let maxLen = 1;
  let end = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const valid = increasing ? arr[j] < arr[i] : arr[j] > arr[i];

      if (valid && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1;
        prev[i] = j;
      }
    }

    if (dp[i] > maxLen) {
      maxLen = dp[i];
      end = i;
    }
  }

  const indices: number[] = [];
  while (end !== -1) {
    indices.push(end);
    end = prev[end];
  }

  return indices.reverse();
}

function longestCircularMonotonicSubsequence(arr: number[]) {
  const n = arr.length;
  const doubled = arr.concat(arr);

  let best: number[] = [];

  for (let start = 0; start < n; start++) {
    const window = doubled.slice(start, start + n);

    const inc = lisIndices(window, true);
    const dec = lisIndices(window, false);

    const candidate = inc.length >= dec.length ? inc : dec;

    if (candidate.length > best.length) {
      best = candidate.map((i) => (start + i) % n);
    }
  }

  return best;
}

function deleteMinimumForCircularSort(arr: number[]) {
  const keepIndices = new Set(longestCircularMonotonicSubsequence(arr));

  const corrected: number[] = [];
  const deleted: number[] = [];

  arr.forEach((val, idx) => {
    if (keepIndices.has(idx)) {
      corrected.push(val);
    } else {
      deleted.push(val);
    }
  });

  return { corrected, deleted };
}

function matchVerticesByBarycenter(polyMin: Point[], polyMax: Point[]): [Point[], Point[], Record<number, number>] {
  const cMin = polygonBarycenter(polyMin);
  const cMax = polygonBarycenter(polyMax);

  const [polyMinRe, polarMin] = rotateVerticesByStartAngle(polyMin, cMin);
  const [polyMaxRe, polarMax] = rotateVerticesByStartAngle(polyMax, cMax);

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
      //   // check if bestJ is already matched
      const alreadyMatched = Object.values(matches).includes(bestJ);
      // if already matched, check who is closer
      if (alreadyMatched) {
        const currentMatch = Object.entries(matches).find(([_, v]) => v === bestJ);
        if (currentMatch) {
          const [currentIminStr, _] = currentMatch;
          const currentImin = parseInt(currentIminStr);
          const angCurrent = polarMin.find(([i]) => i === currentImin)![1];
          const distCurrent = Math.abs(
            Math.atan2(Math.sin(angCurrent - polarMax[bestJ][1]), Math.cos(angCurrent - polarMax[bestJ][1])),
          );
          if (bestDist < distCurrent) {
            // replace match
            delete matches[currentImin];
            matches[iMin] = bestJ;
          }
        }
      } else {
        matches[iMin] = bestJ;
      }
    }
  }

  // remove indices that do not make a circularly sorted order in matches
  const matchesValues = Object.values(matches);

  const correctMatchesValues = deleteMinimumForCircularSort(matchesValues).corrected;

  for (const key in matches) {
    if (!correctMatchesValues.includes(matches[key])) {
      delete matches[key];
    }
  }

  return [polyMinRe, polyMaxRe, matches];
}

function expandPolygonUsingMatches(
  polyMin: Point[],
  polyMax: Point[],
  matches: Record<number, number>,
): [InterpolatedVertex[], Point[]] {
  const nMax = polyMax.length;
  const expandedPolyMin: (InterpolatedVertex | null)[] = Array(nMax).fill(null);

  for (const minIdx in matches) {
    const maxIdx = matches[minIdx];
    expandedPolyMin[maxIdx] = {
      point: polyMin[parseInt(minIdx)],
      matched: true,
    };
  }

  // Find unmatched vertices from polyMin
  const matchedMinIndices = new Set(Object.keys(matches).map((k) => parseInt(k)));
  const unmatchedMinIndices: number[] = [];
  for (let i = 0; i < polyMin.length; i++) {
    if (!matchedMinIndices.has(i)) {
      unmatchedMinIndices.push(i);
    }
  }

  // interpolate remaining nulls
  for (let i = 0; i < nMax; i++) {
    if (expandedPolyMin[i] === null) {
      let prevI = (i - 1 + nMax) % nMax;
      while (expandedPolyMin[prevI] === null) prevI = (prevI - 1 + nMax) % nMax;

      let nextI = (i + 1) % nMax;
      while (expandedPolyMin[nextI] === null) nextI = (nextI + 1) % nMax;

      const pPrev = expandedPolyMin[prevI]!;
      const pNext = expandedPolyMin[nextI]!;

      const total = circularDistance(prevI, nextI, nMax);
      const cur = circularDistance(prevI, i, nMax);
      const t = total > 0 ? cur / total : 0;

      expandedPolyMin[i] = {
        point: [(1 - t) * pPrev.point[0] + t * pNext.point[0], (1 - t) * pPrev.point[1] + t * pNext.point[1]],
        matched: false,
      };
    }
  }

  // Insert unmatched vertices from polyMin into polyMax (and expandedPolyMin) at closest segment
  const expandedPolyMax = [...polyMax];
  for (const insertIdx of unmatchedMinIndices) {
    const target = polyMin[insertIdx];
    const beforeTarget = polyMin[(insertIdx - 1 + polyMin.length) % polyMin.length];
    const afterTarget = polyMin[(insertIdx + 1) % polyMin.length];

    let bestSegIdx = -1;
    let bestDist = Infinity;

    const n = expandedPolyMin.length;

    // find closest segment (including last -> first)
    for (let i = 0; i < n; i++) {
      if (expandedPolyMin[i] === null || expandedPolyMin[(i + 1) % n] === null) continue;
      const a = expandedPolyMin[i]!.point;
      const b = expandedPolyMin[(i + 1) % n]!.point;

      const { point: proj } = projectPointOnSegment(target, a, b);
      const d = distance(target, proj);

      if (d < bestDist) {
        // now i need to find the previous and next point on the expandedPolyMin that matched true
        // and compare if there is equal to beforeTarget and afterTarget, if so, then this is the correct segment to insert into

        let prevPoint: Point | null = null;
        let nextPoint: Point | null = null;

        for (let j = 0; j < n; j++) {
          const idx = (i - j + n) % n;
          if (expandedPolyMin[idx] && expandedPolyMin[idx]!.matched) {
            prevPoint = expandedPolyMin[idx]!.point;

            break;
          }
        }

        for (let j = 1; j < n; j++) {
          const idx = (i + j) % n;
          if (expandedPolyMin[idx] && expandedPolyMin[idx]!.matched) {
            nextPoint = expandedPolyMin[idx]!.point;

            break;
          }
        }

        if (
          prevPoint &&
          nextPoint &&
          distance(prevPoint, beforeTarget) < 1e-2 &&
          distance(nextPoint, afterTarget) < 1e-2
        ) {
          bestDist = d;
          bestSegIdx = i;
        }
      }
    }

    if (bestSegIdx === -1) continue;

    const insertAt = bestSegIdx + 1;

    // last -> first segment
    if (insertAt === expandedPolyMin.length) {
      expandedPolyMin.push({
        point: polyMin[insertIdx],
        matched: null,
      });

      // add point to polyMax but in middle of last and first
      expandedPolyMax.push(midpoint(expandedPolyMax[0], expandedPolyMax[expandedPolyMax.length - 1]));
    } else {
      expandedPolyMin.splice(insertAt, 0, {
        point: polyMin[insertIdx],
        matched: null,
      });

      // add point to expandedPolyMax but in middle of neighbors
      expandedPolyMax.splice(insertAt, 0, midpoint(expandedPolyMax[insertAt - 1], expandedPolyMax[insertAt]));
    }
  }

  // replace remaining nulls in expandedPolyMin with linear interpolation of neighbors
  const newMax = expandedPolyMin.length;
  expandedPolyMin.forEach((item, index) => {
    if (item?.matched === false) {
      let prevI = (index - 1 + newMax) % newMax;
      while (expandedPolyMin[prevI] === null) prevI = (prevI - 1 + newMax) % newMax;

      let nextI = (index + 1) % newMax;
      while (expandedPolyMin[nextI] === null) nextI = (nextI + 1) % newMax;

      const pPrev = expandedPolyMin[prevI]!;
      const pNext = expandedPolyMin[nextI]!;

      const total = circularDistance(prevI, nextI, newMax);
      const cur = circularDistance(prevI, index, newMax);
      const t = total > 0 ? cur / total : 0;

      expandedPolyMin[index] = {
        point: [(1 - t) * pPrev.point[0] + t * pNext.point[0], (1 - t) * pPrev.point[1] + t * pNext.point[1]],
        matched: false,
      };
    } else if (item?.matched === null) {
      expandedPolyMin[index] = {
        point: item.point,
        matched: false,
      };
    }
  });

  return [expandedPolyMin as InterpolatedVertex[], expandedPolyMax as Point[]];
}

function toPoint(v: InterpolatedVertex | Point): Point {
  return "point" in v ? v.point : v;
}

function lerpVertices(A: InterpolatedVertex[], B: (InterpolatedVertex | Point)[], t: number): InterpolatedVertex[] {
  return A.map((a, i) => {
    const b = B[i];
    if (!b) return a;
    const [bx, by] = toPoint(b);

    return {
      point: [(1 - t) * a.point[0] + t * bx, (1 - t) * a.point[1] + t * by],
      matched: a.matched,
    };
  });
}

export function interpolatePolygon(
  polyFrom: Point[],
  polyTo: Point[],
  t: number,
): InterpolatedVertex[] {
  // min = smaller or polyTo when equal, max = larger or polyFrom when equal
  const swap = polyFrom.length > polyTo.length;
  const minPoints = swap ? polyTo : polyFrom;
  const maxPoints = swap ? polyFrom : polyTo;

  const [frameStartReordered, frameEndReordered, matches] = matchVerticesByBarycenter(minPoints, maxPoints);
  const [expandedMin, expandedMax] = expandPolygonUsingMatches(frameStartReordered, frameEndReordered, matches);

  // expandedMin = min's points in max's vertex count, expandedMax = max's points
  // We want polyFrom at t=0, polyTo at t=1
  // If polyFrom is min: from = expandedMin, to = expandedMax
  // If polyFrom is max: from = expandedMax, to = expandedMin
  const fromPoints = swap ? expandedMax : expandedMin;
  const toPoints = swap ? expandedMin : expandedMax;

  // Build clean arrays without nulls, same length
  const clean: { from: InterpolatedVertex[]; to: (InterpolatedVertex | Point)[] } = {
    from: [],
    to: [],
  };
  for (let i = 0; i < Math.min(fromPoints.length, toPoints.length); i++) {
    const fp = fromPoints[i];
    const tp = toPoints[i];
    if (fp && tp) {
      // expandedMax contains plain Point[] — wrap in InterpolatedVertex
      clean.from.push("point" in fp ? fp as InterpolatedVertex : { point: fp as Point, matched: true });
      clean.to.push("point" in tp ? tp as InterpolatedVertex : tp as Point);
    } else {
      console.log('skip', { i, f: fromPoints[i], t: toPoints[i] });
    }
  }

  const clamped = Math.min(Math.max(t, 0), 1);
  return lerpVertices(clean.from, clean.to, clamped);
}
