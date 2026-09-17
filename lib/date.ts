export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const calendarDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${calendarDate}, ${time}`;
}
