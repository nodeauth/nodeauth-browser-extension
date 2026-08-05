import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CompatibilityManager } from '../../src/processes/content/compatibilityManager.js'

describe('CompatibilityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.document = {
      querySelector: vi.fn()
    }
  })

  it('detects Bitwarden conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('com.bitwarden')) return {} // Found element
      return null
    })

    const mockInput = { hasAttribute: vi.fn().mockReturnValue(false) }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })

  it('ignores Bitwarden if data-bwignore is set', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('com.bitwarden')) return {}
      return null
    })

    const mockInput = { hasAttribute: vi.fn((attr) => attr === 'data-bwignore') }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(false)
  })

  it('detects 1Password conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('1password')) return {}
      return null
    })

    const mockInput = { hasAttribute: vi.fn().mockReturnValue(false) }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })

  it('detects Dashlane conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('dashlane')) return {}
      return null
    })
    const mockInput = { 
      hasAttribute: vi.fn().mockReturnValue(false),
      getAttribute: vi.fn().mockReturnValue(null)
    }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })

  it('detects LastPass conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('LastPass')) return {}
      return null
    })
    const mockInput = { getAttribute: vi.fn().mockReturnValue(null) }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })

  it('ignores Proton Pass if data-protonpass-ignore is set', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('protonpass')) return {}
      return null
    })
    const mockInput = { getAttribute: vi.fn((attr) => attr === 'data-protonpass-ignore' ? 'true' : null) }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(false)
  })

  it('detects Keeper conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('keeper')) return {}
      return null
    })
    const mockInput = { 
      hasAttribute: vi.fn().mockReturnValue(false),
      classList: { contains: vi.fn().mockReturnValue(false) }
    }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })

  it('detects NordPass conflict', () => {
    global.document.querySelector.mockImplementation((selector) => {
      if (selector.includes('nordpass')) return {}
      return null
    })
    const mockInput = { hasAttribute: vi.fn().mockReturnValue(false) }
    const result = CompatibilityManager.hasConflict(mockInput)
    expect(result).toBe(true)
  })
})
