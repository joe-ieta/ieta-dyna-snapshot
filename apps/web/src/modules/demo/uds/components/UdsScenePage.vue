<template>
  <main class="demo-screen uds-scene-page">
    <header class="demo-topbar">
      <RouterLink class="demo-brand" to="/demo">
        <span class="demo-brand-mark">U</span>
        <span>UDS Demo Systems</span>
      </RouterLink>
      <nav class="demo-nav">
        <RouterLink to="/demo/local-monitor">本机资源监测</RouterLink>
        <RouterLink to="/demo/smart-health">海上市智慧医疗</RouterLink>
      </nav>
    </header>

    <section class="demo-page">
      <div class="demo-page-header">
        <div class="demo-page-title">
          <h1>{{ scene.title }}</h1>
          <p>{{ scene.subtitle }}</p>
        </div>
        <UdsFilterBar v-model="filters" :scene="scene" />
      </div>

      <p v-if="scene.dataNotice" class="demo-muted uds-notice" data-testid="uds-data-notice">
        {{ scene.dataNotice }}
      </p>

      <div class="uds-grid" data-testid="uds-view-grid">
        <UdsViewRenderer
          v-for="view in scene.views"
          :key="view.id"
          :scene="scene"
          :view="view"
          :state="sceneState"
          @row-click="handleRowClick"
        />
      </div>

      <span class="demo-ready" data-testid="page-ready">ready</span>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import UdsFilterBar from "./UdsFilterBar.vue";
import UdsViewRenderer from "./UdsViewRenderer.vue";
import { applyRouteTemplate, initialFilterState } from "../resolver";
import type { UdsRecord, UdsScene, UdsSelection, UdsTableView } from "../types";

const props = defineProps<{
  scene: UdsScene;
}>();

const router = useRouter();
const filters = ref(initialFilterState(props.scene));
const selection = ref<UdsSelection | undefined>();

watch(
  () => props.scene.id,
  () => {
    filters.value = initialFilterState(props.scene);
    selection.value = undefined;
  },
);

const sceneState = computed(() => ({
  filters: filters.value,
  selection: selection.value,
}));

const handleRowClick = (view: UdsTableView, row: UdsRecord) => {
  const interaction = view.interactions?.find((item) => item.event === "rowClick");
  if (!interaction) return;

  if (interaction.action.type === "navigate") {
    router.push(applyRouteTemplate(interaction.action.route, row));
    return;
  }

  if (interaction.action.type === "setFilter") {
    filters.value = {
      ...filters.value,
      [interaction.action.filterId]: String(row[interaction.action.valueField] ?? ""),
    };
    return;
  }

  selection.value = {
    dataset: interaction.action.dataset,
    keyField: interaction.action.keyField,
    keyValue: row[interaction.action.keyField],
    row,
  };
};
</script>
