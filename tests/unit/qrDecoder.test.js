import { describe, it, expect } from 'vitest'
import { parseQrResult } from '@/shared/utils/qrDecoder'

describe('qrDecoder.js Unit Tests', () => {
  it('应当正确解析标准的 otpauth:// TOTP URI 字符串', () => {
    const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30&algorithm=SHA1'
    const result = parseQrResult(uri)

    expect(result).not.toBeNull()
    expect(result.service).toBe('GitHub')
    expect(result.account).toBe('user@example.com')
    expect(result.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(result.type).toBe('totp')
    expect(result.digits).toBe(6)
    expect(result.period).toBe(30)
    expect(result.algorithm).toBe('SHA1')
  })

  it('应当正确解析 steam:// 协议 URI 字符串', () => {
    const uri = 'steam://JBSWY3DPEHPK3PXP'
    const result = parseQrResult(uri)

    expect(result).not.toBeNull()
    expect(result.service).toBe('Steam')
    expect(result.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(result.type).toBe('steam')
    expect(result.digits).toBe(5)
  })

  it('非法的二维码/URI 内容应当安全返回 null', () => {
    expect(parseQrResult('')).toBeNull()
    expect(parseQrResult(null)).toBeNull()
    expect(parseQrResult('https://example.com/not-otp')).toBeNull()
  })
})
