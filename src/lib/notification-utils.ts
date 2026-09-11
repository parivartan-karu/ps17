import type { Notification } from '@/lib/types';

export function isNotificationExpired(notification: Notification, nowMs = Date.now()) {
  if (!notification.expiresAt) return false;

  const expiresAtMs = Date.parse(notification.expiresAt);
  if (Number.isNaN(expiresAtMs)) return false;

  return expiresAtMs <= nowMs;
}

export function isNotificationActive(notification: Notification, nowMs = Date.now()) {
  if (notification.isArchived) return false;
  return !isNotificationExpired(notification, nowMs);
}

export function durationToMinutes(value: number, unit: 'minutes' | 'hours' | 'days') {
  if (unit === 'hours') return value * 60;
  if (unit === 'days') return value * 60 * 24;
  return value;
}
