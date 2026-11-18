<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑商品' : '新增商品'"
    width="720px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="商品名称" prop="name">
            <ElInput v-model="formData.name" placeholder="请输入商品名称" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="商品条码" prop="barcode">
            <ElInput v-model="formData.barcode" placeholder="请输入条码" maxlength="32" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="商品分类" prop="categoryId">
            <ElSelect v-model="formData.categoryId" placeholder="请选择分类" filterable>
              <ElOption
                v-for="item in categoryOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="品牌" prop="brandId">
            <div class="flex items-center gap-1">
              <ElSelect
                v-model="formData.brandId"
                placeholder="请选择品牌"
                clearable
                filterable
                class="flex-1"
              >
                <ElOption
                  v-for="item in brandOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </ElSelect>
              <ElButton
                v-if="canManageBrand"
                type="primary"
                link
                class="shrink-0"
                @click="openBrandDialog()"
              >
                维护
              </ElButton>
            </div>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="供应商" prop="supplierId">
            <ElSelect v-model="formData.supplierId" placeholder="请选择供应商" clearable filterable>
              <ElOption
                v-for="item in supplierOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="单位" prop="unit">
            <ElInput v-model="formData.unit" placeholder="件/瓶/箱" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="规格" prop="spec">
            <ElInput v-model="formData.spec" placeholder="如 500ml/瓶" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="预警库存" prop="warningStock">
            <ElInputNumber v-model="formData.warningStock" :min="0" :precision="0" class="w-full" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="紧急库存" prop="stockUrgentThreshold">
            <ElInputNumber
              v-model="formData.stockUrgentThreshold"
              :max="formData.warningStock"
              :min="0"
              :precision="0"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="进价" prop="purchasePrice">
            <ElInputNumber
              v-model="formData.purchasePrice"
              :min="0"
              :precision="2"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="售价" prop="salePrice">
            <ElInputNumber v-model="formData.salePrice" :min="0.01" :precision="2" class="w-full" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="会员价" prop="memberPrice">
            <ElInputNumber v-model="formData.memberPrice" :min="0" :precision="2" class="w-full" />
          </ElFormItem>
        </ElCol>
        <ElCol v-if="!isEdit" :span="12">
          <ElFormItem label="初始仓库" prop="warehouseId">
            <ElSelect v-model="formData.warehouseId" placeholder="请选择仓库" filterable>
              <ElOption
                v-for="item in warehouseOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol v-if="!isEdit" :span="12">
          <ElFormItem label="初始库存" prop="initStock">
            <ElInputNumber v-model="formData.initStock" :min="0" :precision="0" class="w-full" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="销售状态" prop="status">
            <ElRadioGroup v-model="formData.status">
              <ElRadioButton value="1">在售</ElRadioButton>
              <ElRadioButton value="2">停售</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="商品图片" prop="image">
            <div class="flex items-center gap-3">
              <ElUpload
                :show-file-list="false"
                :http-request="handleUpload"
                :before-upload="beforeUpload"
                accept="image/jpeg,image/png,image/gif,image/webp"
                :disabled="uploading"
              >
                <div
                  class="flex size-28 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400 transition hover:border-gray-400 hover:text-gray-600"
                  :class="{ 'pointer-events-none opacity-60': uploading }"
                >
                  <span v-if="uploading">上传中...</span>
                  <span v-else>+ 点击上传</span>
                </div>
              </ElUpload>
              <div
                v-if="formData.image"
                class="relative size-28 overflow-hidden rounded-md border border-gray-200"
              >
                <ElImage
                  :src="formData.image"
                  fit="cover"
                  class="size-full"
                  :preview-src-list="[formData.image]"
                  preview-teleported
                />
                <ElButton
                  type="danger"
                  size="small"
                  circle
                  class="!absolute right-1 top-1"
                  @click="formData.image = ''"
                >
                  ×
                </ElButton>
              </div>
              <span class="text-xs text-gray-400">jpg/png/gif/webp，≤2MB</span>
            </div>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="备注" prop="remark">
            <ElInput v-model="formData.remark" type="textarea" :rows="2" placeholder="备注信息" />
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

  <ElDialog
    v-model="brandDialogVisible"
    :title="brandForm.id ? '编辑品牌' : '新增品牌'"
    width="440px"
    append-to-body
    align-center
  >
    <ElForm ref="brandFormRef" :model="brandForm" :rules="brandRules" label-width="88px">
      <ElFormItem label="品牌名称" prop="name">
        <ElInput v-model="brandForm.name" placeholder="请输入品牌名称" maxlength="50" />
      </ElFormItem>
      <ElFormItem label="排序" prop="sort">
        <ElInputNumber v-model="brandForm.sort" :min="0" :precision="0" class="w-full" />
      </ElFormItem>
      <ElFormItem label="品牌描述" prop="description">
        <ElInput
          v-model="brandForm.description"
          type="textarea"
          :rows="2"
          maxlength="200"
          placeholder="品牌描述"
        />
      </ElFormItem>
    </ElForm>
    <div v-if="brandForm.id && hasAuth('brand:delete')" class="mb-2 ml-[88px]">
      <ElButton type="danger" link @click="handleDeleteBrand">删除该品牌</ElButton>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="brandDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="brandSaving" @click="handleSaveBrand">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import {
    fetchCreateBrand,
    fetchCreateProduct,
    fetchDeleteBrand,
    fetchGetBrandOptions,
    fetchGetCategoryOptions,
    fetchGetSupplierOptions,
    fetchUpdateBrand,
    fetchUpdateProduct,
    fetchUploadProductImage
  } from '@/api/product'
  import { fetchGetWarehouseList } from '@/api/warehouse'
  import { useAuth } from '@/hooks/core/useAuth'
  import type { FormInstance, FormRules } from 'element-plus'

  type ProductItem = Api.Product.ProductItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    productData?: Partial<ProductItem>
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

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const { hasAuth } = useAuth()

  const categoryOptions = ref<{ label: string; value: string }[]>([])
  const supplierOptions = ref<{ label: string; value: string }[]>([])
  const warehouseOptions = ref<{ label: string; value: string }[]>([])
  const brandOptions = ref<(Api.Product.BrandItem & { label: string; value: string })[]>([])

  const formData = reactive({
    id: '',
    name: '',
    barcode: '',
    categoryId: '',
    supplierId: '',
    brandId: '',
    unit: '件',
    spec: '',
    purchasePrice: 0,
    salePrice: 0,
    memberPrice: 0,
    warningStock: 10,
    stockUrgentThreshold: 3,
    status: '1' as Api.Common.EnableStatus,
    remark: '',
    image: '',
    warehouseId: '',
    initStock: 0
  })

  const uploading = ref(false)

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入商品名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ],
    barcode: [{ required: true, message: '请输入商品条码', trigger: 'blur' }],
    categoryId: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
    salePrice: [{ required: true, message: '请输入售价', trigger: 'blur' }],
    unit: [{ required: true, message: '请输入单位', trigger: 'blur' }]
  }

  const brandDialogVisible = ref(false)
  const brandSaving = ref(false)
  const brandFormRef = ref<FormInstance>()

  const brandForm = reactive({
    id: '',
    name: '',
    description: '',
    sort: 0
  })

  const brandRules: FormRules = {
    name: [
      { required: true, message: '请输入品牌名称', trigger: 'blur' },
      { min: 1, max: 50, message: '长度需在 1-50 个字符', trigger: 'blur' }
    ]
  }

  /** 是否具备任一品牌维护权限（新增 / 编辑 / 删除） */
  const canManageBrand = computed(
    () => hasAuth('brand:add') || hasAuth('brand:edit') || hasAuth('brand:delete')
  )

  const reloadBrands = async () => {
    brandOptions.value = (await fetchGetBrandOptions()).map((item) => ({
      ...item,
      label: item.name,
      value: item.id
    }))
  }

  const openBrandDialog = () => {
    const current = brandOptions.value.find((item) => item.value === formData.brandId)
    Object.assign(brandForm, {
      id: current?.id || '',
      name: current?.label || '',
      description: current?.description || '',
      sort: current?.sort ?? 0
    })
    brandDialogVisible.value = true
    nextTick(() => brandFormRef.value?.clearValidate())
  }

  const initFormData = () => {
    const row = props.productData
    Object.assign(formData, {
      id: row?.id || '',
      name: row?.name || '',
      barcode: row?.barcode || '',
      categoryId: row?.categoryId || '',
      supplierId: row?.supplierId || '',
      brandId: row?.brandId || '',
      unit: row?.unit || '件',
      spec: row?.spec || '',
      purchasePrice: row?.purchasePrice ?? 0,
      salePrice: row?.salePrice ?? 0,
      memberPrice: row?.memberPrice ?? 0,
      warningStock: row?.warningStock ?? 10,
      stockUrgentThreshold: row?.stockUrgentThreshold ?? 3,
      status: row?.status ?? '1',
      remark: row?.remark || '',
      image: row?.image || '',
      warehouseId: warehouseOptions.value[0]?.value || '',
      initStock: 0
    })
  }

  const loadOptions = async () => {
    const [categories, suppliers, warehouses, brands] = await Promise.all([
      fetchGetCategoryOptions(),
      fetchGetSupplierOptions(),
      fetchGetWarehouseList(),
      fetchGetBrandOptions()
    ])
    categoryOptions.value = categories.map((item) => ({ label: item.name, value: item.id }))
    supplierOptions.value = suppliers.map((item) => ({ label: item.name, value: item.id }))
    warehouseOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
    brandOptions.value = brands.map((item) => ({ ...item, label: item.name, value: item.id }))
  }

  /** 上传前校验：格式与大小 */
  const beforeUpload = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      ElMessage.error('只支持 jpg/png/gif/webp 格式')
      return false
    }
    if (file.size > 2 * 1024 * 1024) {
      ElMessage.error('图片大小不能超过 2MB')
      return false
    }
    return true
  }

  /** 自定义上传：调用后端 /api/v1/upload/image/product，成功后回填 URL */
  const handleUpload = async (options: { file: File }) => {
    uploading.value = true
    try {
      const url = await fetchUploadProductImage(options.file)
      formData.image = url
      ElMessage.success('图片上传成功')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '图片上传失败')
    } finally {
      uploading.value = false
    }
  }

  /** 保存品牌（新增 / 编辑），保存后刷新下拉并回选新增项 */
  const handleSaveBrand = async () => {
    if (!brandFormRef.value) return
    const valid = await brandFormRef.value.validate().catch(() => false)
    if (!valid) return

    const isBrandEdit = Boolean(brandForm.id)
    if (isBrandEdit ? !hasAuth('brand:edit') : !hasAuth('brand:add')) return

    brandSaving.value = true
    const data = {
      name: brandForm.name.trim(),
      description: brandForm.description,
      sort: brandForm.sort
    }
    try {
      if (isBrandEdit) {
        await fetchUpdateBrand(brandForm.id, data)
      } else {
        await fetchCreateBrand(data)
      }
      ElMessage.success(isBrandEdit ? '品牌已更新' : '品牌已创建')
      await reloadBrands()
      if (!isBrandEdit) {
        const created = brandOptions.value.find((item) => item.name === data.name)
        if (created) formData.brandId = created.id
      }
      brandDialogVisible.value = false
    } catch (error) {
      console.error(error)
    } finally {
      brandSaving.value = false
    }
  }

  /** 删除品牌，同时清空表单中已选中的该品牌 */
  const handleDeleteBrand = () => {
    if (!brandForm.id || !hasAuth('brand:delete')) return
    ElMessageBox.confirm(`确定删除品牌「${brandForm.name}」吗？删除后不可恢复。`, '删除品牌', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchDeleteBrand(brandForm.id)
        if (formData.brandId === brandForm.id) formData.brandId = ''
        ElMessage.success('删除成功')
        await reloadBrands()
        brandDialogVisible.value = false
      })
      .catch(() => undefined)
  }

  watch(
    () => [props.visible, props.type, props.productData],
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
        await fetchUpdateProduct({ ...formData })
      } else {
        await fetchCreateProduct({ ...formData })
      }
      ElMessage.success(isEdit.value ? '商品已更新' : '商品已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }

  onMounted(loadOptions)
</script>
