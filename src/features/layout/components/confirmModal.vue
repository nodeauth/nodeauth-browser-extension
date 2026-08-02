<template>
  <div v-if="confirmModal.open" class="modal-overlay confirm-modal fade-in">
    <div class="modal-content">
      <h3 v-if="confirmModal.title">{{ confirmModal.title }}</h3>
      <p class="modal-desc">{{ confirmModal.desc }}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" @click="confirmModal.open = false">{{ $t('common.cancel') }}</button>
        <button class="btn btn-danger" @click="confirmModal.action">{{ confirmModal.confirmText || $t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useExtensionState } from '@/shared/state/useExtensionState'

const { confirmModal } = useExtensionState()
</script>

<style scoped>
.modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}
.modal-content {
  background: white;
  border-radius: 12px;
  padding: 18px 20px 20px;
  width: 100%;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
.modal-content h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
  text-align: center;
}
.modal-desc {
  font-size: 13.5px;
  color: var(--text-secondary, #475569);
  line-height: 1.5;
  margin-bottom: 0;
  text-align: center;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}
.btn {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary {
  background-color: var(--category-bg, #f1f5f9);
  color: var(--text-main, #334155);
}
.btn-danger {
  background: #dc2626;
  color: white;
}
.fade-in {
  animation: fadeIn 0.25s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
