// Drives the game in headless Chromium and saves screenshots: home, level 1,
// a short, a trace unzipping and running the rim into the core, the win
// card, the level map, a big level with a hint, Build your own, and a
// desktop view. Needs Playwright.
// Usage: node tools/shoot.js <out-dir> [url]
const fs = require('fs');
const { chromium } = require('playwright');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:8765/index.html';
if (!out) {
  console.error('usage: node tools/shoot.js <out-dir> [url]');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function page(viewport, state) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    p.on('pageerror', (e) => errors.push(String(e)));
    if (state) await p.addInitScript((s) => localStorage.setItem('unfold-v1', JSON.stringify(s)), state);
    await p.goto(url);
    await p.waitForTimeout(500);
    return p;
  }
  // Clicks the middle of the first cell of arrow i.
  async function tapArrow(p, i) {
    const xy = await p.evaluate((i) => {
      const lv = JSON.parse(localStorage.getItem('unfold-v1')).run.puzzle;
      const r = document.querySelector('.arrows').getBoundingClientRect();
      const cell = r.width / lv.w;
      const [x, y] = lv.arrows[i].cells[0];
      return [r.left + (x + 0.5) * cell, r.top + (y + 0.5) * cell];
    }, i);
    await p.mouse.click(xy[0], xy[1]);
  }
  const phone = { width: 390, height: 844 };

  let p = await page(phone, { sound: false });
  await p.screenshot({ path: out + '/1-home.png' });
  await p.click('#playBtn');
  await p.waitForSelector('.arrow');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/2-level1.png' });
  await tapArrow(p, 1); // blocked by the first trace: a short
  await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/3-short.png' });
  await p.waitForTimeout(500);
  await tapArrow(p, 0); // free: unzips up and runs the rim into the core
  await p.waitForTimeout(160);
  await p.screenshot({ path: out + '/4a-unzipping.png' });
  await p.waitForTimeout(260);
  await p.screenshot({ path: out + '/4b-into-core.png' });
  await p.waitForTimeout(600);
  await tapArrow(p, 1);
  await p.waitForTimeout(600);
  await tapArrow(p, 2);
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/4c-on-the-rim.png' });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: out + '/5-win.png' });
  await p.close();

  const progress = { stars: Object.fromEntries(Array.from({ length: 62 }, (_, i) => [i + 1, 1 + (i % 3)])), sound: false };
  p = await page(phone, progress);
  await p.click('#levelsBtn');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/6-levels.png' });
  await p.close();

  p = await page(phone, progress);
  await p.click('#playBtn');
  await p.waitForSelector('.arrow');
  await p.waitForTimeout(400);
  await p.click('#hintBtn');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/7-level63-hint.png' });
  await p.close();

  p = await page(phone, { sound: false });
  await p.click('#customBtn');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/8-build-your-own.png' });
  await p.close();

  p = await page({ width: 1280, height: 800 }, progress);
  await p.click('#playBtn');
  await p.waitForSelector('.arrow');
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/9-desktop.png' });
  await p.close();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('saved screenshots to', out);
})();
