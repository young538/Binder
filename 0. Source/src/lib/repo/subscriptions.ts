import type { Subscription } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type NewSubscription = Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export const listSubscriptions = (): Promise<Subscription[]> =>
  http.get<Subscription[]>('/api/subscriptions');

export const createSubscription = async (data: NewSubscription): Promise<Subscription> => {
  const row = await http.post<Subscription>('/api/subscriptions', data);
  notifyMutation('subscriptions');
  return row;
};

export const updateSubscription = async (
  id: string,
  patch: Partial<NewSubscription>,
): Promise<Subscription> => {
  const row = await http.patch<Subscription>(`/api/subscriptions/${encodeURIComponent(id)}`, patch);
  notifyMutation('subscriptions');
  return row;
};

export const deleteSubscription = async (id: string): Promise<void> => {
  await http.del(`/api/subscriptions/${encodeURIComponent(id)}`);
  notifyMutation('subscriptions');
};
