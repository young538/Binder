import type {
  EveningShutdownApplyInput,
  EveningShutdownApplyResult,
  EveningShutdownSnapshot,
} from '../eveningShutdown';
import { notifyMutation } from './events';
import { http } from './http';

export const getEveningShutdown = (date: string): Promise<EveningShutdownSnapshot> =>
  http.get<EveningShutdownSnapshot>(`/api/evening-shutdown?date=${encodeURIComponent(date)}`);

export const applyEveningShutdown = async (
  input: EveningShutdownApplyInput,
): Promise<EveningShutdownApplyResult> => {
  const result = await http.post<EveningShutdownApplyResult>('/api/evening-shutdown', input);
  if (result.confirmedBlocks > 0) notifyMutation('timeBlocks');
  if (result.rolledOverTodos > 0 || result.movedToInbox > 0) notifyMutation('todos');
  return result;
};
