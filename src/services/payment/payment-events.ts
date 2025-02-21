import { EventEmitter } from 'events';

export const paymentEvents = new EventEmitter();

export const PAYMENT_EVENTS = {
  GOOGLE_PLAY_UI_SHOWN: 'GOOGLE_PLAY_UI_SHOWN'
} as const;