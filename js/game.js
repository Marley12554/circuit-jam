/*
 * Unfold: screens, the circuit board, the unzip, short, and core
 * animations, tools, and progress. The rules and the level generator live
 * in core.js. Generating a board takes a few milliseconds, so everything
 * runs on the page.
 */
(function () {
  'use strict';

  const Core = window.UnfoldCore;
  const Sound = window.UnfoldSound;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Trace colors. Each set uses a few of them, one main and some accents;
  // later sets use more. Red is kept for shorts.
  const COLORS = {
    teal: '#2fe6b4',
    amber: '#ffbe4d',
    violet: '#a98bff',
    magenta: '#f07bff',
    cyan: '#4fd8ff',
    lime: '#b8f24a',
    blue: '#6b8cff',
  };
  // Repeats set the mix: three of the main color to one accent, and so on.
  const SET_PALETTES = [
    ['teal', 'teal', 'teal', 'amber'],
    ['violet', 'violet', 'violet', 'lime'],
    ['cyan', 'cyan', 'cyan', 'amber'],
    ['amber', 'amber', 'teal', 'violet'],
    ['blue', 'blue', 'cyan', 'magenta'],
    ['teal', 'teal', 'violet', 'amber', 'magenta'],
    ['magenta', 'magenta', 'cyan', 'lime', 'violet'],
  ];
  const CUSTOM_PALETTE = 5;

  function paletteOf(index) {
    if (index < SET_PALETTES.length) return SET_PALETTES[index];
    return SET_PALETTES[3 + ((index - SET_PALETTES.length) % (SET_PALETTES.length - 3))];
  }

  const ICONS = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M11 5 6.5 9H3.5v6h3l4.5 4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M11 5 6.5 9H3.5v6h3l4.5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z"/></svg>',
  };

  const INTROS = {
    1: 'Tap the glowing trace. Its path is clear, so it unzips straight into the core!',
    2: 'A blocked trace shorts out and stays put. Look before you tap!',
    6: 'Bent traces! Only the path in front of the arrow matters. The rest just follows.',
    11: 'New chip, new colors. Find the traces with a clear path!',
    21: 'Longer traces that twist and turn. Follow each one to its arrow!',
  };
  const CHEERS = ["Let's power this up!", 'Find a clear path!', 'Look before you tap!', 'Charge the core!', 'One clear lane at a time!'];
  const CLEARS = ['Charged!', 'Into the core!', 'Clean signal!', 'Nice routing!', 'Power up!', 'Sharp eye!'];

  // Build your own: three-way settings, each with a tiny picture.
  const CHOICES = {
    density: [
      { name: 'Roomy', icon: '<rect class="solid" x="3" y="4" width="6" height="6"/><rect class="solid" x="17" y="4" width="6" height="6"/>' },
      { name: 'Snug', icon: '<rect class="solid" x="1.5" y="4" width="6" height="6"/><rect class="solid" x="10" y="4" width="6" height="6"/><rect class="solid" x="18.5" y="4" width="6" height="6"/>' },
      { name: 'Packed', icon: '<rect class="solid" x="0.5" y="1" width="12" height="5.5"/><rect class="solid" x="13.5" y="1" width="12" height="5.5"/><rect class="solid" x="0.5" y="7.5" width="12" height="5.5"/><rect class="solid" x="13.5" y="7.5" width="12" height="5.5"/>' },
    ],
    length: [
      { name: 'Short', icon: '<circle cx="9" cy="7" r="2"/><path d="M11 7h5"/><path d="m13.5 4 3 3-3 3"/>' },
      { name: 'Mixed', icon: '<circle cx="5" cy="7" r="2"/><path d="M7 7h13"/><path d="m17.5 4 3 3-3 3"/>' },
      { name: 'Long', icon: '<circle cx="2.5" cy="7" r="2"/><path d="M4.5 7h19"/><path d="m21 4 3 3-3 3"/>' },
    ],
    bend: [
      { name: 'Straight', icon: '<path d="M2 7h20"/><path d="m19.5 4 3 3-3 3"/>' },
      { name: 'Bendy', icon: '<path d="M2 11h10V3h10"/><path d="m19.5 0.5 3 2.5-3 2.5"/>' },
      { name: 'Twisty', icon: '<path d="M1.5 11h5V3h6v8h6V3h4"/><path d="m20.5 0.5 3 2.5-3 2.5"/>' },
    ],
  };
  const CHOICE_KEYS = ['density', 'length', 'bend'];

  const PRESETS = [
    { id: 'easy', name: 'Easy', w: 6, h: 7, density: 0, length: 0, bend: 0 },
    { id: 'medium', name: 'Medium', w: 8, h: 10, density: 1, length: 1, bend: 1 },
    { id: 'hard', name: 'Hard', w: 10, h: 12, density: 2, length: 1, bend: 1 },
    { id: 'genius', name: 'Genius', w: 12, h: 16, density: 2, length: 2, bend: 2 },
  ];

  // ---------- Saved progress (this browser only) ----------

  const STORE_KEY = 'unfold-v1';

  function defaults() {
    return {
      stars: {},
      best: {},
      sound: true,
      custom: { w: 8, h: 10, density: 1, length: 1, bend: 1 },
    };
  }

  function load() {
    const base = defaults();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return Object.assign(base, data, { custom: Object.assign(base.custom, data.custom) });
      }
    } catch (e) {
      /* storage blocked or corrupt: start fresh */
    }
    return base;
  }

  const saved = load();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch (e) {
      /* progress just will not persist */
    }
  }

  const levelCache = new Map();

  function getLevel(n) {
    if (!levelCache.has(n)) levelCache.set(n, Core.generateLevel(n));
    return levelCache.get(n);
  }

  // ---------- Screens ----------

  let screen = 'home';

  function show(name) {
    screen = name;
    ['home', 'levels', 'custom', 'play'].forEach((id) => {
      $(id).hidden = id !== name;
    });
    $('win').hidden = true;
    if (name !== 'play') useSet(0);
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
    if (name === 'custom') renderCustom();
  }

  function mainColor(index) {
    return COLORS[paletteOf(index)[0]];
  }

  // The current set colors the HUD, the drone, the core, and the wires.
  let wireColors = [COLORS.teal, COLORS.amber];

  function useSet(index) {
    const pal = paletteOf(index);
    document.documentElement.style.setProperty('--lab', COLORS[pal[0]]);
    const accent = pal.find((c) => c !== pal[0]);
    const next = [COLORS[pal[0]], COLORS[accent]];
    if (next[0] !== wireColors[0] || next[1] !== wireColors[1]) {
      wireColors = next;
      drawWires();
    }
  }

  // Play continues from the first level not yet finished, so levels played
  // out of order (from the map or the jump box) don't move it.
  function nextLevel() {
    let n = 1;
    while (saved.stars[n]) n++;
    return n;
  }

  function renderHome() {
    const n = nextLevel();
    const set = Core.setOf(n);
    const run = saved.run;
    // A run of the level Play would start is resumed by Play itself.
    const runIsNext = run && run.mode === 'level' && run.level === n;
    $('playSub').textContent = 'Level ' + n + ' · ' + set.name + (runIsNext ? ' · resume' : '');
    $('resumeBtn').hidden = !run || runIsNext;
    $('playBtn').classList.toggle('primary', !run || runIsNext);
    if (run && !runIsNext) {
      const where = run.mode === 'level' ? 'Level ' + run.level : 'Your board';
      const left = run.puzzle.arrows.length - run.gone.length;
      $('resumeSub').textContent = where + ' · ' + left + (left === 1 ? ' trace left' : ' traces left');
    }
    $('soundToggle').checked = saved.sound;
  }

  // Every level is open. The map shows the story sets, the endless sets up
  // to one past the player's progress, and more on request.
  let extraSets = 0;

  function renderLevels() {
    const list = $('setList');
    list.innerHTML = '';
    const next = nextLevel();
    const lastSet = Math.max(Core.SET_COUNT, Core.setOf(next).index + 2) - 1 + extraSets;
    for (let i = 0; i <= lastSet; i++) {
      const first = i * 10 + 1;
      const set = Core.setOf(first);
      let earned = 0;
      for (let n = first; n < first + 10; n++) earned += saved.stars[n] || 0;
      const section = document.createElement('section');
      section.className = 'lab';
      section.style.setProperty('--lab', mainColor(i));
      section.innerHTML =
        '<div class="lab-head"><h3>' + set.name + '</h3><span>' + earned + ' of 30 stars</span></div><div class="level-grid"></div>';
      const grid = section.querySelector('.level-grid');
      for (let n = first; n < first + 10; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const stars = saved.stars[n] || 0;
        btn.className = 'level-btn' + (n === next ? ' current' : stars ? ' done' : '');
        btn.innerHTML =
          '<span>' + n + '</span><span class="mini-stars">' +
          [1, 2, 3].map((s) => '<i class="' + (s <= stars ? 'on' : '') + '"></i>').join('') +
          '</span>';
        btn.setAttribute('aria-label', 'Level ' + n + ', ' + stars + (stars === 1 ? ' star' : ' stars'));
        btn.addEventListener('click', () => startLevel(n));
        grid.appendChild(btn);
      }
      list.appendChild(section);
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'small-btn alt more-labs';
    more.textContent = 'Show more levels';
    more.addEventListener('click', () => {
      extraSets += 3;
      const y = $('levels').scrollTop;
      renderLevels();
      $('levels').scrollTop = y;
    });
    list.appendChild(more);
  }

  function scrollToCurrent() {
    const current = $('setList').querySelector('.current');
    if (current) current.scrollIntoView({ block: 'center' });
  }

  // ---------- Build your own ----------

  function clampCustom() {
    const c = saved.custom;
    const L = Core.CUSTOM;
    c.w = Math.min(L.maxW, Math.max(L.minW, Math.round(c.w) || 8));
    c.h = Math.min(L.maxH, Math.max(L.minH, Math.round(c.h) || 10));
    CHOICE_KEYS.forEach((k) => (c[k] = Math.min(2, Math.max(0, Math.round(c[k]) || 0))));
  }

  function renderCustom() {
    clampCustom();
    const c = saved.custom;
    const L = Core.CUSTOM;
    $('wOut').textContent = c.w;
    $('hOut').textContent = c.h;
    const limits = { w: [L.minW, L.maxW], h: [L.minH, L.maxH] };
    document.querySelectorAll('.stepper').forEach((row) => {
      const key = row.dataset.key;
      row.querySelector('[data-step="-1"]').disabled = c[key] <= limits[key][0];
      row.querySelector('[data-step="1"]').disabled = c[key] >= limits[key][1];
    });
    CHOICE_KEYS.forEach((k) =>
      document.querySelectorAll('input[name="' + k + '"]').forEach((r) => {
        r.checked = Number(r.value) === c[k];
        r.closest('label').classList.toggle('on', r.checked);
      })
    );
    // A preset stays lit only while every setting still matches it.
    const match = PRESETS.find((p) => presetMatches(p, c));
    document.querySelectorAll('.preset').forEach((b) => b.setAttribute('aria-pressed', String(!!match && b.dataset.preset === match.id)));
    $('customBadge').hidden = !!match;
  }

  function presetMatches(p, c) {
    return ['w', 'h'].concat(CHOICE_KEYS).every((k) => p[k] === c[k]);
  }

  function applyPreset(p) {
    const before = customSnapshot();
    ['w', 'h'].concat(CHOICE_KEYS).forEach((k) => (saved.custom[k] = p[k]));
    save();
    renderCustom();
    flashChanges(before, customSnapshot());
  }

  // What each setting shows, to light up the ones a preset changed.
  function customSnapshot() {
    const c = saved.custom;
    return { wOut: c.w, hOut: c.h, densityRow: c.density, lengthRow: c.length, bendRow: c.bend };
  }

  function flashChanges(before, after) {
    if (reduceMotion) return;
    Object.keys(after).forEach((id) => {
      if (before[id] === after[id]) return;
      const el = $(id).closest('.stepper, .setting-row') || $(id);
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    });
  }

  // A tiny picture of a real board each preset makes, drawn to scale.
  function presetBoard(p) {
    const lv = Core.generate(Core.customSpec(Object.assign({}, p, { seed: 1 })));
    const pal = paletteOf(CUSTOM_PALETTE);
    let out = '';
    lv.arrows.forEach((a) => {
      const pts = a.cells.map(([x, y]) => (x + 0.5) + ' ' + (y + 0.5)).join(' L');
      out += '<path d="M' + pts + '" stroke="' + COLORS[pal[a.color % pal.length]] + '"/>';
    });
    return (
      '<svg class="preset-board" viewBox="-0.3 -0.3 ' + (lv.w + 0.6) + ' ' + (lv.h + 0.6) + '" aria-hidden="true">' +
      '<rect class="mini-dot" x="-0.3" y="-0.3" width="' + (lv.w + 0.6) + '" height="' + (lv.h + 0.6) + '"/>' +
      '<g fill="none" stroke-width="0.4" stroke-linejoin="miter">' + out + '</g></svg>'
    );
  }

  function buildPresets() {
    $('presets').innerHTML = PRESETS.map(
      (p) =>
        '<button class="preset" type="button" data-preset="' + p.id + '" aria-pressed="false">' + presetBoard(p) +
        '<span class="preset-name">' + p.name + '</span><span class="preset-icons" aria-hidden="true">' +
        p.w + '×' + p.h + '</span></button>'
    ).join('');
    document.querySelectorAll('.preset').forEach((b) =>
      b.addEventListener('click', () => {
        applyPreset(PRESETS.find((p) => p.id === b.dataset.preset));
        Sound.tap();
      })
    );
  }

  function buildChoices() {
    CHOICE_KEYS.forEach((k) => {
      const group = document.querySelector('.trick[data-key="' + k + '"]');
      group.innerHTML = CHOICES[k]
        .map(
          (c, i) =>
            '<label><input type="radio" name="' + k + '" value="' + i + '"><span><b><svg class="ico" viewBox="0 0 26 14" aria-hidden="true">' +
            c.icon + '</svg></b><small>' + c.name + '</small></span></label>'
        )
        .join('');
      group.querySelectorAll('input').forEach((r) =>
        r.addEventListener('change', () => {
          saved.custom[k] = Number(r.value);
          save();
          renderCustom();
        })
      );
    });
  }

  function newCustomSpec() {
    clampCustom();
    return Object.assign({}, saved.custom, { seed: 1000 + Math.floor(Math.random() * 9000) });
  }

  // ---------- Live wires on the wall ----------

  /*
   * Wires run in from the screen edges along the background grid and end in
   * a pad. Every wire carries a spark that rides it from the edge to the
   * pad, over and over, at its own pace. Redrawn when the window resizes.
   */
  const GRID = 28;

  function drawWires() {
    const host = $('wires');
    if (!host) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    host.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const rng = Core.makeRng('wires:' + W + 'x' + H);
    const count = Math.max(12, Math.min(40, Math.round((W * H) / 16000)));
    const cols = Math.floor(W / GRID);
    const rows = Math.floor(H / GRID);
    let out = '';
    for (let k = 0; k < count; k++) {
      // Start on an edge, step inward, then wander along the grid.
      const side = rng.int(4);
      let x = side === 1 ? cols + 1 : side === 3 ? -1 : 1 + rng.int(Math.max(1, cols - 1));
      let y = side === 0 ? -1 : side === 2 ? rows + 1 : 1 + rng.int(Math.max(1, rows - 1));
      let dir = (side + 2) % 4;
      const pts = [[x, y]];
      let length = 0;
      const legs = 2 + rng.int(3);
      for (let leg = 0; leg < legs; leg++) {
        const steps = 2 + rng.int(5);
        for (let s = 0; s < steps; s++) {
          const nx = x + Core.DX[dir];
          const ny = y + Core.DY[dir];
          if (leg > 0 && (nx < 1 || ny < 1 || nx > cols - 1 || ny > rows - 1)) break;
          x = nx;
          y = ny;
          length++;
        }
        pts.push([x, y]);
        dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4;
      }
      const d = 'M' + pts.map(([px, py]) => px * GRID + ' ' + py * GRID).join('L');
      const end = pts[pts.length - 1];
      const color = rng() < 0.7 ? wireColors[0] : wireColors[1];
      const id = 'wire' + k;
      const dur = (1.4 + (length * GRID) / 110 + rng() * 1.5).toFixed(2);
      const spark = reduceMotion
        ? '<g class="spark" transform="translate(' + end[0] * GRID + ' ' + end[1] * GRID + ')"><circle r="7" class="halo"/><circle r="2.8"/></g>'
        : '<g class="spark"><circle r="7" class="halo"/><circle r="2.8"/><animateMotion dur="' + dur + 's" begin="-' + (rng() * dur).toFixed(2) +
          's" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></g>';
      out +=
        '<g style="--c:' + color + '"><path id="' + id + '" class="w" d="' + d + '"/>' +
        '<circle class="pad" cx="' + end[0] * GRID + '" cy="' + end[1] * GRID + '" r="5"/>' + spark + '</g>';
    }
    host.innerHTML = out;
  }

  // ---------- The game ----------

  const board = $('board');
  const game = {
    mode: 'level',
    level: 1,
    custom: null,
    puzzle: null,
    palette: SET_PALETTES[0],
    gone: [],
    bumps: 0,
    hintsLeft: Core.HINTS,
    helped: false,
    hinted: -1,
    done: false,
    epoch: 0,
    busy: new Set(),
    absorbed: 0,
    cursor: null,
  };

  // Board geometry, in cells: the bus runs RIM cells outside the grid, and
  // the core sits on it at the top middle.
  const RIM = 0.75;
  const CORE_R = 0.62;

  let tray = null;
  let svg = null;
  let core = null;
  let arrowEls = [];
  let paths = [];
  let blockedBy = [];
  let cursorEl = null;
  let cell = 40;
  let hovered = -1;

  function colorOf(i) {
    const name = game.palette[game.puzzle.arrows[i].color % game.palette.length];
    return { name, hex: COLORS[name] };
  }

  let alertTimer = 0;

  function say(text, alert) {
    const el = $('say');
    el.textContent = text;
    el.classList.toggle('alert', !!alert);
    clearTimeout(alertTimer);
    if (alert) alertTimer = setTimeout(() => el.classList.remove('alert'), 1400);
    const robot = document.querySelector('.robot');
    robot.classList.remove('talk');
    void robot.getBoundingClientRect();
    robot.classList.add('talk');
  }

  function pickFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function left() {
    return game.puzzle ? game.puzzle.arrows.length - game.gone.filter(Boolean).length : 0;
  }

  function startLevel(n) {
    if (saved.run && saved.run.mode === 'level' && saved.run.level === n) {
      resumeRun(saved.run);
      return;
    }
    game.mode = 'level';
    game.level = n;
    game.custom = null;
    const set = Core.setOf(n);
    show('play');
    useSet(set.index);
    game.palette = paletteOf(set.index);
    $('setName').textContent = set.name;
    $('levelTitle').textContent = 'Level ' + n;
    let puzzle;
    try {
      puzzle = getLevel(n);
    } catch (err) {
      say('That board got tangled. Go back and try again!');
      return;
    }
    setPuzzle(puzzle);
    say(INTROS[n] || pickFrom(CHEERS));
    if (n === 1) showHint(bestHint(), true);
    saveRun();
    // Get the next one ready while this one is played.
    setTimeout(() => getLevel(n + 1), 400);
  }

  function startCustom(spec) {
    game.mode = 'custom';
    game.custom = spec;
    show('play');
    useSet(CUSTOM_PALETTE);
    game.palette = paletteOf(CUSTOM_PALETTE);
    $('setName').textContent = 'Your board';
    $('levelTitle').textContent = Core.codeOf(spec);
    let puzzle;
    try {
      puzzle = Core.generate(Core.customSpec(spec));
    } catch (err) {
      say("I couldn't build that one. Try different settings!");
      return;
    }
    setPuzzle(puzzle);
    say(pickFrom(CHEERS));
    saveRun();
  }

  function setPuzzle(puzzle) {
    game.puzzle = puzzle;
    resetState();
    buildBoard();
    updateHud();
  }

  function resetState() {
    game.epoch++;
    game.busy.clear();
    game.gone = new Array(game.puzzle.arrows.length).fill(false);
    game.absorbed = 0;
    game.bumps = 0;
    game.hintsLeft = Core.HINTS;
    game.helped = false;
    game.hinted = -1;
    game.done = false;
    $('win').hidden = true;
  }

  function updateHud() {
    $('leftCount').textContent = left();
    $('bumpCount').textContent = game.bumps;
    $('hintBadge').textContent = game.hintsLeft;
    const started = game.bumps > 0 || game.gone.some(Boolean) || game.helped;
    $('restartBtn').disabled = !game.puzzle || !started;
    const repeat = game.hinted >= 0 && !game.gone[game.hinted];
    $('hintBtn').disabled = !game.puzzle || game.done || left() === 0 || (game.hintsLeft <= 0 && !repeat);
  }

  // ---------- Drawing the board ----------

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  }

  /*
   * Each trace moves along one fixed route: its own cells from tail to
   * head, then straight along its lane to the bus around the rim, then
   * along the bus (the shorter way round) into the core at the top. At rest
   * it covers the first part. Leaving slides it along the route, so the
   * body follows the head around every bend, and the core swallows it.
   */
  function trackOf(i) {
    const p = game.puzzle;
    const a = p.arrows[i];
    const pts = a.cells.map(([x, y]) => [x + 0.5, y + 0.5]);
    const d = Core.dirOf(a);
    const [hx, hy] = pts[pts.length - 1];
    const { w, h } = p;
    const top = -RIM;
    const bottom = h + RIM;
    const leftX = -RIM;
    const rightX = w + RIM;
    const coreX = w / 2;
    if (d === 0) pts.push([hx, top]);
    else if (d === 1) pts.push([rightX, hy], [rightX, top]);
    else if (d === 3) pts.push([leftX, hy], [leftX, top]);
    else if (hx < coreX) pts.push([hx, bottom], [leftX, bottom], [leftX, top]);
    else pts.push([hx, bottom], [rightX, bottom], [rightX, top]);
    pts.push([coreX, top]);
    // Drop repeated points, then measure the route.
    const route = [pts[0]];
    pts.slice(1).forEach((q) => {
      const last = route[route.length - 1];
      if (Math.abs(q[0] - last[0]) > 1e-6 || Math.abs(q[1] - last[1]) > 1e-6) route.push(q);
    });
    const at = [0];
    for (let k = 1; k < route.length; k++) at.push(at[k - 1] + Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]));
    return { pts: route, at, total: at[at.length - 1], len: a.cells.length };
  }

  // Which segment of the route a distance falls on.
  function segmentAt(track, t) {
    const { at } = track;
    let lo = 0;
    let hi = at.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (at[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function pointAt(track, t) {
    const k = segmentAt(track, t);
    const a = track.pts[k];
    const b = track.pts[k + 1];
    const span = track.at[k + 1] - track.at[k] || 1;
    const f = Math.max(0, Math.min(1, (t - track.at[k]) / span));
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  const fmt = (n) => Math.round(n * 1000) / 1000;

  // The trace's shape with its tail s cells along its route. Whatever has
  // passed the end of the route is inside the core and not drawn.
  function shapeAt(i, s) {
    const track = paths[i];
    if (s >= track.total) return null;
    const start = s;
    const want = s + track.len - 1;
    const end = Math.min(want, track.total);
    const line = [pointAt(track, start)];
    for (let k = 1; k < track.pts.length; k++) if (track.at[k] > start + 1e-6 && track.at[k] < end - 1e-6) line.push(track.pts[k]);
    const head = pointAt(track, end);
    line.push(head);
    const body = 'M' + line.map((q) => fmt(q[0]) + ' ' + fmt(q[1])).join('L');
    let tip = '';
    if (want < track.total - 0.25) {
      const k = segmentAt(track, Math.max(0, end - 1e-6));
      const a = track.pts[k];
      const b = track.pts[k + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L;
      const uy = (b[1] - a[1]) / L;
      const t = [head[0] + ux * 0.3, head[1] + uy * 0.3];
      const base = [t[0] - ux * 0.28, t[1] - uy * 0.28];
      tip = 'M' + fmt(base[0] - uy * 0.21) + ' ' + fmt(base[1] + ux * 0.21) + 'L' + fmt(t[0]) + ' ' + fmt(t[1]) + 'L' + fmt(base[0] + uy * 0.21) + ' ' + fmt(base[1] - ux * 0.21);
    }
    return { body, tip, tail: line[0], head };
  }

  function drawArrow(i, s) {
    const g = arrowEls[i];
    if (!g) return;
    const shape = shapeAt(i, s);
    if (!shape) {
      g.style.display = 'none';
      return;
    }
    g.querySelectorAll('.halo, .glow, .wire').forEach((p) => p.setAttribute('d', shape.body));
    g.querySelector('.tip').setAttribute('d', shape.tip);
    const pad = g.querySelector('.pad');
    pad.setAttribute('cx', fmt(shape.tail[0]));
    pad.setAttribute('cy', fmt(shape.tail[1]));
  }

  function buildCore(p) {
    const g = el('g', { class: 'core' });
    const circ = 2 * Math.PI * 1.32;
    g.appendChild(el('circle', { class: 'meter-track', r: 1.32 }));
    const meter = el('circle', { class: 'meter', r: 1.32, transform: 'rotate(-90)', 'stroke-dasharray': fmt(circ), 'stroke-dashoffset': fmt(circ) });
    g.appendChild(meter);
    g.appendChild(el('circle', { class: 'shell', r: 1 }));
    const heart = el('circle', { class: 'heart', r: 0.62 });
    g.appendChild(heart);
    const flash = el('circle', { class: 'flash', r: 0.95 });
    g.appendChild(flash);
    return { g, meter, heart, flash, circ };
  }

  function updateCore() {
    if (!core) return;
    const n = game.puzzle.arrows.length;
    const p = n ? game.absorbed / n : 0;
    core.meter.setAttribute('stroke-dashoffset', fmt(core.circ * (1 - p)));
    core.heart.style.opacity = String(0.18 + 0.82 * p);
  }

  // The core takes in a trace: a flash in the trace's color and a ring of
  // light rippling out.
  function coreBurst(color, big) {
    if (!core || reduceMotion) return;
    core.heart.style.fill = color;
    core.flash.animate([{ opacity: big ? 1 : 0.75 }, { opacity: 0 }], { duration: big ? 700 : 380, easing: 'ease-out' });
    const rings = big ? 3 : 1;
    for (let r = 0; r < rings; r++) {
      const wave = el('circle', { class: 'wave', r: 1, stroke: color });
      core.g.insertBefore(wave, core.g.firstChild);
      wave.animate(
        [{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(' + (big ? 5 : 2.6) + ')', opacity: 0 }],
        { duration: big ? 900 : 600, delay: r * 160, easing: 'ease-out', fill: 'both' }
      );
      setTimeout(() => wave.remove(), (big ? 900 : 600) + r * 160 + 60);
    }
    setTimeout(() => {
      if (core) core.heart.style.fill = '';
    }, 420);
  }

  function buildBoard() {
    board.innerHTML = '';
    const p = game.puzzle;
    tray = document.createElement('div');
    tray.className = 'tray';
    svg = el('svg', { class: 'arrows', viewBox: '0 0 ' + p.w + ' ' + p.h, 'aria-hidden': 'true' });
    // The chip: cell lines, a via in every cell, and the bus around the rim.
    let gridPath = '';
    for (let x = 0; x <= p.w; x++) gridPath += 'M' + x + ' 0V' + p.h;
    for (let y = 0; y <= p.h; y++) gridPath += 'M0 ' + y + 'H' + p.w;
    svg.appendChild(el('path', { class: 'cellgrid', d: gridPath }));
    const vias = el('g');
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) vias.appendChild(el('circle', { class: 'via', cx: x + 0.5, cy: y + 0.5, r: 0.05 }));
    svg.appendChild(vias);
    svg.appendChild(el('rect', { class: 'bus', x: -RIM, y: -RIM, width: p.w + 2 * RIM, height: p.h + 2 * RIM }));
    paths = p.arrows.map((a, i) => trackOf(i));
    blockedBy = Core.blockers(p);
    arrowEls = p.arrows.map((a, i) => {
      const g = el('g', { class: 'arrow' });
      g.style.setProperty('--trace', colorOf(i).hex);
      ['halo', 'glow', 'wire', 'tip'].forEach((c) => g.appendChild(el('path', { class: c })));
      g.appendChild(el('circle', { class: 'pad', r: 0.14 }));
      svg.appendChild(g);
      return g;
    });
    // Traces already gone (a resumed run) are not drawn.
    arrowEls.forEach((g, i) => {
      if (game.gone[i]) {
        g.remove();
        arrowEls[i] = null;
      } else drawArrow(i, 0);
    });
    core = buildCore(p);
    svg.appendChild(core.g);
    updateCore();
    cursorEl = el('rect', { class: 'cursor', width: 0.9, height: 0.9, visibility: 'hidden' });
    svg.appendChild(cursorEl);
    board.appendChild(tray);
    board.appendChild(svg);
    hovered = -1;
    if (game.hinted >= 0 && arrowEls[game.hinted]) arrowEls[game.hinted].classList.add('hint');
    drawCursor();
    layout();
  }

  function layout() {
    if (!game.puzzle || !svg) return;
    const p = game.puzzle;
    const W = board.clientWidth;
    const H = board.clientHeight;
    const side = RIM + 0.45;
    const topPad = RIM + CORE_R * 1.32 + 0.35;
    cell = Math.max(8, Math.min(60, W / (p.w + side * 2), H / (p.h + side + topPad)));
    const tw = (p.w + side * 2) * cell;
    const th = (p.h + side + topPad) * cell;
    const left = (W - tw) / 2;
    const top = (H - th) / 2;
    Object.assign(tray.style, { left: left + 'px', top: top + 'px', width: tw + 'px', height: th + 'px' });
    tray.style.clipPath = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
    Object.assign(svg.style, { left: left + side * cell + 'px', top: top + topPad * cell + 'px', width: p.w * cell + 'px', height: p.h * cell + 'px' });
    // The core keeps a steady size on screen: never tiny on a big board,
    // never huge on a small one.
    const scale = Math.min(26, Math.max(15, cell * 0.5)) / cell;
    core.g.setAttribute('transform', 'translate(' + p.w / 2 + ' ' + -RIM + ') scale(' + fmt(scale) + ')');
  }

  // ---------- Animation ----------

  const easeIn = (t) => t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  // Speeds up over the first quarter, then runs at a steady speed.
  const LAUNCH = 0.25;
  const launch = (t) => (t < LAUNCH ? (t * t) / (2 * LAUNCH) : t - LAUNCH / 2) / (1 - LAUNCH / 2);

  // Slides trace i from one spot on its route to another.
  function slide(i, from, to, ms, ease) {
    const epoch = game.epoch;
    return new Promise((resolve) => {
      if (reduceMotion || ms <= 0) {
        drawArrow(i, to);
        resolve(epoch === game.epoch);
        return;
      }
      const start = performance.now();
      function frame(now) {
        if (epoch !== game.epoch) return resolve(false);
        const t = Math.min(1, (now - start) / ms);
        drawArrow(i, from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  // A burst of sparks where a short lands.
  function sparks(point) {
    if (reduceMotion) return;
    const r = svg.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const x = r.left - b.left + point[0] * cell;
    const y = r.top - b.top + point[1] * cell;
    for (let k = 0; k < 6; k++) {
      const s = document.createElement('i');
      s.className = 'puff';
      const ang = Math.random() * Math.PI * 2;
      const dist = cell * (0.35 + Math.random() * 0.5);
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(ang) * dist + 'px;--dy:' + Math.sin(ang) * dist + 'px';
      board.appendChild(s);
      setTimeout(() => s.remove(), 480);
    }
  }

  // ---------- Playing ----------

  function tap(i) {
    if (!game.puzzle || game.done || i < 0 || game.gone[i] || game.busy.has(i)) return;
    const result = Core.probe(game.puzzle, i, game.gone);
    if (result.free) leave(i);
    else short(i, result);
  }

  async function leave(i) {
    game.gone[i] = true;
    if (game.hinted === i) clearHint();
    if (hovered === i) setHover(-1);
    const total = game.puzzle.arrows.length;
    const remaining = left();
    Sound.unzip(paths[i].len);
    if (remaining === 1) say('Just one left!');
    else if (remaining === Math.floor(total / 2) && total >= 8) say('Halfway there!');
    else if (remaining > 0 && Math.random() < 0.18) say(pickFrom(CLEARS));
    updateHud();
    saveRun();
    const g = arrowEls[i];
    const color = colorOf(i).hex;
    const dist = paths[i].total;
    const ok = await slide(i, 0, dist, 260 + dist * 34, launch);
    if (!ok) return;
    if (g) g.remove();
    arrowEls[i] = null;
    game.absorbed++;
    updateCore();
    const allIn = game.absorbed === total;
    coreBurst(color, allIn);
    if (allIn) {
      Sound.overload();
      win();
    } else Sound.absorb(game.absorbed / total);
  }

  async function short(i, result) {
    game.bumps++;
    game.busy.add(i);
    const counter = $('bumpCount').parentElement;
    counter.classList.remove('bumped');
    void counter.offsetWidth;
    counter.classList.add('bumped');
    updateHud();
    saveRun();
    say('Short circuit! The ' + colorOf(result.by).name + ' trace is in the way.', true);
    const g = arrowEls[i];
    const reach = result.steps + 0.18;
    const epoch = game.epoch;
    await slide(i, 0, reach, 70 + result.steps * 38, easeIn);
    if (epoch !== game.epoch) return;
    Sound.short();
    if (g) g.classList.add('shorting');
    const blocker = arrowEls[result.by];
    if (blocker) {
      blocker.classList.add('zapped');
      setTimeout(() => blocker.classList.remove('zapped'), 260);
    }
    const contact = shapeAt(i, reach);
    if (contact) sparks(contact.head);
    await slide(i, reach, 0, 190 + result.steps * 22, easeOut);
    if (g) g.classList.remove('shorting');
    game.busy.delete(i);
  }

  // ---------- Tapping and pointing ----------

  // The trace under a point on the board, in cells. A tap a little off a
  // trace (in an empty cell or just past the edge) still finds it.
  function arrowAt(x, y) {
    const p = game.puzzle;
    const occ = Core.occupancy(p, game.gone);
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx >= 0 && cy >= 0 && cx < p.w && cy < p.h && occ[cy * p.w + cx] !== -1) return occ[cy * p.w + cx];
    let best = -1;
    let bestD = 0.45;
    for (let ny = cy - 1; ny <= cy + 1; ny++) {
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        const j = occ[ny * p.w + nx];
        if (j === -1) continue;
        const dx = Math.max(nx - x, 0, x - (nx + 1));
        const dy = Math.max(ny - y, 0, y - (ny + 1));
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
    }
    return best;
  }

  function pointToCells(e) {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left) / cell, (e.clientY - r.top) / cell];
  }

  function onPointerDown(e) {
    if (!game.puzzle || !svg || game.done || !e.isPrimary || e.button > 0) return;
    const [x, y] = pointToCells(e);
    const i = arrowAt(x, y);
    if (i >= 0) {
      e.preventDefault();
      hideCursor();
      tap(i);
    }
  }

  function onPointerMove(e) {
    if (e.pointerType !== 'mouse' || !game.puzzle || !svg) return;
    const [x, y] = pointToCells(e);
    setHover(game.done ? -1 : arrowAt(x, y));
  }

  function setHover(i) {
    if (i === hovered) return;
    if (hovered >= 0 && arrowEls[hovered]) arrowEls[hovered].classList.remove('hover');
    hovered = i;
    if (i >= 0 && arrowEls[i]) arrowEls[i].classList.add('hover');
    board.style.cursor = i >= 0 ? 'pointer' : '';
  }

  // Keyboard play: the arrow keys move a box around the board and Enter or
  // Space taps the trace inside it.
  function drawCursor() {
    if (!cursorEl) return;
    const c = game.cursor;
    if (!c) {
      cursorEl.setAttribute('visibility', 'hidden');
      return;
    }
    cursorEl.setAttribute('x', c[0] + 0.05);
    cursorEl.setAttribute('y', c[1] + 0.05);
    cursorEl.setAttribute('visibility', 'visible');
  }

  function hideCursor() {
    if (game.cursor) {
      game.cursor = null;
      drawCursor();
    }
  }

  function moveCursor(dx, dy) {
    const p = game.puzzle;
    const c = game.cursor || [Math.floor(p.w / 2), Math.floor(p.h / 2)];
    if (game.cursor) {
      c[0] = Math.min(p.w - 1, Math.max(0, c[0] + dx));
      c[1] = Math.min(p.h - 1, Math.max(0, c[1] + dy));
    }
    game.cursor = c;
    drawCursor();
  }

  // ---------- Tools ----------

  // The most useful free trace: the one holding up the most others.
  function bestHint() {
    const free = Core.freeArrows(game.puzzle, game.gone);
    let best = free[0];
    let most = -1;
    free.forEach((i) => {
      let n = 0;
      blockedBy.forEach((list, j) => !game.gone[j] && list.includes(i) && n++);
      if (n > most) {
        most = n;
        best = i;
      }
    });
    return best;
  }

  function showHint(i, free) {
    clearHint();
    if (i == null || i < 0) return;
    game.hinted = i;
    if (arrowEls[i]) arrowEls[i].classList.add('hint');
    if (!free) updateHud();
  }

  function clearHint() {
    if (game.hinted >= 0 && arrowEls[game.hinted]) arrowEls[game.hinted].classList.remove('hint');
    game.hinted = -1;
  }

  function hint() {
    if (!game.puzzle || game.done || left() === 0) return;
    // Asking again before the hinted trace is gone repeats it for free.
    if (game.hinted >= 0 && !game.gone[game.hinted]) {
      say('Try the glowing ' + colorOf(game.hinted).name + ' trace!');
      return;
    }
    if (game.hintsLeft <= 0) {
      say('No hints left. Restart to get them back!');
      return;
    }
    const i = bestHint();
    if (i == null) return;
    game.hintsLeft--;
    game.helped = true;
    showHint(i);
    Sound.hint();
    say('Try the glowing ' + colorOf(i).name + ' trace!');
    updateHud();
    saveRun();
  }

  function restart() {
    if (!game.puzzle) return;
    $('win').hidden = true;
    resetState();
    buildBoard();
    updateHud();
    Sound.whoosh();
    say('Fresh start! Every trace is back.');
    if (game.mode === 'level' && game.level === 1) showHint(bestHint(), true);
    saveRun();
  }

  // ---------- Winning ----------

  function win() {
    if (game.done) return;
    game.done = true;
    clearRun();
    clearHint();
    setHover(-1);
    const n = game.puzzle.arrows.length;
    const stars = Core.starsFor(game.bumps, n, game.helped);
    if (game.mode === 'level') {
      const L = game.level;
      saved.stars[L] = Math.max(saved.stars[L] || 0, stars);
      saved.best[L] = saved.best[L] == null ? game.bumps : Math.min(saved.best[L], game.bumps);
      save();
    }
    updateHud();
    say(stars === 3 ? 'Core fully charged. Not a single short!' : 'Core fully charged! Great work!');
    const epoch = game.epoch;
    setTimeout(() => {
      if (!game.done || epoch !== game.epoch || screen !== 'play') return;
      Sound.win();
      confetti();
      showWin(stars);
    }, reduceMotion ? 100 : 750);
  }

  function showWin(stars) {
    const isLevel = game.mode === 'level';
    const n = game.puzzle.arrows.length;
    $('winSet').textContent = isLevel ? Core.setOf(game.level).name : 'Your board';
    $('winTitle').textContent = isLevel ? 'Level ' + game.level + ' cleared!' : 'Board cleared!';
    $('winStars').querySelectorAll('i').forEach((s, i) => s.classList.toggle('on', i < stars));
    $('winStars').setAttribute('aria-label', stars + (stars === 1 ? ' star' : ' stars'));
    const b = game.bumps;
    $('winStats').textContent = (b === 0 ? 'No shorts!' : b + (b === 1 ? ' short' : ' shorts')) + (game.helped ? ' · hint used' : '');
    let note;
    if (stars === 3) note = n + ' traces, every one routed clean.';
    else if (game.helped && b <= Core.bumpAllowance(n)) note = '3 stars: no shorts and no hints.';
    else note = '3 stars: no shorts. 2 stars: ' + Core.bumpAllowance(n) + ' shorts or fewer.';
    $('winNote').textContent = note;
    const code = $('winCode');
    code.hidden = isLevel;
    if (!isLevel) code.innerHTML = 'Board code <b>' + Core.codeOf(game.custom) + '</b> · share it so friends can play this one';
    $('nextBtn').querySelector('.big-label').textContent = isLevel ? 'Next level' : 'Build another';
    $('win').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
  }

  // A shower of sparks in the set's colors.
  function confetti() {
    if (reduceMotion) return;
    const canvas = $('confetti');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = game.palette.map((c) => COLORS[c]).concat(['#ffffff']);
    const bits = Array.from({ length: 130 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: -6 - Math.random() * 10,
      size: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      bits.forEach((b) => {
        b.vy += 0.3;
        b.vx *= 0.99;
        const px = b.x;
        const py = b.y;
        b.x += b.vx;
        b.y += b.vy;
        ctx.globalAlpha = Math.max(0, 1 - t / 2400);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
      if (t < 2400) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Settings ----------

  function setSound(on) {
    saved.sound = on;
    save();
    Sound.setEnabled(on);
    const btn = $('soundBtn');
    btn.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    btn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    btn.setAttribute('aria-pressed', String(on));
    $('soundToggle').checked = on;
  }

  // ---------- Wiring ----------

  function wire() {
    document.querySelectorAll('.icon-btn.back').forEach((b) => (b.innerHTML = ICONS.back));
    $('homeBtn').innerHTML = ICONS.menu;
    document.querySelector('#restartBtn .tool-icon').innerHTML = ICONS.restart;
    document.querySelector('#hintBtn .tool-icon').innerHTML = ICONS.hint;

    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
    $('playBtn').addEventListener('click', () => startLevel(nextLevel()));
    $('resumeBtn').addEventListener('click', () => saved.run && resumeRun(saved.run));

    // Every button and switch outside the board makes a sound: Play and
    // Build it get a jingle, the rest a tap. Moving the mouse onto anything
    // clickable pops. Touch screens have no hover, so that is mouse only.
    let hoveredControl = null;
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const found = e.target.closest('button, label.toggle, .trick label');
      if (found === hoveredControl) return;
      hoveredControl = found;
      const control = found && (found.matches('button') ? found : found.querySelector('input'));
      if (found && control && !control.disabled) Sound.pop();
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('button, input[type="checkbox"], input[type="radio"]');
      if (!t || t.disabled || t.closest('.tool, .step-btn, .preset')) return;
      if (['playBtn', 'resumeBtn', 'mixBtn', 'nextBtn'].includes(t.id)) Sound.jingle();
      else Sound.tap();
    });

    $('levelsBtn').addEventListener('click', () => {
      show('levels');
      scrollToCurrent();
    });
    $('jumpForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.floor(Number($('jumpInput').value));
      if (n >= 1 && n <= 9999) startLevel(n);
    });
    $('customBtn').addEventListener('click', () => show('custom'));
    $('homeBtn').addEventListener('click', () => {
      game.epoch++;
      show('home');
    });
    $('soundBtn').addEventListener('click', () => setSound(!saved.sound));
    $('soundToggle').addEventListener('change', (e) => setSound(e.target.checked));

    $('restartBtn').addEventListener('click', restart);
    $('hintBtn').addEventListener('click', hint);

    $('nextBtn').addEventListener('click', () => {
      $('win').hidden = true;
      if (game.mode === 'level') startLevel(game.level + 1);
      else startCustom(Object.assign({}, game.custom, { seed: 1000 + Math.floor(Math.random() * 9000) }));
    });
    $('replayBtn').addEventListener('click', restart);
    $('winClose').innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    $('winClose').addEventListener('click', () => ($('win').hidden = true));
    $('winHome').addEventListener('click', () => {
      game.epoch++;
      show('home');
    });

    document.querySelectorAll('.stepper').forEach((row) => {
      row.querySelectorAll('.step-btn').forEach((btn) =>
        btn.addEventListener('click', () => {
          saved.custom[row.dataset.key] += Number(btn.dataset.step);
          clampCustom();
          save();
          renderCustom();
          Sound.tap();
        })
      );
    });
    buildChoices();
    buildPresets();
    $('mixBtn').addEventListener('click', () => startCustom(newCustomSpec()));
    $('codeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const spec = Core.parseCode($('codeInput').value);
      const err = $('codeError');
      if (!spec) {
        err.hidden = false;
        err.textContent = 'That code does not look right. It should look like 0810121-4821.';
        return;
      }
      err.hidden = true;
      startCustom(spec);
    });

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointermove', onPointerMove);
    board.addEventListener('pointerleave', () => setHover(-1));

    document.addEventListener('keydown', (e) => {
      if (screen !== 'play' || e.metaKey || e.altKey || e.ctrlKey) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        if (!$('win').hidden) $('win').hidden = true;
        else hideCursor();
        return;
      }
      if (!$('win').hidden || !game.puzzle) return;
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[e.key]) {
        e.preventDefault();
        moveCursor(moves[e.key][0], moves[e.key][1]);
      } else if ((e.key === 'Enter' || e.key === ' ') && game.cursor && document.activeElement === board) {
        e.preventDefault();
        tap(arrowAt(game.cursor[0] + 0.5, game.cursor[1] + 0.5));
      } else if (e.key === 'h') hint();
    });

    let pending = false;
    const relayout = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (screen === 'play') layout();
      });
    };
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(board);
    else window.addEventListener('resize', relayout);
    let wireTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(wireTimer);
      wireTimer = setTimeout(drawWires, 200);
    });
  }

  // ---------- Pause and resume ----------

  // Everything needed to pick a run up again exactly where it was.
  function runSnapshot() {
    return {
      mode: game.mode,
      level: game.level,
      custom: game.custom,
      puzzle: game.puzzle,
      gone: game.gone.map((g, i) => (g ? i : -1)).filter((i) => i >= 0),
      bumps: game.bumps,
      hintsLeft: game.hintsLeft,
      helped: game.helped,
      hinted: game.hinted,
    };
  }

  /*
   * The current run is saved after every tap, so leaving for the home
   * screen, the level map, or another tab (or closing the page) loses
   * nothing. Winning clears it; starting a different level or a new board
   * replaces it.
   */
  function saveRun() {
    if (!game.puzzle || game.done) return;
    saved.run = runSnapshot();
    save();
  }

  function clearRun() {
    if (!saved.run) return;
    delete saved.run;
    save();
  }

  function resumeRun(g) {
    Object.assign(game, { mode: g.mode, level: g.level, custom: g.custom });
    const setIndex = g.mode === 'level' ? Core.setOf(g.level).index : CUSTOM_PALETTE;
    show('play');
    useSet(setIndex);
    game.palette = paletteOf(setIndex);
    $('setName').textContent = g.mode === 'level' ? Core.setOf(g.level).name : 'Your board';
    $('levelTitle').textContent = g.mode === 'level' ? 'Level ' + g.level : Core.codeOf(g.custom);
    game.puzzle = g.puzzle;
    resetState();
    (g.gone || []).forEach((i) => (game.gone[i] = true));
    Object.assign(game, {
      absorbed: (g.gone || []).length,
      bumps: g.bumps || 0,
      hintsLeft: g.hintsLeft == null ? Core.HINTS : g.hintsLeft,
      helped: !!g.helped,
      hinted: g.hinted >= 0 && !game.gone[g.hinted] ? g.hinted : -1,
    });
    buildBoard();
    updateHud();
    say(game.gone.some(Boolean) ? 'Welcome back! Pick up where you left off.' : 'Welcome back!');
    if (left() === 0) win();
    else saveRun();
  }

  function start() {
    drawWires();
    wire();
    setSound(saved.sound);
    show('home');
  }

  start();
})();
