<template>
  <div class="vault-view fade-in">
    <!-- 固顶头部区域：搜索框 + 分类栏 -->
    <div class="sticky-header" :class="{ 'is-hidden': isHeaderHidden }">
      <!-- 搜索框 -->
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          :value="searchQuery" 
          @input="e => performSearch(e.target.value)"
          type="text" 
          :placeholder="$t('vault.search_placeholder')" 
        />
      </div>

      <!-- 分类筛选 -->
      <div class="category-bar" v-if="(categories?.length || 0) > 0 || (currentSiteAccounts?.length || 0) > 0">
      <!-- 分类筛选中的自动匹配标签已移除，并入全局列表置顶展示 -->
      <div 
        class="category-item" 
        :class="{ active: selectedCategory === '' }"
        @click="selectedCategory = ''"
      >
        {{ $t('common.all') }} <span class="count">({{ totalItemsCount }})</span>
      </div>
      <div 
        v-for="cat in categories" 
        :key="cat.name"
        class="category-item"
        :class="{ active: selectedCategory === cat.name }"
        @click="selectedCategory = cat.name"
      >
        {{ cat.name === '____UNCATEGORIZED____' ? $t('common.uncategorized') : cat.name }} 
        <span class="count">({{ cat.count }})</span>
      </div>
    </div>
    </div> <!-- 结束 sticky-header -->

    <div v-if="isLoadingVault" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('vault.loading') }}</p>
    </div>

    <div v-else-if="vaultList.length === 0" class="empty-state">
      <p>{{ searchQuery || selectedCategory ? $t('vault.no_match') : $t('vault.empty') }}</p>
    </div>

    <div v-else class="vault-list" :class="settings.density">
      <!-- 动态渲染分段列表，消除 VaultItem 的重复代码 -->
      <div 
        v-for="(section, index) in renderedSections" 
        :key="index"
        :class="{ 'vault-section': section.title }"
      >
        <div v-if="section.title" class="section-title">{{ $t(section.title) }}</div>
        <VaultItem 
          v-for="item in section.items" 
          :key="item.id" 
          :item="item" 
          :incrementing-ids="incrementingIds"
          @command="handleCommand"
          @copy-code="copyToClipboard"
          @increment="handleIncrement"
        />
      </div>
    </div>

    <!-- 编辑账号弹窗 -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ $t('vault.edit_account') }}</h3>
          <button class="close-btn" @click="isEditModalOpen = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('vault.service_name') }}</label>
            <input v-model="editData.service" type="text" :placeholder="$t('vault.service_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('vault.account_identifier') }}</label>
            <input v-model="editData.account" type="text" :placeholder="$t('vault.account_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('vault.category_optional') }}</label>
            <input v-model="editData.category" type="text" list="edit-category-options" :placeholder="$t('vault.category_placeholder')" />
            <datalist id="edit-category-options">
              <option v-for="cat in categories.filter(c => c.name !== '____UNCATEGORIZED____')" :key="cat.name" :value="cat.name"></option>
            </datalist>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="isEditModalOpen = false">{{ $t('common.cancel') }}</button>
          <button class="btn-primary" @click="submitEditVault" :disabled="isEditing">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- 导出账号弹窗 -->
    <div v-if="isExportModalOpen" class="modal-overlay" @click.self="isExportModalOpen = false">
      <div class="modal-content export-modal">
        <div class="modal-header">
          <h3>{{ $t('vault.export_title') }}</h3>
          <button class="close-btn" @click="isExportModalOpen = false">&times;</button>
        </div>
        <div class="modal-body center">
          <div class="qr-container">
            <img :src="qrCodeUrl" alt="OTP QR Code" />
          </div>
          <p class="qr-tip">{{ $t('vault.scan_to_import') }}</p>
          
          <div class="account-details">
            <div class="detail-row">
              <span class="label">{{ $t('vault.service_name') }}:</span>
              <span class="value">{{ exportData?.service }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('vault.account_identifier') }}:</span>
              <span class="value">{{ exportData?.account }}</span>
            </div>
          </div>

          <div class="action-grid">
            <button 
              class="btn-outline" 
              :class="{ 'btn-copied': activeCopyBtn === 'secret' }"
              @click="handleExportCopy(exportData?.decryptedSecret, 'secret')"
            >
              {{ activeCopyBtn === 'secret' ? $t('vault.copied') + ' ✅' : $t('vault.copy_secret') }}
            </button>
            <button 
              class="btn-outline" 
              :class="{ 'btn-copied': activeCopyBtn === 'uri' }"
              @click="handleExportCopy(exportUri, 'uri')"
            >
              {{ activeCopyBtn === 'uri' ? $t('vault.copied') + ' ✅' : $t('vault.copy_uri') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import VaultItem from './vaultItem.vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useVaultActions } from '@/features/vault/composables/useVaultActions'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const extensionState = useExtensionState()
const { 
  vaultList, 
  categories, 
  selectedCategory, 
  totalItemsCount,
  currentSiteAccounts = ref([]),
  isLoadingVault, 
  searchQuery, 
  performSearch, 
  settings,
  copyToClipboard,
  showToast,
  handleIncrement,
  incrementingIds
} = extensionState

// --- 列表渲染数据组装 (动态分段) ---
const renderedSections = computed(() => {
  // 如果在搜索状态或分类过滤状态下，直接平铺
  if (searchQuery.value || selectedCategory.value) {
    return [{ title: '', items: vaultList.value }]
  }
  
  const sections = []
  
  // 1. 置顶当前网站的匹配账号
  const currentItems = currentSiteAccounts.value || []
  if (currentItems.length > 0) {
    sections.push({ title: 'vault.suggestions', items: currentItems })
  }
  
  // 2. 渲染其他账号 (去重)
  const currentIds = new Set(currentItems.map(item => item.id))
  const otherItems = vaultList.value.filter(item => !currentIds.has(item.id))
  
  if (otherItems.length > 0) {
    sections.push({ 
      title: currentItems.length > 0 ? 'common.all' : '', 
      items: otherItems 
    })
  }
  
  return sections
})
// ------------------------------------------

const {
  isEditModalOpen,
  isEditing,
  editData,
  isExportModalOpen,
  exportData,
  exportUri,
  qrCodeUrl,
  handleCommand,
  submitEditVault
} = useVaultActions(extensionState)

// --- 动态滚动隐现 (Scroll-driven Sticky) 逻辑 ---
const isHeaderHidden = ref(false)
let lastScrollY = 0
let scrollContainer = null

const handleScroll = (e) => {
  const currentScrollY = e.target.scrollTop
  // 滚动超过 40px 才开始判断，且向下滚动时隐藏，向上滚动时显示
  if (currentScrollY > 40 && currentScrollY > lastScrollY) {
    isHeaderHidden.value = true
  } else if (currentScrollY < lastScrollY) {
    isHeaderHidden.value = false
  }
  lastScrollY = currentScrollY
}

onMounted(() => {
  scrollContainer = document.querySelector('.main-content')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll)
  }
})
// --------------------------------------------------

// 处理导出弹窗的双重反馈复制
const activeCopyBtn = ref(null)
function handleExportCopy(content, type) {
  if (!content) return
  
  // 1. 执行复制
  copyToClipboard(content, true)
  
  // 2. 触发全局 Toast
  showToast(t('vault.copied'))
  
  // 3. 触发按钮状态切换
  activeCopyBtn.value = type
  setTimeout(() => {
    if (activeCopyBtn.value === type) activeCopyBtn.value = null
  }, 5000)
}
</script>


<style scoped>
.vault-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
}
.sticky-header {
  position: sticky;
  top: -12px;
  z-index: 10;
  /* 恢复纯实色背景 */
  background: var(--bg-color);
  margin-left: -16px;
  margin-right: -16px;
  padding-left: 16px;
  padding-right: 16px;
  padding-top: 12px;
  margin-top: -12px;
  margin-bottom: 0px;
}
.sticky-header.is-hidden {
  transform: translateY(-110%);
  pointer-events: none;
}
.search-bar {
  position: relative;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.search-bar input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border-radius: 20px;
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  outline: none;
  font-size: 14px;
  color: var(--text-main);
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.category-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 4px 2px;
  margin-bottom: 4px;
  flex-shrink: 0;
  scrollbar-width: none; /* Firefox */
}
.category-bar::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
.category-item {
  padding: 6px 14px;
  background-color: var(--category-bg);
  border-radius: var(--radius-lg);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
.category-item:hover {
  background-color: var(--category-hover);
  color: var(--text-main);
}
.category-item.active {
  background-color: var(--primary-color);
  color: var(--text-white);
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(var(--primary-color-rgb), 0.12);
}
.category-item.current-site-tag {
  font-weight: 500;
}
.count {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 2px;
}
.category-item.active .count {
  opacity: 1;
}
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-secondary);
  font-size: 14px;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(var(--primary-color-rgb), 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}
.vault-section {
  display: flex;
  flex-direction: column;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 8px 12px 4px 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-light);
  font-size: 14px;
}
.vault-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}
.vault-list.compact {
  gap: 4px;
}

/* 弹窗通用样式 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 320px;
  box-shadow: var(--shadow-lg);
  animation: zoomIn 0.2s ease-out;
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-main);
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-light);
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 20px;
}
.modal-body.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color-dark);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--item-bg-hover);
  color: var(--text-main);
}
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color-light);
  display: flex;
  gap: 12px;
}
.btn-primary, .btn-secondary {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: var(--primary-color);
  color: var(--text-white);
}
.btn-secondary {
  background: var(--category-bg);
  color: var(--text-secondary);
}
.btn-outline {
  width: 100%;
  padding: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s ease;
}
.btn-outline.btn-copied {
  border-color: var(--success-color);
  color: var(--success-color);
  background: rgba(46, 204, 113, 0.08);
}

/* 导出弹窗特有 */
.qr-container {
  background: var(--card-bg);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color-light);
  margin-bottom: 12px;
}
.qr-container img {
  display: block;
  width: 180px;
  height: 180px;
}
.qr-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 20px;
}
.account-details {
  width: 100%;
  background: var(--item-bg-hover);
  padding: 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}
.detail-row .label { color: var(--text-light); }
.detail-row .value { color: var(--text-main); font-weight: 500; }
.action-grid {
  width: 100%;
  display: flex;
  gap: 8px;
}
</style>

