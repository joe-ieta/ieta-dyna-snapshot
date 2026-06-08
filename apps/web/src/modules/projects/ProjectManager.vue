<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">采集工程</h1>
        <p class="page-subtitle">工程负责统一资产路径、默认参数和对外触发时使用的工程编号。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建工程</el-button>
    </div>

    <el-card class="section-card">
      <el-table :data="projects" v-loading="loading" row-key="id">
        <el-table-column prop="code" label="工程编号" width="180" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="assetRoot" label="资产目录" min-width="280" show-overflow-tooltip />
        <el-table-column label="默认参数" width="110">
          <template #default="{ row }">
            <el-tag>{{ Object.keys(row.defaultParameters || {}).length }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="190">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑工程' : '新建工程'" width="680px">
      <el-form label-position="top">
        <div class="form-grid two">
          <el-form-item label="工程编号">
            <el-input v-model="form.code" :disabled="!!editingId" placeholder="OPS_REPORT" />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="form.name" placeholder="运营日报素材采集" />
          </el-form-item>
        </div>
        <el-form-item label="资产根目录">
          <el-input v-model="form.assetRoot" placeholder="留空时使用 data/assets/{工程编号}" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="默认参数 JSON">
          <el-input v-model="defaultParametersText" type="textarea" :rows="6" spellcheck="false" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { ProjectSummary } from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref("");
const defaultParametersText = ref("{}");
const form = reactive({
  code: "",
  name: "",
  description: "",
  assetRoot: "",
});

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "");

const parseJsonObject = (value: string) => {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("默认参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
};

const load = async () => {
  loading.value = true;
  try {
    projects.value = await snapshotApi.listProjects();
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editingId.value = "";
  form.code = "";
  form.name = "";
  form.description = "";
  form.assetRoot = "";
  defaultParametersText.value = "{}";
  dialogVisible.value = true;
};

const openEdit = (project: ProjectSummary) => {
  editingId.value = project.id;
  form.code = project.code;
  form.name = project.name;
  form.description = project.description || "";
  form.assetRoot = project.assetRoot || "";
  defaultParametersText.value = JSON.stringify(project.defaultParameters || {}, null, 2);
  dialogVisible.value = true;
};

const submit = async () => {
  try {
    saving.value = true;
    const defaultParameters = parseJsonObject(defaultParametersText.value);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      assetRoot: form.assetRoot.trim() || undefined,
      defaultParameters,
    };
    if (editingId.value) {
      await snapshotApi.updateProject(editingId.value, payload);
    } else {
      await snapshotApi.createProject({ ...payload, code: form.code.trim() });
    }
    ElMessage.success("工程已保存");
    dialogVisible.value = false;
    await load();
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>
