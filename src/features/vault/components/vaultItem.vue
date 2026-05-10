<template>
  <div 
    class="vault-item"
    :class="[settings.density]"
    :style="{ position: 'relative' }"
    role="listitem"
    @click="handleCopyCode"
  >
    <!-- 隐私遮罩 (已移除) -->
    <div class="item-left">
      <VaultIcon :service="item.service" :iconUrl="item.icon" />
      <div class="item-info">
        <div class="service-name">{{ item.service }}</div>
        <div class="account-name">{{ item.account }}</div>
      </div>
    </div>
    <div class="item-right">
      <div class="totp-code">{{ formatCode(item.currentCode) }}</div>
      <!-- HOTP：显示计数器刷新按钮 -->
      <button 
        v-if="item.type === 'hotp'"
        class="hotp-btn"
        :class="{ 'hotp-btn--loading': isThisIncrementing }"
        @click.stop="$emit('increment', item)"
        :disabled="isThisIncrementing"
        :title="$t('vault.increment')"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>

      <!-- TOTP/Steam：显示倒计时圆圈 -->
      <div class="progress-circle" v-else>
        <svg width="30" height="30">
          <circle class="bg" stroke="#eee" stroke-width="2" fill="transparent" r="12" cx="15" cy="15" />
          <circle 
            class="progress" 
            stroke="#2c3e50" 
            stroke-width="2" 
            fill="transparent" 
            r="12" 
            cx="15" 
            cy="15" 
            :style="{ strokeDashoffset: progressOffset(item.percentage) }"
          />
        </svg>
        <span class="progress-text" :class="{ 'text-warning': item.remaining < 5 }">{{ item.remaining }}</span>
      </div>
      
      <!-- 更多操作 -->
      <div class="action-wrapper" @click.stop>
        <button class="action-btn" ref="actionBtnRef" @click="handleToggleMenu">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>
        </button>
        
        <Teleport to="body">
          <div 
            v-if="isMenuOpen" 
            class="action-menu" 
            :style="menuStyles"
            ref="actionMenuRef"
          >
            <div class="menu-item" @click="emitCommand('export')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
              {{ $t('common.export') }}
            </div>
            <div class="menu-item" @click="emitCommand('edit')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              {{ $t('common.edit') }}
            </div>
            <div class="menu-item delete" @click="emitCommand('delete')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              {{ $t('common.delete') }}
            </div>
          </div>
        </Teleport>
      </div>

      <div class="copy-toast" :class="{ 'show': copiedId === item.id }">{{ $t('vault.copied') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VaultIcon from './vaultIcon.vue'
import { useExtensionState } from '@/shared/state/useExtensionState'

const props = defineProps({
  item: { type: Object, required: true },
  // 传入正在递增的 ID 集合，按 item 单独判断，防止全局互碰
  incrementingIds: { type: Object, default: () => new Set() }
})

const emit = defineEmits(['command', 'copy-code', 'increment'])

// 计算当前条目是否正在 loading
const isThisIncrementing = computed(() => props.incrementingIds.has(props.item.id))

const { settings, copiedId, activeDropdownId, toggleDropdown, closeDropdown } = useExtensionState()

const actionBtnRef = ref(null)
const actionMenuRef = ref(null)
const menuStyles = ref({ top: '0', left: '0', position: 'fixed' })

const isMenuOpen = computed(() => activeDropdownId.value === props.item.id)

const handleToggleMenu = async (e) => {
  toggleDropdown(props.item.id)
  if (isMenuOpen.value) {
    const rect = actionBtnRef.value.getBoundingClientRect()
    menuStyles.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.right - 120}px`,
      position: 'fixed'
    }
  }
}

const handleClickOutside = (e) => {
  if (isMenuOpen.value && actionBtnRef.value && !actionBtnRef.value.contains(e.target) && (!actionMenuRef.value || !actionMenuRef.value.contains(e.target))) {
    closeDropdown()
  }
}

// 解决滚动时下拉菜单分离
const handleScroll = () => {
  if (isMenuOpen.value) closeDropdown()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, { capture: true })
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, { capture: true })
  document.removeEventListener('scroll', handleScroll, { capture: true })
})

// 关闭菜单并上报命令
function emitCommand(cmd) {
  closeDropdown()
  emit('command', cmd, props.item)
}

// 复制验证码由父层处理
function handleCopyCode() {
  emit('copy-code', props.item)
}

const radius = computed(() => settings.value.density === 'compact' ? 10 : 12)

function formatCode(code) {
  if (!code || code === '------' || code.length !== 6) return code
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

function progressOffset(percentage) {
  const circumference = radius.value * 2 * Math.PI
  return circumference - (percentage / 100) * circumference
}
</script>

<style scoped>
.vault-item {
  background: white;
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  cursor: pointer;
  position: relative;
  /* 移除 overflow: hidden 以允许菜单悬浮显示 */
  transition: transform 0.1s, box-shadow 0.1s;
}
.vault-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.08);
}
.vault-item:active {
  transform: translateY(1px);
  background: #fcfcfc;
}
.item-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin-right: 8px;
}
.item-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.service-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.account-name {
  font-size: 11px;
  color: #888;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  position: relative;
}
.totp-code {
  font-size: 19px;
  font-weight: 700;
  color: #0f3460;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
  margin-right: 8px;
  transition: color 0.3s;
}
.progress-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
}
.progress-circle .progress {
  stroke-dasharray: 75.398;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s linear;
}
.progress-text {
  position: absolute;
  font-size: 10px;
  font-weight: 700;
  color: #0f3460;
}
.progress-text.text-warning {
  color: #d9534f;
}

/* 操作按钮与菜单 */
.action-wrapper {
  position: relative;
  margin-left: 10px;
}
.action-btn {
  background: none;
  border: none;
  padding: 4px;
  color: #999;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.action-btn:hover {
  background: #f0f0f0;
  color: #0f3460;
}
.action-menu {
  position: fixed;
  z-index: 10000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 4px;
  width: 120px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid #eee;
  transform-origin: top right;
  animation: menuIn 0.2s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.menu-item {
  padding: 9px 14px;
  font-size: 13px;
  color: #444;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.menu-item:hover {
  background: #f5f7fa;
}
.menu-item.delete {
  color: #ff4d4f;
}
.menu-item.delete:hover {
  background: #fff1f0;
}

/* HOTP 计数器刷新按钮 */
.hotp-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid #c8d5e8;
  background: transparent;
  color: #5b8fb9;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.2s;
  flex-shrink: 0;
}
.hotp-btn:hover:not(:disabled) {
  background: #eef4fc;
  border-color: #5b8fb9;
  color: #2c6fad;
}
.hotp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hotp-btn--loading svg {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.copy-toast {
  position: absolute;
  top: -2px; left: -120px; right: -30px; bottom: -2px;
  background: rgba(15, 52, 96, 0.92);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  border-radius: 8px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.copy-toast.show {
  opacity: 1;
}

/* 紧凑模式 */
.vault-item.compact {
  padding: 6px 12px;
  border-radius: 8px;
}
.vault-item.compact :deep(.service-icon-wrapper) {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}
.vault-item.compact .service-name { font-size: 13px; }
.vault-item.compact .account-name { font-size: 10px; }
.vault-item.compact .totp-code { font-size: 17px; }
.vault-item.compact .progress-circle { width: 24px; height: 24px; }
.vault-item.compact .progress-circle svg { width: 24px; height: 24px; }
.vault-item.compact .progress-circle circle { r: 10; cx: 12; cy: 12; }
.vault-item.compact .progress-circle .progress { stroke-dasharray: 62.83; }
.vault-item.compact .progress-text { font-size: 9px; }
/* 紧凑模式：HOTP 按钮与倒计时圆圈对齐 */
.vault-item.compact .hotp-btn { width: 22px; height: 22px; border-width: 1.5px; }
.vault-item.compact .hotp-btn svg { width: 11px; height: 11px; }

/* 防偷窥模糊 */
.ghost-blur .totp-code { filter: blur(4px); user-select: none; }
.ghost-blur:hover .totp-code { filter: none; }
</style>
