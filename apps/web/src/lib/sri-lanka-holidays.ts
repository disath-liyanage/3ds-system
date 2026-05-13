export type SriLankaHoliday = {
  date: string;
  name: string;
};

// Core public/bank holidays in Sri Lanka by year.
// Add more years here when needed.
const holidayMap: Record<number, SriLankaHoliday[]> = {
  2025: [
    { date: "2025-01-13", name: "Duruthu Full Moon Poya Day" },
    { date: "2025-01-14", name: "Tamil Thai Pongal Day" },
    { date: "2025-02-04", name: "National Day" },
    { date: "2025-02-12", name: "Navam Full Moon Poya Day" },
    { date: "2025-03-13", name: "Madin Full Moon Poya Day" },
    { date: "2025-04-12", name: "Bak Full Moon Poya Day" },
    { date: "2025-04-13", name: "Day Prior to Sinhala and Tamil New Year Day" },
    { date: "2025-04-14", name: "Sinhala and Tamil New Year Day" },
    { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-05-01", name: "May Day" },
    { date: "2025-05-12", name: "Vesak Full Moon Poya Day" },
    { date: "2025-05-13", name: "Day following Vesak Full Moon Poya Day" },
    { date: "2025-06-10", name: "Poson Full Moon Poya Day" },
    { date: "2025-07-10", name: "Esala Full Moon Poya Day" },
    { date: "2025-08-08", name: "Nikini Full Moon Poya Day" },
    { date: "2025-09-07", name: "Binara Full Moon Poya Day" },
    { date: "2025-10-06", name: "Vap Full Moon Poya Day" },
    { date: "2025-10-20", name: "Deepavali" },
    { date: "2025-11-05", name: "Ill Full Moon Poya Day" },
    { date: "2025-12-04", name: "Unduvap Full Moon Poya Day" },
    { date: "2025-12-25", name: "Christmas Day" }
  ],
  2026: [
    { date: "2026-01-03", name: "Duruthu Full Moon Poya Day" },
    { date: "2026-01-14", name: "Tamil Thai Pongal Day" },
    { date: "2026-02-01", name: "Navam Full Moon Poya Day" },
    { date: "2026-02-04", name: "National Day" },
    { date: "2026-03-02", name: "Madin Full Moon Poya Day" },
    { date: "2026-03-20", name: "Eid al-Fitr" },
    { date: "2026-03-31", name: "Bak Full Moon Poya Day" },
    { date: "2026-04-13", name: "Day Prior to Sinhala and Tamil New Year Day" },
    { date: "2026-04-14", name: "Sinhala and Tamil New Year Day" },
    { date: "2026-04-15", name: "Special Bank Holiday" },
    { date: "2026-04-18", name: "Good Friday" },
    { date: "2026-04-30", name: "May Full Moon Poya Day" },
    { date: "2026-05-01", name: "May Day" },
    { date: "2026-05-30", name: "Vesak Full Moon Poya Day" },
    { date: "2026-05-31", name: "Day following Vesak Full Moon Poya Day" },
    { date: "2026-06-28", name: "Poson Full Moon Poya Day" },
    { date: "2026-07-27", name: "Esala Full Moon Poya Day" },
    { date: "2026-08-25", name: "Nikini Full Moon Poya Day" },
    { date: "2026-09-24", name: "Binara Full Moon Poya Day" },
    { date: "2026-10-23", name: "Vap Full Moon Poya Day" },
    { date: "2026-11-12", name: "Deepavali" },
    { date: "2026-11-22", name: "Ill Full Moon Poya Day" },
    { date: "2026-12-22", name: "Unduvap Full Moon Poya Day" },
    { date: "2026-12-25", name: "Christmas Day" }
  ],
  2027: [
    { date: "2027-01-21", name: "Duruthu Full Moon Poya Day" },
    { date: "2027-02-04", name: "National Day" },
    { date: "2027-04-13", name: "Day Prior to Sinhala and Tamil New Year Day" },
    { date: "2027-04-14", name: "Sinhala and Tamil New Year Day" },
    { date: "2027-05-01", name: "May Day" },
    { date: "2027-12-25", name: "Christmas Day" }
  ]
};

export function getSriLankaHolidays(year: number): SriLankaHoliday[] {
  return holidayMap[year] ?? [];
}
