import { describe, it, expect } from 'vitest'
import { isOtpInput, dispatchNativeInput } from '@/processes/content/overlayInjector'

describe('overlayInjector.js Unit Tests', () => {
  describe('isOtpInput 2FA 输入框检测引擎', () => {
    it('应当准确识别 HTML5 标准 autocomplete="one-time-code" 输入框', () => {
      const input = document.createElement('input')
      input.setAttribute('autocomplete', 'one-time-code')
      expect(isOtpInput(input)).toBe(true)
    })

    it('应当准确识别属性/name/id/placeholder 包含 totp, otp, code, 验证码 等关键词的输入框', () => {
      const input1 = document.createElement('input')
      input1.name = 'user_totp_code'
      expect(isOtpInput(input1)).toBe(true)

      const input2 = document.createElement('input')
      input2.placeholder = '请输入 6 位动态验证码'
      expect(isOtpInput(input2)).toBe(true)

      const input3 = document.createElement('input')
      input3.setAttribute('aria-label', 'Enter 2FA Code')
      expect(isOtpInput(input3)).toBe(true)
    })

    it('应当准确识别 maxlength 为 6 或 8 位的数字/文本框', () => {
      const input = document.createElement('input')
      input.type = 'text'
      input.setAttribute('maxlength', '6')
      expect(isOtpInput(input)).toBe(true)
    })

    it('应当安全排除 hidden, submit, checkbox, radio 等非 2FA 文本框', () => {
      const inputHidden = document.createElement('input')
      inputHidden.type = 'hidden'
      inputHidden.name = 'totp'
      expect(isOtpInput(inputHidden)).toBe(false)

      const inputRadio = document.createElement('input')
      inputRadio.type = 'radio'
      expect(isOtpInput(inputRadio)).toBe(false)
    })
  })

  describe('dispatchNativeInput 原生与框架模拟事件分发器', () => {
    it('应当成功设置 input.value 并触发 input 与 change 事件冒泡', () => {
      const input = document.createElement('input')
      input.type = 'text'
      document.body.appendChild(input)

      let inputFired = false
      let changeFired = false

      input.addEventListener('input', () => { inputFired = true })
      input.addEventListener('change', () => { changeFired = true })

      dispatchNativeInput(input, '231309')

      expect(input.value).toBe('231309')
      expect(inputFired).toBe(true)
      expect(changeFired).toBe(true)

      document.body.removeChild(input)
    })
  })
})
