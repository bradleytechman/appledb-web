import { defineClientConfig } from '@vuepress/client'
import Layout from './layouts/Layout.vue'

function loadIcons() {
  if (typeof document === 'undefined' || document.getElementById('fa-css')) return
  const link = document.createElement('link')
  link.id = 'fa-css'
  link.rel = 'stylesheet'
  link.href = 'https://use.fontawesome.com/releases/v5.15.4/css/all.css'
  link.media = 'print'
  link.onload = () => { link.media = 'all' }
  document.head.appendChild(link)
}

export default defineClientConfig({
  enhance({ router }) {
    loadIcons()
    router.addRoute({
      path: '/firmware/:osStr/:uniqueBuild',
      name: 'firmware',
      component: Layout
    })
    router.addRoute({
      path: '/device/identifier/:key',
      name: 'device/identifier',
      component: Layout
    })
    router.addRoute({
      path: '/device/:groupKey',
      name: 'device',
      component: Layout
    })
  },
})