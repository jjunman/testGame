export const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
export const SCHEDULE_START_HOUR = 7;
export const SCHEDULE_END_HOUR = 22;
export const SCHEDULE_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR },
  (_, index) => index + SCHEDULE_START_HOUR,
);

export function isScheduleHour(hour: number) {
  return hour >= SCHEDULE_START_HOUR && hour < SCHEDULE_END_HOUR;
}

export function getCurrentWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return toDateValue(date);
  });
}

export function slotKey(date: string, hour: number) {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

export function parseSlotKey(key: string) {
  const [date, hourValue] = key.split('T');
  return { date, hour: Number(hourValue) };
}

export function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatSlotRange(startTime: string, endTime: string) {
  return `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`;
}

export function formatDateTimeLabel(date: string, startTime: string, endTime: string) {
  const weekdayIndex = dateToWeekdayIndex(date);
  return `${WEEK_LABELS[weekdayIndex]}요일 ${formatShortDate(date)} ${formatSlotRange(startTime, endTime)}`;
}

export function formatShortDate(date: string) {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function dateToWeekdayIndex(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

export function toMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
