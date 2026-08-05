import { ref, computed } from 'vue'
import { rpc } from '@/shared/utils/rpc'
import { encryptWithPin, decryptWithPin, deriveMaskingKey } from '@/shared/utils/crypto'
import { useSettings } from './useSettings'
import { useUI } from './useUI'
import { useVault } from './useVault'

const appState = ref('loading') // 'loading' | 'uninitialized' | 'ready_to_lock' | 'locked' | 'unlocked'
let memoryDeviceSalt = null
let memoryMaskingKeys = null

let failureCount = 0
let lastFailureTime = 0

export function useAuth() {
  const { loadSettings } = useSettings()
  const { confirmModal, currentView } = useUI()
  
  // 初始化设置与状态
  async function init() {
    // 1. 最先读取断点续传恢复页面标记，确保在页面结束 loading 之前路由状态已就绪，避免闪烁
    const resumeData = await chrome.storage.local.get(['sys:ui:resume_view'])
    if (resumeData['sys:ui:resume_view']) {
      currentView.value = resumeData['sys:ui:resume_view']
      chrome.storage.local.remove('sys:ui:resume_view')
    }

    // 2. 加载设置与校验状态（checkState 会将 appState 设为 unlocked 并触发界面渲染）
    await loadSettings()
    await checkState()
    
    // 3. 建立长连接以便后台感知弹出层关闭（用于立即锁定模式）
    chrome.runtime.connect({ name: 'popup' })
  }

  async function checkState() {
    const data = await chrome.storage.local.get([
      'sys:state:status', 
      'sys:sec:enc_device_salt',
      'sys:auth:extension_token'
    ])
    const hasToken = !!data['sys:auth:extension_token']

    // 1. 尝试从 Background 获取会话盐
    try {
      const bgResponse = await rpc.getVaultKey()
      if (bgResponse && bgResponse.salt && hasToken) {
        memoryDeviceSalt = bgResponse.salt
        const salts = memoryDeviceSalt.split(',')
        memoryMaskingKeys = await Promise.all(salts.map(s => deriveMaskingKey(s.trim())))
        appState.value = 'unlocked'
        
        // 延迟调用 useVault() 以规避循环依赖
        await useVault().loadVault()
        return
      }
    } catch (e) {
      console.warn('[NodeAuth: Auth] Failed to get vault key from background:', e)
    }

    if (data['sys:state:status'] === 'ready_to_lock') {
      // 验证 session 中的握手数据是否还在（防重启丢失）
      try {
        const response = await rpc.getPendingSetupData()
        if (response && response.data && response.data.deviceSalt) {
          appState.value = 'ready_to_lock'
        } else {
          // 数据已丢失（浏览器重启/超时/扩展重载），恢复为未初始化
          await chrome.storage.local.remove(['sys:state:status'])
          appState.value = 'uninitialized'
        }
      } catch (e) {
        await chrome.storage.local.remove(['sys:state:status'])
        appState.value = 'uninitialized'
      }
    } else if (data['sys:sec:enc_device_salt']) {
      appState.value = 'locked'
    } else {
      appState.value = 'uninitialized'
    }
  }

  // 设置 PIN 码并落锁
  async function confirmSetupPin(pin) {
    if (pin.length !== 6) return { success: false }
    
    // [EC] 重复初始化防御：优先检查本地是否已有密钥
    const existing = await chrome.storage.local.get(['sys:sec:enc_device_salt'])
    if (existing['sys:sec:enc_device_salt']) {
      return { success: false, error: 'already_setup' }
    }

    try {
      const response = await rpc.getPendingSetupData()
      if (!response.data || !response.data.deviceSalt || !response.data.token) {
        appState.value = 'uninitialized'
        return { success: false, error: 'SETUP_DATA_EXPIRED' }
      }
      
      const { deviceSalt, token } = response.data

      const encSalt = await encryptWithPin(deviceSalt, pin)
      await chrome.storage.local.set({
        'sys:sec:enc_device_salt': encSalt,
        'sys:auth:extension_token': token,
        'sys:state:status': 'locked'
      })
      
      appState.value = 'locked'
      return { success: true }
    } catch (e) {
      return { success: false, error: 'ENCRYPT_FAILED' }
    }
  }

  // 解锁
  async function unlockVault(pin) {
    // [EC] 暴力破解保护：检查冷却时间 (30s)
    const now = Date.now()
    if (failureCount >= 5 && now - lastFailureTime < 30000) {
      return { success: false, error: 'too_many_attempts' }
    }

    const data = await chrome.storage.local.get(['sys:sec:enc_device_salt'])
    const encSaltBase64 = data['sys:sec:enc_device_salt']
    try {
      const decryptedSalt = await decryptWithPin(encSaltBase64, pin)
      memoryDeviceSalt = decryptedSalt
      const salts = memoryDeviceSalt.split(',')
      memoryMaskingKeys = await Promise.all(salts.map(s => deriveMaskingKey(s.trim())))
      
      failureCount = 0 // 解锁成功，重置计数
      await rpc.setVaultKey(decryptedSalt)
      appState.value = 'unlocked'
      
      await useVault().loadVault()
      return { success: true }
    } catch (e) {
      failureCount++
      lastFailureTime = Date.now()
      return { success: false, error: failureCount >= 5 ? 'too_many_attempts' : e.message }
    }
  }

  // 锁定
  async function lockVault() {
    memoryDeviceSalt = null
    memoryMaskingKeys = null
    appState.value = 'locked'
    
    const vault = useVault()
    vault.fullVaultList.value = []
    vault.searchQuery.value = ''
    vault.stopTimer()
    
    try {
      await rpc.lockVault()
    } catch (e) {
      console.warn('[NodeAuth: Auth] Background lock request failed:', e)
    }
  }

  // 注销
  function triggerSignOut(t) {
    confirmModal.value = {
      open: true,
      title: t('settings.sign_out'),
      desc: t('settings.sign_out_confirm'),
      confirmText: t('settings.sign_out'),
      action: async () => {
        await chrome.storage.local.remove([
          'sys:auth:extension_token', 
          'sys:state:status',
          'sys:sec:enc_device_salt' // 必须清除加密盐，否则会卡在僵尸解锁态
        ])
        await lockVault()
        appState.value = 'uninitialized'
        currentView.value = 'main'
        confirmModal.value.open = false
      }
    }
  }

  // 重置
  function triggerReset(t, customTitle, customDesc) {
    confirmModal.value = {
      open: true,
      title: customTitle || t('settings.reset_confirm_title'),
      desc: customDesc || t('settings.reset_confirm_desc'),
      confirmText: t('settings.reset_ext'),
      action: async () => {
        await chrome.storage.local.clear()
        if (chrome.storage.session) {
          await chrome.storage.session.clear()
        }
        try {
          await rpc.lockVault()
        } catch(e){}
        window.location.reload()
      }
    }
  }

  return {
    appState,
    init,
    confirmSetupPin,
    unlockVault,
    lockVault,
    triggerSignOut,
    triggerReset,
    getMemoryMaskingKey: () => memoryMaskingKeys ? memoryMaskingKeys[0] : null,
    getAllMemoryMaskingKeys: () => memoryMaskingKeys,
    memoryMaskingKeys: computed(() => memoryMaskingKeys)
  }
}
