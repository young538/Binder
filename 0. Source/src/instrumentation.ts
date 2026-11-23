export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startGoogleCalendarAutoSyncScheduler } = await import(
      '@/lib/server/googleCalendar/autoSync'
    );
    startGoogleCalendarAutoSyncScheduler();
  }
}
