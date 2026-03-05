// pages/home/index.ts
import { storage } from '../../utils/storage'
import { Timer } from '../../utils/timer'
import { eventBus } from '../../utils/event-bus'

type WorkStatus = 'working' | 'fishing' | 'overtime'
type WorkMode = 'double_rest' | 'sat_only' | 'sun_only' | 'alternate'

interface TimelineItem {
  type: 'work' | 'fish' | 'overtime' | 'rest'
  heightPercent: number
}

interface DailyRecord {
  date: string
  workSeconds: number
  fishSeconds: number
  overtimeSeconds: number
  workEarnings: number
  fishEarnings: number
}

interface CountdownResult {
  label: string   // 卡片标题（空字符串时不展示标题徽章）
  value: string   // 主显示值
  endInfo: string // 右上角辅助文本
}

// ─── 纯函数工具 ───────────────────────────────────────────────

function formatDate(d: Date): string {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : String(m)) + '-' + (day < 10 ? '0' + day : String(day))
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function msToDuration(ms: number): string {
  const total = Math.max(0, ms)
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  return pad(h) + ':' + pad(m) + ':' + pad(s)
}

// ─────────────────────────────────────────────────────────────

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

    // Button states
    fishBtnClass: 'status-btn--inactive',
    otBtnClass: 'status-btn--inactive',

    // Countdown
    countdownLabel: '逃离办公室倒计时',
    countdownEndInfo: '18:30 准时下班',
    countdown: '--:--:--',
    pulse: false,

    // Today's work hours
    todayHours: '0.0',

    // Earnings
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
    // 首次使用：引导未完成则跳转
    const done = storage.get<boolean>(storage.KEYS.ONBOARDING_DONE)
    if (!done) {
      wx.redirectTo({ url: '/pages/onboarding/index' })
      return
    }

    const sysInfo = wx.getSystemInfoSync()
    const statusBarH = sysInfo.statusBarHeight || 44
    const windowH = sysInfo.windowHeight || 667
    // 原生 tabBar：windowHeight 已自动扣除 tabBar 高度
    const contentH = windowH - statusBarH - 56

    this.setData({
      statusBarHeight: statusBarH,
      contentHeight: contentH > 100 ? contentH : 400,
      pageHeight: windowH,
    })

    // 恢复已存状态
    const savedStatus = storage.get<WorkStatus>(storage.KEYS.CURRENT_STATUS)
    if (savedStatus) {
      this.applyStatus(savedStatus)
    } else {
      // 首次进首页：初始化状态
      storage.set(storage.KEYS.CURRENT_STATUS, 'working')
      storage.set(storage.KEYS.STATUS_START_TIME, Date.now())
      storage.set(storage.KEYS.LAST_RESET_DATE, formatDate(new Date()))
    }

    this.buildTimeline()
    this.startTimer()
  },

  onShow() {
    this.checkDailyReset()

    const timer = (this as any)._timer as Timer | null
    if (timer && !timer.isRunning()) {
      timer.start()
    }
    // 立即刷新，避免从后台回来时等待 1 秒
    this.refreshData()
  },

  onHide() {
    // 不停止定时器；STATUS_START_TIME 持久化，回来后可正确计算后台时长
  },

  onUnload() {
    const timer = (this as any)._timer as Timer | null
    if (timer) timer.stop()
    const handler = (this as any)._secondHandler as ((...args: unknown[]) => void) | null
    if (handler) eventBus.off('timer:second', handler)
  },

  // ─── 每日 0 点重置 ────────────────────────────────────────────

  checkDailyReset() {
    const todayStr = formatDate(new Date())
    const lastReset = storage.get<string>(storage.KEYS.LAST_RESET_DATE)

    if (!lastReset) {
      storage.set(storage.KEYS.LAST_RESET_DATE, todayStr)
      return
    }

    if (lastReset !== todayStr) {
      this.performDailyReset(lastReset, todayStr)
    }
  },

  performDailyReset(lastDate: string, todayStr: string) {
    const S = storage.KEYS
    const hourlyWage = storage.get<number>(S.HOURLY_WAGE) || 0

    // 将当前进行中的 session 计入昨日累计
    const startTime = storage.get<number>(S.STATUS_START_TIME) || Date.now()
    const elapsed = Math.max(0, (Date.now() - startTime) / 1000)
    const status = storage.get<string>(S.CURRENT_STATUS) as WorkStatus || 'working'

    let fishSecs = storage.get<number>(S.TODAY_FISH_SECONDS) || 0
    let workSecs = storage.get<number>(S.TODAY_WORK_SECONDS) || 0
    let otSecs = storage.get<number>(S.TODAY_OVERTIME_SECONDS) || 0

    if (status === 'fishing') fishSecs += elapsed
    else if (status === 'working') workSecs += elapsed
    else if (status === 'overtime') otSecs += elapsed

    // 写入历史记录
    const record: DailyRecord = {
      date: lastDate,
      workSeconds: workSecs,
      fishSeconds: fishSecs,
      overtimeSeconds: otSecs,
      workEarnings: hourlyWage * workSecs / 3600,
      fishEarnings: hourlyWage * fishSecs / 3600,
    }

    const history = storage.get<DailyRecord[]>(S.HISTORY_RECORDS) || []
    history.push(record)
    if (history.length > 90) history.shift()
    storage.set(S.HISTORY_RECORDS, history)

    // 重置今日数据
    storage.set(S.TODAY_WORK_SECONDS, 0)
    storage.set(S.TODAY_FISH_SECONDS, 0)
    storage.set(S.TODAY_OVERTIME_SECONDS, 0)
    storage.set(S.CURRENT_STATUS, 'working')
    storage.set(S.STATUS_START_TIME, Date.now())
    storage.set(S.LAST_RESET_DATE, todayStr)

    this.applyStatus('working')
  },

  // ─── 定时器 ───────────────────────────────────────────────────

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

    const timer = new Timer(() => { /* 100ms tick unused at page level */ })
    ;(this as any)._timer = timer
    timer.start()
  },

  // ─── 每秒数据刷新（不写 Storage） ────────────────────────────

  refreshData() {
    const now = new Date()
    const S = storage.KEYS
    const status = this.data.status

    // 已完成段的累计秒数（从 Storage 读）
    const storedFishSecs = storage.get<number>(S.TODAY_FISH_SECONDS) || 0
    const storedWorkSecs = storage.get<number>(S.TODAY_WORK_SECONDS) || 0

    // 当前进行中 session 的实时秒数（内存计算，不写 Storage）
    const startTime = storage.get<number>(S.STATUS_START_TIME) || Date.now()
    const currentElapsed = Math.max(0, (Date.now() - startTime) / 1000)

    // 今日实时总计（展示用）
    const fishSecs = storedFishSecs + (status === 'fishing' ? currentElapsed : 0)
    const workSecs = storedWorkSecs + (status === 'working' ? currentElapsed : 0)
    // overtime 不计入收益，通过 calcTodayHours 中合并在岗时长展示

    const hourlyWage = storage.get<number>(S.HOURLY_WAGE) || 0
    const fishEarnings = hourlyWage * fishSecs / 3600
    const workEarnings = hourlyWage * workSecs / 3600

    const cdResult = this.calcCountdown(now)

    this.setData({
      countdownLabel: cdResult.label,
      countdownEndInfo: cdResult.endInfo,
      countdown: cdResult.value,
      pulse: !this.data.pulse,
      todayHours: this.calcTodayHours(now),
      isWorkTime: this.calcIsWorkTime(now),
      daysToSalary: this.calcDaysToSalary(now),
      daysToRest: this.calcDaysToRest(now),
      fishEarnings: fishEarnings.toFixed(2),
      workEarnings: workEarnings.toFixed(2),
    })
  },

  // ─── 计算：倒计时 ─────────────────────────────────────────────

  calcCountdown(now: Date): CountdownResult {
    const startH = storage.get<number>(storage.KEYS.WORK_START_HOUR) || 9
    const startM = storage.get<number>(storage.KEYS.WORK_START_MIN) || 0
    const endH = storage.get<number>(storage.KEYS.WORK_END_HOUR) || 18
    const endM = storage.get<number>(storage.KEYS.WORK_END_MIN) || 30

    const curMin = now.getHours() * 60 + now.getMinutes()
    const startMin = startH * 60 + startM
    const endMin = endH * 60 + endM
    const msNow = now.getTime()

    // 场景 A：未到上班时间
    if (curMin < startMin) {
      const target = new Date(now)
      target.setHours(startH, startM, 0, 0)
      return {
        label: '距离上班还有',
        value: msToDuration(target.getTime() - msNow),
        endInfo: pad(startH) + ':' + pad(startM) + ' 开始上班',
      }
    }

    // 场景 B：工作时段内（working / fishing）
    if (curMin <= endMin) {
      const target = new Date(now)
      target.setHours(endH, endM, 0, 0)
      return {
        label: '逃离办公室倒计时',
        value: msToDuration(target.getTime() - msNow),
        endInfo: pad(endH) + ':' + pad(endM) + ' 准时下班',
      }
    }

    // 场景 C：下班后 + 加班中
    if (this.data.status === 'overtime') {
      const base = new Date(now)
      base.setHours(endH, endM, 0, 0)
      return {
        label: '今日无偿加班时长',
        value: msToDuration(msNow - base.getTime()),
        endInfo: '下班了还在卖命，血亏！',
      }
    }

    // 场景 D：已下班，未加班
    return {
      label: '',
      value: '已解放！',
      endInfo: '今天辛苦了',
    }
  },

  // ─── 计算：今日有效在岗时长 ────────────────────────────────────

  calcIsWorkTime(now: Date): boolean {
    const startH = storage.get<number>(storage.KEYS.WORK_START_HOUR) || 9
    const startM = storage.get<number>(storage.KEYS.WORK_START_MIN) || 0
    const endH = storage.get<number>(storage.KEYS.WORK_END_HOUR) || 18
    const endM = storage.get<number>(storage.KEYS.WORK_END_MIN) || 30
    const cur = now.getHours() * 60 + now.getMinutes()
    return cur >= (startH * 60 + startM) && cur <= (endH * 60 + endM)
  },

  calcTodayHours(now: Date): string {
    const startH = storage.get<number>(storage.KEYS.WORK_START_HOUR) || 9
    const startM = storage.get<number>(storage.KEYS.WORK_START_MIN) || 0
    const endH = storage.get<number>(storage.KEYS.WORK_END_HOUR) || 18
    const endM = storage.get<number>(storage.KEYS.WORK_END_MIN) || 30

    const curMin = now.getHours() * 60 + now.getMinutes()
    const startMin = startH * 60 + startM
    const endMin = endH * 60 + endM

    if (curMin < startMin) return '0.0'

    // overtime 不设上限；其余情况以下班时间为上限
    const upperMin = this.data.status === 'overtime' ? curMin : Math.min(curMin, endMin)
    let effectiveMin = upperMin - startMin

    // 扣除已过的午休时长
    const lunchEnabled = storage.get<boolean>(storage.KEYS.LUNCH_BREAK_ENABLED) || false
    if (lunchEnabled) {
      const lunchStartH = storage.get<number>(storage.KEYS.LUNCH_START_HOUR) || 12
      const lunchStartM = storage.get<number>(storage.KEYS.LUNCH_START_MIN) || 0
      const lunchEndH = storage.get<number>(storage.KEYS.LUNCH_END_HOUR) || 13
      const lunchEndM = storage.get<number>(storage.KEYS.LUNCH_END_MIN) || 0

      const lunchStartMin = lunchStartH * 60 + lunchStartM
      const lunchEndMin = lunchEndH * 60 + lunchEndM
      const lunchDuration = lunchEndMin - lunchStartMin

      if (curMin > lunchStartMin && lunchDuration > 0) {
        const passedLunch = Math.min(curMin - lunchStartMin, lunchDuration)
        effectiveMin -= passedLunch
      }
    }

    return (Math.max(effectiveMin, 0) / 60).toFixed(1)
  },

  // ─── 计算：距发薪日 ───────────────────────────────────────────

  calcDaysToSalary(now: Date): number {
    const salaryDay = storage.get<number>(storage.KEYS.SALARY_DAY) || 15
    const y = now.getFullYear()
    const mo = now.getMonth()
    const today = now.getDate()

    // 处理月末天数不足的情况（如 2 月 31 日）
    const daysInThisMonth = new Date(y, mo + 1, 0).getDate()
    const actualDay = Math.min(salaryDay, daysInThisMonth)

    if (today === actualDay) return 0

    const base = new Date(y, mo, today)
    base.setHours(0, 0, 0, 0)

    let target: Date
    if (today < actualDay) {
      target = new Date(y, mo, actualDay)
    } else {
      const nextMo = (mo + 1) % 12
      const nextY = mo === 11 ? y + 1 : y
      const daysInNextMonth = new Date(nextY, nextMo + 1, 0).getDate()
      target = new Date(nextY, nextMo, Math.min(salaryDay, daysInNextMonth))
    }

    target.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - base.getTime()) / 86400000)
  },

  // ─── 计算：距休息日 ───────────────────────────────────────────

  calcDaysToRest(now: Date): number {
    const day = now.getDay()  // 0=Sun, 6=Sat
    const workMode = storage.get<string>(storage.KEYS.WORK_MODE) as WorkMode || 'double_rest'

    if (workMode === 'double_rest') {
      if (day === 0 || day === 6) return 0
      return 6 - day
    }

    if (workMode === 'sat_only') {
      if (day === 6) return 0
      if (day === 0) return 6   // 周日工作：距下个周六 6 天
      return 6 - day
    }

    if (workMode === 'sun_only') {
      if (day === 0) return 0
      return 7 - day
    }

    if (workMode === 'alternate') {
      return this.calcDaysToRestAlternate(now, day)
    }

    // fallback: double rest
    if (day === 0 || day === 6) return 0
    return 6 - day
  },

  calcDaysToRestAlternate(now: Date, day: number): number {
    const refDateStr = storage.get<string>(storage.KEYS.ALTERNATE_WEEK_REF_DATE)
    const refIsBig = storage.get<boolean>(storage.KEYS.ALTERNATE_WEEK_IS_BIG)
    const restDay = storage.get<string>(storage.KEYS.ALTERNATE_WEEK_REST_DAY) || 'sat'

    if (!refDateStr) {
      // 未配置参考周时退化为双休
      if (day === 0 || day === 6) return 0
      return 6 - day
    }

    // 取本周周一
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const daysFromMon = (today.getDay() + 6) % 7
    const thisMon = new Date(today)
    thisMon.setDate(today.getDate() - daysFromMon)

    // 取参考周周一
    const refDate = new Date(refDateStr)
    refDate.setHours(0, 0, 0, 0)

    const msPerWeek = 7 * 24 * 3600 * 1000
    const weekDiff = Math.round((thisMon.getTime() - refDate.getTime()) / msPerWeek)
    const refIsBigWeek = refIsBig !== false   // 默认大周
    const thisWeekIsBig = (Math.abs(weekDiff) % 2 === 0) ? refIsBigWeek : !refIsBigWeek

    if (thisWeekIsBig) {
      // 大周：双休逻辑
      if (day === 0 || day === 6) return 0
      return 6 - day
    }

    // 小周：单休逻辑
    if (restDay === 'sat') {
      if (day === 6) return 0
      if (day === 0) return 6
      return 6 - day
    }
    // restDay === 'sun'
    if (day === 0) return 0
    return 7 - day
  },

  // ─── 状态辅助 ─────────────────────────────────────────────────

  applyStatus(s: WorkStatus) {
    const textMap: Record<WorkStatus, string> = {
      working: '系统运行中',
      fishing: '正在体面摸鱼',
      overtime: '正在加班中',
    }
    const badgeMap: Record<WorkStatus, string> = {
      working: '正常搬砖中',
      fishing: '正在偷偷休息',
      overtime: '无偿被迫输出',
    }
    this.setData({
      status: s,
      statusText: textMap[s],
      statusBadgeText: badgeMap[s],
      fishBtnClass: s === 'fishing' ? 'status-btn--fish-active' : 'status-btn--inactive',
      otBtnClass: s === 'overtime' ? 'status-btn--ot-active' : 'status-btn--inactive',
    })
  },

  // 将当前 session 的时长冲写入 Storage 累计值（状态切换时调用）
  flushCurrentSession() {
    const S = storage.KEYS
    const status = this.data.status
    const startTime = storage.get<number>(S.STATUS_START_TIME) || Date.now()
    const elapsed = Math.max(0, (Date.now() - startTime) / 1000)

    if (status === 'fishing') {
      const prev = storage.get<number>(S.TODAY_FISH_SECONDS) || 0
      storage.set(S.TODAY_FISH_SECONDS, prev + elapsed)
    } else if (status === 'working') {
      const prev = storage.get<number>(S.TODAY_WORK_SECONDS) || 0
      storage.set(S.TODAY_WORK_SECONDS, prev + elapsed)
    } else if (status === 'overtime') {
      const prev = storage.get<number>(S.TODAY_OVERTIME_SECONDS) || 0
      storage.set(S.TODAY_OVERTIME_SECONDS, prev + elapsed)
    }
  },

  // ─── 事件处理 ─────────────────────────────────────────────────

  toggleFishing() {
    if (!this.data.isWorkTime) return
    const next: WorkStatus = this.data.status === 'fishing' ? 'working' : 'fishing'
    this.flushCurrentSession()
    storage.set(storage.KEYS.STATUS_START_TIME, Date.now())
    storage.set(storage.KEYS.CURRENT_STATUS, next)
    this.applyStatus(next)
  },

  toggleOvertime() {
    if (this.data.isWorkTime) return
    const next: WorkStatus = this.data.status === 'overtime' ? 'working' : 'overtime'
    this.flushCurrentSession()
    storage.set(storage.KEYS.STATUS_START_TIME, Date.now())
    storage.set(storage.KEYS.CURRENT_STATUS, next)
    this.applyStatus(next)
  },
})
