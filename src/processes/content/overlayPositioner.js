/**
 * 独立负责 NodeAuth 注入图标与菜单的位置及尺寸计算
 */
import { CompatibilityManager } from './compatibilityManager.js'

/**
 * 判断是否为分体式验证码输入框 (Split OTP)
 * @param {HTMLInputElement} input 
 * @returns {HTMLInputElement[]|null} 如果是，返回所有同级的输入框数组；否则返回 null
 */
export function getSplitOtpFields(input) {
  const maxLength = parseInt(input.getAttribute('maxlength') || '0', 10)
  if (maxLength === 1 || input.getAttribute('data-length') === '1') {
    let container = input.parentElement
    for (let i = 0; i < 3; i++) {
      if (!container) break
      const singleInputs = Array.from(container.querySelectorAll('input:not([type="hidden"])'))
        .filter(el => parseInt(el.getAttribute('maxlength') || '0', 10) === 1 && !el.disabled)

      if (singleInputs.length === 6 || singleInputs.length === 8) {
        if (singleInputs.includes(input)) {
          return singleInputs
        }
      }
      container = container.parentElement
    }
  }
  return null
}

/**
 * 获取输入框的准确 Bounds (处理 Ghost Input)
 */
export function getRealBounds(input) {
  let rect = input.getBoundingClientRect()
  let target = input

  // Ghost Input 模式 (例如 shadcn-ui 或 width:0)
  if (!rect.width || !rect.height || rect.width <= 10) {
    let parent = input.parentElement
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const pRect = parent.getBoundingClientRect()
      if (pRect.width > 20 && pRect.height > 10) {
        rect = pRect
        target = parent
        break
      }
      parent = parent.parentElement
    }
  }
  return { rect, target }
}

/**
 * 悬浮按钮位置和大小计算
 * @param {HTMLInputElement} input 
 * @returns {{top: number, left: number, width: number, height: number, isSplit: boolean}|null}
 */
export function calculateOverlayPosition(input) {
  const { rect, target } = getRealBounds(input)
  if (!rect.width || !rect.height) return null

  // 检测是否有第三方扩展竞争 (如 Bitwarden, 1Password)
  const hasConflict = CompatibilityManager.hasConflict(input)

  let top = rect.top
  let left = rect.left
  const width = rect.width
  const height = rect.height

  // 获取 padding 
  const style = window.getComputedStyle(target)
  const fieldPaddingRight = parseInt(style.paddingRight || '0', 10)
  const fieldPaddingLeft = parseInt(style.paddingLeft || '0', 10)

  // 检测分体框
  const splitFields = getSplitOtpFields(input)
  let isSplit = false

  if (splitFields && splitFields.length > 1) {
    isSplit = true
    // 找出最靠右的格子
    let maxRight = -1
    let maxObjectRect = null
    splitFields.forEach(f => {
      const r = f.getBoundingClientRect()
      if (r.right > maxRight) {
        maxRight = r.right
        maxObjectRect = r
      }
    })

    if (maxObjectRect) {
      top = maxObjectRect.top - maxObjectRect.height * 0.39
      left = maxRight - maxObjectRect.height * 0.3
    }
  }

  let elementOffset = height * 0.37
  if (height >= 35) {
    elementOffset = height >= 50 ? height * 0.47 : height * 0.42
  }

  const elementHeight = height - elementOffset

  const elementTopPosition = top + elementOffset / 2
  const elementLeftPosition = fieldPaddingRight > fieldPaddingLeft
    ? left + width - height - (fieldPaddingRight - elementOffset + 2)
    : left + width - height + elementOffset / 2

  let finalLeft = Math.round(window.scrollX + elementLeftPosition)
  const finalWidth = Math.round(elementHeight)

  // 如果存在第三方扩展冲突
  if (hasConflict) {
    // 检查是否为特殊的 6/8 位分体输入框（原生分体或 Shadcn-UI/Discourse 隐藏透明输入框）
    const isSpecial = CompatibilityManager.isGhostInput(input, isSplit)

    if (isSpecial) {
      // 特殊输入框：增加 left，使 NodeAuth 填充图标位于第三方图标的右边
      finalLeft = finalLeft + finalWidth + 5
    } else {
      // 普通输入框：减少 left，使 NodeAuth 填充图标位于第三方图标的左边
      finalLeft = finalLeft - finalWidth - 5
    }
  }

  return {
    top: Math.round(window.scrollY + elementTopPosition),
    left: finalLeft,
    width: finalWidth,
    height: finalWidth,
    isSplit
  }
}
