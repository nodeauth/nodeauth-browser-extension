import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useVaultActions } from '@/features/vault/composables/useVaultActions'
import * as vaultApi from '@/features/vault/service/vaultApi'

// Mock dependencies
vi.mock('@/features/vault/service/vaultApi')
vi.mock('@/shared/utils/crypto', () => ({
  encryptWithPin: vi.fn(),
  decryptWithPin: vi.fn(),
  deriveMaskingKey: vi.fn(() => Promise.resolve('mock-key')),
  maskSecret: vi.fn((s) => Promise.resolve(`masked-${s}`)),
  unmaskSecret: vi.fn((s) => Promise.resolve(s.replace('masked-', '')))
}))
vi.mock('qrcode', () => ({
  toDataURL: vi.fn(() => Promise.resolve('mock-qrcode-url'))
}))
vi.mock('@/locales/index.js', () => ({
  setLanguage: vi.fn(),
  i18n: {
    global: {
      t: (key) => key
    }
  }
}))

describe('useExtensionState - Vault Actions', () => {
  const state = useExtensionState()
  const { 
    vaultList, 
    categories, 
    selectedCategory, 
    loadVault, 
    confirmModal,
    settings,
    unlockVault,
    instanceUrl
  } = state

  const actions = useVaultActions(state)
  const { editData, submitEditVault, handleCommand } = actions

  const mockData = [
    { id: '1', service: 'Github', account: 'user1', category: 'Dev', secret: 'AAAAAAAAAAAAAAAA' },
    { id: '2', service: 'Google', account: 'user2', category: 'Social', secret: 'AAAAAAAAAAAAAAAA' },
    { id: '3', service: 'Gitlab', account: 'user3', category: 'Dev', secret: 'AAAAAAAAAAAAAAAA' },
    { id: '4', service: 'None', account: 'user4', category: 'uncategorized', secret: 'AAAAAAAAAAAAAAAA' }
  ]

  beforeEach(async () => {
    vi.clearAllMocks()
    instanceUrl.value = 'http://localhost'
    
    // 模拟解锁以设置 internal memoryMaskingKey
    // 由于 memoryMaskingKey 在模块作用域，我们需要通过 unlockVault 设置它
    // 首先 mock chrome.storage.local.get
    chrome.storage.local.get.mockResolvedValue({ 'sys:sec:enc_device_salt': 'enc-salt' })
    const { decryptWithPin } = await import('@/shared/utils/crypto')
    decryptWithPin.mockResolvedValue('decrypted-salt')
    
    vaultApi.fetchVaultData.mockResolvedValue(mockData)
    await unlockVault('123456')
  })

  it('分类统计逻辑：应该正确计算数量并按降序排列', async () => {
    // 模拟已加载数据
    await loadVault()
    
    expect(categories.value).toHaveLength(3)
    expect(categories.value[0]).toEqual({ name: 'Dev', count: 2 }) // Dev 有 2 个
    expect(categories.value[1].count).toBe(1)
  })

  it('分类筛选逻辑：选中分类后应过滤列表', async () => {
    await loadVault()
    
    selectedCategory.value = 'Dev'
    expect(vaultList.value).toHaveLength(2)
    expect(vaultList.value[0].service).toBe('Github')
    
    selectedCategory.value = 'Social'
    expect(vaultList.value).toHaveLength(1)
    expect(vaultList.value[0].service).toBe('Google')

    selectedCategory.value = '' // 全部
    expect(vaultList.value).toHaveLength(4)
  })

  it('编辑状态初始化：handleCommand("edit") 应该填充正确的数据', () => {
    const item = mockData[0]
    handleCommand('edit', item)
    
    expect(editData.value.id).toBe('1')
    expect(editData.value.service).toBe('Github')
    expect(editData.value.category).toBe('Dev')
  })

  it('保存编辑：应调用 updateVaultAccount 并重新加载', async () => {
    editData.value = { id: '1', service: 'Github-New', account: 'user1', category: 'Work' }
    await submitEditVault()
    
    expect(vaultApi.updateVaultAccount).toHaveBeenCalledWith('1', {
      service: 'Github-New',
      account: 'user1',
      category: 'Work'
    })
    expect(vaultApi.fetchVaultData).toHaveBeenCalled()
  })

  it('智能删除：开启回收站时应调用 moveToTrash', async () => {
    settings.value.appTrashMode = true
    const item = mockData[0]
    
    handleCommand('delete', item)
    expect(confirmModal.value.open).toBe(true)
    
    // 模拟点击确认
    await confirmModal.value.action()
    expect(vaultApi.moveToTrash).toHaveBeenCalledWith('1')
    expect(vaultApi.hardDeleteAccount).not.toHaveBeenCalled()
  })

  it('Happy Path 5: saveNewAccount 正确透传高级参数与多类型 (Steam, HOTP, 8位)', async () => {
    const { saveNewAccount } = state
    await saveNewAccount({
      service: 'SteamService',
      account: 'steam_user',
      secret: 'JBSWY3DPEHPK3PXP',
      type: 'steam',
      digits: 5,
      period: 30,
      algorithm: 'SHA1'
    })

    expect(vaultApi.addVaultAccount).toHaveBeenCalledWith(expect.objectContaining({
      service: 'SteamService',
      type: 'steam',
      digits: 5,
      period: 30,
      algorithm: 'SHA1'
    }))
  })

  it('Edge Case 3: saveNewAccount 缺失参数安全降级与非法 counter 清洗', async () => {
    const { saveNewAccount } = state
    await saveNewAccount({
      service: 'IncompleteService',
      account: 'test_user',
      secret: 'JBSWY3DPEHPK3PXP',
      counter: -10 // 非法负数计数器
    })

    expect(vaultApi.addVaultAccount).toHaveBeenCalledWith(expect.objectContaining({
      service: 'IncompleteService',
      type: 'totp',
      category: 'uncategorized',
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
      counter: 0 // Math.max(0, Math.floor(-10)) 清洗为 0
    }))
  })

  it('Happy Path 6: activeTabUrl 匹配 GitHub 页面时，currentSiteAccounts 正确识别并自动激活 current_site 分类', async () => {
    const { activeTabUrl, currentSiteAccounts, selectedCategory, vaultList, fullVaultList } = state
    fullVaultList.value = [
      { id: '1', service: 'GitHub', account: 'git_user', category: 'work' },
      { id: '2', service: 'Google', account: 'google_user', category: 'personal' }
    ]
    activeTabUrl.value = 'https://github.com/login'
    selectedCategory.value = 'current_site'

    expect(currentSiteAccounts.value.length).toBe(1)
    expect(currentSiteAccounts.value[0].service).toBe('GitHub')
    expect(vaultList.value.length).toBe(1)
    expect(vaultList.value[0].id).toBe('1')
  })

  it('Edge Case 4: activeTabUrl 无匹配时，currentSiteAccounts 为空，选中全部时列表输出全量', async () => {
    const { activeTabUrl, currentSiteAccounts, selectedCategory, vaultList, fullVaultList } = state
    fullVaultList.value = [
      { id: '1', service: 'GitHub', account: 'git_user', category: 'work' },
      { id: '2', service: 'Google', account: 'google_user', category: 'personal' }
    ]
    activeTabUrl.value = 'https://unknown-site.org'
    selectedCategory.value = ''

    expect(currentSiteAccounts.value.length).toBe(0)
    expect(vaultList.value.length).toBe(2)
  })
})
