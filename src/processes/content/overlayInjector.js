/**
 * 网页 2FA 输入框图标注入与自动填充器 (Content Script Overlay Injector)
 * 
 * 核心能力：
 * 1. 智能 2FA 输入框检测算法 (isOtpInput)
 * 2. 零样式污染的 Shadow DOM 图标悬浮容器 (Shadow Root Mount)
 * 3. 突破 React/Vue/Angular 框架响应式拦截的原生模拟键盘事件填充 (dispatchNativeInput)
 * 
 * 注意：Content Script 不依赖外部 chunk（rpc.js），直接内联 sendRequest 以确保单文件可运行。
 */
import { calculateOverlayPosition, getSplitOtpFields } from './overlayPositioner.js'

// 存储所有当前活跃的更新函数，以便在全局 DOM 发生变动时同步更新所有位置
const activeUpdaters = new Set()

// 防抖工具函数
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// 内联 RPC 发送函数，避免 Content Script 依赖被 Vite 拆包的 rpc chunk
async function sendRequest(message) {
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (!response) throw new Error('Background script did not respond')
    if (response.success === false && response.error) throw new Error(response.error)
    return response
  } catch (error) {
    throw error
  }
}


// 为避免 Vite 将多语言 JSON 抽离成独立 chunk 导致 Content Script (经典脚本环境) 抛出
// "Cannot use import statement outside a module" 错误，且避免上百个与注入无关的翻译键使脚本臃肿，
// 此处采用精简版的内联字典独立维护注入脚本所需的三条文案。
const locales = {
  'zh-CN': {
    autofill_btn_title: 'NodeAuth 快捷填充 2FA 验证码',
    autofill_header: '填写验证码 (NodeAuth)',
    autofill_submit: '填充并自动提交',
    autofill_locked: '🔒 NodeAuth处于锁定状态，点击解锁',
    autofill_empty: '没有找到匹配的账号',
    autofill_fetching: '获取中'
  },
  'en-US': {
    autofill_btn_title: 'NodeAuth Quick Fill 2FA Code',
    autofill_header: 'Fill 2FA Code (NodeAuth)',
    autofill_submit: 'Fill and Auto-Submit',
    autofill_locked: '🔒 NodeAuth is locked, click to unlock',
    autofill_empty: 'No matching accounts found',
    autofill_fetching: 'Fetching...'
  }
}
let currentLang = 'en-US'

function t(key) {
  return locales[currentLang]?.[key] || locales['en-US'][key] || key
}

// 向 Background 请求当前网页匹配的账号（含实时 TOTP code）
async function getMatchedAccounts(url) {
  return sendRequest({ type: 'GET_MATCHED_ACCOUNTS', url })
}

/**
 * 校验 DOM Input 元素是否为 2FA / TOTP 验证码输入框
 * @param {HTMLInputElement} input 
 * @returns {boolean}
 */
export function isOtpInput(input) {
  if (!input || input.tagName !== 'INPUT') return false

  const type = (input.type || '').toLowerCase()
  if (type === 'hidden' || type === 'submit' || type === 'checkbox' || type === 'radio' || type === 'file') {
    return false
  }

  // 1. 识别 HTML5 标准属性
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()
  if (autocomplete === 'one-time-code') return true

  // 2. 识别属性与 name/id/placeholder/class/pattern/inputmode 关键词
  const attrStr = [
    input.name,
    input.id,
    input.placeholder,
    input.className,
    input.getAttribute('aria-label'),
    input.getAttribute('pattern'),
    input.getAttribute('inputmode')
  ].filter(Boolean).join(' ').toLowerCase()

  const otpKeywords = [
    '2facode', 'approvals_code', 'mfacode', 'onetimecode', 'onetimepassword',
    'otc-code', 'otp-code', 'otpcode', 'second-factor', 'security_code',
    'security code', 'totp', 'totpcode', 'twofa', 'twofactor', 'twofactorcode',
    'verificationcode', 'verification code', 'otc-confirmation',
    'code', 'pin', 'otc', 'otp', '2fa', 'mfa',
    'authenticator', 'verification', 'token', 'authcode', 'app_otp', 'app_totp', '验证码', '动态码'
  ]
  const hasKeyword = otpKeywords.some(kw => attrStr.includes(kw))

  // 3. 校验 maxlength 与类型 (如 6 位或 8 位数字框)
  const maxLength = parseInt(input.getAttribute('maxlength'), 10)
  const isDigitBox = maxLength === 6 || maxLength === 8

  // 严格排除密码字段（除非明确包含 otp/2fa）
  const isPasswordField = attrStr.includes('password') || attrStr.includes('passwd') || attrStr.includes('pwd') || attrStr.includes('密码')
  if (isPasswordField && !attrStr.includes('otp') && !attrStr.includes('2fa') && !attrStr.includes('totp')) {
    return false
  }

  if (hasKeyword) return true
  if (isDigitBox && (type === 'text' || type === 'number' || type === 'tel')) return true

  // 4. 分体式单字符输入框 (Split OTP)
  const splitFields = getSplitOtpFields(input)
  if (splitFields && splitFields.length > 1) {
    // 仅在最后一个输入框上判定为 true，避免在所有格子上都弹图标
    if (input === splitFields[splitFields.length - 1]) {
      return true
    }
  }

  return false
}

/**
 * 模拟原生事件，将 6位 验证码精准填入输入框，突破 React/Vue SyntheticEvent 拦截
 * @param {HTMLInputElement} inputElement 
 * @param {string} code 
 */
export function dispatchNativeInput(inputElement, code) {
  if (!inputElement || !code) return

  try {
    // 检查是否为分体式输入框
    const splitFields = getSplitOtpFields(inputElement)
    if (splitFields && splitFields.length > 0) {
      // 逐个填入单个字符
      splitFields.forEach((inp, idx) => {
        const char = code[idx] || ''
        inp.focus()
        const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeValueSetter) {
          nativeValueSetter.call(inp, char)
        } else {
          inp.value = char
        }
        inp.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        inp.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
      })
      return
    }

    inputElement.focus()

    // 核心突破：直接调用 HTMLInputElement 原生 Prototype Setter，绕过 Vue/React 的代理重写
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    if (nativeValueSetter) {
      nativeValueSetter.call(inputElement, code)
    } else {
      inputElement.value = code
    }

    // 依次触发 input 与 change 事件冒泡
    inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  } catch (e) {
    console.warn('[NodeAuth Overlay] Auto-fill failed:', e)
    inputElement.value = code
  }
}

/**
 * 在输入框右侧内悬浮挂载 NodeAuth 🛡️ 图标
 * @param {HTMLInputElement} input 
 * @param {Array} accounts 
 */
export function mountInlineIcon(input, accounts, isLocked = false) {
  if (!input || !accounts || input.dataset.nodeauthInjected) return
  input.dataset.nodeauthInjected = 'true'

  // 创建隔离宿主包裹层
  const container = document.createElement('div')
  container.className = 'nodeauth-inline-host'
  container.style.cssText = `
    position: absolute;
    display: inline-flex;
    align-items: center;
    z-index: 2147483647;
    pointer-events: auto;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    inset: auto;
    overflow: visible;
  `

  // 尝试使用最新的 Popover API，强制置于 top-layer，无视任何原生 <dialog> 或 stacking context
  try {
    if (typeof container.showPopover === 'function') {
      container.setAttribute('popover', 'manual')
    }
  } catch (e) { }

  const shadow = container.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = `
    .shield-btn {
      width: 22px;
      height: 22px;
      background: #175DDC;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(23, 93, 220, 0.35);
      transition: transform 0.15s ease, background 0.15s ease;
      user-select: none;
    }
    .shield-btn:hover {
      background: #124bb3;
      transform: scale(1.08);
    }
    .shield-btn svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .overlay-menu {
      position: absolute;
      top: 30px;
      right: 0;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      padding: 8px;
      width: 240px;
      display: none;
      flex-direction: column;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .overlay-menu.show {
      display: flex;
    }
    .menu-header {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      padding: 2px 6px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 4px;
    }
    .menu-item {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: #1e293b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      transition: all 0.15s ease;
    }
    .menu-item:hover {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .account-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      margin-right: 12px;
    }
    .account-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .service-name {
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .otp-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      font-size: 13px;
      line-height: 1;
      transform: translateY(1px);
      color: #175DDC;
      letter-spacing: 0.5px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .otp-container {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .timer-svg {
      width: 22px;
      height: 22px;
      transform: rotate(-90deg);
    }
    .timer-bg {
      stroke: #e2e8f0;
    }
    .timer-path {
      stroke: #175DDC;
      transition: stroke-dashoffset 1s linear;
    }
    .timer-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      font-weight: 600;
      fill: #64748b;
    }
    @media (prefers-color-scheme: dark) {
      .overlay-menu {
        background: #1e293b;
        border: 1px solid #334155;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3);
      }
      .menu-header {
        color: #94a3b8;
        border-bottom: 1px solid #334155;
      }
      .menu-item {
        background: #0f172a;
        border: 1px solid #1e293b;
        color: #f8fafc;
      }
      .menu-item:hover {
        background: #1e293b;
        border-color: #175DDC;
      }
      .account-name {
        color: #f8fafc;
      }
      .service-name {
        color: #94a3b8;
      }
      .otp-code {
        color: #60a5fa;
      }
      .timer-bg {
        stroke: #334155;
      }
      .timer-text {
        fill: #94a3b8;
      }
    }
  `

  const btn = document.createElement('div')
  btn.className = 'shield-btn'
  btn.title = t('autofill_btn_title')
  const svgDoc = new DOMParser().parseFromString(
    `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M51.2 0C22.923 0 0 32.747 0 73.143v877.714C0 991.253 22.923 1024 51.2 1024h921.6c28.277 0 51.2-32.747 51.2-73.143V73.143C1024 32.747 1001.077 0 972.8 0z"/><path d="M682.777 771.435c24.952-24.445 47.748-50.22 66.403-79.046 14.783-22.842 27.658-47.057 39.693-71.494 8.322-16.898 14.515-34.973 20.26-52.969 4.402-13.789 6.99-28.206 9.702-42.473 2.993-15.749 5.259-31.639 7.721-47.485.562-3.617.88-7.308.892-10.967.26-82.1.28-164.2.788-246.298.14-22.736-12.15-27.723-28.188-27.59-35.534.294-71.072.057-106.609.105-24.26.033-39.408 15.133-39.41 39.406-.022 133.324-.022 266.647.085 399.97.007 8.582-1.903 15.867-8.073 22.318-9.511 9.944-28.671 12.569-39.45.482-11.725-13.146-22.763-26.923-33.74-40.71-12.26-15.4-24.161-31.087-36.137-46.71-15.16-19.778-30.204-39.644-45.364-59.422-10.666-13.915-21.44-27.746-32.168-41.612-12.509-16.171-25.074-32.298-37.47-48.556-1.968-2.58-3.174-5.743-4.732-8.636l-4.069 2.803c.48 6.386.943 12.775 1.448 19.16.21 2.658.732 5.31.733 7.964.03 94.356.127 188.712-.091 283.067-.041 17.783.225 35.813-2.523 53.276-2.893 18.383-14.628 32.399-31.739 40.061-23.946 10.724-45.833 6.018-65.335-11.442-32.4-29.01-59.677-62.125-82.889-98.94-15.983-25.35-30.887-51.228-41.914-78.988-8.564-21.56-14.915-44.024-21.74-66.244-6.543-21.305-10.616-43.152-12.029-65.43-1.36-21.44-3.431-42.878-3.678-64.334-.785-68.104-1.115-136.217-1.097-204.325.01-29.362 9.184-54.81 37.387-68.724 8.45-4.168 18.577-6.56 28.014-6.812 34.045-.914 68.123-.594 102.188-.693 90.428-.264 180.853-.503 271.28-.75 3.1-.008 6.202 0 9.844 0-6.44 10.05-12.34 19.16-18.118 28.343-1.628 2.588-3.852 5.292-4.163 8.124-.858 7.812-5.983 7.383-11.63 7.392-114.694.18-229.39.444-344.084.72-2.927.006-5.95-.089-8.76.574-14.238 3.36-17.762 6.903-18.125 25.364-.827 42.138-.28 84.302-.174 126.456.075 29.648-.265 59.317.72 88.938.78 23.41 1.775 47.003 5.414 70.082 4.984 31.61 11.735 63.046 25.23 92.469 9.77 21.3 18.16 43.416 29.881 63.592 13.07 22.5 28.357 43.877 44.289 64.5 12.585 16.29 27.372 30.923 41.635 45.858 8.42 8.816 20.36 8.816 24.777.089 2.519-4.977 3.49-11.203 3.54-16.88.191-22.289-.33-44.582-.435-66.874-.035-7.586.59-15.174.547-22.76-.531-94.983-1.189-189.966-1.605-284.95-.036-8.216-.014-16.937 2.63-24.497 2.006-5.738 7.367-11.446 12.738-14.64 13.644-8.11 26.87-4.22 36.869 8.5 13.222 16.817 27.097 33.124 40.266 49.984 15.356 19.663 30.137 39.775 45.385 59.521 11.735 15.196 23.93 30.036 35.704 45.202 15.572 20.057 30.913 40.293 46.397 60.42 6.232 8.102 12.578 16.12 19.865 25.447.261-4.115.636-7.264.637-10.415.038-116.412-.458-232.828.362-349.235.237-33.577 16.003-59.947 47.82-73.665 10.708-4.618 23.101-7.027 34.804-7.324 36.248-.918 72.537-.563 108.805-.265 30.969.255 53.388 14.273 65.45 43.204 2.372 5.691 3.976 12.18 3.987 18.304.15 86.754.427 173.513-.513 260.258-.2 18.506-4.59 37.058-8.017 55.41-3.495 18.716-7.403 37.428-12.523 55.753-8.207 29.377-20.792 57.082-34.658 84.22-16.989 33.25-38.357 63.562-61.96 92.307-23.358 28.445-50.296 53.298-79.291 75.906-32.366 25.238-67.239 46.43-104.618 63.353-13.666 6.187-27.632 11.878-41.85 16.63-13.205 4.413-26.614 2.048-39.382-2.83-34.903-13.335-68.336-29.675-99.797-49.901-2.006-1.29-3.39-3.544-5.063-5.349 2.043-.96 4.152-1.8 6.115-2.902 8.6-4.827 17.837-8.861 25.52-14.875 6.4-5.01 11.275-5.692 17.952-1.41 21.27 13.644 44.066 24.18 67.814 32.787 10.141 3.677 20.07 2.582 29.14-1.897 25.988-12.838 52.062-25.623 77.25-39.93 27.345-15.534 51.224-36.048 75.231-57.069" stroke="#fff" stroke-width="25" fill="#fff" fill-rule="nonzero" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
    'image/svg+xml'
  )
  btn.appendChild(svgDoc.documentElement)

  const menu = document.createElement('div')
  menu.className = 'overlay-menu'

  let currentAccounts = accounts // 记录当前展示的列表用于刷新判定

  function renderMenu(accountList) {
    currentAccounts = accountList
    menu.replaceChildren()
    const header = document.createElement('div')
    header.className = 'menu-header'
    header.textContent = t('autofill_header')
    menu.appendChild(header)

    if (isLocked) {
      const lockedItem = document.createElement('div')
      lockedItem.className = 'menu-item'
      lockedItem.style.justifyContent = 'center'
      lockedItem.style.color = '#64748b'
      lockedItem.style.cursor = 'pointer'
      const span = document.createElement('span')
      span.textContent = t('autofill_locked')
      lockedItem.appendChild(span)

      lockedItem.addEventListener('click', (e) => {
        e.stopPropagation()
        menu.classList.remove('show')
        sendRequest({ type: 'OPEN_POPUP' }).catch(err => {
          console.warn('[NodeAuth] 无法自动弹起窗口，请手动点击浏览器右上角的扩展图标', err)
        })
      })

      menu.appendChild(lockedItem)
      return
    }

    if (!accountList || accountList.length === 0) {
      const emptyItem = document.createElement('div')
      emptyItem.className = 'menu-item'
      emptyItem.style.justifyContent = 'center'
      emptyItem.style.color = '#64748b'
      const span = document.createElement('span')
      span.textContent = t('autofill_empty')
      emptyItem.appendChild(span)
      menu.appendChild(emptyItem)
      return
    }

    accountList.forEach(acc => {
      const item = document.createElement('div')
      item.className = 'menu-item'

      const formattedCode = acc.code ? (acc.code.length === 6 ? `${acc.code.slice(0, 3)} ${acc.code.slice(3)}` : acc.code) : t('autofill_fetching')

      const infoDiv = document.createElement('div')
      infoDiv.className = 'account-info'

      const accountSpan = document.createElement('span')
      accountSpan.className = 'account-name'
      accountSpan.textContent = acc.account || acc.service || 'NodeAuth'

      const serviceSpan = document.createElement('span')
      serviceSpan.className = 'service-name'
      serviceSpan.textContent = acc.service || 'NodeAuth'

      infoDiv.appendChild(accountSpan)
      infoDiv.appendChild(serviceSpan)

      const otpContainer = document.createElement('div')
      otpContainer.className = 'otp-container'

      const otpCode = document.createElement('span')
      otpCode.className = 'otp-code'
      otpCode.textContent = formattedCode
      otpContainer.appendChild(otpCode)

      if (acc.code) {
        const timerSvg = new DOMParser().parseFromString(
          `<svg xmlns="http://www.w3.org/2000/svg" class="timer-svg" viewBox="0 0 36 36">
            <path class="timer-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3"/>
            <path class="timer-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3" stroke-dasharray="100, 100" stroke-dashoffset="0" stroke-linecap="round"/>
            <text class="timer-text" x="18" y="18" text-anchor="middle" dominant-baseline="central" transform="rotate(90 18 18)">30</text>
          </svg>`,
          'image/svg+xml'
        )
        otpContainer.appendChild(document.importNode(timerSvg.documentElement, true))
      }

      item.appendChild(infoDiv)
      item.appendChild(otpContainer)

      item.addEventListener('click', (e) => {
        e.stopPropagation()
        menu.classList.remove('show')
        if (acc.code) {
          dispatchNativeInput(input, acc.code.replace(/\s+/g, ''))
          // 验证码填入后隐藏图标，避免遮挡原生输入框的 UI（如密码显示切换按钮）
          btn.style.display = 'none'
        }
      })
      menu.appendChild(item)
    })
  }

  // 初次静态渲染
  renderMenu(accounts)

  async function refreshLiveCodes() {
    try {
      const res = await getMatchedAccounts(window.location.href)
      if (res && res.success) {
        isLocked = res.locked
        renderMenu(res.accounts || [])
        updateTimer()
      }
    } catch (err) {
      console.warn('[NodeAuth] Failed to refresh live TOTP:', err)
    }
  }

  function updateTimer() {
    if (!menu.classList.contains('show')) return
    const now = Math.floor(Date.now() / 1000)
    const remaining = 30 - (now % 30)
    const pct = ((30 - remaining) / 30) * 100

    const paths = menu.querySelectorAll('.timer-path')
    const texts = menu.querySelectorAll('.timer-text')

    paths.forEach(p => p.setAttribute('stroke-dashoffset', pct))
    texts.forEach(t => {
      // 避免重复设置导致文本频繁闪烁
      if (t.textContent !== String(remaining)) {
        t.textContent = remaining
      }
    })

    if (remaining === 30 && currentAccounts.length) {
      refreshLiveCodes()
    }
  }

  const timerId = setInterval(updateTimer, 1000)

  btn.addEventListener('click', async (e) => {
    e.stopPropagation()
    const isShowing = menu.classList.contains('show')
    if (!isShowing) {
      // 实时向 Background 拉取最新验证码并主动刷新一次
      await refreshLiveCodes()
      menu.classList.add('show')
    } else {
      menu.classList.remove('show')
    }
  })

  document.addEventListener('click', () => {
    menu.classList.remove('show')
  })

  shadow.appendChild(style)
  shadow.appendChild(btn)
  shadow.appendChild(menu)
  // 定位计算：完全复刻 Bitwarden 算法
  function updatePosition() {
    if (!input.isConnected) {
      container.remove()
      clearInterval(timerId)
      activeUpdaters.delete(debouncedUpdatePosition)
      return
    }

    const pos = calculateOverlayPosition(input)
    if (!pos) {
      if (container.hasAttribute('popover')) {
        try { if (container.matches(':popover-open')) container.hidePopover() } catch (e) { }
      } else {
        container.style.display = 'none'
      }
      return
    }

    // 应用容器位置 (如果启用了 Popover，则坐标相对于视口，需要减去滚动偏移)
    if (container.hasAttribute('popover')) {
      container.style.top = `${pos.top - window.scrollY}px`
      container.style.left = `${pos.left - window.scrollX}px`
      try {
        if (!container.matches(':popover-open')) {
          container.showPopover()
        }
      } catch (e) { }
    } else {
      container.style.display = 'inline-flex'
      container.style.top = `${pos.top}px`
      container.style.left = `${pos.left}px`
    }

    // 应用动态大小
    btn.style.width = `${Math.max(16, pos.width)}px`
    btn.style.height = `${Math.max(16, pos.height)}px`
    // 移除对 btnSvg 的硬编码设置，让其完全由 CSS 控制大小，以保证内边距
  }

  // 创建一个带有防抖的位置更新函数
  const debouncedUpdatePosition = debounce(updatePosition, 50)
  activeUpdaters.add(debouncedUpdatePosition)

  // 恢复图标显示的逻辑：当用户再次点击、聚焦或修改输入框时，恢复图标
  const restoreIcon = () => {
    updatePosition()
    if (btn.style.display === 'none') {
      btn.style.display = 'flex'
    }
  }

  const handleBlur = () => {
    debouncedUpdatePosition()
  }

  input.addEventListener('focus', restoreIcon)
  input.addEventListener('blur', handleBlur)
  input.addEventListener('click', restoreIcon)
  input.addEventListener('input', restoreIcon)

  // 监听输入框尺寸变化（解决 SPA 框架渲染延迟导致宽高为 0 的问题）
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => updatePosition())
    resizeObserver.observe(input)
  }

  // 必须先将 container 挂载到 DOM 树中，后续的 showPopover() 才不会抛出 InvalidStateError
  const rootElement = document.body || document.documentElement
  rootElement.appendChild(container)
  updatePosition()

  // 如果当前输入框恰好已经自动获得了焦点，主动触发一次恢复逻辑
  if (document.activeElement === input) {
    restoreIcon()
  }

  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
}

/**
 * 启动全局页面 2FA 框检测与挂载
 */
export async function initOverlayInjector() {
  try {
    // 1. 获取用户语言偏好
    const data = await chrome.storage.local.get(['sys:ui:locale'])
    let lang = data['sys:ui:locale']
    if (!lang) {
      const navLang = navigator.language || navigator.userLanguage
      lang = navLang.startsWith('zh') ? 'zh-CN' : 'en-US'
    } else {
      lang = lang === 'zh-CN' ? 'zh-CN' : 'en-US'
    }
    currentLang = lang

    const res = await getMatchedAccounts(window.location.href)
    if (!res || !res.success) return
    // 如果没有账号且没有被锁定，说明当前网站真的没有对应账号，那么就不用注入了
    if ((!res.accounts || !res.accounts.length) && !res.locked) return

    // 深度查找所有的 input，穿透 Shadow DOM
    function querySelectorAllDeep(selector, root = document) {
      const result = Array.from(root.querySelectorAll(selector))
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node) => (node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
      })
      while (walker.nextNode()) {
        result.push(...querySelectorAllDeep(selector, walker.currentNode.shadowRoot))
      }
      return result
    }

    function scanAndMount() {
      const inputs = querySelectorAllDeep('input')
      inputs.forEach(input => {
        if (isOtpInput(input)) {
          mountInlineIcon(input, res.accounts || [], res.locked)
        }
      })

      // 全局 DOM 变动时（比如 Bitwarden 延迟 1 秒注入了它的图标），同步更新所有已挂载图标的位置
      activeUpdaters.forEach(update => update())
    }

    // 引入防抖，防止 SPA 框架的频繁渲染导致严重的 CPU 占用
    const debouncedScanAndMount = debounce(scanAndMount, 300)

    scanAndMount()

    // 观察动态 DOM 注入 (针对 SPA 路由)
    const observer = new MutationObserver(() => debouncedScanAndMount())
    // 兼容浏览器极速初始化时 document.body 可能为 null 的问题
    const targetNode = document.body || document.documentElement
    observer.observe(targetNode, { childList: true, subtree: true })
  } catch (e) {
    // 静默降级，不影响网页正常功能
  }
}
