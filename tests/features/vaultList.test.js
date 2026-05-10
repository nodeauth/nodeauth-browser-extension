import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VaultList from '@/features/vault/components/vaultList.vue'
import { ref, computed } from 'vue'

// Mock useExtensionState
const mockState = {
  vaultList: ref([]),
  categories: ref([]),
  selectedCategory: ref(''),
  totalItemsCount: ref(0),
  isLoadingVault: ref(false),
  searchQuery: ref(''),
  performSearch: vi.fn(),
  settings: ref({ density: 'standard' }),
  copyToClipboard: vi.fn()
}

vi.mock('@/shared/state/useExtensionState', () => ({
  useExtensionState: () => mockState
}))

// Mock useVaultActions
const mockActions = {
  isEditModalOpen: ref(false),
  isEditing: ref(false),
  editData: ref({ service: '', account: '', category: '' }),
  isExportModalOpen: ref(false),
  exportData: ref(null),
  exportUri: ref(''),
  qrCodeUrl: ref(''),
  handleCommand: vi.fn(),
  submitEditVault: vi.fn()
}

vi.mock('@/features/vault/composables/useVaultActions', () => ({
  useVaultActions: () => mockActions
}))

// Mock VaultItem component - 使用与 VaultList.vue 内部 import 相同的路径或解析后的绝对路径
vi.mock('@/features/vault/components/vaultItem.vue', () => ({
  default: {
    name: 'VaultItem',
    template: '<div class="vault-item-stub">{{ item.service }}</div>',
    props: ['item']
  }
}))

describe('VaultList.vue Component', () => {
  const globalConfig = {
    global: {
      mocks: {
        $t: (msg) => msg
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.vaultList.value = []
    mockState.categories.value = []
    mockState.selectedCategory.value = ''
    mockState.searchQuery.value = ''
    mockState.isLoadingVault.value = false
    
    mockActions.isEditModalOpen.value = false
    mockActions.isExportModalOpen.value = false
    mockActions.isEditing.value = false
  })

  it('空状态：如果没有账号，应显示空状态提示', () => {
    const wrapper = mount(VaultList, globalConfig)
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('vault.empty')
  })

  it('列表渲染：应该正确渲染账号列表', async () => {
    mockState.vaultList.value = [
      { id: '1', service: 'Service1', account: 'acc1' },
      { id: '2', service: 'Service2', account: 'acc2' }
    ]
    const wrapper = mount(VaultList, globalConfig)
    // 确保列表已渲染
    expect(wrapper.find('.vault-list').exists()).toBe(true)
    const items = wrapper.findAll('.vault-item-stub')
    expect(items.length).toBe(2)
    expect(wrapper.text()).toContain('Service1')
  })

  it('分类切换：点击分类应更新 selectedCategory', async () => {
    mockState.categories.value = [
      { name: 'Work', count: 5 },
      { name: 'Personal', count: 3 }
    ]
    const wrapper = mount(VaultList, globalConfig)
    
    const catItems = wrapper.findAll('.category-item')
    // 第一个是“全部”，第二个是 Work
    await catItems[1].trigger('click')
    expect(mockState.selectedCategory.value).toBe('Work')
  })

  it('搜索触发：输入内容应调用 performSearch', async () => {
    const wrapper = mount(VaultList, globalConfig)
    const input = wrapper.find('.search-bar input')
    
    await input.setValue('test search')
    expect(mockState.performSearch).toHaveBeenCalledWith('test search')
  })

  it('编辑模态框：当 isEditModalOpen 为 true 时应显示', async () => {
    mockActions.isEditModalOpen.value = true
    mockActions.editData.value = { id: '1', service: 'Github', account: 'user1', category: 'Dev' }
    
    const wrapper = mount(VaultList, globalConfig)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('h3').text()).toBe('vault.edit_account')
    
    // 查找服务名称输入框 (第一个输入框)
    const serviceInput = wrapper.findAll('.form-group input')[0]
    await serviceInput.setValue('Github-Updated')
    expect(mockActions.editData.value.service).toBe('Github-Updated')
  })

  it('保存编辑：点击保存按钮应调用 submitEditVault', async () => {
    mockActions.isEditModalOpen.value = true
    const wrapper = mount(VaultList, globalConfig)
    
    await wrapper.find('.btn-primary').trigger('click')
    expect(mockActions.submitEditVault).toHaveBeenCalled()
  })

  it('导出模态框：应显示二维码和操作按钮', async () => {
    mockActions.isExportModalOpen.value = true
    mockActions.qrCodeUrl.value = 'data:image/png;base64,mock'
    mockActions.exportData.value = { service: 'Github', account: 'user1' }
    
    const wrapper = mount(VaultList, globalConfig)
    expect(wrapper.find('.export-modal').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,mock')
    
    const copyBtns = wrapper.findAll('.btn-outline')
    expect(copyBtns).toHaveLength(2) // 复制密钥和复制 URI
  })
})
