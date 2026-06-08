<template>
  <section>
    <h1 class="page-title">权限</h1>
    <p class="page-subtitle">首版沿用本地 JWT 登录和权限点控制，默认管理员拥有全部权限。</p>
    <el-card class="section-card">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户">{{ auth.currentUser?.displayName }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ auth.currentUser?.roles.join(", ") }}</el-descriptions-item>
        <el-descriptions-item label="权限">{{ auth.currentUser?.permissions.join(", ") }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
</script>
