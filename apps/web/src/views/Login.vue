<template>
  <div class="login-page">
    <el-card class="login-card">
      <h1>Dyna Snapshot</h1>
      <p>本地网页快照与结构化数据采集系统</p>
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" show-password />
        </el-form-item>
        <el-button type="primary" class="login-button" :loading="auth.loading" @click="submit">
          登录
        </el-button>
      </el-form>
      <div class="hint">默认本地管理员：admin / admin123456</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const form = reactive({ username: "admin", password: "admin123456" });

const submit = async () => {
  try {
    const ok = await auth.login(form.username, form.password);
    if (ok) {
      await router.push(String(route.query.redirect || "/dashboard"));
    }
  } catch (error: any) {
    ElMessage.error(error.message || "登录失败");
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #eef3f8;
}

.login-card {
  width: min(380px, calc(100vw - 32px));
  border-radius: 8px;
}

h1 {
  margin: 0 0 8px;
}

p {
  margin: 0 0 24px;
  color: #606266;
}

.login-button {
  width: 100%;
}

.hint {
  margin-top: 16px;
  color: #909399;
  font-size: 13px;
}
</style>
