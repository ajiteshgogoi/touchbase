type EventHandler = (...args: any[]) => void;

class BrowserEventEmitter {
  private events: { [key: string]: EventHandler[] } = {};

  on(event: string, handler: EventHandler): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
  }

  off(event: string, handler: EventHandler): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(h => h !== handler);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(handler => handler(...args));
  }
}

export const paymentEvents = new BrowserEventEmitter();

export const PAYMENT_EVENTS = {
  PAYMENT_FLOW_START: 'PAYMENT_FLOW_START',
  GOOGLE_PLAY_UI_READY: 'GOOGLE_PLAY_UI_READY'
} as const;