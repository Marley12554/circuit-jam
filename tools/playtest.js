// Plays whole levels through the real page in headless Chromium (animations
// off) and checks shorts, hints, restart, stars, pause and resume, the level
// map, and puzzle codes. Needs Playwright.
// Usage: node tools/playtest.js [url]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let failures = 0;
  const check = (ok, msg) => {
    if (!ok) {
      failures++;
      console.log('FAIL', msg);
    } else console.log('ok  ', msg);
  };
  // Saved progress with levels 1 to n - 1 finished, so Play opens level n.
  const progressTo = (n) => ({ stars: Object.fromEntries(Array.from({ length: n - 1 }, (_, i) => [i + 1, 1])), sound: false });

  async function open(state, viewport) {
    const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    // Seeds progress once, so a reload keeps whatever the page saved since.
    if (state) await p.addInitScript((s) => localStorage.getItem('unfold-v1') || localStorage.setItem('unfold-v1', JSON.stringify(s)), state);
    await p.goto(url);
    return p;
  }
  const num = async (p, id) => Number(await p.textContent('#' + id));
  const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('unfold-v1')));

  // Screen position of the middle of one of arrow i's cells.
  async function tapArrow(p, i) {
    const xy = await p.evaluate((i) => {
      const run = JSON.parse(localStorage.getItem('unfold-v1')).run;
      const lv = run.puzzle;
      const svg = document.querySelector('.arrows');
      const r = svg.getBoundingClientRect();
      const cell = r.width / lv.w;
      const [x, y] = lv.arrows[i].cells[0];
      return [r.left + (x + 0.5) * cell, r.top + (y + 0.5) * cell];
    }, i);
    await p.mouse.click(xy[0], xy[1]);
    await p.waitForTimeout(30);
  }
  // The page's own rules, on the saved run.
  const freeNow = (p) =>
    p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('unfold-v1')).run;
      const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
      return window.UnfoldCore.freeArrows(run.puzzle, gone);
    });
  const blockedNow = (p) =>
    p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('unfold-v1')).run;
      const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
      const free = new Set(window.UnfoldCore.freeArrows(run.puzzle, gone));
      return run.puzzle.arrows.map((a, i) => i).find((i) => !gone[i] && !free.has(i));
    });
  async function clearAll(p) {
    for (let k = 0; k < 200; k++) {
      if (!(await p.isHidden('#win'))) return;
      const run = (await stored(p)).run;
      if (!run) break;
      const free = await freeNow(p);
      await tapArrow(p, free[0]);
    }
    await p.waitForSelector('#win:not([hidden])', { timeout: 4000 });
  }

  // Level 1: the tutorial. A hint glows from the start, for free.
  {
    const p = await open({ sound: false });
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    check((await p.locator('.arrow').count()) === 3, 'level 1 has 3 traces');
    check((await p.locator('.arrow.hint').count()) === 1, 'level 1 starts with a free hint');
    check((await p.textContent('#hintBadge')) === '3', 'the free hint costs nothing');
    check(await p.isDisabled('#restartBtn'), 'restart off before any tap');
    // The second trace is blocked by the first.
    await tapArrow(p, 1);
    check((await num(p, 'bumpCount')) === 1, 'a blocked trace counts a short');
    check((await num(p, 'leftCount')) === 3, 'a short leaves the board as it was');
    check(/teal trace is in the way/.test(await p.textContent('#say')), 'the drone names the blocker');
    check(!(await p.isDisabled('#restartBtn')), 'restart on after a short');
    await tapArrow(p, 0);
    check((await num(p, 'leftCount')) === 2, 'a free trace leaves');
    check((await p.locator('.arrow.hint').count()) === 0, 'the hint goes with its trace');
    await tapArrow(p, 1);
    await tapArrow(p, 2);
    await p.waitForSelector('#win:not([hidden])');
    check((await p.locator('#winStars i.on').count()) === 2, 'one short: 2 stars');
    check((await p.textContent('#winStats')) === '1 short', 'win card counts the short');
    const s = await stored(p);
    check(s.stars[1] === 2 && s.best[1] === 1 && !s.run, 'stars and best saved, run cleared');
    // Play again for 3 stars.
    await p.click('#replayBtn');
    check((await num(p, 'bumpCount')) === 0 && (await num(p, 'leftCount')) === 3, 'play again resets the board');
    await clearAll(p);
    check((await p.locator('#winStars i.on').count()) === 3, 'clean clear: 3 stars');
    check((await stored(p)).stars[1] === 3, 'better stars replace worse ones');
    await p.click('#nextBtn');
    check((await p.textContent('#levelTitle')).includes('2'), 'next level opens level 2');
    await p.context().close();
  }

  // A bigger level: hints cost one and cap stars; restart refills them.
  {
    const p = await open(progressTo(23));
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const n = await num(p, 'leftCount');
    check(n === (await p.locator('.arrow').count()), 'left count matches the board');
    await p.click('#hintBtn');
    check((await p.textContent('#hintBadge')) === '2', 'a hint costs one');
    const hinted = await p.evaluate(() => [...document.querySelectorAll('.arrow')].findIndex((g) => g.classList.contains('hint')));
    const free = await freeNow(p);
    check(free.includes(hinted), 'the hint shows a free trace');
    await p.click('#hintBtn');
    check((await p.textContent('#hintBadge')) === '2', 'asking again repeats the hint for free');
    const blocked = await blockedNow(p);
    await tapArrow(p, blocked);
    await tapArrow(p, blocked);
    check((await num(p, 'bumpCount')) === 2, 'two shorts counted');
    await p.click('#restartBtn');
    check((await num(p, 'bumpCount')) === 0 && (await p.textContent('#hintBadge')) === '3', 'restart clears shorts and refills hints');
    await p.click('#hintBtn');
    await clearAll(p);
    check((await p.locator('#winStars i.on').count()) === 2, 'a hint caps a clean clear at 2 stars');
    await p.context().close();
  }

  // Pause and resume: leave mid-level, reload, and pick it up again.
  {
    const p = await open(progressTo(31));
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const total = await num(p, 'leftCount');
    // Clear two traces, looking for a free one each time.
    for (let k = 0; k < 2; k++) await tapArrow(p, (await freeNow(p))[0]);
    await tapArrow(p, await blockedNow(p));
    await p.click('#homeBtn');
    await p.reload();
    check(/resume/.test(await p.textContent('#playSub')), 'home offers to resume');
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    check((await num(p, 'leftCount')) === total - 2, 'resumed with the same arrows left');
    check((await num(p, 'bumpCount')) === 1, 'resumed with the same shorts');
    check((await p.locator('.arrow').count()) === total - 2, 'gone traces stay gone');
    // Another level from the map; the paused one shows as Resume.
    await p.click('#homeBtn');
    await p.click('#levelsBtn');
    check((await p.locator('.lab').count()) >= 7, 'level map shows every set');
    await p.fill('#jumpInput', '47');
    await p.click('#jumpForm button');
    await p.waitForSelector('.arrow');
    check((await p.textContent('#levelTitle')).includes('47'), 'jump box opens level 47');
    await p.context().close();
  }

  // Build your own: presets, settings, and codes.
  {
    const p = await open({ sound: false });
    await p.click('#customBtn');
    await p.click('.preset[data-preset="hard"]');
    check((await p.textContent('#wOut')) === '10' && (await p.textContent('#hOut')) === '12', 'Hard preset sets the size');
    check(await p.isHidden('#customBadge'), 'a matching preset hides Custom');
    await p.click('.stepper[data-key="w"] [data-step="1"]');
    check(!(await p.isHidden('#customBadge')), 'changing a setting shows Custom');
    await p.click('label:has(input[name="bend"][value="0"])');
    check((await stored(p)).custom.bend === 0, 'bend choice saved');
    await p.click('#mixBtn');
    await p.waitForSelector('.arrow');
    const code = await p.textContent('#levelTitle');
    check(/^1112[0-2]{3}-\d{4}$/.test(code), 'title shows the puzzle code: ' + code);
    const before = await p.evaluate(() => JSON.parse(localStorage.getItem('unfold-v1')).run.puzzle.arrows);
    await clearAll(p);
    check((await p.textContent('#winCode')).includes(code), 'win card shows the code');
    await p.click('#winHome');
    await p.click('#customBtn');
    await p.fill('#codeInput', 'nonsense');
    await p.click('#codeForm button');
    check(!(await p.isHidden('#codeError')), 'a bad code is turned away');
    await p.fill('#codeInput', code);
    await p.click('#codeForm button');
    await p.waitForSelector('.arrow');
    const after = await p.evaluate(() => JSON.parse(localStorage.getItem('unfold-v1')).run.puzzle.arrows);
    check(JSON.stringify(before) === JSON.stringify(after), 'the code makes the same board');
    await p.context().close();
  }

  // The cube: build one, clear traces that face us, short one, spin it,
  // and pick it up again after a reload.
  {
    const p = await open({ sound: false, custom: { shape: 'cube', n: 4, w: 8, h: 10, density: 2, length: 1, bend: 1 } });
    await p.click('#customBtn');
    check(!(await p.isHidden('.stepper[data-key="n"]')) && (await p.isHidden('.stepper[data-key="w"]')), 'cube shape shows face size, hides width');
    await p.click('#mixBtn');
    await p.waitForSelector('.cube-canvas');
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('unfold-v1')).run);
    const code = await p.textContent('#levelTitle');
    check(/^C04[0-2]{3}-\d+$/.test(code), 'cube title shows a cube code: ' + code);
    const total = await num(p, 'leftCount');
    // A free trace with a cell facing us (turning the cube if needed).
    async function facing(wantFree) {
      return p.evaluate((wantFree) => {
        const run = JSON.parse(localStorage.getItem('unfold-v1')).run;
        const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
        const free = new Set(window.UnfoldCore.freeArrows(run.puzzle, gone));
        const pool = run.puzzle.arrows.map((a, i) => i).filter((i) => !gone[i] && free.has(i) === wantFree);
        for (const i of pool) {
          const pt = window.__unfoldTest.cubePoint(i);
          if (pt) return { i, pt };
        }
        if (!pool.length) return null;
        const a = run.puzzle.arrows[pool[0]];
        window.__unfoldTest.showFace(a.cells[a.cells.length - 1][0]);
        return { i: pool[0], pt: window.__unfoldTest.cubePoint(pool[0]) };
      }, wantFree);
    }
    for (let k = 0; k < 2; k++) {
      const f = await facing(true);
      await p.mouse.click(f.pt[0], f.pt[1]);
      await p.waitForTimeout(60);
    }
    check((await num(p, 'leftCount')) === total - 2, 'tapping free cube traces clears them');
    const blocked = await facing(false);
    if (blocked) {
      await p.mouse.click(blocked.pt[0], blocked.pt[1]);
      await p.waitForTimeout(60);
      check((await num(p, 'bumpCount')) === 1, 'a blocked cube trace shorts');
    }
    // Dragging spins the cube without tapping anything.
    const before = await num(p, 'leftCount');
    const box = await p.locator('.cube-canvas').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 6 });
    await p.mouse.up();
    check((await num(p, 'leftCount')) === before, 'a drag spins instead of tapping');
    await p.click('#homeBtn');
    await p.reload();
    await p.click('#resumeBtn:not([hidden]), #playBtn');
    await p.waitForSelector('.cube-canvas');
    check((await num(p, 'leftCount')) === before, 'the cube resumes where it was');
    check((await p.textContent('#setName')) === 'Your cube', 'resumed as a cube');
    // The code rebuilds the same cube.
    const arrows = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('unfold-v1')).run.puzzle.arrows));
    await p.click('#homeBtn');
    await p.click('#customBtn');
    await p.fill('#codeInput', code.toLowerCase());
    await p.click('#codeForm button');
    await p.waitForSelector('.cube-canvas');
    await p.waitForFunction((c) => { const r = JSON.parse(localStorage.getItem('unfold-v1')).run; return r && r.custom && r.custom.seed === c; }, Number(code.split('-')[1]));
    const again = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('unfold-v1')).run.puzzle.arrows));
    check(again === arrows, 'a cube code rebuilds the same cube');
    await p.context().close();
  }

  // The biggest flat board: zoom in and tap while zoomed.
  {
    const p = await open({ sound: false, custom: { shape: 'flat', n: 5, w: 30, h: 40, density: 2, length: 1, bend: 1 } });
    await p.click('#customBtn');
    await p.click('#mixBtn');
    await p.waitForSelector('.arrow', { timeout: 20000 });
    check(!(await p.isHidden('.zoom-tools')), 'a 30 by 40 board offers zoom');
    await p.click('[data-zoom="in"]');
    await p.click('[data-zoom="in"]');
    // Read the zoom the page set (computed styles lag a frame with
    // reduced motion, which gives every property a tiny transition).
    const zoomOf = () => p.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.stage').style.transform)[1]));
    const scale = await zoomOf();
    check(scale > 1.5, 'zoom in scales the board: ' + scale.toFixed(2));
    const total = await num(p, 'leftCount');
    // A free trace that is on screen at this zoom.
    const target = await p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('unfold-v1')).run;
      const free = window.UnfoldCore.freeArrows(run.puzzle, null);
      const svg = document.querySelector('.arrows').getBoundingClientRect();
      const board = document.getElementById('board').getBoundingClientRect();
      const k = svg.width / run.puzzle.w;
      for (const i of free) {
        for (const [x, y] of run.puzzle.arrows[i].cells) {
          const px = svg.left + (x + 0.5) * k;
          const py = svg.top + (y + 0.5) * k;
          if (px > board.left + 10 && px < board.right - 60 && py > board.top + 10 && py < board.bottom - 10) return [px, py];
        }
      }
      return null;
    });
    if (target) {
      await p.mouse.click(target[0], target[1]);
      await p.waitForTimeout(60);
      check((await num(p, 'leftCount')) === total - 1, 'tapping while zoomed clears the trace');
    } else check(false, 'found a free trace on screen while zoomed');
    await p.click('[data-zoom="fit"]');
    const fit = await zoomOf();
    check(Math.abs(fit - 1) < 0.01, 'fit shows the whole board again');
    await p.context().close();
  }

  // Keyboard: arrow keys move a box, Enter taps.
  {
    const p = await open({ sound: false });
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    await p.focus('#board');
    await p.keyboard.press('ArrowDown'); // shows the box in the middle (1, 2)
    await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('ArrowUp'); // (0, 1): the first trace's arrow
    await p.keyboard.press('Enter');
    check((await num(p, 'leftCount')) === 2, 'Enter taps the trace under the box');
    await p.context().close();
  }

  // Desktop size.
  {
    const p = await open(progressTo(65), { width: 1280, height: 800 });
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const fits = await p.evaluate(() => {
      const r = document.querySelector('.tray').getBoundingClientRect();
      const t = document.querySelector('.toolbar').getBoundingClientRect();
      return r.bottom <= t.top && r.top >= 0;
    });
    check(fits, 'desktop board fits between the HUD and the tools');
    await p.context().close();
  }

  await browser.close();
  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(failures ? failures + ' failed' : 'all passed');
  process.exit(failures ? 1 : 0);
})();
