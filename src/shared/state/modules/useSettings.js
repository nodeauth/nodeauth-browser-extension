import { ref, watch } from 'vue'
import { setLanguage } from '@/locales/index.js'
import { rpc } from '@/shared/utils/rpc'
const getDefaultLanguage = () => {
  const navLang = navigator.language || navigator.userLanguage || ''
  return navLang.startsWith('zh') ? 'zh-CN' : 'en-US'
}

// 单例状态
const instanceUrl = ref('')
const settings = ref({
  density: 'standard',
  autolock: '0',
  clipboardClear: 'clear_never',
  language: getDefaultLanguage(),
  showServiceIcons: false,
  appShowBadge: true,
  appTheme: 'system', // 'system', 'light', 'dark'
  inlineAutofill: false
})

// 监听设置变化同步到 Storage 和 Background
watch(settings, async (newVal) => {
  await chrome.storage.local.set({
    'sys:ui:density': newVal.density,
    'sys:ui:autolock': newVal.autolock,
    'sys:ui:clipboard': newVal.clipboardClear,
    'sys:ui:locale': newVal.language,
    'sys:ui:show_icons': newVal.showServiceIcons,
    'sys:ui:show_badge': newVal.appShowBadge,
    'sys:ui:theme': newVal.appTheme,
    'sys:ui:inline_autofill': newVal.inlineAutofill,
    'sys:ui:settings': { appShowBadge: newVal.appShowBadge, inlineAutofill: newVal.inlineAutofill }
  })
  setLanguage(newVal.language)
  try {
    rpc.updateLockTimer()
    rpc.refreshBadge()
  } catch (e) { }
}, { deep: true })

async function loadSettings() {
  const data = await chrome.storage.local.get([
    'sys:ui:density',
    'sys:ui:autolock',
    'sys:ui:clipboard',
    'sys:ui:locale',
    'sys:ui:show_icons',
    'sys:ui:show_badge',
    'sys:ui:theme',
    'sys:ui:inline_autofill',
    'sys:state:instance_url'
  ])
  settings.value = {
    density: data['sys:ui:density'] || 'standard',
    autolock: data['sys:ui:autolock'] || '0',
    clipboardClear: data['sys:ui:clipboard'] || 'clear_never',
    language: data['sys:ui:locale'] || getDefaultLanguage(),
    showServiceIcons: data['sys:ui:show_icons'] !== undefined ? data['sys:ui:show_icons'] : false,
    appShowBadge: data['sys:ui:show_badge'] !== undefined ? data['sys:ui:show_badge'] : true,
    appTheme: data['sys:ui:theme'] || 'system',
    inlineAutofill: data['sys:ui:inline_autofill'] !== undefined ? data['sys:ui:inline_autofill'] : false
  }
  instanceUrl.value = data['sys:state:instance_url'] || ''
}


async function startPairing() {
  let url = instanceUrl.value.trim()
  if (!url) return
  if (!url.startsWith('http')) url = 'https://' + url
  if (url.endsWith('/')) url = url.slice(0, -1)
  instanceUrl.value = url

  try {
    const origin = new URL(url).origin

    // 1. 同步发起存储写入（不使用 await），防止在 Firefox 中丢失用户手势 (User Gesture) 上下文
    // 写入断点标记，防止请求权限原生弹窗把 Popup 强杀后丢失状态
    chrome.storage.local.set({ 
      'sys:state:instance_url': url,
      'sys:state:pairing_pending_url': url 
    })

    // 2. 趁着手势上下文还在，立刻请求权限
    // (如果已有权限，Chrome/Firefox 会直接静默返回 true，不会打扰用户)
    const granted = await chrome.permissions.request({
      origins: [`${origin}/*`]
    })

    if (!granted) {
      chrome.storage.local.remove('sys:state:pairing_pending_url')
      throw new Error('User denied permissions')
    }

    // 3. 授权成功（或早已有权限）。
    // 如果刚才弹出了原生授权框，Popup 极有可能已被强杀，将由 Background 接力。
    // 如果代码能走到这里，说明 Popup 并没有被强制关闭，由我们自己继续完成后续逻辑。
    // 清除断点标记，防止产生副作用
    chrome.storage.local.remove('sys:state:pairing_pending_url')

    await rpc.registerContentScript(url)
    const deviceId = crypto.randomUUID()
    chrome.tabs.create({ url: `${url}/login?source=extension&ext_device_id=${deviceId}` })
    window.close()

  } catch (e) {
    console.error('[NodeAuth: Settings] Failed to open pairing page:', e)
    throw e // 抛出错误让外层能捕捉
  }
}

export function useSettings() {
  return {
    instanceUrl,
    settings,
    loadSettings,
    startPairing
  }
}
