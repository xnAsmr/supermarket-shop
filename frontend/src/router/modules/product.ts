import { AppRouteRecord } from '@/types/router'

export const productRoutes: AppRouteRecord = {
  path: '/product',
  name: 'Product',
  component: '/index/index',
  meta: {
    title: 'menus.product.title',
    icon: 'ri:shopping-bag-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'list',
      name: 'ProductList',
      component: '/product/list',
      meta: {
        title: 'menus.product.list',
        icon: 'ri:shopping-bag-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' },
          { title: '新增品牌', authMark: 'brand:add' },
          { title: '编辑品牌', authMark: 'brand:edit' },
          { title: '删除品牌', authMark: 'brand:delete' }
        ]
      }
    },
    {
      path: 'category',
      name: 'ProductCategory',
      component: '/product/category',
      meta: {
        title: 'menus.product.category',
        icon: 'ri:apps-2-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'supplier',
      name: 'ProductSupplier',
      component: '/product/supplier',
      meta: {
        title: 'menus.product.supplier',
        icon: 'ri:truck-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    }
  ]
}
