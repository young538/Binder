import type { Settings } from './types';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  firstDayOfWeek: 'mon', gridMinutes: 30, dayStartHour: 6, dayEndHour: 23, theme: 'light',
});
