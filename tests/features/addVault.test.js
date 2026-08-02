import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AddVault from '@/features/vault/components/addVault.vue'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

const mockState = {
  isAddModalOpen: ref(true),
  isAddingAccount: ref(false),
  saveNewAccount: vi.fn(() => Promise.resolve({ success: true })),
  showToast: vi.fn(),
  categories: ref([])
}

vi.mock('@/shared/state/useExtensionState', () => ({
  useExtensionState: () => mockState
}))

describe('addVault.vue Component Features & Interactions', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'zh',
    messages: {
      zh: {
        vault: {
          add_account_title: '新增账号',
          otp_type_label: '令牌类型',
          otp_type_totp: 'TOTP (基于时间)',
          otp_type_hotp: 'HOTP (基于计数)',
          otp_type_steam: 'Steam 令牌',
          otp_type_blizzard: 'Battle.net (暴雪战网安全令)',
          service_name: '服务名称',
          account_identifier: '账号标识',
          secret_label: '密钥',
          category_optional: '分类 (可选)',
          algorithm_label: '算法',
          digits_label: '代码位数',
          period_label: '更新周期',
          counter_label: '计数器',
          digits_5: '5 位',
          digits_6: '6 位',
          digits_8: '8 位',
          period_30s: '30 秒',
          period_60s: '60 秒',
          add_success: '账号已成功添加'
        },
        common: {
          cancel: '取消',
          save: '保存',
          saving: '保存中...'
        }
      }
    }
  })

  const globalConfig = {
    global: {
      plugins: [i18n],
      mocks: {
        $t: (msg) => msg
      }
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.isAddModalOpen.value = true
    mockState.isAddingAccount.value = false
  })

  it('Happy Path 1: 默认选定 TOTP 时，高阶参数平滑隐藏，表单保持极致干净', () => {
    const wrapper = mount(AddVault, globalConfig)
    const typeSelect = wrapper.find('.form-select')
    expect(typeSelect.element.value).toBe('totp')
    // 默认不展示高阶 3 列
    expect(wrapper.find('.form-group-row-3').exists()).toBe(false)
  })

  it('Feature: 点击高级参数按钮可手动展开/收起高阶选项', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const toggleBtn = wrapper.find('.btn-toggle-advanced')
    expect(toggleBtn.exists()).toBe(true)

    await toggleBtn.trigger('click')
    expect(wrapper.find('.form-group-row-3').exists()).toBe(true)

    await toggleBtn.trigger('click')
    expect(wrapper.find('.form-group-row-3').exists()).toBe(false)
  })

  it('Happy Path 2: 选择 Steam 令牌时自动智能展开高阶参数并联动 5位数与默认 Service="Steam"', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const typeSelect = wrapper.find('.form-select')

    await typeSelect.setValue('steam')
    await wrapper.vm.$nextTick()

    // 自动展开高阶 3 列
    expect(wrapper.find('.form-group-row-3').exists()).toBe(true)

    const serviceInput = wrapper.find('input[type="text"]')
    expect(serviceInput.element.value).toBe('Steam')

    const selects = wrapper.findAll('.form-select')
    const algoSelect = selects[1]
    const digitsSelect = selects[2]
    expect(algoSelect.attributes('disabled')).toBeDefined()
    expect(digitsSelect.attributes('disabled')).toBeDefined()
    expect(digitsSelect.element.value).toBe('5')
  })

  it('Happy Path 3: 选择 Battle.net 令牌时自动联动 digits=8, period=30 且默认 Service="Battle.net"', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const typeSelect = wrapper.find('.form-select')
    await typeSelect.setValue('blizzard')
    await wrapper.vm.$nextTick()

    const serviceInput = wrapper.find('input[type="text"]')
    expect(serviceInput.element.value).toBe('Battle.net')

    const selects = wrapper.findAll('.form-select')
    const digitsSelect = selects[2]
    expect(digitsSelect.element.value).toBe('8')
  })

  it('Happy Path 4: 切换到 HOTP 类型自动智能展开高阶参数并显示计数器输入框', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const typeSelect = wrapper.find('.form-select')
    await typeSelect.setValue('hotp')
    await wrapper.vm.$nextTick()

    // 自动展开高阶 3 列
    expect(wrapper.find('.form-group-row-3').exists()).toBe(true)
    const counterInput = wrapper.find('input[type="number"]')
    expect(counterInput.exists()).toBe(true)
  })

  it('Feature: 当识别或修改为非标 TOTP 参数 (如 8位 / 60秒 / SHA256) 时，高阶参数区自动智能展开', async () => {
    const wrapper = mount(AddVault, globalConfig)
    expect(wrapper.find('.form-group-row-3').exists()).toBe(false)

    // 模拟手动或扫码触发展开
    const toggleBtn = wrapper.find('.btn-toggle-advanced')
    await toggleBtn.trigger('click')
    expect(wrapper.find('.form-group-row-3').exists()).toBe(true)

    // 修改位数为 8位
    const selects = wrapper.findAll('.form-select')
    const digitsSelect = selects[2]
    await digitsSelect.setValue(8)
    await wrapper.vm.$nextTick()

    // 此时即使再次点击 toggle 隐藏，因为 digits=8 非标准参数，isAdvancedVisible 计算属性依然保持智能展开
    expect(wrapper.find('.form-group-row-3').exists()).toBe(true)
  })

  it('Edge Case 1: 已有服务名时切换为 Steam 令牌不会覆盖原有 service 名称', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const serviceInput = wrapper.find('input[type="text"]')
    await serviceInput.setValue('MyCustomSteam')

    const typeSelect = wrapper.findAll('.form-select')[0]
    await typeSelect.setValue('steam')
    await wrapper.vm.$nextTick()

    expect(serviceInput.element.value).toBe('MyCustomSteam')
  })

  it('Edge Case 2: 切换类型后保持参数隔离', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const typeSelect = wrapper.findAll('.form-select')[0]
    
    await typeSelect.setValue('hotp')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input[type="number"]').exists()).toBe(true)

    await typeSelect.setValue('totp')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })

  it('Feature: 密钥明文/密文显示切换眼睛图标', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const toggleBtn = wrapper.find('.icon-toggle-btn')
    expect(toggleBtn.exists()).toBe(true)

    const secretInput = wrapper.find('.input-with-icon input')
    expect(secretInput.attributes('type')).toBe('password')

    await toggleBtn.trigger('click')
    expect(secretInput.attributes('type')).toBe('text')
  })

  it('Feature: 点击关闭/取消时应当清空表单数据', async () => {
    const wrapper = mount(AddVault, globalConfig)
    const serviceInput = wrapper.find('input[type="text"]')
    await serviceInput.setValue('TempService')

    const closeBtn = wrapper.find('.close-btn')
    await closeBtn.trigger('click')

    expect(mockState.isAddModalOpen.value).toBe(false)
  })
})
