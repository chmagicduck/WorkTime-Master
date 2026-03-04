// custom-tab-bar/index.ts
interface TabItem {
  icon: string
  label: string
  page: string
}

Component({
  data: {
    selected: 0,
    tabs: [
      { icon: '📈', label: '搞钱中心', page: '/pages/home/index' },
      { icon: '📊', label: '财富战报', page: '/pages/report/index' },
      { icon: '🧪', label: '实验室', page: '/pages/lab/index' },
      { icon: '👤', label: '工位存档', page: '/pages/profile/index' },
    ] as TabItem[],
  },

  methods: {
    onTabTap(e: WechatMiniprogram.BaseEvent) {
      const index = Number((e.currentTarget as WechatMiniprogram.Target).dataset['index'])
      const tabs = this.data.tabs
      const page = tabs[index].page
      wx.switchTab({ url: page })
      this.setData({ selected: index })
    },
  },
})
