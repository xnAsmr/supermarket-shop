/**
 * 租户状态管理
 *
 * 当前租户（连锁品牌/门店）的切换与持久化，
 * Mock Service 层据此做数据隔离。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const DEFAULT_TENANT_ID = 'T001'

export const useTenantStore = defineStore(
  'tenantStore',
  () => {
    /** 当前租户 ID */
    const currentId = ref<string>(DEFAULT_TENANT_ID)

    /** 切换租户 */
    const switchTenant = (id: string) => {
      if (!id || id === currentId.value) return
      currentId.value = id
    }

    /** 恢复默认租户（登出时使用） */
    const resetTenant = () => {
      currentId.value = DEFAULT_TENANT_ID
    }

    const isDefault = computed(() => currentId.value === DEFAULT_TENANT_ID)

    return {
      currentId,
      isDefault,
      switchTenant,
      resetTenant
    }
  },
  {
    persist: {
      key: 'tenant',
      storage: localStorage
    }
  }
)
