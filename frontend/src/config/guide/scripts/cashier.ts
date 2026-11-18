/**
 * 收银员首登引导脚本
 *
 * 动线：经营概览 → 库存预警 → 收银入口 → 订单查询 → 消息通知 → 帮助中心
 * 全程停留在工作台（/dashboard/console），末步用跳转卡片进入收银台
 *
 * @module config/guide/scripts/cashier
 */
import type { GuideScript } from '../index'
import { expandSidebar } from './shared'

const cashierGuide: GuideScript = {
  id: 'cashier-onboarding',
  version: '1.0.0',
  name: '收银员新手引导',
  roles: ['R_USER'],
  // 超管继承全部前端角色，P0 不做超管脚本，避免误命中
  excludeRoles: ['R_SUPER'],
  autoplay: 'first-login',
  entryPath: '/dashboard/console',
  steps: [
    {
      key: 'welcome',
      title: '欢迎使用连锁超市 ERP',
      description:
        '这里是经营驾驶舱：今日销售额、订单数、毛利和库存预警都汇总在顶部，交接班前先看这四项。',
      target: '[data-tour="dashboard-stats"]',
      placement: 'bottom'
    },
    {
      key: 'low-stock',
      title: '留意库存预警',
      description: '货架库存低于安全线的商品会在这里列出，发现缺货请及时上报店长补货。',
      target: '[data-tour="dashboard-low-stock"]',
      placement: 'top'
    },
    {
      key: 'menu-pos',
      title: '收银入口在侧边栏',
      description: '点击「收银管理 → 收银台」进入收银页面，扫码或点选商品即可开单。',
      target: '[data-tour="menu:/pos"]',
      menuPath: '/pos',
      placement: 'right',
      beforeStep: expandSidebar
    },
    {
      key: 'menu-order',
      title: '订单与退货都在这里',
      description: '需要查历史小票、处理退货退款时，到「订单管理」按单号或时间筛选。',
      target: '[data-tour="menu:/order"]',
      menuPath: '/order',
      placement: 'right',
      beforeStep: expandSidebar,
      docLink: '/help'
    },
    {
      key: 'notification',
      title: '消息统一在铃铛里',
      description: '补货审批结果、门店通知和系统公告都会推送到这里，未读数量会直接显示在图标上。',
      target: '[data-tour="header-notice"]',
      placement: 'bottom-end'
    },
    {
      key: 'help',
      title: '随时可以重看引导',
      description:
        '点右上角的引导图标可以随时重播本引导；点「帮助中心」还能查看收银、退货等操作手册。',
      target: '[data-tour="header-guide"]',
      placement: 'bottom-end',
      cta: {
        label: '去收银台试试',
        to: '/pos/checkout'
      }
    }
  ]
}

export default cashierGuide
