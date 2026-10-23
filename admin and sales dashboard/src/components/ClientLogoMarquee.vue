<script setup>
const CLIENTS = [
  { src: '/clients/Akulyanga.png', alt: 'Akulyanga' },
  { src: '/clients/NaSIA.png', alt: 'NaSIA' },
  { src: '/clients/cchub.png', alt: 'CCHub' },
  { src: '/clients/Cash Crusaders.png', alt: 'Cash Crusaders' },
  { src: '/clients/nestaudio.png', alt: 'Nest Audio' },
  { src: '/clients/whk law.png', alt: 'WKH Law' },
  { src: '/clients/indongo.png', alt: 'Indongo Auto' }
]
</script>

<template>
  <div class="client-marquee bg-surface-charcoal rounded-xl py-6 md:py-7" aria-label="Our Happy Clients">
    <p class="font-label-caps text-[10px] uppercase tracking-widest text-on-primary/50 text-center mb-5 px-4">
      Our Happy Clients
    </p>
    <div class="client-marquee__viewport">
      <div class="client-marquee__track">
        <div
          v-for="copy in 2"
          :key="copy"
          class="client-marquee__group"
          :aria-hidden="copy > 1 ? 'true' : undefined"
        >
          <img
            v-for="client in CLIENTS"
            :key="`${copy}-${client.src}`"
            :src="client.src"
            :alt="copy === 1 ? client.alt : ''"
            class="client-marquee__logo"
            decoding="async"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.client-marquee__viewport {
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}

.client-marquee__track {
  display: flex;
  width: max-content;
  animation: client-marquee 28s linear infinite;
}

.client-marquee:hover .client-marquee__track {
  animation-play-state: paused;
}

.client-marquee__group {
  display: flex;
  align-items: center;
  gap: 3rem;
  padding-inline: 1.5rem;
}

.client-marquee__logo {
  height: 40px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
  opacity: 0.88;
}

@keyframes client-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .client-marquee__track {
    animation: none;
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .client-marquee__group:nth-child(n + 2) {
    display: none;
  }

  .client-marquee__group {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem 2rem;
    padding-inline: 1rem;
  }
}
</style>
