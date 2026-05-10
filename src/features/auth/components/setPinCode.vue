<template>
  <div class="state-card fade-in">
    <h3>{{ $t('auth.setup_pin_title') }}</h3>
    <p class="desc">{{ $t('auth.setup_pin_desc') }}</p>
    <div class="input-group">
      <input 
        v-model="pin" 
        type="password" 
        :placeholder="$t('auth.pin_placeholder')" 
        maxlength="6"
        @keyup.enter="handleSetup"
      />
    </div>
    <button class="btn btn-primary" @click="handleSetup" :disabled="pin.length !== 6 || isProcessing">
      {{ isProcessing ? $t('common.saving') : $t('auth.lock_vault') }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'

const { confirmSetupPin } = useExtensionState()
const { t } = useI18n()
const pin = ref('')
const isProcessing = ref(false)

async function handleSetup() {
  isProcessing.value = true
  const result = await confirmSetupPin(pin.value)
  if (!result.success) {
    if (result.error === 'SETUP_DATA_EXPIRED') {
      alert(t('auth.setup_data_expired'))
    } else {
      alert(t('auth.encrypt_failed'))
    }
  }
  isProcessing.value = false
}
</script>

<style scoped>
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: white;
  padding: 32px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  flex: 1;
}
h3 { margin-bottom: 8px; color: #333; }
.desc { font-size: 13px; color: #666; margin-bottom: 24px; line-height: 1.5; }
.input-group { width: 100%; margin-bottom: 20px; }
input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  letter-spacing: 8px;
}
.btn-primary {
  width: 100%;
  padding: 12px;
  background-color: #0f3460;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
}
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>
