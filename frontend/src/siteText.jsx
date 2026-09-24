import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

// Blocks of website text the Square Roots team can change on the admin Website Text screen,
// with the original wording. Pages show them with `const text = useSiteText()` and `text('about.intro')`.
// To make more text editable, add it here and use text('...') on the page.
export const SITE_TEXT = [
  {
    page: 'Home',
    blocks: [
      { key: 'home.hero', label: 'Big heading on the photo', text: 'A Community Interest Company Addressing Food Insecurity' },
      { key: 'home.tagline1', label: 'Green band, first line', text: 'Promoting entrepreneurship | Diverting waste from landfills' },
      { key: 'home.tagline2', label: 'Green band, second line', text: 'Seconds produce across Nova Scotia     I    Food-secure communities' },
      { key: 'home.mission.subtitle', label: 'Mission: subtitle', text: 'Reducing Food Waste, Increasing Food Security' },
      {
        key: 'home.mission.text',
        label: 'Mission: text',
        long: true,
        text: "Square Roots connects perfectly healthy produce that doesn't meet the cosmetic standards of grocery stores to community members in need. This produce is diverted from being reploughed into fields or wasted in landfills and becomes part of healthy, nutritious meals for Canadians.",
      },
      { key: 'home.impact.subtitle', label: 'Impact: subtitle', text: 'Redistributing Seconds Produce, Providing Opportunities for Entrepreneurship' },
      {
        key: 'home.impact.text',
        label: 'Impact: text',
        long: true,
        text: 'Through our various locations around Nova Scotia, independent Community Managers sell bundles at affordable prices.',
      },
      { key: 'home.support.subtitle', label: 'Support: subtitle', text: 'Join Us in Creating a Hunger-Free Canada' },
      {
        key: 'home.support.text',
        label: 'Support: text',
        long: true,
        text: 'Your involvement can make a real difference in the lives of individuals and families facing food insecurity. Together, we can build a future where everyone has access to an abundance of nutritious food.',
      },
      {
        key: 'home.enactus',
        label: 'Enactus Saint Mary’s: text',
        long: true,
        text: 'Square Roots was developed and is run by students from Enactus Saint Mary’s with help from advisors at the university',
      },
    ],
  },
  {
    page: 'About',
    blocks: [
      {
        key: 'about.intro',
        label: 'Introduction',
        long: true,
        text: "Square Roots is a community interest company based out of Halifax. We're dedicated to increasing food security across Canada by providing set-to-be-wasted, low-cost produce to communities around Nova Scotia.",
      },
      {
        key: 'about.how1',
        label: 'How It Works: first paragraph',
        long: true,
        text: 'We connect perfectly healthy produce that doesn’t meet the cosmetic standards of grocery stores to community members in need.',
      },
      {
        key: 'about.how2',
        label: 'How It Works: second paragraph',
        long: true,
        text: 'This produce is diverted from being reploughed into fields or wasted in landfills and becomes part of healthy, nutritious meals for Nova Scotians.',
      },
      { key: 'about.banner', label: 'Green banner', text: 'Nourishing Communities with Seconds Produce' },
      {
        key: 'about.cm1',
        label: 'Community Managers: first paragraph',
        long: true,
        text: 'We partner with community individuals and like-minded organizations interested in running their own Square Roots locations. These Community Managers are responsible for organizing bi-weekly produce markets in their regions with our support.',
      },
      {
        key: 'about.cm2',
        label: 'Community Managers: second paragraph',
        long: true,
        text: 'Square Roots enables these Community Managers to engage in risk-free entrepreneurship by providing incentivized produce prices for their first drop.',
      },
    ],
  },
  {
    page: 'Drop Dates & Locations',
    blocks: [
      {
        key: 'locations.intro',
        label: 'Introduction',
        long: true,
        text: 'Independent Community Managers operate drops bi-weekly at locations around Nova Scotia.',
      },
    ],
  },
  {
    page: 'For Farms',
    blocks: [
      { key: 'farms.benefit1.title', label: 'Benefit 1: title', text: 'Earn From Your Seconds Produce' },
      {
        key: 'farms.benefit1.text',
        label: 'Benefit 1: text',
        long: true,
        text: 'Our farmers earn cash from produce that would otherwise be sent to landfills or reploughed. This produce is less than cosmetically perfect but is still healthy and edible.',
      },
      { key: 'farms.benefit2.title', label: 'Benefit 2: title', text: 'Consistent Orders' },
      {
        key: 'farms.benefit2.text',
        label: 'Benefit 2: text',
        long: true,
        text: "We order our produce 24 times a year, generally bi-weekly. If you don't have seconds produce that week, no worries, we understand!",
      },
      { key: 'farms.benefit3.title', label: 'Benefit 3: title', text: 'Social Good' },
      {
        key: 'farms.benefit3.text',
        label: 'Benefit 3: text',
        long: true,
        text: 'We sell to communities at reduced prices and promote social entrepreneurship to solve food insecurity.',
      },
      {
        key: 'farms.interested',
        label: 'Interested?: text',
        long: true,
        text: 'Sign up to sell us your seconds produce. Once we approve your account, you can post what you have available and see our orders in the partner portal.',
      },
    ],
  },
  {
    page: 'Become a Community Manager',
    blocks: [
      { key: 'cm.title', label: 'Heading', text: 'So you want to become a Community Manager...' },
      {
        key: 'cm.intro',
        label: 'Introduction',
        long: true,
        text: "As a Community Manager, you'll be essential in forming relationships with your community and listening to how Square Roots can best provide for their produce needs. You'll order produce bi-weekly or monthly from the order forms we send you. Any revenue above the produce cost and our commission is entirely yours!",
      },
      {
        key: 'cm.apply',
        label: 'Become a Community Manager: text',
        long: true,
        text: "Just send us your contact info, where you'd like to start a location, and include an optional message and we'll get back to you as soon as possible.",
      },
    ],
  },
]

const ORIGINALS = Object.fromEntries(SITE_TEXT.flatMap((page) => page.blocks.map((block) => [block.key, block.text])))

const SiteTextContext = createContext({ changed: {}, setChanged: () => {} })

// Loads the team's changes once, when the website opens. Until then (or if it fails), the original words show.
export function SiteTextProvider({ children }) {
  const [changed, setChanged] = useState({})
  useEffect(() => {
    api('/site-text/')
      .then(setChanged)
      .catch(() => setChanged({}))
  }, [])
  return <SiteTextContext.Provider value={{ changed, setChanged }}>{children}</SiteTextContext.Provider>
}

// text('about.intro') gives the team's version of a block, or the original.
export function useSiteText() {
  const { changed } = useContext(SiteTextContext)
  return (key) => changed[key] ?? ORIGINALS[key] ?? ''
}

// For the admin Website Text screen: what's been changed, and a way to update it after saving.
export function useSiteTextChanges() {
  return useContext(SiteTextContext)
}
