<template>
  <section>
    <h1 class="page-title">运行任务</h1>
    <p class="page-subtitle">外部系统或控制台可以按工程编号触发采集运行。</p>
    <el-card class="section-card">
      <el-table :data="runs" v-loading="loading">
        <el-table-column prop="id" label="运行 ID" width="260" />
        <el-table-column prop="status" label="状态" width="160" />
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="createdAt" label="创建时间" />
      </el-table>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { snapshotApi } from "@/services/api";

const runs = ref<any[]>([]);
const loading = ref(false);

const load = async () => {
  loading.value = true;
  try {
    runs.value = await snapshotApi.listRuns();
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
