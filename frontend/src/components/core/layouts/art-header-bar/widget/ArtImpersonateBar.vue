<!-- 模拟登录状态栏：提示当前模拟身份并提供退出模拟 -->
<template>
  <Transition name="art-fade">
    <div
      v-if="userStore.isImpersonating"
      class="flex items-center gap-2 px-2.5 h-8 rounded-md text-xs"
      style="
        color: #ad6800;
        background: rgba(230, 162, 60, 0.12);
        border: 1px solid rgba(230, 162, 60, 0.3);
      "
    >
      <ArtSvgIcon icon="ri:user-follow-line" class="text-sm" />
      <span class="whitespace-nowrap">模拟中：{{ displayName }}</span>
      <ElButton type="warning" size="small" text bg @click="handleExitImpersonate"
        >退出模拟</ElButton
      >
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { storeToRefs } from 'pinia'
  import { useUserStore } from '@/store/modules/user'
  import { setAuthMeta } from '@/api/auth'

  defineOptions({ name: 'ArtImpersonateBar' })

  const userStore = useUserStore()
  const { info } = storeToRefs(userStore)

  const displayName = computed(() => info.value.realName || info.value.userName || '目标用户')

  /**
   * 退出模拟：还原原始会话（token / auth-meta）并重新初始化
   */
  const handleExitImpersonate = () => {
    ElMessageBox.confirm('确定要退出模拟登录，返回到原账号吗？', '退出模拟', {
      confirmButtonText: '退出模拟',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        const origin = userStore.clearImpersonation()
        if (!origin) return
        // 还原原始 token 与按钮权限元信息
        userStore.setToken(origin.token, origin.refreshToken)
        if (origin.authMeta) {
          setAuthMeta(origin.authMeta)
        }
        userStore.setLoginStatus(true)
        // 跳转首页并整页刷新：清除 keepAlive 缓存及模拟身份状态，回到原账号的首页
        window.location.href = '/'
      })
      .catch(() => undefined)
  }
</script>
