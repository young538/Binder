export const SEOUL_TZ = 'Asia/Seoul';

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SEOUL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SEOUL_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function toSeoulDate(date: Date): string {
  return dateFormatter.format(date);
}

export function toSeoulDateAndMinutes(date: Date): { date: string; minutes: number } {
  const [hour, minute] = timeFormatter.format(date).split(':').map(Number);
  return { date: toSeoulDate(date), minutes: hour * 60 + minute };
}
