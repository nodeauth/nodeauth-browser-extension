export const THIRD_PARTY_EXTENSIONS = [
  {
    name: 'Bitwarden',
    pageSelectors: [
      '[data-bwignore]', 
      '[data-bwautofill]', 
      '[id^="com.bitwarden"]', 
      '[class*="com-bitwarden"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-bwignore')
  },
  {
    name: '1Password',
    pageSelectors: [
      '[data-com\\.onepassword\\.ivc\\.identifier]',
      '[data-1p-ignore]',
      'com-1password-button'
    ],
    isIgnored: (input) => input.hasAttribute('data-1p-ignore')
  },
  {
    name: 'Dashlane',
    pageSelectors: [
      '[data-dashlane-rid]',
      '[data-dashlane-ignore]',
      '[id^="dashlane"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-dashlane-ignore') || input.getAttribute('data-form-type') === 'other'
  },
  {
    name: 'LastPass',
    pageSelectors: [
      '[id^="LastPass"]',
      '[class^="lastpass"]',
      '[data-lastpass-icon-root]'
    ],
    isIgnored: (input) => input.getAttribute('data-lpignore') === 'true'
  },
  {
    name: 'Proton Pass',
    pageSelectors: [
      'protonpass-root',
      '[id^="protonpass-"]',
      '[class*="protonpass"]'
    ],
    isIgnored: (input) => input.getAttribute('data-protonpass-ignore') === 'true'
  },
  {
    name: 'Keeper',
    pageSelectors: [
      '[id^="keeper-"]',
      '[class*="keeper-icon"]',
      'keeper-fill'
    ],
    isIgnored: (input) => input.hasAttribute('data-keeper-ignore') || input.classList.contains('keeper-ignore')
  },
  {
    name: 'NordPass',
    pageSelectors: [
      'nordpass-root',
      'nordpass-icon',
      '[data-nordpass-icon]'
    ],
    isIgnored: (input) => input.hasAttribute('data-nordpass-ignore')
  },
  {
    name: 'Enpass',
    pageSelectors: [
      '[data-enpass-id]',
      'div[id^="enpass-"]',
      '[class*="enpass-icon"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-enpass-ignore')
  },
  {
    name: 'Roboform',
    pageSelectors: [
      'div[id^="rf-"]',
      '[class*="roboform"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-roboform-ignore')
  },
  {
    name: 'KeePassXC',
    pageSelectors: [
      'keepassxc-button',
      '[class*="keepassxc"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-keepassxc-ignore')
  },
  {
    name: 'iCloud Passwords',
    pageSelectors: [
      'apple-pay-button',
      '[data-apple-keychain]',
      '[class*="apple-keychain"]'
    ],
    isIgnored: (input) => input.hasAttribute('data-apple-ignore')
  },
  {
    name: 'Generic_Popover',
    // We add popover="manual" as a generic fallback since many new extensions use it.
    pageSelectors: [
      '[popover="manual"]:not(.nodeauth-inline-host)'
    ],
    isIgnored: () => false
  }
]

export class CompatibilityManager {
  /**
   * Checks if there's any third-party extension conflict for the given input
   * @param {HTMLInputElement} input 
   * @returns {boolean} true if a conflict is detected
   */
  static hasConflict(input) {
    for (const ext of THIRD_PARTY_EXTENSIONS) {
      const selectors = ext.pageSelectors.join(', ')
      try {
        if (!!document.querySelector(selectors) && !ext.isIgnored(input)) return true
      } catch (e) {
        console.warn(`[NodeAuth: Compatibility] Invalid selector for ${ext.name}: ${selectors}`, e)
      }
    }
    return false
  }

  /**
   * Returns a generic CSS selector string to observe third-party injections via MutationObserver
   * @returns {string}
   */
  static getObservationSelectors() {
    return THIRD_PARTY_EXTENSIONS.flatMap(ext => ext.pageSelectors).join(', ')
  }

  /**
   * 判断是否为特殊的前端框架输入框（如原生分体框，或 Shadcn-UI / Discourse 的透明幽灵输入框）
   * @param {HTMLInputElement} input 
   * @param {boolean} isSplit - 是否已经被识别为原生分体框
   * @returns {boolean}
   */
  static isGhostInput(input, isSplit = false) {
    if (isSplit) return true
    
    // 检查 Shadcn-UI, Discourse 等框架的幽灵输入框特征
    return (
      (input.classList && input.classList.contains('d-otp-input')) ||
      input.hasAttribute('data-slot') ||
      input.hasAttribute('data-input-otp') ||
      window.getComputedStyle(input).opacity === '0'
    )
  }
}
