const TZ = "Europe/Istanbul";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayKey(d = new Date()) {
  const parts = partsFormatter.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateKeyDaysAgo(days, base = new Date()) {
  const d = new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
  return todayKey(d);
}

export function formatTurkishDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const months = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
