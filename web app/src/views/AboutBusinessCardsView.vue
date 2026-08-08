<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ShopHeader from '../components/ShopHeader.vue'
import ShopBottomNav from '../components/ShopBottomNav.vue'

const router = useRouter()
const menuOpen = ref(false)

function shopAll() {
  menuOpen.value = false
  router.push({ path: '/', hash: '#business-cards' })
}

onMounted(() => {
  document.title = 'About Connect Cards — tap-na'
  document.documentElement.classList.add('shop-home')
})

onUnmounted(() => {
  document.documentElement.classList.remove('shop-home')
})
</script>

<template>
  <div class="shop-page bg-surface text-on-surface font-body-md text-body-md min-h-screen">
    <ShopHeader
      :menu-open="menuOpen"
      @toggle-menu="menuOpen = !menuOpen"
      @close-menu="menuOpen = false"
      @shop-all="shopAll"
    />

    <main class="pt-16 min-h-screen bg-surface pb-24 md:pb-10">
      <div class="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-10 flex flex-col gap-14">
        <!-- Hero -->
        <header class="flex flex-col gap-4">
          <p class="font-label-caps text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Tap-Na Connect
          </p>
          <h1 class="font-headline-lg-mobile md:font-headline-lg text-[36px] md:text-[48px] leading-[1.1] font-semibold tracking-[-0.02em]">
            The only business card you’ll ever need.
          </h1>
          <p class="text-on-surface-variant text-base leading-relaxed max-w-2xl">
            At Tap-Na we believe every professional should carry one smart card. Tap once — your live
            digital profile opens. No app for visitors. No monthly fees. Once-off purchase.
          </p>
          <div class="flex flex-wrap gap-3 mt-2">
            <button
              type="button"
              class="bg-primary text-on-primary px-8 py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
              @click="shopAll"
            >
              Shop cards
            </button>
            <a
              href="#how-to-claim"
              class="border border-primary text-primary px-8 py-4 font-button-text uppercase tracking-widest no-underline hover:bg-primary hover:text-on-primary transition-colors"
            >
              How to claim
            </a>
          </div>
        </header>

        <!-- Why -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Why Connect cards?</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <p class="text-on-surface-variant leading-relaxed">
            Paper cards get lost, go out of date, and keep costing you reprints. Connect cards are
            durable like a bank card, update online anytime, and share more than a name — catalogue,
            meetings, and your whole brand story.
          </p>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">payments</span>
              <div>
                <p class="font-medium text-sm">Once-off purchase</p>
                <p class="text-xs text-on-surface-variant mt-1">No subscriptions or hidden platform fees — just the card.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">update</span>
              <div>
                <p class="font-medium text-sm">Never reprint for updates</p>
                <p class="text-xs text-on-surface-variant mt-1">Change title, number, or links online. Same plastic works.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">local_shipping</span>
              <div>
                <p class="font-medium text-sm">Free Windhoek delivery</p>
                <p class="text-xs text-on-surface-variant mt-1">Order online. Made to order. Typically 1–3 working days.</p>
              </div>
            </li>
            <li class="bg-surface-container rounded-xl p-4 flex gap-3">
              <span class="material-symbols-outlined text-primary shrink-0">replay</span>
              <div>
                <p class="font-medium text-sm">Lost a card?</p>
                <p class="text-xs text-on-surface-variant mt-1">Order a replacement online and claim the new card.</p>
              </div>
            </li>
          </ul>
        </section>

        <!-- How it works -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">How the cards work</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ol class="space-y-4">
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">1</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Each card has an <strong class="text-on-surface">NFC chip</strong> (and usually a QR backup). The chip holds a unique link — not your personal data.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">2</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Someone <strong class="text-on-surface">taps</strong> the card to a phone (or scans the QR).
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">3</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Their browser opens your <strong class="text-on-surface">live Tap-Na profile</strong> — always the latest version.
              </p>
            </li>
          </ol>
        </section>

        <!-- How to use -->
        <section id="how-to-use" class="flex flex-col gap-5 scroll-mt-24">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">How to use your card</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ol class="space-y-4">
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-caps text-xs shrink-0">1</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">Carry your Connect card — one is enough.</p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-caps text-xs shrink-0">2</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Meet someone, smile, introduce yourself, then offer: <em>“Here’s my card — just tap it to your phone.”</em>
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-caps text-xs shrink-0">3</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Hold the card near the top or back of their phone (NFC). No NFC? Let them scan the QR.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-label-caps text-xs shrink-0">4</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Their phone opens your profile. They can save your contact, open links, browse your catalogue, or book a meeting.
              </p>
            </li>
          </ol>
        </section>

        <!-- How to claim -->
        <section id="how-to-claim" class="flex flex-col gap-5 scroll-mt-24">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">How to claim a card</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            New cards arrive unclaimed. Claiming links that physical card to your account and profile.
          </p>
          <ol class="space-y-4">
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">1</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Order online. We deliver free in Windhoek in about <strong class="text-on-surface">1–3 working days</strong>.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">2</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Tap the card with your phone (or scan the QR on the card).
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">3</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                You’ll see the <strong class="text-on-surface">claim</strong> screen for that unique card code.
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">4</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Enter your name and create your login (email + password).
              </p>
            </li>
            <li class="flex gap-4">
              <span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-caps text-xs shrink-0">5</span>
              <p class="text-sm text-on-surface-variant leading-relaxed pt-1">
                Finish your profile — photo, role, links, catalogue, meetings — then you’re live. Every future tap opens your profile.
              </p>
            </li>
          </ol>
        </section>

        <!-- What it can hold -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">What your card can hold</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            The plastic only points to your profile. The profile can hold a full professional presence:
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="bg-surface-container rounded-xl p-4">
              <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted mb-2">Identity</p>
              <ul class="text-sm text-on-surface-variant space-y-1.5">
                <li>Name &amp; photo</li>
                <li>Job title / role</li>
                <li>Company name</li>
                <li>Profile video (optional)</li>
              </ul>
            </div>
            <div class="bg-surface-container rounded-xl p-4">
              <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted mb-2">Contact</p>
              <ul class="text-sm text-on-surface-variant space-y-1.5">
                <li>Phone &amp; email</li>
                <li>WhatsApp</li>
                <li>LinkedIn</li>
                <li>Instagram, TikTok, website</li>
              </ul>
            </div>
            <div class="bg-surface-container rounded-xl p-4">
              <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted mb-2">Business tools</p>
              <ul class="text-sm text-on-surface-variant space-y-1.5">
                <li>Products &amp; services catalogue</li>
                <li>Prices, images, PDFs &amp; links</li>
                <li>Book a meeting</li>
                <li>Share profile / QR</li>
                <li>Save contact (vCard)</li>
              </ul>
            </div>
            <div class="bg-surface-container rounded-xl p-4">
              <p class="font-label-caps text-[10px] uppercase tracking-widest text-ink-muted mb-2">Team (Business &amp; Executive)</p>
              <ul class="text-sm text-on-surface-variant space-y-1.5">
                <li>Team member profiles</li>
                <li>Shared catalogue</li>
                <li>Owner can block a member’s card</li>
                <li>Company branding / subdomain (Executive)</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Classes -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Three classes</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="flex flex-col gap-4">
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Professional Class</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-surface-container px-2 py-1">Solo</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                For solopreneurs, consultants, and freelancers. Catalogue and meeting booking on a durable cobalt-blue card.
                <strong class="text-on-surface"> Not customisable</strong> — standard Professional finish. Min 1.
              </p>
            </article>
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Business Class</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-primary text-on-primary px-2 py-1">Best Seller</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                For teams of about 5–10. Meeting booking, shared catalogue, team profiles, and company logo in black &amp; white (charcoal card).
              </p>
            </article>
            <article class="border border-border-subtle rounded-xl p-5 flex flex-col gap-2">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold text-lg">Executive Class</h3>
                <span class="font-label-caps text-[10px] uppercase tracking-widest bg-surface-charcoal text-on-primary px-2 py-1">Executive</span>
              </div>
              <p class="text-sm text-on-surface-variant leading-relaxed">
                Matte black flagship for leaders and larger teams (5–20+). Colour company logo, fuller team tools, and a company subdomain
                such as <strong class="text-on-surface">cards.company.com</strong>. Business Class cards on the same team can also load onto that subdomain.
              </p>
            </article>
          </div>
        </section>

        <!-- Feature matrix -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Feature matrix</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="overflow-x-auto -mx-1 px-1">
            <table class="w-full min-w-[520px] text-left text-sm border-collapse">
              <thead>
                <tr class="border-b border-border-subtle">
                  <th class="py-3 pr-3 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium">Feature</th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">Pro</th>
                  <th class="py-3 px-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">Business</th>
                  <th class="py-3 pl-2 font-label-caps text-[10px] uppercase tracking-widest text-ink-muted font-medium text-center">Executive</th>
                </tr>
              </thead>
              <tbody class="text-on-surface-variant">
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">NFC + QR → live profile</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">Once-off (no monthly fee)</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">Catalogue &amp; book meeting</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">Custom logo on card</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-primary">B&amp;W</td>
                  <td class="py-3 pl-2 text-center text-primary">Colour</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">Team + owner can block member</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-primary">✓</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr class="border-b border-border-subtle/70">
                  <td class="py-3 pr-3">Subdomain (e.g. cards.company.com)</td>
                  <td class="py-3 px-2 text-center">—</td>
                  <td class="py-3 px-2 text-center text-xs">via Exec team</td>
                  <td class="py-3 pl-2 text-center text-primary">✓</td>
                </tr>
                <tr>
                  <td class="py-3 pr-3">Suggested size</td>
                  <td class="py-3 px-2 text-center text-xs">1+</td>
                  <td class="py-3 px-2 text-center text-xs">5–10</td>
                  <td class="py-3 pl-2 text-center text-xs">5–20+</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Teams -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Teams</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            Business and Executive cards sit under one organisation. Each person claims their own card;
            the <strong class="text-on-surface">team owner</strong> keeps control of the group.
          </p>
          <div class="bg-surface-container rounded-xl p-5 space-y-3">
            <p class="font-medium text-sm">Owner can block a member’s card</p>
            <p class="text-sm text-on-surface-variant leading-relaxed">
              If someone leaves or shouldn’t represent the company, the owner can block that card so taps
              no longer show an active company profile for them — without reprinting the rest of the team.
            </p>
          </div>
          <div class="bg-surface-container rounded-xl p-5 space-y-3">
            <p class="font-medium text-sm">Executive subdomain for the whole team</p>
            <p class="text-sm text-on-surface-variant leading-relaxed">
              Executive unlocks a branded host such as <strong class="text-on-surface">cards.company.com</strong>.
              If the team also has Business Class cards, those profiles can load onto the same custom subdomain.
            </p>
          </div>
        </section>

        <!-- Money -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">How you save money</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ul class="space-y-2 text-sm text-on-surface-variant leading-relaxed list-disc pl-5">
            <li>Stop reprinting when titles, numbers, or branding change.</li>
            <li>One durable card instead of stacks of paper that expire.</li>
            <li>Once-off price — no monthly rent on the card itself.</li>
            <li>Lost card? Replace that one — not a full print run.</li>
            <li>Catalogue and meetings replace extra print flyers and “call me” follow-ups.</li>
          </ul>
          <p class="text-sm text-on-surface font-medium">
            If you don’t switch, you keep investing money and time in printing traditional business cards.
          </p>
        </section>

        <!-- Order -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">Ordering &amp; delivery</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <ul class="space-y-2 text-sm text-on-surface-variant leading-relaxed">
            <li>• Fully online store — order on tapnam.com</li>
            <li>• Cards made to order</li>
            <li>• Free delivery in Windhoek</li>
            <li>• Typical delivery: 1–3 working days</li>
            <li>• Quote when you want to order; invoice after payment / delivery as agreed with sales</li>
          </ul>
        </section>

        <!-- FAQ -->
        <section class="flex flex-col gap-5">
          <div class="flex flex-col gap-1">
            <h2 class="font-headline-lg-mobile text-[24px] uppercase font-semibold">FAQ</h2>
            <div class="h-1 w-12 bg-primary" />
          </div>
          <div class="space-y-4">
            <div>
              <p class="font-medium text-sm">Are there other fees after I buy?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                No. The card is a once-off purchase. Order a replacement only if a card is lost or damaged.
              </p>
            </div>
            <div>
              <p class="font-medium text-sm">Can I customise Professional Class?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                No — Professional is a standard, non-customisable finish. Choose Business or Executive for company logo branding.
              </p>
            </div>
            <div>
              <p class="font-medium text-sm">What if a phone has no NFC?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">Use the QR code on the card.</p>
            </div>
            <div>
              <p class="font-medium text-sm">Who else uses Tap-Na?</p>
              <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">
                We don’t disclose client names for privacy and security.
              </p>
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="bg-surface-charcoal text-on-primary rounded-xl p-8 flex flex-col gap-4">
          <h2 class="text-2xl font-semibold leading-tight">Ready to carry only one card?</h2>
          <p class="text-on-primary/70 text-sm leading-relaxed">
            See the packages, pick your class, and order online.
          </p>
          <button
            type="button"
            class="self-start bg-surface-container-lowest text-primary px-8 py-4 font-button-text uppercase tracking-widest hover:opacity-90 transition-opacity"
            @click="shopAll"
          >
            View packages
          </button>
        </section>

        <p class="text-center">
          <RouterLink to="/about" class="text-sm text-ink-muted no-underline hover:text-primary">
            About Tap-Na
          </RouterLink>
        </p>
      </div>
    </main>

    <ShopBottomNav />
  </div>
</template>

<style>
html.shop-home,
html.shop-home body {
  background-color: #f9f9f9 !important;
  color: #1a1c1c;
}
</style>
