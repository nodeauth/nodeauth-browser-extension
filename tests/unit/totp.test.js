import { describe, it, expect } from 'vitest'
import { buildOtpUri } from '@/shared/utils/totp'

describe('TOTP Utils - buildOtpUri', () => {
  const mockAccount = {
    service: 'NodeAuth',
    account: 'test@example.com',
    secret: 'JBSWY3DPEHPK3PXP', // Base32 for 'Hello!'
    type: 'totp',
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  }

  it('应该能生成标准的 TOTP URI (Happy Path)', () => {
    const uri = buildOtpUri(mockAccount)
    expect(uri).toContain('otpauth://totp/NodeAuth%3Atest%40example.com')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('issuer=NodeAuth')
    expect(uri).toContain('period=30')
  })

  it('应该支持 HOTP 类型并包含 counter', () => {
    const uri = buildOtpUri({ ...mockAccount, type: 'hotp', counter: 42 })
    expect(uri).toContain('otpauth://hotp/')
    expect(uri).toContain('counter=42')
    expect(uri).not.toContain('period=30')
  })

  it('应该正确处理非标准参数 (SHA256, 8位)', () => {
    const uri = buildOtpUri({ ...mockAccount, algorithm: 'SHA256', digits: 8 })
    expect(uri).toContain('algorithm=SHA256')
    expect(uri).toContain('digits=8')
  })

  it('应该对服务名和账号进行 URL 编码', () => {
    const uri = buildOtpUri({ 
      ...mockAccount, 
      service: 'My App!', 
      account: 'user+test@domain.com' 
    })
    expect(uri).toContain('My%20App!%3Auser%2Btest%40domain.com')
    expect(uri).toContain('issuer=My+App%21')
  })

  it('当没有服务名时应提供默认 Issuer', () => {
    const uri = buildOtpUri({ ...mockAccount, service: '' })
    expect(uri).toContain('otpauth://totp/test%40example.com')
    expect(uri).toContain('issuer=NodeAuth')
  })

  it('即使参数缺失也应该生成可用的 URI (边界测试)', () => {
    const uri = buildOtpUri({ secret: 'ABCDEF' })
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('secret=ABCDEF')
  })
})
