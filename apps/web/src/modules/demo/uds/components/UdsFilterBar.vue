<template>
  <div v-if="scene.filters?.length" class="uds-filter-bar" data-testid="uds-filter-bar">
    <label v-for="filter in scene.filters" :key="filter.id" class="demo-filter">
      <span>{{ filter.label }}</span>
      <select
        v-if="filter.type === 'select'"
        :data-testid="`uds-filter-${filter.id}`"
        :value="modelValue[filter.id] || 'all'"
        @change="updateFilter(filter.id, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in filter.options || []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        :data-testid="`uds-filter-${filter.id}`"
        type="search"
        :value="modelValue[filter.id] || ''"
        @input="updateFilter(filter.id, ($event.target as HTMLInputElement).value)"
      >
    </label>
  </div>
</template>

<script setup lang="ts">
import type { UdsFilterState, UdsScene } from "../types";

const props = defineProps<{
  scene: UdsScene;
  modelValue: UdsFilterState;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: UdsFilterState];
}>();

const updateFilter = (id: string, value: string) => {
  emit("update:modelValue", {
    ...props.modelValue,
    [id]: value,
  });
};
</script>
