/**
 * Client-side SEO helpers for SPA meta tags.
 */

const SITE_NAME = 'tap-na'
const DEFAULT_TITLE = 'tap-na — NFC business cards Namibia | Windhoek'
const DEFAULT_DESCRIPTION =
  'Tap Namibia (tap-na) NFC business cards in Windhoek. Connect business cards, Tap NFC cards, and digital profiles. Once-off purchase. Free delivery in Windhoek.'
const DEFAULT_KEYWORDS = [
  'tap nam',
  'Tap Namibia',
  'Tap na business cards',
  'Tap NFC',
  'Business cards Namibia',
  'Business cards printing',
  'Best business cards shop',
  'business cards',
  'NFC business cards Namibia',
  'Tap na Windhoek',
  'Nap nam nfc',
  'NFC cards',
  'Connect business cards',
  'Tap connect cards',
  'tap-na',
  'tapnam',
  'NFC business cards Windhoek',
  'digital business cards Namibia'
].join(', ')
const DEFAULT_IMAGE = 'https://tapnam.com/profile_image.png'
const DEFAULT_ORIGIN = 'https://tapnam.com'

function ensureMeta(attr, key, content) {
  if (typeof document === 'undefined') return
  const selector = attr === 'property' ? `meta[property="${key}"]` : `meta[name="${key}"]`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function ensureLink(rel, href) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function ensureJsonLd(data) {
  if (typeof document === 'undefined') return
  let el = document.getElementById('tapna-jsonld')
  if (!el) {
    el = document.createElement('script')
    el.id = 'tapna-jsonld'
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function absoluteUrl(path = '/') {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_ORIGIN
  if (/^https?:\/\//i.test(path)) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return `${origin}${p}`
}

/**
 * @param {{ title?: string, description?: string, keywords?: string, path?: string, image?: string, noindex?: boolean }} opts
 */
export function setPageSeo(opts = {}) {
  const title = String(opts.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE
  const description = String(opts.description || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION
  const keywords = String(opts.keywords || DEFAULT_KEYWORDS).trim() || DEFAULT_KEYWORDS
  const path = opts.path || (typeof window !== 'undefined' ? window.location.pathname : '/')
  const url = absoluteUrl(path)
  const image = absoluteUrl(opts.image || DEFAULT_IMAGE)
  const robots = opts.noindex ? 'noindex, nofollow' : 'index, follow'

  if (typeof document !== 'undefined') {
    document.title = title
  }

  ensureMeta('name', 'description', description)
  ensureMeta('name', 'keywords', keywords)
  ensureMeta('name', 'robots', robots)
  ensureMeta('name', 'theme-color', '#0a0a0a')
  ensureMeta('name', 'geo.region', 'NA-WH')
  ensureMeta('name', 'geo.placename', 'Windhoek')
  ensureMeta('name', 'geo.position', '-22.5609;17.0658')
  ensureMeta('name', 'ICBM', '-22.5609, 17.0658')
  ensureMeta('property', 'og:locale', 'en_NA')
  ensureMeta('property', 'og:type', 'website')
  ensureMeta('property', 'og:site_name', SITE_NAME)
  ensureMeta('property', 'og:title', title)
  ensureMeta('property', 'og:description', description)
  ensureMeta('property', 'og:url', url)
  ensureMeta('property', 'og:image', image)
  ensureMeta('property', 'og:image:secure_url', image)
  ensureMeta('property', 'og:image:alt', title)
  ensureMeta('name', 'twitter:card', 'summary_large_image')
  ensureMeta('name', 'twitter:title', title)
  ensureMeta('name', 'twitter:description', description)
  ensureMeta('name', 'twitter:image', image)
  ensureLink('canonical', url)

  if (!opts.noindex) {
    ensureJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'LocalBusiness',
          '@id': `${DEFAULT_ORIGIN}/#business`,
          name: 'tap-na',
          alternateName: [
            'Tap Namibia',
            'Tap Nam',
            'Tap Na',
            'Tap NFC',
            'tapnam',
            'Nap nam nfc'
          ],
          url: DEFAULT_ORIGIN,
          image,
          description,
          keywords,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Windhoek',
            addressCountry: 'NA'
          },
          areaServed: [
            { '@type': 'City', name: 'Windhoek' },
            { '@type': 'Country', name: 'Namibia' }
          ]
        },
        {
          '@type': 'WebSite',
          '@id': `${DEFAULT_ORIGIN}/#website`,
          name: 'tap-na',
          alternateName: ['Tap Namibia', 'Tap Nam', 'tapnam.com'],
          url: DEFAULT_ORIGIN,
          description,
          publisher: { '@id': `${DEFAULT_ORIGIN}/#business` }
        },
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: title,
          description,
          isPartOf: { '@id': `${DEFAULT_ORIGIN}/#website` }
        }
      ]
    })
  }
}

export const ROUTE_SEO = {
  home: {
    title: 'tap-na — NFC business cards Namibia | Windhoek',
    description:
      'Tap Namibia (tap-na) is the NFC business cards shop in Windhoek. Buy Connect business cards, Tap NFC cards, and digital profiles. Once-off. Free delivery in Windhoek.',
    image: '/profile_image.png'
  },
  'venue-display': {
    title: 'Venue Display NFC cards — tap-na Windhoek',
    description:
      'NFC Venue Display cards in Namibia for restaurants and businesses. Menus, reviews, Wi-Fi, and guest check-in — tap once at the table. Free Windhoek delivery.'
  },
  'team-package': {
    title: 'Connect Teams business cards — tap-na Namibia',
    description:
      'Connect business cards for teams in Namibia. Combine Business and Executive Tap NFC cards. Once-off purchase. Free delivery in Windhoek.'
  },
  cart: {
    title: 'Cart — tap-na NFC business cards',
    description: 'Review your Tap Namibia Connect card order. NFC business cards and Tap connect cards for Windhoek delivery.'
  },
  'shop-product': {
    title: 'NFC Connect card — tap-na Namibia',
    description:
      'NFC business cards Namibia. Connect business cards and Tap NFC card details, features, and pricing from tap-na Windhoek.'
  },
  'about-business-cards': {
    title: 'NFC business cards Namibia — How Connect cards work',
    description:
      'How Tap Namibia NFC Connect cards work: claim, tap to share, catalogue, meetings, and teams. Business cards printing and once-off pricing. Free Windhoek delivery.'
  },
  support: {
    title: 'Support — Tap na Windhoek',
    description:
      'Contact Tap Namibia (tap-na) in Windhoek. Help with NFC business cards, Connect cards, Tap NFC orders, and digital profiles.'
  },
  about: {
    title: 'About Tap Namibia — tap-na NFC business cards',
    description:
      'Tap Namibia (tap-na) makes NFC business cards, Connect business cards, and digital profiles in Windhoek. The NFC cards shop for Namibia.'
  },
  login: {
    title: 'Login — tap-na',
    description: 'Sign in to your Tap-Na profile.',
    noindex: true
  },
  signup: {
    title: 'Sign up — tap-na',
    description: 'Create your Tap-Na account and claim your Connect card.',
    noindex: true
  }
}

export { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, DEFAULT_TITLE, SITE_NAME }