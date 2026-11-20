import type { LifeMetricWithEntries } from '../metrics';
import type { LifeMetric, LifeMetricEntry } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type NewMetric = Omit<LifeMetric, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type EntryInput = Omit<LifeMetricEntry, 'id' | 'userId' | 'metricId' | 'createdAt' | 'updatedAt'>;

export const listMetricsWithEntries = (): Promise<LifeMetricWithEntries[]> =>
  http.get<LifeMetricWithEntries[]>('/api/metrics');

export const createMetric = async (data: NewMetric): Promise<LifeMetric> => {
  const row = await http.post<LifeMetric>('/api/metrics', data);
  notifyMutation('metrics');
  return row;
};

export const updateMetric = async (
  id: string,
  patch: Partial<NewMetric>,
): Promise<LifeMetric> => {
  const row = await http.patch<LifeMetric>(`/api/metrics/${encodeURIComponent(id)}`, patch);
  notifyMutation('metrics');
  return row;
};

export const deleteMetric = async (id: string): Promise<void> => {
  await http.del(`/api/metrics/${encodeURIComponent(id)}`);
  notifyMutation('metrics');
  notifyMutation('metricEntries');
};

export const upsertMetricEntry = async (
  metricId: string,
  data: EntryInput,
): Promise<LifeMetricEntry> => {
  const row = await http.post<LifeMetricEntry>(
    `/api/metrics/${encodeURIComponent(metricId)}/entries`,
    { metricId, ...data },
  );
  notifyMutation('metricEntries');
  return row;
};

export const deleteMetricEntry = async (metricId: string, entryId: string): Promise<void> => {
  await http.del(`/api/metrics/${encodeURIComponent(metricId)}/entries?entryId=${encodeURIComponent(entryId)}`);
  notifyMutation('metricEntries');
};
