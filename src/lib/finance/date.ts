// Pinned to Africa/Casablanca for stable SSR/hydration parity in the
// single-user build. Revisit when multi-tenancy lands.
const APP_TIME_ZONE = "Africa/Casablanca";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export function formatLocalYmd(iso: string) {
  return ymdFormatter.format(new Date(iso));
}

export { APP_TIME_ZONE };
