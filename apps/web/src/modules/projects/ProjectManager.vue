<template>
  <section>
    <h1 class="page-title">采集工程</h1>
    <p class="page-subtitle">工程是截图路径、运行参数和资产编号的管理边界。</p>
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <span>工程列表</span>
          <el-button type="primary" @click="createDemo">创建示例工程</el-button>
        </div>
      </template>
      <el-table :data="projects" v-loading="loading">
        <el-table-column prop="code" label="工程编号" width="180" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="assetRoot" label="资产目录" />
        <el-table-column prop="updatedAt" label="更新时间" width="220" />
      </el-table>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { ProjectSummary } from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const loading = ref(false);

const load = async () => {
  loading.value = true;
  try {
    projects.value = await snapshotApi.listProjects();
  } finally {
    loading.value = false;
  }
};

const createDemo = async () => {
  await snapshotApi.createProject({
    code: `DEMO-${Date.now()}`,
    name: "示例采集工程",
    description: "用于验证基础框架的示例工程",
  });
  ElMessage.success("示例工程已创建");
  await load();
};

onMounted(load);
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
