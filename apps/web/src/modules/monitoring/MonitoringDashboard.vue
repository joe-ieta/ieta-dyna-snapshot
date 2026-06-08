<template>
  <section>
    <h1 class="page-title">监控</h1>
    <p class="page-subtitle">查看服务健康、运行状态和后续采集 Worker 指标。</p>
    <el-card class="section-card">
      <el-result
        :icon="appStore.isHealthy ? 'success' : 'warning'"
        :title="appStore.isHealthy ? '服务正常' : '服务状态未知'"
        :sub-title="`最近检查：${appStore.systemHealth.lastCheck || '-'}`"
      />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
</script>
