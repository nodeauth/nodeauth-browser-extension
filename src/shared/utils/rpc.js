/**
 * 跨进程通信总线 (RPC Message Bus)
 *
 * 职责：
 * 封装所有的 chrome.runtime.sendMessage 调用。
 * 提供强类型、带异常拦截和重试机制的异步网关，取代散落在业务各处的原生调用。
 */

async function sendRequest(message) {
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (!response) {
      throw new Error('Background script did not respond (possible context invalidation)')
    }
    // 拦截业务级错误
    if (response.success === false && response.error) {
      throw new Error(response.error)
    }
    return response
  } catch (error) {
    console.error(`[RPC Error] Failed to send ${message.type}:`, error)
    // 可以在这里统一处理“扩展上下文失效”导致的刷新
    if (error.message.includes('Extension context invalidated')) {
      // 强制刷新页面或进行补救
    }
    throw error
  }
}

export const RPC_TYPES = {
  GET_PUBLIC_KEY: 'GET_PUBLIC_KEY',
  EXT_HANDSHAKE_PAYLOAD: 'EXT_HANDSHAKE_PAYLOAD',
  GET_PENDING_SETUP_DATA: 'GET_PENDING_SETUP_DATA',
  GET_VAULT_KEY: 'GET_VAULT_KEY',
  SET_VAULT_KEY: 'SET_VAULT_KEY',
  LOCK_VAULT: 'LOCK_VAULT',
  UPDATE_LOCK_TIMER: 'UPDATE_LOCK_TIMER',
  REGISTER_CONTENT_SCRIPT: 'REGISTER_CONTENT_SCRIPT',
  CAPTURE_ACTIVE_TAB: 'CAPTURE_ACTIVE_TAB',
  REFRESH_BADGE: 'REFRESH_BADGE',
  GET_MATCHED_ACCOUNTS: 'GET_MATCHED_ACCOUNTS'
}

export const rpc = {
  // --- Content Script <-> Background ---
  getPublicKey: () => sendRequest({ type: RPC_TYPES.GET_PUBLIC_KEY }),
  
  getMatchedAccounts: (url) => sendRequest({ type: RPC_TYPES.GET_MATCHED_ACCOUNTS, url }),
  
  sendHandshake: (payload) => sendRequest({ type: RPC_TYPES.EXT_HANDSHAKE_PAYLOAD, payload }),

  // --- Popup <-> Background ---
  getPendingSetupData: () => sendRequest({ type: RPC_TYPES.GET_PENDING_SETUP_DATA }),

  getVaultKey: () => sendRequest({ type: RPC_TYPES.GET_VAULT_KEY }),

  setVaultKey: (salt) => sendRequest({ type: RPC_TYPES.SET_VAULT_KEY, salt }),

  lockVault: () => sendRequest({ type: RPC_TYPES.LOCK_VAULT }),

  updateLockTimer: () => sendRequest({ type: RPC_TYPES.UPDATE_LOCK_TIMER }),

  registerContentScript: (url) => sendRequest({ type: RPC_TYPES.REGISTER_CONTENT_SCRIPT, url }),

  captureActiveTab: () => sendRequest({ type: RPC_TYPES.CAPTURE_ACTIVE_TAB }),

  refreshBadge: () => sendRequest({ type: RPC_TYPES.REFRESH_BADGE })
}
