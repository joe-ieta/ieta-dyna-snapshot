import { use, registerMap } from "echarts/core";
import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  MapChart,
  PieChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  DatasetComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

let registered = false;

export const registerDemoCharts = () => {
  if (registered) return;
  use([
    BarChart,
    CanvasRenderer,
    DataZoomComponent,
    DatasetComponent,
    GaugeChart,
    GeoComponent,
    GridComponent,
    HeatmapChart,
    LegendComponent,
    LineChart,
    MapChart,
    MarkLineComponent,
    PieChart,
    RadarChart,
    ScatterChart,
    TitleComponent,
    TooltipComponent,
    TreemapChart,
    VisualMapComponent,
  ]);
  registered = true;
};

export const registerMapSource = (name: string, source: Parameters<typeof registerMap>[1]) => {
  registerDemoCharts();
  registerMap(name, source);
};

export type DemoChartOption = Record<string, unknown>;
