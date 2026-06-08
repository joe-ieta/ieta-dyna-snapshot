<template>
  <UdsScenePage :scene="localMonitorScene" />
</template>

<script setup lang="ts">
import "../demo.css";
import UdsScenePage from "../uds/components/UdsScenePage.vue";
import { localMonitorScene } from "../uds/scenes";
</script>
