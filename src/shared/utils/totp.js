/**
 * NodeAuth 扩展程序原生 TOTP/HOTP/Steam 引擎
 * 纯手写实现，零依赖，极简安全。
 */

// 标准 Base32 解码
function base32ToUint8Array(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    base32 = base32.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (let i = 0; i < base32.length; i++) {
        const val = alphabet.indexOf(base32.charAt(i));
        if (val === -1) throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
}

// 整数转为 8 字节（大端序）数组
function intToUint8Array(num) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigUint64(0, BigInt(num), false); // 大端序
    return new Uint8Array(buf);
}

// 基于 Web Crypto 的 HMAC 计算
async function hmacSha1(keyBytes, textBytes) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, textBytes);
    return new Uint8Array(signature);
}

// 动态截断 (Dynamic Truncation)
function dynamicTruncation(hmacBytes, digits) {
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binary =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);
    
    let otp = (binary % Math.pow(10, digits)).toString();
    return otp.padStart(digits, '0');
}

// Steam Guard 特殊编码截断
function steamTruncation(hmacBytes) {
    const chars = '23456789BCDFGHJKMNPQRTVWXY';
    const offset = hmacBytes[19] & 0x0f;
    let fullCode =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);

    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(fullCode % chars.length);
        fullCode /= chars.length;
    }
    return code;
}

/**
 * 统一验证码生成入口
 * @param {Object} options
 * @param {string} options.secret Base32 编码的密钥
 * @param {number} [options.digits=6] 验证码位数
 * @param {number} [options.period=30] 刷新周期
 * @param {string} [options.algorithm='SHA1'] 哈希算法（目前 Web Crypto 扩展版固定支持 SHA1）
 * @param {boolean} [options.isSteam=false] 是否为 Steam Guard
 * @param {number} [options.counter] 对于 HOTP 是必填的计数器，不填则默认取当前时间的 TOTP counter
 */
export async function generateToken({ secret, digits = 6, period = 30, isSteam = false, counter, timestamp }) {
    if (!secret) return '------';

    try {
        const keyBytes = base32ToUint8Array(secret);
        
        let c = counter;
        if (typeof c === 'undefined') {
            // TOTP 模式：基于时间的计数器
            const ts = timestamp || Math.floor(Date.now() / 1000);
            c = Math.floor(ts / period);
        }

        const counterBytes = intToUint8Array(c);
        const hmac = await hmacSha1(keyBytes, counterBytes);

        if (isSteam) {
            return steamTruncation(hmac);
        }
        return dynamicTruncation(hmac, digits);
    } catch (e) {
        console.error('[TOTP] Generate failed:', e);
        return 'ERROR';
    }
}

/**
 * 获取当前的 TOTP 进度信息
 */
export function getTotpProgress(period = 30) {
    const timestamp = Date.now() / 1000;
    const remaining = period - (timestamp % period);
    const percentage = (remaining / period) * 100;
    return { remaining: Math.ceil(remaining), percentage };
}

/**
 * 构建标准的 OTP Auth URI
 */
export function buildOtpUri({ service, account, secret, type = 'totp', algorithm = 'SHA1', digits = 6, period = 30, counter = 0 }) {
    const typeLower = (type || 'totp').toLowerCase()
    const label = encodeURIComponent(service ? `${service}:${account}` : account)
    const params = new URLSearchParams()
    
    params.append('secret', secret)
    params.append('issuer', service || 'NodeAuth')
    
    if (typeLower === 'hotp') {
        params.append('counter', counter.toString())
    } else {
        params.append('period', period.toString())
    }
    
    if (algorithm && algorithm !== 'SHA1') {
        params.append('algorithm', algorithm.toUpperCase())
    }
    
    if (digits && digits !== 6) {
        params.append('digits', digits.toString())
    }
    
    return `otpauth://${typeLower}/${label}?${params.toString()}`
}
