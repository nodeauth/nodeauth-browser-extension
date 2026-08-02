<template>
  <div class="state-card fade-in">
    <img src="/logo.svg" alt="NodeAuth" class="logo" />
    <h3>{{ $t('auth.connect_vault') }}</h3>
    <p class="desc">{{ $t('auth.connect_desc') }}</p>
    <div class="input-group">
      <input 
        v-model="instanceUrl" 
        type="url" 
        :placeholder="$t('auth.instance_placeholder')" 
        @keyup.enter="handlePairing"
      />
    </div>
    <button class="btn btn-primary" @click="handlePairing" :disabled="!instanceUrl || isPairing">
      {{ isPairing ? $t('auth.pairing') : $t('auth.start_pairing') }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'

const { instanceUrl, startPairing, showToast } = useExtensionState()
const { t } = useI18n()
const isPairing = ref(false)

async function handlePairing() {
  isPairing.value = true
  try {
    await startPairing()
  } catch (e) {
    if (e.message === 'User denied permissions') {
      showToast(t('auth.permission_denied') || '必须授权域名访问才能继续', 'error')
    } else {
      showToast(e.message, 'error')
    }
  } finally {
    isPairing.value = false
  }
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
.logo { width: 48px; height: 48px; margin-bottom: 12px; }
h3 { margin-bottom: 8px; color: #333; }
.desc { font-size: 13px; color: #666; margin-bottom: 24px; line-height: 1.5; }
.input-group { width: 100%; margin-bottom: 20px; }
input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}
input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.btn-primary {
  width: 100%;
  padding: 12px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-hover);
  box-shadow: 0 4px 12px rgba(52, 81, 178, 0.2);
}
.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>
