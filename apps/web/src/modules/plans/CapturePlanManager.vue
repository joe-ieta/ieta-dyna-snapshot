<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">采集计划</h1>
        <p class="page-subtitle">用 JSON 维护可执行步骤。当前阶段支持手写计划，后续 DOM 标记器会生成同样格式。</p>
      </div>
      <el-button type="primary" :disabled="!selectedProjectId || systems.length === 0" @click="openCreate">新建计划</el-button>
    </div>

    <el-card class="section-card toolbar-card">
      <el-select v-model="selectedProjectId" placeholder="选择工程" filterable @change="loadForProject">
        <el-option v-for="project in projects" :key="project.id" :label="`${project.code} - ${project.name}`" :value="project.id" />
      </el-select>
      <el-button @click="loadAll">刷新</el-button>
    </el-card>

    <el-card class="section-card">
      <el-table :data="plans" v-loading="loading" row-key="id">
        <el-table-column prop="code" label="计划编号" width="180" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column label="业务系统" min-width="180">
          <template #default="{ row }">{{ systemName(row.externalSystemId) }}</template>
        </el-table-column>
        <el-table-column label="步骤" width="90">
          <template #default="{ row }">
            <el-tag>{{ row.steps?.length || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="参数" width="90">
          <template #default="{ row }">
            <el-tag>{{ row.inputSchema?.length || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑采集计划' : '新建采集计划'" width="900px">
      <el-form label-position="top">
        <div class="form-grid two">
          <el-form-item label="计划编号">
            <el-input v-model="form.code" :disabled="!!editingId" placeholder="SALES_DAILY" />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="form.name" placeholder="销售日报看板" />
          </el-form-item>
        </div>
        <div class="form-grid two">
          <el-form-item label="业务系统">
            <el-select v-model="form.externalSystemId" :disabled="!!editingId" filterable>
              <el-option v-for="system in systems" :key="system.id" :label="`${system.code} - ${system.name}`" :value="system.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </div>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="步骤 JSON">
          <el-input v-model="stepsText" type="textarea" :rows="13" spellcheck="false" />
        </el-form-item>
        <el-form-item label="输入参数 JSON">
          <el-input v-model="inputSchemaText" type="textarea" :rows="7" spellcheck="false" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="insertExample">填入示例</el-button>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { CapturePlanSummary, ExternalSystemSummary, ProjectSummary } from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const systems = ref<ExternalSystemSummary[]>([]);
const plans = ref<CapturePlanSummary[]>([]);
const selectedProjectId = ref("");
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref("");
const stepsText = ref("[]");
const inputSchemaText = ref("[]");
const form = reactive({
  code: "",
  name: "",
  description: "",
  externalSystemId: "",
  enabled: true,
});

const parseJsonArray = (value: string, label: string) => {
  const parsed = JSON.parse(value || "[]");
  if (!Array.isArray(parsed)) throw new Error(`${label} 必须是 JSON 数组`);
  return parsed as Record<string, unknown>[];
};

const systemName = (id: string) => {
  const system = systems.value.find((item) => item.id === id);
  return system ? `${system.code} - ${system.name}` : id;
};

const loadProjects = async () => {
  projects.value = await snapshotApi.listProjects();
  selectedProjectId.value ||= projects.value[0]?.id || "";
};

const loadForProject = async () => {
  if (!selectedProjectId.value) {
    systems.value = [];
    plans.value = [];
    return;
  }
  loading.value = true;
  try {
    const [nextSystems, nextPlans] = await Promise.all([
      snapshotApi.listSystems(selectedProjectId.value),
      snapshotApi.listPlans(selectedProjectId.value),
    ]);
    systems.value = nextSystems;
    plans.value = nextPlans;
  } finally {
    loading.value = false;
  }
};

const loadAll = async () => {
  await loadProjects();
  await loadForProject();
};

const resetForm = () => {
  editingId.value = "";
  form.code = "";
  form.name = "";
  form.description = "";
  form.externalSystemId = systems.value[0]?.id || "";
  form.enabled = true;
  stepsText.value = "[]";
  inputSchemaText.value = "[]";
};

const openCreate = () => {
  resetForm();
  dialogVisible.value = true;
};

const openEdit = (plan: CapturePlanSummary) => {
  editingId.value = plan.id;
  form.code = plan.code;
  form.name = plan.name;
  form.description = plan.description || "";
  form.externalSystemId = plan.externalSystemId;
  form.enabled = plan.enabled;
  stepsText.value = JSON.stringify(plan.steps || [], null, 2);
  inputSchemaText.value = JSON.stringify(plan.inputSchema || [], null, 2);
  dialogVisible.value = true;
};

const insertExample = () => {
  stepsText.value = JSON.stringify([
    { id: "open", name: "打开页面", type: "goto", url: "/" },
    { id: "wait-main", name: "等待主体", type: "waitForSelector", selector: "body" },
    { id: "capture-page", name: "页面截图", type: "screenshotPage", fullPage: true },
  ], null, 2);
  inputSchemaText.value = JSON.stringify([], null, 2);
};

const submit = async () => {
  try {
    saving.value = true;
    const steps = parseJsonArray(stepsText.value, "步骤");
    const inputSchema = parseJsonArray(inputSchemaText.value, "输入参数");
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      steps,
      inputSchema,
      enabled: form.enabled,
    };
    if (editingId.value) {
      await snapshotApi.updatePlan(editingId.value, payload);
    } else {
      await snapshotApi.createPlan({
        ...payload,
        projectId: selectedProjectId.value,
        externalSystemId: form.externalSystemId,
        code: form.code.trim(),
      });
    }
    ElMessage.success("采集计划已保存");
    dialogVisible.value = false;
    await loadForProject();
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(loadAll);
</script>
