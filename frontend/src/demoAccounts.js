// Prototype only: these match the accounts created by `python manage.py seed`
// (backend/accounts/management/commands/seed.py). Keep the two lists in step.
export const DEMO_PASSWORD = 'squareroots'

export const DEMO_ACCOUNTS = [
  { username: 'admin', who: 'Maya Chen', role: 'Admin' },
  { username: 'cm.dartmouth', who: 'Jordan MacLeod', role: 'Community Manager' },
  { username: 'cm.bedford', who: 'Aisha Rahman', role: 'Community Manager' },
  { username: 'cm.sackville', who: 'Liam Boudreau', role: 'Community Manager' },
  { username: 'farm.gaspereau', who: 'Ruth Eisenhauer', role: 'Farm' },
  { username: 'farm.canard', who: 'Tom Van Dyk', role: 'Farm' },
  { username: 'host.dartmouth', who: 'Grace Oickle', role: 'Host Site' },
]
