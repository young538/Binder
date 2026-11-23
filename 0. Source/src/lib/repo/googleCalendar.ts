import type {
  GoogleCalendarAutoSyncOutcome,
  GoogleCalendarConnectionSummary,
  GoogleCalendarStatus,
  GoogleCalendarSyncResult,
} from '../types';
import { notifyMutation } from './events';
import { http } from './http';

export const getGoogleCalendarStatus = (): Promise<GoogleCalendarStatus> =>
  http.get<GoogleCalendarStatus>('/api/integrations/google/status');

export const updateGoogleCalendarSettings = async (patch: {
  selectedCalendarIds?: string[];
  pushCalendarId?: string;
  syncEnabled?: boolean;
  autoPushEvents?: boolean;
}): Promise<GoogleCalendarConnectionSummary> => {
  const result = await http.patch<GoogleCalendarConnectionSummary>(
    '/api/integrations/google/settings',
    patch,
  );
  notifyMutation('googleCalendar');
  return result;
};

export const syncGoogleCalendar = async (): Promise<GoogleCalendarSyncResult> => {
  const result = await http.post<GoogleCalendarSyncResult>('/api/integrations/google/sync', {});
  notifyMutation('lifeEvents');
  notifyMutation('googleCalendar');
  return result;
};

export const syncGoogleCalendarIfDue = async (): Promise<GoogleCalendarAutoSyncOutcome> => {
  const result = await http.post<GoogleCalendarAutoSyncOutcome>('/api/integrations/google/sync', {
    mode: 'auto',
  });
  if (!result.skipped) {
    if (
      result.pulledCreated > 0 ||
      result.pulledUpdated > 0 ||
      result.pulledDeleted > 0 ||
      result.pushedCreated > 0
    ) {
      notifyMutation('lifeEvents');
    }
    notifyMutation('googleCalendar');
  }
  return result;
};

export const disconnectGoogleCalendar = async (
  purgeEvents = false,
): Promise<{ ok: boolean; deletedEvents: number }> => {
  const qs = purgeEvents ? '?purgeEvents=true' : '';
  const result = await http.del<{ ok: boolean; deletedEvents: number }>(
    `/api/integrations/google/disconnect${qs}`,
  );
  if (result.deletedEvents > 0) {
    notifyMutation('lifeEvents');
  }
  notifyMutation('googleCalendar');
  return result;
};
