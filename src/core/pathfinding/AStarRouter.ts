import type { Point } from '../types/project.types';
import type { GridGraph } from '../grid/GridGraph';
import { PriorityQueue } from './PriorityQueue';
import { postProcessPath, type Turn } from './pathPostProcessor';

export enum Direction {
  NONE = 'NONE',
  N = 'N',
  NE = 'NE',
  E = 'E',
  SE = 'SE',
  S = 'S',
  SW = 'SW',
  W = 'W',
  NW = 'NW',
}

export interface RouterOptions {
  /** Penalty added when making a 90° turn. Default: 4.0 */
  turnPenalty90?: number;
  /** Penalty added when making a 45° turn. Default: 2.0 */
  turnPenalty45?: number;
  /** Penalty added when making a 135° turn. Default: 8.0 */
  turnPenalty135?: number;
  /** Penalty added when making a 180° turn (reversal). Default: 16.0 */
  turnPenalty180?: number;
  /** Disallow cutting diagonally across unwalkable corners. Default: false (no corner cutting) */
  allowCornerCutting?: boolean;
  /** Minimum cost multiplier for heuristic admissibility. Default: 0.5 */
  minCostMultiplier?: number;
  /** Whether to use exact input start/target points for path endpoints. Default: false */
  useExactEndpoints?: boolean;
}

export interface RouteResult {
  /** Compressed path polylines in world coordinates */
  path: Point[];
  /** Full grid cell-by-cell path in world coordinates */
  rawPath: Point[];
  /** Total pathfinding cost including cell multipliers and turn penalties */
  totalCost: number;
  /** Total geometric pipe length in millimeters */
  totalLength: number;
  /** Identified 45° and 90° turns along the route */
  turns: Turn[];
}

interface NodeState {
  gx: number;
  gy: number;
  dir: Direction;
}

interface Movement {
  dx: number;
  dy: number;
  dir: Direction;
  isDiagonal: boolean;
  baseDistance: number;
}

const MOVEMENTS: Movement[] = [
  { dx: 0, dy: -1, dir: Direction.N, isDiagonal: false, baseDistance: 1.0 },
  { dx: 1, dy: -1, dir: Direction.NE, isDiagonal: true, baseDistance: Math.SQRT2 },
  { dx: 1, dy: 0, dir: Direction.E, isDiagonal: false, baseDistance: 1.0 },
  { dx: 1, dy: 1, dir: Direction.SE, isDiagonal: true, baseDistance: Math.SQRT2 },
  { dx: 0, dy: 1, dir: Direction.S, isDiagonal: false, baseDistance: 1.0 },
  { dx: -1, dy: 1, dir: Direction.SW, isDiagonal: true, baseDistance: Math.SQRT2 },
  { dx: -1, dy: 0, dir: Direction.W, isDiagonal: false, baseDistance: 1.0 },
  { dx: -1, dy: -1, dir: Direction.NW, isDiagonal: true, baseDistance: Math.SQRT2 },
];

const DIRECTION_ORDER: Record<Direction, number> = {
  [Direction.N]: 0,
  [Direction.NE]: 1,
  [Direction.E]: 2,
  [Direction.SE]: 3,
  [Direction.S]: 4,
  [Direction.SW]: 5,
  [Direction.W]: 6,
  [Direction.NW]: 7,
  [Direction.NONE]: -1,
};

/**
 * Calculates the Octile distance heuristic between two grid points.
 * Octile distance is the exact shortest path distance on an 8-connected grid.
 */
export function octileDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * Calculates the mechanical turn penalty when transitioning from `fromDir` to `toDir`.
 */
export function calculateTurnPenalty(
  fromDir: Direction,
  toDir: Direction,
  options: Required<RouterOptions>
): number {
  if (fromDir === Direction.NONE || toDir === Direction.NONE || fromDir === toDir) {
    return 0;
  }
  const i1 = DIRECTION_ORDER[fromDir];
  const i2 = DIRECTION_ORDER[toDir];
  const diff = Math.abs(i1 - i2);
  const stepDiff = Math.min(diff, 8 - diff);

  switch (stepDiff) {
    case 1:
      return options.turnPenalty45;
    case 2:
      return options.turnPenalty90;
    case 3:
      return options.turnPenalty135;
    case 4:
      return options.turnPenalty180;
    default:
      return 0;
  }
}

export class AStarRouter {
  private grid: GridGraph;

  constructor(grid: GridGraph) {
    this.grid = grid;
  }

  /**
   * Finds the optimal pipe route from a starting point to one or more target endpoints.
   */
  public findRoute(
    start: Point,
    target: Point | Point[],
    options?: RouterOptions
  ): RouteResult | null {
    const opts: Required<RouterOptions> = {
      turnPenalty90: options?.turnPenalty90 ?? 4.0,
      turnPenalty45: options?.turnPenalty45 ?? 2.0,
      turnPenalty135: options?.turnPenalty135 ?? 8.0,
      turnPenalty180: options?.turnPenalty180 ?? 16.0,
      allowCornerCutting: options?.allowCornerCutting ?? false,
      minCostMultiplier: options?.minCostMultiplier ?? 0.5,
      useExactEndpoints: options?.useExactEndpoints ?? false,
    };

    const startGrid = this.grid.worldToGrid(start);
    if (!this.grid.isWithinBounds(startGrid.gx, startGrid.gy)) {
      return null;
    }
    const startCell = this.grid.getCell(startGrid.gx, startGrid.gy);
    if (!startCell || !startCell.walkable) {
      return null;
    }

    const targetList = Array.isArray(target) ? target : [target];
    const validTargets: Array<{ gx: number; gy: number; original: Point }> = [];
    const goalCellIndices = new Set<number>();

    for (const t of targetList) {
      const tg = this.grid.worldToGrid(t);
      if (this.grid.isWithinBounds(tg.gx, tg.gy)) {
        const cell = this.grid.getCell(tg.gx, tg.gy);
        if (cell && cell.walkable) {
          validTargets.push({ gx: tg.gx, gy: tg.gy, original: t });
          goalCellIndices.add(tg.gy * this.grid.cols + tg.gx);
        }
      }
    }

    if (validTargets.length === 0) {
      return null;
    }

    const startIndex = startGrid.gy * this.grid.cols + startGrid.gx;
    if (goalCellIndices.has(startIndex)) {
      const singlePoint = opts.useExactEndpoints
        ? { x: start.x, y: start.y }
        : this.grid.gridToWorld(startGrid.gx, startGrid.gy);
      return {
        path: [singlePoint],
        rawPath: [singlePoint],
        totalCost: 0,
        totalLength: 0,
        turns: [],
      };
    }

    const heuristic = (gx: number, gy: number): number => {
      let minDist = Infinity;
      for (let i = 0; i < validTargets.length; i++) {
        const d = octileDistance(gx, gy, validTargets[i].gx, validTargets[i].gy);
        if (d < minDist) {
          minDist = d;
        }
      }
      return minDist * opts.minCostMultiplier;
    };

    const stateKey = (gx: number, gy: number, dir: Direction): string =>
      `${gx},${gy},${dir}`;

    const pq = new PriorityQueue<{ node: NodeState; g: number }>();
    const gScore = new Map<string, number>();
    const cameFrom = new Map<string, { parent: NodeState; cost: number }>();

    const startState: NodeState = {
      gx: startGrid.gx,
      gy: startGrid.gy,
      dir: Direction.NONE,
    };
    const startKey = stateKey(startState.gx, startState.gy, startState.dir);
    gScore.set(startKey, 0);
    pq.push({ node: startState, g: 0 }, heuristic(startGrid.gx, startGrid.gy));

    let goalState: NodeState | null = null;
    let finalCost = 0;

    while (!pq.isEmpty()) {
      const top = pq.pop()!;
      const current = top.node;
      const currentG = top.g;
      const currentKey = stateKey(current.gx, current.gy, current.dir);

      const recordedG = gScore.get(currentKey);
      if (recordedG !== undefined && currentG > recordedG) {
        continue;
      }

      const currentIndex = current.gy * this.grid.cols + current.gx;
      if (goalCellIndices.has(currentIndex)) {
        goalState = current;
        finalCost = currentG;
        break;
      }

      for (const move of MOVEMENTS) {
        const nx = current.gx + move.dx;
        const ny = current.gy + move.dy;

        if (!this.grid.isWithinBounds(nx, ny)) {
          continue;
        }

        const targetCell = this.grid.getCell(nx, ny);
        if (!targetCell || !targetCell.walkable) {
          continue;
        }

        if (move.isDiagonal && !opts.allowCornerCutting) {
          const adjCellX = this.grid.getCell(current.gx + move.dx, current.gy);
          const adjCellY = this.grid.getCell(current.gx, current.gy + move.dy);
          if (!adjCellX?.walkable || !adjCellY?.walkable) {
            continue;
          }
        }

        const stepCost = move.baseDistance * targetCell.costMultiplier;
        const turnCost = calculateTurnPenalty(current.dir, move.dir, opts);
        const tentativeG = currentG + stepCost + turnCost;

        const nextKey = stateKey(nx, ny, move.dir);
        const prevG = gScore.get(nextKey);

        if (prevG === undefined || tentativeG < prevG - 1e-9) {
          gScore.set(nextKey, tentativeG);
          cameFrom.set(nextKey, { parent: current, cost: tentativeG });
          const fScore = tentativeG + heuristic(nx, ny);
          pq.push({ node: { gx: nx, gy: ny, dir: move.dir }, g: tentativeG }, fScore);
        }
      }
    }

    if (!goalState) {
      return null;
    }

    const gridChain: NodeState[] = [];
    let curr: NodeState | undefined = goalState;
    while (curr) {
      gridChain.push(curr);
      const parentInfo = cameFrom.get(stateKey(curr.gx, curr.gy, curr.dir));
      curr = parentInfo ? parentInfo.parent : undefined;
    }
    gridChain.reverse();

    const rawPath: Point[] = gridChain.map((n) => this.grid.gridToWorld(n.gx, n.gy));

    if (opts.useExactEndpoints) {
      rawPath[0] = { x: start.x, y: start.y };
      const matchedTarget = validTargets.find(
        (t) => t.gx === goalState!.gx && t.gy === goalState!.gy
      );
      if (matchedTarget) {
        rawPath[rawPath.length - 1] = { ...matchedTarget.original };
      }
    }

    const processed = postProcessPath(rawPath);

    return {
      path: processed.compressedPath,
      rawPath,
      totalCost: Math.round(finalCost * 100) / 100,
      totalLength: processed.totalLength,
      turns: processed.turns,
    };
  }
}
