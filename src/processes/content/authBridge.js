/**
 * NodeAuth Content Script - 公钥冰封与加密隧道监听器
 *
 * 运行在 ISOLATED 世界，拥有完全的 chrome.runtime API 访问权限。
 * 它通过动态注入 <script> 的方式将公钥冰封到 MAIN 世界的 window 上。
 */

// 移除外部引用以保证单文件输出，防止 Vite 打包为 ES Module 抛出 import 错误
// 跨进程通信微封装
async function sendRequest(message) {
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (!response) throw new Error('Background script did not respond')
    if (response.success === false && response.error) throw new Error(response.error)
    return response
  } catch (error) {
    console.error(`[RPC Error] Failed to send ${message.type}:`, error)
    throw error
  }
}
const MSG_TYPE_RESPONSE = 'NODEAUTH_EXT_PAYLOAD'

let _handshakeDone = false

async function init() {
  try {
    // 1. 向 Background Worker 发出信号，要求其跨越 CSP 屏障将公钥注入 MAIN 世界
    // Background 会使用 chrome.scripting.executeScript 动态执行注入。
    // PWA 端现在的 tryHandshake 已具备至多 1 秒的轮询等待能力，可完美应对这里的异步时差。
    await sendRequest({ type: 'GET_PUBLIC_KEY' })

    // 3. 监听来自 PWA 的加密握手消息
    window.addEventListener('message', async (event) => {
      if (_handshakeDone) return
      if (!event.data || event.data.type !== MSG_TYPE_RESPONSE) return
      
      // 严格校验 origin
      if (event.origin !== window.location.origin) {
        console.warn(`[NodeAuth Extension] 忽略非法 origin: ${event.origin}`)
        return
      }

      const { pubKeyJwk, ciphertext, iv } = event.data
      if (!pubKeyJwk || !ciphertext || !iv) return

      _handshakeDone = true

      try {
        // 直接将密文转发给 Background，Content Script 全程不触碰私钥
        await sendRequest({ 
          type: 'EXT_HANDSHAKE_PAYLOAD', 
          payload: {
            pwaPubKeyJwk: pubKeyJwk,
            ciphertext,
            iv
          }
        })
        console.debug('[NodeAuth Extension] 握手成功！Master Key 已安全落锁。')

      } catch (err) {
        console.error('[NodeAuth Extension] 转发消息失败:', err)
        _handshakeDone = false
      }
    })

  } catch (err) {
    console.error('[NodeAuth Extension] Content Script 初始化异常:', err)
  }
}

import { initOverlayInjector } from './overlayInjector'

init()
initOverlayInjector()
