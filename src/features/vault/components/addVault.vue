<template>
  <div v-if="isAddModalOpen" class="modal-overlay" @click.self="isAddModalOpen = false">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('vault.add_account_title') }}</h3>
        <button class="close-btn" @click="isAddModalOpen = false">&times;</button>
      </div>
      
      <div class="modal-body">
        <p class="modal-desc">{{ $t('vault.add_account_desc') }}</p>
        
        <div class="form-group">
          <label>{{ $t('vault.service_name') }}</label>
          <input v-model="form.service" type="text" :placeholder="$t('vault.service_placeholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('vault.account_identifier') }}</label>
          <input v-model="form.account" type="text" :placeholder="$t('vault.account_placeholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('vault.secret_placeholder') }}</label>
          <input v-model="form.secret" type="password" :placeholder="$t('vault.secret_placeholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('vault.category_optional') }}</label>
          <input v-model="form.category" type="text" list="category-options" :placeholder="$t('vault.category_placeholder')" />
          <datalist id="category-options">
            <option v-for="cat in categories.filter(c => c.name !== 'uncategorized')" :key="cat.name" :value="cat.name"></option>
          </datalist>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="isAddModalOpen = false" :disabled="isAddingAccount">
          {{ $t('common.cancel') }}
        </button>
        <button class="btn-primary" @click="handleSave" :disabled="!isValid || isAddingAccount">
          {{ isAddingAccount ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'

const { isAddModalOpen, isAddingAccount, saveNewAccount, showToast, categories } = useExtensionState()
const { t } = useI18n()

const form = ref({
  service: '',
  account: '',
  secret: '',
  category: ''
})

const isValid = computed(() => {
  return form.value.service.trim() && 
         form.value.account.trim() && 
         form.value.secret.trim()
})

async function handleSave() {
  const result = await saveNewAccount(form.value)
  if (result.success) {
    form.value = { service: '', account: '', secret: '', category: '' }
    showToast(t('vault.add_success'))
  } else {
    showToast(t('vault.add_failed') + result.error, 'error')
  }
}
</script>

<style scoped>
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
.modal-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 16px;
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
.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.btn-secondary {
  background: #f5f5f5;
  color: #666;
}
</style>
