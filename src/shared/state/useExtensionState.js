// --- 巨石状态切分后的汇聚代理 (Facade Pattern) ---
// 该文件现作为 Domain Stores 的统一出口，保持向下兼容，使原有的 13 个引入组件零成本迁移。

import { useSettings } from './modules/useSettings'
import { useUI } from './modules/useUI'
import { useVault } from './modules/useVault'
import { useAuth } from './modules/useAuth'

export function useExtensionState() {
  return {
    ...useSettings(),
    ...useUI(),
    ...useVault(),
    ...useAuth()
  }
}
