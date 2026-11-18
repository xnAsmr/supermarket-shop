<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新增会员' : '编辑会员'"
    width="600px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="会员姓名" prop="name">
            <ElInput v-model="formData.name" placeholder="请输入会员姓名" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="手机号" prop="phone">
            <ElInput v-model="formData.phone" placeholder="请输入手机号" maxlength="11" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="性别" prop="gender">
            <ElRadioGroup v-model="formData.gender">
              <ElRadio :value="0">未知</ElRadio>
              <ElRadio :value="1">男</ElRadio>
              <ElRadio :value="2">女</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="生日" prop="birthday">
            <ElDatePicker
              v-model="formData.birthday"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择生日"
              style="width: 100%"
              :disabled-date="(time: Date) => time.getTime() > Date.now()"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="会员等级" prop="levelId">
            <ElSelect v-model="formData.levelId" placeholder="请选择会员等级" clearable>
              <ElOption
                v-for="item in LEVEL_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="邮箱" prop="email">
            <ElInput v-model="formData.email" placeholder="请输入邮箱（选填）" maxlength="100" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="地址" prop="address">
            <ElInput
              v-model="formData.address"
              type="textarea"
              :rows="2"
              placeholder="联系地址（选填）"
              maxlength="200"
            />
          </ElFormItem>
        </ElCol>
      </ElRow>
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
  import { fetchCreateMember, fetchUpdateMember } from '@/api/member'
  import type { FormInstance, FormRules } from 'element-plus'

  type MemberItem = Api.Member.MemberItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    userData?: MemberItem | null
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    userData: null
  })
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const LEVEL_OPTIONS = [
    { label: '普通会员', value: '1' },
    { label: '银卡会员', value: '2' },
    { label: '金卡会员', value: '3' },
    { label: '钻石会员', value: '4' }
  ]

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const formData = reactive<Api.Member.MemberUpsertPayload>({
    name: '',
    phone: '',
    gender: 0,
    birthday: undefined,
    levelId: undefined,
    email: '',
    address: ''
  })

  const rules: FormRules = {
    name: [{ required: true, message: '请输入会员姓名', trigger: 'blur' }],
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      {
        pattern: /^1[3-9]\d{9}$/,
        message: '请输入正确的手机号',
        trigger: 'blur'
      }
    ]
  }

  const initFormData = () => {
    const user = props.userData
    formData.name = user?.name ?? ''
    formData.phone = user?.phone ?? ''
    formData.gender = user?.gender ?? 0
    formData.birthday = user?.birthday ?? undefined
    formData.levelId = user?.levelId ?? undefined
    formData.email = user?.email ?? ''
    formData.address = user?.address ?? ''
  }

  watch(
    () => props.visible,
    (visible) => {
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
      const payload: Api.Member.MemberUpsertPayload = {
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        birthday: formData.birthday,
        levelId: formData.levelId,
        email: formData.email,
        address: formData.address
      }
      if (props.type === 'add') {
        await fetchCreateMember(payload)
        ElMessage.success('会员已创建')
      } else {
        await fetchUpdateMember(String(props.userData?.id), payload)
        ElMessage.success('会员已更新')
      }
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
