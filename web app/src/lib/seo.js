/**
 * Client-side SEO helpers for SPA meta tags.
 */

const SITE_NAME = 'tap-na'
const DEFAULT_TITLE = 'tap-na — NFC business cards & digital profiles'
const DEFAULT_DESCRIPTION =
  'NFC Connect business cards for professionals and teams. Tap once to share your live digital profile, catalogue, and meeting booking. Once-off purchase. Free delivery in Windhoek.'
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
 * @param {{ title?: string, description?: string, path?: string, image?: string, noindex?: boolean }} opts
 */
export function setPageSeo(opts = {}) {
  const title = String(opts.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE
  const description = String(opts.description || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION
  const path = opts.path || (typeof window !== 'undefined' ? window.location.pathname : '/')
  const url = absoluteUrl(path)
  const image = absoluteUrl(opts.image || DEFAULT_IMAGE)
  const robots = opts.noindex ? 'noindex, nofollow' : 'index, follow'

  if (typeof document !== 'undefined') {
    document.title = title
  }

  ensureMeta('name', 'description', description)
  ensureMeta('name', 'robots', robots)
  ensureMeta('name', 'theme-color', '#0a0a0a')
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
}

export const ROUTE_SEO = {
  home: {
    title: 'tap-na — NFC Connect business cards',
    description:
      'Shop NFC Connect business cards for professionals and teams. Professional, Business, and Executive classes. Once-off purchase. Free delivery in Windhoek in 1-3 working days.',
    image: '/profile_image.png'
  },
  'venue-display': {
    title: 'Venue Display — tap-na',
    description:
      'NFC Venue Display cards for restaurants and businesses. Menus, reviews, Wi-Fi, and guest check-in — tap once at the table.'
  },
  'team-package': {
    title: 'Connect Teamss package — tap-na',
    description:
      'Combine Business and Executive Connect cards. Business alone max 10. Cards 11–15 must be Executive, then free mix. Subdomain from 5 Executive.'
  },
  cart: {
    title: 'Cart — tap-na',
    description: 'Review your Tap-Na Connect card order and request a quote.'
  },
  'shop-product': {
    title: 'Product — tap-na',
    description: 'NFC Connect business card details, features, and pricing on tap-na.'
  },
  'about-business-cards': {
    title: 'About Connect Cards — tap-na',
    description:
      'How Tap-Na NFC Connect cards work: claim, tap to share, catalogue, meetings, teams, and once-off pricing. Free Windhoek delivery.'
  },
  support: {
    title: 'Support — tap-na',
    description:
      'Contact Tap-Na support by form, WhatsApp, or email. Help with NFC Connect cards, orders, and profiles.'
  },
  about: {
    title: 'About Us — tap-na',
    description: 'Tap-Na makes NFC business cards and digital profiles for smarter networking.'
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

export { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME }