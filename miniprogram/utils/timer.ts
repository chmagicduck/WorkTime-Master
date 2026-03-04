/**
 * 全局定时器
 * 每 100ms 更新一次收益数据，每秒更新一次状态检查
 */

import { eventBus } from './event-bus'

export class Timer {
  private intervalId: number | null
  private tickCount: number
  private onTick: () => void

  constructor(onTick: () => void) {
    this.intervalId = null
    this.tickCount = 0
    this.onTick = onTick
  }

  /** 启动定时器 (100ms 间隔) */
  start(): void {
    if (this.intervalId !== null) return
    this.tickCount = 0

    this.intervalId = setInterval(() => {
      this.tickCount++
      this.onTick()

      // 每秒触发一次状态检查 (10 * 100ms = 1s)
      if (this.tickCount % 10 === 0) {
        eventBus.emit('timer:second')
      }

      // 每分钟触发一次 (600 * 100ms = 60s)
      if (this.tickCount % 600 === 0) {
        eventBus.emit('timer:minute')
        this.tickCount = 0
      }
    }, 100) as unknown as number
  }

  /** 停止定时器 */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /** 是否运行中 */
  isRunning(): boolean {
    return this.intervalId !== null
  }
}
