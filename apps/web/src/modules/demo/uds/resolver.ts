import type {
  UdsAggregate,
  UdsChartBinding,
  UdsDataset,
  UdsField,
  UdsFilterState,
  UdsMetricBinding,
  UdsRecord,
  UdsResolvedMetric,
  UdsScene,
  UdsSceneState,
  UdsTableBinding,
  UdsTextBinding,
} from "./types";

export const getDataset = (scene: UdsScene, id: string): UdsDataset => {
  const dataset = scene.datasets.find((item) => item.id === id);
  if (!dataset) {
    throw new Error(`UDS dataset not found: ${id}`);
  }
  return dataset;
};

export const getField = (dataset: UdsDataset, name: string): UdsField | undefined =>
  dataset.fields.find((item) => item.name === name);

export const resolveRows = (
  scene: UdsScene,
  datasetId: string,
  state: UdsSceneState,
): UdsRecord[] => {
  const dataset = getDataset(scene, datasetId);
  let rows = dataset.rows;

  for (const filter of scene.filters || []) {
    const value = state.filters[filter.id];
    if (!value || value === "all" || filter.dataset !== datasetId) continue;
    if (filter.type === "search") {
      const normalized = value.toLowerCase();
      rows = rows.filter((row) => String(row[filter.field] ?? "").toLowerCase().includes(normalized));
    } else {
      rows = rows.filter((row) => String(row[filter.field] ?? "") === value);
    }
  }

  if (state.selection) {
    for (const association of scene.associations || []) {
      if (
        association.source.dataset === state.selection.dataset &&
        association.source.field === state.selection.keyField &&
        association.target.dataset === datasetId
      ) {
        rows = rows.filter((row) => row[association.target.field] === state.selection?.keyValue);
      }
    }
  }

  return rows;
};

export const initialFilterState = (scene: UdsScene): UdsFilterState =>
  Object.fromEntries((scene.filters || []).map((filter) => [filter.id, filter.defaultValue || "all"]));

export const aggregateRows = (
  rows: UdsRecord[],
  field: string | undefined,
  aggregate: UdsAggregate,
): number | string => {
  if (aggregate === "count") return rows.length;
  if (aggregate === "first") return String(rows[0]?.[field || ""] ?? "");
  const values = rows
    .map((row) => Number(row[field || ""]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  if (aggregate === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregate === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregate === "max") return Math.max(...values);
  if (aggregate === "min") return Math.min(...values);
  return 0;
};

export const formatValue = (
  value: number | string,
  field?: UdsField,
  precision = 0,
): string => {
  if (typeof value === "string") return value;
  if (field?.type === "percent") return `${(value * 100).toFixed(precision)}%`;
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  });
};

export const resolveMetrics = (
  scene: UdsScene,
  bindings: UdsMetricBinding[],
  state: UdsSceneState,
): UdsResolvedMetric[] =>
  bindings.map((binding) => {
    const dataset = getDataset(scene, binding.dataset);
    const rows = resolveRows(scene, binding.dataset, state);
    const field = binding.field ? getField(dataset, binding.field) : undefined;
    const rawValue = aggregateRows(rows, binding.field, binding.aggregate);
    const status = binding.statusField ? String(rows[0]?.[binding.statusField] ?? "") : undefined;
    const trend = binding.trendField ? String(rows[0]?.[binding.trendField] ?? "") : undefined;

    return {
      id: binding.id,
      label: binding.label,
      value: formatValue(rawValue, field, binding.precision ?? 0),
      rawValue,
      unit: binding.unit || field?.unit,
      trend,
      status,
      description: binding.description,
    };
  });

const groupBy = (rows: UdsRecord[], field: string) => {
  const grouped = new Map<string, UdsRecord[]>();
  for (const row of rows) {
    const key = String(row[field] ?? "");
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return grouped;
};

const numberValue = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const aggregateMeasure = (rows: UdsRecord[], measure: string, aggregate: Exclude<UdsAggregate, "first"> = "sum") => {
  const values = rows.map((row) => numberValue(row[measure]));
  if (aggregate === "count") return rows.length;
  if (!values.length) return 0;
  if (aggregate === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregate === "max") return Math.max(...values);
  if (aggregate === "min") return Math.min(...values);
  return values.reduce((sum, value) => sum + value, 0);
};

export const resolveChartOption = (
  scene: UdsScene,
  binding: UdsChartBinding,
  state: UdsSceneState,
) => {
  const dataset = getDataset(scene, binding.dataset);
  const rows = resolveRows(scene, binding.dataset, state);
  const measure = binding.measures[0];
  const dimension = binding.dimension || dataset.primaryKey || dataset.fields[0]?.name;
  const colorText = "#d9e6eb";
  const grid = { top: 34, right: 18, bottom: 32, left: 48 };

  if (binding.kind === "gauge") {
    const value = Number(aggregateRows(rows, measure, binding.aggregate || "avg"));
    return {
      tooltip: { formatter: "{b}: {c}" },
      series: [{
        type: "gauge",
        min: 0,
        max: 100,
        progress: { show: true, width: 10 },
        axisLine: { lineStyle: { width: 10 } },
        detail: { color: colorText, formatter: "{value}" },
        data: [{ value: Number(value.toFixed(1)), name: getField(dataset, measure)?.label || measure }],
      }],
    };
  }

  if (binding.kind === "pie") {
    const grouped = groupBy(rows, dimension);
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: colorText } },
      series: [{
        type: "pie",
        radius: ["42%", "70%"],
        data: Array.from(grouped.entries()).map(([name, groupRows]) => ({
          name,
          value: aggregateMeasure(groupRows, measure, binding.aggregate || "sum"),
        })),
      }],
    };
  }

  if (binding.kind === "treemap") {
    return {
      tooltip: { trigger: "item" },
      series: [{
        type: "treemap",
        roam: false,
        breadcrumb: { show: false },
        label: { color: "#102027" },
        data: rows.map((row) => ({
          name: String(row[dimension] ?? ""),
          value: numberValue(row[measure]),
        })),
      }],
    };
  }

  if (binding.kind === "scatter") {
    const secondMeasure = binding.measures[1] || measure;
    return {
      tooltip: { trigger: "item" },
      grid,
      xAxis: { name: getField(dataset, measure)?.label || measure, axisLabel: { color: colorText } },
      yAxis: { name: getField(dataset, secondMeasure)?.label || secondMeasure, axisLabel: { color: colorText } },
      series: [{
        type: "scatter",
        symbolSize: 12,
        data: rows.map((row) => [numberValue(row[measure]), numberValue(row[secondMeasure]), row[dimension]]),
      }],
    };
  }

  const grouped = groupBy(rows, dimension);
  const categories = Array.from(grouped.keys());
  return {
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: colorText } },
    grid,
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: colorText },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: colorText },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: binding.measures.map((item) => ({
      name: getField(dataset, item)?.label || item,
      type: binding.kind,
      smooth: binding.kind === "line",
      data: categories.map((category) =>
        aggregateMeasure(grouped.get(category) || [], item, binding.aggregate || "sum"),
      ),
    })),
  };
};

export const resolveTable = (
  scene: UdsScene,
  binding: UdsTableBinding,
  state: UdsSceneState,
) => {
  const dataset = getDataset(scene, binding.dataset);
  return {
    dataset,
    rows: resolveRows(scene, binding.dataset, state),
    columns: binding.columns.map((column) => ({
      ...column,
      label: column.label || getField(dataset, column.field)?.label || column.field,
    })),
  };
};

export const resolveText = (
  scene: UdsScene,
  binding: UdsTextBinding,
  state: UdsSceneState,
) => {
  const rows = binding.dataset ? resolveRows(scene, binding.dataset, state) : [];
  const first = rows[0] || {};
  return binding.template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_, key: string) =>
    String(first[key] ?? ""),
  );
};

export const applyRouteTemplate = (template: string, row: UdsRecord) =>
  template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, key: string) => encodeURIComponent(String(row[key] ?? "")));
