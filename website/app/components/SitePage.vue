<script setup lang="ts">
import { CATALOGS } from '~/data/catalogs';
import { LANGS } from '~/data/language';
import { SITE, imageOf, pageUrl } from '~/data/site';

// The whole page, in the language of its address. A page never changes language (the other one is another
// address), so these are read once.
const { lang, text } = useLang();
const { meta } = text.value;
const other = LANGS.find((l) => l.code !== lang.value)!.code;
const image = `${SITE}${imageOf(lang.value, 'poster.jpg')}`;

useSeoMeta({
  title: meta.title,
  description: meta.description,
  ogTitle: meta.title,
  ogDescription: meta.description,
  ogType: 'website',
  ogUrl: pageUrl(lang.value),
  ogImage: image,
  ogSiteName: 'Escouade',
  ogLocale: meta.locale,
  ogLocaleAlternate: CATALOGS[other].meta.locale,
  twitterCard: 'summary_large_image',
  twitterTitle: meta.title,
  twitterDescription: meta.description,
  twitterImage: image,
});

// Each page names itself the one to index and points to the other version; the French root is the default
// for a visitor whose language neither covers.
useHead({
  htmlAttrs: { lang: lang.value },
  link: [
    { rel: 'canonical', href: pageUrl(lang.value) },
    ...LANGS.map((l) => ({ rel: 'alternate' as const, hreflang: l.code, href: pageUrl(l.code) })),
    { rel: 'alternate', hreflang: 'x-default', href: pageUrl('fr') },
  ],
});
</script>

<template>
  <SiteHeader />
  <main>
    <HeroSection />
    <VideoSection />
    <FeatureGrid />
    <InstallSteps />
    <RoadmapSection />
    <FaqSection />
    <CloseSection />
  </main>
  <SiteFooter />
</template>
