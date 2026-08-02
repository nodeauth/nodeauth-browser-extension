<template>
  <div v-if="isAddModalOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('vault.add_account_title') }}</h3>
        <button class="close-btn" @click="closeModal">&times;</button>
      </div>
      
      <div class="modal-body">
        <!-- 扫码快捷功能栏 -->
        <div class="scan-toolbar">
          <button type="button" class="btn-scan-action" :class="{ 'is-active': isScanning }" @click="handleScanPage" :disabled="isScanning">
            <svg class="scan-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
              <rect x="7" y="7" width="10" height="10" rx="1"></rect>
            </svg>
            {{ isScanning ? $t('vault.scanning') : $t('vault.scan_page_qr') }}
          </button>
          <label class="btn-scan-action">
            <svg class="scan-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            {{ $t('vault.scan_file_qr') }}
            <input type="file" accept="image/*" class="file-input-hidden" @change="handleFileUpload" />
          </label>
        </div>

        <div class="form-group">
          <div class="label-row-between">
            <label>{{ $t('vault.otp_type_label') }}</label>
            <button 
              v-if="form.type === 'totp'"
              type="button" 
              class="btn-toggle-advanced" 
              :class="{ 'is-active': showAdvancedOptions }"
              @click="showAdvancedOptions = !showAdvancedOptions"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              {{ $t('vault.advanced_options') }}
            </button>
          </div>
          <select v-model="form.type" class="form-select">
            <option value="totp">{{ $t('vault.otp_type_totp') }}</option>
            <option value="hotp">{{ $t('vault.otp_type_hotp') }}</option>
            <option value="steam">{{ $t('vault.otp_type_steam') }}</option>
            <option value="blizzard">{{ $t('vault.otp_type_blizzard') }}</option>
          </select>
        </div>

        <!-- 算法、代码位数、更新周期/计数器 3 列平铺 (在 isAdvancedVisible 为 true 时展现) -->
        <transition name="slide-fade">
          <div v-if="isAdvancedVisible" class="form-group-row-3">
            <div class="form-group">
              <label>{{ $t('vault.algorithm_label') }}</label>
              <select v-model="form.algorithm" class="form-select" :disabled="form.type === 'steam' || form.type === 'blizzard'">
                <option value="SHA1">SHA1</option>
                <option value="SHA256">SHA256</option>
                <option value="SHA512">SHA512</option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ $t('vault.digits_label') }}</label>
              <select v-model.number="form.digits" class="form-select" :disabled="form.type === 'steam' || form.type === 'blizzard'">
                <option :value="5" v-if="form.type === 'steam'">{{ $t('vault.digits_5') }}</option>
                <option :value="8" v-else-if="form.type === 'blizzard'">{{ $t('vault.digits_8') }}</option>
                <template v-else>
                  <option :value="6">{{ $t('vault.digits_6') }}</option>
                  <option :value="8">{{ $t('vault.digits_8') }}</option>
                </template>
              </select>
            </div>
            <div class="form-group">
              <template v-if="form.type === 'hotp'">
                <label>{{ $t('vault.counter_label') }}</label>
                <input v-model.number="form.counter" type="number" min="0" />
              </template>
              <template v-else>
                <label>{{ $t('vault.period_label') }}</label>
                <select v-model.number="form.period" class="form-select" :disabled="form.type === 'steam' || form.type === 'blizzard'">
                  <option :value="30">{{ $t('vault.period_30s') }}</option>
                  <option :value="60">{{ $t('vault.period_60s') }}</option>
                </select>
              </template>
            </div>
          </div>
        </transition>

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
          <div class="input-with-icon">
            <input 
              v-model="form.secret" 
              :type="showSecretKey ? 'text' : 'password'" 
              :placeholder="$t('vault.secret_placeholder')" 
            />
            <button type="button" class="icon-toggle-btn" @click="showSecretKey = !showSecretKey" :title="showSecretKey ? $t('vault.hide_secret') : $t('vault.show_secret')">
              <svg v-if="showSecretKey" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>{{ $t('vault.category_optional') }}</label>
          <input v-model="form.category" type="text" list="category-options" :placeholder="$t('vault.category_placeholder')" />
          <datalist id="category-options">
            <option v-for="cat in categories.filter(c => c.name !== '____UNCATEGORIZED____')" :key="cat.name" :value="cat.name"></option>
          </datalist>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="closeModal" :disabled="isAddingAccount">
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
import { ref, computed, watch } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'
import { rpc } from '@/shared/utils/rpc'
import { decodeQrFromDataUrl, parseQrResult } from '@/shared/utils/qrDecoder'

const { isAddModalOpen, isAddingAccount, saveNewAccount, showToast, categories } = useExtensionState()
const { t } = useI18n()

const isScanning = ref(false)
const showSecretKey = ref(false)
const showAdvancedOptions = ref(false)

const getDefaultForm = () => ({
  type: 'totp',
  service: '',
  account: '',
  secret: '',
  category: '',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  counter: 0
})

const form = ref(getDefaultForm())

const isAdvancedVisible = computed(() => {
  if (showAdvancedOptions.value) return true
  if (form.value.type === 'hotp' || form.value.type === 'steam' || form.value.type === 'blizzard') return true
  if (form.value.algorithm !== 'SHA1' || form.value.digits !== 6 || form.value.period !== 30) return true
  return false
})

function resetForm() {
  form.value = getDefaultForm()
  showSecretKey.value = false
  showAdvancedOptions.value = false
}

function closeModal() {
  isAddModalOpen.value = false
  resetForm()
}

watch(isAddModalOpen, (isOpen) => {
  if (!isOpen) {
    resetForm()
  }
})

async function applyParsedResult(parsed) {
  if (!parsed) {
    showToast(t('vault.no_qr_found'), 'error')
    return false
  }
  if (parsed.service) form.value.service = parsed.service
  if (parsed.account) form.value.account = parsed.account
  if (parsed.secret) form.value.secret = parsed.secret
  if (parsed.type) form.value.type = parsed.type
  if (parsed.algorithm) form.value.algorithm = parsed.algorithm
  if (typeof parsed.digits !== 'undefined') form.value.digits = parsed.digits
  if (typeof parsed.period !== 'undefined') form.value.period = parsed.period
  if (typeof parsed.counter !== 'undefined') form.value.counter = parsed.counter
  if (parsed.category) form.value.category = parsed.category

  showToast(t('vault.scan_success_fill'))
  return true
}

async function handleScanPage() {
  try {
    isScanning.value = true
    const res = await rpc.captureActiveTab()
    if (!res || !res.success || !res.dataUrl) {
      throw new Error(res?.error || t('vault.no_qr_found'))
    }
    const qrText = await decodeQrFromDataUrl(res.dataUrl)
    const parsed = parseQrResult(qrText)
    await applyParsedResult(parsed)
  } catch (err) {
    showToast(err.message || t('vault.no_qr_found'), 'error')
  } finally {
    isScanning.value = false
  }
}

function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (evt) => {
    const dataUrl = evt.target.result
    const qrText = await decodeQrFromDataUrl(dataUrl)
    const parsed = parseQrResult(qrText)
    await applyParsedResult(parsed)
    e.target.value = ''
  }
  reader.readAsDataURL(file)
}

watch(() => form.value.type, (newType) => {
  form.value.algorithm = 'SHA1'
  if (newType === 'steam') {
    form.value.digits = 5
    form.value.period = 30
    if (!form.value.service) form.value.service = 'Steam'
  } else if (newType === 'blizzard') {
    form.value.digits = 8
    form.value.period = 30
    if (!form.value.service) form.value.service = 'Battle.net'
  } else if (newType === 'hotp') {
    form.value.digits = 6
    form.value.counter = 0
  } else {
    form.value.digits = 6
    form.value.period = 30
  }
})

const isValid = computed(() => {
  return form.value.service.trim() && 
         form.value.account.trim() && 
         form.value.secret.trim()
})

async function handleSave() {
  const result = await saveNewAccount(form.value)
  if (result.success) {
    form.value = getDefaultForm()
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
  padding: 12px;
}
.modal-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 330px;
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: zoomIn 0.2s ease-out;
  overflow: hidden;
}
.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}
.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--text-light);
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 12px 16px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
}
.scan-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.btn-scan-action {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  background: var(--card-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-color-dark);
  position: relative;
}
.btn-scan-action:hover {
  background: var(--primary-light);
  color: var(--primary-text);
  border-color: rgba(var(--primary-color-rgb), 0.3);
}
.btn-scan-action.is-active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}
.btn-scan-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.file-input-hidden {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  opacity: 0;
  cursor: pointer;
}
.form-group {
  margin-bottom: 10px;
}
.label-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.label-row-between label {
  margin-bottom: 0;
}
.btn-toggle-advanced {
  background: var(--primary-light);
  border: 1px solid rgba(52, 81, 178, 0.2);
  font-size: 11px;
  color: var(--primary-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}
.btn-toggle-advanced:hover {
  background: rgba(var(--primary-color-rgb), 0.2);
}
.btn-toggle-advanced.is-active {
  color: #fff;
  background: var(--primary-color);
  border-color: var(--primary-color);
}
.slide-fade-enter-active {
  transition: all 0.25s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-6px);
  opacity: 0;
}
.form-group input, .form-select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border-color-dark);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--item-bg-hover);
  color: var(--text-main);
  box-sizing: border-box;
}
.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.input-with-icon input {
  padding-right: 34px;
}
.icon-toggle-btn {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: color 0.2s;
}
.icon-toggle-btn:hover {
  color: var(--primary-text);
}
.form-group input:focus, .form-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-light);
}
.form-group-row-3 {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.form-group-row-3 .form-group {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}
.form-group-row-3 .form-select, .form-group-row-3 input {
  padding: 6px 4px;
  font-size: 12px;
}
.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color-light);
  display: flex;
  gap: 10px;
  background: var(--card-bg);
  flex-shrink: 0;
}
.btn-primary, .btn-secondary {
  flex: 1;
  padding: 9px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: var(--primary-color);
  color: var(--text-white);
}
.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}
.btn-primary:disabled {
  background: var(--category-bg);
  color: var(--text-light);
  border: 1px solid var(--border-color-light);
  cursor: not-allowed;
  opacity: 0.9;
}
.btn-secondary {
  background: var(--category-bg);
  color: var(--text-secondary);
}
.btn-secondary:hover {
  background: var(--border-color-light);
}
</style>

