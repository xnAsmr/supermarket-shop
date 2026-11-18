/**
 * 引导脚本公共动作
 *
 * @module config/guide/scripts/shared
 */
import { useSettingStore } from '@/store/modules/setting'

/**
 * 展开侧边栏
 * 菜单处于收起状态时，菜单项宽度为 0，ElTour 无法正确高亮，需先展开
 */
export function expandSidebar(): void {
  const settingStore = useSettingStore()
  if (!settingStore.menuOpen) {
    settingStore.setMenuOpen(true)
  }
}
