<template>
  <div class="demo-analysis" :data-testid="view.dataTestId || view.id">
    {{ text }}
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveText } from "../resolver";
import type { UdsScene, UdsSceneState, UdsTextView } from "../types";

const props = defineProps<{
  scene: UdsScene;
  view: UdsTextView;
  state: UdsSceneState;
}>();

const text = computed(() => resolveText(props.scene, props.view.binding, props.state));
</script>
