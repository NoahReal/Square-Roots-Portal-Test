// Prototype only: these match the accounts created by `python manage.py seed`
// (backend/accounts/management/commands/seed.py). Keep the two lists in step.
export const DEMO_PASSWORD = 'squareroots'

export const DEMO_ACCOUNTS = [
  { username: 'admin', who: 'Maya Chen', role: 'Admin' },
  { username: 'cm.dartmouth', who: 'Jordan MacLeod', role: 'Community Manager' },
  { username: 'cm.northend', who: 'Aisha Rahman', role: 'Community Manager' },
  { username: 'cm.sackville', who: 'Liam Boudreau', role: 'Community Manager' },
  { username: 'farm.gaspereau', who: 'Ruth Eisenhauer', role: 'Farm' },
  { username: 'farm.canard', who: 'Tom Van Dyk', role: 'Farm' },
  { username: 'host.fairview', who: 'Grace Oickle', role: 'Host Site' },
]

// People who signed up on the website and are waiting for an admin to approve them.
export const PENDING_DEMO_ACCOUNTS = [
  { username: 'apply.bedford', who: 'Priya Nair', role: 'Community Manager' },
  { username: 'apply.northmountain', who: 'Sam Porter', role: 'Farm' },
  { username: 'apply.windsorhall', who: 'Dana Whynot', role: 'Host Site' },
]
