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
          <label>{{ $t('vault.secret_label') }}</label>
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
.modal-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
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
.btn-primary:disabled {
  background: var(--border-color-dark);
  cursor: not-allowed;
  opacity: 0.7;
}
.btn-secondary {
  background: var(--category-bg);
  color: var(--text-secondary);
}
</style>

