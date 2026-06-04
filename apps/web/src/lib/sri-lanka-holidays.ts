export type SriLankaHoliday = {
  date: string;
  name: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);
const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const POYA_NAMES_BY_MONTH = [
  "Duruthu Full Moon Poya Day",
  "Navam Full Moon Poya Day",
  "Madin Full Moon Poya Day",
  "Bak Full Moon Poya Day",
  "Vesak Full Moon Poya Day",
  "Poson Full Moon Poya Day",
  "Esala Full Moon Poya Day",
  "Nikini Full Moon Poya Day",
  "Binara Full Moon Poya Day",
  "Vap Full Moon Poya Day",
  "Ill Full Moon Poya Day",
  "Unduvap Full Moon Poya Day"
];

const islamicDateFormatter = new Intl.DateTimeFormat("en-u-ca-islamic", {
  timeZone: "Asia/Colombo",
  month: "numeric",
  day: "numeric"
});

function dateKeyFromUtcTime(time: number): string {
  const sriLankaTime = new Date(time + SRI_LANKA_OFFSET_MS);
  const year = sriLankaTime.getUTCFullYear();
  const month = String(sriLankaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(sriLankaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return dateKeyFromUtcTime(Date.UTC(year, month - 1, day + days));
}

function addHoliday(holidays: Map<string, string>, date: string, name: string) {
  const existing = holidays.get(date);
  holidays.set(date, existing ? `${existing} / ${name}` : name);
}

function getEasterSundayDateKey(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateKey(year, month, day);
}

function getPoyaHolidays(year: number): SriLankaHoliday[] {
  const startTime = Date.UTC(year, 0, 1) - 40 * DAY_MS;
  const endTime = Date.UTC(year + 1, 0, 1) + 40 * DAY_MS;
  const cycleStart = Math.floor((startTime - KNOWN_NEW_MOON_UTC) / (SYNODIC_MONTH_DAYS * DAY_MS)) - 1;
  const poyaByMonth = new Map<number, { date: string; distance: number }>();

  for (let cycle = cycleStart; ; cycle += 1) {
    const fullMoonTime = KNOWN_NEW_MOON_UTC + (cycle + 0.5) * SYNODIC_MONTH_DAYS * DAY_MS;
    if (fullMoonTime > endTime) break;
    if (fullMoonTime < startTime) continue;

    const key = dateKeyFromUtcTime(fullMoonTime);
    const [dateYear, dateMonth, dateDay] = key.split("-").map(Number);
    if (dateYear !== year) continue;

    const middleOfMonth = 15;
    const distance = Math.abs(dateDay - middleOfMonth);
    const existing = poyaByMonth.get(dateMonth);
    if (!existing || distance < existing.distance) {
      poyaByMonth.set(dateMonth, { date: key, distance });
    }
  }

  return Array.from(poyaByMonth.entries()).map(([month, item]) => ({
    date: item.date,
    name: POYA_NAMES_BY_MONTH[month - 1]
  }));
}

function getIslamicDateParts(date: Date): { month: number; day: number } | null {
  const parts = islamicDateFormatter.formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

function findIslamicHoliday(year: number, month: number, day: number, name: string): SriLankaHoliday[] {
  const holidays: SriLankaHoliday[] = [];
  for (let offset = -15; offset <= 380; offset += 1) {
    const time = Date.UTC(year, 0, 1 + offset);
    const date = new Date(time);
    const gregorianYear = date.getUTCFullYear();
    const parts = getIslamicDateParts(date);
    if (gregorianYear === year && parts?.month === month && parts.day === day) {
      holidays.push({ date: dateKeyFromUtcTime(time), name });
    }
  }
  return holidays;
}

export function getSriLankaHolidays(year: number): SriLankaHoliday[] {
  const holidays = new Map<string, string>();

  [
    { date: dateKey(year, 1, 14), name: "Tamil Thai Pongal Day" },
    { date: dateKey(year, 2, 4), name: "National Day" },
    { date: dateKey(year, 4, 13), name: "Day Prior to Sinhala and Tamil New Year Day" },
    { date: dateKey(year, 4, 14), name: "Sinhala and Tamil New Year Day" },
    { date: dateKey(year, 5, 1), name: "May Day" },
    { date: dateKey(year, 12, 25), name: "Christmas Day" },
    { date: addDays(getEasterSundayDateKey(year), -2), name: "Good Friday" },
    ...getPoyaHolidays(year),
    ...findIslamicHoliday(year, 10, 1, "Eid al-Fitr"),
    ...findIslamicHoliday(year, 12, 10, "Eid al-Adha"),
    ...findIslamicHoliday(year, 3, 12, "Milad-Un-Nabi")
  ].forEach((holiday) => addHoliday(holidays, holiday.date, holiday.name));

  const vesak = Array.from(holidays.entries()).find(([, name]) => name.includes("Vesak Full Moon Poya Day"));
  if (vesak) {
    addHoliday(holidays, addDays(vesak[0], 1), "Day following Vesak Full Moon Poya Day");
  }

  return Array.from(holidays.entries())
    .map(([date, name]) => ({ date, name }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
