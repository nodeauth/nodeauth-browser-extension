<template>
  <div class="vault-view fade-in">
    <!-- 搜索框 -->
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="#999" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input 
        :value="searchQuery" 
        @input="e => performSearch(e.target.value)"
        type="text" 
        :placeholder="$t('vault.search_placeholder')" 
      />
    </div>

    <!-- 分类筛选 -->
    <div class="category-bar" v-if="categories.length > 0">
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
        {{ cat.name === 'uncategorized' ? $t('common.uncategorized') : cat.name }} 
        <span class="count">({{ cat.count }})</span>
      </div>
    </div>

    <div v-if="isLoadingVault" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('vault.loading') }}</p>
    </div>

    <div v-else-if="vaultList.length === 0" class="empty-state">
      <p>{{ searchQuery || selectedCategory ? $t('vault.no_match') : $t('vault.empty') }}</p>
    </div>

    <div v-else class="vault-list" :class="settings.density">
      <VaultItem 
        v-for="item in vaultList" 
        :key="item.id" 
        :item="item" 
        :incrementing-ids="incrementingIds"
        @command="handleCommand"
        @copy-code="copyToClipboard"
        @increment="handleIncrement"
      />
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
              <option v-for="cat in categories.filter(c => c.name !== 'uncategorized')" :key="cat.name" :value="cat.name"></option>
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
            <button class="btn-outline" @click="copyToClipboard(exportData?.decryptedSecret, true)">
              {{ $t('vault.copy_secret') }}
            </button>
            <button class="btn-outline" @click="copyToClipboard(exportUri, true)">
              {{ $t('vault.copy_uri') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import VaultItem from './vaultItem.vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useVaultActions } from '@/features/vault/composables/useVaultActions'

const extensionState = useExtensionState()
const { 
  vaultList, 
  categories, 
  selectedCategory, 
  totalItemsCount,
  isLoadingVault, 
  searchQuery, 
  performSearch, 
  settings,
  copyToClipboard,
  handleIncrement,
  incrementingIds
} = extensionState

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
</script>

<style scoped>
.vault-view {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.search-bar {
  position: relative;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.search-bar input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border-radius: 20px;
  background-color: white;
  border: 1px solid #eaeaea;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
  outline: none;
  font-size: 14px;
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
  padding: 4px 2px 12px 2px;
  margin-bottom: 8px;
  flex-shrink: 0;
  scrollbar-width: none; /* Firefox */
}
.category-bar::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
.category-item {
  padding: 6px 14px;
  background-color: #f5f5f5;
  border-radius: 16px;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
.category-item:hover {
  background-color: #efefef;
}
.category-item.active {
  background-color: #0f3460;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 8px rgba(15, 52, 96, 0.2);
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
  color: #666;
  font-size: 14px;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(15, 52, 96, 0.1);
  border-top-color: #0f3460;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #999;
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
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

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
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  animation: zoomIn 0.2s ease-out;
}
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
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
  color: #666;
  margin-bottom: 6px;
}
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 12px;
}
.btn-primary, .btn-secondary {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: #0f3460;
  color: white;
}
.btn-secondary {
  background: #f5f5f5;
  color: #666;
}
.btn-outline {
  width: 100%;
  padding: 8px;
  background: white;
  border: 1px solid #eaeaea;
  border-radius: 8px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  margin-top: 8px;
}

/* 导出弹窗特有 */
.qr-container {
  background: white;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  margin-bottom: 12px;
}
.qr-container img {
  display: block;
  width: 180px;
  height: 180px;
}
.qr-tip {
  font-size: 12px;
  color: #888;
  margin-bottom: 20px;
}
.account-details {
  width: 100%;
  background: #f9f9f9;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}
.detail-row .label { color: #999; }
.detail-row .value { color: #333; font-weight: 500; }
.action-grid {
  width: 100%;
  display: flex;
  gap: 8px;
}
</style>
