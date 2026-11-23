'use client';
import { useEffect, useRef } from 'react';
import { syncGoogleCalendarIfDue } from '@/lib/repo/googleCalendar';
import { useBinder } from '@/store';

const CLIENT_MIN_CHECK_GAP_MS = 60_000;
const CLIENT_POLL_INTERVAL_MS = 10 * 60 * 1000;

/** Silently pulls due Google Calendar updates on app mount, tab focus, and 10-minute intervals. */
export function GoogleCalendarAutoSync() {
  const userId = useBinder(s => s.me?.userId);
  const lastCheckAtRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const triggerIfAllowed = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (inFlightRef.current || now - lastCheckAtRef.current < CLIENT_MIN_CHECK_GAP_MS) return;

      lastCheckAtRef.current = now;
      inFlightRef.current = true;
      void syncGoogleCalendarIfDue()
        .catch(() => {
          // Background auto-sync swallows transient failures; users can inspect details in Settings.
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    triggerIfAllowed();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerIfAllowed();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(triggerIfAllowed, CLIENT_POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [userId]);

  return null;
}
