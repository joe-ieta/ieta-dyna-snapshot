<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">资产库</h1>
        <p class="page-subtitle">统一查看截图、表格 JSON 和 CSV 资产，支持预览结构化内容与下载文件。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-card class="section-card toolbar-card">
      <el-input v-model="runIdFilter" clearable placeholder="按运行 ID 过滤" />
      <el-button type="primary" @click="load">查询</el-button>
    </el-card>

    <el-card class="section-card">
      <el-table :data="assets" v-loading="loading" row-key="id">
        <el-table-column prop="assetCode" label="资产编号" min-width="260" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="contentType" label="内容类型" width="160" />
        <el-table-column prop="title" label="标题" min-width="180" />
        <el-table-column prop="sourceUrl" label="来源页面" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="190">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="preview(row)">预览</el-button>
            <el-button link type="primary" @click="download(row)">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="previewVisible" title="资产预览" size="64%" @closed="clearPreview">
      <template v-if="previewAsset">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="资产编号">{{ previewAsset.assetCode }}</el-descriptions-item>
          <el-descriptions-item label="内容类型">{{ previewAsset.contentType }}</el-descriptions-item>
          <el-descriptions-item label="Step ID">{{ previewAsset.stepId }}</el-descriptions-item>
          <el-descriptions-item label="Hash">{{ previewAsset.contentHash }}</el-descriptions-item>
        </el-descriptions>

        <div class="asset-preview">
          <img v-if="previewUrl" :src="previewUrl" alt="asset preview" />
          <pre v-else class="json-preview">{{ previewText }}</pre>
        </div>
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { AssetSummary } from "@ieta-dyna-snapshot/shared";
import { saveBlob, snapshotApi } from "@/services/api";

const assets = ref<AssetSummary[]>([]);
const loading = ref(false);
const runIdFilter = ref("");
const previewVisible = ref(false);
const previewAsset = ref<AssetSummary | null>(null);
const previewText = ref("");
const previewUrl = ref("");

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "");

const extensionFor = (asset: AssetSummary) => {
  if (asset.contentType === "image/png") return "png";
  if (asset.contentType === "application/json") return "json";
  if (asset.contentType === "text/csv") return "csv";
  return "bin";
};

const load = async () => {
  loading.value = true;
  try {
    assets.value = await snapshotApi.listAssets(runIdFilter.value.trim() || undefined);
  } finally {
    loading.value = false;
  }
};

const preview = async (asset: AssetSummary) => {
  try {
    clearPreview();
    previewAsset.value = asset;
    if (asset.contentType.startsWith("image/")) {
      const blob = await snapshotApi.downloadAsset(asset.id);
      previewUrl.value = URL.createObjectURL(blob);
    } else {
      const content = await snapshotApi.getAssetContent(asset.id);
      previewText.value =
        typeof content === "string" ? content : JSON.stringify(content, null, 2);
    }
    previewVisible.value = true;
  } catch (error: any) {
    ElMessage.error(error.message || "预览失败");
  }
};

const clearPreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  previewText.value = "";
};

const download = async (asset: AssetSummary) => {
  const blob = await snapshotApi.downloadAsset(asset.id);
  saveBlob(blob, `${asset.assetCode}.${extensionFor(asset)}`);
};

onMounted(load);
</script>
