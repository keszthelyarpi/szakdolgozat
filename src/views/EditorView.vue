<script setup lang="ts">
import { ref } from 'vue';
import EditorToolbar from '@/components/editor/EditorToolbar.vue';
import FloorplanCanvas from '@/components/editor/FloorplanCanvas.vue';
import PropertiesPanel from '@/components/editor/PropertiesPanel.vue';

const canvasRef = ref<InstanceType<typeof FloorplanCanvas> | null>(null);

function handleZoomIn(): void {
  canvasRef.value?.zoomIn();
}

function handleZoomOut(): void {
  canvasRef.value?.zoomOut();
}

function handleResetView(): void {
  canvasRef.value?.resetView();
}
</script>

<template>
  <div class="cad-app-layout">
    <EditorToolbar
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @reset-view="handleResetView"
    />

    <main class="cad-workspace">
      <div class="canvas-viewport">
        <FloorplanCanvas ref="canvasRef" />
      </div>

      <PropertiesPanel />
    </main>
  </div>
</template>

<style scoped>
.cad-app-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #090d16;
  overflow: hidden;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.cad-workspace {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.canvas-viewport {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
