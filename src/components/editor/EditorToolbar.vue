<script setup lang="ts">
import { useProjectStore, type ActiveTool } from '@/stores/projectStore';
import {
  MousePointer,
  Hand,
  Minus,
  Cpu,
  Circle,
  Layers,
  Disc,
  RefreshCw,
  Magnet,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
  (e: 'resetView'): void;
}>();

const store = useProjectStore();

interface ToolItem {
  id: ActiveTool;
  label: string;
  icon: any;
  hotkey: string;
  tooltip: string;
}

const drawingTools: ToolItem[] = [
  {
    id: 'select',
    label: 'Kijelölés',
    icon: MousePointer,
    hotkey: 'V',
    tooltip: 'Elemek kiválasztása és tulajdonságaik szerkesztése (V)',
  },
  {
    id: 'pan',
    label: 'Mozgatás',
    icon: Hand,
    hotkey: 'H',
    tooltip: 'Nézet eltolása / Pan (H vagy Space tartva)',
  },
  {
    id: 'wall',
    label: 'Fal rajzolása',
    icon: Minus,
    hotkey: 'W',
    tooltip: 'Fal rajzolása (W) - Shift: 0°, 45°, 90° szögkényszerítés',
  },
  {
    id: 'centralUnit',
    label: 'Központi gép',
    icon: Cpu,
    hotkey: 'C',
    tooltip: 'Központi porszívó egység elhelyezése (C)',
  },
  {
    id: 'outlet',
    label: 'Fali aljzat',
    icon: Circle,
    hotkey: 'O',
    tooltip: 'Porszívó fali kiállás elhelyezése (O)',
  },
  {
    id: 'zone',
    label: 'Aljzatbeton zóna',
    icon: Layers,
    hotkey: 'Z',
    tooltip: 'Alacsony költségű aljzatbeton poligon rajzolása (Z) - Dupla katt: lezárás',
  },
  {
    id: 'breakthrough',
    label: 'Fali áttörés',
    icon: Disc,
    hotkey: 'B',
    tooltip: 'Fúrt áttörési pont elhelyezése (B)',
  },
];
</script>

<template>
  <header class="editor-toolbar">
    <!-- Brand / Title -->
    <div class="toolbar-brand">
      <div class="brand-icon">
        <Sparkles class="w-5 h-5 text-cyan-400" />
      </div>
      <div class="brand-text">
        <span class="brand-title">AeroCAD</span>
        <span class="brand-subtitle">Porszívó Csőhálózat Tervező</span>
      </div>
    </div>

    <!-- Center Tool Selection Group -->
    <div class="toolbar-tools">
      <div class="tool-group">
        <button
          v-for="tool in drawingTools"
          :key="tool.id"
          class="tool-btn"
          :class="{ active: store.activeTool === tool.id }"
          :title="tool.tooltip"
          @click="store.setActiveTool(tool.id)"
        >
          <component :is="tool.icon" class="w-4 h-4 tool-icon" />
          <span class="tool-label">{{ tool.label }}</span>
          <span class="tool-hotkey">{{ tool.hotkey }}</span>
        </button>
      </div>
    </div>

    <!-- Right Action Buttons -->
    <div class="toolbar-actions">
      <!-- Snap toggle -->
      <button
        class="action-btn"
        :class="{ 'action-active': store.snapToGrid }"
        :title="store.snapToGrid ? 'Rácshoz igazítás bekapcsolva (100mm)' : 'Rácshoz igazítás kikapcsolva'"
        @click="store.toggleSnapToGrid()"
      >
        <Magnet class="w-4 h-4" />
        <span>Rács</span>
        <span class="status-indicator" :class="{ on: store.snapToGrid }"></span>
      </button>

      <!-- View zoom controls -->
      <div class="zoom-group">
        <button class="icon-btn" title="Nagyítás" @click="emit('zoomIn')">
          <ZoomIn class="w-4 h-4" />
        </button>
        <button class="icon-btn" title="Kicsinyítés" @click="emit('zoomOut')">
          <ZoomOut class="w-4 h-4" />
        </button>
        <button class="icon-btn" title="Teljes nézet" @click="emit('resetView')">
          <Maximize2 class="w-4 h-4" />
        </button>
      </div>

      <!-- Delete button (visible when element selected) -->
      <button
        v-if="store.selectedElementId"
        class="action-btn danger"
        title="Kijelölt elem törlése (Del / Backspace)"
        @click="store.deleteSelected()"
      >
        <Trash2 class="w-4 h-4" />
        <span>Törlés</span>
      </button>

      <!-- Recalculate button -->
      <button
        class="recalc-btn"
        :class="{ loading: store.isCalculatingRoute }"
        :disabled="store.isCalculatingRoute"
        title="A* algoritmus futtatása a csőhálózat optimális nyomvonalára"
        @click="store.recalculatePipes()"
      >
        <RefreshCw class="w-4 h-4 icon-spin-target" :class="{ 'animate-spin': store.isCalculatingRoute }" />
        <span>{{ store.isCalculatingRoute ? 'Számítás...' : 'Újratervezés' }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.editor-toolbar {
  height: 58px;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 16px;
  user-select: none;
  z-index: 40;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
}

.brand-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 14px rgba(37, 99, 235, 0.45);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.3px;
  color: #f8fafc;
}

.brand-subtitle {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.2px;
}

.toolbar-tools {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.tool-group {
  display: flex;
  background: rgba(30, 41, 59, 0.85);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.5);
  gap: 3px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}

.tool-btn:hover {
  background: rgba(51, 65, 85, 0.6);
  color: #f1f5f9;
}

.tool-btn.active {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4);
}

.tool-hotkey {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  color: #cbd5e1;
  font-family: monospace;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.5);
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}

.action-btn:hover {
  background: rgba(51, 65, 85, 0.8);
  color: #f8fafc;
}

.action-btn.action-active {
  border-color: #0284c7;
  color: #38bdf8;
  background: rgba(2, 132, 199, 0.15);
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #64748b;
}

.status-indicator.on {
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
}

.action-btn.danger {
  color: #f87171;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.28);
  color: #fca5a5;
}

.zoom-group {
  display: flex;
  align-items: center;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.icon-btn {
  padding: 7px 9px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(71, 85, 105, 0.6);
  color: #f8fafc;
}

.recalc-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 14px rgba(16, 185, 129, 0.35);
  transition: all 0.18s ease;
}

.recalc-btn:hover:not(:disabled) {
  box-shadow: 0 4px 18px rgba(16, 185, 129, 0.55);
  transform: translateY(-1px);
}

.recalc-btn:active:not(:disabled) {
  transform: translateY(0);
}

.recalc-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
