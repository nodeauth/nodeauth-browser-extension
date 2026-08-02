<template>
  <div class="service-icon-wrapper">
    <img 
      v-if="winnerUrl && !hasError" 
      v-show="!isLoading"
      :src="winnerUrl" 
      class="service-icon-img" 
      @error="handleError"
      @load="handleLoad"
    />
    <div v-if="hasError || isLoading" class="service-icon-fallback">
      {{ firstLetter }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

import { useSettings } from '@/shared/state/modules/useSettings'

const props = defineProps({
  service: { type: String, default: '' },
  iconUrl: { type: String, default: '' }
})

const { settings } = useSettings()

const hasError = ref(false)
const isLoading = ref(true)
const winnerUrl = ref('')
const raceTimeout = ref(null)

// 简单的内存缓存，在插件弹出期间有效
const memoryCache = new Map()

const handleLoad = (e) => {
  const img = e.target;
  const isGooglePlaceholder = winnerUrl.value.includes('google') && img.naturalWidth === 16;
  const isBitwardenPlaceholder = winnerUrl.value.includes('bitwarden') && img.naturalWidth === 19;
  
  if (isGooglePlaceholder || isBitwardenPlaceholder) {
    if (domainName.value) memoryCache.delete(domainName.value);
    handleError();
    return;
  }
  isLoading.value = false
  clearTimeout(raceTimeout.value)
}

const handleError = () => {
  hasError.value = true
  isLoading.value = false
  clearTimeout(raceTimeout.value)
}

const SERVICE_DOMAIN_MAP = {
  'google': 'google.com',
  'github': 'github.com',
  'microsoft': 'microsoft.com',
  'apple': 'apple.com',
  'amazon': 'amazon.com',
  'facebook': 'facebook.com',
  'twitter': 'twitter.com',
  'discord': 'discord.com',
  'slack': 'slack.com',
  'telegram': 'telegram.org',
  'dropbox': 'dropbox.com',
  'cloudflare': 'cloudflare.com',
  'gitlab': 'gitlab.com',
  'bitbucket': 'bitbucket.org',
  'steam': 'steampowered.com',
  'battle': 'battle.net',
  'blizzard': 'battle.net'
}

const domainName = computed(() => {
  if (!props.service) return ''
  const s = props.service.toLowerCase().trim()
  if (s.includes('.')) return s
  return SERVICE_DOMAIN_MAP[s] || `${s}.com`
})

const firstLetter = computed(() => {
  return props.service ? props.service.charAt(0).toUpperCase() : ''
})

let raceIdCounter = 0

const startRace = async () => {
  const raceId = ++raceIdCounter

  if (props.iconUrl) {
    winnerUrl.value = props.iconUrl
    isLoading.value = false
    hasError.value = false
    return
  }

  // 🛡️ 隐私保护核心：如果设置中未开启图标显示，则直接跳过外部请求
  if (!settings.value.showServiceIcons) {
    handleError()
    return
  }

  const domain = domainName.value
  if (!domain) {
    isLoading.value = false; hasError.value = true; return
  }

  const cached = memoryCache.get(domain)
  if (cached) {
    winnerUrl.value = cached
    isLoading.value = false
    hasError.value = false
    return
  }

  isLoading.value = true
  hasError.value = false

  const sources = [
    { name: 'google', url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` },
    { name: 'bitwarden', url: `https://icons.bitwarden.net/${domain}/icon.png` },
    { name: 'favicon', url: `https://favicon.im/zh/${domain}?throw-error-on-404=true` }
  ]

  let resolved = false

  const probe = (url, name) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const timer = setTimeout(() => { img.src = ''; reject('timeout') }, 3000)

      img.onload = () => {
        clearTimeout(timer)
        if (img.naturalWidth <= 1) return reject('placeholder')
        if (name === 'google' && img.naturalWidth === 16) return reject('google_default')
        if (name === 'bitwarden' && img.naturalWidth === 19) return reject('bitwarden_default')
        resolve(url)
      }
      img.onerror = () => { clearTimeout(timer); reject('error') }
      img.src = url
    })
  }

  try {
    const winner = await Promise.any(sources.map(s => probe(s.url, s.name)))
    if (raceId === raceIdCounter) {
      resolved = true
      winnerUrl.value = winner
      memoryCache.set(domain, winner)
    }
  } catch (e) {
    if (!resolved && raceId === raceIdCounter) {
      handleError()
    }
  }
}

watch(() => props.service, () => {
  winnerUrl.value = ''
  isLoading.value = true
  hasError.value = false
  startRace()
})

watch(() => props.iconUrl, () => {
  winnerUrl.value = ''
  isLoading.value = true
  hasError.value = false
  startRace()
})

watch(() => settings.value.showServiceIcons, (newVal) => {
  if (newVal) {
    winnerUrl.value = ''
    isLoading.value = true
    hasError.value = false
    startRace()
  } else {
    winnerUrl.value = ''
    handleError()
  }
})

onMounted(() => {
  startRace()
})

onBeforeUnmount(() => {
  clearTimeout(raceTimeout.value)
})
</script>

<style scoped>
.service-icon-wrapper {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 10px;
  overflow: hidden;
}
.service-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.service-icon-fallback {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: bold;
}
</style>
