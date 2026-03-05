/**
 * Storage 封装 - 数据持久化
 * 所有持久化字段在此集中预定义，计算逻辑由各业务模块实现。
 * 详细字段说明见 docs/研发文档.md
 */

const KEYS = {
  // ─── 用户配置 ────────────────────────────────────────────
  /** 月薪（税前，元），由用户在引导页输入 */
  MONTHLY_SALARY: 'monthly_salary',
  /** 时薪（元/小时），由月薪自动计算存储，不直接输入 */
  HOURLY_WAGE: 'hourly_wage',
  /** 上班时（默认 9） */
  WORK_START_HOUR: 'work_start_hour',
  /** 上班分（默认 0） */
  WORK_START_MIN: 'work_start_min',
  /** 下班时（默认 18） */
  WORK_END_HOUR: 'work_end_hour',
  /** 下班分（默认 30） */
  WORK_END_MIN: 'work_end_min',
  /** 发薪日（每月第几号，默认 15） */
  SALARY_DAY: 'salary_day',
  /** 工作日模式：'double_rest'=双休 | 'sat_only'=仅周六休 | 'sun_only'=仅周日休 | 'alternate'=大小周 */
  WORK_MODE: 'work_mode',
  /** 午休抵扣开关（boolean） */
  LUNCH_BREAK_ENABLED: 'lunch_break_enabled',
  /** 午休开始时（默认 12） */
  LUNCH_START_HOUR: 'lunch_start_hour',
  /** 午休开始分（默认 0） */
  LUNCH_START_MIN: 'lunch_start_min',
  /** 午休结束时（默认 13） */
  LUNCH_END_HOUR: 'lunch_end_hour',
  /** 午休结束分（默认 0） */
  LUNCH_END_MIN: 'lunch_end_min',
  /** 大小周参考周的周一日期（YYYY-MM-DD） */
  ALTERNATE_WEEK_REF_DATE: 'alternate_week_ref_date',
  /** 参考日期所在周是否为大周（boolean） */
  ALTERNATE_WEEK_IS_BIG: 'alternate_week_is_big',
  /** 大小周模式小周的休息日：'sat' | 'sun' */
  ALTERNATE_WEEK_REST_DAY: 'alternate_week_rest_day',
  /** 是否已完成引导配置（boolean） */
  ONBOARDING_DONE: 'onboarding_done',

  // ─── 当前状态 ─────────────────────────────────────────────
  /** 当前工作状态：'working' | 'fishing' | 'overtime' */
  CURRENT_STATUS: 'current_status',
  /** 当前状态段开始时间戳（毫秒），App 重启后仍有效 */
  STATUS_START_TIME: 'status_start_time',
  /** 上次每日重置日期字符串（YYYY-MM-DD） */
  LAST_RESET_DATE: 'last_reset_date',

  // ─── 今日已完成段累计数据（不含当前进行中的段，每日 0 点自动重置） ──
  /** 今日已完成搬砖段累计秒数 */
  TODAY_WORK_SECONDS: 'today_work_seconds',
  /** 今日已完成摸鱼段累计秒数 */
  TODAY_FISH_SECONDS: 'today_fish_seconds',
  /** 今日已完成加班段累计秒数 */
  TODAY_OVERTIME_SECONDS: 'today_overtime_seconds',

  // ─── 近 7 天分段记录（支持时间轴热力图 & 手动编辑） ──────────
  /**
   * SessionRecord[] 近 7 天所有状态分段记录
   * 每条：{ id, date, type, startTs, endTs, earnings }
   * endTs=0 表示当前段仍在进行中
   */
  WEEKLY_SESSION_RECORDS: 'weekly_session_records',

  // ─── 历史数据 ─────────────────────────────────────────────
  /** DailyRecord[]，每日汇总，最多保留 90 天 */
  HISTORY_RECORDS: 'history_records',
} as const

export type StorageKey = typeof KEYS[keyof typeof KEYS]

function get<T>(key: StorageKey): T | null {
  try {
    const value = wx.getStorageSync(key)
    return value === '' ? null : value as T
  } catch {
    return null
  }
}

function set<T>(key: StorageKey, data: T): void {
  try {
    wx.setStorageSync(key, data)
  } catch (err) {
    console.error(`Storage set error [${key}]:`, err)
  }
}

function remove(key: StorageKey): void {
  try {
    wx.removeStorageSync(key)
  } catch (err) {
    console.error(`Storage remove error [${key}]:`, err)
  }
}

function clearAll(): void {
  try {
    wx.clearStorageSync()
  } catch (err) {
    console.error('Storage clearAll error:', err)
  }
}

export const storage = {
  KEYS,
  get,
  set,
  remove,
  clearAll,
}
