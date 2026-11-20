import type {
  MorningBootApplyInput,
  MorningBootApplyResult,
  MorningBootSnapshot,
} from '../morningBoot';
import { http } from './http';
import { notifyMutation } from './events';

export const getMorningBoot = (date: string): Promise<MorningBootSnapshot> =>
  http.get<MorningBootSnapshot>(`/api/morning-boot?date=${encodeURIComponent(date)}`);

export const applyMorningBoot = async (
  input: MorningBootApplyInput,
): Promise<MorningBootApplyResult> => {
  const result = await http.post<MorningBootApplyResult>('/api/morning-boot', input);
  notifyMutation('todos');
  return result;
};
