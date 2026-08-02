import { describe, it, expect } from 'vitest'
import { deriveMaskingKey, unmaskSecret, maskSecret } from '../../src/shared/utils/crypto'
import { generateToken } from '../../src/shared/utils/totp'

describe('Background GET_MATCHED_ACCOUNTS Integration', () => {
  it('should successfully unmask and generate token', async () => {
    // 1. Setup real keys
    const saltStr = 'test_salt'
    const maskingKey = await deriveMaskingKey(saltStr)
    const maskingKeys = [maskingKey]

    // 2. Mock a vault item with real masked secret
    const rawSecret = 'JBSWY3DPEHPK3PXP'
    const masked = await maskSecret(rawSecret, maskingKey)
    
    const item = {
      id: '1',
      service: 'github.com',
      account: 'test',
      masked_secret: masked,
      digits: 6,
      period: 30,
      type: 'totp'
    }

    // 3. Run the exact logic from background/index.js
    let code = ''
    try {
      if (item.masked_secret && item.type !== 'hotp') {
        const secret = await unmaskSecret(item.masked_secret, maskingKeys)
        if (secret) {
          code = await generateToken({
            secret: secret,
            digits: item.digits || 6,
            period: item.period || 30,
            isSteam: item.type === 'steam',
            type: item.type
          })
        }
      }
    } catch (e) {
      code = 'ERR: ' + e.message
    }

    // 4. Verify
    expect(code).not.toBe('')
    expect(code).not.toContain('ERR:')
    expect(code.length).toBe(6)
  })
})
