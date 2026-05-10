<template>
  <nav class="bottom-nav">
    <button 
      class="nav-item" 
      :class="{ active: currentView === 'main' }"
      @click="currentView = 'main'"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      <span>{{ $t('header.accounts') }}</span>
    </button>
    <button 
      class="nav-item" 
      :class="{ active: currentView === 'settings' }"
      @click="currentView = 'settings'"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      <span>{{ $t('header.settings') }}</span>
    </button>
  </nav>
</template>

<script setup>
import { watch } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'

const { currentView, vaultList, loadVault } = useExtensionState()

watch(currentView, (newView) => {
  if (newView === 'main' && vaultList.value.length === 0) {
    loadVault()
  }
})
</script>

<style scoped>
.bottom-nav {
  display: flex;
  height: 56px;
  background: white;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  transition: all 0.2s;
  gap: 4px;
}

.nav-item span {
  font-size: 11px;
  font-weight: 500;
}

.nav-item.active {
  color: #0f3460;
}

.nav-item:hover:not(.active) {
  color: #666;
}

.nav-item svg {
  transition: transform 0.2s;
}

.nav-item:active svg {
  transform: scale(0.9);
}
</style>
