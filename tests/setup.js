import { vi } from 'vitest'

// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(() => Promise.resolve({ success: true })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    connect: vi.fn(() => ({
      onDisconnect: { addListener: vi.fn() }
    }))
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    }
  },
  tabs: {
    create: vi.fn()
  }
}

// Mock crypto.randomUUID
global.crypto.randomUUID = vi.fn(() => 'test-uuid-1234')
