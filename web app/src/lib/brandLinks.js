/**
 * Public tap-na brand contact + social links (storefront).
 * LinkedIn uses the public company page (not the admin dashboard URL).
 */

export const BRAND_WHATSAPP = '+264858117337'
export const BRAND_WHATSAPP_DISPLAY = '+264 85 811 7337'
export const BRAND_WHATSAPP_HREF = 'https://wa.me/' + BRAND_WHATSAPP.replace(/\D/g, '')

export const BRAND_INSTAGRAM_HREF = 'https://www.instagram.com/tap._.na/'
export const BRAND_LINKEDIN_HREF = 'https://www.linkedin.com/company/139594221/'
export const BRAND_FACEBOOK_HREF = 'https://www.facebook.com/share/1Dakgiswr6/'

export const BRAND_SOCIAL_LINKS = [
  { id: 'instagram', label: 'Instagram', href: BRAND_INSTAGRAM_HREF, icon: 'photo_camera' },
  { id: 'linkedin', label: 'LinkedIn', href: BRAND_LINKEDIN_HREF, icon: 'work' },
  { id: 'facebook', label: 'Facebook', href: BRAND_FACEBOOK_HREF, icon: 'public' },
  { id: 'whatsapp', label: 'WhatsApp', href: BRAND_WHATSAPP_HREF, icon: 'chat' }
]
