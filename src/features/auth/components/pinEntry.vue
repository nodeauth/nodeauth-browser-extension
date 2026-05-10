<template>
  <div class="state-card fade-in">
    <img src="/logo.svg" alt="NodeAuth" class="logo" />
    <p class="desc">{{ $t('auth.locked_desc') }}</p>
    <div class="input-group">
      <input 
        v-model="pin" 
        type="password" 
        maxlength="6"
        @keyup.enter="handleUnlock"
        ref="pinInput"
      />
    </div>
    <button class="btn btn-primary" @click="handleUnlock" :disabled="pin.length !== 6 || isProcessing">
      {{ isProcessing ? $t('auth.unlocking') : $t('auth.unlock') }}
    </button>
    <div class="forgot-pin">
      <a href="#" @click.prevent="handleForgotPin">{{ $t('auth.forgot_pin') }}</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'

const { unlockVault, triggerReset } = useExtensionState()
const { t } = useI18n()

function handleForgotPin() {
  triggerReset(t, t('settings.reset_ext'), t('auth.reset_confirm'))
}
const pin = ref('')
const isProcessing = ref(false)
const pinInput = ref(null)

onMounted(() => {
  pinInput.value?.focus()
})

async function handleUnlock() {
  if (pin.value.length !== 6) return
  isProcessing.value = true
  const result = await unlockVault(pin.value)
  if (!result.success) {
    alert(t('auth.unlock_failed'))
    pin.value = ''
    pinInput.value?.focus()
  }
  isProcessing.value = false
}
</script>

<style scoped>
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* 垂直居中 */
  text-align: center;
  background: white;
  padding: 32px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  flex: 1;
}
.logo { width: 48px; height: 48px; margin-bottom: 16px; }
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

.forgot-pin {
  margin-top: 40px;
}
.forgot-pin a {
  font-size: 13px;
  color: #999;
  text-decoration: none;
  transition: all 0.2s;
}
.forgot-pin a:hover {
  color: #0f3460;
  text-decoration: underline;
}
</style>
