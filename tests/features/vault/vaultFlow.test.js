import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/vue'
import VaultList from '@/features/vault/components/vaultList.vue'
import VaultItem from '@/features/vault/components/vaultItem.vue'
import { ref, nextTick } from 'vue'

// --- 全量 Mock 业务状态 ---
const sharedSettings = ref({ density: 'standard', ghostMode: false })
const sharedVaultList = ref([])
const sharedCategories = ref([])
const sharedSelectedCategory = ref('')
const sharedSearchQuery = ref('')
const sharedCopiedId = ref(null)

vi.mock('@/shared/state/useExtensionState', () => ({
  useExtensionState: () => ({
    settings: sharedSettings,
    vaultList: sharedVaultList,
    categories: sharedCategories,
    selectedCategory: sharedSelectedCategory,
    isLoadingVault: ref(false),
    searchQuery: sharedSearchQuery,
    copiedId: sharedCopiedId,
    activeDropdownId: ref(null),
    toggleDropdown: vi.fn(),
    closeDropdown: vi.fn(),
    loadVault: vi.fn(),
    performSearch: vi.fn(q => sharedSearchQuery.value = q),
    copyToClipboard: vi.fn(item => sharedCopiedId.value = item.id)
  })
}))

describe('Advanced UI & Interaction (features/vaultFlow.test.js)', () => {
  beforeEach(() => {
    cleanup()
    vi.useFakeTimers()
    sharedSettings.value = { density: 'standard', ghostMode: false }
    sharedVaultList.value = [
      { id: '1', service: 'Google', account: 'test@gmail.com', currentCode: '123456', remaining: 30, percentage: 100, category: 'Work' },
      { id: '2', service: 'GitHub', account: 'dev', currentCode: '654321', remaining: 15, percentage: 50, category: 'Personal' }
    ]
    sharedCategories.value = [
      { name: 'Work', count: 1 },
      { name: 'Personal', count: 1 }
    ]
    sharedSelectedCategory.value = ''
    sharedSearchQuery.value = ''
    sharedCopiedId.value = null
  })

  // [HP] 验证隐私模式 (Ghost Mode) UI
  it('HP: should apply blur class when Ghost Mode is enabled', async () => {
    sharedSettings.value.ghostMode = true
    const { container } = render(VaultItem, {
      props: { item: sharedVaultList.value[0] },
      global: { mocks: { $t: k => k } }
    })
    
    // 检查是否包含隐私遮罩类名
    expect(container.querySelector('.privacy-mask')).toBeTruthy()
  })

  // [HP] 验证搜索过滤与空状态 (Empty State)
  it('HP & EC: should handle search filtering and empty state', async () => {
    const { rerender } = render(VaultList, {
      global: { mocks: { $t: k => k } }
    })

    // 初始状态应有两个项目
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    // 模拟搜索无匹配
    sharedVaultList.value = []
    sharedSearchQuery.value = 'non-existent'
    await nextTick()
    
    // 验证空状态提示 (Key 为 vault.no_match)
    expect(screen.getByText('vault.no_match')).toBeTruthy()
  })

  // [HP] 验证复制反馈 (Copy Toast)
  it('HP: should show copy toast when item is copied', async () => {
    const { container } = render(VaultItem, {
      props: { item: sharedVaultList.value[0] },
      global: { mocks: { $t: k => k } }
    })

    // 模拟点击复制
    sharedCopiedId.value = '1'
    await nextTick()
    
    const toast = container.querySelector('.copy-toast')
    expect(toast.className).toContain('show')
  })

  // [HP] 验证显示密度切换
  it('HP: should toggle between standard and compact density', async () => {
    const { container } = render(VaultItem, {
      props: { item: sharedVaultList.value[0] },
      global: { mocks: { $t: k => k } }
    })

    expect(container.querySelector('.vault-item').className).toContain('standard')

    sharedSettings.value.density = 'compact'
    await nextTick()
    expect(container.querySelector('.vault-item').className).toContain('compact')
  })
  
  // [HP] 验证分类切换
  it('HP: should toggle category filter and highlight active tag', async () => {
    const { container } = render(VaultList, {
      global: { mocks: { $t: k => k } }
    })
    
    const items = container.querySelectorAll('.category-item')
    expect(items).toHaveLength(3) // 全部 + Work + Personal
    expect(items[0].className).toContain('active') // 默认为 "全部"
    
    // 模拟点击 Work 分类
    await fireEvent.click(items[1])
    sharedSelectedCategory.value = 'Work'
    sharedVaultList.value = [sharedVaultList.value[0]] // 模拟业务层过滤结果
    await nextTick()
    
    expect(items[1].className).toContain('active')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Google')).toBeTruthy()
  })
})
