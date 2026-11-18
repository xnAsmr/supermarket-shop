<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑用户' : '新增用户'"
    width="560px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem label="用户名" prop="userName">
        <ElInput v-model="formData.userName" placeholder="请输入用户名" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="姓名" prop="nickName">
        <ElInput v-model="formData.nickName" placeholder="请输入真实姓名" maxlength="20" />
      </ElFormItem>
      <ElFormItem label="手机号" prop="userPhone">
        <ElInput v-model="formData.userPhone" placeholder="请输入手机号" maxlength="11" />
      </ElFormItem>
      <ElFormItem label="邮箱" prop="userEmail">
        <ElInput v-model="formData.userEmail" placeholder="请输入邮箱（可选）" />
      </ElFormItem>
      <ElFormItem label="性别" prop="userGender">
        <ElRadioGroup v-model="formData.userGender">
          <ElRadioButton value="男">男</ElRadioButton>
          <ElRadioButton value="女">女</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem label="角色" prop="userRoles">
        <ElSelect v-model="formData.userRoles" multiple placeholder="请选择角色" class="w-full">
          <ElOption
            v-for="role in roleList"
            :key="role.roleCode"
            :label="role.roleName"
            :value="role.roleCode"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="状态" prop="status">
        <ElRadioGroup v-model="formData.status">
          <ElRadioButton value="1">启用</ElRadioButton>
          <ElRadioButton value="2">停用</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>
      <!-- 用户类型：仅超级管理员(userType=3)可见，可授予/调整特殊权限身份 -->
      <ElFormItem v-if="isSuperAdmin" label="用户类型" prop="userType">
        <ElSelect v-model="formData.userType" placeholder="请选择用户类型" class="w-full">
          <ElOption label="普通用户" :value="1" />
          <ElOption label="系统管理员" :value="2" />
          <ElOption label="超级管理员" :value="3" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem v-if="!isEdit" label="初始密码">
        <ElInput v-model="formData.password" disabled />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchCreateUser, fetchUpdateUser, fetchGetRoleList } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import type { FormInstance, FormRules } from 'element-plus'

  type UserListItem = Api.SystemManage.UserListItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    userData?: Partial<UserListItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const isEdit = computed(() => props.type === 'edit')

  const userStore = useUserStore()
  /** 当前登录用户为超级管理员（userType=3 → roles 含 R_SUPER） */
  const isSuperAdmin = computed(() => (userStore.info.roles ?? []).includes('R_SUPER'))

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const roleList = ref<Api.SystemManage.RoleListItem[]>([])

  const formData = reactive({
    id: 0,
    userName: '',
    nickName: '',
    userPhone: '',
    userEmail: '',
    userGender: '男',
    userRoles: [] as string[],
    status: '1' as Api.Common.EnableStatus,
    userType: 1,
    password: '123456'
  })

  const rules: FormRules = {
    userName: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 2, max: 20, message: '长度需在 2-20 个字符之间', trigger: 'blur' }
    ],
    nickName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    userPhone: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }],
    userRoles: [{ required: true, message: '请选择角色', trigger: 'change' }]
  }

  const initFormData = () => {
    const row = props.userData
    Object.assign(formData, {
      id: row?.id ?? 0,
      userName: row?.userName || '',
      nickName: row?.nickName || '',
      userPhone: row?.userPhone || '',
      userEmail: row?.userEmail || '',
      userGender: row?.userGender || '男',
      userRoles: row?.userRoles ? [...row.userRoles] : [],
      status: (row?.status as Api.Common.EnableStatus) || '1',
      userType: row?.userType ?? 1,
      password: '123456'
    })
  }

  const loadRoles = async () => {
    try {
      const res = await fetchGetRoleList({ current: 1, size: 100 })
      // 角色范围：租户私有(1)本租户可用；平台共享(2)所有租户均可分配给本租户用户；
      // 平台内置(3)仅超级管理员可分配——非超管在下达中过滤掉（后端亦有校验）
      roleList.value = isSuperAdmin.value
        ? res.records
        : res.records.filter((role) => role.roleScope !== 3)
    } catch (error) {
      console.error(error)
    }
  }

  watch(
    () => [props.visible, props.type, props.userData],
    ([visible]) => {
      if (visible) {
        initFormData()
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      if (isEdit.value) {
        await fetchUpdateUser({ ...formData })
      } else {
        await fetchCreateUser({ ...formData })
      }
      ElMessage.success(isEdit.value ? '用户已更新' : '用户已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }

  onMounted(loadRoles)
</script>
