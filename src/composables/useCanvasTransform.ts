import { ref, computed } from 'vue';
import type { Point } from '../core/types/project.types';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function useCanvasTransform(initialScale = 0.08, initialOffsetX = 80, initialOffsetY = 80) {
  const scale = ref<number>(initialScale);
  const offsetX = ref<number>(initialOffsetX);
  const offsetY = ref<number>(initialOffsetY);

  const minScale = 0.015; // Max zoom out (overview of large house)
  const maxScale = 1.0;   // Max zoom in (1px = 1mm)

  /**
   * Transforms world coordinates (mm) to screen canvas coordinates (px).
   */
  function worldToScreen(worldPoint: Point): { x: number; y: number } {
    return {
      x: worldPoint.x * scale.value + offsetX.value,
      y: worldPoint.y * scale.value + offsetY.value,
    };
  }

  /**
   * Transforms screen canvas coordinates (px) to world coordinates (mm).
   */
  function screenToWorld(screenPoint: { x: number; y: number }): Point {
    return {
      x: (screenPoint.x - offsetX.value) / scale.value,
      y: (screenPoint.y - offsetY.value) / scale.value,
    };
  }

  /**
   * Snaps a world point (mm) to the closest grid intersection if enabled.
   */
  function snapPoint(point: Point, gridSize = 100, enabled = true): Point {
    if (!enabled || gridSize <= 0) {
      return { x: Math.round(point.x), y: Math.round(point.y) };
    }
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }

  /**
   * Constrains an endpoint to 0°, 45°, 90°, 135°, 180° angles relative to start point (Shift key constraint).
   */
  function constrainAngle(start: Point, current: Point): Point {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return { ...current };

    const angle = Math.atan2(dy, dx); // [-PI, PI]
    // Snap to nearest 45 degrees (PI / 4)
    const step = Math.PI / 4;
    const snappedAngle = Math.round(angle / step) * step;

    return {
      x: Math.round(start.x + dist * Math.cos(snappedAngle)),
      y: Math.round(start.y + dist * Math.sin(snappedAngle)),
    };
  }

  /**
   * Handles wheel zooming centered around the mouse pointer position.
   */
  function handleWheel(e: WheelEvent, stagePointer: { x: number; y: number }): void {
    e.preventDefault();

    const oldScale = scale.value;
    const mouseWorldX = (stagePointer.x - offsetX.value) / oldScale;
    const mouseWorldY = (stagePointer.y - offsetY.value) / oldScale;

    // Zoom multiplier
    const zoomFactor = 1.15;
    let newScale = e.deltaY < 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    // Calculate new offsets to keep pointer over the same world coordinate
    offsetX.value = stagePointer.x - mouseWorldX * newScale;
    offsetY.value = stagePointer.y - mouseWorldY * newScale;
    scale.value = newScale;
  }

  /**
   * Shifts the canvas view by screen pixel deltas (panning).
   */
  function panBy(dx: number, dy: number): void {
    offsetX.value += dx;
    offsetY.value += dy;
  }

  /**
   * Adjusts the viewport to fit the bounding box of the project with margin.
   */
  function fitToBounds(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    containerWidth: number,
    containerHeight: number,
    padding = 100
  ): void {
    const contentWidth = Math.max(1000, bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1000, bounds.maxY - bounds.minY);

    const availableWidth = Math.max(200, containerWidth - padding * 2);
    const availableHeight = Math.max(200, containerHeight - padding * 2);

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const newScale = Math.max(minScale, Math.min(maxScale, Math.min(scaleX, scaleY)));

    scale.value = newScale;
    offsetX.value = (containerWidth - contentWidth * newScale) / 2 - bounds.minX * newScale;
    offsetY.value = (containerHeight - contentHeight * newScale) / 2 - bounds.minY * newScale;
  }

  const zoomPercent = computed(() => `${Math.round(scale.value * 1000)}%`);

  return {
    scale,
    offsetX,
    offsetY,
    zoomPercent,
    worldToScreen,
    screenToWorld,
    snapPoint,
    constrainAngle,
    handleWheel,
    panBy,
    fitToBounds,
  };
}
