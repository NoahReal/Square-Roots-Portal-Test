// What search engines and link previews (Facebook, iMessage…) see for each public page.
// Pages people shouldn't find in search (the partner portal, private reservation links) are marked "noindex".
// The sitemap and robots.txt come from Django (website/views.py), so they know the site's real address.

const DESCRIPTIONS = {
  '/': 'Square Roots is a student-run community interest company in Nova Scotia selling seconds produce from local farms, pay what works for you.',
  '/about': 'How Square Roots connects perfectly healthy produce that grocery stores won’t take to communities across Nova Scotia.',
  '/drop-dates-locations': 'Square Roots drop dates and locations around Nova Scotia, with hours, prices and home delivery.',
  '/reserve': 'Reserve a 10 lb bundle of fresh Nova Scotia produce and pay at the drop: $10, $7.50 or free.',
  '/whats-in-the-bundle': 'What’s in this week’s Square Roots bundle, which farms grew it, and simple ways to store and cook it.',
  '/for-farms': 'Sell your seconds produce to Square Roots: consistent bi-weekly orders for produce that would otherwise go to waste.',
  '/become-a-community-manager': 'Run a Square Roots location in your community and earn from every bundle, with support from our team.',
  '/events': 'Upcoming Square Roots events, like free produce giveaways.',
  '/contact-us': 'Get in touch with the Square Roots team.',
  '/request-a-location': 'No Square Roots location near you? Tell us where you are.',
  '/privacy': 'What Square Roots collects, why, who sees it and how long we keep it.',
}

const DEFAULT_DESCRIPTION = DESCRIPTIONS['/']

function setMeta(attribute, name, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export function updateSearchTags(pathname, title) {
  const isPrivate = pathname.startsWith('/portal') || pathname.startsWith('/reserve/manage')
  const description = DESCRIPTIONS[pathname] ?? DEFAULT_DESCRIPTION
  setMeta('name', 'description', description)
  setMeta('name', 'robots', isPrivate ? 'noindex, nofollow' : 'index, follow')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', window.location.origin + pathname)
}
