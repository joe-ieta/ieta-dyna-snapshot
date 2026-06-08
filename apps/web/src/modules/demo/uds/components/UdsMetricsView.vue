<template>
  <div class="uds-metrics" :data-testid="view.dataTestId || view.id">
    <article v-for="metric in metrics" :key="metric.id" class="demo-kpi">
      <div class="demo-kpi-label">{{ metric.label }}</div>
      <div class="demo-kpi-value">
        {{ metric.value }}<span v-if="metric.unit">{{ metric.unit }}</span>
      </div>
      <div class="demo-kpi-sub">
        {{ metric.trend || metric.status || metric.description || "UDS 指标" }}
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveMetrics } from "../resolver";
import type { UdsMetricsView, UdsScene, UdsSceneState } from "../types";

const props = defineProps<{
  scene: UdsScene;
  view: UdsMetricsView;
  state: UdsSceneState;
}>();

const metrics = computed(() =>
  resolveMetrics(props.scene, props.view.binding.metrics, props.state),
);
</script>
