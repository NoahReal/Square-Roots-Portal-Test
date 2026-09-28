import { createContext, useContext, useEffect, useState } from 'react'

// Languages for the customer pages (Reserve, your reservation, what's in the bundle).
// The rest of the website is English, like squarerootssmu.ca.
//
// To change wording, edit WORDS below. To add a language: add a copy of the `en` block under its
// code (e.g. `ar`), add it to LANGUAGES, and add it to Language in backend/drops/models.py and
// backend/drops/customer_emails.py so emails match.
// The French was written for this prototype; have a French speaker check it before real use.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
]

const LOCALES = { en: 'en-CA', fr: 'fr-CA' }
const TIME_ZONE = 'America/Halifax'

const WORDS = {
  en: {
    bundles: (n) => (n === 1 ? '1 bundle' : `${n} bundles`),
    people: (n) => (n === 1 ? '1 person' : `${n} people`),
    daysLeft: (n) => `${n} days left`,
    hoursLeft: (n) => (n === 1 ? '1 hour left' : `${n} hours left`),
    lessThanHour: 'less than an hour left',
    closed: 'closed',
    at: 'at',
    to: 'to',

    reserveTitle: 'Reserve a Bundle',
    reserveLead: '10 lbs of fresh Nova Scotia produce. Reserve now and pay at the drop: whatever works for you.',
    cancelledNotice: 'Your reservation is cancelled and your details are deleted.',
    loadingLocations: 'Loading locations…',
    loadError: 'We couldn’t load the locations. Check your connection and try again.',
    yourReservations: 'Your reservations',
    waitlistShort: '(waitlist)',
    step1: 'Where will you pick up?',
    location: 'Location',
    chooseLocation: 'Choose your location…',
    noneNearby: 'No location near you? Ask for one',
    whichDrop: 'Which drop?',
    reserveBy: (when, left) => `Reserve by ${when} (${left})`,
    noOnline: (site) => `${site} doesn’t take online reservations yet. Just come by on drop day, or `,
    messageLocation: 'message the location',
    contactUs: 'contact us',
    toHoldBundle: ' to hold a bundle. See all dates on ',
    dropDatesLink: 'Drop Dates & Locations',
    noDropOpen: (site) =>
      `There’s no drop open for reservations at ${site} right now. New dates are added every two weeks, so check back soon.`,
    allReserved: (waiting) =>
      `All bundles for this drop are reserved. Join the waitlist and we’ll email you if one opens up${waiting}.`,
    peopleWaiting: (n) => ` (${n === 1 ? '1 person' : `${n} people`} waiting)`,
    onlyLeftChooseFewer: (n) => `Only ${n} ${n === 1 ? 'bundle is' : 'bundles are'} left. Choose fewer, or join the waitlist.`,
    onlyLeft: (n) => `Only ${n} left`,
    bundlesLeft: (n) => `${n} bundles left`,
    step2: 'How many bundles?',
    bundleWeight: 'Each bundle is 10 lbs of fresh produce.',
    step3: 'Pay what works for you',
    pricePerBundle: 'Price per bundle',
    privateChoice: 'Every choice is private and gets the same bundle.',
    priceStandardTitle: 'Pay it forward',
    priceStandardText: 'Covers your bundle and helps cover one for a neighbour.',
    priceAtCostTitle: 'At cost',
    priceAtCostText: 'Covers what your bundle costs.',
    priceFreeTitle: 'Free',
    priceFreeText: 'If money is too tight right now.',
    giftQuestion: 'Add a gift for a neighbour?',
    giftHint: '(optional, paid at the drop)',
    noThanks: 'No thanks',
    giftsCovered: (n) => `This year, neighbours’ gifts have covered ${n} free bundles.`,
    step4Delivery: 'Pick up or delivery?',
    pickUpAtDrop: 'I’ll pick up at the drop',
    deliverWith: (partner, fee) => `Deliver to my home with ${partner} (${fee})`,
    deliveryAddress: 'Delivery address',
    stepDetails: 'Your details',
    yourName: 'Your name',
    email: 'Email',
    emailHint: 'for your confirmation and pickup code',
    phone: 'Phone',
    phoneHint: 'if you’d rather not use email',
    everyDrop: (site) => `Reserve this for me at every ${site} drop`,
    everyDropHint: 'We’ll reserve for you each time a new drop is scheduled and email you. Stop any time.',
    rememberMe: 'Remember my details on this device',
    ifSpotOpens: 'If a spot opens up, you’ll pay',
    payAtDrop: 'You’ll pay at the drop',
    oneMoment: 'One moment…',
    joinWaitlist: 'Join the waitlist',
    reserveN: (n) => `Reserve ${n === 1 ? '1 bundle' : `${n} bundles`}`,
    privacy:
      'Your details go only to your Community Manager and the Square Roots team, and are used only for this reservation. We remove them 60 days after your drop, or right away if you cancel. ',
    privacyLink: 'Read our privacy policy',
    errName: 'Please add your name.',
    errContact: 'Add an email or a phone number, so we can reach you if plans change.',
    errAddress: 'Add the address to deliver to.',
    errLocation: 'Choose a location.',

    moneyQuestion: (price) => `Where does your ${price} go?`,
    moneyFarms: 'buys the produce from Nova Scotia farms (what we paid per bundle this year)',
    moneySquareRootsRest: 'covers the rest of Square Roots’ costs',
    moneySquareRootsAll: 'goes to Square Roots, to buy produce from Nova Scotia farms and run the program',
    moneyManager: 'goes to your Community Manager, the local entrepreneur who runs your drop',
    moneyNote: (atCost) =>
      `At ${atCost}, you cover Square Roots’ share without the extra for your Community Manager. Free bundles are covered by pay-it-forward gifts and sponsors.`,

    loadingReservation: 'Loading your reservation…',
    reservationLoadError: 'We couldn’t load your reservation. Try again in a moment.',
    reserveABundle: 'Reserve a bundle',
    onWaitlistNotice: 'You’re on the waitlist.',
    allSetNotice: 'You’re all set! Your bundle is reserved.',
    emailedTo: (email) => `We’ve emailed the details to ${email}.`,
    bookmark: 'Bookmark this page: it’s how you change or cancel.',
    changesSaved: 'Your changes are saved.',
    onWaitlistTitle: 'You’re on the waitlist',
    yourReservation: 'Your reservation',
    placeInLine: 'Your place in line',
    waitlistExplain: (emailed) =>
      `If a bundle opens up before ordering closes, it’s reserved for you automatically${emailed ? ' and we’ll email you' : ''}. Check back here any time.`,
    deliveryBy: (partner) => `Delivery by ${partner}`,
    deliveryExplain: 'Your bundle will be delivered on drop day. Please have payment ready.',
    pickupCode: 'Your pickup code',
    pickupExplain: 'Show this at the drop. Your Community Manager will find your bundle.',
    pickedUp: 'Picked up. Enjoy your produce!',
    when: 'When',
    where: 'Where',
    directions: 'Directions',
    bundlesLabel: 'Bundles',
    giftLabel: 'Gift for a neighbour',
    thankYou: (amount) => `${amount}. Thank you!`,
    payIfSpot: 'You’ll pay if a spot opens',
    includesDelivery: ' (includes delivery)',
    addToCalendar: 'Add to my calendar',
    copyLink: 'Copy link to this page',
    linkCopied: 'Link copied',
    copyPrompt: 'Copy this link:',
    changeUntil: (when) => `You can change or cancel until ${when}`,
    changeOrLeave: 'Change or leave the waitlist',
    changeOrCancel: 'Change or cancel',
    changesClosed: 'Changes for this drop have closed. If something’s come up, please ',
    messageSite: (site) => `message Square Roots ${site}`,
    everyDropOn: (site) => `You reserve every ${site} drop.`,
    everyDropOnExplain: (bundles) => ` Each time a new drop is scheduled, we reserve ${bundles} for you and email you.`,
    stopEveryDrop: 'Stop reserving every drop',
    everyDropOffer: (site) => `Coming every time? We can reserve for you at every ${site} drop, and email you each time.`,
    startEveryDrop: 'Reserve every drop for me',
    changeTitleWaitlist: 'Change your waitlist spot',
    changeTitle: 'Change your reservation',
    noMoreLeft: 'No more bundles are left to add at this drop.',
    none: 'None',
    saveChanges: 'Save changes',
    neverMind: 'Never mind',
    leaveWaitlistConfirm: 'Leave the waitlist? Your details will be deleted.',
    cancelEveryDropConfirm:
      'Cancel this drop’s reservation? Your bundle goes to the next person waiting. You’ll still be reserved at future drops.',
    cancelConfirm: 'Cancel your reservation? Your bundle goes to the next person waiting, and your details are deleted.',
    yesLeave: 'Yes, leave the waitlist',
    yesCancel: 'Yes, cancel it',
    keepIt: 'Keep it',
    leaveWaitlist: 'Leave the waitlist',
    cancelMine: 'Cancel my reservation',
    calendarTitle: (bundles) => `Pick up ${bundles} from Square Roots`,
    calendarCode: (code) => `Your pickup code is ${code}.`,

    yourImpact: 'Your impact',
    impactText: (bundles, pounds) =>
      `You’ve picked up ${bundles === 1 ? '1 bundle' : `${bundles} bundles`}: ${pounds} lbs of good produce that didn’t go to waste. Thank you!`,
    howWasIt: 'How was your bundle?',
    feedbackGood: 'Great',
    feedbackOkay: 'Okay',
    feedbackPoor: 'Not great',
    feedbackComment: 'Anything to tell us? (optional)',
    sendFeedback: 'Send',
    feedbackThanks: 'Thank you! Your Community Manager will see this.',
    inYourBundle: 'What’s in your bundle',
    notDecidedYet:
      'We buy from farms once ordering closes, so we’ll know what’s in this bundle a few days before the drop. Check back then.',
    about: (lbs) => `about ${lbs} lbs`,
    from: 'from',
    seeRecipes: 'Recipes and storage tips',

    bundleTitle: 'What’s in the Bundle',
    bundleLead: 'Seconds produce from Nova Scotia farms: perfectly good food that doesn’t meet grocery store looks.',
    nextBundle: (date) => `Next bundle: ${date}`,
    lastBundle: (date) => `Last bundle: ${date}`,
    bundleNotYet: 'We’ll post what’s in the next bundle once the farm orders are placed.',
    howToStore: 'Keep it fresh',
    ideas: 'Ideas',
    moreProduce: 'Other produce we often have',
    bundleMayVary: 'Amounts are a guide: each bundle is packed by hand and can vary a little.',
    loading: 'Loading…',

    homeReserveTitle: 'Reserve Your Bundle',
    homeNextDrop: (date) => `Next drop: ${date}`,
    homeReserveBy: (when) => `Pay at the drop. Reserve by ${when}`,
    homeIntro: '10 lbs of fresh Nova Scotia produce. Reserve ahead and pay at the drop.',
    homePayWhatWorks: (standard, atCost) => `Pay what works for you: ${standard}, ${atCost} or free.`,
    homeGifts: (n) => ` This year, neighbours’ gifts have covered ${n} free bundles.`,
    yourLocation: 'Your location',
    whatsInTheBundle: 'What’s in the bundle?',
  },

  fr: {
    bundles: (n) => (n === 1 ? '1 panier' : `${n} paniers`),
    people: (n) => (n === 1 ? '1 personne' : `${n} personnes`),
    daysLeft: (n) => `encore ${n} jours`,
    hoursLeft: (n) => (n === 1 ? 'encore 1 heure' : `encore ${n} heures`),
    lessThanHour: 'moins d’une heure',
    closed: 'fermé',
    at: 'à',
    to: 'à',

    reserveTitle: 'Réserver un panier',
    reserveLead: '10 lb de produits frais de la Nouvelle-Écosse. Réservez maintenant et payez sur place, selon vos moyens.',
    cancelledNotice: 'Votre réservation est annulée et vos coordonnées sont supprimées.',
    loadingLocations: 'Chargement des lieux…',
    loadError: 'Impossible de charger les lieux. Vérifiez votre connexion et réessayez.',
    yourReservations: 'Vos réservations',
    waitlistShort: '(liste d’attente)',
    step1: 'Où ferez-vous la cueillette?',
    location: 'Lieu',
    chooseLocation: 'Choisissez votre lieu…',
    noneNearby: 'Aucun lieu près de chez vous? Demandez-en un (en anglais)',
    whichDrop: 'Quelle distribution?',
    reserveBy: (when, left) => `Réservez d’ici le ${when} (${left})`,
    noOnline: (site) => `${site} ne prend pas encore de réservations en ligne. Présentez-vous le jour de la distribution, ou `,
    messageLocation: 'écrivez au lieu',
    contactUs: 'contactez-nous',
    toHoldBundle: ' pour garder un panier. Voyez toutes les dates sur la page ',
    dropDatesLink: 'Dates et lieux (en anglais)',
    noDropOpen: (site) =>
      `Aucune distribution n’est ouverte aux réservations à ${site} pour le moment. De nouvelles dates s’ajoutent toutes les deux semaines.`,
    allReserved: (waiting) =>
      `Tous les paniers de cette distribution sont réservés. Inscrivez-vous sur la liste d’attente : nous vous écrirons si une place se libère${waiting}.`,
    peopleWaiting: (n) => ` (${n === 1 ? '1 personne' : `${n} personnes`} en attente)`,
    onlyLeftChooseFewer: (n) =>
      `Il ne reste que ${n} ${n === 1 ? 'panier' : 'paniers'}. Choisissez-en moins, ou inscrivez-vous sur la liste d’attente.`,
    onlyLeft: (n) => `Plus que ${n}`,
    bundlesLeft: (n) => `${n} paniers disponibles`,
    step2: 'Combien de paniers?',
    bundleWeight: 'Chaque panier contient 10 lb de produits frais.',
    step3: 'Payez selon vos moyens',
    pricePerBundle: 'Prix par panier',
    privateChoice: 'Votre choix reste confidentiel, et le panier est le même.',
    priceStandardTitle: 'Donner au suivant',
    priceStandardText: 'Couvre votre panier et aide à en offrir un à quelqu’un.',
    priceAtCostTitle: 'Prix coûtant',
    priceAtCostText: 'Couvre le coût de votre panier.',
    priceFreeTitle: 'Gratuit',
    priceFreeText: 'Si votre budget est trop serré en ce moment.',
    giftQuestion: 'Ajouter un don pour quelqu’un?',
    giftHint: '(facultatif, payé sur place)',
    noThanks: 'Non merci',
    giftsCovered: (n) => `Cette année, les dons des gens d’ici ont couvert ${n} paniers gratuits.`,
    step4Delivery: 'Cueillette ou livraison?',
    pickUpAtDrop: 'Je ferai la cueillette sur place',
    deliverWith: (partner, fee) => `Livraison à domicile avec ${partner} (${fee})`,
    deliveryAddress: 'Adresse de livraison',
    stepDetails: 'Vos coordonnées',
    yourName: 'Votre nom',
    email: 'Courriel',
    emailHint: 'pour votre confirmation et votre code de cueillette',
    phone: 'Téléphone',
    phoneHint: 'si vous préférez ne pas utiliser le courriel',
    everyDrop: (site) => `Réserver pour moi à chaque distribution de ${site}`,
    everyDropHint: 'Nous réserverons pour vous à chaque nouvelle distribution et vous écrirons. Arrêtez quand vous voulez.',
    rememberMe: 'Mémoriser mes coordonnées sur cet appareil',
    ifSpotOpens: 'Si une place se libère, vous paierez',
    payAtDrop: 'À payer sur place',
    oneMoment: 'Un instant…',
    joinWaitlist: 'M’inscrire sur la liste d’attente',
    reserveN: (n) => `Réserver ${n === 1 ? '1 panier' : `${n} paniers`}`,
    privacy:
      'Vos coordonnées sont transmises seulement à votre gestionnaire communautaire et à l’équipe de Square Roots, et servent seulement à cette réservation. Nous les supprimons 60 jours après la distribution, ou tout de suite si vous annulez. ',
    privacyLink: 'Lire notre politique de confidentialité (en anglais)',
    errName: 'Veuillez indiquer votre nom.',
    errContact: 'Indiquez un courriel ou un numéro de téléphone, pour qu’on puisse vous joindre en cas de changement.',
    errAddress: 'Indiquez l’adresse de livraison.',
    errLocation: 'Choisissez un lieu.',

    moneyQuestion: (price) => `Où vont vos ${price}?`,
    moneyFarms: 'achètent les produits aux fermes de la Nouvelle-Écosse (ce que nous avons payé par panier cette année)',
    moneySquareRootsRest: 'couvrent le reste des coûts de Square Roots',
    moneySquareRootsAll: 'vont à Square Roots, pour acheter les produits aux fermes et faire fonctionner le programme',
    moneyManager: 'vont à votre gestionnaire communautaire, l’entrepreneur local qui organise votre distribution',
    moneyNote: (atCost) =>
      `À ${atCost}, vous couvrez la part de Square Roots, sans la part de votre gestionnaire communautaire. Les paniers gratuits sont couverts par les dons et les commanditaires.`,

    loadingReservation: 'Chargement de votre réservation…',
    reservationLoadError: 'Impossible de charger votre réservation. Réessayez dans un moment.',
    reserveABundle: 'Réserver un panier',
    onWaitlistNotice: 'Vous êtes sur la liste d’attente.',
    allSetNotice: 'C’est fait! Votre panier est réservé.',
    emailedTo: (email) => `Nous avons envoyé les détails à ${email}.`,
    bookmark: 'Ajoutez cette page à vos favoris : elle vous permet de modifier ou d’annuler votre réservation.',
    changesSaved: 'Vos changements sont enregistrés.',
    onWaitlistTitle: 'Vous êtes sur la liste d’attente',
    yourReservation: 'Votre réservation',
    placeInLine: 'Votre place dans la file',
    waitlistExplain: (emailed) =>
      `Si un panier se libère avant la fin des commandes, il vous est réservé automatiquement${emailed ? ' et nous vous écrirons' : ''}. Revenez voir ici quand vous voulez.`,
    deliveryBy: (partner) => `Livraison par ${partner}`,
    deliveryExplain: 'Votre panier sera livré le jour de la distribution. Prévoyez le paiement.',
    pickupCode: 'Votre code de cueillette',
    pickupExplain: 'Montrez-le sur place. Votre gestionnaire communautaire trouvera votre panier.',
    pickedUp: 'Récupéré. Bon appétit!',
    when: 'Quand',
    where: 'Où',
    directions: 'Itinéraire',
    bundlesLabel: 'Paniers',
    giftLabel: 'Don pour quelqu’un',
    thankYou: (amount) => `${amount}. Merci!`,
    payIfSpot: 'À payer si une place se libère',
    includesDelivery: ' (livraison comprise)',
    addToCalendar: 'Ajouter à mon calendrier',
    copyLink: 'Copier le lien de cette page',
    linkCopied: 'Lien copié',
    copyPrompt: 'Copiez ce lien :',
    changeUntil: (when) => `Vous pouvez modifier ou annuler jusqu’au ${when}`,
    changeOrLeave: 'Modifier ou quitter la liste d’attente',
    changeOrCancel: 'Modifier ou annuler',
    changesClosed: 'Les changements sont fermés pour cette distribution. En cas d’imprévu, veuillez ',
    messageSite: (site) => `écrire à Square Roots ${site}`,
    everyDropOn: (site) => `Vous réservez à chaque distribution de ${site}.`,
    everyDropOnExplain: (bundles) => ` À chaque nouvelle distribution, nous réservons ${bundles} pour vous et vous écrivons.`,
    stopEveryDrop: 'Arrêter de réserver à chaque distribution',
    everyDropOffer: (site) => `Vous venez chaque fois? Nous pouvons réserver pour vous à chaque distribution de ${site}.`,
    startEveryDrop: 'Réserver à chaque distribution',
    changeTitleWaitlist: 'Modifier votre place sur la liste d’attente',
    changeTitle: 'Modifier votre réservation',
    noMoreLeft: 'Il ne reste plus de paniers à ajouter pour cette distribution.',
    none: 'Aucun',
    saveChanges: 'Enregistrer',
    neverMind: 'Annuler les changements',
    leaveWaitlistConfirm: 'Quitter la liste d’attente? Vos coordonnées seront supprimées.',
    cancelEveryDropConfirm:
      'Annuler la réservation pour cette distribution? Votre panier ira à la prochaine personne en attente. Vos réservations aux prochaines distributions sont maintenues.',
    cancelConfirm:
      'Annuler votre réservation? Votre panier ira à la prochaine personne en attente, et vos coordonnées seront supprimées.',
    yesLeave: 'Oui, quitter la liste',
    yesCancel: 'Oui, annuler',
    keepIt: 'Garder',
    leaveWaitlist: 'Quitter la liste d’attente',
    cancelMine: 'Annuler ma réservation',
    calendarTitle: (bundles) => `Récupérer ${bundles} chez Square Roots`,
    calendarCode: (code) => `Votre code de cueillette est ${code}.`,

    yourImpact: 'Votre impact',
    impactText: (bundles, pounds) =>
      `Vous avez récupéré ${bundles === 1 ? '1 panier' : `${bundles} paniers`} : ${pounds} lb de bons produits qui n’ont pas été gaspillés. Merci!`,
    howWasIt: 'Comment était votre panier?',
    feedbackGood: 'Très bien',
    feedbackOkay: 'Correct',
    feedbackPoor: 'Pas terrible',
    feedbackComment: 'Quelque chose à nous dire? (facultatif)',
    sendFeedback: 'Envoyer',
    feedbackThanks: 'Merci! Votre gestionnaire communautaire le verra.',
    inYourBundle: 'Dans votre panier',
    notDecidedYet:
      'Nous achetons aux fermes une fois les commandes fermées. Nous saurons ce que contient ce panier quelques jours avant la distribution.',
    about: (lbs) => `environ ${String(lbs).replace('.', ',')} lb`,
    from: 'de',
    seeRecipes: 'Recettes et conseils de conservation',

    bundleTitle: 'Dans le panier',
    bundleLead: 'Des produits déclassés de fermes de la Nouvelle-Écosse : de la bonne nourriture, même si elle n’a pas l’allure parfaite de l’épicerie.',
    nextBundle: (date) => `Prochain panier : ${date}`,
    lastBundle: (date) => `Dernier panier : ${date}`,
    bundleNotYet: 'Nous afficherons le contenu du prochain panier une fois les commandes aux fermes passées.',
    howToStore: 'Conservation',
    ideas: 'Idées',
    moreProduce: 'Autres produits que nous avons souvent',
    bundleMayVary: 'Les quantités sont approximatives : chaque panier est préparé à la main.',
    loading: 'Chargement…',

    homeReserveTitle: 'Réservez votre panier',
    homeNextDrop: (date) => `Prochaine distribution : ${date}`,
    homeReserveBy: (when) => `Payez sur place. Réservez d’ici le ${when}`,
    homeIntro: '10 lb de produits frais de la Nouvelle-Écosse. Réservez à l’avance et payez sur place.',
    homePayWhatWorks: (standard, atCost) => `Payez selon vos moyens : ${standard}, ${atCost} ou gratuit.`,
    homeGifts: (n) => ` Cette année, les dons ont couvert ${n} paniers gratuits.`,
    yourLocation: 'Votre lieu',
    whatsInTheBundle: 'Qu’y a-t-il dans le panier?',
  },
}

const LanguageContext = createContext(null)

function savedLanguage() {
  try {
    const saved = localStorage.getItem('sr-language')
    if (saved && WORDS[saved]) return saved
  } catch {
    // Storage can be blocked; fall back to the browser's language.
  }
  return navigator.language?.startsWith('fr') ? 'fr' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(savedLanguage)

  useEffect(() => {
    try {
      localStorage.setItem('sr-language', lang)
    } catch {
      // Not remembered, but still works.
    }
  }, [lang])

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
}

// Words and date formats in the chosen language: const { t, lang, format } = useLanguage()
export function useLanguage() {
  const { lang, setLang } = useContext(LanguageContext)
  const t = WORDS[lang]
  return { lang, setLang, t, format: formatters(lang, t) }
}

function formatters(lang, t) {
  const locale = LOCALES[lang]
  const day = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const clock = (hhmm) => {
    const [hour, minute] = hhmm.split(':').map(Number)
    if (lang === 'fr') return minute ? `${hour} h ${String(minute).padStart(2, '0')}` : `${hour} h`
    const suffix = hour < 12 ? 'a.m.' : 'p.m.'
    const h = hour % 12 === 0 ? 12 : hour % 12
    return minute ? `${h}:${String(minute).padStart(2, '0')} ${suffix}` : `${h} ${suffix}`
  }
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' })
  return {
    // "Saturday, October 10" / "samedi 10 octobre"
    longDate: (iso) => day(iso).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
    // "11 a.m. to 1 p.m." / "11 h à 13 h"
    timeRange: (start, end) => `${clock(start)} ${t.to} ${clock(end)}`,
    // "Tuesday, October 6 at 5 p.m." / "mardi 6 octobre à 17 h" (Halifax time)
    dateAtTime: (isoDateTime) => {
      const moment = new Date(isoDateTime)
      const date = moment.toLocaleDateString(locale, { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' })
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(moment)
      const hh = parts.find((p) => p.type === 'hour').value
      const mm = parts.find((p) => p.type === 'minute').value
      return `${date} ${t.at} ${clock(`${hh}:${mm}`)}`
    },
    money: (amount) => currency.format(Number(amount)),
    timeLeft: (isoDateTime) => {
      const ms = new Date(isoDateTime) - new Date()
      if (ms <= 0) return t.closed
      const hours = Math.floor(ms / 3_600_000)
      if (hours >= 48) return t.daysLeft(Math.floor(hours / 24))
      if (hours >= 1) return t.hoursLeft(hours)
      return t.lessThanHour
    },
    number: (n) => Number(n).toLocaleString(locale),
  }
}

// "English | Français" switch for the customer pages.
export function LanguageSwitch() {
  const { lang, setLang } = useLanguage()
  useEffect(() => {
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = 'en'
    }
  }, [lang])
  return (
    <div className="language-switch" role="group" aria-label="Language / Langue">
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.code}
          aria-pressed={lang === language.code}
          className={lang === language.code ? 'on' : ''}
          onClick={() => setLang(language.code)}
        >
          {language.name}
        </button>
      ))}
    </div>
  )
}
