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

// "Tuesday, October 6 at 5:00 p.m." for use inside a sentence (Halifax time)
export function dateAtTime(isoDateTime) {
  return dateAndTime(isoDateTime).replace(' · ', ' at ')
}

// Today's date as "2026-09-22", for the minimum on date pickers
export function todayIso() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// timeRange("11:00:00", "13:00:00") -> "11 a.m. to 1 p.m."
export function timeRange(start, end) {
  return `${clockTime(start)} to ${clockTime(end)}`
}

function clockTime(hhmm) {
  const [hour, minute] = hhmm.split(':').map(Number)
  const suffix = hour < 12 ? 'a.m.' : 'p.m.'
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12
  return minute ? `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix}` : `${twelveHour} ${suffix}`
}

// How long until a deadline, in plain words: "3 days left", "5 hours left", "closed"
export function timeLeft(isoDateTime) {
  const ms = new Date(isoDateTime) - new Date()
  if (ms <= 0) return 'closed'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`
  if (hours >= 1) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`
  return 'less than an hour left'
}

// For <input type="datetime-local">: "2026-10-06T17:00" in the browser's time zone
export function toLocalInput(isoDateTime) {
  const d = new Date(isoDateTime)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Back from <input type="datetime-local"> to a full timestamp the server understands
export function fromLocalInput(value) {
  return new Date(value).toISOString()
}

// Adds days to a "2026-10-10" date and returns the same format
export function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
