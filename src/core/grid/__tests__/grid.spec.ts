import { describe, it, expect } from 'vitest';
import { validateProject, projectSchema } from '../../schemas/project.schema';
import type { Project } from '../../types/project.types';
import { GridGraph } from '../GridGraph';
import {
  rasterizeWall,
  rasterizeZone,
  rasterizeProject,
  isPointInPolygon,
  distanceToSegment,
} from '../rasterizer';

describe('1. Core Domain Model & Zod Validation', () => {
  it('should validate a valid sample project JSON', () => {
    const sampleProject: Project = {
      projectName: 'Családi ház központi porszívó terv',
      walls: [
        {
          id: 'wall-1',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 5000, y: 0 },
          thickness: 300,
          isDrillable: false,
        },
        {
          id: 'wall-2',
          startPoint: { x: 5000, y: 0 },
          endPoint: { x: 5000, y: 4000 },
          thickness: 150,
          isDrillable: true,
        },
      ],
      centralUnit: {
        position: { x: 500, y: 500 },
      },
      outlets: [
        {
          id: 'outlet-1',
          position: { x: 2000, y: 2000 },
          coverageRadius: 6000,
        },
      ],
      zones: [
        {
          id: 'zone-1',
          points: [
            { x: 500, y: 500 },
            { x: 4500, y: 500 },
            { x: 4500, y: 3500 },
            { x: 500, y: 3500 },
          ],
          isFloorZone: true,
        },
      ],
      elevationPoints: [
        {
          position: { x: 1000, y: 1000 },
          heightValue: 2.8,
        },
      ],
      waypoints: [
        {
          position: { x: 1500, y: 1500 },
        },
      ],
      breakthroughPoints: [
        {
          position: { x: 5000, y: 2000 },
        },
      ],
      offer: {
        totalPrice: 450000,
        items: [
          {
            product: {
              id: 'prod-1',
              name: 'Központi porszívó gép 1600W',
              price: 350000,
            },
            quantity: 1,
          },
          {
            product: {
              id: 'prod-2',
              name: 'Fali kiállás aljzat',
              price: 25000,
            },
            quantity: 4,
          },
        ],
      },
    };

    const validated = validateProject(sampleProject);
    expect(validated).toEqual(sampleProject);
    expect(projectSchema.safeParse(sampleProject).success).toBe(true);
  });

  it('should throw validation error when physical parameters are invalid', () => {
    const invalidProject = {
      projectName: '',
      walls: [
        {
          id: 'wall-invalid',
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 100, y: 0 },
          thickness: -50, // invalid thickness
          isDrillable: false,
        },
      ],
      centralUnit: { position: { x: 0, y: 0 } },
      outlets: [],
      zones: [
        {
          id: 'zone-invalid',
          points: [{ x: 0, y: 0 }], // less than 3 points
          isFloorZone: true,
        },
      ],
      elevationPoints: [],
      waypoints: [],
      breakthroughPoints: [],
      offer: { totalPrice: 0, items: [] },
    };

    expect(() => validateProject(invalidProject)).toThrow();
  });
});

describe('2. GridGraph basic operations', () => {
  it('should transform coordinates correctly and check bounds', () => {
    const grid = new GridGraph(1000, 1000, 100); // 10x10 cells

    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(10);

    const gCoords = grid.worldToGrid({ x: 250, y: 750 });
    expect(gCoords).toEqual({ gx: 2, gy: 7 });

    const wCoords = grid.gridToWorld(2, 7);
    expect(wCoords).toEqual({ x: 250, y: 750 });

    expect(grid.isWithinBounds(0, 0)).toBe(true);
    expect(grid.isWithinBounds(9, 9)).toBe(true);
    expect(grid.isWithinBounds(10, 5)).toBe(false);
    expect(grid.isWithinBounds(-1, 0)).toBe(false);
  });

  it('should return valid neighbors', () => {
    const grid = new GridGraph(500, 500, 100); // 5x5 cells
    const neighbors4 = grid.getNeighbors(0, 0, false);
    expect(neighbors4.length).toBe(2); // (1,0) and (0,1)

    const neighbors8 = grid.getNeighbors(2, 2, true);
    expect(neighbors8.length).toBe(8);
  });
});

describe('3. Akadály teszt: Nem véshető fal rasterizálása', () => {
  it('should set walkable === false for cells along a non-drillable wall', () => {
    const grid = new GridGraph(1000, 1000, 100);

    const nonDrillableWall = {
      id: 'wall-solid',
      startPoint: { x: 500, y: 0 },
      endPoint: { x: 500, y: 1000 },
      thickness: 100,
      isDrillable: false,
    };

    rasterizeWall(grid, nonDrillableWall);

    // Cells along x = 500 (gx = 5) should be non-walkable
    for (let gy = 0; gy < 10; gy++) {
      const cell = grid.getCell(5, gy);
      expect(cell).toBeDefined();
      expect(cell?.walkable).toBe(false);
    }

    // Cells far away from wall should remain walkable
    const freeCell = grid.getCell(1, 1);
    expect(freeCell?.walkable).toBe(true);
  });
});

describe('4. Véshető fal teszt', () => {
  it('should keep cells walkable === true but increase costMultiplier to 15.0 for drillable walls', () => {
    const grid = new GridGraph(1000, 1000, 100);

    const drillableWall = {
      id: 'wall-drillable',
      startPoint: { x: 0, y: 500 },
      endPoint: { x: 1000, y: 500 },
      thickness: 100,
      isDrillable: true,
    };

    rasterizeWall(grid, drillableWall);

    // Cells along y = 500 (gy = 5) should be walkable but have high cost multiplier
    for (let gx = 0; gx < 10; gx++) {
      const cell = grid.getCell(gx, 5);
      expect(cell).toBeDefined();
      expect(cell?.walkable).toBe(true);
      expect(cell?.costMultiplier).toBe(15.0);
    }
  });
});

describe('5. Aljzatbeton zóna teszt', () => {
  it('should decrease costMultiplier to 0.5 for cells inside a floor zone', () => {
    const grid = new GridGraph(1000, 1000, 100);

    const floorZone = {
      id: 'zone-floor',
      points: [
        { x: 200, y: 200 },
        { x: 800, y: 200 },
        { x: 800, y: 800 },
        { x: 200, y: 800 },
      ],
      isFloorZone: true,
    };

    rasterizeZone(grid, floorZone);

    // Cell at gx = 5, gy = 5 (center 550, 550) is inside floor zone
    const insideCell = grid.getCell(5, 5);
    expect(insideCell?.costMultiplier).toBe(0.5);

    // Cell at gx = 0, gy = 0 (center 50, 50) is outside floor zone
    const outsideCell = grid.getCell(0, 0);
    expect(outsideCell?.costMultiplier).toBe(1.0);
  });
});

describe('6. BreakthroughPoint & Geometry Utilities', () => {
  it('should calculate distanceToSegment and point in polygon correctly', () => {
    const dist = distanceToSegment({ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dist).toBe(50);

    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(isPointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
  });

  it('should rasterize a full project using rasterizeProject', () => {
    const grid = new GridGraph(1000, 1000, 100);
    const sampleProject: Project = {
      projectName: 'Test Project',
      walls: [
        {
          id: 'w1',
          startPoint: { x: 500, y: 0 },
          endPoint: { x: 500, y: 1000 },
          thickness: 100,
          isDrillable: false,
        },
      ],
      centralUnit: { position: { x: 0, y: 0 } },
      outlets: [],
      zones: [
        {
          id: 'z1',
          points: [
            { x: 0, y: 0 },
            { x: 400, y: 0 },
            { x: 400, y: 1000 },
            { x: 0, y: 1000 },
          ],
          isFloorZone: true,
        },
      ],
      elevationPoints: [],
      waypoints: [],
      breakthroughPoints: [{ position: { x: 500, y: 550 } }],
      offer: { totalPrice: 0, items: [] },
    };

    rasterizeProject(grid, sampleProject);

    // Floor zone cell
    expect(grid.getCell(1, 1)?.costMultiplier).toBe(0.5);

    // Breakthrough cell in wall
    expect(grid.getCell(5, 5)?.walkable).toBe(true);

    // Solid wall cell away from breakthrough
    expect(grid.getCell(5, 1)?.walkable).toBe(false);
  });
});

