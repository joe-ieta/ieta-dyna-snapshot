export type UdsValue = string | number | boolean | null;
export type UdsRecord = Record<string, UdsValue>;

export type UdsFieldType =
  | "string"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "category"
  | "percent";

export type UdsViewType = "metrics" | "chart" | "table" | "text";
export type UdsChartKind = "line" | "bar" | "pie" | "gauge" | "treemap" | "scatter";
export type UdsAggregate = "sum" | "avg" | "count" | "max" | "min" | "first";

export interface UdsField {
  name: string;
  label: string;
  type: UdsFieldType;
  unit?: string;
  role?: "dimension" | "measure" | "status" | "link" | "geometry";
}

export interface UdsDataset {
  id: string;
  title: string;
  primaryKey?: string;
  fields: UdsField[];
  rows: UdsRecord[];
}

export interface UdsDatasetRef {
  dataset: string;
  field?: string;
}

export interface UdsAssociation {
  id: string;
  label?: string;
  source: Required<UdsDatasetRef>;
  target: Required<UdsDatasetRef>;
}

export interface UdsFilterOption {
  label: string;
  value: string;
}

export interface UdsFilter {
  id: string;
  label: string;
  dataset: string;
  field: string;
  type: "select" | "search";
  defaultValue?: string;
  options?: UdsFilterOption[];
}

export interface UdsMetricBinding {
  id: string;
  label: string;
  dataset: string;
  field?: string;
  aggregate: UdsAggregate;
  unit?: string;
  precision?: number;
  trendField?: string;
  statusField?: string;
  description?: string;
}

export interface UdsChartBinding {
  dataset: string;
  kind: UdsChartKind;
  dimension?: string;
  measures: string[];
  seriesField?: string;
  aggregate?: Exclude<UdsAggregate, "first">;
  titleField?: string;
  valueField?: string;
}

export interface UdsTableColumn {
  field: string;
  label?: string;
  width?: string;
  format?: "number" | "percent" | "status" | "link";
}

export interface UdsTableBinding {
  dataset: string;
  columns: UdsTableColumn[];
  rowKey?: string;
}

export interface UdsTextBinding {
  dataset?: string;
  template: string;
}

export interface UdsNavigateAction {
  type: "navigate";
  route: string;
}

export interface UdsSelectAction {
  type: "select";
  dataset: string;
  keyField: string;
}

export interface UdsSetFilterAction {
  type: "setFilter";
  filterId: string;
  valueField: string;
}

export type UdsAction = UdsNavigateAction | UdsSelectAction | UdsSetFilterAction;

export interface UdsInteraction {
  event: "rowClick" | "metricClick" | "pointClick";
  action: UdsAction;
}

export interface UdsViewBase {
  id: string;
  title: string;
  type: UdsViewType;
  description?: string;
  dataTestId?: string;
  span?: 1 | 2 | 3 | 4;
  interactions?: UdsInteraction[];
}

export interface UdsMetricsView extends UdsViewBase {
  type: "metrics";
  binding: {
    metrics: UdsMetricBinding[];
  };
}

export interface UdsChartView extends UdsViewBase {
  type: "chart";
  binding: UdsChartBinding;
}

export interface UdsTableView extends UdsViewBase {
  type: "table";
  binding: UdsTableBinding;
}

export interface UdsTextView extends UdsViewBase {
  type: "text";
  binding: UdsTextBinding;
}

export type UdsView = UdsMetricsView | UdsChartView | UdsTableView | UdsTextView;

export interface UdsScene {
  schemaVersion: "uds-demo-v1";
  id: string;
  title: string;
  subtitle?: string;
  domain: "local-monitor" | "smart-health" | "shared";
  dataNotice?: string;
  datasets: UdsDataset[];
  filters?: UdsFilter[];
  associations?: UdsAssociation[];
  views: UdsView[];
}

export type UdsFilterState = Record<string, string>;

export interface UdsSelection {
  dataset: string;
  keyField: string;
  keyValue: UdsValue;
  row: UdsRecord;
}

export interface UdsSceneState {
  filters: UdsFilterState;
  selection?: UdsSelection;
}

export interface UdsResolvedMetric {
  id: string;
  label: string;
  value: string;
  rawValue: number | string;
  unit?: string;
  trend?: string;
  status?: string;
  description?: string;
}
