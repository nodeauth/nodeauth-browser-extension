/**
 * 二维码图形离屏解码与反色容错解析引擎
 */
import jsQR from 'jsqr'

/**
 * 解析 otpauth:// 或 steam:// 协议 URL 字符串
 * @param {string} uri 
 * @returns {Object|null}
 */
export function parseOtpUri(uri) {
  if (!uri) return null

  // 1. 处理 steam:// 协议
  if (uri.startsWith('steam://')) {
    const secret = uri.replace('steam://', '').replace(/[\s=]/g, '').toUpperCase()
    if (!secret) return null
    return {
      service: 'Steam',
      account: 'Steam Guard',
      secret,
      type: 'steam',
      digits: 5,
      period: 30,
      algorithm: 'SHA1'
    }
  }

  // 2. 处理 otpauth:// 协议
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null

    let typeHeader = (url.host || url.hostname || '').toLowerCase()
    if (!typeHeader && url.pathname.startsWith('//')) {
      typeHeader = url.pathname.substring(2).split('/')[0].toLowerCase()
    }

    const params = url.searchParams
    const secret = params.get('secret')
    if (!secret) return null

    const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
    let service = params.get('issuer') || ''
    let account = label

    if (label.includes(':')) {
      const idx = label.indexOf(':')
      if (!service) service = label.substring(0, idx).trim()
      account = label.substring(idx + 1).trim()
    }

    let algorithm = (params.get('algorithm') || 'SHA1').toUpperCase().replace(/-/g, '')
    if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) algorithm = 'SHA1'

    const digits = parseInt(params.get('digits') || (typeHeader === 'steam' ? '5' : (typeHeader === 'blizzard' ? '8' : '6')), 10)
    const period = parseInt(params.get('period') || '30', 10)
    let counter = parseInt(params.get('counter') || '0', 10)
    if (isNaN(counter) || counter < 0) counter = 0

    return {
      service: service || '',
      account: account || '',
      secret: secret.replace(/[\s=]/g, '').toUpperCase(),
      type: ['totp', 'hotp', 'steam', 'blizzard'].includes(typeHeader) ? typeHeader : 'totp',
      algorithm,
      digits,
      period,
      counter
    }
  } catch (e) {
    return null
  }
}

/**
 * 将 DataURL 形式的图片解码为文本（内置暗黑网页反色容错机制）
 * @param {string} dataUrl - 图像 Base64 / DataURL 格式
 * @returns {Promise<string|null>} 解析出的原始文本或 null
 */
export async function decodeQrFromDataUrl(dataUrl) {
  if (!dataUrl) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // 1. 标准解码
        let code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code && code.data) {
          return resolve(code.data)
        }

        // 2. 图像像素反色处理 (针对暗黑模式反色二维码)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]       // Red
          data[i + 1] = 255 - data[i + 1] // Green
          data[i + 2] = 255 - data[i + 2] // Blue
        }
        code = jsQR(data, imageData.width, imageData.height)
        resolve(code && code.data ? code.data : null)
      } catch (e) {
        console.error('[QRDecoder] Decode error:', e)
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/**
 * 解析二维码文本并转化为规范化的 OTP 账号对象
 * @param {string} qrContent 
 * @returns {Object|null}
 */
export function parseQrResult(qrContent) {
  if (!qrContent) return null
  return parseOtpUri(qrContent)
}
