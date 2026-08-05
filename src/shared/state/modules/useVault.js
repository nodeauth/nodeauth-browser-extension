import { ref, computed } from 'vue'
import { fetchVaultData, addVaultAccount, incrementHotpCounter } from '@/features/vault/service/vaultApi'
import { unmaskSecret, maskSecret } from '@/shared/utils/crypto'
import { generateToken, getTotpProgress } from '@/shared/utils/totp'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'
import { useUI } from './useUI'
import { rpc } from '@/shared/utils/rpc'
import { isServiceMatchDomain } from '@/shared/utils/domainMatcher'

const fullVaultList = ref([])
const selectedCategory = ref('')
const searchQuery = ref('')
const isLoadingVault = ref(false)
const activeTabUrl = ref('')

let timerInterval = null

export function useVault() {
  const { lockVault, appState, getMemoryMaskingKey, getAllMemoryMaskingKeys } = useAuth()
  const { instanceUrl } = useSettings()
  const { isAddModalOpen, isAddingAccount } = useUI()

  // 匹配当前网页域名的账号列表
  const currentSiteAccounts = computed(() => {
    if (!activeTabUrl.value) return []
    return fullVaultList.value.filter(item => {
      return item.service && isServiceMatchDomain(item.service, activeTabUrl.value)
    })
  })

  // 动态分类提取与数量统计（按数量倒序）
  const categories = computed(() => {
    const counts = {}
    fullVaultList.value.forEach(item => {
      const cat = item.category || '____UNCATEGORIZED____'
      counts[cat] = (counts[cat] || 0) + 1
    })
    
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  })

  // 全部账号数量
  const totalItemsCount = computed(() => fullVaultList.value.length)

  // 最终显示的列表 (计算属性：双重过滤)
  const vaultList = computed(() => {
    return fullVaultList.value.filter(item => {
      const matchSearch = !searchQuery.value || 
        item.service.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.account.toLowerCase().includes(searchQuery.value.toLowerCase())
      
      let matchCategory = true
      if (selectedCategory.value === 'suggestions') {
        matchCategory = item.service && isServiceMatchDomain(item.service, activeTabUrl.value)
      } else if (selectedCategory.value) {
        matchCategory = item.category === selectedCategory.value
      }
      
      return matchSearch && matchCategory
    })
  })

  // 搜索处理 (由于已经是本地过滤，只需更新 searchQuery 即可)
  function performSearch(query) {
    searchQuery.value = query
  }

  // 加载金库数据
  async function loadVault() {
    if (!instanceUrl.value) return
    const maskingKeys = getAllMemoryMaskingKeys()
    if (!maskingKeys || maskingKeys.length === 0) {
      console.warn('[NodeAuth: Vault] No masking key found, skipping load.')
      await lockVault()
      return
    }
    isLoadingVault.value = true
    try {
      // 扩展端采用全量拉取，本地搜索/过滤，以实现零延迟交互
      const rawList = await fetchVaultData() 
      const decryptedList = []
      for (const item of rawList) {
        if (item.secret) {
          try {
            item.decryptedSecret = await unmaskSecret(item.secret, maskingKeys)
            decryptedList.push(item)
          } catch (e) {
            console.error(`[NodeAuth: Vault] Decrypt failed for ${item.service}:`, e)
          }
        }
      }
      fullVaultList.value = decryptedList.map(item => ({
        ...item,
        currentCode: '------',
        remaining: 30,
        percentage: 0,
        type: item.type || 'totp',
        category: item.category || '____UNCATEGORIZED____'
      }))
      startTimer()
      // 🔐 安全演进：为支持网页注入悬浮窗实时计算最新验证码，此处在 Session（纯内存）中存入 masked_secret
      // Background 会利用同在 Session 中的 active_salt 进行动态解密并生成实时 TOTP，整个过程不落盘
      const vaultSummary = fullVaultList.value.map(item => ({
        id: item.id,
        service: item.service || '',
        account: item.account || '',
        masked_secret: item.secret,
        digits: item.digits || 6,
        period: item.period || 30,
        type: item.type || 'totp'
      }))
      if (chrome?.storage?.session?.set) {
        await chrome.storage.session.set({ 'sys:sec:vault_summary': vaultSummary })
      }
      await initActiveTabUrl()
      if (currentSiteAccounts.value.length > 0 && (!selectedCategory.value || selectedCategory.value === 'suggestions')) {
        selectedCategory.value = 'suggestions'
      } else if (!selectedCategory.value) {
        selectedCategory.value = ''
      }
    } catch (e) {
      console.error('[NodeAuth: Vault] loadVault error:', e)
      if (e.message === 'AUTH_EXPIRED') {
        // 清理持久化凭证，防止陷入重启后依然提示输入密码的僵尸状态
        await chrome.storage.local.remove([
          'sys:auth:extension_token', 
          'sys:state:status',
          'sys:sec:enc_device_salt'
        ])
        await lockVault()
        appState.value = 'uninitialized'
      }
    } finally {
      isLoadingVault.value = false
      try { rpc.refreshBadge() } catch (e) {}
    }
  }

  // 新增账号
  async function saveNewAccount(accountData) {
    isAddingAccount.value = true
    try {
      const maskingKey = getMemoryMaskingKey()
      if (!maskingKey) throw new Error('NO_MASKING_KEY')
      
      const masked = await maskSecret(accountData.secret.trim(), maskingKey)
      const payload = {
        service: accountData.service.trim(),
        account: accountData.account.trim(),
        secret: masked,
        type: accountData.type || 'totp',
        category: accountData.category?.trim() || '',
        digits: Number(accountData.digits) || 6,
        period: Number(accountData.period) || 30,
        algorithm: accountData.algorithm || 'SHA1',
        counter: Math.max(0, Math.floor(Number(accountData.counter) || 0))
      }
      await addVaultAccount(payload)
      isAddModalOpen.value = false
      searchQuery.value = ''
      await loadVault()
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    } finally {
      isAddingAccount.value = false
    }
  }

  // --- HOTP 手动递增计数器 ---
  // 用 Set 追踪每个 item 的 loading 状态，防止全局互相干扰
  const incrementingIds = ref(new Set())

  async function handleIncrement(vaultItem) {
    if (incrementingIds.value.has(vaultItem.id)) return
    incrementingIds.value = new Set([...incrementingIds.value, vaultItem.id]) // 触发响应式更新
    try {
      const res = await incrementHotpCounter(vaultItem.id)
      if (res.success) {
        // 直接就地更新内存，不必重新全量请求
        const target = fullVaultList.value.find(i => i.id === vaultItem.id)
        if (target) {
          target.counter = (target.counter || 0) + 1
          target.currentCode = await generateToken({
            secret: target.decryptedSecret,
            digits: target.digits || 6,
            counter: target.counter
          })
        }
      }
    } catch (e) {
      console.error('[NodeAuth: Vault] HOTP increment failed:', e)
    } finally {
      const next = new Set(incrementingIds.value)
      next.delete(vaultItem.id)
      incrementingIds.value = next // 触发响应式更新
    }
  }

  // 定时器管理
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval)
    updateCodes()
    if (import.meta.env.MODE !== 'test') {
      timerInterval = setInterval(updateCodes, 1000)
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  async function updateCodes() {
    for (const item of vaultList.value) {
      if (item.type === 'hotp') {
        if (item.currentCode === '------') {
          item.currentCode = await generateToken({ 
            secret: item.decryptedSecret, 
            digits: item.digits || 6,
            counter: item.counter || 0
          })
        }
        continue
      }
      const period = item.period || 30
      const progress = getTotpProgress(period)
      item.remaining = progress.remaining
      item.percentage = progress.percentage
      if (item.currentCode === '------' || progress.remaining === period) {
        item.currentCode = await generateToken({
          secret: item.decryptedSecret,
          digits: item.digits || 6,
          period: period,
          isSteam: item.type === 'steam'
        })
      }
    }

  }

  async function initActiveTabUrl() {
    try {
      if (chrome?.tabs?.query) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab && activeTab.url) {
          activeTabUrl.value = activeTab.url
        }
      }
    } catch (e) {
      console.warn('[NodeAuth: Vault] Query active tab failed:', e)
    }
  }

  return {
    fullVaultList,
    vaultList,
    categories,
    selectedCategory,
    totalItemsCount,
    isLoadingVault,
    searchQuery,
    incrementingIds,
    activeTabUrl,
    currentSiteAccounts,
    initActiveTabUrl,
    loadVault,
    performSearch,
    saveNewAccount,
    handleIncrement,
    stopTimer
  }
}
