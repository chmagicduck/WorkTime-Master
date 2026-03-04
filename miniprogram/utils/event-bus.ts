/**
 * 事件总线 - 跨页面通信
 */
type EventHandler = (...args: unknown[]) => void

class EventBus {
  private listeners: Map<string, Set<EventHandler>>

  constructor() {
    this.listeners = new Map()
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args)
        } catch (err) {
          console.error(`EventBus handler error [${event}]:`, err)
        }
      })
    }
  }

  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args) => {
      this.off(event, wrapper)
      handler(...args)
    }
    this.on(event, wrapper)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()
