export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function getDefaultProfessionalPhone(phone?: string | null) {
  return phone ? normalizePhone(phone) : '';
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getWeekDates(date: string) {
  const base = new Date(`${date}T12:00:00`);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, diffToMonday);

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function getMonthDates(date: string) {
  const base = new Date(`${date}T12:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const value = new Date(year, month, index + 1, 12, 0, 0);
    return value.toISOString().slice(0, 10);
  });
}

export function getDatesBetween(start: string, end: string) {
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function sortSlots<T extends { startsAt?: string; startTime?: string }>(slots: T[]): T[] {
  return [...slots].sort((left, right) =>
    (left.startsAt ?? left.startTime ?? '').localeCompare(
      right.startsAt ?? right.startTime ?? '',
    ),
  );
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function pickDefaultProfessionalCategoryId(
  categories: Array<{
    id: string;
    basePrice?: number | null;
  }>,
) {
  if (!categories.length) {
    return 'none';
  }

  return categories.find((category) => category.basePrice != null)?.id ?? categories[0].id;
}

export function getOperatingDayKey(date: string) {
  const weekDay = new Date(`${date}T12:00:00`).getDay();

  return (
    {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    } as const
  )[weekDay];
}
