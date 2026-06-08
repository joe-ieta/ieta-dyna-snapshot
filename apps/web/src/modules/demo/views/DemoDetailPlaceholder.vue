<template>
  <main class="demo-screen">
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
      <div class="demo-breadcrumb">
        <RouterLink to="/demo">演示入口</RouterLink>
        <span>/</span>
        <RouterLink :to="backPath">{{ systemName }}</RouterLink>
        <span>/</span>
        <span>明细</span>
      </div>

      <div class="demo-grid two">
        <section class="demo-panel" data-testid="uds-detail-summary">
          <div class="demo-panel-header">
            <h1 class="demo-panel-title">{{ title }}</h1>
            <span class="demo-tag">UDS drilldown</span>
          </div>
          <p class="demo-analysis">
            当前页用于承接 UDS 表格行点击后的外部关联与三级下钻。
            后续会继续以 UDS Scene 描述明细数据集、筛选条件、图表和表格。
          </p>
        </section>

        <section class="demo-panel">
          <div class="demo-panel-header">
            <h2 class="demo-panel-title">路由参数</h2>
            <span class="demo-tag warn">模拟</span>
          </div>
          <table class="demo-data-table" data-testid="table-uds-route-params">
            <thead>
              <tr>
                <th>参数</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(value, key) in route.params" :key="String(key)">
                <td>{{ key }}</td>
                <td>{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <span class="demo-ready" data-testid="page-ready">ready</span>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import "../demo.css";

const props = defineProps<{
  system: "local-monitor" | "smart-health";
}>();

const route = useRoute();
const systemName = computed(() => props.system === "local-monitor" ? "本机资源监测" : "海上市智慧医疗");
const backPath = computed(() => props.system === "local-monitor" ? "/demo/local-monitor" : "/demo/smart-health");
const title = computed(() => props.system === "local-monitor" ? "磁盘与文件系统明细" : "区级医疗资源明细");
</script>
