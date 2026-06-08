<template>
  <div class="uds-table-wrap" :data-testid="view.dataTestId || view.id">
    <table class="demo-data-table">
      <thead>
        <tr>
          <th v-for="column in resolved.columns" :key="column.field" :style="{ width: column.width }">
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in resolved.rows"
          :key="rowKey(row, index)"
          :class="{ clickable: hasRowClick }"
          @click="handleRowClick(row)"
        >
          <td v-for="column in resolved.columns" :key="column.field">
            <span v-if="column.format === 'status'" class="demo-tag" :class="statusClass(row[column.field])">
              {{ row[column.field] }}
            </span>
            <a v-else-if="column.format === 'link'" href="#" @click.prevent="handleRowClick(row)">
              {{ row[column.field] }}
            </a>
            <span v-else>{{ formatCell(row[column.field], column.format) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveTable } from "../resolver";
import type { UdsRecord, UdsScene, UdsSceneState, UdsTableView } from "../types";

const props = defineProps<{
  scene: UdsScene;
  view: UdsTableView;
  state: UdsSceneState;
}>();

const emit = defineEmits<{
  rowClick: [view: UdsTableView, row: UdsRecord];
}>();

const resolved = computed(() => resolveTable(props.scene, props.view.binding, props.state));
const hasRowClick = computed(() =>
  Boolean(props.view.interactions?.some((interaction) => interaction.event === "rowClick")),
);

const rowKey = (row: UdsRecord, index: number) =>
  String(row[props.view.binding.rowKey || resolved.value.dataset.primaryKey || "id"] ?? index);

const formatCell = (value: unknown, format?: string) => {
  if (format === "number" && typeof value === "number") return value.toLocaleString("zh-CN");
  if (format === "percent" && typeof value === "number") return `${value.toFixed(1)}%`;
  return String(value ?? "");
};

const statusClass = (value: unknown) => {
  const text = String(value ?? "");
  if (/高危|高负载|预警/.test(text)) return "danger";
  if (/关注|补短板|建设|论证/.test(text)) return "warn";
  return "";
};

const handleRowClick = (row: UdsRecord) => {
  if (hasRowClick.value) {
    emit("rowClick", props.view, row);
  }
};
</script>
