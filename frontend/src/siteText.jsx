import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { useLanguage } from './i18n'

// Blocks of website text the Square Roots team can change on the admin Website Text screen,
// with the original wording in English (`text`) and French (`fr`).
// Pages show them with `const text = useSiteText()` and `text('about.intro')`.
// The team's French changes are saved under 'fr.' + the key, e.g. 'fr.about.intro'.
// To make more text editable, add it here and use text('...') on the page.
export const SITE_TEXT = [
  {
    page: 'Home',
    blocks: [
      { key: 'home.hero', label: 'Big heading on the photo', text: 'A Community Interest Company Addressing Food Insecurity',
        fr: 'Une entreprise d’intérêt communautaire qui lutte contre l’insécurité alimentaire' },
      { key: 'home.tagline1', label: 'Green band, first line', text: 'Promoting entrepreneurship | Diverting waste from landfills',
        fr: 'Promouvoir l’entrepreneuriat | Détourner les déchets des sites d’enfouissement' },
      { key: 'home.tagline2', label: 'Green band, second line', text: 'Seconds produce across Nova Scotia     I    Food-secure communities',
        fr: 'Des produits déclassés partout en Nouvelle-Écosse     I    Des communautés en sécurité alimentaire' },
      { key: 'home.mission.subtitle', label: 'Mission: subtitle', text: 'Reducing Food Waste, Increasing Food Security',
        fr: 'Réduire le gaspillage alimentaire, accroître la sécurité alimentaire' },
      {
        key: 'home.mission.text',
        label: 'Mission: text',
        long: true,
        text: "Square Roots connects perfectly healthy produce that doesn't meet the cosmetic standards of grocery stores to community members in need. This produce is diverted from being reploughed into fields or wasted in landfills and becomes part of healthy, nutritious meals for Canadians.",
        fr: 'Square Roots offre aux membres de la communauté dans le besoin des produits parfaitement sains qui ne répondent pas aux normes esthétiques des épiceries. Au lieu d’être enfouis dans les champs ou jetés au dépotoir, ces produits deviennent des repas sains et nutritifs pour les Canadiens.',
      },
      { key: 'home.impact.subtitle', label: 'Impact: subtitle', text: 'Redistributing Seconds Produce, Providing Opportunities for Entrepreneurship',
        fr: 'Redistribuer les produits déclassés, créer des occasions d’entrepreneuriat' },
      {
        key: 'home.impact.text',
        label: 'Impact: text',
        long: true,
        text: 'Through our various locations around Nova Scotia, independent Community Managers sell bundles at affordable prices.',
        fr: 'Dans nos différents lieux en Nouvelle-Écosse, des gestionnaires communautaires indépendants vendent des paniers à prix abordables.',
      },
      { key: 'home.support.subtitle', label: 'Support: subtitle', text: 'Join Us in Creating a Hunger-Free Canada',
        fr: 'Aidez-nous à bâtir un Canada sans faim' },
      {
        key: 'home.support.text',
        label: 'Support: text',
        long: true,
        text: 'Your involvement can make a real difference in the lives of individuals and families facing food insecurity. Together, we can build a future where everyone has access to an abundance of nutritious food.',
        fr: 'Votre participation peut vraiment changer la vie de personnes et de familles en situation d’insécurité alimentaire. Ensemble, bâtissons un avenir où chacun a accès à une nourriture nutritive en abondance.',
      },
      {
        key: 'home.enactus',
        label: 'Enactus Saint Mary’s: text',
        long: true,
        text: 'Square Roots was developed and is run by students from Enactus Saint Mary’s with help from advisors at the university',
        fr: 'Square Roots a été créé et est géré par des étudiants d’Enactus Saint Mary’s, avec l’aide de conseillers de l’université',
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
        fr: 'Square Roots est une entreprise d’intérêt communautaire établie à Halifax. Nous voulons accroître la sécurité alimentaire au Canada en offrant aux communautés de la Nouvelle-Écosse, à faible coût, des produits destinés au gaspillage.',
      },
      {
        key: 'about.how1',
        label: 'How It Works: first paragraph',
        long: true,
        text: 'We connect perfectly healthy produce that doesn’t meet the cosmetic standards of grocery stores to community members in need.',
        fr: 'Nous offrons aux membres de la communauté dans le besoin des produits parfaitement sains qui ne répondent pas aux normes esthétiques des épiceries.',
      },
      {
        key: 'about.how2',
        label: 'How It Works: second paragraph',
        long: true,
        text: 'This produce is diverted from being reploughed into fields or wasted in landfills and becomes part of healthy, nutritious meals for Nova Scotians.',
        fr: 'Au lieu d’être enfouis dans les champs ou jetés au dépotoir, ces produits deviennent des repas sains et nutritifs pour les Néo-Écossais.',
      },
      { key: 'about.banner', label: 'Green banner', text: 'Nourishing Communities with Seconds Produce',
        fr: 'Nourrir les communautés avec des produits déclassés' },
      {
        key: 'about.cm1',
        label: 'Community Managers: first paragraph',
        long: true,
        text: 'We partner with community individuals and like-minded organizations interested in running their own Square Roots locations. These Community Managers are responsible for organizing bi-weekly produce markets in their regions with our support.',
        fr: 'Nous collaborons avec des personnes et des organismes de la communauté qui partagent nos valeurs et veulent gérer leur propre lieu Square Roots. Ces gestionnaires communautaires organisent, avec notre soutien, des marchés de produits toutes les deux semaines dans leur région.',
      },
      {
        key: 'about.cm2',
        label: 'Community Managers: second paragraph',
        long: true,
        text: 'Square Roots enables these Community Managers to engage in risk-free entrepreneurship by providing incentivized produce prices for their first drop.',
        fr: 'Square Roots permet à ces gestionnaires communautaires de se lancer en affaires sans risque, grâce à des prix avantageux sur les produits de leur première distribution.',
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
        fr: 'Des gestionnaires communautaires indépendants organisent des distributions toutes les deux semaines dans différents lieux en Nouvelle-Écosse.',
      },
    ],
  },
  {
    page: 'For Farms',
    blocks: [
      { key: 'farms.benefit1.title', label: 'Benefit 1: title', text: 'Earn From Your Seconds Produce',
        fr: 'Tirez un revenu de vos produits déclassés' },
      {
        key: 'farms.benefit1.text',
        label: 'Benefit 1: text',
        long: true,
        text: 'Our farmers earn cash from produce that would otherwise be sent to landfills or reploughed. This produce is less than cosmetically perfect but is still healthy and edible.',
        fr: 'Nos fermiers sont payés pour des produits qui seraient autrement envoyés au dépotoir ou enfouis dans les champs. Ces produits ne sont pas parfaits en apparence, mais ils restent sains et comestibles.',
      },
      { key: 'farms.benefit2.title', label: 'Benefit 2: title', text: 'Consistent Orders',
        fr: 'Des commandes régulières' },
      {
        key: 'farms.benefit2.text',
        label: 'Benefit 2: text',
        long: true,
        text: "We order our produce 24 times a year, generally bi-weekly. If you don't have seconds produce that week, no worries, we understand!",
        fr: 'Nous commandons nos produits 24 fois par année, généralement toutes les deux semaines. Vous n’avez pas de produits déclassés cette semaine-là? Pas de souci, nous comprenons!',
      },
      { key: 'farms.benefit3.title', label: 'Benefit 3: title', text: 'Social Good',
        fr: 'Un impact social' },
      {
        key: 'farms.benefit3.text',
        label: 'Benefit 3: text',
        long: true,
        text: 'We sell to communities at reduced prices and promote social entrepreneurship to solve food insecurity.',
        fr: 'Nous vendons aux communautés à prix réduit et encourageons l’entrepreneuriat social pour lutter contre l’insécurité alimentaire.',
      },
      {
        key: 'farms.interested',
        label: 'Interested?: text',
        long: true,
        text: 'Sign up to sell us your seconds produce. Once we approve your account, you can post what you have available and see our orders in the partner portal.',
        fr: 'Inscrivez-vous pour nous vendre vos produits déclassés. Une fois votre compte approuvé, vous pourrez afficher vos produits disponibles et voir nos commandes dans le portail des partenaires.',
      },
    ],
  },
  {
    page: 'Become a Community Manager',
    blocks: [
      { key: 'cm.title', label: 'Heading', text: 'So you want to become a Community Manager...',
        fr: 'Vous voulez devenir gestionnaire communautaire…' },
      {
        key: 'cm.intro',
        label: 'Introduction',
        long: true,
        text: "As a Community Manager, you'll be essential in forming relationships with your community and listening to how Square Roots can best provide for their produce needs. You'll order produce bi-weekly or monthly from the order forms we send you. Any revenue above the produce cost and our commission is entirely yours!",
        fr: 'Comme gestionnaire communautaire, vous jouerez un rôle essentiel : tisser des liens avec votre communauté et écouter ses besoins pour que Square Roots puisse y répondre au mieux. Vous commanderez des produits toutes les deux semaines ou chaque mois à l’aide des bons de commande que nous vous enverrons. Tout revenu au-delà du coût des produits et de notre commission vous revient!',
      },
      {
        key: 'cm.apply',
        label: 'Become a Community Manager: text',
        long: true,
        text: "Just send us your contact info, where you'd like to start a location, and include an optional message and we'll get back to you as soon as possible.",
        fr: 'Envoyez-nous simplement vos coordonnées, l’endroit où vous aimeriez lancer un lieu et, si vous le voulez, un message. Nous vous répondrons dès que possible.',
      },
    ],
  },
]

const BLOCKS = Object.fromEntries(SITE_TEXT.flatMap((page) => page.blocks.map((block) => [block.key, block])))

// Where the team's version of a block is saved: 'about.intro' in English, 'fr.about.intro' in French.
export function savedKey(key, lang) {
  return lang === 'en' ? key : `${lang}.${key}`
}

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

// text('about.intro') gives the team's version of a block, or the original, in the chosen language.
export function useSiteText() {
  const { changed } = useContext(SiteTextContext)
  const { lang } = useLanguage()
  return (key) => {
    const block = BLOCKS[key]
    if (!block) return ''
    const original = lang === 'en' ? block.text : block[lang]
    return changed[savedKey(key, lang)] ?? original ?? block.text
  }
}

// For the admin Website Text screen: what's been changed, and a way to update it after saving.
export function useSiteTextChanges() {
  return useContext(SiteTextContext)
}
