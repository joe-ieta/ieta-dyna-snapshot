<template>
  <UdsScenePage :scene="smartHealthScene" />
</template>

<script setup lang="ts">
import "../demo.css";
import UdsScenePage from "../uds/components/UdsScenePage.vue";
import { smartHealthScene } from "../uds/scenes";
</script>
