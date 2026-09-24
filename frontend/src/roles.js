// What each role sees in the menu. Add a screen here and it shows up in the menu
// (and gets a web address); App.jsx says which page component shows for it.
//
//   more: true    on desktop it goes under "More"; on phones it's reached from the home page
//   hidden: true  it has a web address but isn't in any menu (a link on the home page leads to it)

export const ROLES = {
  admin: {
    label: 'Admin',
    home: '/portal/admin',
    welcome: 'Run drop cycles, turn orders into farm purchase lists, and track our impact.',
    nav: [
      { to: '/portal/admin', label: 'Home' },
      { to: '/portal/admin/cycles', label: 'Drop Cycles', description: 'Set order cutoffs, drop dates and hours for each site.' },
      { to: '/portal/admin/orders', label: 'Orders', description: 'See every site’s bundle order and the purchase list for each farm.' },
      { to: '/portal/admin/farms', label: 'Farms', description: 'See what farms have available and decide who supplies what.' },
      { to: '/portal/admin/impact', label: 'Impact', description: 'Pounds diverted, bundles sold, sites active. Download as CSV.' },
      { to: '/portal/admin/packing', label: 'Packing & Delivery', more: true, description: 'What arrives from farms, how to pack bundles, and where they go.' },
      { to: '/portal/admin/money', label: 'Money', more: true, description: 'What each drop collected and owes, and payments received.' },
      { to: '/portal/admin/signups', label: 'Sign-ups', more: true, description: 'Approve or decline people who signed up on the website.' },
      { to: '/portal/admin/people', label: 'People', more: true, description: 'Everyone with an account: their location or farm, access and passwords.' },
      { to: '/portal/admin/locations', label: 'Locations', more: true, description: 'Add and edit Square Roots locations shown on the website.' },
      { to: '/portal/admin/website-text', label: 'Website Text', more: true, description: 'Change the words on the public website.' },
      { to: '/portal/admin/events', label: 'Events', more: true, description: 'Add events to the public Events page.' },
      { to: '/portal/admin/area-requests', label: 'Location Requests', more: true, description: 'Where people are asking for a location near them.' },
      { to: '/portal/admin/settings', label: 'Settings', more: true, description: 'Bundle prices, first-drop price, delivery fee and sorting space.' },
      { to: '/portal/admin/api', label: 'Developer tools', hidden: true, description: 'Every API the portal uses, and a tool for testing logins.' },
    ],
  },
  community_manager: {
    label: 'Community Manager',
    home: '/portal/manager',
    welcome: 'Order bundles for your site, keep track of preorders, and log how each drop went.',
    nav: [
      { to: '/portal/manager', label: 'Home' },
      { to: '/portal/manager/order', label: 'Order', description: 'Choose how many bundles you need before the cutoff.' },
      { to: '/portal/manager/preorders', label: 'Preorders', description: 'Keep a list of customers who have reserved a bundle.' },
      { to: '/portal/manager/after-drop', label: 'After Drop', description: 'Log bundles sold and anything left over.' },
    ],
  },
  farm: {
    label: 'Farm',
    home: '/portal/farm',
    welcome: 'Tell us what seconds produce you have, confirm orders, and see pickups and payments.',
    nav: [
      { to: '/portal/farm', label: 'Home' },
      { to: '/portal/farm/produce', label: 'Produce', description: 'Post what seconds produce you have and how much.' },
      { to: '/portal/farm/pickups', label: 'Pickups', description: 'Confirm orders and see pickup dates and payment status.' },
    ],
  },
  host_site: {
    label: 'Host Site',
    home: '/portal/host',
    welcome: 'See when Square Roots drops are happening at your location.',
    nav: [
      { to: '/portal/host', label: 'Drop Dates' },
      { to: '/portal/host/reserve', label: 'Reserve for Someone' },
    ],
  },
}

// Where to send someone after they log in. People who signed up and haven't
// been approved yet go to the "application received" page instead.
export function homeFor(user) {
  if (user.status !== 'approved') return '/portal/pending'
  return ROLES[user.role]?.home ?? '/portal/login'
}

// Menu sections for a role: the main items, and the ones under "More".
export function menuFor(role) {
  const visible = role.nav.filter((item) => !item.hidden)
  return { main: visible.filter((item) => !item.more), more: visible.filter((item) => item.more) }
}
