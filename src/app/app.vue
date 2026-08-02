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
import { onMounted, watch } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useSettings } from '@/shared/state/modules/useSettings'

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
const { settings } = useSettings()

function applyTheme() {
  const theme = settings.value.appTheme
  let isDark = false
  if (theme === 'dark') {
    isDark = true
  } else if (theme === 'light') {
    isDark = false
  } else {
    // system
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

onMounted(() => {
  init()
  
  // 初始应用主题
  applyTheme()
  
  // 监听设置变化
  watch(() => settings.value.appTheme, applyTheme)
  
  // 监听系统主题变化
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
  }
})
</script>

