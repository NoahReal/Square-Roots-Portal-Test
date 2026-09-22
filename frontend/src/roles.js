// What each role sees in the menu. Add a screen here and it shows up in
// the desktop menu, the phone tab bar and the role's home page.
// `ready: false` screens show a "coming soon" page until they're built.
// `inTabBar: false` keeps a screen out of the phone tab bar (it still shows on the home page).

export const ROLES = {
  admin: {
    label: 'Admin',
    home: '/admin',
    welcome: 'Run drop cycles, turn orders into farm purchase lists, and track our impact.',
    nav: [
      { to: '/admin', label: 'Home', ready: true },
      { to: '/admin/cycles', label: 'Drop Cycles', ready: false, description: 'Set order cutoffs and drop dates for each site.' },
      { to: '/admin/orders', label: 'Orders', ready: false, description: 'See every site’s bundle order and the purchase list for each farm.' },
      { to: '/admin/farms', label: 'Farms', ready: false, description: 'See what farms have available and decide who supplies what.' },
      { to: '/admin/impact', label: 'Impact', ready: false, description: 'Pounds diverted, bundles sold, sites active. Download as CSV.' },
      // Behind-the-scenes tool, so it stays out of the phone tab bar.
      { to: '/admin/api', label: 'API', ready: true, inTabBar: false, description: 'Every API the portal uses, and a tool for testing logins.' },
    ],
  },
  community_manager: {
    label: 'Community Manager',
    home: '/manager',
    welcome: 'Order bundles for your site, keep track of preorders, and log how each drop went.',
    nav: [
      { to: '/manager', label: 'Home', ready: true },
      { to: '/manager/order', label: 'Order', ready: false, description: 'Choose how many bundles you need before the cutoff.' },
      { to: '/manager/preorders', label: 'Preorders', ready: false, description: 'Keep a list of customers who have reserved a bundle.' },
      { to: '/manager/after-drop', label: 'After Drop', ready: false, description: 'Log bundles sold and anything left over.' },
    ],
  },
  farm: {
    label: 'Farm',
    home: '/farm',
    welcome: 'Tell us what seconds produce you have, confirm orders, and see pickups and payments.',
    nav: [
      { to: '/farm', label: 'Home', ready: true },
      { to: '/farm/produce', label: 'Produce', ready: false, description: 'Post what seconds produce you have and how much.' },
      { to: '/farm/pickups', label: 'Pickups', ready: false, description: 'Confirm orders and see pickup dates and payment status.' },
    ],
  },
  host_site: {
    label: 'Host Site',
    home: '/host',
    welcome: 'See when Square Roots drops are happening at your location.',
    nav: [{ to: '/host', label: 'Drop Dates', ready: true }],
  },
}

export function homeFor(user) {
  return ROLES[user.role]?.home ?? '/login'
}
