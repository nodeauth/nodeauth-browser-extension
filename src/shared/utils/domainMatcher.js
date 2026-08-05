/**
 * 智能域名匹配与服务识别引擎 (Domain Matcher & Service Normalizer)
 *
 * 提供“三级递进式匹配算法”：
 * 1. 根域名物理匹配 (Direct Domain Matching)
 * 2. 品牌词标准化匹配 (Normalized Brand-Name Matching)
 * 3. 常见服务别名字典映射 (Known-Services Alias Dictionary)
 */

export const SERVICE_DOMAIN_MAP = {
  'google': 'google.com',
  'github': 'github.com',
  'microsoft': 'microsoft.com',
  'apple': 'apple.com',
  'amazon': 'amazon.com',
  'facebook': 'facebook.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'discord': 'discord.com',
  'slack': 'slack.com',
  'telegram': 'telegram.org',
  'dropbox': 'dropbox.com',
  'cloudflare': 'cloudflare.com',
  'gitlab': 'gitlab.com',
  'bitbucket': 'bitbucket.org',
  'steam': 'steampowered.com',
  'steampowered': 'steampowered.com',
  'battle': 'battle.net',
  'blizzard': 'battle.net',
  '暴雪': 'battle.net',
  '战网': 'battle.net',
  '谷歌': 'google.com',
  '推特': 'twitter.com',
  '百度': 'baidu.com',
  '腾讯': 'qq.com',
  '阿里': 'alibaba.com',
  '淘宝': 'taobao.com'
}

/**
 * 从完整 URL 中解析根域名 (如 https://sub.github.com/login -> github.com)
 * @param {string} urlStr 
 * @returns {string} 根域名小写
 */
export function getDomainFromUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return ''
  try {
    const parsed = new URL(urlStr)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return hostname
    }
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return parts.slice(-2).join('.')
    }
    return hostname
  } catch (e) {
    return ''
  }
}

/**
 * 从服务名称推导用于图标与比对的主域名
 * @param {string} service 
 * @returns {string} 域名小写 (如 "google.com")
 */
export function extractDomainFromService(service) {
  if (!service || typeof service !== 'string') return ''
  const s = service.toLowerCase().trim()
  if (s.includes('.')) return s
  return SERVICE_DOMAIN_MAP[s] || `${s}.com`
}

/**
 * 提取主品牌的词干 (如 "github.com" -> "github")
 * @param {string} domain 
 * @returns {string}
 */
export function getBrandFromDomain(domain) {
  if (!domain) return ''
  const parts = domain.split('.')
  return parts[0] || domain
}

/**
 * 三级递进式智能匹配算法：判断指定的 service 是否与当前 URL 网页匹配
 * @param {string} service - 用户填写的服务名 (如 "GitHub" 或 "github.com")
 * @param {string} currentUrl - 当前标签页 URL (如 "https://github.com/login")
 * @returns {boolean} 是否匹配
 */
export function isServiceMatchDomain(service, currentUrl) {
  if (!service || !currentUrl) return false

  let pageHostname = ''
  try {
    pageHostname = new URL(currentUrl).hostname.toLowerCase()
  } catch (e) {
    return false
  }

  const pageDomain = getDomainFromUrl(currentUrl)
  if (!pageDomain) return false

  const pageBrand = getBrandFromDomain(pageDomain)
  const cleanService = service.toLowerCase().trim()

  // Tier 1: 物理根域名比对
  // 1.1 精确匹配或子域名匹配
  if (cleanService === pageHostname || pageHostname.endsWith('.' + cleanService)) {
    return true
  }
  if (cleanService === pageDomain || cleanService.endsWith('.' + pageDomain)) {
    return true
  }

  // 1.2 如果 service 是一个带域名的网址或字符串，解析其 domain 后再做精确比对
  if (cleanService.includes('.')) {
    const serviceUrl = cleanService.startsWith('http') ? cleanService : `https://${cleanService}`
    const serviceDomain = getDomainFromUrl(serviceUrl)
    if (serviceDomain && serviceDomain === pageDomain) return true
    try {
      const serviceHostname = new URL(serviceUrl).hostname
      if (pageHostname === serviceHostname || pageHostname.endsWith('.' + serviceHostname)) {
        return true
      }
    } catch(e) {}
  }

  // Tier 2: 品牌词标准化精确 Token 匹配 (防止短词 substring 误伤，如 "pp" 匹配 "app")
  if (pageBrand && pageBrand.length >= 2) {
    // 将 service 拆分为 token 数组 (e.g. "GitHub (Work)" -> ["github", "work"])
    const tokens = cleanService.replace(/[\(\)\-\_\.]/g, ' ').split(/\s+/)
    if (tokens.includes(pageBrand)) {
      return true
    }
  }

  // Tier 3: 常见服务别名字典映射匹配
  const baseService = cleanService.replace(/[\(\)\-\_\.]/g, ' ').split(/\s+/)[0]
  const mappedDomain = SERVICE_DOMAIN_MAP[baseService] || SERVICE_DOMAIN_MAP[cleanService]
  if (mappedDomain) {
    if (mappedDomain === pageDomain || mappedDomain === pageHostname || pageHostname.endsWith('.' + mappedDomain)) {
      return true
    }
  }

  return false
}
