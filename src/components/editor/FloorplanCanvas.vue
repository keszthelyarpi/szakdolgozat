<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Konva from 'konva';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasTransform } from '@/composables/useCanvasTransform';
import type { Point, Wall, Outlet, Zone } from '@/core/types/project.types';

defineProps<{
  containerWidth?: number;
  containerHeight?: number;
}>();

const emit = defineEmits<{
  (e: 'cursorCoords', coords: { x: number; y: number }): void;
}>();

const store = useProjectStore();
const {
  scale,
  offsetX,
  offsetY,
  worldToScreen,
  screenToWorld,
  snapPoint,
  constrainAngle,
  handleWheel,
  panBy,
  fitToBounds,
} = useCanvasTransform(0.08, 120, 100);

const containerRef = ref<HTMLDivElement | null>(null);

let stage: Konva.Stage | null = null;
let gridLayer: Konva.Layer | null = null;
let zoneLayer: Konva.Layer | null = null;
let wallLayer: Konva.Layer | null = null;
let equipmentLayer: Konva.Layer | null = null;
let pipeLayer: Konva.Layer | null = null;
let interactionLayer: Konva.Layer | null = null;

// Temporary drawing states
const wallStartPoint = ref<Point | null>(null);
const wallPreviewEnd = ref<Point | null>(null);
const isShiftPressed = ref<boolean>(false);
const isSpacePressed = ref<boolean>(false);
const isPanning = ref<boolean>(false);
const panStart = ref<{ x: number; y: number } | null>(null);

// Zone polygon drawing in progress
const activeZonePoints = ref<Point[]>([]);

// Cursor position in world mm
const cursorWorld = ref<Point>({ x: 0, y: 0 });

// Initialize Konva Stage
onMounted(() => {
  if (!containerRef.value) return;

  const width = containerRef.value.clientWidth || 800;
  const height = containerRef.value.clientHeight || 600;

  stage = new Konva.Stage({
    container: containerRef.value,
    width,
    height,
  });

  gridLayer = new Konva.Layer({ listening: false });
  zoneLayer = new Konva.Layer();
  wallLayer = new Konva.Layer();
  pipeLayer = new Konva.Layer();
  equipmentLayer = new Konva.Layer();
  interactionLayer = new Konva.Layer();

  stage.add(gridLayer);
  stage.add(zoneLayer);
  stage.add(wallLayer);
  stage.add(pipeLayer);
  stage.add(equipmentLayer);
  stage.add(interactionLayer);

  // Setup event listeners
  setupCanvasEvents();
  setupWindowEvents();

  // Initial draw
  redrawAll();

  // Observe container resizing
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.contentRect && stage) {
        stage.width(entry.contentRect.width);
        stage.height(entry.contentRect.height);
        redrawAll();
      }
    }
  });
  resizeObserver.observe(containerRef.value);

  // Trigger initial route calculation if central unit & outlets exist
  if (store.project.centralUnit && store.project.outlets.length > 0) {
    store.recalculatePipes();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  if (stage) {
    stage.destroy();
  }
});

// Watch reactive store changes and redraw
watch(
  [
    () => store.project.walls,
    () => store.project.centralUnit,
    () => store.project.outlets,
    () => store.project.zones,
    () => store.project.breakthroughPoints,
    () => store.currentRoute,
    () => store.selectedElementId,
    () => store.activeTool,
    scale,
    offsetX,
    offsetY,
  ],
  () => {
    redrawAll();
  },
  { deep: true }
);

function setupCanvasEvents(): void {
  if (!stage) return;

  // Zoom on wheel
  stage.on('wheel', (e) => {
    const pointer = stage!.getPointerPosition();
    if (pointer) {
      handleWheel(e.evt, pointer);
    }
  });

  // Mouse down: start pan or start tool action
  stage.on('mousedown', (e) => {
    // Middle button or Space key pressed or pan tool active -> Start panning
    if (e.evt.button === 1 || isSpacePressed.value || store.activeTool === 'pan') {
      isPanning.value = true;
      const pointer = stage!.getPointerPosition();
      if (pointer) {
        panStart.value = { x: pointer.x, y: pointer.y };
      }
      return;
    }

    // Only handle left clicks for tool actions
    if (e.evt.button !== 0) return;

    const pointer = stage!.getPointerPosition();
    if (!pointer) return;

    let worldPt = screenToWorld(pointer);
    worldPt = snapPoint(worldPt, store.gridSize, store.snapToGrid);

    // Tool logic
    switch (store.activeTool) {
      case 'select':
        // Clicking empty stage clears selection
        if (e.target === stage) {
          store.clearSelection();
        }
        break;

      case 'wall':
        if (!wallStartPoint.value) {
          // First click: start wall
          wallStartPoint.value = worldPt;
          wallPreviewEnd.value = worldPt;
        } else {
          // Second click: finish wall
          let endPt = worldPt;
          if (isShiftPressed.value) {
            endPt = constrainAngle(wallStartPoint.value, endPt);
          }
          const dist = Math.hypot(
            endPt.x - wallStartPoint.value.x,
            endPt.y - wallStartPoint.value.y
          );
          if (dist > 50) {
            const newWall: Wall = {
              id: `wall-${Date.now()}`,
              startPoint: wallStartPoint.value,
              endPoint: endPt,
              thickness: 150,
              isDrillable: true,
            };
            store.addWall(newWall);
          }
          wallStartPoint.value = null;
          wallPreviewEnd.value = null;
        }
        break;

      case 'centralUnit':
        store.setCentralUnit(worldPt);
        store.setActiveTool('select');
        break;

      case 'outlet': {
        const newOutlet: Outlet = {
          id: `outlet-${Date.now()}`,
          position: worldPt,
          coverageRadius: 8000,
        };
        store.addOutlet(newOutlet);
        break;
      }

      case 'zone':
        // Add point to active zone polygon
        activeZonePoints.value.push(worldPt);
        break;

      case 'breakthrough':
        store.addBreakthrough({ position: worldPt });
        break;
    }

    redrawInteraction();
  });

  // Mouse move: update pan, update preview, update cursor coords
  stage.on('mousemove', () => {
    const pointer = stage!.getPointerPosition();
    if (!pointer) return;

    if (isPanning.value && panStart.value) {
      const dx = pointer.x - panStart.value.x;
      const dy = pointer.y - panStart.value.y;
      panBy(dx, dy);
      panStart.value = { x: pointer.x, y: pointer.y };
      return;
    }

    let worldPt = screenToWorld(pointer);
    worldPt = snapPoint(worldPt, store.gridSize, store.snapToGrid);
    cursorWorld.value = worldPt;
    emit('cursorCoords', worldPt);

    if (store.activeTool === 'wall' && wallStartPoint.value) {
      if (isShiftPressed.value) {
        wallPreviewEnd.value = constrainAngle(wallStartPoint.value, worldPt);
      } else {
        wallPreviewEnd.value = worldPt;
      }
      redrawInteraction();
    } else if (store.activeTool === 'zone' && activeZonePoints.value.length > 0) {
      redrawInteraction();
    }
  });

  // Mouse up: finish pan
  stage.on('mouseup', () => {
    isPanning.value = false;
    panStart.value = null;
  });

  // Double click: close active zone polygon
  stage.on('dblclick', () => {
    if (store.activeTool === 'zone' && activeZonePoints.value.length >= 3) {
      const newZone: Zone = {
        id: `zone-${Date.now()}`,
        points: [...activeZonePoints.value],
        isFloorZone: true,
      };
      store.addZone(newZone);
      activeZonePoints.value = [];
      redrawInteraction();
    }
  });
}

function setupWindowEvents(): void {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Shift') {
    isShiftPressed.value = true;
    if (wallStartPoint.value && wallPreviewEnd.value) {
      wallPreviewEnd.value = constrainAngle(wallStartPoint.value, cursorWorld.value);
      redrawInteraction();
    }
  }

  if (e.code === 'Space') {
    if (!isSpacePressed.value) {
      isSpacePressed.value = true;
    }
  }

  if (e.key === 'Escape') {
    // Cancel in-progress drawing
    wallStartPoint.value = null;
    wallPreviewEnd.value = null;
    activeZonePoints.value = [];
    store.clearSelection();
    redrawInteraction();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Prevent delete if user is typing in an input
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag !== 'input' && targetTag !== 'textarea') {
      store.deleteSelected();
    }
  }

  // Hotkeys
  const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  if (targetTag !== 'input' && targetTag !== 'textarea') {
    if (e.key === 'v' || e.key === 'V') store.setActiveTool('select');
    if (e.key === 'h' || e.key === 'H') store.setActiveTool('pan');
    if (e.key === 'w' || e.key === 'W') store.setActiveTool('wall');
    if (e.key === 'c' || e.key === 'C') store.setActiveTool('centralUnit');
    if (e.key === 'o' || e.key === 'O') store.setActiveTool('outlet');
    if (e.key === 'z' || e.key === 'Z') store.setActiveTool('zone');
    if (e.key === 'b' || e.key === 'B') store.setActiveTool('breakthrough');
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (e.key === 'Shift') {
    isShiftPressed.value = false;
    if (wallStartPoint.value) {
      wallPreviewEnd.value = cursorWorld.value;
      redrawInteraction();
    }
  }

  if (e.code === 'Space') {
    isSpacePressed.value = false;
    isPanning.value = false;
  }
}

// Full redraw of all layers
function redrawAll(): void {
  if (!stage) return;
  drawGrid();
  drawZones();
  drawWalls();
  drawEquipment();
  drawPipes();
  redrawInteraction();
}

/**
 * 1. Infinite Grid Layer
 */
function drawGrid(): void {
  if (!gridLayer || !stage) return;
  gridLayer.destroyChildren();

  const stageW = stage.width();
  const stageH = stage.height();

  // Grid step in world coordinates (100mm and 1000mm)
  const minorStepWorld = store.gridSize; // 100mm
  const majorStepWorld = 1000;          // 1000mm = 1m

  const topLeftWorld = screenToWorld({ x: 0, y: 0 });
  const bottomRightWorld = screenToWorld({ x: stageW, y: stageH });

  const startX = Math.floor(topLeftWorld.x / minorStepWorld) * minorStepWorld;
  const endX = Math.ceil(bottomRightWorld.x / minorStepWorld) * minorStepWorld;
  const startY = Math.floor(topLeftWorld.y / minorStepWorld) * minorStepWorld;
  const endY = Math.ceil(bottomRightWorld.y / minorStepWorld) * minorStepWorld;

  // Background rect
  const bg = new Konva.Rect({
    x: 0,
    y: 0,
    width: stageW,
    height: stageH,
    fill: '#090d16',
  });
  gridLayer.add(bg);

  // If zoomed in enough, draw minor grid dots/lines
  if (scale.value >= 0.04) {
    for (let x = startX; x <= endX; x += minorStepWorld) {
      const isMajor = x % majorStepWorld === 0;
      if (isMajor) continue;
      const screenX = worldToScreen({ x, y: 0 }).x;
      const line = new Konva.Line({
        points: [screenX, 0, screenX, stageH],
        stroke: 'rgba(51, 65, 85, 0.22)',
        strokeWidth: 1,
      });
      gridLayer.add(line);
    }

    for (let y = startY; y <= endY; y += minorStepWorld) {
      const isMajor = y % majorStepWorld === 0;
      if (isMajor) continue;
      const screenY = worldToScreen({ x: 0, y }).y;
      const line = new Konva.Line({
        points: [0, screenY, stageW, screenY],
        stroke: 'rgba(51, 65, 85, 0.22)',
        strokeWidth: 1,
      });
      gridLayer.add(line);
    }
  }

  // Draw Major Grid Lines (every 1000mm) + metric labels
  for (let x = startX; x <= endX; x += majorStepWorld) {
    const screenX = worldToScreen({ x, y: 0 }).x;
    const line = new Konva.Line({
      points: [screenX, 0, screenX, stageH],
      stroke: 'rgba(71, 85, 105, 0.55)',
      strokeWidth: 1,
    });
    gridLayer.add(line);

    // Coordinate Label
    const text = new Konva.Text({
      x: screenX + 4,
      y: 6,
      text: `${x / 1000}m`,
      fontSize: 10,
      fill: 'rgba(148, 163, 184, 0.65)',
    });
    gridLayer.add(text);
  }

  for (let y = startY; y <= endY; y += majorStepWorld) {
    const screenY = worldToScreen({ x: 0, y }).y;
    const line = new Konva.Line({
      points: [0, screenY, stageW, screenY],
      stroke: 'rgba(71, 85, 105, 0.55)',
      strokeWidth: 1,
    });
    gridLayer.add(line);

    const text = new Konva.Text({
      x: 6,
      y: screenY + 4,
      text: `${y / 1000}m`,
      fontSize: 10,
      fill: 'rgba(148, 163, 184, 0.65)',
    });
    gridLayer.add(text);
  }

  gridLayer.batchDraw();
}

/**
 * 2. Zones Layer (Aljzatbeton)
 */
function drawZones(): void {
  if (!zoneLayer) return;
  zoneLayer.destroyChildren();

  for (const zone of store.project.zones) {
    if (zone.points.length < 3) continue;

    const screenPoints: number[] = [];
    for (const pt of zone.points) {
      const s = worldToScreen(pt);
      screenPoints.push(s.x, s.y);
    }

    const isSelected = store.selectedElementId === zone.id;

    const polygon = new Konva.Line({
      points: screenPoints,
      fill: zone.isFloorZone ? 'rgba(16, 185, 129, 0.22)' : 'rgba(148, 163, 184, 0.15)',
      stroke: isSelected ? '#38bdf8' : zone.isFloorZone ? '#10b981' : '#64748b',
      strokeWidth: isSelected ? 3 : 1.5,
      closed: true,
      dash: zone.isFloorZone ? [6, 4] : undefined,
    });

    polygon.on('click', (e) => {
      e.cancelBubble = true;
      store.selectElement(zone.id, 'zone');
    });

    zoneLayer.add(polygon);
  }

  zoneLayer.batchDraw();
}

/**
 * 3. Wall Layer (Falak)
 */
function drawWalls(): void {
  if (!wallLayer) return;
  wallLayer.destroyChildren();

  for (const wall of store.project.walls) {
    const s1 = worldToScreen(wall.startPoint);
    const s2 = worldToScreen(wall.endPoint);
    const strokeWidthPx = Math.max(2, wall.thickness * scale.value);
    const isSelected = store.selectedElementId === wall.id;

    // Outer wall representation
    const wallLine = new Konva.Line({
      points: [s1.x, s1.y, s2.x, s2.y],
      stroke: isSelected
        ? '#38bdf8'
        : wall.isDrillable
        ? '#475569'
        : '#0f172a',
      strokeWidth: strokeWidthPx,
      lineCap: 'square',
    });

    // Border highlight / selection outline
    const borderLine = new Konva.Line({
      points: [s1.x, s1.y, s2.x, s2.y],
      stroke: isSelected
        ? '#38bdf8'
        : wall.isDrillable
        ? '#94a3b8'
        : '#334155',
      strokeWidth: isSelected ? strokeWidthPx + 4 : strokeWidthPx,
      dash: wall.isDrillable ? [8, 4] : undefined,
      lineCap: 'square',
      opacity: isSelected ? 0.9 : 0.85,
    });

    // Make interactive for selection
    const hitArea = new Konva.Line({
      points: [s1.x, s1.y, s2.x, s2.y],
      stroke: 'transparent',
      strokeWidth: Math.max(16, strokeWidthPx),
      hitStrokeWidth: Math.max(16, strokeWidthPx),
    });

    hitArea.on('click', (e) => {
      e.cancelBubble = true;
      store.selectElement(wall.id, 'wall');
    });

    hitArea.on('mouseenter', () => {
      if (stage && store.activeTool === 'select') {
        stage.container().style.cursor = 'pointer';
      }
    });

    hitArea.on('mouseleave', () => {
      if (stage && store.activeTool === 'select') {
        stage.container().style.cursor = 'default';
      }
    });

    wallLayer.add(borderLine);
    wallLayer.add(wallLine);
    wallLayer.add(hitArea);
  }

  wallLayer.batchDraw();
}

/**
 * 4. Equipment Layer (Központi gép, fali kiállások, áttörések)
 */
function drawEquipment(): void {
  if (!equipmentLayer) return;
  equipmentLayer.destroyChildren();

  // Draw Central Unit (Központi porszívó gép)
  if (store.project.centralUnit) {
    const s = worldToScreen(store.project.centralUnit.position);
    const size = Math.max(26, 400 * scale.value);
    const isSelected = store.selectedElementType === 'centralUnit';

    const group = new Konva.Group({
      x: s.x,
      y: s.y,
    });

    // Outer housing
    const box = new Konva.Rect({
      x: -size / 2,
      y: -size / 2,
      width: size,
      height: size,
      fill: isSelected ? '#0284c7' : '#0369a1',
      stroke: isSelected ? '#38bdf8' : '#38bdf8',
      strokeWidth: isSelected ? 3 : 2,
      cornerRadius: 6,
      shadowColor: '#0284c7',
      shadowBlur: isSelected ? 16 : 8,
      shadowOpacity: 0.6,
    });

    // Vacuum turbine inner circle symbol
    const innerCircle = new Konva.Circle({
      radius: size * 0.32,
      fill: '#0f172a',
      stroke: '#38bdf8',
      strokeWidth: 2,
    });

    const label = new Konva.Text({
      x: -size,
      y: size / 2 + 6,
      width: size * 2,
      align: 'center',
      text: 'PORSZÍVÓ',
      fontSize: 10,
      fontStyle: 'bold',
      fill: '#38bdf8',
    });

    group.add(box);
    group.add(innerCircle);
    group.add(label);

    group.on('click', (e) => {
      e.cancelBubble = true;
      store.selectElement('centralUnit', 'centralUnit');
    });

    equipmentLayer.add(group);
  }

  // Draw Outlets (Fali kiállások + lefedettségi körök)
  for (const outlet of store.project.outlets) {
    const s = worldToScreen(outlet.position);
    const isSelected = store.selectedElementId === outlet.id;
    const rPx = Math.max(9, 120 * scale.value);
    const coveragePx = outlet.coverageRadius * scale.value;

    const group = new Konva.Group({
      x: s.x,
      y: s.y,
    });

    // Coverage radius circle (semi-transparent reach of flexible vacuum hose)
    const coverageCircle = new Konva.Circle({
      radius: coveragePx,
      fill: 'rgba(245, 158, 11, 0.06)',
      stroke: isSelected ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.28)',
      strokeWidth: 1,
      dash: [8, 6],
    });

    // Outlet core CAD symbol
    const outerRing = new Konva.Circle({
      radius: rPx,
      fill: isSelected ? '#f59e0b' : '#d97706',
      stroke: '#ffffff',
      strokeWidth: 2,
      shadowColor: '#f59e0b',
      shadowBlur: isSelected ? 12 : 6,
      shadowOpacity: 0.6,
    });

    const centerDot = new Konva.Circle({
      radius: rPx * 0.45,
      fill: '#0f172a',
    });

    const label = new Konva.Text({
      x: -60,
      y: rPx + 4,
      width: 120,
      align: 'center',
      text: outlet.id.replace('outlet-', ''),
      fontSize: 10,
      fill: '#fcd34d',
    });

    group.add(coverageCircle);
    group.add(outerRing);
    group.add(centerDot);
    group.add(label);

    group.on('click', (e) => {
      e.cancelBubble = true;
      store.selectElement(outlet.id, 'outlet');
    });

    equipmentLayer.add(group);
  }

  // Draw Breakthrough Points
  for (const bp of store.project.breakthroughPoints) {
    const s = worldToScreen(bp.position);
    const r = Math.max(6, 80 * scale.value);

    const bpCircle = new Konva.Circle({
      x: s.x,
      y: s.y,
      radius: r,
      fill: 'rgba(239, 68, 68, 0.85)',
      stroke: '#fca5a5',
      strokeWidth: 1.5,
    });

    equipmentLayer.add(bpCircle);
  }

  equipmentLayer.batchDraw();
}

/**
 * 5. Pipe Layer (A* által kalkulált csővezeték + könyökök)
 */
function drawPipes(): void {
  if (!pipeLayer) return;
  pipeLayer.destroyChildren();

  if (!store.currentRoute || store.currentRoute.path.length < 2) {
    pipeLayer.batchDraw();
    return;
  }

  const rawPath = store.currentRoute.rawPath || store.currentRoute.path;
  const screenPoints: number[] = [];
  for (const pt of rawPath) {
    const s = worldToScreen(pt);
    screenPoints.push(s.x, s.y);
  }

  // Outer blue glow / shadow line
  const glowLine = new Konva.Line({
    points: screenPoints,
    stroke: 'rgba(2, 132, 199, 0.5)',
    strokeWidth: 10,
    lineCap: 'round',
    lineJoin: 'round',
  });

  // Solid pipe body (cyan / vacuum blue)
  const pipeLine = new Konva.Line({
    points: screenPoints,
    stroke: '#38bdf8',
    strokeWidth: 5,
    lineCap: 'round',
    lineJoin: 'round',
    shadowColor: '#38bdf8',
    shadowBlur: 10,
    shadowOpacity: 0.8,
  });

  pipeLayer.add(glowLine);
  pipeLayer.add(pipeLine);

  // Draw Turn Elbow Markers (45° and 90° idomok)
  for (const turn of store.currentRoute.turns) {
    const s = worldToScreen(turn.position);
    const is90 = turn.angle === 90;

    const elbowMarker = new Konva.Circle({
      x: s.x,
      y: s.y,
      radius: 6,
      fill: is90 ? '#ef4444' : '#f97316',
      stroke: '#ffffff',
      strokeWidth: 1.5,
      shadowColor: is90 ? '#ef4444' : '#f97316',
      shadowBlur: 8,
      shadowOpacity: 0.8,
    });

    const badge = new Konva.Text({
      x: s.x + 8,
      y: s.y - 12,
      text: `${turn.angle}°`,
      fontSize: 10,
      fontStyle: 'bold',
      fill: is90 ? '#fca5a5' : '#fed7aa',
    });

    pipeLayer.add(elbowMarker);
    pipeLayer.add(badge);
  }

  pipeLayer.batchDraw();
}

/**
 * 6. Interaction Layer (Drawing preview, snap indicator)
 */
function redrawInteraction(): void {
  if (!interactionLayer) return;
  interactionLayer.destroyChildren();

  // Wall drawing rubberband line
  if (store.activeTool === 'wall' && wallStartPoint.value && wallPreviewEnd.value) {
    const s1 = worldToScreen(wallStartPoint.value);
    const s2 = worldToScreen(wallPreviewEnd.value);

    const rubberband = new Konva.Line({
      points: [s1.x, s1.y, s2.x, s2.y],
      stroke: '#38bdf8',
      strokeWidth: Math.max(3, 150 * scale.value),
      dash: [6, 4],
      lineCap: 'square',
    });

    const startMarker = new Konva.Circle({
      x: s1.x,
      y: s1.y,
      radius: 5,
      fill: '#38bdf8',
    });

    const endMarker = new Konva.Circle({
      x: s2.x,
      y: s2.y,
      radius: 5,
      fill: '#38bdf8',
    });

    // Dimension label along rubberband
    const dx = wallPreviewEnd.value.x - wallStartPoint.value.x;
    const dy = wallPreviewEnd.value.y - wallStartPoint.value.y;
    const dist = Math.round(Math.hypot(dx, dy));

    const label = new Konva.Text({
      x: (s1.x + s2.x) / 2 + 10,
      y: (s1.y + s2.y) / 2 - 16,
      text: `${dist} mm`,
      fontSize: 12,
      fontStyle: 'bold',
      fill: '#38bdf8',
      stroke: '#0f172a',
      strokeWidth: 3,
      fillAfterStrokeEnabled: true,
    });

    interactionLayer.add(rubberband);
    interactionLayer.add(startMarker);
    interactionLayer.add(endMarker);
    interactionLayer.add(label);
  }

  // Active Zone polygon in progress
  if (store.activeTool === 'zone' && activeZonePoints.value.length > 0) {
    const screenPts: number[] = [];
    for (const p of activeZonePoints.value) {
      const s = worldToScreen(p);
      screenPts.push(s.x, s.y);
    }
    // Connect to current cursor
    const sCur = worldToScreen(cursorWorld.value);
    screenPts.push(sCur.x, sCur.y);

    const polyLine = new Konva.Line({
      points: screenPts,
      stroke: '#10b981',
      strokeWidth: 2,
      dash: [4, 4],
    });

    for (let i = 0; i < activeZonePoints.value.length; i++) {
      const s = worldToScreen(activeZonePoints.value[i]);
      const dot = new Konva.Circle({
        x: s.x,
        y: s.y,
        radius: 4,
        fill: '#10b981',
      });
      interactionLayer.add(dot);
    }

    interactionLayer.add(polyLine);
  }

  // Grid snap indicator dot under cursor
  if (store.snapToGrid && store.activeTool !== 'pan' && store.activeTool !== 'select') {
    const s = worldToScreen(cursorWorld.value);
    const snapDot = new Konva.Circle({
      x: s.x,
      y: s.y,
      radius: 4,
      stroke: '#38bdf8',
      strokeWidth: 1.5,
      fill: 'transparent',
    });
    interactionLayer.add(snapDot);
  }

  interactionLayer.batchDraw();
}

// Public component methods for toolbar interaction
function zoomIn(): void {
  if (!stage) return;
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  handleWheel({ preventDefault: () => {}, deltaY: -100 } as WheelEvent, center);
}

function zoomOut(): void {
  if (!stage) return;
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  handleWheel({ preventDefault: () => {}, deltaY: 100 } as WheelEvent, center);
}

function resetView(): void {
  if (!stage) return;
  fitToBounds(
    { minX: 0, minY: 0, maxX: 10000, maxY: 8000 },
    stage.width(),
    stage.height(),
    80
  );
}

defineExpose({
  zoomIn,
  zoomOut,
  resetView,
});
</script>

<template>
  <div class="canvas-wrapper">
    <div ref="containerRef" class="konva-container" :class="{ 'cursor-grab': isSpacePressed || store.activeTool === 'pan', 'cursor-grabbing': isPanning }"></div>

    <!-- Floating HUD: Coordinates & Controls status -->
    <div class="canvas-hud">
      <div class="hud-item">
        <span class="hud-label">X:</span>
        <span class="hud-val">{{ cursorWorld.x }} mm</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Y:</span>
        <span class="hud-val">{{ cursorWorld.y }} mm</span>
      </div>
      <div class="hud-divider"></div>
      <div class="hud-item">
        <span class="hud-label">Rács:</span>
        <span class="hud-val">{{ store.snapToGrid ? `${store.gridSize} mm` : 'KI' }}</span>
      </div>
      <div v-if="store.activeTool === 'wall'" class="hud-hint">
        Shift: 0°, 45°, 90° | Esc: Mégse
      </div>
      <div v-else-if="store.activeTool === 'zone'" class="hud-hint">
        Dupla kattintás: Poligon lezárása | Esc: Mégse
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #090d16;
}

.konva-container {
  width: 100%;
  height: 100%;
  outline: none;
}

.konva-container.cursor-grab {
  cursor: grab !important;
}

.konva-container.cursor-grabbing {
  cursor: grabbing !important;
}

.canvas-hud {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 8px;
  padding: 6px 14px;
  font-family: monospace;
  font-size: 11px;
  color: #cbd5e1;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  z-index: 20;
}

.hud-item {
  display: flex;
  gap: 4px;
}

.hud-label {
  color: #94a3b8;
}

.hud-val {
  color: #38bdf8;
  font-weight: 600;
}

.hud-divider {
  width: 1px;
  height: 12px;
  background: rgba(71, 85, 105, 0.6);
}

.hud-hint {
  color: #fbbf24;
  font-family: sans-serif;
  font-size: 11px;
  font-weight: 500;
}
</style>
