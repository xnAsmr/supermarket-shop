/**
 * 快速入口配置
 * 包含：应用列表、快速链接等配置
 */
import type { FastEnterConfig } from '@/types/config'

const fastEnterConfig: FastEnterConfig = {
  // 显示条件（屏幕宽度）
  minWidth: 1200,
  // 应用列表
  applications: [
    {
      name: '经营驾驶舱',
      description: '实时查看门店经营数据',
      icon: 'ri:pie-chart-line',
      iconColor: '#377dff',
      enabled: true,
      order: 1,
      routeName: 'Console'
    },
    {
      name: '收银台',
      description: '商品扫码与快速结账',
      icon: 'ri:scan-line',
      iconColor: '#13DEB9',
      enabled: true,
      order: 2,
      routeName: 'PosCheckout'
    },
    {
      name: '商品管理',
      description: '商品档案与分类供应商',
      icon: 'ri:shopping-bag-line',
      iconColor: '#ff3b30',
      enabled: true,
      order: 3,
      routeName: 'ProductList'
    },
    {
      name: '采购订单',
      description: '采购订单与到货收货',
      icon: 'ri:shopping-cart-2-line',
      iconColor: '#ffb100',
      enabled: true,
      order: 4,
      routeName: 'PurchaseOrder'
    },
    {
      name: '销售订单',
      description: '订单流水与退货退款',
      icon: 'ri:file-list-3-line',
      iconColor: '#7A7FFF',
      enabled: true,
      order: 5,
      routeName: 'OrderSales'
    },
    {
      name: '库存查询',
      description: '各门店库存与预警',
      icon: 'ri:box-3-line',
      iconColor: '#38C0FC',
      enabled: true,
      order: 6,
      routeName: 'WarehouseStock'
    },
    {
      name: '经营报表',
      description: '收支趋势与利润分析',
      icon: 'ri:line-chart-line',
      iconColor: '#ff6b6b',
      enabled: true,
      order: 7,
      routeName: 'FinanceReport'
    }
  ],
  // 快速链接
  quickLinks: [
    {
      name: '登录',
      enabled: true,
      order: 1,
      routeName: 'Login'
    },
    {
      name: '个人中心',
      enabled: true,
      order: 2,
      routeName: 'UserCenter'
    }
  ]
}

export default Object.freeze(fastEnterConfig)
