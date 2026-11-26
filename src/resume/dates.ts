const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `YYYY-MM` or `YYYY`; anything else is returned unchanged. */
export function formatDate(value: string, lang: "en" | "zh"): string {
  const ym = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (ym) {
    const year = ym[1] ?? "";
    const month = ym[2] ?? "";
    return lang === "zh" ? `${year}.${month}` : `${MONTHS[Number(month) - 1] ?? month} ${year}`;
  }
  return value;
}

/** An empty `end` means present. */
export function formatRange(start: string, end: string, lang: "en" | "zh"): string {
  const present = lang === "zh" ? "至今" : "Present";
  const from = formatDate(start, lang);
  const to = end === "" ? present : formatDate(end, lang);
  if (from === "") return end === "" ? "" : to;
  return `${from} – ${to}`;
}
