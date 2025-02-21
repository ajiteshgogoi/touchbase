import { EventEmitter } from 'events';

export const paymentEvents = new EventEmitter();

export const PAYMENT_EVENTS = {
  PAYMENT_FLOW_START: 'PAYMENT_FLOW_START',
  GOOGLE_PLAY_UI_READY: 'GOOGLE_PLAY_UI_READY'
} as const;