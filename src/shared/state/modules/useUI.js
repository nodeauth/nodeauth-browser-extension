import { ref } from 'vue'
import { useSettings } from './useSettings'

const currentView = ref('main') // 'main' | 'settings'
const isAddModalOpen = ref(false)
const isAddingAccount = ref(false)
const copiedId = ref(null)

const confirmModal = ref({
  open: false,
  title: '',
  desc: '',
  action: null
})

const activeDropdownId = ref(null)

const globalToast = ref({
  show: false,
  message: '',
  type: 'success' // 'success' | 'error' | 'info'
})
let toastTimer = null

export function useUI() {
  const { settings } = useSettings()

  function showToast(message, type = 'success') {
    globalToast.value.message = message
    globalToast.value.type = type
    globalToast.value.show = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      globalToast.value.show = false
    }, 2500)
  }

  function toggleDropdown(id) {
    if (activeDropdownId.value === id) {
      activeDropdownId.value = null
    } else {
      activeDropdownId.value = id
    }
  }

  function closeDropdown() {
    activeDropdownId.value = null
  }


  async function copyToClipboard(input, isRaw = false) {
    if (!input) return
    
    let textToCopy = ''
    let toastId = null

    if (isRaw) {
      // 纯文本模式 (密钥、URI 等)
      textToCopy = input
    } else {
      // 账号对象模式
      if (!input.currentCode || input.currentCode === '------') return
      textToCopy = input.currentCode
      toastId = input.id
      copiedId.value = toastId
      setTimeout(() => {
        if (copiedId.value === toastId) copiedId.value = null
      }, 1500)
    }

    try {
      await navigator.clipboard.writeText(textToCopy)

      // 如果是验证码且开启了自动清理
      if (!isRaw && settings.value.clipboardClear !== 'clear_never') {
        const delay = settings.value.clipboardClear === 'clear_30s' ? 30000 : 60000
        setTimeout(async () => {
          try {
            const currentText = await navigator.clipboard.readText()
            if (currentText === textToCopy) {
              await navigator.clipboard.writeText('')
            }
          } catch (e) {}
        }, delay)
      }
    } catch (e) {
      console.error('[Clipboard] Copy failed:', e)
    }
  }

  return {
    currentView,
    isAddModalOpen,
    isAddingAccount,
    confirmModal,
    copiedId,
    activeDropdownId,
    globalToast,
    showToast,
    toggleDropdown,
    closeDropdown,
    copyToClipboard
  }
}
