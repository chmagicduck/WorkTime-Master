// pages/report/index.ts
Page({
  data: {
    statusBarHeight: 44,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight || 44 })
  },

  onShow() {
    const getTabBar = (this as any).getTabBar
    if (typeof getTabBar === 'function') {
      const tabBar = getTabBar.call(this)
      if (tabBar) { tabBar.setData({ selected: 1 }) }
    }
  },
})
