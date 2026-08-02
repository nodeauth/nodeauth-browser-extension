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
    const granted = await chrome.permissions.request({
      origins: [`${origin}/*`]
    })

    if (!granted) {
      throw new Error('User denied permissions')
    }

    await chrome.storage.local.set({ 'sys:state:instance_url': url })

    // 主动通知 Background 立即精准注入桥接脚本，修复时序漏洞
    await rpc.registerContentScript(url)

    const deviceId = crypto.randomUUID()
    const authUrl = `${url}/login?source=extension&ext_device_id=${deviceId}`
    chrome.tabs.create({ url: authUrl })
    window.close()
  } catch (e) {
    console.error('Failed to open pairing page:', e)
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
