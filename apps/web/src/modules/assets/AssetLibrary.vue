<template>
  <section>
    <h1 class="page-title">资产库</h1>
    <p class="page-subtitle">截图、表格、JSON 和日志资产在这里统一编号和查询。</p>
    <el-card class="section-card">
      <el-table :data="assets" v-loading="loading">
        <el-table-column prop="assetCode" label="资产编号" width="260" />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="createdAt" label="创建时间" width="220" />
      </el-table>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { snapshotApi } from "@/services/api";

const assets = ref<any[]>([]);
const loading = ref(false);

const load = async () => {
  loading.value = true;
  try {
    assets.value = await snapshotApi.listAssets();
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
