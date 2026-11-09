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
    if (state) await p.addInitScript((s) => localStorage.getItem('circuit-jam-v1') || localStorage.setItem('circuit-jam-v1', JSON.stringify(s)), state);
    await p.goto(url);
    return p;
  }
  const num = async (p, id) => Number(await p.textContent('#' + id));
  const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('circuit-jam-v1')));

  // Screen position of the middle of one of arrow i's cells.
  async function tapArrow(p, i) {
    const xy = await p.evaluate((i) => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
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
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
      return window.CircuitJamCore.freeArrows(run.puzzle, gone);
    });
  const blockedNow = (p) =>
    p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
      const free = new Set(window.CircuitJamCore.freeArrows(run.puzzle, gone));
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
    const before = await p.evaluate(() => JSON.parse(localStorage.getItem('circuit-jam-v1')).run.puzzle.arrows);
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
    const after = await p.evaluate(() => JSON.parse(localStorage.getItem('circuit-jam-v1')).run.puzzle.arrows);
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
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('circuit-jam-v1')).run);
    const code = await p.textContent('#levelTitle');
    check(/^C04[0-2]{3}-\d+$/.test(code), 'cube title shows a cube code: ' + code);
    const total = await num(p, 'leftCount');
    // A free trace with a cell facing us (turning the cube if needed).
    async function facing(wantFree) {
      return p.evaluate((wantFree) => {
        const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
        const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
        const free = new Set(window.CircuitJamCore.freeArrows(run.puzzle, gone));
        const pool = run.puzzle.arrows.map((a, i) => i).filter((i) => !gone[i] && free.has(i) === wantFree);
        for (const i of pool) {
          const pt = window.__circuitJamTest.cubePoint(i);
          if (pt) return { i, pt };
        }
        if (!pool.length) return null;
        const a = run.puzzle.arrows[pool[0]];
        window.__circuitJamTest.showFace(a.cells[a.cells.length - 1][0]);
        return { i: pool[0], pt: window.__circuitJamTest.cubePoint(pool[0]) };
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
    // Only faces really turned toward the eye are drawn. Square on to
    // the front, a small turn still hides the side faces (in perspective
    // they face away); a bigger one shows one.
    const faces = await p.evaluate(() => {
      const T = window.__circuitJamTest;
      T.showFace(0);
      const square = T.visibleFaces();
      T.turn(0.09, 0);
      const small = T.visibleFaces();
      T.turn(0.3, 0);
      const big = T.visibleFaces();
      return { square, small, big };
    });
    check(JSON.stringify(faces.square) === '[0]' && JSON.stringify(faces.small) === '[0]', 'faces turned slightly away stay hidden: ' + JSON.stringify(faces));
    check(faces.big.length === 2 && faces.big.includes(0), 'a bigger turn brings a side face into view');
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
    const arrows = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('circuit-jam-v1')).run.puzzle.arrows));
    await p.click('#homeBtn');
    await p.click('#customBtn');
    await p.fill('#codeInput', code.toLowerCase());
    await p.click('#codeForm button');
    await p.waitForSelector('.cube-canvas');
    await p.waitForFunction((c) => { const r = JSON.parse(localStorage.getItem('circuit-jam-v1')).run; return r && r.custom && r.custom.seed === c; }, Number(code.split('-')[1]));
    const again = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('circuit-jam-v1')).run.puzzle.arrows));
    check(again === arrows, 'a cube code rebuilds the same cube');
    await p.context().close();
  }

  // Clearing a whole small cube: each face counts as cleared once every
  // trace touching it has left, the drone says so, and the cube is won.
  {
    const p = await open({ sound: false, custom: { shape: 'cube', n: 3, w: 8, h: 10, density: 2, length: 1, bend: 1 } });
    await p.click('#customBtn');
    await p.click('#mixBtn');
    await p.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('circuit-jam-v1')).run; return r && r.puzzle.kind === 'cube'; });
    const faces = () => p.evaluate(() => window.__circuitJamTest.facesCleared());
    const startFaces = await faces();
    let sawSpeech = false;
    for (let k = 0; k < 80 && (await p.isHidden('#win')); k++) {
      const pt = await p.evaluate(() => {
        const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
        if (!run) return null;
        const gone = run.puzzle.arrows.map((a, i) => run.gone.includes(i));
        const i = window.CircuitJamCore.freeArrows(run.puzzle, gone)[0];
        if (i == null) return null;
        let at = window.__circuitJamTest.cubePoint(i);
        if (!at) {
          const a = run.puzzle.arrows[i];
          window.__circuitJamTest.showFace(a.cells[a.cells.length - 1][0]);
          at = window.__circuitJamTest.cubePoint(i);
        }
        return at;
      });
      if (!pt) {
        await p.waitForTimeout(50);
        continue;
      }
      await p.mouse.click(pt[0], pt[1]);
      await p.waitForTimeout(60);
      if (/Face cleared! \d of 6/.test(await p.textContent('#say'))) sawSpeech = true;
    }
    await p.waitForSelector('#win:not([hidden])', { timeout: 5000 });
    check((await faces()) === 6, 'all six faces count as cleared (started with ' + startFaces + ')');
    check(sawSpeech || startFaces >= 5, 'the drone announces a cleared face');
    check((await p.textContent('#winTitle')) === 'Cube cleared!', 'clearing every face wins the cube');
    await p.context().close();
  }

  // The biggest cube: zoom buttons, a two-finger pinch, and a tap while
  // zoomed in.
  {
    const p = await open({ sound: false, custom: { shape: 'cube', n: 20, w: 8, h: 10, density: 2, length: 1, bend: 1 } });
    await p.click('#customBtn');
    check((await p.textContent('#nOut')) === '20', 'cube faces go up to 20');
    check(await p.isDisabled('.stepper[data-key="n"] [data-step="1"]'), 'and no further');
    const t0 = Date.now();
    await p.click('#mixBtn');
    await p.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('circuit-jam-v1')).run; return r && r.puzzle.kind === 'cube'; }, null, { timeout: 20000 });
    console.log('     (20-face cube ready in ' + (Date.now() - t0) + ' ms)');
    const zoom = () => p.evaluate(() => window.__circuitJamTest.cubeZoom());
    await p.click('[data-zoom="in"]');
    check((await zoom()) > 1.4, 'zoom in enlarges the cube');
    await p.click('[data-zoom="fit"]');
    check(Math.abs((await zoom()) - 1) < 0.01, 'fit shows the whole cube again');
    // A pinch made of two touch pointers spreading apart.
    const before = await num(p, 'leftCount');
    await p.evaluate(() => {
      const c = document.querySelector('.cube-canvas');
      const r = c.getBoundingClientRect();
      const mid = [r.left + r.width / 2, r.top + r.height / 2];
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
      ev('pointerdown', 1, mid[0] - 30, mid[1]);
      ev('pointerdown', 2, mid[0] + 30, mid[1]);
      for (let k = 1; k <= 6; k++) {
        ev('pointermove', 1, mid[0] - 30 - k * 15, mid[1]);
        ev('pointermove', 2, mid[0] + 30 + k * 15, mid[1]);
      }
      ev('pointerup', 1, mid[0] - 120, mid[1]);
      ev('pointerup', 2, mid[0] + 120, mid[1]);
    });
    check((await zoom()) > 2, 'a pinch zooms the cube: ' + (await zoom()).toFixed(2));
    check((await num(p, 'leftCount')) === before, 'a pinch never taps a trace');
    // Tap a free trace that is on screen at this zoom.
    const target = await p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const free = window.CircuitJamCore.freeArrows(run.puzzle, run.puzzle.arrows.map((a, i) => run.gone.includes(i)));
      const r = document.querySelector('.cube-canvas').getBoundingClientRect();
      for (const i of free) {
        const pt = window.__circuitJamTest.cubePoint(i);
        if (pt && pt[0] > r.left + 20 && pt[0] < r.right - 60 && pt[1] > r.top + 60 && pt[1] < r.bottom - 20) return pt;
      }
      return null;
    });
    if (target) {
      await p.mouse.click(target[0], target[1]);
      await p.waitForTimeout(60);
      check((await num(p, 'leftCount')) === before - 1, 'tapping a zoomed-in cube clears the trace');
    } else check(false, 'found a free cube trace on screen while zoomed');
    await p.context().close();
  }

  // The biggest flat board: zoom in and tap while zoomed.
  {
    const p = await open({ sound: false, custom: { shape: 'flat', n: 5, w: 30, h: 40, density: 2, length: 1, bend: 1 } });
    await p.click('#customBtn');
    await p.click('#mixBtn');
    await p.waitForSelector('.arrow', { timeout: 20000 });
    check(!(await p.isHidden('.zoom-tools')), 'a 30 by 40 board offers zoom');
    // Read the zoom the page set (computed styles lag a frame with
    // reduced motion, which gives every property a tiny transition).
    const zoomOf = () => p.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.stage').style.transform)[1]));
    await p.click('[data-zoom="in"]');
    await p.click('[data-zoom="in"]');
    const scale = await zoomOf();
    check(scale > 1.5, 'zoom in scales the board: ' + scale.toFixed(2));
    await p.click('[data-zoom="fit"]');
    await p.waitForTimeout(50); // let the board settle before measuring
    const total = await num(p, 'leftCount');
    // Zoom in with the wheel right on a free trace, which keeps it under
    // the pointer, then tap it.
    // Use the free trace cell nearest the middle of the board, so zooming
    // in on it never pushes it under the zoom buttons in the corner.
    const target = await p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const { w, h } = run.puzzle;
      let best = null;
      for (const i of window.CircuitJamCore.freeArrows(run.puzzle, null)) {
        for (const [x, y] of run.puzzle.arrows[i].cells) {
          const d = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2);
          if (!best || d < best.d) best = { d, x, y };
        }
      }
      return [best.x, best.y];
    });
    const cellOf = () => p.evaluate(([x, y]) => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const svg = document.querySelector('.arrows').getBoundingClientRect();
      const k = svg.width / run.puzzle.w;
      return [svg.left + (x + 0.5) * k, svg.top + (y + 0.5) * k];
    }, target);
    let pt = await cellOf();
    await p.mouse.move(pt[0], pt[1]);
    for (let k = 0; k < 4; k++) await p.mouse.wheel(0, -300);
    await p.waitForTimeout(100);
    check((await zoomOf()) > 1.5, 'the wheel zooms the board');
    await p.waitForTimeout(50);
    pt = await cellOf();
    await p.mouse.click(pt[0], pt[1]);
    await p.waitForTimeout(60);
    check((await num(p, 'leftCount')) === total - 1, 'tapping while zoomed clears the trace');
    await p.click('[data-zoom="fit"]');
    const fit = await zoomOf();
    check(Math.abs(fit - 1) < 0.01, 'fit shows the whole board again');
    await p.context().close();
  }

  // Overclock: level 14 is timed. The map marks it, the core drains, clears
  // top it up, shorts drain it, an empty core loses, and Try again resets.
  {
    const p = await open(progressTo(14));
    check((await p.textContent('#playSub')).includes('Overclocked'), 'home says the next level is overclocked');
    await p.click('#levelsBtn');
    const ocLabel = await p.getAttribute('.level-btn.overclock >> nth=0', 'aria-label');
    check(/^Level 14, overclocked/.test(ocLabel), 'the map marks level 14 as overclocked: ' + ocLabel);
    check(!(await p.locator('[aria-label^="Level 13,"]').evaluate((b) => b.classList.contains('overclock'))), 'level 13 is not overclocked');
    await p.goto(url);
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    check(!(await p.isHidden('#power')), 'the power bar shows');
    check(await p.evaluate(() => document.getElementById('board').classList.contains('overclock')), 'the board is electrified');
    const start = await p.evaluate(() => __circuitJamTest.power());
    await p.waitForTimeout(2600);
    const drained = await p.evaluate(() => __circuitJamTest.power());
    check(drained.S < start.S - 0.5, 'the core drains: ' + start.S.toFixed(1) + ' to ' + drained.S.toFixed(1));
    await p.evaluate(() => __circuitJamTest.setPower(5));
    await tapArrow(p, (await freeNow(p))[0]);
    const topped = (await p.evaluate(() => __circuitJamTest.power())).S;
    check(topped > 5.5, 'a clear tops the core up: ' + topped.toFixed(2));
    // The battery: clearing on a full bar overcharges it instead of wasting it.
    await p.evaluate((m) => __circuitJamTest.setPower(m), start.max);
    await tapArrow(p, (await freeNow(p))[0]);
    const over = await p.evaluate(() => __circuitJamTest.power());
    check(over.S > over.max, 'a clear on a full bar overcharges the battery: ' + over.S.toFixed(1) + ' of ' + over.max.toFixed(1));
    check(await p.evaluate(() => parseFloat(document.getElementById('powerOver').style.getPropertyValue('--fill')) > 0), 'the overcharge shows on the bar');
    const blocked = await blockedNow(p);
    await p.evaluate(() => __circuitJamTest.setPower(10));
    await tapArrow(p, blocked);
    const hit = (await p.evaluate(() => __circuitJamTest.power())).S;
    check(hit < 10 - start.cost + 0.3, 'a short drains a chunk: ' + hit.toFixed(2));
    // Leaving and coming back keeps the power.
    await p.evaluate(() => __circuitJamTest.setPower(8));
    await p.reload();
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const resumed = (await p.evaluate(() => __circuitJamTest.power())).S;
    check(resumed > 7 && resumed <= 8.01, 'resume keeps the power: ' + resumed.toFixed(2));
    await p.waitForTimeout(1800); // past the moment's grace after resuming
    await p.evaluate((m) => __circuitJamTest.setPower(m * 0.6), start.max);
    await p.waitForTimeout(200);
    check(!(await p.evaluate(() => document.getElementById('board').classList.contains('dying'))), 'at 60% power all is calm');
    await p.evaluate((m) => __circuitJamTest.setPower(m * 0.45), start.max);
    await p.waitForTimeout(200);
    const warm = await p.evaluate(() => [document.getElementById('board').classList.contains('dying'), +getComputedStyle(document.getElementById('power')).getPropertyValue('--heat'), document.getElementById('powerSecs').textContent]);
    check(warm[0] && warm[1] > 0 && warm[1] < 0.3 && warm[2] === '', 'at 45% it only starts to warm: heat ' + warm[1]);
    await p.evaluate((m) => __circuitJamTest.setPower(m * 0.2), start.max);
    await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('board').classList.contains('dying')), 'low power: the core starts dying');
    check(/^\d+\.\ds$/.test(await p.textContent('#powerSecs')), 'low power: the seconds left show: ' + (await p.textContent('#powerSecs')));
    await p.evaluate(() => __circuitJamTest.setPower(0.05));
    await p.waitForSelector('#win:not([hidden])', { timeout: 4000 });
    check((await p.textContent('#winTitle')) === 'Core drained!', 'an empty core loses the board');
    check(!(await stored(p)).run, 'a lost board leaves no run to resume');
    check(!(await stored(p)).stars[14], 'a lost board earns no stars');
    await p.click('#nextBtn');
    const fresh = await p.evaluate(() => __circuitJamTest.power());
    check(await p.isHidden('#win'), 'Try again closes the card');
    check(Math.abs(fresh.S - fresh.max) < 0.5, 'Try again refills the core');
    check((await num(p, 'leftCount')) === (await stored(p)).run.puzzle.arrows.length, 'Try again puts every trace back');
    await clearAll(p);
    check((await p.textContent('#winTitle')) !== 'Core drained!' && (await p.textContent('#winStats')).includes('power left'), 'clearing in time wins, with power left');
    check(!(await p.isHidden('#replayBtn')) && !(await p.isHidden('#winStars')), 'the win card is whole again after a loss');
    await p.click('#winClose');
    check(!(await p.isHidden('#resultsBtn')) && (await p.isHidden('#hintBtn')), 'closing the card offers Results');
    await p.click('#resultsBtn');
    check(!(await p.isHidden('#win')) && (await p.isHidden('#resultsBtn')), 'Results opens the card again');
    await p.context().close();
  }

  // Build your own: presets keep the shape, and Overclock works on a cube.
  {
    const p = await open({ sound: false });
    await p.click('#customBtn');
    await p.click('.preset[data-preset="hard"]');
    await p.click('label:has(input[name="shape"][value="cube"])');
    check((await p.textContent('#nOut')) === '8', 'Hard on a cube is 8 by 8 by 8');
    check((await p.getAttribute('.preset[data-preset="hard"]', 'aria-pressed')) === 'true', 'the preset stays lit across shapes');
    await p.click('.preset[data-preset="impossible"]');
    const imp = (await stored(p)).custom;
    check(imp.n === 20 && imp.w === 30 && imp.h === 40 && imp.density === 2 && imp.length === 2 && imp.bend === 2 && imp.overclock === true, 'Impossible maxes everything and turns on Overclock');
    await p.click('.oc-toggle');
    check((await p.getAttribute('.preset[data-preset="impossible"]', 'aria-pressed')) === 'false', 'Impossible goes dark without Overclock');
    await p.click('.oc-toggle');
    await p.click('.preset[data-preset="hard"]');
    check((await stored(p)).custom.overclock === true, 'other presets leave the Overclock switch alone');
    await p.click('.oc-toggle');
    await p.click('.preset[data-preset="easy"]');
    check((await p.textContent('#nOut')) === '3' && !(await p.isHidden('.stepper[data-key="n"]')), 'a preset keeps the cube shape');
    await p.click('label:has(input[name="shape"][value="flat"])');
    check((await p.getAttribute('.preset[data-preset="easy"]', 'aria-pressed')) === 'true', 'and stays lit going back to flat');
    await p.click('label:has(input[name="shape"][value="cube"])');
    await p.click('.oc-toggle');
    check((await stored(p)).custom.overclock === true, 'the Overclock switch is saved');
    await p.click('#mixBtn');
    await p.waitForFunction(() => window.__circuitJamTest.power());
    const code = await p.textContent('#levelTitle');
    check(/^C03\d{3}-\d{4}X$/.test(code), 'an overclocked cube code ends in X: ' + code);
    check(!(await p.isHidden('#power')), 'an overclocked cube shows the power bar');
    await p.context().close();
  }

  // Playtest recording, with a stand-in for the artifact's data store:
  // a won board is saved with one event per tap, and the switch stops it.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.addInitScript(() => {
      localStorage.getItem('circuit-jam-v1') || localStorage.setItem('circuit-jam-v1', JSON.stringify({ sound: false, stars: { 1: 3 } }));
      window.__writes = {};
      const db = { doc: (path) => ({ set: async (body) => { window.__writes[path] = JSON.parse(JSON.stringify(body)); } }) };
      window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? { id: async () => 'u_test' } : null) };
    });
    await p.goto(url);
    await p.waitForSelector('#recordWrap:not([hidden])');
    check(!(await p.isHidden('#recordNote')), 'recording says it is on');
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const blocked = await blockedNow(p);
    if (blocked != null) await tapArrow(p, blocked);
    await clearAll(p);
    await p.waitForTimeout(200);
    const writes = await p.evaluate(() => window.__writes);
    check(!!writes['playtests/u_test'], 'the player is listed');
    const runs = Object.keys(writes).filter((k) => k.startsWith('playtests/u_test/runs/'));
    const run = runs.length && writes[runs[runs.length - 1]];
    const taps = run ? run.events.map((e) => JSON.parse(e)).filter((e) => typeof e[1] === 'number') : [];
    check(run && run.result === 'won' && run.level === 2, 'a won level is saved: ' + (run && run.result));
    check(taps.length === run.traces + (blocked != null ? 1 : 0), 'one event per tap: ' + taps.length);
    check(taps.every((e, k) => k === 0 || e[0] >= taps[k - 1][0]) && taps.some((e) => e[2] === 0) === (blocked != null), 'taps are timed and shorts marked');
    await p.click('#winHome');
    await p.click('label:has(#recordToggle)');
    const before = Object.keys(await p.evaluate(() => window.__writes)).length;
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    await tapArrow(p, (await freeNow(p))[0]);
    await p.click('#homeBtn');
    check(Object.keys(await p.evaluate(() => window.__writes)).length === before, 'the switch stops recording');
    await ctx.close();
  }

  // A slip: a tap on a blocked trace right at the border of a free one
  // clears the free one; a tap in the middle of the blocked one shorts.
  {
    const p = await open(progressTo(30));
    await p.click('#playBtn');
    await p.waitForSelector('.arrow');
    const pair = await p.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
      const lv = run.puzzle;
      const gone = lv.arrows.map(() => false);
      const free = new Set(window.CircuitJamCore.freeArrows(lv, gone));
      const owner = {};
      lv.arrows.forEach((a, i) => a.cells.forEach(([x, y]) => (owner[x + ',' + y] = i)));
      for (const [key, i] of Object.entries(owner)) {
        if (free.has(i)) continue;
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = owner[x + dx + ',' + (y + dy)];
          if (j != null && free.has(j)) {
            const svg = document.querySelector('.arrows').getBoundingClientRect();
            const cell = svg.width / lv.w;
            const px = (fx, fy) => [svg.left + fx * cell, svg.top + fy * cell];
            return { slip: px(x + 0.5 + dx * 0.4, y + 0.5 + dy * 0.4), middle: px(x + 0.5, y + 0.5) };
          }
        }
      }
      return null;
    });
    if (pair) {
      const left = await num(p, 'leftCount');
      await p.mouse.click(pair.slip[0], pair.slip[1]);
      await p.waitForTimeout(60);
      check((await num(p, 'leftCount')) === left - 1 && (await num(p, 'bumpCount')) === 0, 'a slip at the border of a free trace clears it');
      // (Clearing the free one may have freed its neighbor, so tap the
      // middle of a trace that is still blocked.)
      // (Away from the zoom buttons in the corner.)
      const mid = await p.evaluate(() => {
        const run = JSON.parse(localStorage.getItem('circuit-jam-v1')).run;
        const lv = run.puzzle;
        const gone = lv.arrows.map((a, i) => run.gone.includes(i));
        const free = new Set(window.CircuitJamCore.freeArrows(lv, gone));
        let best = null;
        lv.arrows.forEach((a, i) => {
          if (gone[i] || free.has(i)) return;
          a.cells.forEach(([x, y]) => {
            const d = Math.hypot(x + 0.5 - lv.w / 2, y + 0.5 - lv.h / 2);
            if (!best || d < best.d) best = { d, x, y };
          });
        });
        const svg = document.querySelector('.arrows').getBoundingClientRect();
        const cell = svg.width / lv.w;
        return [svg.left + (best.x + 0.5) * cell, svg.top + (best.y + 0.5) * cell];
      });
      await p.mouse.click(mid[0], mid[1]);
      await p.waitForTimeout(60);
      check((await num(p, 'bumpCount')) === 1, 'a tap in the middle of a blocked trace still shorts');
    } else check(false, 'found a blocked trace beside a free one');
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
