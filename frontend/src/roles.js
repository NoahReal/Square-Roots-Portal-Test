// What each role sees in the menu. Add a screen here and it shows up in
// the desktop menu, the phone tab bar and the role's home page.
// `ready: true` screens show a "coming soon" page until they're built.
// `inTabBar: false` keeps a screen out of the phone tab bar (it still shows on the home page).

export const ROLES = {
  admin: {
    label: 'Admin',
    home: '/portal/admin',
    welcome: 'Run drop cycles, turn orders into farm purchase lists, and track our impact.',
    nav: [
      { to: '/portal/admin', label: 'Home', ready: true },
      { to: '/portal/admin/signups', label: 'Sign-ups', ready: true, description: 'Approve or decline people who signed up on the website.' },
      { to: '/portal/admin/cycles', label: 'Drop Cycles', ready: true, description: 'Set order cutoffs and drop dates for each site.' },
      { to: '/portal/admin/orders', label: 'Orders', ready: true, description: 'See every site’s bundle order and the purchase list for each farm.' },
      { to: '/portal/admin/farms', label: 'Farms', ready: true, description: 'See what farms have available and decide who supplies what.' },
      { to: '/portal/admin/impact', label: 'Impact', ready: true, description: 'Pounds diverted, bundles sold, sites active. Download as CSV.' },
      // Behind-the-scenes tool, so it stays out of the phone tab bar.
      { to: '/portal/admin/api', label: 'API', ready: true, inTabBar: false, description: 'Every API the portal uses, and a tool for testing logins.' },
    ],
  },
  community_manager: {
    label: 'Community Manager',
    home: '/portal/manager',
    welcome: 'Order bundles for your site, keep track of preorders, and log how each drop went.',
    nav: [
      { to: '/portal/manager', label: 'Home', ready: true },
      { to: '/portal/manager/order', label: 'Order', ready: true, description: 'Choose how many bundles you need before the cutoff.' },
      { to: '/portal/manager/preorders', label: 'Preorders', ready: true, description: 'Keep a list of customers who have reserved a bundle.' },
      { to: '/portal/manager/after-drop', label: 'After Drop', ready: true, description: 'Log bundles sold and anything left over.' },
    ],
  },
  farm: {
    label: 'Farm',
    home: '/portal/farm',
    welcome: 'Tell us what seconds produce you have, confirm orders, and see pickups and payments.',
    nav: [
      { to: '/portal/farm', label: 'Home', ready: true },
      { to: '/portal/farm/produce', label: 'Produce', ready: true, description: 'Post what seconds produce you have and how much.' },
      { to: '/portal/farm/pickups', label: 'Pickups', ready: true, description: 'Confirm orders and see pickup dates and payment status.' },
    ],
  },
  host_site: {
    label: 'Host Site',
    home: '/portal/host',
    welcome: 'See when Square Roots drops are happening at your location.',
    nav: [{ to: '/portal/host', label: 'Drop Dates', ready: true }],
  },
}

// Where to send someone after they log in. People who signed up and haven't
// been approved yet go to the "application received" page instead.
export function homeFor(user) {
  if (user.status !== 'approved') return '/portal/pending'
  return ROLES[user.role]?.home ?? '/portal/login'
}
