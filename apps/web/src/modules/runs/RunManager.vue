<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">运行任务</h1>
        <p class="page-subtitle">按工程编号和计划编号触发真实采集，查看步骤状态、输入快照和生成资产。</p>
      </div>
      <el-button @click="loadAll">刷新</el-button>
    </div>

    <el-card class="section-card">
      <el-form label-position="top">
        <div class="form-grid three">
          <el-form-item label="工程">
            <el-select v-model="selectedProjectId" filterable @change="loadForProject">
              <el-option v-for="project in projects" :key="project.id" :label="`${project.code} - ${project.name}`" :value="project.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="计划">
            <el-select v-model="selectedPlanCodes" multiple collapse-tags collapse-tags-tooltip filterable>
              <el-option v-for="plan in plans" :key="plan.id" :label="`${plan.code} - ${plan.name}`" :value="plan.code" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作">
            <el-button type="primary" :loading="triggering" :disabled="!selectedProject" @click="trigger">触发采集</el-button>
          </el-form-item>
        </div>
        <el-form-item label="运行参数 JSON">
          <el-input v-model="parametersText" type="textarea" :rows="5" spellcheck="false" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="section-card">
      <el-table :data="runs" v-loading="loading" row-key="id">
        <el-table-column prop="id" label="运行 ID" width="290" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestedPlanCodes" label="计划" min-width="180">
          <template #default="{ row }">{{ row.requestedPlanCodes?.join(", ") }}</template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="190">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" title="运行详情" size="70%">
      <template v-if="currentRun">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="运行 ID">{{ currentRun.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType(currentRun.status)">{{ currentRun.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatDate(currentRun.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ formatDate(currentRun.finishedAt) }}</el-descriptions-item>
          <el-descriptions-item label="错误码">{{ currentRun.errorCode || "-" }}</el-descriptions-item>
          <el-descriptions-item label="错误信息">{{ currentRun.errorMessage || "-" }}</el-descriptions-item>
        </el-descriptions>

        <h2 class="panel-title">输入快照</h2>
        <pre class="json-preview">{{ JSON.stringify(currentRun.inputSnapshot || {}, null, 2) }}</pre>

        <h2 class="panel-title">步骤</h2>
        <el-table :data="runSteps" size="small" row-key="id">
          <el-table-column prop="sequence" label="#" width="70" />
          <el-table-column prop="stepId" label="步骤 ID" min-width="160" />
          <el-table-column prop="stepName" label="名称" min-width="160" />
          <el-table-column prop="stepType" label="类型" width="150" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="消息" min-width="220" show-overflow-tooltip />
        </el-table>

        <h2 class="panel-title">资产</h2>
        <el-table :data="runAssets" size="small" row-key="id">
          <el-table-column prop="assetCode" label="资产编号" min-width="240" />
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="contentType" label="内容类型" width="160" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button link type="primary" @click="download(row)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { AssetSummary, CapturePlanSummary, CaptureRunSummary, ProjectSummary, RunStepSummary } from "@ieta-dyna-snapshot/shared";
import { saveBlob, snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const plans = ref<CapturePlanSummary[]>([]);
const runs = ref<CaptureRunSummary[]>([]);
const runSteps = ref<RunStepSummary[]>([]);
const runAssets = ref<AssetSummary[]>([]);
const selectedProjectId = ref("");
const selectedPlanCodes = ref<string[]>([]);
const parametersText = ref("{}");
const loading = ref(false);
const triggering = ref(false);
const detailVisible = ref(false);
const currentRun = ref<CaptureRunSummary | null>(null);

const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value));

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "-");
const statusType = (status: string) => {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "info";
};

const loadProjects = async () => {
  projects.value = await snapshotApi.listProjects();
  selectedProjectId.value ||= projects.value[0]?.id || "";
};

const loadForProject = async () => {
  loading.value = true;
  try {
    const [nextPlans, nextRuns] = await Promise.all([
      snapshotApi.listPlans(selectedProjectId.value || undefined),
      snapshotApi.listRuns(selectedProjectId.value || undefined),
    ]);
    plans.value = nextPlans.filter((plan) => plan.enabled);
    runs.value = nextRuns;
    selectedPlanCodes.value = selectedPlanCodes.value.filter((code) =>
      plans.value.some((plan) => plan.code === code),
    );
  } finally {
    loading.value = false;
  }
};

const loadAll = async () => {
  await loadProjects();
  await loadForProject();
};

const parseParameters = () => {
  const parsed = JSON.parse(parametersText.value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("运行参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
};

const trigger = async () => {
  if (!selectedProject.value) return;
  try {
    triggering.value = true;
    const run = await snapshotApi.triggerRun({
      projectCode: selectedProject.value.code,
      planCodes: selectedPlanCodes.value.length ? selectedPlanCodes.value : undefined,
      parameters: parseParameters(),
      source: "manual",
    });
    ElMessage.success(`采集完成：${run.status}`);
    await loadForProject();
    await openDetail(run.id);
  } catch (error: any) {
    ElMessage.error(error.message || "触发失败");
  } finally {
    triggering.value = false;
  }
};

const openDetail = async (runId: string) => {
  const [run, steps, assets] = await Promise.all([
    snapshotApi.getRun(runId),
    snapshotApi.listRunSteps(runId),
    snapshotApi.listAssets(runId),
  ]);
  currentRun.value = run;
  runSteps.value = steps;
  runAssets.value = assets;
  detailVisible.value = true;
};

const extensionFor = (asset: AssetSummary) => {
  if (asset.contentType === "image/png") return "png";
  if (asset.contentType === "application/json") return "json";
  if (asset.contentType === "text/csv") return "csv";
  return "bin";
};

const download = async (asset: AssetSummary) => {
  const blob = await snapshotApi.downloadAsset(asset.id);
  saveBlob(blob, `${asset.assetCode}.${extensionFor(asset)}`);
};

onMounted(loadAll);
</script>
