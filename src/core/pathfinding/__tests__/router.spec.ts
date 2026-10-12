import { describe, it, expect } from 'vitest';
import { GridGraph } from '../../grid/GridGraph';
import { rasterizeWall, rasterizeZone } from '../../grid/rasterizer';
import { PriorityQueue } from '../PriorityQueue';
import {
  compressPath,
  detectTurns,
  calculatePathLength,
  postProcessPath,
} from '../pathPostProcessor';
import { AStarRouter, octileDistance, calculateTurnPenalty, Direction } from '../AStarRouter';

describe('Heuristic and Turn Penalty Utilities', () => {
  it('should calculate octile distance accurately', () => {
    // Orthogonal: dx = 3, dy = 0 -> 3
    expect(octileDistance(0, 0, 3, 0)).toBe(3);
    // Diagonal: dx = 2, dy = 2 -> 2 * sqrt(2)
    expect(octileDistance(0, 0, 2, 2)).toBeCloseTo(2 * Math.SQRT2, 5);
    // Mixed: dx = 3, dy = 1 -> max(3,1) + (sqrt(2)-1)*min(3,1) = 3 + sqrt(2) - 1 = 2 + sqrt(2)
    expect(octileDistance(0, 0, 3, 1)).toBeCloseTo(2 + Math.SQRT2, 5);
  });

  it('should calculate turn penalties according to angular deflection', () => {
    const opts = {
      turnPenalty90: 4.0,
      turnPenalty45: 2.0,
      turnPenalty135: 8.0,
      turnPenalty180: 16.0,
      allowCornerCutting: false,
      minCostMultiplier: 0.5,
      useExactEndpoints: false,
    };

    // No turn or starting from NONE
    expect(calculateTurnPenalty(Direction.NONE, Direction.E, opts)).toBe(0);
    expect(calculateTurnPenalty(Direction.E, Direction.E, opts)).toBe(0);

    // 45 degree turn: E -> SE
    expect(calculateTurnPenalty(Direction.E, Direction.SE, opts)).toBe(2.0);

    // 90 degree turn: E -> S
    expect(calculateTurnPenalty(Direction.E, Direction.S, opts)).toBe(4.0);

    // 135 degree turn: E -> SW
    expect(calculateTurnPenalty(Direction.E, Direction.SW, opts)).toBe(8.0);

    // 180 degree turn: E -> W
    expect(calculateTurnPenalty(Direction.E, Direction.W, opts)).toBe(16.0);
  });
});

describe('PriorityQueue Min-Heap', () => {
  it('should pop elements in ascending priority order', () => {
    const pq = new PriorityQueue<string>();
    pq.push('task-high', 10);
    pq.push('task-urgent', 1);
    pq.push('task-medium', 5);
    pq.push('task-low', 20);

    expect(pq.size()).toBe(4);
    expect(pq.isEmpty()).toBe(false);

    expect(pq.pop()).toBe('task-urgent');
    expect(pq.pop()).toBe('task-medium');
    expect(pq.pop()).toBe('task-high');
    expect(pq.pop()).toBe('task-low');
    expect(pq.pop()).toBeUndefined();
    expect(pq.isEmpty()).toBe(true);
  });

  it('should maintain FIFO order for items with equal priority', () => {
    const pq = new PriorityQueue<string>();
    pq.push('first', 5);
    pq.push('second', 5);
    pq.push('third', 5);

    expect(pq.pop()).toBe('first');
    expect(pq.pop()).toBe('second');
    expect(pq.pop()).toBe('third');
  });

  it('should correctly peek and clear', () => {
    const pq = new PriorityQueue<number>();
    pq.push(42, 10);
    pq.push(99, 2);

    expect(pq.peek()).toBe(99);
    expect(pq.size()).toBe(2);

    pq.clear();
    expect(pq.size()).toBe(0);
    expect(pq.isEmpty()).toBe(true);
    expect(pq.peek()).toBeUndefined();
  });
});

describe('Path Post-Processor', () => {
  it('should compress collinear horizontal and vertical points', () => {
    const rawPath = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 },
      { x: 300, y: 300 },
    ];

    const compressed = compressPath(rawPath);
    expect(compressed).toEqual([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
    ]);
  });

  it('should identify 90-degree and 45-degree elbow turns accurately', () => {
    // 90-degree bend: East then South
    const path90 = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 400 },
    ];
    const turns90 = detectTurns(path90);
    expect(turns90).toHaveLength(1);
    expect(turns90[0]).toEqual({
      position: { x: 300, y: 100 },
      angle: 90,
    });

    // 45-degree bend: East then South-East
    const path45 = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 300, y: 200 },
    ];
    const turns45 = detectTurns(path45);
    expect(turns45).toHaveLength(1);
    expect(turns45[0]).toEqual({
      position: { x: 200, y: 100 },
      angle: 45,
    });
  });

  it('should calculate total path length in mm', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
    ];
    expect(calculatePathLength(path)).toBe(700);
  });

  it('should post-process a path returning compressed points, turns, and length', () => {
    const rawPath = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
    ];
    const result = postProcessPath(rawPath);
    expect(result.compressedPath).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
    ]);
    expect(result.turns).toEqual([{ position: { x: 200, y: 0 }, angle: 90 }]);
    expect(result.totalLength).toBe(300);
  });
});

describe('A* Router Mechanical Constraints', () => {
  it('1. Egyenes vonalú keresés akadálymentes térben: felesleges kanyarok nélkül fut végig', () => {
    const grid = new GridGraph(1000, 1000, 100);
    const router = new AStarRouter(grid);

    // Horizontal straight line from (150, 150) to (850, 150)
    const start = { x: 150, y: 150 };
    const goal = { x: 850, y: 150 };

    const result = router.findRoute(start, goal);
    expect(result).not.toBeNull();
    if (!result) return;

    // Collinear compression merges intermediate cells into start and end points
    expect(result.path).toHaveLength(2);
    expect(result.path[0]).toEqual({ x: 150, y: 150 });
    expect(result.path[1]).toEqual({ x: 850, y: 150 });

    // No turns should occur on a straight pipe
    expect(result.turns).toHaveLength(0);

    // Length should be exactly 700 mm (7 grid cells * 100 mm)
    expect(result.totalLength).toBe(700);

    // Diagonal straight line test (150, 150) to (650, 650)
    const diagonalGoal = { x: 650, y: 650 };
    const diagResult = router.findRoute(start, diagonalGoal);
    expect(diagResult).not.toBeNull();
    if (!diagResult) return;

    expect(diagResult.turns).toHaveLength(0);
    expect(diagResult.path).toHaveLength(2);
    expect(diagResult.totalLength).toBeCloseTo(500 * Math.SQRT2, 1);
  });

  it('2. Akadálykerülés: nem véshető fal jelenlétében megkerüli az akadályt', () => {
    const grid = new GridGraph(1000, 1000, 100);
    const router = new AStarRouter(grid);

    // Create a solid (non-drillable) wall blocking x = 500 from y = 0 to y = 600
    // Wall covers cells at gx = 4 and gx = 5 for gy = 0..5
    const solidWall = {
      id: 'solid-wall-1',
      startPoint: { x: 500, y: 0 },
      endPoint: { x: 500, y: 600 },
      thickness: 100,
      isDrillable: false,
    };
    rasterizeWall(grid, solidWall);

    const start = { x: 250, y: 350 }; // Left side of wall (gx: 2, gy: 3)
    const goal = { x: 750, y: 350 }; // Right side of wall (gx: 7, gy: 3)

    const result = router.findRoute(start, goal);
    expect(result).not.toBeNull();
    if (!result) return;

    // Verify that all visited cells in the path are walkable
    for (const pt of result.rawPath) {
      const g = grid.worldToGrid(pt);
      const cell = grid.getCell(g.gx, g.gy);
      expect(cell?.walkable).toBe(true);
    }

    // Verify that none of the impassable wall cells were visited
    const visitedImpassableWall = result.rawPath.some((pt) => {
      const g = grid.worldToGrid(pt);
      return (g.gx === 4 || g.gx === 5) && g.gy <= 5;
    });
    expect(visitedImpassableWall).toBe(false);

    // The route must have turns since it had to circumvent the obstacle
    expect(result.turns.length).toBeGreaterThan(0);
  });

  it('3. Aljzatbeton preferencia: inkább a hosszabb aljzati utat választja a drága fal áttörése helyett', () => {
    const grid = new GridGraph(1200, 1200, 100);
    const router = new AStarRouter(grid);

    // Drillable wall running vertically at x = 600, from y = 300 to y = 900
    // Drillable wall has costMultiplier = 15.0
    const drillableWall = {
      id: 'drillable-wall-1',
      startPoint: { x: 600, y: 300 },
      endPoint: { x: 600, y: 900 },
      thickness: 100,
      isDrillable: true,
    };
    rasterizeWall(grid, drillableWall);

    // Solid non-drillable wall blocking the bottom bypass from y = 900 to y = 1200
    const solidBottomWall = {
      id: 'solid-bottom-wall',
      startPoint: { x: 600, y: 900 },
      endPoint: { x: 600, y: 1200 },
      thickness: 100,
      isDrillable: false,
    };
    rasterizeWall(grid, solidBottomWall);

    // Low-cost floor zone (aljzatbeton) corridor at the top covering y = 0 to y = 350
    // Floor zone has costMultiplier = 0.5
    const floorZone = {
      id: 'floor-zone-corridor',
      points: [
        { x: 0, y: 0 },
        { x: 1200, y: 0 },
        { x: 1200, y: 350 },
        { x: 0, y: 350 },
      ],
      isFloorZone: true,
    };
    rasterizeZone(grid, floorZone);

    const start = { x: 250, y: 650 };
    const goal = { x: 950, y: 650 };

    const result = router.findRoute(start, goal);
    expect(result).not.toBeNull();
    if (!result) return;

    // The router should NOT pierce through the expensive drillable wall cells
    const wentThroughDrillableWall = result.rawPath.some((pt) => {
      const g = grid.worldToGrid(pt);
      const cell = grid.getCell(g.gx, g.gy);
      return cell?.costMultiplier === 15.0;
    });
    expect(wentThroughDrillableWall).toBe(false);

    // The router should utilize the cheaper subfloor zone (costMultiplier = 0.5)
    const usedSubfloor = result.rawPath.some((pt) => {
      const g = grid.worldToGrid(pt);
      const cell = grid.getCell(g.gx, g.gy);
      return cell?.costMultiplier === 0.5;
    });
    expect(usedSubfloor).toBe(true);
  });

  it('4. Könyökbüntetés teszt: turn penalty miatt a kevesebb kanyarral járó utat preferálja a cikkcakkos úttal szemben', () => {
    const grid = new GridGraph(1000, 1000, 100);
    const router = new AStarRouter(grid);

    // Horizontal straight line along gy = 1: from (150, 150) to (750, 150)
    const start = { x: 150, y: 150 }; // (1, 1)
    const goal = { x: 750, y: 150 }; // (7, 1)

    // Along gy = 2, we introduce low-cost cells (costMultiplier: 0.3) that would tempt
    // a naive pathfinder without turn penalties into taking a zigzag path (1,1)->(2,2)->(3,1)->(4,2)->...
    const zigzagBonusCells = [
      { gx: 2, gy: 2 },
      { gx: 4, gy: 2 },
      { gx: 6, gy: 2 },
    ];
    for (const c of zigzagBonusCells) {
      grid.setCell(c.gx, c.gy, { costMultiplier: 0.3 });
    }

    // Without turn penalties, the algorithm prefers the zigzag route to take advantage of low-cost cells
    const noPenaltyResult = router.findRoute(start, goal, {
      turnPenalty90: 0,
      turnPenalty45: 0,
      turnPenalty135: 0,
      turnPenalty180: 0,
    });
    expect(noPenaltyResult).not.toBeNull();
    if (!noPenaltyResult) return;
    expect(noPenaltyResult.turns.length).toBeGreaterThan(0);

    // With turn penalties enabled, the algorithm rejects the zigzag and stays on the straight line (0 turns)
    const penaltyResult = router.findRoute(start, goal, {
      turnPenalty90: 4.0,
      turnPenalty45: 2.0,
    });
    expect(penaltyResult).not.toBeNull();
    if (!penaltyResult) return;

    // The straight line has 0 turns
    expect(penaltyResult.turns.length).toBe(0);
    expect(penaltyResult.turns.length).toBeLessThan(noPenaltyResult.turns.length);
  });

  it('5. Több végpont kezelése: a legközelebbi célt választja ki', () => {
    const grid = new GridGraph(1000, 1000, 100);
    const router = new AStarRouter(grid);

    const start = { x: 150, y: 550 };
    const targets = [
      { x: 850, y: 550 }, // Far outlet
      { x: 350, y: 550 }, // Close outlet
      { x: 650, y: 550 }, // Middle outlet
    ];

    const result = router.findRoute(start, targets);
    expect(result).not.toBeNull();
    if (!result) return;

    // Nearest target is at (350, 550)
    const endPoint = result.path[result.path.length - 1];
    expect(endPoint).toEqual({ x: 350, y: 550 });
    expect(result.totalLength).toBe(200);
    expect(result.turns).toHaveLength(0);
  });

  it('6. Nem elérhető cél esetén null-t ad vissza', () => {
    const grid = new GridGraph(500, 500, 100);
    const router = new AStarRouter(grid);

    // Completely enclose cell (2, 2) with non-walkable cells
    grid.setCell(1, 2, { walkable: false });
    grid.setCell(3, 2, { walkable: false });
    grid.setCell(2, 1, { walkable: false });
    grid.setCell(2, 3, { walkable: false });
    grid.setCell(1, 1, { walkable: false });
    grid.setCell(3, 1, { walkable: false });
    grid.setCell(1, 3, { walkable: false });
    grid.setCell(3, 3, { walkable: false });

    const start = { x: 50, y: 50 };
    const blockedGoal = { x: 250, y: 250 };

    const result = router.findRoute(start, blockedGoal);
    expect(result).toBeNull();
  });
});
