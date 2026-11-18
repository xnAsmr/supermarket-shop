/**
 * 用户引导状态管理
 *
 * 负责引导脚本的运行状态机、步骤权限过滤、进度持久化与行为上报。
 *
 * ## 状态机
 *
 * idle → running → finished | skipped
 *
 * ## 主要功能
 *
 * - 首登自动触发（按角色匹配脚本 + 入口页 + 目标元素就绪检测）
 * - 手动重播（头部引导入口）
 * - 步骤过滤（菜单/按钮权限 + 目标元素存在性）
 * - 进度持久化（按 userId 隔离，脚本版本变化后重新引导）
 *
 * ## 持久化
 *
 * - 本地存储键：sys-guide-progress（不随应用版本变化，避免发版导致全员重播）
 * - 结构：{ [userId]: { [scriptId]: { status, scriptVersion, updatedAt } } }
 *
 * @module store/modules/guide
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getGuideScriptById,
  resolveGuideScript,
  type GuideScript,
  type GuideStep
} from '@/config/guide'
import { useUserStore } from './user'
import { useMenuStore } from './menu'
import { router } from '@/router'
import type { AppRouteRecord } from '@/types/router'
import { reportGuideEvent, type GuideReportEventType } from '@/api/guide'

/** 进度存储键（稳定键，不随应用版本变化） */
const PROGRESS_KEY = 'sys-guide-progress'

/** 自动引导最大尝试次数（首屏异步渲染未就绪时重试） */
const MAX_AUTOSTART_ATTEMPTS = 3

/** 单步目标元素等待上限（毫秒） */
const TARGET_WAIT_TIMEOUT = 1200

/** 目标元素轮询间隔（毫秒） */
const TARGET_POLL_INTERVAL = 100

/** 手动重播前的路由等待时间（毫秒，等待页面与菜单渲染） */
const ROUTE_SETTLE_DELAY = 300

/** 前置动作（展开菜单等）后的布局动画等待时间（毫秒） */
const LAYOUT_SETTLE_DELAY = 320

/** 小屏以下不自动引导（移动端菜单为抽屉，定位不可靠） */
const MIN_AUTOSTART_WIDTH = 768

/** 单个脚本的进度 */
interface GuideProgress {
  /** 结束方式 */
  status: 'finished' | 'skipped'
  /** 结束时的脚本版本 */
  scriptVersion: string
  /** 最后停留步骤 */
  lastStepKey?: string
  /** 结束时间 */
  updatedAt: number
}

/** 进度表：userId → scriptId → 进度 */
type GuideProgressMap = Record<string, Record<string, GuideProgress>>

/** 异步等待 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 自动引导判定进行中（防止路由/菜单事件并发触发重复起播） */
let autostartPending = false

/**
 * 读取本地进度
 */
function readProgress(): GuideProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as GuideProgressMap) : {}
  } catch {
    return {}
  }
}

/**
 * 写入本地进度
 * @param map 进度表
 */
function writeProgress(map: GuideProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
  } catch {
    // 存储不可用时静默放弃，下次仍会重新引导
  }
}

/**
 * 解析步骤目标元素
 * @param target 选择器或返回 DOM 的函数
 */
function resolveTarget(target: GuideStep['target']): HTMLElement | null {
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target)
  try {
    return target()
  } catch {
    return null
  }
}

/**
 * 收集菜单树中的全部路径
 * @param list 菜单列表
 * @param acc 累加集合
 */
function collectMenuPaths(list: AppRouteRecord[], acc: Set<string> = new Set()): Set<string> {
  list.forEach((item) => {
    if (item.path) acc.add(item.path)
    if (item.children?.length) collectMenuPaths(item.children, acc)
  })
  return acc
}

/**
 * 用户引导状态管理
 */
export const useGuideStore = defineStore('guideStore', () => {
  /** 当前运行中的脚本 */
  const activeScript = ref<GuideScript | null>(null)
  /** 过滤后的步骤列表 */
  const steps = ref<GuideStep[]>([])
  /** 当前步骤下标 */
  const current = ref(0)
  /** 引导是否展示 */
  const visible = ref(false)
  /** 本地进度缓存 */
  const progressMap = ref<GuideProgressMap>(readProgress())
  /** 本会话是否已完成自动引导判定 */
  const attempted = ref(false)
  /** 自动引导尝试次数 */
  const startAttempts = ref(0)
  /** 完成判定的用户，切换账号后重新判定 */
  const attemptedUserId = ref('')

  /** 当前用户 ID */
  const userId = computed(() => String(useUserStore().info.userId ?? ''))

  /** 当前用户可用的引导脚本（无脚本时头部入口不展示） */
  const availableScript = computed(() => resolveGuideScript(useUserStore().info.roles ?? []))

  /** 当前步骤 */
  const currentStep = computed(() => steps.value[current.value])

  /** 步骤总数 */
  const total = computed(() => steps.value.length)

  /** 菜单路径集合（用于步骤过滤） */
  const menuPaths = computed(() => collectMenuPaths(useMenuStore().menuList))

  /**
   * 查询脚本进度
   * @param scriptId 脚本标识
   */
  const getProgress = (scriptId: string): GuideProgress | undefined => {
    if (!userId.value) return undefined
    return progressMap.value[userId.value]?.[scriptId]
  }

  /**
   * 脚本在当前版本下是否已结束（完成或跳过）
   * @param script 引导脚本
   */
  const isScriptDone = (script: GuideScript): boolean => {
    const progress = getProgress(script.id)
    return !!progress && progress.scriptVersion === script.version
  }

  /**
   * 记录脚本进度
   * @param script 引导脚本
   * @param status 结束方式
   */
  const persistProgress = (script: GuideScript, status: GuideProgress['status']): void => {
    if (!userId.value) return
    const map = { ...progressMap.value }
    const userProgress = { ...(map[userId.value] ?? {}) }
    userProgress[script.id] = {
      status,
      scriptVersion: script.version,
      lastStepKey: currentStep.value?.key,
      updatedAt: Date.now()
    }
    map[userId.value] = userProgress
    progressMap.value = map
    writeProgress(map)
  }

  /**
   * 记录引导行为
   * @param event 事件类型
   * @param stepKey 步骤标识
   */
  const report = (event: GuideReportEventType, stepKey?: string): void => {
    const script = activeScript.value
    if (!script) return
    reportGuideEvent({
      event,
      scriptId: script.id,
      scriptVersion: script.version,
      stepKey,
      total: steps.value.length,
      userId: userId.value
    })
  }

  /**
   * 步骤是否对当前用户可见
   * @param step 引导步骤
   */
  const isStepAvailable = (step: GuideStep): boolean => {
    if (step.menuPath) {
      const exists = [...menuPaths.value].some(
        (path) => path === step.menuPath || path.startsWith(`${step.menuPath}/`)
      )
      if (!exists) return false
    }
    if (step.requireAuth && !(useUserStore().info.buttons ?? []).includes(step.requireAuth)) {
      return false
    }
    return true
  }

  /**
   * 过滤出当前用户可走的步骤
   * @param script 引导脚本
   */
  const resolveAvailableSteps = (script: GuideScript): GuideStep[] =>
    script.steps.filter(isStepAvailable)

  /**
   * 等待步骤目标元素挂载
   * @param step 引导步骤
   */
  const waitForTarget = async (step: GuideStep): Promise<boolean> => {
    const deadline = Date.now() + TARGET_WAIT_TIMEOUT
    while (Date.now() < deadline) {
      if (resolveTarget(step.target)) return true
      await sleep(TARGET_POLL_INTERVAL)
    }
    return !!resolveTarget(step.target)
  }

  /**
   * 准备单个步骤：执行前置动作并等待目标出现
   * @param index 步骤下标
   */
  const prepareStep = async (index: number): Promise<boolean> => {
    const step = steps.value[index]
    if (!step) return false
    if (step.beforeStep) {
      await step.beforeStep()
      // 等待侧边栏等展开动画结束，避免高亮位置偏移
      await sleep(LAYOUT_SETTLE_DELAY)
    }
    return waitForTarget(step)
  }

  /**
   * 从指定下标开始寻找第一个可展示的步骤
   * @param index 起始下标
   * @returns 可用步骤下标，全部不可用时返回 -1
   */
  const ensureStep = async (index: number): Promise<number> => {
    let cursor = index
    while (cursor < steps.value.length) {
      if (await prepareStep(cursor)) return cursor
      cursor += 1
    }
    return -1
  }

  /**
   * 设置运行态脚本（不展示）
   * @param script 引导脚本
   * @param list 过滤后的步骤
   */
  const setActiveScript = (script: GuideScript, list: GuideStep[]): void => {
    activeScript.value = script
    steps.value = list
    current.value = 0
  }

  /**
   * 重置运行态
   */
  const resetRuntime = (): void => {
    visible.value = false
    activeScript.value = null
    steps.value = []
    current.value = 0
  }

  /**
   * 校验首步目标后开始展示
   */
  const begin = async (): Promise<boolean> => {
    const index = await ensureStep(0)
    if (index < 0) return false
    current.value = index
    visible.value = true
    report('start', steps.value[index]?.key)
    return true
  }

  /**
   * 首登自动引导（并发保护）
   * @param routePath 当前路由路径
   */
  const maybeAutostart = async (routePath: string): Promise<void> => {
    if (autostartPending) return
    autostartPending = true
    try {
      await runAutostart(routePath)
    } finally {
      autostartPending = false
    }
  }

  /**
   * 首登自动引导判定
   * @param routePath 当前路由路径
   */
  async function runAutostart(routePath: string): Promise<void> {
    if (visible.value || activeScript.value) return

    // 切换账号后重新判定
    if (attemptedUserId.value !== userId.value) {
      attemptedUserId.value = userId.value
      attempted.value = false
      startAttempts.value = 0
      progressMap.value = readProgress()
    }

    if (attempted.value || startAttempts.value >= MAX_AUTOSTART_ATTEMPTS) return

    // 登录信息或菜单尚未就绪，等待下一次判定，不消耗尝试次数
    if (!userId.value || !menuPaths.value.size) return

    const script = availableScript.value
    if (!script || script.autoplay !== 'first-login') {
      attempted.value = true
      return
    }
    if (isScriptDone(script)) {
      attempted.value = true
      return
    }
    if (typeof window !== 'undefined' && window.innerWidth < MIN_AUTOSTART_WIDTH) {
      attempted.value = true
      return
    }

    const list = resolveAvailableSteps(script)
    if (list.length < 2) {
      attempted.value = true
      return
    }

    // 不在入口页时，仅在首步目标已存在（入口页地址变更）的情况下继续
    if (script.entryPath !== routePath && !resolveTarget(list[0].target)) return

    startAttempts.value += 1
    setActiveScript(script, list)
    const started = await begin()
    if (started) {
      attempted.value = true
      return
    }
    resetRuntime()
    // 首屏元素可能尚未渲染完成，短延迟后重试
    if (startAttempts.value < MAX_AUTOSTART_ATTEMPTS) {
      setTimeout(() => {
        void maybeAutostart(routePath)
      }, 600)
    }
  }

  /**
   * 手动启动引导（可指定脚本）
   * 不在脚本入口页时先跳转，再等待页面渲染
   * @param id 脚本标识，缺省取当前角色匹配的脚本
   */
  const startById = async (id?: string): Promise<boolean> => {
    const script = id ? getGuideScriptById(id) : availableScript.value
    if (!script) return false

    if (visible.value) resetRuntime()

    if (router.currentRoute.value.path !== script.entryPath) {
      await router.push(script.entryPath)
      await sleep(ROUTE_SETTLE_DELAY)
    }

    const list = resolveAvailableSteps(script)
    if (!list.length) return false

    setActiveScript(script, list)
    const started = await begin()
    if (!started) resetRuntime()
    return started
  }

  /**
   * 重播当前角色对应的引导
   */
  const replay = (): Promise<boolean> => startById()

  /**
   * 步骤切换（用户点击上/下一步、关闭后重新打开等）
   * @param index 目标步骤下标
   */
  const onStepChange = (index: number): void => {
    if (!visible.value) return
    const step = steps.value[index]
    if (!step) return
    current.value = index
    report('step_view', step.key)
  }

  /**
   * 校验并跳转到可用步骤（目标元素缺失时自动向后跳过）
   * @param index 期望步骤下标
   * @returns 实际展示下标，无可用步骤返回 -1
   */
  const ensureVisibleStep = async (index: number): Promise<number> => {
    const resolved = await ensureStep(index)
    if (resolved >= 0) current.value = resolved
    return resolved
  }

  /**
   * 中止引导（仅重置运行态，不写入进度）
   * 用于布局卸载等场景，保证下次进入仍可引导
   */
  const abort = (): void => {
    resetRuntime()
  }

  /**
   * 完成引导
   * @param options navigate 为 false 时不执行末步跳转
   */
  const finish = (options?: { navigate?: boolean }): void => {
    const script = activeScript.value
    const cta = steps.value[steps.value.length - 1]?.cta
    if (script) {
      persistProgress(script, 'finished')
      report('finish')
    }
    resetRuntime()
    if (options?.navigate !== false && cta?.to) {
      router.push(cta.to)
    }
  }

  /**
   * 跳过（关闭）引导
   */
  const skip = (): void => {
    const script = activeScript.value
    if (script) {
      persistProgress(script, 'skipped')
      report('skip')
    }
    resetRuntime()
  }

  /**
   * 清除当前用户的引导进度（调试/重新体验用）
   * @param scriptId 脚本标识，缺省清除全部
   */
  const reset = (scriptId?: string): void => {
    if (!userId.value) return
    const map = { ...progressMap.value }
    if (scriptId) {
      const userProgress = { ...(map[userId.value] ?? {}) }
      delete userProgress[scriptId]
      map[userId.value] = userProgress
    } else {
      delete map[userId.value]
    }
    progressMap.value = map
    writeProgress(map)
    attempted.value = false
    startAttempts.value = 0
  }

  return {
    // 状态
    visible,
    steps,
    current,
    activeScript,
    currentStep,
    total,
    availableScript,
    // 方法
    maybeAutostart,
    startById,
    replay,
    onStepChange,
    ensureVisibleStep,
    abort,
    finish,
    skip,
    reset,
    isScriptDone
  }
})
