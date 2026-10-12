import type { Point, Wall, Zone, BreakthroughPoint, Project } from '../types/project.types';
import type { GridGraph } from './GridGraph';

/**
 * Calculates perpendicular Euclidean distance from point P to line segment AB.
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Checks whether a 2D point lies inside a polygon using Ray-Casting algorithm.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Rasterizes a Zone onto the GridGraph.
 * If isFloorZone === true, covered cells receive costMultiplier = 0.5.
 */
export function rasterizeZone(grid: GridGraph, zone: Zone): void {
  if (zone.points.length < 3) return;

  // Calculate bounding box of zone polygon
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of zone.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const minGrid = grid.worldToGrid({ x: minX, y: minY });
  const maxGrid = grid.worldToGrid({ x: maxX, y: maxY });

  const minGx = Math.max(0, minGrid.gx);
  const maxGx = Math.min(grid.cols - 1, maxGrid.gx);
  const minGy = Math.max(0, minGrid.gy);
  const maxGy = Math.min(grid.rows - 1, maxGrid.gy);

  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cellCenter = grid.gridToWorld(gx, gy);
      if (isPointInPolygon(cellCenter, zone.points)) {
        if (zone.isFloorZone) {
          grid.setCell(gx, gy, { costMultiplier: 0.5 });
        }
      }
    }
  }
}

/**
 * Rasterizes multiple Zones onto the GridGraph.
 */
export function rasterizeZones(grid: GridGraph, zones: Zone[]): void {
  for (const zone of zones) {
    rasterizeZone(grid, zone);
  }
}

/**
 * Rasterizes a Wall onto the GridGraph with thickness and breakthrough points.
 */
export function rasterizeWall(
  grid: GridGraph,
  wall: Wall,
  breakthroughPoints: BreakthroughPoint[] = []
): void {
  const halfThickness = wall.thickness / 2;
  const effectiveRadius = Math.max(halfThickness, grid.cellSize / 2);

  const minX = Math.min(wall.startPoint.x, wall.endPoint.x) - effectiveRadius;
  const maxX = Math.max(wall.startPoint.x, wall.endPoint.x) + effectiveRadius;
  const minY = Math.min(wall.startPoint.y, wall.endPoint.y) - effectiveRadius;
  const maxY = Math.max(wall.startPoint.y, wall.endPoint.y) + effectiveRadius;

  const minGrid = grid.worldToGrid({ x: minX, y: minY });
  const maxGrid = grid.worldToGrid({ x: maxX, y: maxY });

  const minGx = Math.max(0, minGrid.gx);
  const maxGx = Math.min(grid.cols - 1, maxGrid.gx);
  const minGy = Math.max(0, minGrid.gy);
  const maxGy = Math.min(grid.rows - 1, maxGrid.gy);

  const breakthroughRadius = Math.max(effectiveRadius, grid.cellSize);

  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const cellCenter = grid.gridToWorld(gx, gy);
      const dist = distanceToSegment(cellCenter, wall.startPoint, wall.endPoint);

      if (dist <= effectiveRadius) {
        // Check if covered by any BreakthroughPoint
        const hasBreakthrough = breakthroughPoints.some(
          (bt) => Math.hypot(cellCenter.x - bt.position.x, cellCenter.y - bt.position.y) <= breakthroughRadius
        );

        if (hasBreakthrough) {
          // Breakthrough point restores cell walkability and normal cost
          grid.setCell(gx, gy, { walkable: true, costMultiplier: 1.0 });
        } else if (!wall.isDrillable) {
          // Non-drillable wall -> impassable
          grid.setCell(gx, gy, { walkable: false });
        } else {
          // Drillable wall -> walkable with high cost multiplier (15.0)
          grid.setCell(gx, gy, { walkable: true, costMultiplier: 15.0 });
        }
      }
    }
  }
}

/**
 * Rasterizes multiple Walls onto the GridGraph.
 */
export function rasterizeWalls(
  grid: GridGraph,
  walls: Wall[],
  breakthroughPoints: BreakthroughPoint[] = []
): void {
  for (const wall of walls) {
    rasterizeWall(grid, wall, breakthroughPoints);
  }
}

/**
 * Composite rasterizer function for an entire Project onto a GridGraph.
 */
export function rasterizeProject(grid: GridGraph, project: Project): void {
  // 1. Apply zones (e.g. floor zones)
  rasterizeZones(grid, project.zones);
  // 2. Apply walls with breakthrough points
  rasterizeWalls(grid, project.walls, project.breakthroughPoints);
}
