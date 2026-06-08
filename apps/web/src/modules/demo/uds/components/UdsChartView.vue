<template>
  <div :data-testid="view.dataTestId || view.id">
    <DemoChart :option="option" :height="height" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DemoChart from "../../components/DemoChart.vue";
import { resolveChartOption } from "../resolver";
import type { UdsChartView, UdsScene, UdsSceneState } from "../types";

const props = defineProps<{
  scene: UdsScene;
  view: UdsChartView;
  state: UdsSceneState;
}>();

const option = computed(() => resolveChartOption(props.scene, props.view.binding, props.state));
const height = computed(() => (props.view.span && props.view.span > 2 ? "310px" : "280px"));
</script>
