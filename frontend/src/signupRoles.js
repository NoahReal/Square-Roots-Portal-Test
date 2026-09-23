// The three kinds of partner who can sign up on the website.
// The key is the web address: /signup/community-manager, /signup/farm, /signup/host-site
export const SIGNUP_ROLES = {
  'community-manager': {
    role: 'community_manager',
    label: 'Community Manager',
    title: 'Become a Community Manager',
    summary:
      'Run a Square Roots location in your community. Order produce bi-weekly and sell affordable bundles. Any revenue above the produce cost and our commission is yours.',
    button: 'Apply to run a location',
  },
  farm: {
    role: 'farm',
    label: 'Farm',
    title: 'Sell Us Your Seconds',
    summary:
      'Earn from produce that would otherwise be reploughed or sent to landfill. We order about 24 times a year, generally bi-weekly.',
    button: 'Sign up as a farm',
  },
  'host-site': {
    role: 'host_site',
    label: 'Host Site',
    title: 'Host a Drop',
    summary:
      'Have a community centre, church hall, school or other space? Host a Square Roots drop and help your neighbours get affordable produce.',
    button: 'Offer your space',
  },
}
