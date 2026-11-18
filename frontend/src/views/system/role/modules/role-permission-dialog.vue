<template>
  <ElDialog
    v-model="visible"
    title="菜单权限"
    width="520px"
    align-center
    class="el-dialog-border"
    @close="handleClose"
  >
    <ElScrollbar height="70vh">
      <ElTree
        ref="treeRef"
        :data="processedMenuList"
        show-checkbox
        node-key="name"
        :default-expand-all="isExpandAll"
        :props="defaultProps"
        @check="handleTreeCheck"
      >
        <template #default="{ data }">
          <div style="display: flex; align-items: center">
            <span v-if="data.isAuth">
              {{ data.label }}
            </span>
            <span v-else>{{ defaultProps.label(data) }}</span>
          </div>
        </template>
      </ElTree>
    </ElScrollbar>
    <template #footer>
      <ElButton @click="toggleExpandAll">{{ isExpandAll ? '全部收起' : '全部展开' }}</ElButton>
      <ElButton @click="toggleSelectAll" style="margin-left: 8px">{{
        isSelectAll ? '取消全选' : '全部选择'
      }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="savePermission">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { formatMenuTitle } from '@/utils/router'
  import { fetchGetMenuList, fetchUpdateRole } from '@/api/system-manage'
  import type { AppRouteRecord } from '@/types/router'

  type RoleListItem = Api.SystemManage.RoleListItem

  interface Props {
    modelValue: boolean
    roleData?: RoleListItem
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    roleData: undefined
  })

  const emit = defineEmits<Emits>()

  const treeRef = ref()
  const isExpandAll = ref(true)
  const isSelectAll = ref(false)
  const saving = ref(false)

  /**
   * 菜单权限树数据源：后端全量菜单树（/api/v1/menus/tree）
   *
   * 以 sys_menu 为唯一事实来源——展示、勾选、保存、登录渲染全部基于同一棵树，
   * 避免用本地 asyncRoutes 渲染时出现「勾了但后端无此菜单、保存即静默丢弃」或
   * 「后端已授权但树里没有、显示未勾选、一保存就被清空」的问题。
   */
  const allMenus = ref<AppRouteRecord[]>([])

  /**
   * 弹窗显示状态双向绑定
   */
  const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  /**
   * 菜单节点类型
   */
  interface MenuNode {
    id?: string | number
    name?: string
    label?: string
    meta?: {
      title?: string
      authList?: Array<{
        authMark: string
        title: string
        checked?: boolean
        menuId?: number
      }>
    }
    children?: MenuNode[]
    [key: string]: any
  }

  /**
   * 处理菜单数据，将 authList 转换为树形子节点
   * 递归处理菜单树，将权限列表展开为可选择的子节点
   */
  const processedMenuList = computed(() => {
    const processNode = (node: MenuNode): MenuNode => {
      const processed = { ...node }

      // 如果有 authList，将其转换为子节点
      if (node.meta?.authList?.length) {
        const authNodes = node.meta.authList.map((auth) => {
          // 用 sys_menu 主键做唯一后缀；按钮 permission 末段可能重复（如新增出库/新增上架均为 add）
          const suffix = auth.menuId ?? auth.authMark
          return {
            id: `${node.name}_${suffix}`,
            name: `${node.name}_${suffix}`,
            label: auth.title,
            authMark: auth.authMark,
            checked: auth.checked || false
          }
        })

        processed.children = processed.children ? [...processed.children, ...authNodes] : authNodes
      }

      // 递归处理子节点
      if (processed.children) {
        processed.children = processed.children.map(processNode)
      }

      return processed
    }

    return allMenus.value.map((route) => processNode(route as unknown as MenuNode))
  })

  /**
   * 树形组件配置
   */
  const defaultProps = {
    children: 'children',
    label: (data: any) => formatMenuTitle(data.meta?.title) || data.label || ''
  }

  /**
   * 打开弹窗时按角色已有 roleMenus 回填勾选；无值时给合理默认（R_SUPER 全选，其余清空）
   */
  watch(
    () => props.modelValue,
    async (newVal) => {
      if (!newVal || !props.roleData) return
      // 每次打开都重新拉取全量菜单树，保证新增/删除菜单后立即可见
      allMenus.value = (await fetchGetMenuList()).filter((route) => route.name !== 'Exception')
      await nextTick()
      const tree = treeRef.value
      if (!tree) return
      const roleMenus = props.roleData?.roleMenus
      const keys =
        Array.isArray(roleMenus) && roleMenus.length
          ? roleMenus
          : props.roleData?.roleCode === 'R_SUPER'
            ? getAllNodeKeys(processedMenuList.value)
            : []
      tree.setCheckedKeys(filterToLeafKeys(keys))
      syncSelectAllState()
    }
  )

  /**
   * 关闭弹窗并清空选中状态
   */
  const handleClose = () => {
    visible.value = false
    treeRef.value?.setCheckedKeys([])
    isSelectAll.value = false
  }

  /**
   * 保存权限配置：收集勾选节点（含父级），持久化到角色 roleMenus
   *
   * 必须合并 getHalfCheckedKeys()：半选（indeterminate）父目录表示其下仍有
   * 已授权子菜单，目录本身要保留。否则父目录授权被静默丢弃，下次登录时
   * 后端 getUserMenuTree 会把孤儿子菜单提升为一级菜单（侧边栏扁平化）。
   * 典型场景：「消息通知」目录因「平台公告」仅超管可用，对租户管理员
   * 天然处于半选态——只存 getCheckedKeys 会在任何一次保存时把它丢掉。
   */
  const savePermission = async () => {
    const tree = treeRef.value
    if (!tree || !props.roleData) return
    saving.value = true
    try {
      const checkedKeys = [
        ...new Set([
          ...(tree.getCheckedKeys() as string[]),
          ...(tree.getHalfCheckedKeys() as string[])
        ])
      ]
      await fetchUpdateRole({
        roleId: props.roleData.roleId,
        roleName: props.roleData.roleName,
        roleCode: props.roleData.roleCode,
        roleMenus: checkedKeys
      })
      ElMessage.success('权限保存成功')
      emit('success')
      handleClose()
    } catch (error) {
      console.error(error)
    } finally {
      saving.value = false
    }
  }

  /**
   * 切换全部展开/收起状态
   */
  const toggleExpandAll = () => {
    const tree = treeRef.value
    if (!tree) return

    const nodes = tree.store.nodesMap
    // 这里保留 any，因为 Element Plus 的内部节点类型较复杂
    Object.values(nodes).forEach((node: any) => {
      node.expanded = !isExpandAll.value
    })

    isExpandAll.value = !isExpandAll.value
  }

  /**
   * 切换全选/取消全选状态
   */
  const toggleSelectAll = () => {
    const tree = treeRef.value
    if (!tree) return

    if (!isSelectAll.value) {
      const allKeys = getAllNodeKeys(processedMenuList.value)
      tree.setCheckedKeys(allKeys)
    } else {
      tree.setCheckedKeys([])
    }

    isSelectAll.value = !isSelectAll.value
  }

  /**
   * 回填勾选前过滤出叶子节点 key。
   *
   * el-tree 级联模式（check-strictly 默认 false）下，setCheckedKeys 传入父节点
   * 会把其全部子节点勾上；而保存时会合并 getHalfCheckedKeys()（半选父目录必须保留，
   * 否则目录授权丢失），因此「只勾了部分子菜单」的授权在重新打开弹窗时会被父节点
   * key 级联回全选，看起来像设置不生效。只勾叶子节点，父级勾选/半选状态由组件
   * 依据子节点自动推导，显示与保存的数据一致。
   *
   * @param keys 待回填的节点 key（含父目录与半选父级）
   * @returns 仅包含叶子节点的 key
   */
  const filterToLeafKeys = (keys: string[]): string[] => {
    if (!keys.length) return []
    const leafKeys = new Set<string>()
    const walk = (nodes: MenuNode[]): void => {
      nodes.forEach((node) => {
        if (node.children?.length) {
          walk(node.children)
        } else if (node.name) {
          leafKeys.add(node.name)
        }
      })
    }
    walk(processedMenuList.value)
    return keys.filter((key) => leafKeys.has(key))
  }

  /**
   * 递归获取所有节点的 key
   * @param nodes 节点列表
   * @returns 所有节点的 key 数组
   */
  const getAllNodeKeys = (nodes: MenuNode[]): string[] => {
    const keys: string[] = []
    const traverse = (nodeList: MenuNode[]): void => {
      nodeList.forEach((node) => {
        if (node.name) keys.push(node.name)
        if (node.children?.length) traverse(node.children)
      })
    }
    traverse(nodes)
    return keys
  }

  /**
   * 同步全选按钮状态：全选 ⇔ 没有半选节点 且 全选节点数 = 全部节点数
   */
  const syncSelectAllState = () => {
    const tree = treeRef.value
    if (!tree) return
    const checkedCount = (tree.getCheckedKeys() as string[]).length
    const halfCheckedCount = (tree.getHalfCheckedKeys() as string[]).length
    const allKeys = getAllNodeKeys(processedMenuList.value)
    isSelectAll.value = allKeys.length > 0 && halfCheckedCount === 0 && checkedCount === allKeys.length
  }

  /**
   * 处理树节点选中状态变化
   * 同步更新全选按钮状态
   */
  const handleTreeCheck = () => {
    syncSelectAllState()
  }
</script>
