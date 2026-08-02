/**
 * NodeAuth 扩展程序纯净加密模块
 * 基于原生 Web Crypto API，无第三方依赖。
 */

const PBKDF2_ITERATIONS = 100000;
const ALGORITHM = 'AES-GCM';
const HASH = 'SHA-256';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * 将 PIN 码和 Salt 转换为 AES 密钥 (PBKDF2)
 */
async function deriveKeyFromPin(pin, saltBuffer) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: HASH
        },
        keyMaterial,
        { name: ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 使用 PIN 码加密明文文本（用于本地落锁保存 Master Key）
 */
export async function encryptWithPin(plaintext, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKeyFromPin(pin, salt);

    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoded
    );

    // 格式：salt + iv + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return arrayBufferToBase64(combined.buffer);
}

/**
 * 使用 PIN 码解密本地保存的数据
 */
export async function decryptWithPin(encryptedBase64, pin) {
    try {
        const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
        const salt = combined.slice(0, SALT_LENGTH);
        const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

        const key = await deriveKeyFromPin(pin, salt);

        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error('解密失败，可能是 PIN 码错误或数据损坏');
    }
}

/**
 * PWA 兼容：从 Master Key (device_salt) 派生 Masking Key
 * 用于解密服务端返回的 TOTP Secret
 */
export async function deriveMaskingKey(deviceSaltStr) {
    const encoder = new TextEncoder();
    const saltBuffer = encoder.encode(deviceSaltStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', saltBuffer);
    return hashBuffer;
}

/**
 * PWA 兼容：解密 nodeauth 掩码数据
 * @param {string} maskedData "nodeauth:base64..."
 * @param {ArrayBuffer | ArrayBuffer[]} maskingKeyBufferOrArray
 */
export async function unmaskSecret(maskedData, maskingKeyBufferOrArray) {
    if (!maskedData || !maskedData.startsWith('nodeauth:')) {
        return maskedData;
    }
    const payload = maskedData.slice('nodeauth:'.length);
    const combined = new Uint8Array(base64ToArrayBuffer(payload));

    if (combined.byteLength < 12) {
        throw new Error('无效的密文长度');
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const keys = Array.isArray(maskingKeyBufferOrArray) ? maskingKeyBufferOrArray : [maskingKeyBufferOrArray];
    let lastError;

    for (const maskingKeyBuffer of keys) {
        try {
            const keyUsage = await crypto.subtle.importKey(
                'raw',
                maskingKeyBuffer,
                'AES-GCM',
                false,
                ['decrypt']
            );

            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                keyUsage,
                ciphertext
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError || new Error('Decryption failed with all provided keys');
}

/**
 * PWA 兼容：反向加密 secret (Masking)
 * 用于将明文 TOTP Secret 加密为 "nodeauth:base64..." 格式发送给后端
 */
export async function maskSecret(plaintext, maskingKeyBuffer) {
    if (!plaintext) return plaintext;
    
    // 动态生成 12 字节的随机 IV，保证每次加密密文不同
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyUsage = await crypto.subtle.importKey(
        'raw',
        maskingKeyBuffer,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        keyUsage,
        encoded
    );

    // 拼接格式：12字节IV + 密文
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return 'nodeauth:' + arrayBufferToBase64(combined.buffer);
}
