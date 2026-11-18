<!-- 导出字段选择弹窗：勾选要导出的列后再交给 ArtExcelExport 生成 xlsx（不重复实现导出逻辑） -->
<template>
  <ElDialog v-model="visible" :title="title" width="640px" append-to-body @open="handleOpen">
    <div class="export-summary">
      <span>
        共 <b>{{ rows.length }}</b> 条数据（当前筛选条件下的全部记录）
      </span>
      <span>
        已选 <b>{{ selected.length }}</b> / {{ fields.length }} 个字段
      </span>
    </div>

    <div class="export-toolbar">
      <ElSpace :size="4">
        <ElButton link type="primary" @click="selectAll">全选</ElButton>
        <ElButton link type="primary" @click="invertSelect">反选</ElButton>
        <ElButton link type="primary" @click="restoreDefault">恢复默认</ElButton>
      </ElSpace>
      <ElCheckbox v-model="withIndex">包含「序号」列</ElCheckbox>
    </div>

    <!-- 字段顺序即表格列顺序，勾选先后不影响导出列顺序 -->
    <ElCheckboxGroup v-model="selected" class="export-fields">
      <ElCheckbox v-for="field in fields" :key="field.prop" :value="field.prop">
        {{ field.label }}
      </ElCheckbox>
    </ElCheckboxGroup>

    <p class="export-tip">
      导出范围为当前筛选条件下的全部数据，按表格列顺序生成，枚举列自动转成中文；至少勾选一个字段。
    </p>

    <template #footer>
      <ElButton v-ripple @click="visible = false">取消</ElButton>
      <!-- 下载动作完全交给 ArtExcelExport：这里只负责提供勾选后的数据与列标题 -->
      <ArtExcelExport
        type="primary"
        button-text="确认导出"
        loading-text="生成文件中..."
        :data="exportRows"
        :columns="exportColumns"
        :filename="filename"
        :sheet-name="sheetName"
        :auto-index="withIndex"
        :index-column-title="indexColumnTitle"
        :append-timestamp="false"
        :disabled="selected.length === 0"
        @export-success="visible = false"
      />
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'

  defineOptions({ name: 'ArtExportFieldsDialog' })

  /** 可导出字段：prop 对应数据字段，label 对应表格中文列名 */
  interface ExportField {
    prop: string
    label: string
    /** 纯文本转换（枚举 → 中文），不传则导出原始值 */
    text?: (row: any) => string
  }

  interface Props {
    /** 可导出字段（顺序即导出列顺序） */
    fields: ExportField[]
    /** 待导出数据（当前筛选条件下的全量记录） */
    rows: any[]
    /** 文件名前缀，弹窗打开时拼上 yyyyMMdd_HHmm 时间戳，避免同名覆盖 */
    filenamePrefix: string
    title?: string
    sheetName?: string
    indexColumnTitle?: string
    /** 默认勾选的字段，通常传当前表格可见列；不传则全选 */
    defaultSelected?: string[]
  }

  const props = withDefaults(defineProps<Props>(), {
    title: '导出 Excel',
    sheetName: 'Sheet1',
    indexColumnTitle: '序号',
    defaultSelected: () => []
  })

  /** 弹窗显隐（父组件 v-model 控制） */
  const visible = defineModel<boolean>({ default: false })

  const selected = ref<string[]>([])
  const withIndex = ref(true)
  const filename = ref('')

  /** 勾选字段：始终按字段定义顺序过滤，保证导出列顺序稳定 */
  const selectedFields = computed(() =>
    props.fields.filter((field) => selected.value.includes(field.prop))
  )

  /** 导出数据：只保留勾选字段的原始值，转文本交给 ArtExcelExport 的 columns.formatter */
  const exportRows = computed(() =>
    props.rows.map((row) => {
      const item: Record<string, any> = {}
      selectedFields.value.forEach((field) => {
        item[field.prop] = row[field.prop]
      })
      return item
    })
  )

  /** 列配置：标题取表格中文列名；formatter 只拿到子集行，故按索引回查原始行取文本 */
  const exportColumns = computed(() => {
    const columns: Record<
      string,
      { title: string; formatter?: (value: any, row: any, index: number) => string }
    > = {}
    selectedFields.value.forEach((field) => {
      columns[field.prop] = {
        title: field.label,
        formatter: field.text
          ? (_value, _row, index) => {
              const origin = props.rows[index]
              return origin && field.text ? field.text(origin) : ''
            }
          : undefined
      }
    })
    return columns
  })

  /** 全选 */
  const selectAll = () => {
    selected.value = props.fields.map((field) => field.prop)
  }

  /** 反选（保留字段顺序） */
  const invertSelect = () => {
    const current = new Set(selected.value)
    selected.value = props.fields.filter((field) => !current.has(field.prop)).map((f) => f.prop)
  }

  /** 恢复默认：优先用父组件传入的可见列，未传则全选 */
  const restoreDefault = () => {
    const preset = props.defaultSelected.filter((prop) =>
      props.fields.some((field) => field.prop === prop)
    )
    selected.value = preset.length ? [...preset] : props.fields.map((field) => field.prop)
  }

  /** 文件名时间戳：20261029_1530 */
  const formatStamp = (date: Date): string => {
    const pad = (value: number) => String(value).padStart(2, '0')
    const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    return `${day}_${pad(date.getHours())}${pad(date.getMinutes())}`
  }

  /** 每次打开都重置勾选与文件名，避免上一次的选择残留 */
  const handleOpen = () => {
    restoreDefault()
    withIndex.value = true
    filename.value = `${props.filenamePrefix}_${formatStamp(new Date())}`
  }
</script>

<style lang="scss" scoped>
  .export-summary {
    display: flex;
    gap: 20px;
    font-size: 13px;
    color: var(--art-gray-700);

    b {
      font-weight: 600;
      color: var(--el-color-primary);
    }
  }

  .export-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--art-gray-200);
  }

  .export-fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 12px;
    max-height: 280px;
    margin-top: 14px;
    overflow: auto;
  }

  .export-tip {
    margin: 16px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--art-gray-500);
  }
</style>
