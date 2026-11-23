import type { DashboardSnapshot } from '../dashboard';
import { http } from './http';

export const getDashboardSnapshot = (date: string): Promise<DashboardSnapshot> =>
  http.get<DashboardSnapshot>(`/api/dashboard?date=${encodeURIComponent(date)}`);
