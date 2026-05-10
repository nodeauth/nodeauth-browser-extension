import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve } from 'path'

/**
 * Vite 构建配置 - 多入口 Manifest V3 兼容构建
 *
 * 入口说明：
 * - popup:      用户点击插件图标弹出的界面
 * - background: Service Worker 后台进程（解密落锁核心）
 * - content:    注入目标网页的脚本（公钥冰封与监听）
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))
let commitHash = 'unknown'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  console.warn('Failed to get git commit hash')
}

/**
 * Vite 构建配置 - 多入口 Manifest V3 兼容构建
 *
 * 入口说明：
 * - popup:      用户点击插件图标弹出的界面
 * - background: Service Worker 后台进程（解密落锁核心）
 * - content:    注入目标网页的脚本（公钥冰封与监听）
 */
export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      // 仅指定 JSON 翻译文件，避免处理同目录下的 .js 代码文件
      include: [resolve(__dirname, './src/locales/*.json')],
      jit: true
    })
  ],

  // 定义全局常量，禁用 i18n 的 JIT 编译以符合 CSP 策略
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
    __VUE_I18N_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(commitHash),
  },

  // 构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 关闭代码分割，确保每个入口产出独立的自包含文件
    // Manifest V3 的 Service Worker 不支持动态 import()
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/app/index.html'),
        background: resolve(__dirname, 'src/processes/background/index.js'),
        content: resolve(__dirname, 'src/processes/content/authBridge.js'),
      },
      output: {
        // 统一输出到 dist 的各自目录
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'processes/background/index.js'
          if (chunk.name === 'content') return 'processes/content/authBridge.js'
          return '[name]/[name].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.css')) return 'app/[name][extname]'
          return 'assets/[name]-[hash][extname]'
        },
        // 完全禁止代码分割，保证 Content Script 和 Background 是单文件
        manualChunks: undefined,
      },
    },
    // 关闭 CSS 代码分割
    cssCodeSplit: false,
    // Manifest V3 环境下 Service Worker 使用 ES module 格式
    target: 'esnext',
    // 不混淆方便调试，发布时可改为 true
    minify: false,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 强制使用 runtime-only 版本，避免在 CSP 环境下触发 eval
      'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
    },
  },
})
