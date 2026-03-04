/**
 * Storage 封装 - 数据持久化
 * 所有持久化字段在此集中预定义，计算逻辑由各业务模块实现。
 */

const KEYS = {
  // ─── 用户配置 ────────────────────────────────────────────
  /** 时薪（元/小时），例如 50 */
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
  /** 休息日类型：'standard'=标准双休 | 'single'=单休 | 'alternate'=大小周 */
  REST_DAY_TYPE: 'rest_day_type',

  // ─── 当前状态 ─────────────────────────────────────────────
  /** 当前工作状态：'working' | 'fishing' | 'overtime' */
  CURRENT_STATUS: 'current_status',
  /** 当前状态开始时间戳（毫秒） */
  STATUS_START_TIME: 'status_start_time',
  /** 上次每日重置日期字符串（YYYY-MM-DD） */
  LAST_RESET_DATE: 'last_reset_date',

  // ─── 今日累计数据（每日 0 点自动重置） ────────────────────
  /** 今日摸鱼累计秒数 */
  TODAY_FISH_SECONDS: 'today_fish_seconds',
  /** 今日正式工作累计秒数（不含摸鱼） */
  TODAY_WORK_SECONDS: 'today_work_seconds',
  /** 今日加班累计秒数 */
  TODAY_OVERTIME_SECONDS: 'today_overtime_seconds',
  /** 今日摸鱼收益（元）= 时薪 × (摸鱼秒数 / 3600) */
  TODAY_FISH_EARNINGS: 'today_fish_earnings',
  /** 今日总搬砖收益（元）= 时薪 × (在岗总秒数 / 3600) */
  TODAY_WORK_EARNINGS: 'today_work_earnings',

  // ─── 历史数据 ─────────────────────────────────────────────
  /** 历史工时记录数组（DailyRecord[]，最多保留 90 天） */
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
