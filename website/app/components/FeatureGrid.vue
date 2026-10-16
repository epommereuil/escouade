<script setup lang="ts">
import { featuresFor } from '~/data/catalogs';
import { FOCUS } from '~/data/shots';
import { STAGES, type FeatureId } from '~/data/site';

// The features as the chapters of the cycle, from planning to steering the squad: each step with its tiles of
// unequal sizes, a close-up of the app on what each one is about, and what else it holds, one line each. The
// demonstration closes the last step, steering, which it proves; then what else the app does.

const { lang, text } = useLang();
const features = featuresFor(lang.value);
const asset = useAsset();

/** How wide each tile is, on twelve columns: each step's tiles fill their rows. */
const SPAN: Record<FeatureId, number> = {
  tableau: 7,
  integrations: 5,
  agents: 7,
  chat: 5,
  editeur: 12,
  git: 4,
  test: 4,
  lancement: 4,
  notifications: 4,
  stats: 4,
  remote: 4,
};
const stages = STAGES.map((id, i) => ({
  id,
  number: String(i + 1).padStart(2, '0'),
  ...text.value.features.stages[id],
  tiles: features.filter((f) => f.stage === id),
}));

const look = (id: FeatureId) => {
  const f = FOCUS[id];
  return { objectPosition: `${f.x}% ${f.y}%`, transformOrigin: `${f.x}% ${f.y}%`, transform: `scale(${f.zoom})` };
};
</script>

<template>
  <section :id="text.anchors.features" class="section">
    <div class="wrap">
      <h2 class="title">
        {{ text.features.title }} <span class="more">{{ text.features.lead }}</span>
      </h2>
      <ol class="cycle">
        <li v-for="s in stages" :key="s.id">
          <b>{{ s.number }}</b
          >{{ s.title }}
        </li>
      </ol>
      <div v-for="s in stages" :key="s.id" class="stage" :class="s.id">
        <div class="head">
          <h3>
            <b>{{ s.number }}</b
            >{{ s.title }}
          </h3>
          <p>{{ s.text }}</p>
        </div>
        <div v-if="s.tiles.length" class="grid">
          <article v-for="f in s.tiles" :key="f.id" class="tile" :class="[`span-${SPAN[f.id]}`, f.id]">
            <div class="words">
              <h4>{{ f.title }}</h4>
              <p>{{ f.text }}</p>
            </div>
            <div class="media">
              <img :src="asset(f.image)" :alt="f.alt" width="1920" height="960" loading="lazy" decoding="async" :style="look(f.id)" />
            </div>
          </article>
        </div>
        <ul class="points" :class="{ alone: !s.tiles.length }">
          <li v-for="p in s.points" :key="p.title">
            <h4>{{ p.title }}</h4>
            <p>{{ p.text }}</p>
          </li>
        </ul>
      </div>
    </div>
    <SignalSection />
    <div class="wrap">
      <ul class="more-list">
        <li v-for="c in text.cards" :key="c.title">
          <h4>{{ c.title }}</h4>
          <p>{{ c.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* The cycle at a glance, under the title: the five steps the chapters then tell one by one. */
.cycle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}
.cycle li {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 500;
}
.cycle b,
.head b {
  color: var(--brand);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cycle b {
  font-size: 12.5px;
}

.stage {
  margin-top: clamp(72px, 9vw, 112px);
}
.head {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  align-items: baseline;
  gap: 16px 40px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}
.head h3 {
  display: flex;
  align-items: baseline;
  gap: 14px;
  font-size: clamp(26px, 2.6vw, 34px);
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -0.035em;
}
.head b {
  font-size: 15px;
  letter-spacing: 0;
}
.head p {
  max-width: 620px;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.55;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin-top: 36px;
}
.tile {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--surface-2), var(--surface) 60%);
  transition: border-color 0.3s var(--ease);
}
.tile:hover {
  border-color: var(--line-strong);
}
.span-4 {
  grid-column: span 4;
}
.span-5 {
  grid-column: span 5;
}
.span-7 {
  grid-column: span 7;
}
.span-12 {
  grid-column: span 12;
  flex-direction: row;
  align-items: stretch;
}
.words {
  padding: 28px 28px 0;
}
.span-12 .words {
  flex: 0 0 38%;
  align-self: center;
  padding: 36px;
}
.words h4 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
}
.words p {
  margin-top: 10px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.55;
}

/* The app, peeking in from the tile's lower right corner. */
.media {
  position: relative;
  flex: 1;
  min-height: 240px;
  margin: 28px 0 0 28px;
  overflow: hidden;
  border-top: 1px solid var(--line-strong);
  border-left: 1px solid var(--line-strong);
  border-radius: 10px 0 0 0;
  background: #1b1917;
}
.span-7 .media,
.span-5 .media {
  min-height: 300px;
}
.span-12 .media {
  min-height: 380px;
  margin: 36px 0 0;
}
.media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  transition: translate 0.6s var(--ease);
}
.tile:hover .media img {
  translate: 0 -6px;
}

/* What else a step holds, and what else the app does: one line each, under a hairline. */
.points,
.more-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 32px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}
/* A step without screenshots says it all in its points, given the room the tiles would have had. */
.points.alone {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 36px;
}
.points li,
.more-list li {
  padding: 24px 0;
  border-top: 1px solid var(--line);
}
.points h4,
.more-list h4 {
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.points.alone h4 {
  font-size: 18px;
  letter-spacing: -0.02em;
}
.points p,
.more-list p {
  margin-top: 6px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.55;
}
.points.alone p {
  font-size: 16px;
}

@media (max-width: 1080px) {
  .span-4 {
    grid-column: span 6;
  }
  /* Three tiles on two columns: the last one takes its row whole. */
  .span-4:last-child:nth-child(odd) {
    grid-column: span 12;
  }
  .head {
    grid-template-columns: minmax(0, 1fr);
  }
  .points {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .span-5,
  .span-7 {
    grid-column: span 12;
  }
  .more-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .grid > .tile {
    grid-column: span 12;
  }
  .span-12 {
    flex-direction: column;
  }
  .span-12 .words {
    padding: 28px 28px 0;
  }
  .span-12 .media {
    margin: 28px 0 0 28px;
    min-height: 260px;
  }
  .points,
  .points.alone,
  .more-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .media img {
    transition: none;
  }
  .tile:hover .media img {
    translate: none;
  }
}
</style>
