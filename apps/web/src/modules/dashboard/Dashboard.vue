<template>
  <section>
    <h1 class="page-title">采集工作台</h1>
    <p class="page-subtitle">面向工程化网页截图、结构化数据抓取和资产归档的单机控制台。</p>

    <div class="metric-grid">
      <el-card class="metric-card" v-for="item in metrics" :key="item.label" v-loading="loading">
        <div>{{ item.label }}</div>
        <div class="metric-value">{{ item.value }}</div>
      </el-card>
    </div>

    <el-card class="section-card">
      <template #header>当前可用主链路</template>
      <el-steps :active="4" finish-status="success">
        <el-step title="建立工程" description="工程编号、默认参数和资产根目录" />
        <el-step title="维护系统" description="目标网站基础地址和登录入口" />
        <el-step title="编辑计划" description="手写 JSON 步骤和输入参数" />
        <el-step title="执行采集" description="生成截图、JSON 和 CSV 资产" />
      </el-steps>
    </el-card>

    <el-card class="section-card">
      <template #header>最近运行</template>
      <el-table :data="recentRuns" size="small">
        <el-table-column prop="id" label="运行 ID" min-width="260" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'succeeded' ? 'success' : row.status === 'failed' ? 'danger' : 'info'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="190">
          <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString() : "" }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { CaptureRunSummary } from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const loading = ref(false);
const counts = ref({ projects: 0, systems: 0, plans: 0, runs: 0, assets: 0 });
const recentRuns = ref<CaptureRunSummary[]>([]);

const metrics = computed(() => [
  { label: "采集工程", value: counts.value.projects },
  { label: "业务系统", value: counts.value.systems },
  { label: "采集计划", value: counts.value.plans },
  { label: "资产数量", value: counts.value.assets },
]);

const load = async () => {
  loading.value = true;
  try {
    const [projects, systems, plans, runs, assets] = await Promise.all([
      snapshotApi.listProjects(),
      snapshotApi.listSystems(),
      snapshotApi.listPlans(),
      snapshotApi.listRuns(),
      snapshotApi.listAssets(),
    ]);
    counts.value = {
      projects: projects.length,
      systems: systems.length,
      plans: plans.length,
      runs: runs.length,
      assets: assets.length,
    };
    recentRuns.value = runs.slice(0, 8);
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
