<!-- 用户引导漫游（基于 Element Plus ElTour） -->
<template>
  <ElTour
    v-if="guide.visible && guide.steps.length"
    v-model:current="guide.current"
    :model-value="true"
    type="primary"
    :mask="true"
    :gap="{ offset: 6, radius: 6 }"
    :z-index="GUIDE_Z_INDEX"
    :content-style="{ maxWidth: '320px' }"
    :scroll-into-view-options="{ block: 'center' }"
    :show-close="true"
    @change="handleChange"
    @finish="handleFinish"
    @close="handleClose"
  >
    <ElTourStep
      v-for="(step, index) in guide.steps"
      :key="step.key"
      :target="step.target"
      :title="step.title"
      :placement="step.placement || 'bottom'"
      :next-button-props="index === guide.steps.length - 1 ? { children: finishText } : undefined"
    >
      <template #default>
        <p class="guide-step__desc">{{ step.description }}</p>
        <ElLink
          v-if="step.docLink"
          class="guide-step__doc"
          type="primary"
          :underline="false"
          @click="openDoc(step.docLink)"
        >
          查看使用手册
        </ElLink>
      </template>
    </ElTourStep>
  </ElTour>
</template>

<script setup lang="ts">
  import { useRoute } from 'vue-router'
  import { useGuideStore } from '@/store/modules/guide'
  import { useMenuStore } from '@/store/modules/menu'
  import { router } from '@/router'

  defineOptions({ name: 'ArtGuideTour' })

  /** 引导层级需高于设置面板、通知抽屉等浮层 */
  const GUIDE_Z_INDEX = 4000

  const guide = useGuideStore()
  const menuStore = useMenuStore()
  const route = useRoute()

  /** 防止自动跳过步骤时重复触发校验 */
  let guardBusy = false

  /** 末步按钮文案：有跳转卡片时优先用卡片文案 */
  const finishText = computed(() => {
    const last = guide.steps[guide.steps.length - 1]
    return last?.cta?.label ?? '完成'
  })

  /**
   * 尝试首登自动引导
   * 由入口页、菜单加载完成两个时机触发，未进入入口页时 store 内部会直接返回
   */
  const tryAutostart = (): void => {
    void guide.maybeAutostart(route.path)
  }

  onMounted(tryAutostart)

  // 路由与菜单异步就绪后再判定，避免首屏目标元素尚未挂载
  watch(() => [route.path, menuStore.menuList.length], tryAutostart)

  onUnmounted(() => {
    // 布局卸载（如退出登录）只重置运行态，不写入进度，下次进入仍可引导
    guide.abort()
  })

  /**
   * 步骤切换：目标元素缺失时自动向后跳过
   * @param index 目标步骤下标
   */
  const handleChange = async (index: number): Promise<void> => {
    if (guardBusy) return
    guide.onStepChange(index)
    guardBusy = true
    try {
      const resolved = await guide.ensureVisibleStep(index)
      if (resolved < 0) guide.finish({ navigate: false })
    } finally {
      guardBusy = false
    }
  }

  /** 引导完成：记录进度并执行末步跳转 */
  const handleFinish = (): void => {
    guide.finish()
  }

  /** 关闭（跳过）引导 */
  const handleClose = (): void => {
    guide.skip()
  }

  /**
   * 在新标签打开知识库，避免中断当前引导
   * @param to 目标路由
   */
  const openDoc = (to: string): void => {
    window.open(router.resolve(to).href, '_blank', 'noopener')
  }
</script>

<style lang="scss" scoped>
  .guide-step__desc {
    margin: 0;
    line-height: 1.7;
    font-size: 13px;
  }

  .guide-step__doc {
    display: inline-block;
    margin-top: 8px;
    font-size: 12px;
  }
</style>
