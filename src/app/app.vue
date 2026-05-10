<template>
  <div class="extension-container">
    <AppHeader />

    <main class="main-content">
      <!-- 状态一：引导绑定 -->
      <ConnectVault v-if="appState === 'uninitialized'" />

      <!-- 状态二：设置 PIN 码 -->
      <SetupPin v-else-if="appState === 'ready_to_lock'" />

      <!-- 状态三：输入 PIN 解锁 -->
      <UnlockVault v-else-if="appState === 'locked'" />

      <!-- 状态四：已解锁 -->
      <template v-else-if="appState === 'unlocked'">
        <VaultList v-if="currentView === 'main'" />
        <SettingsView v-else />
      </template>

      <!-- 初始化加载中 -->
      <div v-else class="loading-state">
        <div class="spinner"></div>
      </div>
    </main>

    <BottomNav v-if="appState === 'unlocked'" />

    <!-- 弹窗组件 -->
    <AddAccountModal />
    <ConfirmModal />
    
    <!-- 全局轻量反馈 -->
    <div 
      class="global-toast" 
      :class="[globalToast.type, { 'show': globalToast.show }]"
    >
      {{ globalToast.message }}
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'

// 导入提取的组件
import AppHeader from '@/features/layout/components/appHeader.vue'
import BottomNav from '@/features/layout/components/bottomNav.vue'
import ConfirmModal from '@/features/layout/components/confirmModal.vue'
import ConnectVault from '@/features/auth/components/pairInstance.vue'
import SetupPin from '@/features/auth/components/setPinCode.vue'
import UnlockVault from '@/features/auth/components/pinEntry.vue'
import VaultList from '@/features/vault/components/vaultList.vue'
import SettingsView from '@/features/settings/components/settingsView.vue'
import AddAccountModal from '@/features/vault/components/addVault.vue'

const { appState, currentView, init, globalToast } = useExtensionState()

onMounted(() => {
  init()
})
</script>

<style>
/* 全局样式定义，不建议使用 scoped 以便某些基础布局生效 */
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  padding: 0;
}
.extension-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  width: 380px;
  background-color: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  position: relative;
  overflow: hidden;
}
.main-content {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(15, 52, 96, 0.1);
  border-top-color: #0f3460;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 通用动画 */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 全局 Toast */
.global-toast {
  position: fixed;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: white;
  z-index: 9999;
  transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  pointer-events: none;
}
.global-toast.show {
  top: 16px;
}
.global-toast.success {
  background-color: #10b981;
}
.global-toast.error {
  background-color: #ef4444;
}
.global-toast.info {
  background-color: #3b82f6;
}
</style>
