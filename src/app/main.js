import { createApp } from 'vue'
import App from './app.vue'
import { i18n, initLanguage } from '@/locales/index'
import './styles/index.css'

// 异步初始化语言后再挂载应用，确保语言设置在首帧就生效
initLanguage().finally(() => {
    createApp(App).use(i18n).mount('#app')
})

