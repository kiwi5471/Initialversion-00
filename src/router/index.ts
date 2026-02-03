import { createRouter, createWebHashHistory } from 'vue-router'
import Index from '@/pages/Index.vue'
import ReceiptRecognition from '@/pages/ReceiptRecognition.vue'
import NotFound from '@/pages/NotFound.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Index
  },
  {
    path: '/recognition',
    name: 'Recognition',
    component: ReceiptRecognition
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
