<template>
  <section class="demo-panel uds-view" :class="`span-${view.span || 1}`">
    <div class="demo-panel-header">
      <div>
        <h2 class="demo-panel-title">{{ view.title }}</h2>
        <div v-if="view.description" class="demo-muted">{{ view.description }}</div>
      </div>
      <span class="demo-tag">UDS {{ view.type }}</span>
    </div>

    <UdsMetricsView
      v-if="view.type === 'metrics'"
      :scene="scene"
      :view="view"
      :state="state"
    />
    <UdsChartView
      v-else-if="view.type === 'chart'"
      :scene="scene"
      :view="view"
      :state="state"
    />
    <UdsTableView
      v-else-if="view.type === 'table'"
      :scene="scene"
      :view="view"
      :state="state"
      @row-click="(tableView, row) => emit('rowClick', tableView, row)"
    />
    <UdsTextView
      v-else
      :scene="scene"
      :view="view"
      :state="state"
    />
  </section>
</template>

<script setup lang="ts">
import UdsChartView from "./UdsChartView.vue";
import UdsMetricsView from "./UdsMetricsView.vue";
import UdsTableView from "./UdsTableView.vue";
import UdsTextView from "./UdsTextView.vue";
import type { UdsRecord, UdsScene, UdsSceneState, UdsTableView as UdsTableViewType, UdsView } from "../types";

defineProps<{
  scene: UdsScene;
  view: UdsView;
  state: UdsSceneState;
}>();

const emit = defineEmits<{
  rowClick: [view: UdsTableViewType, row: UdsRecord];
}>();
</script>
