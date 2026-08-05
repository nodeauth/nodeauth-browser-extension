import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSplitOtpFields, getRealBounds, calculateOverlayPosition } from '../../src/processes/content/overlayPositioner.js'
import { CompatibilityManager } from '../../src/processes/content/compatibilityManager.js'

vi.mock('../../src/processes/content/compatibilityManager.js', () => ({
  CompatibilityManager: {
    hasConflict: vi.fn(),
    isGhostInput: vi.fn()
  }
}))

describe('overlayPositioner', () => {
  beforeEach(() => {
    // Reset vi.mock instances
    vi.clearAllMocks()

    // Mock global window and document if not in jsdom environment
    global.window = {
      scrollX: 10,
      scrollY: 20,
      getComputedStyle: vi.fn().mockReturnValue({
        paddingTop: '5px',
        paddingRight: '10px',
        paddingBottom: '5px',
        paddingLeft: '10px'
      })
    }
    global.document = {
      querySelector: vi.fn().mockReturnValue(null)
    }
  })

  it('calculateOverlayPosition calculates standard inputs correctly', () => {
    const mockInput = {
      getAttribute: vi.fn().mockReturnValue('6'),
      getBoundingClientRect: vi.fn().mockReturnValue({
        top: 100,
        left: 200,
        width: 300,
        height: 40,
        right: 500,
        bottom: 140
      }),
      parentElement: null
    }

    const pos = calculateOverlayPosition(mockInput)
    expect(pos).toBeTruthy()
    
    // height = 40, elementOffset = 40 * 0.42 = 16.8
    // elementHeight = 40 - 16.8 = 23.2 => round to 23
    // elementTopPosition = 100 + 16.8 / 2 = 108.4 => round to 108 + scrollY(20) = 128
    // elementLeftPosition = 200 + 300 - 40 + 16.8 / 2 = 460 + 8.4 = 468.4 => round to 468 + scrollX(10) = 478
    expect(pos.height).toBe(23)
    expect(pos.width).toBe(23)
    expect(pos.top).toBe(128)
    expect(pos.left).toBe(478)
    expect(pos.isSplit).toBe(false)
  })

  it('adjusts left position when conflict is detected', () => {
    CompatibilityManager.hasConflict.mockReturnValue(true)
    CompatibilityManager.isGhostInput.mockReturnValue(false)

    const mockInput = {
      getAttribute: vi.fn().mockReturnValue('6'),
      getBoundingClientRect: vi.fn().mockReturnValue({
        top: 100,
        left: 200,
        width: 300,
        height: 40,
        right: 500,
        bottom: 140
      }),
      parentElement: null,
      classList: { contains: vi.fn().mockReturnValue(false) },
      hasAttribute: vi.fn().mockReturnValue(false)
    }

    const pos = calculateOverlayPosition(mockInput)
    // Same height/width as standard, but left should be adjusted by -(finalWidth + 5)
    // finalWidth is 23. Original left is 478.
    // 478 - 23 - 5 = 450
    expect(pos.left).toBe(450)
  })
})
