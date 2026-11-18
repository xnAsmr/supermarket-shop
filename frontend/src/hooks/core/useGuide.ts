/**
 * useGuide - 用户引导门面
 *
 * 业务侧统一通过该 Hook 访问引导能力，避免直接依赖 store 细节。
 *
 * ## 使用场景
 *
 * - 顶部栏引导入口（重播）
 * - 帮助中心「重新观看引导」入口
 *
 * @module hooks/core/useGuide
 */
import { computed } from 'vue'
import { useGuideStore } from '@/store/modules/guide'

export function useGuide() {
  const guideStore = useGuideStore()

  /** 当前角色是否有可用引导脚本（控制入口显隐） */
  const canUseGuide = computed(() => !!guideStore.availableScript)

  /** 引导是否运行中 */
  const isRunning = computed(() => guideStore.visible)

  /** 当前步骤标题（可做起播提示） */
  const currentStepTitle = computed(() => guideStore.currentStep?.title ?? '')

  /** 步骤总数 */
  const total = computed(() => guideStore.total)

  /**
   * 启动引导
   * @param id 脚本标识，缺省按当前角色匹配
   */
  const startGuide = (id?: string) => guideStore.startById(id)

  /** 重播当前角色对应的引导 */
  const replayGuide = () => guideStore.replay()

  /** 结束（跳过）引导 */
  const stopGuide = () => guideStore.skip()

  /** 清除当前用户引导进度（调试用） */
  const resetGuide = (id?: string) => guideStore.reset(id)

  return {
    canUseGuide,
    isRunning,
    currentStepTitle,
    total,
    startGuide,
    replayGuide,
    stopGuide,
    resetGuide
  }
}
