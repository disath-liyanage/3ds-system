export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "Asia/Colombo"
});

function formatDateParts(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  if (!day || !month || !year) return dateFormatter.format(date);

  return `${day}/${month}/${year}`;
}

export function formatDate(value: Date | string | number | null | undefined): string {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return formatDateParts(date);
}