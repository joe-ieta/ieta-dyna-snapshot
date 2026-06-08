import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import MainLayout from "@/layout/MainLayout.vue";
import Login from "@/views/Login.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    children: [
      {
        path: "/dashboard",
        name: "dashboard",
        component: () => import("@/modules/dashboard/Dashboard.vue"),
        meta: { title: "采集工作台", icon: "Monitor", description: "查看工程、运行和资产概览" },
      },
      {
        path: "/projects",
        name: "projects",
        component: () => import("@/modules/projects/ProjectManager.vue"),
        meta: { title: "采集工程", icon: "FolderOpened", description: "管理工程编号、默认参数和资产目录" },
      },
      {
        path: "/systems",
        name: "systems",
        component: () => import("@/modules/systems/SystemManager.vue"),
        meta: { title: "业务系统", icon: "Connection", description: "维护目标系统和浏览器会话" },
      },
      {
        path: "/plans",
        name: "plans",
        component: () => import("@/modules/plans/CapturePlanManager.vue"),
        meta: { title: "采集计划", icon: "Tickets", description: "维护页面路径、参数和 DOM 选区" },
      },
      {
        path: "/runs",
        name: "runs",
        component: () => import("@/modules/runs/RunManager.vue"),
        meta: { title: "运行任务", icon: "VideoPlay", description: "触发和追踪自动采集运行" },
      },
      {
        path: "/assets",
        name: "assets",
        component: () => import("@/modules/assets/AssetLibrary.vue"),
        meta: { title: "资产库", icon: "Picture", description: "查看截图、表格和结构化数据资产" },
      },
      {
        path: "/auth",
        name: "auth",
        component: () => import("@/modules/auth/AuthManager.vue"),
        meta: { title: "权限", icon: "Lock", description: "查看当前用户和权限边界" },
      },
      {
        path: "/config",
        name: "config",
        component: () => import("@/modules/config/ConfigManager.vue"),
        meta: { title: "配置", icon: "Setting", description: "查看本地服务与存储配置" },
      },
      {
        path: "/monitoring",
        name: "monitoring",
        component: () => import("@/modules/monitoring/MonitoringDashboard.vue"),
        meta: { title: "监控", icon: "TrendCharts", description: "查看系统健康和执行指标" },
      },
    ],
  },
  { path: "/login", name: "login", component: Login, meta: { hidden: true, title: "登录" } },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const { useAuthStore } = await import("@/stores/auth");
  const authStore = useAuthStore();
  if (to.path === "/login") return true;
  if (authStore.token && !authStore.currentUser) {
    await authStore.initializeAuth();
  }
  if (!authStore.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  document.title = `${String(to.meta.title || "Dyna Snapshot")} - Dyna Snapshot`;
  return true;
});

export default router;
