import { toSeoulDateAndMinutes } from './utils/seoulTime';
import { addDays, parseISO } from 'date-fns';
import { toIsoDate } from './utils/date';

export interface ParsedIcsEvent {
  externalUid: string;
  title: string;
  date: string;
  endDate: string | null;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  note: string | null;
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

interface ParsedDateTime {
  date: string;
  allDay: boolean;
  minutes: number | null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const check = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(check.getTime()) && check.toISOString().slice(0, 10) === value;
}

function parseIcsDateTime(raw: string, params: string): ParsedDateTime | null {
  const value = raw.trim();
  const dateOnlyMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch || /VALUE=DATE\b/i.test(params)) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!match) return null;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (!isValidIsoDate(date)) return null;
    return { date, allDay: true, minutes: null };
  }

  const dtMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i);
  if (!dtMatch) return null;
  const [, y, m, d, hh, mm, ss, z] = dtMatch;
  const dateStr = `${y}-${m}-${d}`;
  if (!isValidIsoDate(dateStr)) return null;
  if (z) {
    const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
    if (!Number.isFinite(utc.getTime())) return null;
    const seoul = toSeoulDateAndMinutes(utc);
    return { date: seoul.date, allDay: false, minutes: seoul.minutes };
  }
  const hour = Number(hh);
  const minute = Number(mm);
  if (hour > 23 || minute > 59) return null;
  return { date: dateStr, allDay: false, minutes: hour * 60 + minute };
}

export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const normalized = icsText
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '');

  const lines = normalized.split('\n');
  const events: ParsedIcsEvent[] = [];
  let inEvent = false;
  let props: Record<string, { params: string; value: string }> = {};

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      props = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent) {
        const parsed = buildEventFromProps(props);
        if (parsed) events.push(parsed);
      }
      inEvent = false;
      props = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) continue;
    const keyPart = line.slice(0, colonIndex);
    const valuePart = line.slice(colonIndex + 1);
    const semiIndex = keyPart.indexOf(';');
    const name = (semiIndex >= 0 ? keyPart.slice(0, semiIndex) : keyPart).toUpperCase();
    const params = semiIndex >= 0 ? keyPart.slice(semiIndex + 1) : '';
    props[name] = { params, value: valuePart };
  }

  return events;
}

function buildEventFromProps(props: Record<string, { params: string; value: string }>): ParsedIcsEvent | null {
  const title = props.SUMMARY ? unescapeIcsText(props.SUMMARY.value) : '';
  if (!title || !props.DTSTART) return null;

  const start = parseIcsDateTime(props.DTSTART.value, props.DTSTART.params);
  if (!start) return null;

  const end = props.DTEND ? parseIcsDateTime(props.DTEND.value, props.DTEND.params) : null;
  const note = props.DESCRIPTION ? unescapeIcsText(props.DESCRIPTION.value) || null : null;
  const rawUid = props.UID ? unescapeIcsText(props.UID.value) : '';
  const externalUid = rawUid || `${start.date}:${title}`;

  if (start.allDay) {
    let endDate: string | null = null;
    if (end) {
      // RFC 5545 DATE DTEND is exclusive.
      const inclusiveEnd = toIsoDate(addDays(parseISO(end.date), -1));
      if (inclusiveEnd > start.date) {
        endDate = inclusiveEnd;
      }
    }
    return {
      externalUid,
      title,
      date: start.date,
      endDate,
      allDay: true,
      startMin: null,
      endMin: null,
      note,
    };
  }

  const startMin = start.minutes ?? 0;
  let endMin = Math.min(1440, startMin + 60);
  let endDate: string | null = null;

  if (end) {
    if (end.date === start.date && end.minutes !== null && end.minutes > startMin) {
      endMin = end.minutes;
    } else if (end.date > start.date) {
      if (end.minutes === 0 && toIsoDate(addDays(parseISO(start.date), 1)) === end.date) {
        endMin = 1440;
      } else {
        endDate = end.date;
        endMin = 1440;
      }
    }
  }

  if (endMin <= startMin) {
    return {
      externalUid,
      title,
      date: start.date,
      endDate,
      allDay: true,
      startMin: null,
      endMin: null,
      note,
    };
  }

  return {
    externalUid,
    title,
    date: start.date,
    endDate,
    allDay: false,
    startMin,
    endMin,
    note,
  };
}
