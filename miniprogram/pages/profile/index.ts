// pages/profile/index.ts
import { storage } from '../../utils/storage'

interface DailyRecord {
  date: string
  workSeconds: number
  fishSeconds: number
  overtimeSeconds: number
  workEarnings: number
  fishEarnings: number
}

interface LevelConfig {
  minDays: number
  title: string
}

const LEVEL_CONFIGS: LevelConfig[] = [
  { minDays: 0, title: '见习打工人' },
  { minDays: 7, title: '初级搬砖员' },
  { minDays: 30, title: '资深摸鱼师' },
  { minDays: 90, title: '高级摸鱼执行官' },
  { minDays: 180, title: '摸鱼总监' },
  { minDays: 365, title: '首席摸鱼官' },
]

function computeLevel(totalDays: number): number {
  return Math.min(Math.floor(totalDays / 5) + 1, 99)
}

function computeTitle(totalDays: number): string {
  let title = LEVEL_CONFIGS[0].title
  for (let i = 0; i < LEVEL_CONFIGS.length; i++) {
    if (totalDays >= LEVEL_CONFIGS[i].minDays) {
      title = LEVEL_CONFIGS[i].title
    }
  }
  return title
}

Page({
  data: {
    statusBarHeight: 44,
    pageHeight: 667,
    scrollHeight: 500,

    // 个人名片
    levelTitle: '见习打工人',
    level: 1,
    totalEarnings: '0.00',

    // 弹窗
    showResetConfirm: false,

    // 已配置的关键信息摘要（展示用）
    configSummary: '尚未配置',
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarH = sysInfo.statusBarHeight || 44
    const windowH = sysInfo.windowHeight || 667
    // header = statusBarH + 56；scroll area = remaining
    const scrollH = windowH - statusBarH - 56

    this.setData({
      statusBarHeight: statusBarH,
      pageHeight: windowH,
      scrollHeight: scrollH > 100 ? scrollH : 400,
    })
  },

  onShow() {
    this.computeStats()

    const getTabBar = (this as any).getTabBar
    if (typeof getTabBar === 'function') {
      const tabBar = getTabBar.call(this)
      if (tabBar) {
        tabBar.setData({ selected: 3 })
      }
    }
  },

  computeStats() {
    const S = storage.KEYS
    const history = storage.get<DailyRecord[]>(S.HISTORY_RECORDS) || []

    let totalEarnings = 0
    for (let i = 0; i < history.length; i++) {
      const r = history[i]
      totalEarnings += (r.workEarnings || 0) + (r.fishEarnings || 0)
    }

    const totalDays = history.length

    // 配置摘要
    const monthlySalary = storage.get<number>(S.MONTHLY_SALARY)
    const startH = storage.get<number>(S.WORK_START_HOUR) || 9
    const startM = storage.get<number>(S.WORK_START_MIN) || 0
    const endH = storage.get<number>(S.WORK_END_HOUR) || 18
    const endM = storage.get<number>(S.WORK_END_MIN) || 30
    const pad = (n: number) => n < 10 ? '0' + n : String(n)
    const configSummary = monthlySalary
      ? '¥' + monthlySalary + '/月  ' + pad(startH) + ':' + pad(startM) + '–' + pad(endH) + ':' + pad(endM)
      : '尚未配置'

    this.setData({
      level: computeLevel(totalDays),
      levelTitle: computeTitle(totalDays),
      totalEarnings: totalEarnings.toFixed(2),
      configSummary,
    })
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/onboarding/index?step=setup' })
  },

  showResetDialog() {
    this.setData({ showResetConfirm: true })
  },

  cancelReset() {
    this.setData({ showResetConfirm: false })
  },

  confirmReset() {
    storage.clearAll()
    this.setData({ showResetConfirm: false })
    wx.reLaunch({ url: '/pages/onboarding/index' })
  },
})
