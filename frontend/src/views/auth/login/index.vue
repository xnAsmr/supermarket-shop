<!-- 登录页面 -->
<template>
  <div class="flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            :key="formKey"
            @keyup.enter="handleSubmit"
            style="margin-top: 25px"
          >
            <ElFormItem prop="account">
              <ElSelect v-model="formData.account" @change="setupAccount">
                <ElOption
                  v-for="account in accounts"
                  :key="account.key"
                  :label="account.label"
                  :value="account.key"
                >
                  <div style="display: flex; flex-direction: column; line-height: 1.4; padding: 2px 0">
                    <span style="font-weight: 600">
                      {{ account.username }}
                      <span style="font-size: 12px; font-weight: 400; opacity: 0.6">{{ account.roleText }}</span>
                    </span>
                    <span style="font-size: 12px; opacity: 0.65">
                      {{ account.realName }} · {{ account.tenantName }}<template v-if="account.storeName"> · {{ account.storeName }}</template>
                    </span>
                  </div>
                </ElOption>
              </ElSelect>
              <div v-if="loadedFromDb" class="dev-account-tip">{{ $t('login.devAccountsTip') }}</div>
            </ElFormItem>
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
                v-model.trim="formData.username"
              />
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                v-model.trim="formData.password"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <!-- 推拽验证 -->
            <div class="relative pb-5 mt-6">
              <div
                class="relative z-[2] overflow-hidden select-none rounded-lg border border-transparent tad-300"
                :class="{ '!border-[#FF4E4F]': !isPassing && isClickPass }"
              >
                <ArtDragVerify
                  ref="dragVerify"
                  v-model:value="isPassing"
                  :text="$t('login.sliderText')"
                  textColor="var(--art-gray-700)"
                  :successText="$t('login.sliderSuccessText')"
                  progressBarBg="var(--main-color)"
                  :background="isDark ? '#26272F' : '#F1F1F4'"
                  handlerBg="var(--default-box-color)"
                />
              </div>
              <p
                class="absolute top-0 z-[1] px-px mt-2 text-xs text-[#f56c6c] tad-300"
                :class="{ 'translate-y-10': !isPassing && isClickPass }"
              >
                {{ $t('login.placeholder.slider') }}
              </p>
            </div>

            <div class="flex-cb mt-2 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">{{
                $t('login.rememberPwd')
              }}</ElCheckbox>
              <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">{{
                $t('login.forgetPwd')
              }}</RouterLink>
            </div>

            <div style="margin-top: 30px">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="handleSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-gray-600">
              <span>{{ $t('login.noAccount') }}</span>
              <RouterLink class="text-theme" :to="{ name: 'Register' }">{{
                $t('login.register')
              }}</RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { HttpError } from '@/utils/http/error'
  import { fetchDevLoginAccounts, fetchLogin } from '@/api/auth'
  import { ElNotification, type FormInstance, type FormRules } from 'element-plus'
  import { useSettingStore } from '@/store/modules/setting'

  defineOptions({ name: 'Login' })

  const settingStore = useSettingStore()
  const { isDark } = storeToRefs(settingStore)
  const { t, locale } = useI18n()
  const formKey = ref(0)

  // 监听语言切换，重置表单并刷新账号下拉里的角色文案
  watch(locale, () => {
    formKey.value++
    void loadAccounts()
  })

  const DEV_DEFAULT_PASSWORD = '123456'

  interface Account {
    key: string
    label: string
    username: string
    password: string
    realName: string
    tenantName: string
    storeName: string
    roleText: string
  }

  // 后端未提供调试账号接口时（非 dev profile / 服务未启动）仍保留原来的三个演示账号
  const fallbackAccounts = computed<Account[]>(() => [
    {
      key: 'sysadmin',
      label: t('login.roles.super'),
      username: 'sysadmin',
      password: DEV_DEFAULT_PASSWORD,
      realName: '系统管理员',
      tenantName: '故辰',
      storeName: '',
      roleText: t('login.roles.super')
    },
    {
      key: 'admin',
      label: t('login.roles.admin'),
      username: 'admin',
      password: DEV_DEFAULT_PASSWORD,
      realName: '故辰店长',
      tenantName: '故辰',
      storeName: '阳光超市总店',
      roleText: t('login.roles.admin')
    },
    {
      key: 'linlin',
      label: t('login.roles.cashier'),
      username: 'linlin',
      password: DEV_DEFAULT_PASSWORD,
      realName: '琳琳',
      tenantName: '故辰',
      storeName: '',
      roleText: t('login.roles.cashier')
    }
  ])

  const accounts = ref<Account[]>([])
  const loadedFromDb = ref(false)

  const roleTextOf = (userType: number): string =>
    userType === 3
      ? t('login.roles.super')
      : userType === 2
        ? t('login.roles.admin')
        : t('login.roles.cashier')

  /** 拉取数据库中全部启用账号（仅 dev 环境提供），失败时回退演示账号 */
  const loadAccounts = async () => {
    accounts.value = fallbackAccounts.value
    try {
      const list = await fetchDevLoginAccounts()
      if (!list.length) return
      accounts.value = list.map((item) => ({
        key: item.username,
        label: `${item.username} · ${item.tenantName}`,
        username: item.username,
        password: DEV_DEFAULT_PASSWORD,
        realName: item.realName || item.username,
        tenantName: item.tenantName || '-',
        storeName: item.storeName || '',
        roleText: roleTextOf(item.userType)
      }))
      loadedFromDb.value = true
    } catch {
      // 非 dev 环境或后端未启动，保持兜底列表
    }
  }

  const dragVerify = ref()

  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()
  const isPassing = ref(false)
  const isClickPass = ref(false)

  const formRef = ref<FormInstance>()

  const formData = reactive({
    account: '',
    username: '',
    password: '',
    rememberPassword: true
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }]
  }))

  const loading = ref(false)

  onMounted(async () => {
    await loadAccounts()
    const preferred = accounts.value.some((a) => a.key === 'sysadmin')
      ? 'sysadmin'
      : (accounts.value[0]?.key ?? '')
    setupAccount(preferred)
  })

  // 设置账号
  const setupAccount = (key: string) => {
    const selectedAccount = accounts.value.find((account) => account.key === key)
    formData.account = key
    formData.username = selectedAccount?.username ?? ''
    formData.password = selectedAccount?.password ?? DEV_DEFAULT_PASSWORD
  }

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      // 拖拽验证
      if (!isPassing.value) {
        isClickPass.value = true
        return
      }

      loading.value = true

      // 登录请求
      const { username, password } = formData

      const { token, refreshToken } = await fetchLogin({
        userName: username,
        password
      })

      // 验证token
      if (!token) {
        throw new Error('Login failed - no token received')
      }

      // 存储 token 和登录状态
      userStore.setToken(token, refreshToken)
      userStore.setLoginStatus(true)

      // 登录成功处理
      showLoginSuccessNotice()

      // 获取 redirect 参数，如果存在则跳转到指定页面，否则跳转到首页
      const redirect = route.query.redirect as string
      router.push(redirect || '/')
    } catch (error) {
      // 处理 HttpError
      if (error instanceof HttpError) {
        // console.log(error.code)
      } else {
        // 处理非 HttpError
        // ElMessage.error('登录失败，请稍后重试')
        console.error('[Login] Unexpected error:', error)
      }
    } finally {
      loading.value = false
      resetDragVerify()
    }
  }

  // 重置拖拽验证
  const resetDragVerify = () => {
    dragVerify.value.reset()
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        message: `${t('login.success.message')}, ${formData.username}!`
      })
    }, 1000)
  }
</script>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-select__wrapper) {
    height: 40px !important;
  }

  .dev-account-tip {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.65;
  }
</style>
