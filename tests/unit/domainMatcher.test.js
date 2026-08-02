import { describe, it, expect } from 'vitest'
import {
  getDomainFromUrl,
  extractDomainFromService,
  getBrandFromDomain,
  isServiceMatchDomain
} from '@/shared/utils/domainMatcher'

describe('domainMatcher.js Unit Tests', () => {
  describe('getDomainFromUrl', () => {
    it('应当准确提取 HTTP / HTTPS 标准 URL 的根域名', () => {
      expect(getDomainFromUrl('https://sub.github.com/login?ref=1')).toBe('github.com')
      expect(getDomainFromUrl('http://google.com')).toBe('google.com')
      expect(getDomainFromUrl('https://console.aws.amazon.com/ec2')).toBe('amazon.com')
    })

    it('应当安全处理 localhost 与 IP 地址', () => {
      expect(getDomainFromUrl('http://localhost:3000/app')).toBe('localhost')
      expect(getDomainFromUrl('http://127.0.0.1:8080/test')).toBe('127.0.0.1')
    })

    it('对空值与无效 URL 应当安全返回空字符串', () => {
      expect(getDomainFromUrl('')).toBe('')
      expect(getDomainFromUrl(null)).toBe('')
      expect(getDomainFromUrl('invalid-url')).toBe('')
    })
  })

  describe('extractDomainFromService', () => {
    it('若服务名包含 . 应当直接原样小写返回', () => {
      expect(extractDomainFromService('github.com')).toBe('github.com')
      expect(extractDomainFromService('Api.OpenAI.Com')).toBe('api.openai.com')
    })

    it('字典已知服务名应当准确映射为指定域名', () => {
      expect(extractDomainFromService('google')).toBe('google.com')
      expect(extractDomainFromService('github')).toBe('github.com')
      expect(extractDomainFromService('steam')).toBe('steampowered.com')
      expect(extractDomainFromService('blizzard')).toBe('battle.net')
      expect(extractDomainFromService('暴雪')).toBe('battle.net')
    })

    it('未包含 . 且非字典项应当默认拼装 .com 域名', () => {
      expect(extractDomainFromService('mycustombrand')).toBe('mycustombrand.com')
    })
  })

  describe('isServiceMatchDomain - 3-Tier Cascade Algorithm', () => {
    it('Tier 1: 物理根域名比对 (service 包含/等于根域名)', () => {
      expect(isServiceMatchDomain('github.com', 'https://sub.github.com/login')).toBe(true)
      expect(isServiceMatchDomain('https://github.com', 'https://github.com/dashboard')).toBe(true)
    })

    it('Tier 2: 品牌词标准化模糊匹配 (忽略大小写/说明括号/连字符)', () => {
      expect(isServiceMatchDomain('GitHub', 'https://github.com/login')).toBe(true)
      expect(isServiceMatchDomain('GitHub (Personal)', 'https://github.com/login')).toBe(true)
      expect(isServiceMatchDomain('Google Account', 'https://www.google.com')).toBe(true)
    })

    it('Tier 3: 常见服务别名字典匹配', () => {
      expect(isServiceMatchDomain('暴雪', 'https://battle.net/login')).toBe(true)
      expect(isServiceMatchDomain('战网', 'https://account.battle.net')).toBe(true)
      expect(isServiceMatchDomain('谷歌', 'https://www.google.com')).toBe(true)
    })

    it('不匹配场景应当安全返回 false', () => {
      expect(isServiceMatchDomain('GitHub', 'https://google.com')).toBe(false)
      expect(isServiceMatchDomain('Steam', 'https://github.com')).toBe(false)
      expect(isServiceMatchDomain('', 'https://github.com')).toBe(false)
    })
  })
})
