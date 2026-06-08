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
        <el-table-column label="DOM" width="110">
          <template #default="{ row }">
            <el-tag :type="markingStatuses[row.id]?.active ? 'success' : 'info'">
              {{ markingStatuses[row.id]?.selectionCount || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="390" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openLogin(row)">打开登录</el-button>
            <el-button link type="primary" @click="refreshSession(row)">检查</el-button>
            <el-button link type="success" @click="openMarker(row)">DOM 标记</el-button>
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

    <el-dialog v-model="markerDialogVisible" title="DOM 标记与参数扫描" width="1040px">
      <div class="marker-toolbar">
        <el-button type="primary" :loading="markerLoading" @click="startMarkingForCurrent(false)">开始标记</el-button>
        <el-button :loading="markerLoading" @click="startMarkingForCurrent(true)">重新开始</el-button>
        <el-button :loading="markerLoading" @click="refreshMarkerForCurrent">读取结果</el-button>
        <el-button :loading="markerLoading" @click="stopMarkingForCurrent">停止标记</el-button>
        <el-button :loading="markerLoading" @click="scanInputsForCurrent">扫描输入项</el-button>
        <el-button type="warning" :loading="markerLoading" @click="clearMarkerForCurrent">清空选择</el-button>
      </div>

      <div class="marker-summary">
        <el-tag :type="currentMarkingStatus?.active ? 'success' : 'info'">
          {{ currentMarkingStatus?.active ? "标记中" : "未标记" }}
        </el-tag>
        <span>{{ markerSystem?.code }} - {{ markerSystem?.name }}</span>
        <span v-if="currentMarkingStatus?.currentUrl" class="marker-url">{{ currentMarkingStatus.currentUrl }}</span>
      </div>

      <el-alert
        show-icon
        type="info"
        :closable="false"
        title="在弹出的业务系统浏览器中移动鼠标并点击目标 DOM 元素；回到本窗口点击“读取结果”即可查看选择器、步骤和参数建议。"
      />

      <el-table :data="markerSelections" max-height="280" class="marker-table" row-key="id">
        <el-table-column prop="sequence" label="#" width="70" />
        <el-table-column prop="kind" label="类型" width="100" />
        <el-table-column prop="label" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="selector" label="选择器" min-width="300" show-overflow-tooltip />
        <el-table-column label="建议" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.recommendedSteps?.length || 0 }} 步</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div class="marker-preview">
        <div class="preview-title">
          <span>计划 JSON 片段</span>
          <el-button link type="primary" @click="copyText(markerExportText)">复制</el-button>
        </div>
        <el-input :model-value="markerExportText" type="textarea" :rows="10" readonly spellcheck="false" />
      </div>

      <div v-if="inputScanResult" class="marker-preview">
        <div class="preview-title">
          <span>输入参数扫描结果</span>
          <el-button link type="primary" @click="copyText(inputScanText)">复制</el-button>
        </div>
        <el-input :model-value="inputScanText" type="textarea" :rows="8" readonly spellcheck="false" />
      </div>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type {
  BrowserSessionStatus,
  DomInputScanResult,
  DomMarkingSelection,
  DomMarkingStatus,
  ExternalSystemSummary,
  ProjectSummary,
} from "@ieta-dyna-snapshot/shared";
import { snapshotApi } from "@/services/api";

const projects = ref<ProjectSummary[]>([]);
const systems = ref<ExternalSystemSummary[]>([]);
const sessionStatuses = reactive<Record<string, BrowserSessionStatus>>({});
const markingStatuses = reactive<Record<string, DomMarkingStatus>>({});
const selectedProjectId = ref("");
const loading = ref(false);
const saving = ref(false);
const markerLoading = ref(false);
const dialogVisible = ref(false);
const markerDialogVisible = ref(false);
const editingId = ref("");
const sessionPolicyText = ref("{}");
const markerSystem = ref<ExternalSystemSummary | null>(null);
const inputScanResult = ref<DomInputScanResult | null>(null);
const form = reactive({
  code: "",
  name: "",
  baseUrl: "",
  loginUrl: "",
  browserProfileId: "",
});

const currentMarkingStatus = computed(() =>
  markerSystem.value ? markingStatuses[markerSystem.value.id] : undefined,
);
const markerSelections = computed(() => currentMarkingStatus.value?.selections || []);
const markerExportText = computed(() => JSON.stringify({
  steps: markerSelections.value.flatMap((selection) => selection.recommendedSteps || []),
  inputSchema: uniqueParameters(markerSelections.value),
}, null, 2));
const inputScanText = computed(() => {
  if (!inputScanResult.value) return "";
  return JSON.stringify({
    inputSchema: inputScanResult.value.parameters,
    steps: inputScanResult.value.fillSteps,
    scannedAt: inputScanResult.value.scannedAt,
    url: inputScanResult.value.url,
  }, null, 2);
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

const loadMarkingStatuses = async () => {
  await Promise.all(
    systems.value.map(async (system) => {
      markingStatuses[system.id] = await snapshotApi.getDomMarkingStatus(system.id);
    }),
  );
};

const loadSystems = async () => {
  loading.value = true;
  try {
    systems.value = await snapshotApi.listSystems(selectedProjectId.value || undefined);
    await Promise.all([loadSessionStatuses(), loadMarkingStatuses()]);
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

function uniqueParameters(selections: DomMarkingSelection[]) {
  const parameters = new Map<string, DomMarkingSelection["recommendedParameters"][number]>();
  for (const selection of selections) {
    for (const parameter of selection.recommendedParameters || []) {
      if (!parameters.has(parameter.name)) parameters.set(parameter.name, parameter);
    }
  }
  return Array.from(parameters.values());
}

const refreshMarker = async (system: ExternalSystemSummary) => {
  markingStatuses[system.id] = await snapshotApi.getDomMarkingStatus(system.id);
};

const openMarker = async (system: ExternalSystemSummary) => {
  markerSystem.value = system;
  inputScanResult.value = null;
  markerDialogVisible.value = true;
  markerLoading.value = true;
  try {
    await refreshMarker(system);
  } catch (error: any) {
    ElMessage.error(error.message || "读取 DOM 标记状态失败");
  } finally {
    markerLoading.value = false;
  }
};

const requireMarkerSystem = () => {
  if (!markerSystem.value) {
    ElMessage.warning("请先选择业务系统");
    return undefined;
  }
  return markerSystem.value;
};

const startMarkingForCurrent = async (clear: boolean) => {
  const system = requireMarkerSystem();
  if (!system) return;
  markerLoading.value = true;
  try {
    sessionStatuses[system.id] = await snapshotApi.openSystemSession(system.id);
    markingStatuses[system.id] = await snapshotApi.startDomMarking(system.id, { clear });
    ElMessage.success("DOM 标记已开启，请在业务系统浏览器中点击目标元素");
  } catch (error: any) {
    ElMessage.error(error.message || "启动 DOM 标记失败");
  } finally {
    markerLoading.value = false;
  }
};

const refreshMarkerForCurrent = async () => {
  const system = requireMarkerSystem();
  if (!system) return;
  markerLoading.value = true;
  try {
    await refreshMarker(system);
  } catch (error: any) {
    ElMessage.error(error.message || "读取 DOM 标记结果失败");
  } finally {
    markerLoading.value = false;
  }
};

const stopMarkingForCurrent = async () => {
  const system = requireMarkerSystem();
  if (!system) return;
  markerLoading.value = true;
  try {
    markingStatuses[system.id] = await snapshotApi.stopDomMarking(system.id);
    ElMessage.success("DOM 标记已停止");
  } catch (error: any) {
    ElMessage.error(error.message || "停止 DOM 标记失败");
  } finally {
    markerLoading.value = false;
  }
};

const clearMarkerForCurrent = async () => {
  const system = requireMarkerSystem();
  if (!system) return;
  markerLoading.value = true;
  try {
    markingStatuses[system.id] = await snapshotApi.clearDomMarkingSelections(system.id);
    inputScanResult.value = null;
    ElMessage.success("DOM 选择已清空");
  } catch (error: any) {
    ElMessage.error(error.message || "清空 DOM 选择失败");
  } finally {
    markerLoading.value = false;
  }
};

const scanInputsForCurrent = async () => {
  const system = requireMarkerSystem();
  if (!system) return;
  markerLoading.value = true;
  try {
    sessionStatuses[system.id] = await snapshotApi.openSystemSession(system.id);
    inputScanResult.value = await snapshotApi.scanDomInputs(system.id);
    ElMessage.success(`已扫描 ${inputScanResult.value.parameters.length} 个输入参数`);
  } catch (error: any) {
    ElMessage.error(error.message || "扫描输入项失败");
  } finally {
    markerLoading.value = false;
  }
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败，请手动选中文本复制");
  }
};

onMounted(loadAll);
</script>

<style scoped>
.marker-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.marker-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
}

.marker-url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
}

.marker-table {
  margin-top: 14px;
}

.marker-preview {
  margin-top: 16px;
}

.preview-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
