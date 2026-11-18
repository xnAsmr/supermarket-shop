import { defineConfig } from 'vitepress'

/**
 * 连锁超市 ERP 知识库
 * 内容 = 使用教程 + 系统更新日志 + 常见问题
 * 主题色与 ERP 系统主色保持一致
 */
export default defineConfig({
  lang: 'zh-CN',
  title: '连锁超市 ERP 使用手册',
  description: '连锁超市 ERP 系统使用教程、更新日志与常见问题',
  cleanUrls: true,
  lastUpdated: true,

  /* 本地搜索（中文可用，无需外部服务） */
  themeConfig: {
    search: {
      provider: 'local'
    },

    nav: [
      { text: '使用教程', link: '/guide/quick-start' },
      { text: '更新日志', link: '/changelog/' },
      { text: '常见问题', link: '/faq' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [{ text: '快速上手', link: '/guide/quick-start' }]
        },
        {
          text: '门店日常',
          items: [
            { text: '收银台', link: '/guide/pos' },
            { text: '销售订单与退货', link: '/guide/order' },
            { text: '会员管理', link: '/guide/member' }
          ]
        },
        {
          text: '商品与库存',
          items: [
            { text: '商品管理', link: '/guide/product' },
            { text: '库存管理', link: '/guide/inventory' },
            { text: '采购管理', link: '/guide/purchase' }
          ]
        },
        {
          text: '经营与财务',
          items: [
            { text: '经营分析', link: '/guide/analysis' },
            { text: '财务与日结', link: '/guide/finance' }
          ]
        },
        {
          text: '系统与权限',
          items: [
            { text: '消息通知', link: '/guide/notify' },
            { text: '用户与角色', link: '/guide/system' },
            { text: '客户与门店（超管）', link: '/guide/tenant' }
          ]
        }
      ],
      '/changelog/': [
        {
          text: '更新日志',
          items: [
            { text: '更新日志总览', link: '/changelog/' },
            { text: 'v1.0.0', link: '/changelog/v1.0.0' }
          ]
        }
      ],
      '/faq': [
        {
          text: '常见问题',
          items: [{ text: '常见问题', link: '/faq' }]
        }
      ]
    },

    /* 界面文案本地化 */
    outline: { label: '本页目录', level: [2, 3] },
    outlineTitle: '本页目录',
    docFooter: { prev: '上一篇', next: '下一篇' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '返回顶部',
    darkModeSwitchLabel: '深浅色',
    darkModeSwitchTitle: '切换深浅色',
    lightModeSwitchTitle: '切换浅色',
    darkModeSwitchLabelTitle: '切换深色',
    lastUpdatedText: '最后更新于',

    socialLinks: [],

    footer: {
      message: '内容以实际系统版本为准，功能存在疑问请联系系统管理员。',
      copyright: '连锁超市 ERP 使用手册'
    },

    editLink: {
      pattern: '',
      text: ''
    }
  },

  markdown: {
    /* 支持表格自动生成行号等 */
    lineNumbers: false
  }
})
