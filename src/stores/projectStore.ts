import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, Wall, Outlet, Zone, Point, BreakthroughPoint } from '../core/types/project.types';
import { GridGraph } from '../core/grid/GridGraph';
import { rasterizeProject } from '../core/grid/rasterizer';
import { AStarRouter, type RouteResult } from '../core/pathfinding/AStarRouter';

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'wall'
  | 'centralUnit'
  | 'outlet'
  | 'zone'
  | 'breakthrough';

export type SelectedElementType =
  | 'wall'
  | 'outlet'
  | 'centralUnit'
  | 'zone'
  | 'breakthrough'
  | null;

/**
 * Sample initial project with a realistic 2-bedroom family home floorplan
 */
function createInitialProject(): Project {
  return {
    projectName: 'Családi Ház - Központi Porszívó Terv',
    walls: [
      // Outer perimeter (non-drillable exterior walls, thickness: 300mm)
      { id: 'w-ext-1', startPoint: { x: 1000, y: 1000 }, endPoint: { x: 9000, y: 1000 }, thickness: 300, isDrillable: false },
      { id: 'w-ext-2', startPoint: { x: 9000, y: 1000 }, endPoint: { x: 9000, y: 7000 }, thickness: 300, isDrillable: false },
      { id: 'w-ext-3', startPoint: { x: 9000, y: 7000 }, endPoint: { x: 1000, y: 7000 }, thickness: 300, isDrillable: false },
      { id: 'w-ext-4', startPoint: { x: 1000, y: 7000 }, endPoint: { x: 1000, y: 1000 }, thickness: 300, isDrillable: false },

      // Interior partition walls (drillable, thickness: 100mm)
      // Corridor / Garage divider
      { id: 'w-int-1', startPoint: { x: 3500, y: 1000 }, endPoint: { x: 3500, y: 4500 }, thickness: 150, isDrillable: true },
      // Living room divider
      { id: 'w-int-2', startPoint: { x: 3500, y: 4500 }, endPoint: { x: 6500, y: 4500 }, thickness: 100, isDrillable: true },
      // Bedroom divider
      { id: 'w-int-3', startPoint: { x: 6500, y: 1000 }, endPoint: { x: 6500, y: 4500 }, thickness: 100, isDrillable: true },
    ],
    // Central Unit placed in the utility / garage room
    centralUnit: {
      position: { x: 2000, y: 2000 },
    },
    // Vacuum inlet wall outlets (coverage radius: 8000mm)
    outlets: [
      { id: 'outlet-hall', position: { x: 5000, y: 4300 }, coverageRadius: 8000 },
      { id: 'outlet-living', position: { x: 7800, y: 2500 }, coverageRadius: 8000 },
      { id: 'outlet-bedroom', position: { x: 7800, y: 5800 }, coverageRadius: 8000 },
    ],
    // Low-cost floor zone (aljzatbeton) in the hallway corridor
    zones: [
      {
        id: 'zone-corridor',
        points: [
          { x: 3700, y: 4000 },
          { x: 6300, y: 4000 },
          { x: 6300, y: 5500 },
          { x: 3700, y: 5500 },
        ],
        isFloorZone: true,
      },
    ],
    elevationPoints: [],
    waypoints: [],
    breakthroughPoints: [
      { position: { x: 3500, y: 2000 } }, // Pre-drilled breakthrough point in garage wall
    ],
    offer: {
      totalPrice: 0,
      items: [],
    },
  };
}

export const useProjectStore = defineStore('project', () => {
  // State
  const project = ref<Project>(createInitialProject());
  const activeTool = ref<ActiveTool>('select');
  const selectedElementId = ref<string | null>(null);
  const selectedElementType = ref<SelectedElementType>(null);
  const snapToGrid = ref<boolean>(true);
  const gridSize = ref<number>(100); // 100 mm standard CAD grid
  const currentRoute = ref<RouteResult | null>(null);
  const isCalculatingRoute = ref<boolean>(false);
  const calculationError = ref<string | null>(null);

  // Computed properties
  const selectedWall = computed(() => {
    if (selectedElementType.value !== 'wall' || !selectedElementId.value) return null;
    return project.value.walls.find((w) => w.id === selectedElementId.value) || null;
  });

  const selectedOutlet = computed(() => {
    if (selectedElementType.value !== 'outlet' || !selectedElementId.value) return null;
    return project.value.outlets.find((o) => o.id === selectedElementId.value) || null;
  });

  const selectedZone = computed(() => {
    if (selectedElementType.value !== 'zone' || !selectedElementId.value) return null;
    return project.value.zones.find((z) => z.id === selectedElementId.value) || null;
  });

  const isCentralUnitSelected = computed(() => selectedElementType.value === 'centralUnit');

  // Tool management
  function setActiveTool(tool: ActiveTool): void {
    activeTool.value = tool;
    if (tool !== 'select') {
      selectedElementId.value = null;
      selectedElementType.value = null;
    }
  }

  function toggleSnapToGrid(): void {
    snapToGrid.value = !snapToGrid.value;
  }

  // Selection management
  function selectElement(id: string | null, type: SelectedElementType = null): void {
    selectedElementId.value = id;
    selectedElementType.value = type;
  }

  function clearSelection(): void {
    selectedElementId.value = null;
    selectedElementType.value = null;
  }

  // Element Actions
  function addWall(wall: Wall): void {
    project.value.walls.push(wall);
    selectElement(wall.id, 'wall');
  }

  function updateWall(id: string, updates: Partial<Wall>): void {
    const wall = project.value.walls.find((w) => w.id === id);
    if (wall) {
      Object.assign(wall, updates);
    }
  }

  function removeWall(id: string): void {
    project.value.walls = project.value.walls.filter((w) => w.id !== id);
    if (selectedElementId.value === id) {
      clearSelection();
    }
  }

  function setCentralUnit(position: Point): void {
    project.value.centralUnit = { position: { ...position } };
    selectElement('centralUnit', 'centralUnit');
  }

  function addOutlet(outlet: Outlet): void {
    project.value.outlets.push(outlet);
    selectElement(outlet.id, 'outlet');
  }

  function updateOutlet(id: string, updates: Partial<Outlet>): void {
    const outlet = project.value.outlets.find((o) => o.id === id);
    if (outlet) {
      Object.assign(outlet, updates);
    }
  }

  function removeOutlet(id: string): void {
    project.value.outlets = project.value.outlets.filter((o) => o.id !== id);
    if (selectedElementId.value === id) {
      clearSelection();
    }
  }

  function addZone(zone: Zone): void {
    project.value.zones.push(zone);
    selectElement(zone.id, 'zone');
  }

  function updateZone(id: string, updates: Partial<Zone>): void {
    const zone = project.value.zones.find((z) => z.id === id);
    if (zone) {
      Object.assign(zone, updates);
    }
  }

  function removeZone(id: string): void {
    project.value.zones = project.value.zones.filter((z) => z.id !== id);
    if (selectedElementId.value === id) {
      clearSelection();
    }
  }

  function addBreakthrough(point: BreakthroughPoint): void {
    project.value.breakthroughPoints.push(point);
  }

  function removeBreakthrough(index: number): void {
    if (index >= 0 && index < project.value.breakthroughPoints.length) {
      project.value.breakthroughPoints.splice(index, 1);
    }
  }

  function deleteSelected(): void {
    if (!selectedElementId.value) return;
    if (selectedElementType.value === 'wall') {
      removeWall(selectedElementId.value);
    } else if (selectedElementType.value === 'outlet') {
      removeOutlet(selectedElementId.value);
    } else if (selectedElementType.value === 'zone') {
      removeZone(selectedElementId.value);
    }
  }

  /**
   * Recalculates the complete vacuum pipe network routing using GridGraph and AStarRouter.
   * Connects the CentralUnit and all Outlets using an incremental pipe-network Steiner routing.
   */
  function recalculatePipes(): void {
    if (!project.value.centralUnit || project.value.outlets.length === 0) {
      currentRoute.value = null;
      calculationError.value = 'A tervezéshez szükség van egy központi gépre és legalább egy aljzatra!';
      return;
    }

    isCalculatingRoute.value = true;
    calculationError.value = null;

    try {
      // 1. Calculate bounding box of project elements
      let minX = project.value.centralUnit.position.x;
      let maxX = project.value.centralUnit.position.x;
      let minY = project.value.centralUnit.position.y;
      let maxY = project.value.centralUnit.position.y;

      for (const w of project.value.walls) {
        minX = Math.min(minX, w.startPoint.x, w.endPoint.x);
        maxX = Math.max(maxX, w.startPoint.x, w.endPoint.x);
        minY = Math.min(minY, w.startPoint.y, w.endPoint.y);
        maxY = Math.max(maxY, w.startPoint.y, w.endPoint.y);
      }
      for (const o of project.value.outlets) {
        minX = Math.min(minX, o.position.x);
        maxX = Math.max(maxX, o.position.x);
        minY = Math.min(minY, o.position.y);
        maxY = Math.max(maxY, o.position.y);
      }

      const padding = 2000; // 2000mm boundary padding
      const gridWidth = Math.max(12000, maxX + padding);
      const gridHeight = Math.max(10000, maxY + padding);
      const cellDim = gridSize.value; // 100mm grid cell

      // 2. Build GridGraph and rasterize walls, zones, and breakthrough points
      const grid = new GridGraph(gridWidth, gridHeight, cellDim);
      rasterizeProject(grid, project.value);

      // 3. Initialize direction-aware A* Router
      const router = new AStarRouter(grid);

      // Incremental network construction:
      // Start with CentralUnit as initial network tree
      const networkPoints: Point[] = [project.value.centralUnit.position];
      const allPaths: Point[][] = [];
      const allRawPoints: Point[] = [];
      const allTurns: RouteResult['turns'] = [];
      let totalCostSum = 0;
      let totalLengthSum = 0;

      // Sort outlets by distance to central unit to expand network outward
      const sortedOutlets = [...project.value.outlets].sort((a, b) => {
        const da = Math.hypot(
          a.position.x - project.value.centralUnit.position.x,
          a.position.y - project.value.centralUnit.position.y
        );
        const db = Math.hypot(
          b.position.x - project.value.centralUnit.position.x,
          b.position.y - project.value.centralUnit.position.y
        );
        return da - db;
      });

      for (const outlet of sortedOutlets) {
        // Route from this outlet to the closest node in the current pipe network tree
        const result = router.findRoute(outlet.position, networkPoints, {
          turnPenalty90: 4.0,
          turnPenalty45: 2.0,
          allowCornerCutting: false,
          useExactEndpoints: true,
        });

        if (result && result.path.length > 0) {
          allPaths.push(result.path);
          allRawPoints.push(...result.rawPath);
          allTurns.push(...result.turns);
          totalCostSum += result.totalCost;
          totalLengthSum += result.totalLength;

          // Add newly routed points to the existing network tree
          for (const pt of result.rawPath) {
            networkPoints.push(pt);
          }
        }
      }

      if (allPaths.length > 0) {
        // Combine paths for visualization
        const combinedPath: Point[] = [];
        for (const p of allPaths) {
          combinedPath.push(...p);
        }

        currentRoute.value = {
          path: combinedPath,
          rawPath: allRawPoints,
          totalCost: Math.round(totalCostSum * 100) / 100,
          totalLength: Math.round(totalLengthSum * 100) / 100,
          turns: allTurns,
        };
      } else {
        currentRoute.value = null;
        calculationError.value = 'Nem található akadálymentes útvonal az aljzatok és a gép között!';
      }
    } catch (err: unknown) {
      console.error('Pipe recalculation error:', err);
      calculationError.value = 'Hiba történt a nyomvonal számítása közben.';
      currentRoute.value = null;
    } finally {
      isCalculatingRoute.value = false;
    }
  }

  return {
    project,
    activeTool,
    selectedElementId,
    selectedElementType,
    selectedWall,
    selectedOutlet,
    selectedZone,
    isCentralUnitSelected,
    snapToGrid,
    gridSize,
    currentRoute,
    isCalculatingRoute,
    calculationError,
    setActiveTool,
    toggleSnapToGrid,
    selectElement,
    clearSelection,
    addWall,
    updateWall,
    removeWall,
    setCentralUnit,
    addOutlet,
    updateOutlet,
    removeOutlet,
    addZone,
    updateZone,
    removeZone,
    addBreakthrough,
    removeBreakthrough,
    deleteSelected,
    recalculatePipes,
  };
});
