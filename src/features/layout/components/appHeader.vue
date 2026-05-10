<template>
  <header class="header">
    <div class="logo-text">NodeAuth</div>
    <div v-if="appState === 'unlocked'" class="header-actions">
      <button class="icon-btn" @click="isAddModalOpen = true" :title="$t('header.add_account')">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button class="icon-btn" @click="lockVault" :title="$t('header.lock')">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useExtensionState } from '@/shared/state/useExtensionState'

const { appState, isAddModalOpen, lockVault } = useExtensionState()
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #0f3460;
  color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
}
.logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.icon-btn {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}
.icon-btn:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}
</style>
