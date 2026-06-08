<template>
  <section>
    <h1 class="page-title">采集工作台</h1>
    <p class="page-subtitle">面向工程化网页截图、结构化数据抓取和资产归档的单机控制台。</p>
    <div class="metric-grid">
      <el-card class="metric-card" v-for="item in metrics" :key="item.label">
        <div>{{ item.label }}</div>
        <div class="metric-value">{{ item.value }}</div>
      </el-card>
    </div>
    <el-card class="section-card">
      <template #header>首版主链路</template>
      <el-steps :active="2" finish-status="success">
        <el-step title="建立工程" description="工程编号、参数和资产根目录" />
        <el-step title="标记素材" description="DOM 截图区和结构化数据目标" />
        <el-step title="执行采集" description="外部 API 或控制台触发运行" />
        <el-step title="资产归档" description="统一编号、元数据和下载" />
      </el-steps>
    </el-card>
  </section>
</template>

<script setup lang="ts">
const metrics = [
  { label: "采集工程", value: "0" },
  { label: "业务系统", value: "0" },
  { label: "运行任务", value: "0" },
  { label: "资产数量", value: "0" },
];
</script>
