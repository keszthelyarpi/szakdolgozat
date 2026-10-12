import type { Point } from '../types/project.types';

export interface Turn {
  position: Point;
  angle: 45 | 90;
}

export interface PostProcessedPath {
  compressedPath: Point[];
  turns: Turn[];
  totalLength: number;
}

interface UnitVector {
  x: number;
  y: number;
}

/**
 * Returns a normalized 2D direction vector between two points.
 */
function getUnitDirection(p1: Point, p2: Point): UnitVector {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

/**
 * Checks whether two unit vectors point in essentially the same direction.
 */
function isSameDirection(v1: UnitVector, v2: UnitVector, epsilon = 1e-4): boolean {
  return Math.abs(v1.x - v2.x) < epsilon && Math.abs(v1.y - v2.y) < epsilon;
}

/**
 * Computes deflection angle between incoming and outgoing direction vectors.
 * Returns angle in degrees [0, 180].
 */
function getDeflectionAngle(incoming: UnitVector, outgoing: UnitVector): number {
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const rad = Math.acos(clampedDot);
  return (rad * 180) / Math.PI;
}

/**
 * Calculates Euclidean length of a polyline in mm.
 */
export function calculatePathLength(path: Point[]): number {
  if (path.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  }
  // Round to 2 decimal places to avoid floating point noise
  return Math.round(total * 100) / 100;
}

/**
 * Compresses collinear consecutive points into start and end points of straight segments.
 */
export function compressPath(rawPath: Point[]): Point[] {
  if (rawPath.length <= 2) {
    return [...rawPath];
  }

  const compressed: Point[] = [rawPath[0]];
  let currentDir = getUnitDirection(rawPath[0], rawPath[1]);

  for (let i = 1; i < rawPath.length - 1; i++) {
    const nextDir = getUnitDirection(rawPath[i], rawPath[i + 1]);
    if (!isSameDirection(currentDir, nextDir)) {
      compressed.push(rawPath[i]);
      currentDir = nextDir;
    }
  }

  compressed.push(rawPath[rawPath.length - 1]);
  return compressed;
}

/**
 * Identifies elbow positions and their angle (45° or 90°) along a path.
 */
export function detectTurns(path: Point[]): Turn[] {
  if (path.length < 3) {
    return [];
  }

  const turns: Turn[] = [];

  for (let i = 1; i < path.length - 1; i++) {
    const incoming = getUnitDirection(path[i - 1], path[i]);
    const outgoing = getUnitDirection(path[i], path[i + 1]);

    if (!isSameDirection(incoming, outgoing)) {
      const angleDeg = getDeflectionAngle(incoming, outgoing);
      // Classify as 45° or 90°
      const angle: 45 | 90 = angleDeg <= 67.5 ? 45 : 90;
      turns.push({
        position: { x: path[i].x, y: path[i].y },
        angle,
      });
    }
  }

  return turns;
}

/**
 * Post-processes a raw grid path into a compressed polyline with identified turns and total length.
 */
export function postProcessPath(rawPath: Point[]): PostProcessedPath {
  if (rawPath.length === 0) {
    return {
      compressedPath: [],
      turns: [],
      totalLength: 0,
    };
  }

  if (rawPath.length === 1) {
    return {
      compressedPath: [{ ...rawPath[0] }],
      turns: [],
      totalLength: 0,
    };
  }

  const compressedPath = compressPath(rawPath);
  const turns = detectTurns(compressedPath);
  const totalLength = calculatePathLength(rawPath);

  return {
    compressedPath,
    turns,
    totalLength,
  };
}
