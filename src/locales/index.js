import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN.json'
import enUS from '@/locales/en-US.json'

// 1. 获取浏览器默认语言（与主站保持一致）
const getBrowserLanguage = () => {
    const navLang = navigator.language || navigator.userLanguage
    if (navLang.startsWith('zh')) return 'zh-CN'
    return 'en-US'
}

// 2. 优先从 chrome.storage 读取缓存（扩展环境不支持 localStorage）
//    使用同步的 getBrowserLanguage 作为兜底
const getStoredLanguage = () => {
    try {
        // 同步从 sessionStorage 读取（用于 vue-i18n 初始化时的同步需求）
        return sessionStorage.getItem('ext_locale') || getBrowserLanguage()
    } catch {
        return getBrowserLanguage()
    }
}

// 3. 配置 i18n（与主站完全一致的配置风格）
export const i18n = createI18n({
    legacy: false, // 使用 Vue 3 Composition API 模式
    locale: getStoredLanguage(),
    fallbackLocale: 'en-US',
    messages: {
        'zh-CN': zhCN,
        'en-US': enUS
    }
})

// 暴露切换语言的快捷函数
export const setLanguage = (lang) => {
    i18n.global.locale.value = lang
    sessionStorage.setItem('ext_locale', lang)
    document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en'
    // 异步持久化到 chrome.storage
    chrome.storage.local.set({ 'sys:ui:locale': lang })
}

// 从 chrome.storage 异步初始化语言（应用启动时调用）
export const initLanguage = async () => {
    const data = await chrome.storage.local.get(['sys:ui:locale'])
    const stored = data['sys:ui:locale']
    if (stored) {
        i18n.global.locale.value = stored
        sessionStorage.setItem('ext_locale', stored)
        document.documentElement.lang = stored === 'zh-CN' ? 'zh-CN' : 'en'
    }
}
