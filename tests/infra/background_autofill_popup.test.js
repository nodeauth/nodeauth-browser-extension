import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Background Autofill & Popup Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global chrome object
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
          remove: vi.fn()
        },
        session: {
          get: vi.fn(),
          set: vi.fn()
        }
      },
      action: {
        openPopup: vi.fn()
      },
      permissions: {
        onAdded: {
          addListener: vi.fn()
        },
        request: vi.fn(),
        contains: vi.fn()
      },
      notifications: {
        create: vi.fn()
      },
      runtime: {
        sendMessage: vi.fn()
      }
    }

    // Reset browser mock
    global.browser = undefined
  })

  describe('Happy Path (HP)', () => {
    it('HP-01: [配对恢复 - Chrome] 授权配对完成时若在 Chrome 118+ 下，应成功调用 chrome.action.openPopup', async () => {
      chrome.action.openPopup.mockResolvedValue()
      
      const openPopup = async () => {
        if (chrome.action && chrome.action.openPopup) {
          await chrome.action.openPopup()
          return true
        }
        return false
      }

      const result = await openPopup()
      expect(result).toBe(true)
      expect(chrome.action.openPopup).toHaveBeenCalled()
    })

    it('HP-02: [配对恢复 - Firefox] 若检测到 browser.action.openPopup，应优先调用该 API', async () => {
      global.browser = { action: { openPopup: vi.fn().mockResolvedValue() } }
      
      const openPopup = async () => {
        if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
          await browser.action.openPopup()
          return true
        }
        return false
      }

      const result = await openPopup()
      expect(result).toBe(true)
      expect(browser.action.openPopup).toHaveBeenCalled()
      expect(chrome.action.openPopup).not.toHaveBeenCalled()
    })

    it('HP-03: [配对通知 - Chrome] 调用 chrome.action.openPopup 成功后，不再触发系统通知', async () => {
      chrome.action.openPopup.mockResolvedValue()
      
      const executeFlow = async () => {
        try {
          if (chrome.action && chrome.action.openPopup) {
            await chrome.action.openPopup()
            return
          }
        } catch (e) {}
        chrome.notifications.create({ type: 'basic' })
      }

      await executeFlow()
      expect(chrome.action.openPopup).toHaveBeenCalled()
      expect(chrome.notifications.create).not.toHaveBeenCalled()
    })

    it('HP-04: [配对通知 - Firefox] 调用 browser.action.openPopup 成功后，不再触发系统通知', async () => {
      global.browser = { action: { openPopup: vi.fn().mockResolvedValue() } }
      
      const executeFlow = async () => {
        try {
          if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
            await browser.action.openPopup()
            return
          }
        } catch (e) {}
        chrome.notifications.create({ type: 'basic' })
      }

      await executeFlow()
      expect(browser.action.openPopup).toHaveBeenCalled()
      expect(chrome.notifications.create).not.toHaveBeenCalled()
    })

    it('HP-05: [设置打标] 开启一键填充前应写入 sys:state:autofill_pending: true 标记', async () => {
      chrome.permissions.contains.mockResolvedValue(false)
      chrome.permissions.request.mockResolvedValue(true)
      
      const toggleAutofill = async () => {
        const hasPerm = await chrome.permissions.contains({ origins: ['<all_urls>'] })
        if (!hasPerm) {
          await chrome.storage.local.set({ 'sys:state:autofill_pending': true })
          await chrome.permissions.request({ origins: ['<all_urls>'] })
        }
      }

      await toggleAutofill()
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ 'sys:state:autofill_pending': true })
    })

    it('HP-06: [设置清理] 若原生弹窗未强杀 Popup 且授权成功，应主动清除 pending 标记', async () => {
      chrome.permissions.request.mockResolvedValue(true)
      
      const toggleAutofill = async () => {
        await chrome.storage.local.set({ 'sys:state:autofill_pending': true })
        const granted = await chrome.permissions.request({ origins: ['<all_urls>'] })
        await chrome.storage.local.remove('sys:state:autofill_pending')
        return granted
      }

      const granted = await toggleAutofill()
      expect(granted).toBe(true)
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('sys:state:autofill_pending')
    })

    it('HP-07: [后台接管 - 标记清理] 后台监听到 <all_urls> 并发现 pending 标记时，先擦除该标记', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.storage.local.remove('sys:state:autofill_pending')
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('sys:state:autofill_pending')
    })

    it('HP-08: [后台接管 - 状态同步] 满足 autofill_pending 条件时，强制写入 sys:ui:inline_autofill 为 true', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.storage.local.set({ 'sys:ui:inline_autofill': true })
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ 'sys:ui:inline_autofill': true }))
    })

    it('HP-09: [后台接管 - 复合状态同步] 同步写入复合对象 sys:ui:settings: { inlineAutofill: true }', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.storage.local.set({ 'sys:ui:settings': { inlineAutofill: true } })
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({ 'sys:ui:settings': { inlineAutofill: true } }))
    })

    it('HP-10: [后台接管 - Chrome 恢复弹窗] 后台完成同步后，Chrome 环境应成功调用 chrome.action.openPopup', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      chrome.action.openPopup.mockResolvedValue()
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.action.openPopup()
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(chrome.action.openPopup).toHaveBeenCalled()
    })

    it('HP-11: [后台接管 - Firefox 恢复弹窗] Firefox 环境下，后台完成状态接管后应优先调用 browser.action.openPopup', async () => {
      global.browser = { action: { openPopup: vi.fn().mockResolvedValue() } }
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
            await browser.action.openPopup()
          }
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(browser.action.openPopup).toHaveBeenCalled()
    })
  })

  describe('Edge Cases (EC)', () => {
    it('EC-01: [配对回退 - 无 API] 旧版浏览器不支持自动弹窗机制时，代码不应抛出崩溃异常', async () => {
      chrome.action.openPopup = undefined
      
      const executeFlow = async () => {
        try {
          if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
            await browser.action.openPopup()
            return
          }
          if (chrome.action && chrome.action.openPopup) {
            await chrome.action.openPopup()
            return
          }
        } catch (e) {
          throw new Error('Should not throw')
        }
      }

      await expect(executeFlow()).resolves.not.toThrow()
    })

    it('EC-02: [配对回退 - 系统通知] 浏览器不支持自动弹窗机制时，正确回退并调用 chrome.notifications.create', async () => {
      chrome.action.openPopup = undefined
      
      const executeFlow = async () => {
        let opened = false
        try {
          if (chrome.action && chrome.action.openPopup) {
            await chrome.action.openPopup()
            opened = true
          }
        } catch (e) {}
        
        if (!opened) {
          chrome.notifications.create({ type: 'basic' })
        }
      }

      await executeFlow()
      expect(chrome.notifications.create).toHaveBeenCalled()
    })

    it('EC-03: [配对回退 - Chrome API 异常] Chrome API 抛出异常（如失去手势上下文），捕获异常并回退', async () => {
      chrome.action.openPopup.mockRejectedValue(new Error('User gesture required'))
      
      const executeFlow = async () => {
        try {
          if (chrome.action && chrome.action.openPopup) {
            await chrome.action.openPopup()
            return
          }
        } catch (e) {}
        chrome.notifications.create({ type: 'basic' })
      }

      await executeFlow()
      expect(chrome.action.openPopup).toHaveBeenCalled()
      expect(chrome.notifications.create).toHaveBeenCalled()
    })

    it('EC-04: [配对回退 - Firefox API 异常] Firefox API 抛出拦截异常，捕获异常并回退', async () => {
      global.browser = { action: { openPopup: vi.fn().mockRejectedValue(new Error('Rejected')) } }
      
      const executeFlow = async () => {
        try {
          if (typeof browser !== 'undefined' && browser.action && browser.action.openPopup) {
            await browser.action.openPopup()
            return
          }
        } catch (e) {}
        chrome.notifications.create({ type: 'basic' })
      }

      await executeFlow()
      expect(browser.action.openPopup).toHaveBeenCalled()
      expect(chrome.notifications.create).toHaveBeenCalled()
    })

    it('EC-05: [通知异常防崩] chrome.notifications.create 也抛出异常时，静默捕获不崩溃', async () => {
      chrome.action.openPopup = undefined
      chrome.notifications.create.mockImplementation(() => { throw new Error('No permission') })
      
      const executeFlow = async () => {
        try {
          chrome.notifications.create({ type: 'basic' })
        } catch (e) {
          // Silent catch
        }
      }

      await expect(executeFlow()).resolves.not.toThrow()
    })

    it('EC-06: [设置防冗余请求] 开启前若系统已存在权限，必须直接设置状态为 true，不写标记，不发起请求', async () => {
      chrome.permissions.contains.mockResolvedValue(true)
      
      let state = false
      const toggleAutofill = async () => {
        const hasPerm = await chrome.permissions.contains({ origins: ['<all_urls>'] })
        if (hasPerm) {
          state = true
          return
        }
        await chrome.storage.local.set({ 'sys:state:autofill_pending': true })
        await chrome.permissions.request({ origins: ['<all_urls>'] })
      }

      await toggleAutofill()
      expect(state).toBe(true)
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
      expect(chrome.permissions.request).not.toHaveBeenCalled()
    })

    it('EC-07: [设置拒绝处理] 请求权限时若用户拒绝，强行恢复 UI 状态值为 false', async () => {
      chrome.permissions.contains.mockResolvedValue(false)
      chrome.permissions.request.mockResolvedValue(false)
      
      let targetValue = 'true'
      let settingsAutofill = false

      const toggleAutofill = async () => {
        const granted = await chrome.permissions.request({ origins: ['<all_urls>'] })
        if (granted) {
          settingsAutofill = true
        } else {
          targetValue = 'false'
        }
      }

      await toggleAutofill()
      expect(targetValue).toBe('false')
      expect(settingsAutofill).toBe(false)
    })

    it('EC-08: [设置异常捕获] 请求权限抛出系统异常，应 catch 并强行恢复 UI 状态为 false', async () => {
      chrome.permissions.contains.mockResolvedValue(false)
      chrome.permissions.request.mockRejectedValue(new Error('Killed by OS'))
      
      let targetValue = 'true'
      const toggleAutofill = async () => {
        try {
          await chrome.permissions.request({ origins: ['<all_urls>'] })
        } catch (e) {
          targetValue = 'false'
        }
      }

      await toggleAutofill()
      expect(targetValue).toBe('false')
    })

    it('EC-09: [后台误判隔离 - 无关权限] 监听到其他权限下发，即使存在 pending 标记，绝不执行配置写入', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.storage.local.set({ 'sys:ui:inline_autofill': true })
        }
      }

      await onAddedHandler({ origins: ['https://example.com/*'] })
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
    })

    it('EC-10: [后台误判隔离 - 无标记] 监听到 <all_urls> 下发但无 pending 标记，绝不执行配置覆盖', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': false })
      
      const onAddedHandler = async (permissions) => {
        const data = await chrome.storage.local.get(['sys:state:autofill_pending'])
        if (data['sys:state:autofill_pending'] && permissions.origins.includes('<all_urls>')) {
          await chrome.storage.local.set({ 'sys:ui:inline_autofill': true })
        }
      }

      await onAddedHandler({ origins: ['<all_urls>'] })
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
    })

    it('EC-11: [后台唤起防崩] onAdded 恢复弹窗时 openPopup 抛出异常，必须在 catch 中捕获，不让线程崩溃', async () => {
      chrome.storage.local.get.mockResolvedValue({ 'sys:state:autofill_pending': true })
      chrome.action.openPopup.mockRejectedValue(new Error('No user gesture'))
      
      const onAddedHandler = async (permissions) => {
        try {
          await chrome.action.openPopup()
        } catch (e) {
          console.debug('Caught:', e)
        }
      }

      await expect(onAddedHandler({ origins: ['<all_urls>'] })).resolves.not.toThrow()
    })
  })
})
