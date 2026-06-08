<template>
  <el-container class="main-layout">
    <el-aside :width="sidebarWidth" class="sidebar">
      <div class="logo" @click="router.push('/dashboard')">
        <el-icon class="logo-icon"><Camera /></el-icon>
        <span v-if="!sidebarCollapsed" class="logo-text">Dyna Snapshot</span>
      </div>

      <el-scrollbar class="menu-scrollbar">
        <el-menu
          :default-active="activeRoute"
          :collapse="sidebarCollapsed"
          class="sidebar-menu"
          router
          unique-opened
        >
          <el-menu-item
            v-for="routeItem in menuRoutes"
            :key="routeItem.path"
            :index="routeItem.path"
          >
            <el-icon><component :is="getIcon(routeItem.meta?.icon)" /></el-icon>
            <template #title>
              <span>{{ routeItem.meta?.title }}</span>
              <el-tooltip
                v-if="routeItem.meta?.description && !sidebarCollapsed"
                :content="String(routeItem.meta.description)"
                placement="right"
              >
                <el-icon class="menu-info"><InfoFilled /></el-icon>
              </el-tooltip>
            </template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>

      <div class="sidebar-footer">
        <el-button
          :icon="sidebarCollapsed ? Expand : Fold"
          text
          class="collapse-btn"
          @click="toggleSidebar"
        />
      </div>
    </el-aside>

    <el-container class="main-container">
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-badge :value="appStore.systemHealth.errorCount" :hidden="appStore.systemHealth.errorCount === 0">
            <el-button
              :icon="appStore.isHealthy ? SuccessFilled : WarningFilled"
              :type="appStore.isHealthy ? 'success' : 'warning'"
              text
              title="系统状态"
              @click="showHealth"
            />
          </el-badge>
          <el-button :icon="Refresh" text :loading="appStore.loading" title="刷新" @click="refreshData" />
          <el-button :icon="themeStore.isDark ? Sunny : Moon" text title="切换主题" @click="themeStore.toggleTheme" />
          <el-dropdown @command="handleUserCommand">
            <div class="user-info">
              <el-avatar :size="32"><el-icon><User /></el-icon></el-avatar>
              <span class="username">{{ authStore.currentUser?.displayName }}</span>
              <el-icon><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component, route: viewRoute }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" :key="viewRoute.path" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  Camera,
  CaretBottom,
  Connection,
  Expand,
  Fold,
  FolderOpened,
  InfoFilled,
  Lock,
  Monitor,
  Moon,
  Picture,
  Refresh,
  Setting,
  SuccessFilled,
  Sunny,
  SwitchButton,
  Tickets,
  TrendCharts,
  User,
  VideoPlay,
  WarningFilled,
} from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const sidebarCollapsed = ref(localStorage.getItem("snapshot_sidebar_collapsed") === "true");

const iconMap = {
  Camera,
  Connection,
  FolderOpened,
  Lock,
  Monitor,
  Picture,
  Setting,
  Tickets,
  TrendCharts,
  VideoPlay,
};

const sidebarWidth = computed(() => (sidebarCollapsed.value ? "64px" : "240px"));
const activeRoute = computed(() => route.path);
const menuRoutes = computed(() => router.getRoutes().find((item) => item.path === "/")?.children || []);

const getIcon = (name: unknown) => {
  if (typeof name === "string" && name in iconMap) {
    return iconMap[name as keyof typeof iconMap];
  }
  return Monitor;
};

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem("snapshot_sidebar_collapsed", String(sidebarCollapsed.value));
};

const refreshData = async () => {
  await appStore.refreshData();
  ElMessage.success("已刷新系统状态");
};

const showHealth = () => {
  ElMessage({
    type: appStore.isHealthy ? "success" : "warning",
    message: `系统状态：${appStore.systemHealth.status}`,
  });
};

const handleUserCommand = (command: string) => {
  if (command === "logout") {
    authStore.logout();
    router.push("/login");
  }
};

onMounted(() => {
  appStore.refreshData();
});
</script>
