<template>
  <ElDialog
    v-model="visible"
    :title="dialogType === 'add' ? '新增角色' : '编辑角色'"
    width="30%"
    align-center
    @close="handleClose"
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-width="120px">
      <ElFormItem label="角色名称" prop="roleName">
        <ElInput v-model="form.roleName" placeholder="请输入角色名称" />
      </ElFormItem>
      <ElFormItem label="角色编码" prop="roleCode">
        <ElInput v-model="form.roleCode" placeholder="请输入角色编码" />
      </ElFormItem>
      <ElFormItem label="描述" prop="description">
        <ElInput
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="请输入角色描述"
        />
      </ElFormItem>
      <ElFormItem label="启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
      <!-- 角色范围：仅超级管理员可设置。
           1=租户私有（仅本租户可用）；2=平台共享（所有租户均可用，维护权归超管）；3=平台内置（仅超管可用） -->
      <ElFormItem v-if="isSuperAdmin" label="角色范围" prop="roleScope">
        <ElRadioGroup v-model="form.roleScope">
          <ElRadio :value="1">租户私有（仅本租户可用）</ElRadio>
          <ElRadio :value="2">平台共享（所有租户均可用）</ElRadio>
          <ElRadio :value="3">平台内置（仅超管可用）</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem v-else label="角色范围">
        <span class="text-gray-500">{{ roleScopeText }}</span>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="handleClose">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">提交</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { fetchCreateRole, fetchUpdateRole } from '@/api/system-manage'

  type RoleListItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    dialogType: 'add' | 'edit'
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    dialogType: 'add',
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const userStore = useUserStore()

  /** 当前登录用户为超级管理员（userType=3 → roles 含 R_SUPER），仅其可设置平台共享/平台内置角色 */
  const isSuperAdmin = computed(() => (userStore.info?.roles ?? []).includes('R_SUPER'))

  /** 角色范围文案（非超管只读展示用） */
  const roleScopeText = computed(() => {
    if (form.roleScope === 2) return '平台共享（所有租户均可用，仅超级管理员可修改）'
    if (form.roleScope === 3) return '平台内置（仅超级管理员可用）'
    return '租户私有（仅本租户可用）'
  })

  const formRef = ref<FormInstance>()

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 表单验证规则
   */
  const rules = reactive<FormRules>({
    roleName: [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
      { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
    ],
    roleCode: [
      { required: true, message: '请输入角色编码', trigger: 'blur' },
      { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
    ],
    description: [{ required: true, message: '请输入角色描述', trigger: 'blur' }]
  })

  /**
   * 表单数据
   */
  const form = reactive<RoleListItem>({
    roleId: 0,
    roleName: '',
    roleCode: '',
    description: '',
    createTime: '',
    enabled: true,
    roleScope: 1
  })

  /**
   * 监听弹窗打开，初始化表单数据
   */
  watch(
    () => props.modelValue,
    (newVal) => {
      if (newVal) initForm()
    }
  )

  /**
   * 监听角色数据变化，更新表单
   */
  watch(
    () => props.roleData,
    (newData) => {
      if (newData && props.modelValue) initForm()
    },
    { deep: true }
  )

  /**
   * 初始化表单数据
   * 根据弹窗类型填充表单或重置表单
   */
  const initForm = () => {
    if (props.dialogType === 'edit' && props.roleData) {
      Object.assign(form, props.roleData)
    } else {
      Object.assign(form, {
        roleId: 0,
        roleName: '',
        roleCode: '',
        description: '',
        createTime: '',
        enabled: true,
        roleScope: 1
      })
    }
  }

  /**
   * 关闭弹窗并重置表单
   */
  const handleClose = () => {
    visible.value = false
    formRef.value?.resetFields()
  }

  /**
   * 提交表单
   * 验证通过后调用接口保存数据
   */
  const submitting = ref(false)

  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()
    } catch (error) {
      console.log('表单验证失败:', error)
      return
    }

    submitting.value = true
    try {
      const payload = {
        roleName: form.roleName,
        roleCode: form.roleCode,
        description: form.description,
        enabled: form.enabled,
        // 角色范围：非超管不上送（后端也会强制收敛为租户私有）
        ...(isSuperAdmin.value ? { roleScope: form.roleScope } : {})
      }
      if (props.dialogType === 'add') {
        await fetchCreateRole(payload)
      } else {
        await fetchUpdateRole({ roleId: form.roleId, ...payload })
      }
      ElMessage.success(props.dialogType === 'add' ? '新增成功' : '修改成功')
      emit('success')
      handleClose()
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
