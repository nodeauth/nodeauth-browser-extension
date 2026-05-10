/**
 * NodeAuth 扩展程序原生 API 请求模块
 *
 * 阶段三架构优化：
 * 1. 内存级 Token 缓存：避免每次 request 都触发 chrome.storage.local 磁盘 I/O
 * 2. 401 断路器：全局统一处理授权失效，通过 RPC 指令后台落锁，不再各自处理
 * 3. chrome.storage.onChanged 监听：确保 Token 变更时内存缓存实时同步
 */

import { rpc } from '@/shared/utils/rpc'

// 内存级缓存（进程内单例）
let _cachedConfig = null

// 监听 storage 变化，实时同步缓存，保证内存态与持久化一致
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes['sys:state:instance_url'] || changes['sys:auth:extension_token']) {
    // 任意关键配置变动，清除缓存让下次请求重新读取
    _cachedConfig = null
  }
})

/**
 * 加载配置，首次从磁盘读取，之后命中内存缓存，零磁盘 I/O
 */
async function getConfig() {
  if (_cachedConfig) return _cachedConfig

  const data = await chrome.storage.local.get([
    'sys:state:instance_url',
    'sys:auth:extension_token'
  ])
  const instanceUrl = data['sys:state:instance_url']
  const token = data['sys:auth:extension_token']

  if (!instanceUrl || !token) {
    throw new Error('未找到 API 实例地址或授权 Token，请尝试重新配对。')
  }

  _cachedConfig = { instanceUrl, token }
  return _cachedConfig
}

/**
 * 统一请求拦截器（内存 Token 缓存 + 401 断路器）
 */
async function request(path, options = {}) {
  const { instanceUrl, token } = await getConfig()

  const url = `${instanceUrl}${path}`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    if (response.status === 401) {
      // 🔐 401 全局断路：清除本地缓存，并通知后台销毁会话密钥
      _cachedConfig = null
      try {
        await rpc.lockVault()
      } catch (e) {
        console.warn('[API] 401 联动锁定失败:', e)
      }
      throw new Error('AUTH_EXPIRED')
    }
    throw new Error(`请求失败: ${response.status}`)
  }

  // 安全解析：防止 204 等空响应触发 SyntaxError
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

/**
 * 拉取金库数据（支持防抖搜索过滤）
 * @param {string} search 搜索关键字
 */
export async function fetchVaultData(search = '') {
  try {
    const query = new URLSearchParams()
    query.append('limit', '1000000')
    if (search) {
      query.append('search', search)
    }

    const result = await request(`/api/vault?${query.toString()}`, { method: 'GET' })

    if (result.success && result.vault) {
      // 过滤掉已放入回收站的数据
      return result.vault.filter(item => !item.deletedAt)
    }

    return []
  } catch (e) {
    console.error('[API] fetchVaultData error:', e)
    throw e
  }
}

/**
 * 新增金库账号
 * @param {Object} data 账号加密载荷
 */
export async function addVaultAccount(data) {
  try {
    const result = await request('/api/vault', {
      method: 'POST',
      body: JSON.stringify(data)
    })

    if (!result.success) {
      throw new Error(result.error || '添加失败')
    }
    return result.item
  } catch (e) {
    console.error('[API] addVaultAccount error:', e)
    throw e
  }
}

/**
 * 更新金库账号
 * @param {string} id 账号ID
 * @param {Object} data 更新载荷
 */
export async function updateVaultAccount(id, data) {
  return request(`/api/vault/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

/**
 * 移入回收站 (软删除)
 * @param {string} id 账号ID
 */
export async function moveToTrash(id) {
  return request(`/api/vault/${id}/trash_move`, { method: 'POST' })
}

/**
 * 递增 HOTP 计数器并刷新验证码
 * @param {string} id 账号 ID
 * @param {string} updatedAt 上次更新时间戳（乐观并发保护）
 */
export async function incrementHotpCounter(id) {
  // 不传 updatedAt，避免时钟偏差导致乐观锁失败
  return request(`/api/vault/${id}/increment`, {
    method: 'PATCH',
    body: JSON.stringify({})
  })
}

/**
 * 彻底物理删除
 * @param {string} id 账号ID
 */
export async function hardDeleteAccount(id) {
  return request(`/api/vault/${id}/trash_hard`, { method: 'DELETE' })
}
