/**
 * 店长首登引导脚本
 *
 * 动线：经营概览 → 销售趋势 → 库存预警 → 库存/采购/财务模块 → 消息与引导入口
 * 全程停留在工作台（/dashboard/console），末步用跳转卡片进入库存查询
 *
 * @module config/guide/scripts/store-manager
 */
import type { GuideScript } from '../index'
import { expandSidebar } from './shared'

const storeManagerGuide: GuideScript = {
  id: 'store-manager-onboarding',
  version: '1.0.0',
  name: '店长新手引导',
  roles: ['R_ADMIN'],
  // 超管继承全部前端角色，P0 不做超管脚本，避免误命中
  excludeRoles: ['R_SUPER'],
  autoplay: 'first-login',
  entryPath: '/dashboard/console',
  steps: [
    {
      key: 'welcome',
      title: '欢迎回来，这里是经营驾驶舱',
      description: '今日销售额、订单数、毛利与库存预警四项核心指标集中在这里，是每天巡店的第一站。',
      target: '[data-tour="dashboard-stats"]',
      placement: 'bottom'
    },
    {
      key: 'trend',
      title: '近 14 天销售趋势',
      description: '按日看销售额走势，判断促销效果与淡旺季；下方还能看到热销商品与门店排行。',
      target: '[data-tour="dashboard-trend"]',
      placement: 'bottom'
    },
    {
      key: 'low-stock',
      title: '库存预警直接给到 SKU',
      description: '低于安全库存的商品和预警线会逐条列出，点库存查询可看架存与仓存明细并安排补货。',
      target: '[data-tour="dashboard-low-stock"]',
      placement: 'top',
      docLink: '/help'
    },
    {
      key: 'menu-warehouse',
      title: '库存查询与出入库',
      description: '「仓库管理」里可以查架存与仓存、录入入库出库；建议先确认预警阈值再开始补货。',
      target: '[data-tour="menu:/warehouse"]',
      menuPath: '/warehouse',
      placement: 'right',
      beforeStep: expandSidebar
    },
    {
      key: 'menu-purchase',
      title: '采购单在这里审批',
      description:
        '采购单按「提交 → 审批 → 收货」流转，店长审批通过后库存才会入账，记得及时处理待审单据。',
      target: '[data-tour="menu:/purchase"]',
      menuPath: '/purchase',
      placement: 'right',
      beforeStep: expandSidebar,
      docLink: '/help'
    },
    {
      key: 'menu-order',
      title: '订单与退货',
      description: '销售订单支持按单号、收银员、时间筛选，退货退款在「退货退款」页处理。',
      target: '[data-tour="menu:/order"]',
      menuPath: '/order',
      placement: 'right',
      beforeStep: expandSidebar
    },
    {
      key: 'menu-finance',
      title: '日结与经营报表',
      description: '每天打烊后到「财务管理 → 日结管理」生成日结单，收支流水与报表同在此处。',
      target: '[data-tour="menu:/finance"]',
      menuPath: '/finance',
      placement: 'right',
      beforeStep: expandSidebar
    },
    {
      key: 'help',
      title: '消息与引导入口',
      description:
        '审批、公告、门店通知都在右上角铃铛；随时点引导图标可重播本引导，帮助中心有完整操作手册。',
      target: '[data-tour="header-guide"]',
      placement: 'bottom-end',
      cta: {
        label: '去库存查询看看',
        to: '/warehouse/stock'
      }
    }
  ]
}

export default storeManagerGuide
