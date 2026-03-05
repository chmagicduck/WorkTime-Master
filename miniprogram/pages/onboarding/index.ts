// pages/onboarding/index.ts
import { storage } from '../../utils/storage'

type WorkMode = 'double_rest' | 'sat_only' | 'sun_only' | 'alternate'

// 月均工作日（国家劳动局标准）
const WORK_DAYS_PER_MONTH: Record<WorkMode, number> = {
  double_rest: 21.75,
  sat_only: 26,
  sun_only: 26,
  alternate: 23.875,
}

function padTwo(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function todayMondayDateStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day + 6) % 7 // 距本周一的偏移（0=周一）
  d.setDate(d.getDate() - diff)
  return d.getFullYear() + '-' + padTwo(d.getMonth() + 1) + '-' + padTwo(d.getDate())
}

Page({
  data: {
    step: 'welcome' as 'welcome' | 'setup',
    isEditMode: false,  // true = 从个人页进入（编辑设置），false = 首次引导
    pageHeight: 667,
    statusBarHeight: 44,
    welcomeTopPadding: 124,  // statusBarHeight + 80
    setupHeaderPadding: 44,  // statusBarHeight
    formContentHeight: 500,

    // ── 表单值 ──────────────────────────────────────────────
    monthlySalary: '',
    payDayIndex: 14,        // 0-based；14 = 15号
    workModeIndex: 0,       // 0=双休 1=周六休 2=周日休 3=大小周
    startTime: '09:00',
    endTime: '18:30',
    lunchBreakEnabled: false,
    lunchStart: '12:00',
    lunchEnd: '13:00',
    bigWeekIndex: 0,        // 0=大周(双休) 1=小周(单休)
    smallWeekRestDayIndex: 0, // 0=周六 1=周日

    // ── picker 数据源 ────────────────────────────────────────
    payDayRange: [] as string[],
    workModeRange: ['双休', '周六休', '周日休', '大小周'],
    bigWeekRange: ['大周（双休）', '小周（单休）'],
    smallWeekRestDayRange: ['周六', '周日'],
  },

  onLoad(options: Record<string, string>) {
    const sysInfo = wx.getSystemInfoSync()
    const statusBarH = sysInfo.statusBarHeight || 44
    const windowH = sysInfo.windowHeight || 667

    // 设置页：header 高度 = statusBarH + 56（header内容区）
    const formH = windowH - statusBarH - 56

    const payDayRange: string[] = []
    for (let i = 1; i <= 31; i++) {
      payDayRange.push(i + '号')
    }

    const isEditMode = options.step === 'setup'

    this.setData({
      statusBarHeight: statusBarH,
      pageHeight: windowH,
      welcomeTopPadding: statusBarH + 80,
      setupHeaderPadding: statusBarH,
      formContentHeight: formH > 200 ? formH : 500,
      payDayRange,
      step: isEditMode ? 'setup' : 'welcome',
      isEditMode,
    })

    if (isEditMode) {
      this.loadExistingConfig()
    }
  },

  loadExistingConfig() {
    const S = storage.KEYS
    const monthlySalary = storage.get<number>(S.MONTHLY_SALARY)
    const salaryDay = storage.get<number>(S.SALARY_DAY) || 15
    const workMode = storage.get<string>(S.WORK_MODE) as WorkMode || 'double_rest'
    const startH = storage.get<number>(S.WORK_START_HOUR) || 9
    const startM = storage.get<number>(S.WORK_START_MIN) || 0
    const endH = storage.get<number>(S.WORK_END_HOUR) || 18
    const endM = storage.get<number>(S.WORK_END_MIN) || 30
    const lunchEnabled = storage.get<boolean>(S.LUNCH_BREAK_ENABLED) || false
    const lunchStartH = storage.get<number>(S.LUNCH_START_HOUR) || 12
    const lunchStartM = storage.get<number>(S.LUNCH_START_MIN) || 0
    const lunchEndH = storage.get<number>(S.LUNCH_END_HOUR) || 13
    const lunchEndM = storage.get<number>(S.LUNCH_END_MIN) || 0
    const altIsBig = storage.get<boolean>(S.ALTERNATE_WEEK_IS_BIG)
    const altRestDay = storage.get<string>(S.ALTERNATE_WEEK_REST_DAY) || 'sat'

    const workModeMap: Record<WorkMode, number> = {
      double_rest: 0,
      sat_only: 1,
      sun_only: 2,
      alternate: 3,
    }

    this.setData({
      monthlySalary: monthlySalary ? String(monthlySalary) : '',
      payDayIndex: salaryDay - 1,
      workModeIndex: workModeMap[workMode] || 0,
      startTime: padTwo(startH) + ':' + padTwo(startM),
      endTime: padTwo(endH) + ':' + padTwo(endM),
      lunchBreakEnabled: lunchEnabled,
      lunchStart: padTwo(lunchStartH) + ':' + padTwo(lunchStartM),
      lunchEnd: padTwo(lunchEndH) + ':' + padTwo(lunchEndM),
      bigWeekIndex: altIsBig === false ? 1 : 0,
      smallWeekRestDayIndex: altRestDay === 'sun' ? 1 : 0,
    })
  },

  // ── 欢迎页 ────────────────────────────────────────────────
  goToSetup() {
    this.setData({ step: 'setup' })
  },

  onBack() {
    if (this.data.isEditMode) {
      wx.navigateBack()
    } else {
      this.setData({ step: 'welcome' })
    }
  },

  // ── 表单事件 ──────────────────────────────────────────────
  onSalaryInput(e: any) {
    this.setData({ monthlySalary: e.detail.value })
  },

  onPayDayChange(e: any) {
    this.setData({ payDayIndex: Number(e.detail.value) })
  },

  onWorkModeChange(e: any) {
    this.setData({ workModeIndex: Number(e.detail.value) })
  },

  onStartTimeChange(e: any) {
    this.setData({ startTime: e.detail.value })
  },

  onEndTimeChange(e: any) {
    this.setData({ endTime: e.detail.value })
  },

  onLunchBreakToggle(e: any) {
    this.setData({ lunchBreakEnabled: e.detail.value as boolean })
  },

  onLunchStartChange(e: any) {
    this.setData({ lunchStart: e.detail.value })
  },

  onLunchEndChange(e: any) {
    this.setData({ lunchEnd: e.detail.value })
  },

  onBigWeekChange(e: any) {
    this.setData({ bigWeekIndex: Number(e.detail.value) })
  },

  onSmallWeekRestDayChange(e: any) {
    this.setData({ smallWeekRestDayIndex: Number(e.detail.value) })
  },

  // ── 保存配置 ──────────────────────────────────────────────
  saveConfig() {
    const {
      monthlySalary, payDayIndex, workModeIndex,
      startTime, endTime, lunchBreakEnabled,
      lunchStart, lunchEnd, bigWeekIndex, smallWeekRestDayIndex,
    } = this.data

    if (!monthlySalary || Number(monthlySalary) <= 0) {
      wx.showToast({ title: '请输入月薪', icon: 'none' })
      return
    }

    const workModes: WorkMode[] = ['double_rest', 'sat_only', 'sun_only', 'alternate']
    const workMode = workModes[workModeIndex]

    const parseTime = (t: string): { h: number; m: number } => {
      const parts = t.split(':')
      return { h: Number(parts[0]), m: Number(parts[1]) }
    }

    const start = parseTime(startTime)
    const end = parseTime(endTime)
    const lunchS = parseTime(lunchStart)
    const lunchE = parseTime(lunchEnd)

    // 计算时薪
    const wdpm = WORK_DAYS_PER_MONTH[workMode]
    let workMinPerDay = (end.h * 60 + end.m) - (start.h * 60 + start.m)
    if (lunchBreakEnabled) {
      workMinPerDay -= (lunchE.h * 60 + lunchE.m) - (lunchS.h * 60 + lunchS.m)
    }
    if (workMinPerDay <= 0) {
      wx.showToast({ title: '上下班时间设置有误', icon: 'none' })
      return
    }
    const workHoursPerDay = workMinPerDay / 60
    const hourlyWage = Number(monthlySalary) / (wdpm * workHoursPerDay)

    const S = storage.KEYS
    storage.set(S.MONTHLY_SALARY, Number(monthlySalary))
    storage.set(S.HOURLY_WAGE, hourlyWage)
    storage.set(S.SALARY_DAY, payDayIndex + 1)
    storage.set(S.WORK_MODE, workMode)
    storage.set(S.WORK_START_HOUR, start.h)
    storage.set(S.WORK_START_MIN, start.m)
    storage.set(S.WORK_END_HOUR, end.h)
    storage.set(S.WORK_END_MIN, end.m)
    storage.set(S.LUNCH_BREAK_ENABLED, lunchBreakEnabled)

    if (lunchBreakEnabled) {
      storage.set(S.LUNCH_START_HOUR, lunchS.h)
      storage.set(S.LUNCH_START_MIN, lunchS.m)
      storage.set(S.LUNCH_END_HOUR, lunchE.h)
      storage.set(S.LUNCH_END_MIN, lunchE.m)
    }

    if (workMode === 'alternate') {
      storage.set(S.ALTERNATE_WEEK_REF_DATE, todayMondayDateStr())
      storage.set(S.ALTERNATE_WEEK_IS_BIG, bigWeekIndex === 0)
      storage.set(S.ALTERNATE_WEEK_REST_DAY, smallWeekRestDayIndex === 0 ? 'sat' : 'sun')
    }

    if (!this.data.isEditMode) {
      storage.set(S.ONBOARDING_DONE, true)
    }

    if (this.data.isEditMode) {
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => { wx.navigateBack() }, 800)
    } else {
      wx.switchTab({ url: '/pages/home/index' })
    }
  },
})
