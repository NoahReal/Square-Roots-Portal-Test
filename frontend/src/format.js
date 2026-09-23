// Formatting helpers so money, weights and dates look the same on every screen.

const TIME_ZONE = 'America/Halifax'

const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })

// money("207.5") -> "$207.50". The server sends amounts as strings so no cents get lost.
export function money(amount) {
  return currency.format(Number(amount))
}

// pounds(1800) -> "1,800 lbs"
export function pounds(amount) {
  return `${Number(amount).toLocaleString('en-CA')} lbs`
}

// A date with no time, like "2026-10-10". Built from its parts so it can't
// slip to the day before in time zones behind UTC.
function parseDay(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// "Oct 10"
export function shortDate(isoDate) {
  return parseDay(isoDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// "Saturday, October 10"
export function longDate(isoDate) {
  return parseDay(isoDate).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
}

// "Friday, October 9 · 9:00 a.m." for a full timestamp, shown in Halifax time
export function dateAndTime(isoDateTime) {
  const moment = new Date(isoDateTime)
  const day = moment.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' })
  const time = moment.toLocaleTimeString('en-CA', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

// Today's date as "2026-09-22", for the minimum on date pickers
export function todayIso() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
