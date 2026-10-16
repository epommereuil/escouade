<script setup lang="ts">
import { fmt } from '~/data/catalog';
import { CHANGELOG, DOWNLOAD, FEATURE_SHOTS, HERO_SHOT, REPO, imageOf } from '~/data/site';

const { lang, text } = useLang();
const asset = useAsset();
const { version } = useRuntimeConfig().public;
// The hero shows one of the features' screenshots whole: the code an agent changed, under review.
const shot = computed(() => text.value.features.items[HERO_SHOT]);
const file = FEATURE_SHOTS.find((s) => s.id === HERO_SHOT)!.file;
</script>

<template>
  <section id="top" class="hero">
    <div class="copy">
      <a class="pill" :href="CHANGELOG"><i aria-hidden="true" />{{ fmt(text.hero.meta, { version }) }}</a>
      <h1>
        <span class="line">{{ text.hero.line1 }}</span>
        <span class="line second">{{ text.hero.line2 }}</span>
      </h1>
      <p class="lede">{{ text.hero.lede }}</p>
      <div class="cta">
        <a class="btn primary" :href="DOWNLOAD">{{ text.hero.download }}</a>
        <a class="btn" :href="REPO">{{ text.hero.github }}</a>
      </div>
    </div>
    <div class="product">
      <div class="glow" aria-hidden="true" />
      <AppWindow class="frame" :src="asset(imageOf(lang, file))" :alt="shot.alt" />
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  /* The light behind the app spreads wider than the page: it stops at its edges. */
  overflow-x: clip;
  padding: clamp(56px, 8vh, 88px) var(--gutter) 0;
  text-align: center;
}
.copy {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-height: 32px;
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.3;
  transition:
    border-color 0.2s var(--ease),
    color 0.2s var(--ease);
}
.pill:hover {
  border-color: var(--line-strong);
  color: var(--text);
}
.pill i {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}
h1 {
  margin-top: 24px;
  font-size: clamp(42px, 5.4vw, 78px);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.045em;
  text-wrap: balance;
}
.line {
  display: block;
}
.second {
  color: var(--muted);
}
.lede {
  max-width: 640px;
  margin-top: 24px;
  color: var(--muted);
  font-size: clamp(17px, 1.4vw, 19.5px);
  line-height: 1.55;
  text-wrap: pretty;
}
.cta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 34px;
}

/* The app itself, large, with Escouade's light behind it. */
.product {
  position: relative;
  width: min(1180px, 100%);
  margin: clamp(48px, 7vh, 64px) auto 0;
}
.frame {
  position: relative;
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 40px 120px -20px color-mix(in srgb, var(--brand) 24%, transparent),
    0 30px 60px -30px rgba(0, 0, 0, 0.9);
}
.glow {
  position: absolute;
  inset: 30% -6% -10%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 20%, transparent), transparent);
  filter: blur(24px);
}

/* One entrance, when the page opens: the words, then the app rising into place. */
@media (prefers-reduced-motion: no-preference) {
  .copy > * {
    animation: rise 0.9s var(--ease) both;
  }
  .copy > :nth-child(2) {
    animation-delay: 0.06s;
  }
  .copy > :nth-child(3) {
    animation-delay: 0.12s;
  }
  .copy > :nth-child(4) {
    animation-delay: 0.18s;
  }
  .product {
    animation: lift 1.4s var(--ease) 0.28s both;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(6px);
  }
}
@keyframes lift {
  from {
    opacity: 0;
    transform: translateY(48px) scale(0.98);
  }
}
</style>
