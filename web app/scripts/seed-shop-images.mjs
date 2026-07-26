/**
 * Upload shop product images to Supabase Storage and print public URLs.
 * Usage (from web app/): node scripts/seed-shop-images.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SUPABASE_URL = 'https://mjfkthjxqvedqhpemxmt.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmt0aGp4cXZlZHFocGVteG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODQyNjAsImV4cCI6MjEwMDU2MDI2MH0._Zfy8xSgkdfJ6_pgeSk0ncy4knE1iFWAvZqHW1Texyc'
const BUCKET = 'shop'

const PRODUCTS = [
  {
    id: 'blue-card',
    name: 'Blue Business Card',
    price: 49.99,
    description: 'Premium NFC business card in cobalt blue.',
    alt: 'Blue NFC business card',
    section: 'business-cards',
    label: 'Cobalt Blue',
    badge: '',
    sort_order: 1,
    file: 'public/images/blue-card.png',
    object: 'products/blue-card.png',
  },
  {
    id: 'black-card',
    name: 'Black Business Card',
    price: 49.99,
    description: 'Premium NFC business card in matte black.',
    alt: 'Black NFC business card',
    section: 'business-cards',
    label: 'Matte Black',
    badge: '',
    sort_order: 2,
    file: 'public/images/black-card.png',
    object: 'products/black-card.png',
  },
  {
    id: 'black-card-front',
    name: 'Black Card Front',
    price: 49.99,
    description: 'Matte black NFC business card - front design.',
    alt: 'Black NFC business card front',
    section: 'business-cards',
    label: 'Black Front',
    badge: '',
    sort_order: 3,
    file: 'public/images/business-card-black-front.png',
    object: 'products/business-card-black-front.png',
  },
  {
    id: 'standard-menu',
    name: 'Standard Menu',
    price: 34.99,
    description: 'Tap phone to view menu - for restaurants & cafes.',
    alt: 'Standard Menu',
    section: 'table-brochure',
    label: '',
    badge: 'Best Seller',
    sort_order: 1,
    file: 'public/images/table/NFC - Menu.png',
    object: 'products/nfc-menu.png',
  },
  {
    id: 'custom-menu',
    name: 'Custom Menu',
    price: 39.99,
    description: 'Branded custom menu design for your venue.',
    alt: 'Custom Menu',
    section: 'table-brochure',
    label: '',
    badge: '',
    sort_order: 2,
    file: 'public/images/table/NFC custom menu card.png',
    object: 'products/nfc-custom-menu.png',
  },
  {
    id: 'info-card',
    name: 'Tap for Information',
    price: 24.99,
    description: 'Share business info, contact & socials in one tap.',
    alt: 'Business Information',
    section: 'table-brochure',
    label: '',
    badge: '',
    sort_order: 3,
    file: 'public/images/table/NFC business info card.png',
    object: 'products/nfc-business-info.png',
  },
  {
    id: 'review-google',
    name: 'Review us on Google',
    price: 29.99,
    description: 'Tap to leave a Google review in seconds.',
    alt: 'Google Review',
    section: 'table-brochure',
    label: '',
    badge: '',
    sort_order: 4,
    file: 'public/images/table/NFC business review card.png',
    object: 'products/nfc-business-review.png',
  },
  {
    id: 'wifi-connect',
    name: 'Tap to Connect WiFi',
    price: 29.99,
    description: 'Guests connect to WiFi and contact details instantly.',
    alt: 'WiFi and Contact',
    section: 'table-brochure',
    label: '',
    badge: '',
    sort_order: 5,
    file: 'public/images/table/NFC wifi and conact card.png',
    object: 'products/nfc-wifi-contact.png',
  },
]

function publicUrl(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${objectPath}`
}

async function uploadObject(objectPath, filePath) {
  const bytes = fs.readFileSync(filePath)
  const lower = filePath.toLowerCase()
  const contentType =
    lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${objectPath}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Upload failed ${objectPath}: ${res.status} ${text}`)
  }
  return publicUrl(objectPath)
}

async function main() {
  const results = []
  for (const product of PRODUCTS) {
    const abs = path.join(ROOT, product.file)
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing file: ${abs}`)
    }
    console.log(`Uploading ${product.id}...`)
    const imageUrl = await uploadObject(product.object, abs)
    results.push({
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description,
      image_path: product.object,
      image_url: imageUrl,
      alt: product.alt,
      section: product.section,
      badge: product.badge,
      label: product.label,
      sort_order: product.sort_order,
      active: true,
    })
    console.log(`  -> ${imageUrl}`)
  }
  const out = path.join(__dirname, 'shop-seed-result.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`Wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})