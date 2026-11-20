import type { LifeEvent } from './types';

export interface GoogleCalendarEventResource {
  id: string;
  status?: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  updated?: string | null;
  start?: { date?: string; dateTime?: string; timeZone?: string } | null;
  end?: { date?: string; dateTime?: string; timeZone?: string } | null;
}

export interface MappedGoogleEvent {
  googleCalendarId: string;
  googleEventId: string;
  googleUpdatedAt: string | null;
  externalUid: string;
  title: string;
  date: string;
  endDate: string | null;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  color: string | null;
  note: string | null;
}

export interface GoogleCalendarWriteBody {
  summary: string;
  description?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
}

const SEOUL_TZ = 'Asia/Seoul';
const HEX_COLOR_RE = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const check = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(check.getTime()) && check.toISOString().slice(0, 10) === value;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function buildDefaultSyncWindow(today: string): {
  startDate: string;
  endDate: string;
  timeMin: string;
  timeMax: string;
} {
  const startDate = shiftIsoDate(today, -30);
  const endDate = shiftIsoDate(today, 180);
  const exclusiveEndDate = shiftIsoDate(endDate, 1);
  return {
    startDate,
    endDate,
    timeMin: `${startDate}T00:00:00+09:00`,
    timeMax: `${exclusiveEndDate}T00:00:00+09:00`,
  };
}

function toSeoulDateAndMinutes(utcDate: Date): { date: string; minutes: number } {
  const datePart = new Intl.DateTimeFormat('sv-SE', {
    timeZone: SEOUL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(utcDate);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEOUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return { date: datePart, minutes: (hour % 24) * 60 + minute };
}

function formatSeoulRfc3339(date: string, minutes: number): string {
  if (minutes >= 1440) {
    return `${shiftIsoDate(date, 1)}T00:00:00+09:00`;
  }
  const safeMin = Math.max(0, minutes);
  const h = String(Math.floor(safeMin / 60)).padStart(2, '0');
  const m = String(safeMin % 60).padStart(2, '0');
  return `${date}T${h}:${m}:00+09:00`;
}

function normalizeNote(location?: string | null, description?: string | null): string | null {
  const loc = location?.trim() ?? '';
  const desc = description?.trim() ?? '';
  if (loc && desc) return `장소: ${loc}\n\n${desc}`;
  if (loc) return `장소: ${loc}`;
  return desc || null;
}

export function googleEventToLifeEventInput(
  calendarId: string,
  calendarColor: string | null,
  item: GoogleCalendarEventResource,
): MappedGoogleEvent | null {
  if (!item.id || item.status === 'cancelled') return null;

  const title = item.summary?.trim() || '(제목 없음)';
  const safeColor = calendarColor && HEX_COLOR_RE.test(calendarColor) ? calendarColor : null;
  const note = normalizeNote(item.location, item.description);
  const googleUpdatedAt = item.updated && Number.isFinite(Date.parse(item.updated)) ? item.updated : null;
  const externalUid = `gcal:${calendarId}:${item.id}`;

  if (item.start?.date) {
    const startDate = item.start.date.trim();
    if (!isValidIsoDate(startDate)) return null;
    let endDate: string | null = null;
    const rawEnd = item.end?.date?.trim();
    if (rawEnd && isValidIsoDate(rawEnd)) {
      const adjusted = shiftIsoDate(rawEnd, -1);
      if (adjusted > startDate) endDate = adjusted;
    }
    return {
      googleCalendarId: calendarId,
      googleEventId: item.id,
      googleUpdatedAt,
      externalUid,
      title,
      date: startDate,
      endDate,
      allDay: true,
      startMin: null,
      endMin: null,
      color: safeColor,
      note,
    };
  }

  if (!item.start?.dateTime) return null;
  const startDt = new Date(item.start.dateTime);
  if (!Number.isFinite(startDt.getTime())) return null;
  const startSeoul = toSeoulDateAndMinutes(startDt);

  const endDt = item.end?.dateTime ? new Date(item.end.dateTime) : null;
  const endValid = endDt && Number.isFinite(endDt.getTime()) && endDt.getTime() > startDt.getTime();
  const endSeoul = endValid ? toSeoulDateAndMinutes(endDt) : null;

  let startMin = startSeoul.minutes;
  let endMin: number;
  let endDate: string | null = null;

  if (!endSeoul) {
    if (startMin >= 1439) {
      startMin = 1439;
      endMin = 1440;
    } else {
      endMin = Math.min(1440, startMin + 30);
    }
  } else if (endSeoul.date === startSeoul.date) {
    if (startMin >= 1439 && endSeoul.minutes <= startMin) {
      startMin = 1439;
      endMin = 1440;
    } else {
      endMin = endSeoul.minutes > startMin ? endSeoul.minutes : Math.min(1440, startMin + 30);
    }
  } else if (endSeoul.date === shiftIsoDate(startSeoul.date, 1) && endSeoul.minutes === 0) {
    // Ends exactly at midnight of next day -> treat as end of start day (1440).
    if (startMin >= 1440) startMin = 1439;
    endMin = 1440;
  } else {
    // Multi-day timed event: span to 24:00 on start date while recording endDate.
    if (startMin >= 1440) startMin = 1439;
    endMin = 1440;
    endDate = endSeoul.date;
  }

  return {
    googleCalendarId: calendarId,
    googleEventId: item.id,
    googleUpdatedAt,
    externalUid,
    title,
    date: startSeoul.date,
    endDate,
    allDay: false,
    startMin,
    endMin,
    color: safeColor,
    note,
  };
}

export function lifeEventToGoogleEventBody(
  event: Pick<LifeEvent, 'title' | 'date' | 'endDate' | 'allDay' | 'startMin' | 'endMin' | 'note'>,
): GoogleCalendarWriteBody {
  const description = event.note?.trim() ? event.note : undefined;

  if (event.allDay || event.startMin == null || event.endMin == null) {
    const endInclusive = event.endDate && event.endDate >= event.date ? event.endDate : event.date;
    return {
      summary: event.title,
      description,
      start: { date: event.date },
      end: { date: shiftIsoDate(endInclusive, 1) },
    };
  }

  const endDateBase = event.endDate && event.endDate > event.date ? event.endDate : event.date;
  return {
    summary: event.title,
    description,
    start: {
      dateTime: formatSeoulRfc3339(event.date, event.startMin),
      timeZone: SEOUL_TZ,
    },
    end: {
      dateTime: formatSeoulRfc3339(endDateBase, event.endMin),
      timeZone: SEOUL_TZ,
    },
  };
}
