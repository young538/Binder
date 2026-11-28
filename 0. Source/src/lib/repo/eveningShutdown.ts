import type {
  EveningShutdownApplyInput,
  EveningShutdownApplyResult,
  EveningShutdownSnapshot,
} from '../eveningShutdown';
import { notifyMutation, type MutationResource } from './events';
import { http } from './http';

export const getEveningShutdown = (date: string): Promise<EveningShutdownSnapshot> =>
  http.get<EveningShutdownSnapshot>(`/api/evening-shutdown?date=${encodeURIComponent(date)}`);

export const applyEveningShutdown = async (
  input: EveningShutdownApplyInput,
): Promise<EveningShutdownApplyResult> => {
  const result = await http.post<EveningShutdownApplyResult>('/api/evening-shutdown', input);
  const changed: MutationResource[] = [];
  if (result.confirmedBlocks > 0) changed.push('timeBlocks');
  if (result.rolledOverTodos > 0 || result.movedToInbox > 0) changed.push('todos');
  if (changed.length) notifyMutation(...changed);
  return result;
};
