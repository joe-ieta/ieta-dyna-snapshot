<template>
  <main class="demo-screen">
    <header class="demo-topbar">
      <RouterLink class="demo-brand" to="/demo">
        <span class="demo-brand-mark">U</span>
        <span>UDS Demo Systems</span>
      </RouterLink>
      <nav class="demo-nav">
        <RouterLink to="/demo/local-monitor">本机资源监测</RouterLink>
        <RouterLink to="/demo/smart-health">海上市智慧医疗</RouterLink>
      </nav>
    </header>

    <section class="demo-login">
      <div class="demo-login-panel">
        <p class="demo-tag-row">
          <span class="demo-tag">UDS 输入</span>
          <span class="demo-tag">组件适配</span>
          <span class="demo-tag">捕获验证</span>
        </p>
        <h1>面向快照采集的内置业务系统</h1>
        <p>
          页面由 UDS 场景描述驱动，基础组件只消费统一数据协议，
          后续可以替换 ECharts、地图或表格实现，不影响业务流程定义。
        </p>
        <div class="demo-login-form">
          <RouterLink class="demo-button" to="/demo/local-monitor">进入本机资源监测</RouterLink>
          <RouterLink class="demo-button secondary" to="/demo/smart-health">进入海上市智慧医疗</RouterLink>
        </div>
      </div>

      <div class="demo-login-visual">
        <section class="demo-panel">
          <div class="demo-panel-header">
            <h2 class="demo-panel-title">UDS 展现组件基础层</h2>
            <span class="demo-tag">v1</span>
          </div>
          <table class="demo-data-table" data-testid="table-uds-component-contract">
            <thead>
              <tr>
                <th>层级</th>
                <th>职责</th>
                <th>捕获价值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>UdsScene</td>
                <td>定义数据集、过滤器、关联、视图</td>
                <td>页面同构生成</td>
              </tr>
              <tr>
                <td>Resolver</td>
                <td>投影指标、图表、表格、文本</td>
                <td>屏蔽组件内部结构</td>
              </tr>
              <tr>
                <td>Renderer</td>
                <td>绑定图表、表格、交互与跳转</td>
                <td>稳定选择器与真实表格</td>
              </tr>
            </tbody>
          </table>
        </section>
        <span class="demo-ready" data-testid="page-ready">ready</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import "../demo.css";
</script>
