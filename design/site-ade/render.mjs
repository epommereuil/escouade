// Captures the three directions of index.html: `node design/site-ade/render.mjs` writes, for each, its first
// screen (1440×900) and its whole page with the order of its sections.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(dir, 'index.html')).href;
const browser = await chromium.launch();
for (const d of ['a', 'b', 'c']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${url}#${d}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, `${d}-hero.png`) });
  await page.screenshot({ path: join(dir, `${d}-page.png`), fullPage: true });
  console.log(d);
  await page.close();
}
await browser.close();
