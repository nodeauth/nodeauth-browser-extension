import { describe, it, expect } from 'vitest'
import { 
  encryptWithPin, 
  decryptWithPin, 
  deriveMaskingKey,
  maskSecret,
  unmaskSecret
} from '@/shared/utils/crypto'

describe('Crypto Utilities (unit/crypto.test.js)', () => {
  const testData = 'Sensitive Data 123'
  const testPin = '654321'

  it('HP: should encrypt and decrypt data correctly with same PIN', async () => {
    const encrypted = await encryptWithPin(testData, testPin)
    const decrypted = await decryptWithPin(encrypted, testPin)
    expect(decrypted).toBe(testData)
  })

  it('EC: should throw error when decrypting with wrong PIN', async () => {
    const encrypted = await encryptWithPin(testData, testPin)
    await expect(decryptWithPin(encrypted, '000000')).rejects.toThrow()
  })

  // [修正] ArrayBuffer 比较使用 Uint8Array 转换
  it('HP: should derive identical masking keys for same salt', async () => {
    const salt = 'constant-salt'
    const key1 = await deriveMaskingKey(salt)
    const key2 = await deriveMaskingKey(salt)
    
    expect(new Uint8Array(key1)).toStrictEqual(new Uint8Array(key2))
  })

  // [修正] 传递正确的 maskingKeyBuffer (ArrayBuffer 类型)
  it('HP: should mask and unmask secrets correctly', async () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const salt = 'device-salt'
    const maskingKeyBuffer = await deriveMaskingKey(salt)
    
    const masked = await maskSecret(secret, maskingKeyBuffer)
    expect(masked).toMatch(/^nodeauth:/)
    
    const unmasked = await unmaskSecret(masked, maskingKeyBuffer)
    expect(unmasked).toBe(secret)
  })
})
