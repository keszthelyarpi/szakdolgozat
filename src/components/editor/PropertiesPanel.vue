<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores/projectStore';
import {
  Layers,
  Circle,
  Cpu,
  Minus,
  Activity,
  Check,
  AlertCircle,
  Trash2,
} from 'lucide-vue-next';

const store = useProjectStore();

// Wall thickness presets in mm
const thicknessPresets = [100, 150, 200, 250, 300, 380];

const wallLength = computed(() => {
  if (!store.selectedWall) return 0;
  const dx = store.selectedWall.endPoint.x - store.selectedWall.startPoint.x;
  const dy = store.selectedWall.endPoint.y - store.selectedWall.startPoint.y;
  return Math.round(Math.hypot(dx, dy));
});

const turns90Count = computed(() => {
  if (!store.currentRoute) return 0;
  return store.currentRoute.turns.filter((t) => t.angle === 90).length;
});

const turns45Count = computed(() => {
  if (!store.currentRoute) return 0;
  return store.currentRoute.turns.filter((t) => t.angle === 45).length;
});
</script>

<template>
  <aside class="properties-panel">
    <div class="panel-header">
      <h3 class="panel-title">Tulajdonságok</h3>
      <span v-if="store.selectedElementType" class="element-badge">
        {{ store.selectedElementType }}
      </span>
    </div>

    <div class="panel-body">
      <!-- 1. WALL PROPERTIES -->
      <div v-if="store.selectedWall" class="prop-section">
        <div class="section-title">
          <Minus class="w-4 h-4 text-blue-400" />
          <span>Falszakasz Beállításai</span>
        </div>

        <div class="prop-field">
          <label class="field-label">Azonosító</label>
          <input
            type="text"
            class="input-text"
            :value="store.selectedWall.id"
            disabled
          />
        </div>

        <div class="prop-field">
          <label class="field-label">Falvastagság (mm)</label>
          <div class="preset-buttons">
            <button
              v-for="t in thicknessPresets"
              :key="t"
              class="preset-btn"
              :class="{ active: store.selectedWall.thickness === t }"
              @click="store.updateWall(store.selectedWall.id, { thickness: t })"
            >
              {{ t }}
            </button>
          </div>
          <input
            type="number"
            class="input-number mt-2"
            :value="store.selectedWall.thickness"
            min="50"
            max="1000"
            step="10"
            @input="
              store.updateWall(store.selectedWall.id, {
                thickness: Number(($event.target as HTMLInputElement).value),
              })
            "
          />
        </div>

        <div class="prop-field">
          <label class="field-label">Fal anyaga és áttörhetősége</label>
          <div
            class="toggle-switch"
            :class="{ active: store.selectedWall.isDrillable }"
            @click="
              store.updateWall(store.selectedWall.id, {
                isDrillable: !store.selectedWall.isDrillable,
              })
            "
          >
            <div class="toggle-knob"></div>
            <span class="toggle-label">
              {{
                store.selectedWall.isDrillable
                  ? 'Véshető válaszfal (járható, költségszorzó: 15.0)'
                  : 'Nem véshető főfal (szilárd akadály)'
              }}
            </span>
          </div>
        </div>

        <div class="prop-meta">
          <div class="meta-item">
            <span class="meta-label">Hossz:</span>
            <span class="meta-val">{{ (wallLength / 1000).toFixed(2) }} m ({{ wallLength }} mm)</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Kezdőpont:</span>
            <span class="meta-val">X: {{ store.selectedWall.startPoint.x }}, Y: {{ store.selectedWall.startPoint.y }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Végpont:</span>
            <span class="meta-val">X: {{ store.selectedWall.endPoint.x }}, Y: {{ store.selectedWall.endPoint.y }}</span>
          </div>
        </div>

        <button class="delete-btn" @click="store.removeWall(store.selectedWall.id)">
          <Trash2 class="w-4 h-4" />
          <span>Falszakasz törlése</span>
        </button>
      </div>

      <!-- 2. OUTLET PROPERTIES -->
      <div v-else-if="store.selectedOutlet" class="prop-section">
        <div class="section-title">
          <Circle class="w-4 h-4 text-amber-400" />
          <span>Fali Aljzat Kiállás</span>
        </div>

        <div class="prop-field">
          <label class="field-label">Azonosító</label>
          <input
            type="text"
            class="input-text"
            :value="store.selectedOutlet.id"
            disabled
          />
        </div>

        <div class="prop-field">
          <label class="field-label">Hatótávolság / Lefedettségi sugár (mm)</label>
          <div class="range-container">
            <input
              type="range"
              class="range-slider"
              min="3000"
              max="12000"
              step="500"
              :value="store.selectedOutlet.coverageRadius"
              @input="
                store.updateOutlet(store.selectedOutlet.id, {
                  coverageRadius: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
            <span class="range-display">
              {{ (store.selectedOutlet.coverageRadius / 1000).toFixed(1) }} méter
            </span>
          </div>
        </div>

        <div class="coords-grid">
          <div class="prop-field">
            <label class="field-label">X pozíció (mm)</label>
            <input
              type="number"
              class="input-number"
              :value="store.selectedOutlet.position.x"
              step="100"
              @input="
                store.updateOutlet(store.selectedOutlet.id, {
                  position: {
                    x: Number(($event.target as HTMLInputElement).value),
                    y: store.selectedOutlet.position.y,
                  },
                })
              "
            />
          </div>
          <div class="prop-field">
            <label class="field-label">Y pozíció (mm)</label>
            <input
              type="number"
              class="input-number"
              :value="store.selectedOutlet.position.y"
              step="100"
              @input="
                store.updateOutlet(store.selectedOutlet.id, {
                  position: {
                    x: store.selectedOutlet.position.x,
                    y: Number(($event.target as HTMLInputElement).value),
                  },
                })
              "
            />
          </div>
        </div>

        <button class="delete-btn" @click="store.removeOutlet(store.selectedOutlet.id)">
          <Trash2 class="w-4 h-4" />
          <span>Aljzat törlése</span>
        </button>
      </div>

      <!-- 3. CENTRAL UNIT PROPERTIES -->
      <div v-else-if="store.isCentralUnitSelected" class="prop-section">
        <div class="section-title">
          <Cpu class="w-4 h-4 text-cyan-400" />
          <span>Központi Porszívó Gép</span>
        </div>

        <p class="section-desc">
          A porszívó főegység a csővezeték-hálózat kiindulópontja (gyűjtőtartály, motor és kifúvás).
        </p>

        <div class="coords-grid">
          <div class="prop-field">
            <label class="field-label">X pozíció (mm)</label>
            <input
              type="number"
              class="input-number"
              :value="store.project.centralUnit.position.x"
              step="100"
              @input="
                store.setCentralUnit({
                  x: Number(($event.target as HTMLInputElement).value),
                  y: store.project.centralUnit.position.y,
                })
              "
            />
          </div>
          <div class="prop-field">
            <label class="field-label">Y pozíció (mm)</label>
            <input
              type="number"
              class="input-number"
              :value="store.project.centralUnit.position.y"
              step="100"
              @input="
                store.setCentralUnit({
                  x: store.project.centralUnit.position.x,
                  y: Number(($event.target as HTMLInputElement).value),
                })
              "
            />
          </div>
        </div>
      </div>

      <!-- 4. ZONE PROPERTIES -->
      <div v-else-if="store.selectedZone" class="prop-section">
        <div class="section-title">
          <Layers class="w-4 h-4 text-emerald-400" />
          <span>Zóna Beállításai</span>
        </div>

        <div class="prop-field">
          <label class="field-label">Azonosító</label>
          <input
            type="text"
            class="input-text"
            :value="store.selectedZone.id"
            disabled
          />
        </div>

        <div class="prop-field">
          <label class="field-label">Zóna jellege</label>
          <div
            class="toggle-switch"
            :class="{ active: store.selectedZone.isFloorZone }"
            @click="
              store.updateZone(store.selectedZone.id, {
                isFloorZone: !store.selectedZone.isFloorZone,
              })
            "
          >
            <div class="toggle-knob"></div>
            <span class="toggle-label">
              {{
                store.selectedZone.isFloorZone
                  ? 'Aljzatbeton zóna (Előnyben részesített, szorzó: 0.5)'
                  : 'Egyéb burkolat'
              }}
            </span>
          </div>
        </div>

        <div class="prop-meta">
          <div class="meta-item">
            <span class="meta-label">Csúcsok száma:</span>
            <span class="meta-val">{{ store.selectedZone.points.length }} pont</span>
          </div>
        </div>

        <button class="delete-btn" @click="store.removeZone(store.selectedZone.id)">
          <Trash2 class="w-4 h-4" />
          <span>Zóna törlése</span>
        </button>
      </div>

      <!-- 5. DEFAULT / ROUTE OVERVIEW -->
      <div v-else class="prop-section">
        <div class="section-title">
          <Activity class="w-4 h-4 text-cyan-400" />
          <span>Projekt és Nyomvonal</span>
        </div>

        <div class="stats-card">
          <div class="stat-row">
            <span class="stat-label">Falak száma:</span>
            <span class="stat-value">{{ store.project.walls.length }} db</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Fali aljzatok:</span>
            <span class="stat-value">{{ store.project.outlets.length }} db</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Aljzatbeton zónák:</span>
            <span class="stat-value">{{ store.project.zones.length }} db</span>
          </div>
        </div>

        <!-- Calculated Route Metrics -->
        <div v-if="store.currentRoute" class="route-metrics">
          <div class="metric-header">
            <Check class="w-4 h-4 text-emerald-400" />
            <span class="metric-title">Számított Csőhálózat</span>
          </div>

          <div class="metric-grid">
            <div class="metric-box">
              <span class="m-val">{{ (store.currentRoute.totalLength / 1000).toFixed(2) }} m</span>
              <span class="m-lbl">Összhossz</span>
            </div>
            <div class="metric-box">
              <span class="m-val">{{ store.currentRoute.totalCost.toFixed(0) }}</span>
              <span class="m-lbl">Útkeresési költség</span>
            </div>
          </div>

          <div class="fitting-summary">
            <div class="fitting-item">
              <span class="fitting-badge angle-90">90°</span>
              <span class="fitting-name">Könyök idom:</span>
              <span class="fitting-qty">{{ turns90Count }} db</span>
            </div>
            <div class="fitting-item">
              <span class="fitting-badge angle-45">45°</span>
              <span class="fitting-name">Ív idom:</span>
              <span class="fitting-qty">{{ turns45Count }} db</span>
            </div>
          </div>
        </div>

        <div v-else-if="store.calculationError" class="error-box">
          <AlertCircle class="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{{ store.calculationError }}</span>
        </div>

        <div v-else class="empty-hint">
          Kattints egy elemre a szerkesztéshez, vagy az "Újratervezés" gombra a csövezési útvonal generálásához.
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.properties-panel {
  width: 320px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-left: 1px solid rgba(51, 65, 85, 0.6);
  display: flex;
  flex-direction: column;
  color: #f1f5f9;
  user-select: none;
  z-index: 30;
  overflow-y: auto;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: #f8fafc;
  margin: 0;
}

.element-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(2, 132, 199, 0.2);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prop-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.section-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
  margin: 0;
}

.prop-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.input-text,
.input-number {
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(71, 85, 105, 0.6);
  border-radius: 6px;
  padding: 8px 10px;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.input-text:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.input-number:focus {
  border-color: #38bdf8;
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.preset-btn {
  padding: 5px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 5px;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s ease;
}

.preset-btn:hover {
  background: rgba(51, 65, 85, 0.8);
  color: #f8fafc;
}

.preset-btn.active {
  background: #0284c7;
  color: #ffffff;
  border-color: #38bdf8;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.toggle-switch.active {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(52, 211, 153, 0.4);
}

.toggle-knob {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #64748b;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.toggle-switch.active .toggle-knob {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.toggle-label {
  font-size: 12px;
  line-height: 1.3;
  color: #cbd5e1;
}

.coords-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.range-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range-slider {
  flex: 1;
  accent-color: #f59e0b;
}

.range-display {
  font-size: 12px;
  font-weight: 600;
  color: #fbbf24;
  min-width: 65px;
  text-align: right;
}

.prop-meta {
  background: rgba(30, 41, 59, 0.5);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.meta-label {
  color: #94a3b8;
}

.meta-val {
  color: #f1f5f9;
  font-weight: 500;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 6px;
  transition: all 0.16s ease;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.28);
  color: #fca5a5;
}

.stats-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.4);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.stat-label {
  color: #94a3b8;
}

.stat-value {
  color: #f8fafc;
  font-weight: 600;
}

.route-metrics {
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.15);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-title {
  font-size: 13px;
  font-weight: 700;
  color: #38bdf8;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metric-box {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.m-val {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

.m-lbl {
  font-size: 11px;
  color: #94a3b8;
}

.fitting-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid rgba(71, 85, 105, 0.4);
  padding-top: 8px;
}

.fitting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.fitting-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}

.fitting-badge.angle-90 {
  background: #dc2626;
  color: #ffffff;
}

.fitting-badge.angle-45 {
  background: #f97316;
  color: #ffffff;
}

.fitting-name {
  color: #94a3b8;
  flex: 1;
}

.fitting-qty {
  font-weight: 600;
  color: #f1f5f9;
}

.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 6px;
  font-size: 12px;
  color: #fcd34d;
}

.empty-hint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  text-align: center;
  padding: 16px 8px;
}
</style>
