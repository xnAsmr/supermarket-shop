import type { App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { staticRoutes } from './routes/staticRoutes'
import { extraRoutes } from './routes/extraRoutes'
import { configureNProgress } from '@/utils/router'
import { setupBeforeEachGuard } from './guards/beforeEach'
import { setupAfterEachGuard } from './guards/afterEach'

// 创建路由实例
export const router = createRouter({
  history: createWebHashHistory(),
  // 静态路由（免登录）+ 扩展路由（非菜单详情页，需登录）
  routes: [...staticRoutes, ...extraRoutes]
})

// 初始化路由
export function initRouter(app: App<Element>): void {
  configureNProgress() // 顶部进度条
  setupBeforeEachGuard(router) // 路由前置守卫
  setupAfterEachGuard(router) // 路由后置守卫
  app.use(router)
}

// 主页路径，默认使用菜单第一个有效路径，配置后使用此路径
export const HOME_PAGE_PATH = ''
