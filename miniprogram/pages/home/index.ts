// pages/home/index.ts
import { storage } from '../../utils/storage'
import { Timer } from '../../utils/timer'
import { eventBus } from '../../utils/event-bus'

type WorkStatus = 'working' | 'fishing' | 'overtime'

interface TimelineItem {
  type: 'work' | 'fish' | 'overtime' | 'rest'
  heightPercent: number
}

Page({
  data: {
    // Layout
    statusBarHeight: 44,
    contentHeight: 500,
    pageHeight: 667,

    // Status
    status: 'working' as WorkStatus,
    statusText: '系统运行中',
    statusBadgeText: '正常搬砖中',

    // Button classes (computed from status)
    fishBtnClass: 'status-btn--inactive',
    otBtnClass: 'status-btn--inactive',

    // Countdown
    countdown: '--:--:--',
    pulse: false,
    todayHours: '0.0',

    // Earnings (placeholder — calculation logic TBD)
    fishEarnings: '0.00',
    workEarnings: '0.00',

    // Micro cards
    daysToSalary: 0,
    daysToRest: 0,

    // State
    isWorkTime: false,

    // Timeline
    timelineData: [] as TimelineItem[],
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarH = sysInfo.statusBarHeight || 44
    const windowH = sysInfo.windowHeight || 667
    // 去掉 di-row 后，header = statusBarH + header-content(56)
    // 原生 tabBar：windowHeight 已自动扣除 tabBar 高度
    const contentH = windowH - statusBarH - 56

    this.setData({
      statusBarHeight: statusBarH,
      contentHeight: contentH > 100 ? contentH : 400,
      pageHeight: windowH,
    })

    // Restore saved status
    const savedStatus = storage.get<WorkStatus>(storage.KEYS.CURRENT_STATUS)
    if (savedStatus) {
      this.applyStatus(savedStatus)
    }

    this.buildTimeline()
    this.startTimer()
    this.refreshData()
  },

  onShow() {
    const timer = (this as any)._timer as Timer | null
    if (timer && !timer.isRunning()) {
      timer.start()
    }
  },

  onHide() {
    // Timer keeps running for background time tracking
  },

  onUnload() {
    const timer = (this as any)._timer as Timer | null
    if (timer) {
      timer.stop()
    }
    const handler = (this as any)._secondHandler as ((...args: unknown[]) => void) | null
    if (handler) {
      eventBus.off('timer:second', handler)
    }
  },

  // ─── Setup ──────────────────────────────────────────────────

  buildTimeline() {
    const timelineData: TimelineItem[] = Array.from({ length: 24 }, (_, i) => {
      if (i < 9 || i > 21) return { type: 'rest' as const, heightPercent: 33 }
      if (i >= 9 && i < 12) return { type: 'work' as const, heightPercent: 100 }
      if (i >= 12 && i < 14) return { type: 'fish' as const, heightPercent: 100 }
      if (i >= 14 && i < 18) return { type: 'work' as const, heightPercent: 100 }
      return { type: 'overtime' as const, heightPercent: 100 }
    })
    this.setData({ timelineData })
  },

  startTimer() {
    const handler = () => { this.refreshData() }
    ;(this as any)._secondHandler = handler
    eventBus.on('timer:second', handler)

    const timer = new Timer(() => { /* raw 100ms tick unused */ })
    ;(this as any)._timer = timer
    timer.start()
  },

  // ─── Data refresh (every second) ────────────────────────────

  refreshData() {
    const now = new Date()
    const isWorkTime = this.calcIsWorkTime(now)
    const fishEarnings = storage.get<number>(storage.KEYS.TODAY_FISH_EARNINGS) || 0
    const workEarnings = storage.get<number>(storage.KEYS.TODAY_WORK_EARNINGS) || 0

    this.setData({
      countdown: this.calcCountdown(now),
      pulse: !this.data.pulse,
      todayHours: this.calcTodayHours(now),
      isWorkTime,
      daysToSalary: this.calcDaysToSalary(now),
      daysToRest: this.calcDaysToRest(now),
      fishEarnings: fishEarnings.toFixed(2),
      workEarnings: workEarnings.toFixed(2),
    })
  },

  // ─── Calculations ────────────────────────────────────────────

  calcCountdown(now: Date): string {
    const endH = storage.get<number>(storage.KEYS.WORK_END_HOUR) || 18
    const endM = storage.get<number>(storage.KEYS.WORK_END_MIN) || 30

    const target = new Date(now)
    target.setHours(endH, endM, 0, 0)
    const diff = target.getTime() - now.getTime()
    if (diff <= 0) return '下班时刻'

    const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
    return h + ':' + m + ':' + s
  },

  calcIsWorkTime(now: Date): boolean {
    const startH = storage.get<number>(storage.KEYS.WORK_START_HOUR) || 9
    const startM = storage.get<number>(storage.KEYS.WORK_START_MIN) || 0
    const endH = storage.get<number>(storage.KEYS.WORK_END_HOUR) || 18
    const endM = storage.get<number>(storage.KEYS.WORK_END_MIN) || 30

    const cur = now.getHours() * 60 + now.getMinutes()
    const start = startH * 60 + startM
    const end = endH * 60 + endM
    return cur >= start && cur <= end
  },

  calcTodayHours(now: Date): string {
    const startH = storage.get<number>(storage.KEYS.WORK_START_HOUR) || 9
    const startM = storage.get<number>(storage.KEYS.WORK_START_MIN) || 0

    const cur = now.getHours() * 60 + now.getMinutes()
    const start = startH * 60 + startM
    if (cur < start) return '0.0'

    const mins = Math.min(cur - start, 570) // cap at 9.5h
    return (mins / 60).toFixed(1)
  },

  calcDaysToSalary(now: Date): number {
    const salaryDay = storage.get<number>(storage.KEYS.SALARY_DAY) || 15
    const today = now.getDate()
    const y = now.getFullYear()
    const mo = now.getMonth()

    const target = today < salaryDay
      ? new Date(y, mo, salaryDay)
      : new Date(y, mo + 1, salaryDay)

    target.setHours(0, 0, 0, 0)
    const base = new Date(now)
    base.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - base.getTime()) / 86400000)
  },

  calcDaysToRest(now: Date): number {
    const day = now.getDay() // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return 0
    return 6 - day
  },

  // ─── Status helpers ──────────────────────────────────────────

  applyStatus(s: WorkStatus) {
    const textMap: Record<WorkStatus, string> = {
      working: '系统运行中',
      fishing: '正在体面摸鱼',
      overtime: '正在加班中',
    }
    const badgeMap: Record<WorkStatus, string> = {
      working: '正常搬砖中',
      fishing: '正在偷偷休息',
      overtime: '正在被迫输出',
    }
    this.setData({
      status: s,
      statusText: textMap[s],
      statusBadgeText: badgeMap[s],
      fishBtnClass: s === 'fishing' ? 'status-btn--fish-active' : 'status-btn--inactive',
      otBtnClass: s === 'overtime' ? 'status-btn--ot-active' : 'status-btn--inactive',
    })
  },

  // ─── Event handlers ──────────────────────────────────────────

  toggleFishing() {
    if (!this.data.isWorkTime) return
    const next: WorkStatus = this.data.status === 'fishing' ? 'working' : 'fishing'
    storage.set(storage.KEYS.CURRENT_STATUS, next)
    storage.set(storage.KEYS.STATUS_START_TIME, Date.now())
    this.applyStatus(next)
  },

  toggleOvertime() {
    if (this.data.isWorkTime) return
    const next: WorkStatus = this.data.status === 'overtime' ? 'working' : 'overtime'
    storage.set(storage.KEYS.CURRENT_STATUS, next)
    storage.set(storage.KEYS.STATUS_START_TIME, Date.now())
    this.applyStatus(next)
  },
})
