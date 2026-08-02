/**
 * NodeAuth Background Service Worker - 解密核心与本地锁控中心
 *
 * 职责：
 * 1. 为每个新建的 Tab 动态生成 ECDH 密钥对，私钥保留在 Background 内存中。
 * 2. 接收 Content Script 请求，下发公钥供 PWA 冰封。
 * 3. 接收来自 PWA 的加密载荷 (CipherBlob)。
 * 4. 执行 ECDH 共享密钥推导和 AES-GCM 解密，提取 Master Key 和 Session Token。
 * 5. 实施本地高强度加密落锁，存入 chrome.storage.local。
 */

// 内存中保存每个 Tab 的临时私钥，绝不落盘，绝不传递给 Content Script
const tabPrivateKeys = new Map()

// 🛡️ 内存暂存与运行期暂存已迁移至 chrome.storage.session
// 以适配 Manifest V3 Service Worker 的休眠唤醒机制
// 所有敏感密钥仍然保证不落入持久化本地磁盘 (chrome.storage.local)

// === Content Script 动态注册管理 ===
// 不再使用 manifest 静态全域注入，改为按需精准匹配用户实例域名

/**
 * 为指定实例 URL 动态注册 Content Script
 * 仅匹配该域名，不影响其他任何网站
 */
async function registerContentScript(instanceUrl) {
  try {
    const origin = new URL(instanceUrl).origin
    const matchPattern = `${origin}/*`

    // 先注销旧的（首次注册时会静默失败，无需处理）
    await chrome.scripting.unregisterContentScripts({ ids: ['nodeauth-bridge'] }).catch(() => { })

    await chrome.scripting.registerContentScripts([{
      id: 'nodeauth-bridge',
      matches: [matchPattern],
      js: ['processes/content/authBridge.js'],
      runAt: 'document_start'
    }])
    console.log(`[Background] Content Script 已精准注册至: ${matchPattern}`)
  } catch (e) {
    console.warn('[Background] Content Script 动态注册失败:', e)
  }
}

/**
 * SW 唤醒时恢复 Content Script 注册（应对 Service Worker 休眠后重启）
 */
async function restoreContentScript() {
  const data = await chrome.storage.local.get(['sys:state:instance_url'])
  const instanceUrl = data['sys:state:instance_url']
  if (instanceUrl) {
    await registerContentScript(instanceUrl)
  }
}

// SW 首次安装或浏览器启动时恢复注册
chrome.runtime.onInstalled.addListener(restoreContentScript)
chrome.runtime.onStartup.addListener(restoreContentScript)

// --- 加解密核心库 ---

async function generateKeyPair() {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // 私钥也可导出，因为后面推导需要用到 jwk
    ['deriveKey']
  )
}

async function deriveSharedKey(privateKey, publicKeyJwkStr) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(publicKeyJwkStr),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

async function decryptPayload(sharedKey, ciphertextBase64, ivBase64) {
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  )

  const decodedStr = new TextDecoder().decode(decryptedBuffer)
  return JSON.parse(decodedStr)
}

import { RPC_TYPES } from '@/shared/utils/rpc'
import { isServiceMatchDomain } from '@/shared/utils/domainMatcher'

/**
 * 刷新当前激活 Tab 的自动填充推荐角标 (Badge)
 */
export async function updateBadgeForActiveTab() {
  try {
    // 1. 读取用户设置 appShowBadge (默认 true)
    const settingsRes = await chrome.storage.local.get(['sys:ui:settings', 'sys:ui:show_badge'])
    const settings = settingsRes['sys:ui:settings'] || {}
    const directShowBadge = settingsRes['sys:ui:show_badge']
    const showBadge = directShowBadge !== undefined ? directShowBadge : (settings.appShowBadge !== false)

    if (!showBadge) {
      chrome?.action?.setBadgeText?.({ text: '' })
      return
    }

    // 2. 检查当前是否处于解锁状态并读取 Session 账号摘要
    if (!chrome?.storage?.session?.get) {
      chrome?.action?.setBadgeText?.({ text: '' })
      return
    }
    const sessionRes = await chrome.storage.session.get(['sys:sec:active_salt', 'sys:sec:vault_summary'])
    const salt = sessionRes?.['sys:sec:active_salt']
    const vaultSummary = sessionRes?.['sys:sec:vault_summary'] || []

    if (!salt || !vaultSummary.length) {
      chrome.action.setBadgeText({ text: '' })
      return
    }

    // 3. 获取当前激活标签页 URL
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab || !activeTab.url) {
      chrome.action.setBadgeText({ text: '' })
      return
    }

    // 4. 使用三级递进匹配算法计算当前页面推荐的账号数 (严格仅匹配 service 服务名)
    let count = 0
    for (const item of vaultSummary) {
      if (item.service && isServiceMatchDomain(item.service, activeTab.url)) {
        count++
      }
    }

    if (count > 0) {
      const badgeText = count > 9 ? '9+' : String(count)
      chrome.action.setBadgeText({ text: badgeText })
      chrome.action.setBadgeBackgroundColor({ color: '#2563eb' })
    } else {
      chrome.action.setBadgeText({ text: '' })
    }
  } catch (e) {
    console.warn('[Background] Update badge failed:', e)
    chrome.action.setBadgeText({ text: '' })
  }
}

// 监听标签页切换与网页 URL 变化
chrome.tabs.onActivated.addListener(() => updateBadgeForActiveTab())
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadgeForActiveTab()
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === RPC_TYPES.CAPTURE_ACTIVE_TAB) {
    chrome.tabs.captureVisibleTab(null, { format: 'png' })
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (message.type === RPC_TYPES.REFRESH_BADGE) {
    updateBadgeForActiveTab().then(() => sendResponse({ success: true }))
    return true
  }

  if (message.type === RPC_TYPES.GET_PUBLIC_KEY) {
    handleGetPublicKey(sender.tab.id)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true // 保持通道异步
  }

  if (message.type === 'EXT_HANDSHAKE_PAYLOAD') {
    handleHandshake(message.payload, sender.tab.id, sender.tab.url || sender.url)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('[Background] 握手处理失败:', err)
        sendResponse({ success: false, error: err.message })
      })
    return true // 保持通道异步
  }

  if (message.type === 'GET_PENDING_SETUP_DATA') {
    // Popup 请求内存中的初始化数据
    chrome.storage.session.get(['sys:sec:pending_setup']).then((res) => {
      sendResponse({ success: true, data: res['sys:sec:pending_setup'] || null })
    })
    return true
  }

  if (message.type === 'REGISTER_CONTENT_SCRIPT') {
    registerContentScript(message.url)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }))
    return true
  }

  // --- 会话锁控通信 ---

  if (message.type === 'GET_VAULT_KEY') {
    // Popup 启动时查询是否处于解锁状态
    chrome.storage.session.get(['sys:sec:active_salt']).then((res) => {
      const salt = res['sys:sec:active_salt']
      if (salt) {
        restartAutoLockTimer() // 每次活跃都重置计时器
        sendResponse({ success: true, salt })
      } else {
        sendResponse({ success: false })
      }
    })
    return true
  }

  if (message.type === 'SET_VAULT_KEY') {
    // Popup 验证 PIN 成功后，将 Salt 托管给 Background (Session)
    chrome.storage.session.set({ 'sys:sec:active_salt': message.salt }).then(() => {
      restartAutoLockTimer()
      updateBadgeForActiveTab()
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'LOCK_VAULT') {
    // 立即锁定
    clearLockState().then(() => {
      chrome.action.setBadgeText({ text: '' })
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'UPDATE_LOCK_TIMER') {
    // 当用户在设置中修改了锁定时间，立刻生效
    chrome.storage.session.get(['sys:sec:active_salt']).then((res) => {
      if (res['sys:sec:active_salt']) {
        restartAutoLockTimer()
      }
      sendResponse({ success: true })
    })
    return true
  }
})

// === 活跃状态感知 (用于立即锁定) ===
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    // 弹窗打开时，暂时停止自动锁定计时器，防止在操作中途被锁
    chrome.alarms.clear('autoLockTimer')

    port.onDisconnect.addListener(async () => {
      // 弹窗关闭时，根据用户设置处理锁定逻辑
      const data = await chrome.storage.local.get(['sys:ui:autolock'])
      const delayMode = data['sys:ui:autolock'] || '0'

      if (delayMode === '0') {
        clearLockState()
        console.log('[Background] Popup closed, immediate lock triggered.')
      } else {
        restartAutoLockTimer()
      }
    })
  }
})

// === 自动锁定定时器 (Manifest V3 Alarms) ===

async function restartAutoLockTimer() {
  await chrome.alarms.clear('autoLockTimer')

  const data = await chrome.storage.local.get(['sys:ui:autolock'])
  const delayMode = data['sys:ui:autolock'] || '0' // 默认 0 (立即)

  // 0: 立即 (不在后台缓存，仅靠 onDisconnect 触发)
  // -1: 从不 (系统销毁前不主动锁)
  // 1, 5, 30: 分钟
  if (delayMode === '0' || delayMode === '-1') {
    return
  }

  const delayInMinutes = parseInt(delayMode)
  if (delayInMinutes > 0) {
    chrome.alarms.create('autoLockTimer', { delayInMinutes })
  }
}

async function clearLockState() {
  await chrome.storage.session.remove(['sys:sec:active_salt', 'sys:sec:vault_summary'])
  await chrome.alarms.clear('autoLockTimer')
  chrome.action.setBadgeText({ text: '' })
  console.log('[Background] Vault is now locked (Salt and summary cleared from session memory).')
}

// 监听 alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoLockTimer') {
    await clearLockState()
  } else if (alarm.name === 'clearPendingSetupData') {
    await chrome.storage.session.remove('sys:sec:pending_setup')
    console.warn('[Background] Pending setup data expired and cleared from session.')
  }
})

// 为特定 Tab 生成公钥并注入到页面的 MAIN 世界
async function handleGetPublicKey(tabId) {
  const keyPair = await generateKeyPair()

  // 将私钥存在内存中，仅限此 Tab 使用
  tabPrivateKeys.set(tabId, keyPair.privateKey)

  // 将公钥导出为 JWK 格式
  const pubKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const pubKeyStr = JSON.stringify(pubKeyJwk)

  // 跨越 CSP，利用 Manifest V3 的 scripting 权限直接把公钥打入 MAIN 世界的 window
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (propName, propValue) => {
      try {
        Object.defineProperty(window, propName, {
          value: propValue,
          writable: false,
          configurable: false,
          enumerable: false
        })
        console.debug('[NodeAuth Extension] 公钥已通过底层隔离特权成功注入 MAIN 世界！')
      } catch (e) {
        // 如果重复注入或失败
      }
    },
    args: ['__NODEAUTH_EXT_PUBKEY__', pubKeyStr]
  })
}

// 处理握手解密
async function handleHandshake(payload, tabId, senderUrl) {
  // 1. 获取 Background 内存中的私钥
  const extPrivateKey = tabPrivateKeys.get(tabId)
  if (!extPrivateKey) {
    throw new Error('未找到当前页面的配对私钥，可能是页面刷新导致，请重试')
  }

  // 阅后即焚，防止重放攻击
  tabPrivateKeys.delete(tabId)

  const { pwaPubKeyJwk, ciphertext, iv } = payload

  // 2. 推导共享密钥
  const sharedKey = await deriveSharedKey(extPrivateKey, pwaPubKeyJwk)

  // 3. 解密 Payload
  const decryptedData = await decryptPayload(sharedKey, ciphertext, iv)

  const { token, deviceSalt } = decryptedData

  if (!token || !deviceSalt) {
    throw new Error('解密成功但载荷格式错误，缺少 token 或 deviceSalt')
  }

  console.log('[Background] 成功提取 Master Key 和 Extension Session Token.')

  // 🛡️ 架构加固：敏感数据仅存入 Session，不落盘，防止物理读取风险
  await chrome.storage.session.set({
    'sys:sec:pending_setup': {
      deviceSalt,
      token,
      status: 'ready_to_lock'
    }
  })

  // 🕒 5分钟超时自毁逻辑：若用户未在规定时间内设置 PIN 码，自动擦除内存敏感数据
  await chrome.alarms.clear('clearPendingSetupData')
  chrome.alarms.create('clearPendingSetupData', { delayInMinutes: 5 })

  // 解析并保存来源 PWA 实例的 URL (例如 https://auth.nodeauth.io)
  let instanceUrl = ''
  try {
    if (senderUrl) {
      instanceUrl = new URL(senderUrl).origin
    }
  } catch (e) {
    console.warn('[Background] 解析 sender URL 失败:', e)
  }

  // 仅在持久化层记录状态位与 URL，不记录密钥本身
  await chrome.storage.local.set({
    'sys:state:status': 'ready_to_lock',
    ...(instanceUrl ? { 'sys:state:instance_url': instanceUrl } : {})
  })

  // 配对成功后立即注册精准的 Content Script（替换原来的全域静态注入）
  if (instanceUrl) {
    await registerContentScript(instanceUrl)
  }

  // 尝试弹窗通知用户
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon-48x48.png',
      title: 'NodeAuth',
      message: '扩展程序已获取授权数据，请点击扩展图标设置解锁密码。'
    })
  } catch (e) {
    // 忽略通知权限不足
  }
}

// 自动清理内存垃圾
chrome.tabs.onRemoved.addListener((tabId) => {
  tabPrivateKeys.delete(tabId)
})
