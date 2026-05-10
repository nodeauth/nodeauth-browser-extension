<template>
  <div class="settings-view fade-in">
    <div class="settings-section">
      <h4>{{ $t('settings.appearance') }}</h4>
      <div class="setting-item">
        <span>{{ $t('settings.density') }}</span>
        <select v-model="settings.density">
          <option value="standard">{{ $t('settings.density_standard') }}</option>
          <option value="compact">{{ $t('settings.density_compact') }}</option>
        </select>
      </div>
      <div class="setting-item">
        <span>{{ $t('settings.language') }}</span>
        <select v-model="settings.language">
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
      <div class="setting-item">
        <div class="label-with-desc">
          <span>{{ $t('settings.show_service_icons') }}</span>
          <small>{{ $t('settings.show_service_icons_desc') }}</small>
        </div>
        <select v-model="settings.showServiceIcons">
          <option :value="true">{{ $t('common.on') }}</option>
          <option :value="false">{{ $t('common.off') }}</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>{{ $t('settings.security') }}</h4>
      <div class="setting-item">
        <span>{{ $t('settings.auto_lock') }}</span>
        <select v-model="settings.autolock">
          <option value="0">{{ $t('settings.lock_immediately') }}</option>
          <option value="1">{{ $t('settings.lock_1m') }}</option>
          <option value="5">{{ $t('settings.lock_5m') }}</option>
          <option value="30">{{ $t('settings.lock_30m') }}</option>
          <option value="-1">{{ $t('settings.lock_never') }}</option>
        </select>
      </div>
      <div class="setting-item">
        <span>{{ $t('settings.clipboard_clear') }}</span>
        <select v-model="settings.clipboardClear">
          <option value="clear_never">{{ $t('settings.clear_never') }}</option>
          <option value="clear_30s">{{ $t('settings.clear_30s') }}</option>
          <option value="clear_60s">{{ $t('settings.clear_60s') }}</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>{{ $t('settings.data_management') }}</h4>
      <div class="setting-item readonly">
        <span>{{ $t('settings.instance_url') }}</span>
        <code>{{ instanceUrl }}</code>
      </div>
      <div class="action-list">
        <button class="btn btn-outline" @click="triggerSignOut(t)">{{ $t('settings.sign_out') }}</button>
        <button class="btn btn-danger" @click="triggerReset(t)">{{ $t('settings.reset_ext') }}</button>
      </div>
    </div>

    <div class="settings-footer">
      <p class="version">NodeAuth Extension {{ fullVersion }}</p>
      <div class="footer-links">
        <a href="https://wiki.nodeauth.io" target="_blank">Wiki</a>
        <span>|</span>
        <a href="https://github.com/nodeauth/nodeauth-browser-extension" target="_blank">{{ $t('settings.github') }}</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useExtensionState } from '@/shared/state/useExtensionState'
import { useI18n } from 'vue-i18n'

const { settings, instanceUrl, triggerSignOut, triggerReset } = useExtensionState()
const { t } = useI18n()

// 动态获取版本号（由 Vite define 注入）
const fullVersion = `v${__APP_VERSION__} (${__GIT_HASH__})`
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}
.settings-section {
  background: white;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
}
h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.setting-item:last-child { border-bottom: none; }
.setting-item span { font-size: 14px; color: #333; }
.setting-item select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 13px;
  background: #fcfcfc;
}
.setting-item.readonly { flex-direction: column; align-items: flex-start; gap: 8px; }
.setting-item code {
  font-family: monospace;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #d9534f;
  word-break: break-all;
  width: 100%;
}
.label-with-desc { display: flex; flex-direction: column; }
.label-with-desc small { font-size: 11px; color: #999; margin-top: 2px; }
.action-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline { background: transparent; border: 1px solid #ddd; color: #666; }
.btn-danger { background: #d9534f; color: white; }
.settings-footer {
  text-align: center;
  margin-top: 12px;
  padding: 16px 0;
}
.settings-footer .version {
  font-size: 11px;
  margin-bottom: 6px;
  font-family: monospace;
}
.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.settings-footer a {
  font-size: 12px;
  color: #0f3460;
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.2s;
}
.settings-footer a:hover {
  opacity: 1;
  text-decoration: underline;
}
.fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>
