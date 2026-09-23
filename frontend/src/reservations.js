// Things the Reserve pages remember on this device, so a returning customer can reserve in a few taps
// and find their reservations again. Browsers can block storage (private windows, for example),
// so every read and write is allowed to fail quietly.

const DETAILS_KEY = 'sr-reserve-details'
const MINE_KEY = 'sr-my-reservations'

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do: the page works without it.
  }
}

// Name, contact, location and choices from last time (only if the customer asked us to remember them).
export const savedDetails = () => read(DETAILS_KEY, null)
export const saveDetails = (details) => write(DETAILS_KEY, details)
export const forgetDetails = () => write(DETAILS_KEY, null)

// The private links of reservations made on this device, newest first.
export const myReservationTokens = () => read(MINE_KEY, [])
export function rememberReservation(token) {
  write(MINE_KEY, [token, ...myReservationTokens().filter((t) => t !== token)].slice(0, 5))
}
export function forgetReservation(token) {
  write(MINE_KEY, myReservationTokens().filter((t) => t !== token))
}

// The sliding scale, as customers see it. All three look the same on purpose: choosing
// the free or at-cost price should feel as ordinary as choosing the standard one.
// The words are in i18n.jsx (priceStandardTitle and so on).
export const PRICE_CHOICES = [
  { value: 'standard', priceKey: 'standard', words: 'priceStandard' },
  { value: 'at_cost', priceKey: 'at_cost', words: 'priceAtCost' },
  { value: 'free', priceKey: null, words: 'priceFree' },
]

// A calendar file for the drop, so it can be added to a phone's calendar. Times are Halifax time.
export function calendarFile({ drop, site, bundles, pickup_code: code }, t) {
  const day = drop.drop_date.replaceAll('-', '')
  const clock = (time) => time.replaceAll(':', '').slice(0, 6)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Square Roots//Reservations//EN',
    'BEGIN:VEVENT',
    `UID:${day}-${site.id}-${code ?? 'waitlist'}@squareroots`,
    `DTSTART;TZID=America/Halifax:${day}T${clock(drop.starts_at)}`,
    `DTEND;TZID=America/Halifax:${day}T${clock(drop.ends_at)}`,
    `SUMMARY:${t.calendarTitle(t.bundles(bundles))}`,
    `LOCATION:${site.address}\\, ${site.name}\\, Nova Scotia`,
    `DESCRIPTION:${code ? t.calendarCode(code) : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'))
}
