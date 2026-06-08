<template>
  <section>
    <h1 class="page-title">配置</h1>
    <p class="page-subtitle">本地服务默认只绑定本机，外部访问时需要启用访问令牌和安全配置。</p>
    <el-card class="section-card">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="API">http://127.0.0.1:4310</el-descriptions-item>
        <el-descriptions-item label="Web">http://127.0.0.1:4311</el-descriptions-item>
        <el-descriptions-item label="数据库">sql.js SQLite 本地文件</el-descriptions-item>
        <el-descriptions-item label="浏览器会话目录">data/browser-profiles</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </section>
</template>
