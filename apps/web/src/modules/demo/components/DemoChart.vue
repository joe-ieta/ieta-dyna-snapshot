<template>
  <div class="demo-chart-frame" :style="{ height }" :data-testid="testid">
    <VChart class="demo-chart" :option="option" autoresize />
  </div>
</template>

<script setup lang="ts">
import VChart from "vue-echarts";
import type { DemoChartOption } from "../charts";
import { registerDemoCharts } from "../charts";

registerDemoCharts();

withDefaults(defineProps<{
  option: DemoChartOption;
  height?: string;
  testid?: string;
}>(), {
  height: "260px",
  testid: undefined,
});
</script>
