/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Firebase
import '@/firebase'

// Styles
import 'unfonts.css'
import '@/styles/common.scss'

// OS Check
if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-mac')
}

// Directives
import { draggableDialog } from '@/directives/draggableDialog'

const app = createApp(App)

registerPlugins(app)

app.directive('draggable-dialog', draggableDialog)

app.mount('#app')
