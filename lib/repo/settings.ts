import { db, markDirty } from '../db';
import { Settings } from '../types';

const DEFAULT: Settings = {
  firstDayOfWeek: 'mon',
  gridMinutes: 30,
  dayStartHour: 6,
  dayEndHour: 24,
  theme: 'light',
};

export const getSettings = async (): Promise<Settings> => {
  const row = await db.settings.get('main');
  if (row) {
    const { key, ...s } = row;
    return s;
  }
  await db.settings.put({ key: 'main', ...DEFAULT });
  return DEFAULT;
};

export const updateSettings = async (patch: Partial<Settings>) => {
  const current = await getSettings();
  await db.settings.put({ key: 'main', ...current, ...patch });
  await markDirty();
};
