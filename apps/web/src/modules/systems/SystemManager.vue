<template>
  <section>
    <div class="page-heading">
      <div>
        <h1 class="page-title">业务系统</h1>
        <p class="page-subtitle">维护目标网页系统、基础地址、登录入口和可复用浏览器会话。</p>
      </div>
      <el-button type="primary" :disabled="!selectedProjectId" @click="openCreate">新建系统</el-button>
    </div>

    <el-card class="section-card toolbar-card">
      <el-select v-model="selectedProjectId" placeholder="选择工程" filterable @change="loadSystems">
        <el-option
          v-for="project in projects"
          :key="project.id"
          :label="`${project.code} - ${project.name}`"
          :value="project.id"
        />
      </el-select>
      <el-button @click="loadAll">刷新</el-button>
    </el-card>

    <el-card class="section-card">
      <el-table :data="systems" v-loading="loading" row-key="id">
        <el-table-column prop="code" label="系统编号" width="150" />
        <el-table-column prop="name" label="名称" min-width="170" />
        <el-table-column prop="baseUrl" label="基础地址" min-width="230" show-overflow-tooltip />
        <el-table-column label="会话" width="130">
          <template #default="{ row }">
            <el-tag :type="sessionTag(row.id)">
              {{ sessionText(row.id) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Profile" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ sessionStatuses[row.id]?.profilePath || row.browserProfileId }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openLogin(row)">打开登录</el-button>
            <el-button link type="primary" @click="refreshSession(row)">检查</el-button>
            <el-button link type="warning" @click="clearSession(row)">清理</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑业务系统' : '新建业务系统'" width="820px">
      <el-form label-position="top">
        <div class="form-grid two">
          <el-form-item label="系统编号">
            <el-input v-model="form.code" :disabled="!!editingId" placeholder="ERP" />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="form.name" placeholder="ERP 数据看板" />
          </el-form-item>
        </div>
        <el-form-item label="基础地址">
          <el-input v-model="form.baseUrl" placeholder="https://example.local/" />
        </el-form-item>
        <el-form-item label="登录地址">
          <el-input v-model="form.loginUrl" placeholder="可选，例如 https://example.local/login" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="浏览器 Profile 标识">
          <el-input v-model="form.browserProfileId" placeholder="留空时自动使用 {projectCode}/{systemCode}" />
        </el-form-item>
        <el-form-item label="会话策略 JSON">
          <el-input v-model="sessionPolicyText" type="textarea" :rows="9" spellcheck="false" />
        </el-form-item>
        <el-alert
          show-icon
          type="info"
          :closable="false"
          title="配置 loginCheck 后，自动采集会在运行前验证会话；验证失败时 run 会以 LOGIN_REQUIRED 失败。"
        />
      </el-form>
      <template #footer>
        <el-button @click="insertPolicyExample">填入检查示例</el-button>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type {
  BrowserSessionStatus,
  ExternalSystemSummary,
  ProjectSummary,
} from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const systems = ref<ExternalSystemSummary[]>([]);
const sessionStatuses = reactive<Record<string, BrowserSessionStatus>>({});
const selectedProjectId = ref("");
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref("");
const sessionPolicyText = ref("{}");
const form = reactive({
  code: "",
  name: "",
  baseUrl: "",
  loginUrl: "",
  browserProfileId: "",
});

const parseJsonObject = (value: string) => {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("会话策略必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
};

const sessionText = (systemId: string) => {
  const status = sessionStatuses[systemId];
  if (!status) return "未知";
  if (status.loginState === "valid") return "已登录";
  if (status.loginState === "invalid") return "需登录";
  if (status.active) return "已打开";
  if (status.profileExists) return "有会话";
  if (status.loginState === "not_configured") return "未配置";
  return "未知";
};

const sessionTag = (systemId: string) => {
  const status = sessionStatuses[systemId];
  if (!status) return "info";
  if (status.loginState === "valid") return "success";
  if (status.loginState === "invalid") return "danger";
  if (status.active || status.profileExists) return "warning";
  return "info";
};

const loadProjects = async () => {
  projects.value = await snapshotApi.listProjects();
  selectedProjectId.value ||= projects.value[0]?.id || "";
};

const loadSessionStatuses = async () => {
  await Promise.all(
    systems.value.map(async (system) => {
      sessionStatuses[system.id] = await snapshotApi.getSystemSession(system.id);
    }),
  );
};

const loadSystems = async () => {
  loading.value = true;
  try {
    systems.value = await snapshotApi.listSystems(selectedProjectId.value || undefined);
    await loadSessionStatuses();
  } finally {
    loading.value = false;
  }
};

const loadAll = async () => {
  await loadProjects();
  await loadSystems();
};

const openCreate = () => {
  editingId.value = "";
  form.code = "";
  form.name = "";
  form.baseUrl = "";
  form.loginUrl = "";
  form.browserProfileId = "";
  sessionPolicyText.value = "{}";
  dialogVisible.value = true;
};

const openEdit = (system: ExternalSystemSummary) => {
  editingId.value = system.id;
  form.code = system.code;
  form.name = system.name;
  form.baseUrl = system.baseUrl;
  form.loginUrl = system.loginUrl || "";
  form.browserProfileId = system.browserProfileId || "";
  sessionPolicyText.value = JSON.stringify(system.sessionPolicy || {}, null, 2);
  dialogVisible.value = true;
};

const insertPolicyExample = () => {
  sessionPolicyText.value = JSON.stringify(
    {
      loginCheck: {
        selector: ".user-avatar",
        text: "",
        timeoutMs: 5000,
      },
    },
    null,
    2,
  );
};

const submit = async () => {
  try {
    saving.value = true;
    const sessionPolicy = parseJsonObject(sessionPolicyText.value);
    if (editingId.value) {
      await snapshotApi.updateSystem(editingId.value, {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        loginUrl: form.loginUrl.trim() || undefined,
        sessionPolicy,
      });
    } else {
      await snapshotApi.createSystem({
        projectId: selectedProjectId.value,
        code: form.code.trim(),
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        loginUrl: form.loginUrl.trim() || undefined,
        browserProfileId: form.browserProfileId.trim() || undefined,
        sessionPolicy,
      });
    }
    ElMessage.success("业务系统已保存");
    dialogVisible.value = false;
    await loadSystems();
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

const openLogin = async (system: ExternalSystemSummary) => {
  try {
    sessionStatuses[system.id] = await snapshotApi.openSystemSession(system.id);
    ElMessage.success("已打开浏览器会话，请在弹出的浏览器中完成登录");
  } catch (error: any) {
    ElMessage.error(error.message || "打开会话失败");
  }
};

const refreshSession = async (system: ExternalSystemSummary) => {
  try {
    sessionStatuses[system.id] = await snapshotApi.refreshSystemSession(system.id);
    const status = sessionStatuses[system.id];
    ElMessage({
      type: status.loginState === "valid" ? "success" : "warning",
      message: status.message || `会话状态：${sessionText(system.id)}`,
    });
  } catch (error: any) {
    ElMessage.error(error.message || "检查会话失败");
  }
};

const clearSession = async (system: ExternalSystemSummary) => {
  try {
    await ElMessageBox.confirm("将关闭当前浏览器会话并删除本系统的 Profile 数据。", "清理会话", {
      type: "warning",
    });
    sessionStatuses[system.id] = await snapshotApi.clearSystemSession(system.id);
    ElMessage.success("会话已清理");
  } catch (error: any) {
    if (error !== "cancel") ElMessage.error(error.message || "清理会话失败");
  }
};

onMounted(loadAll);
</script>
