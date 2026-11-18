/**
 * 用户引导（新手引导）配置
 *
 * 统一管理交互式引导脚本：首登漫游、按角色匹配、可重播。
 * 引导脚本只描述「讲什么、指哪里」，渲染与状态由 ArtGuideTour + guide store 负责。
 *
 * ## 设计约定
 *
 * - 锚点统一使用 `data-tour` 选择器，禁止依赖文本或层级（后端菜单随时会变）
 * - 步骤可声明 menuPath / requireAuth，运行时按当前用户权限自动剔除
 * - 不自动跨页：脚本入口固定 entryPath，末步用 cta 跳转卡片结束引导
 *
 * @module config/guide
 */

import storeManagerGuide from './scripts/store-manager'
import cashierGuide from './scripts/cashier'

/** 步骤气泡位置（与 Element Plus ElTour 保持一致） */
export type GuideStepPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end'

/** 引导末步的跳转卡片 */
export interface GuideCta {
  /** 按钮文案 */
  label: string
  /** 跳转目标路由 */
  to: string
}

/** 单个引导步骤 */
export interface GuideStep {
  /** 步骤唯一标识（去重与埋点使用） */
  key: string
  /** 步骤标题 */
  title: string
  /** 步骤说明 */
  description: string
  /** 高亮目标：data-tour 选择器或返回 DOM 的函数 */
  target: string | (() => HTMLElement | null)
  /** 气泡位置，默认 bottom */
  placement?: GuideStepPlacement
  /** 依赖的菜单路径，用户无该菜单时自动剔除该步骤 */
  menuPath?: string
  /** 依赖的按钮权限标识，用户无该权限时自动剔除该步骤 */
  requireAuth?: string
  /** 知识库深链（/help 内嵌文档站） */
  docLink?: string
  /** 末步跳转卡片 */
  cta?: GuideCta
  /** 步骤展示前的准备动作（如展开侧边栏），可返回 Promise */
  beforeStep?: () => void | Promise<void>
}

/** 一套引导脚本 */
export interface GuideScript {
  /** 脚本唯一标识（进度存储 key） */
  id: string
  /** 脚本版本，版本变化后已完成的用户会重新看到引导 */
  version: string
  /** 脚本名称（用于提示与埋点） */
  name: string
  /** 适用角色，命中其一即可 */
  roles: string[]
  /** 排除角色（如超管在 P1 单独出脚本，避免误命中） */
  excludeRoles?: string[]
  /** 自动触发方式 */
  autoplay: 'first-login' | 'manual'
  /** 引导启动页面（引导全程在该页面内串联） */
  entryPath: string
  /** 步骤列表 */
  steps: GuideStep[]
}

/**
 * 引导脚本注册表
 * 顺序即优先级：同时命中多个脚本时取第一个（店长优先于收银员）
 */
export const GUIDE_SCRIPTS: GuideScript[] = [storeManagerGuide, cashierGuide]

/**
 * 按用户角色匹配引导脚本
 * @param roles 当前用户角色标识
 */
export function resolveGuideScript(roles: string[]): GuideScript | undefined {
  return GUIDE_SCRIPTS.find((script) => {
    // 排除角色优先：如超管不参与 P0 的两套脚本
    if (script.excludeRoles?.some((role) => roles.includes(role))) return false
    return script.roles.some((role) => roles.includes(role))
  })
}

/**
 * 按 id 获取引导脚本
 * @param id 脚本标识
 */
export function getGuideScriptById(id: string): GuideScript | undefined {
  return GUIDE_SCRIPTS.find((script) => script.id === id)
}
