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
  const SHAPES = [
    { value: 'flat', name: 'Flat', icon: '<rect x="3" y="2" width="20" height="10"/><path d="M9.7 2v10M16.3 2v10M3 7h20"/>' },
    { value: 'cube', name: 'Cube', icon: '<path d="M13 1.5 20 4.5v7L13 13l-7-1.5v-7z"/><path d="M6 4.5 13 7.5l7-3M13 7.5V13"/>' },
  ];

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
      custom: { shape: 'flat', w: 8, h: 10, n: 5, density: 1, length: 1, bend: 1 },
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
    c.shape = c.shape === 'cube' ? 'cube' : 'flat';
    c.w = Math.min(L.maxW, Math.max(L.minW, Math.round(c.w) || 8));
    c.h = Math.min(L.maxH, Math.max(L.minH, Math.round(c.h) || 10));
    c.n = Math.min(L.maxFace, Math.max(L.minFace, Math.round(c.n) || 5));
    CHOICE_KEYS.forEach((k) => (c[k] = Math.min(2, Math.max(0, Math.round(c[k]) || 0))));
  }

  function renderCustom() {
    clampCustom();
    const c = saved.custom;
    const L = Core.CUSTOM;
    $('wOut').textContent = c.w;
    $('hOut').textContent = c.h;
    $('nOut').textContent = c.n;
    const limits = { w: [L.minW, L.maxW], h: [L.minH, L.maxH], n: [L.minFace, L.maxFace] };
    const cubeShape = c.shape === 'cube';
    document.querySelectorAll('.stepper').forEach((row) => {
      const key = row.dataset.key;
      row.hidden = cubeShape ? key !== 'n' : key === 'n';
      row.querySelector('[data-step="-1"]').disabled = c[key] <= limits[key][0];
      row.querySelector('[data-step="1"]').disabled = c[key] >= limits[key][1];
    });
    document.querySelectorAll('input[name="shape"]').forEach((r) => {
      r.checked = r.value === c.shape;
      r.closest('label').classList.toggle('on', r.checked);
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
    return c.shape === 'flat' && ['w', 'h'].concat(CHOICE_KEYS).every((k) => p[k] === c[k]);
  }

  function applyPreset(p) {
    const before = customSnapshot();
    ['w', 'h'].concat(CHOICE_KEYS).forEach((k) => (saved.custom[k] = p[k]));
    saved.custom.shape = 'flat';
    save();
    renderCustom();
    flashChanges(before, customSnapshot());
  }

  // What each setting shows, to light up the ones a preset changed.
  function customSnapshot() {
    const c = saved.custom;
    return { shapeRow: c.shape, wOut: c.w, hOut: c.h, densityRow: c.density, lengthRow: c.length, bendRow: c.bend };
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
    const shapes = document.querySelector('.trick[data-key="shape"]');
    shapes.innerHTML = SHAPES.map(
      (c) =>
        '<label><input type="radio" name="shape" value="' + c.value + '"><span><b><svg class="ico" viewBox="0 0 26 14" aria-hidden="true">' +
        c.icon + '</svg></b><small>' + c.name + '</small></span></label>'
    ).join('');
    shapes.querySelectorAll('input').forEach((r) =>
      r.addEventListener('change', () => {
        saved.custom.shape = r.value;
        save();
        renderCustom();
      })
    );
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
    const c = saved.custom;
    const size = c.shape === 'cube' ? { n: c.n } : { w: c.w, h: c.h };
    return Object.assign({ shape: c.shape }, size, { density: c.density, length: c.length, bend: c.bend, seed: 1000 + Math.floor(Math.random() * 9000) });
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
    feeding: 0,
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
    $('setName').textContent = spec.shape === 'cube' ? 'Your cube' : 'Your board';
    $('levelTitle').textContent = Core.codeOf(spec);
    // Big boards take a moment to build, so show an empty board and a note
    // first and build on the next tick.
    game.puzzle = null;
    game.gone = [];
    game.epoch++;
    board.innerHTML = '';
    updateHud();
    say(spec.shape === 'cube' ? 'Building your cube…' : 'Building your board…');
    const epoch = game.epoch;
    setTimeout(() => {
      if (epoch !== game.epoch || screen !== 'play') return;
      let puzzle;
      try {
        puzzle = Core.generate(Core.customSpec(spec));
      } catch (err) {
        say("I couldn't build that one. Try different settings!");
        return;
      }
      setPuzzle(puzzle);
      say(spec.shape === 'cube' ? CUBE_INTRO : pickFrom(CHEERS));
      saveRun();
    }, 40);
  }

  const CUBE_INTRO = 'A cube! Drag to spin it. Each face is its own board, and traces can wrap over the edges.';

  const isCube = () => !!(game.puzzle && game.puzzle.kind === 'cube');

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
    game.feeding = 0;
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
    const started = !!game.puzzle && (game.bumps > 0 || game.gone.some(Boolean) || game.helped);
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
  const toPath = (line) => 'M' + line.map((q) => fmt(q[0]) + ' ' + fmt(q[1])).join('L');
  const TRAIL = 4.5; // cells of afterglow behind a charged trace

  // The points of the route between two distances along it.
  function slice(track, a, b) {
    const line = [pointAt(track, a)];
    for (let k = 1; k < track.pts.length; k++) if (track.at[k] > a + 1e-6 && track.at[k] < b - 1e-6) line.push(track.pts[k]);
    line.push(pointAt(track, b));
    return line;
  }

  // The direction of travel at a distance along the route.
  function dirAt(track, t) {
    const k = segmentAt(track, Math.max(0, Math.min(track.total, t) - 1e-6));
    const a = track.pts[k];
    const b = track.pts[k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  }

  // The trace's shape with its tail s cells along its route. Whatever has
  // passed the end of the route is inside the core and not drawn.
  function shapeAt(i, s) {
    const track = paths[i];
    if (s >= track.total) return null;
    const want = s + track.len - 1;
    const end = Math.min(want, track.total);
    const line = slice(track, s, end);
    const head = line[line.length - 1];
    let tip = '';
    if (want < track.total - 0.25) {
      const [ux, uy] = dirAt(track, end);
      const t = [head[0] + ux * 0.3, head[1] + uy * 0.3];
      const base = [t[0] - ux * 0.28, t[1] - uy * 0.28];
      tip = 'M' + fmt(base[0] - uy * 0.21) + ' ' + fmt(base[1] + ux * 0.21) + 'L' + fmt(t[0]) + ' ' + fmt(t[1]) + 'L' + fmt(base[0] + uy * 0.21) + ' ' + fmt(base[1] - ux * 0.21);
    }
    return { body: toPath(line), tip, tail: line[0], head, end };
  }

  // A crackling bolt along a charged trace: its route with a random
  // sideways jitter, redrawn every frame so it flickers.
  function boltPath(track, a, b) {
    if (b - a < 0.05) return '';
    const pts = [];
    for (let t = a; t < b; t += 0.2) {
      const q = pointAt(track, t);
      const [ux, uy] = dirAt(track, t);
      const j = (Math.random() - 0.5) * 0.24;
      pts.push([q[0] - uy * j, q[1] + ux * j]);
    }
    pts.push(pointAt(track, b));
    return toPath(pts);
  }

  function drawArrow(i, s) {
    const g = arrowEls[i];
    if (!g) return;
    const track = paths[i];
    const shape = shapeAt(i, s);
    const body = shape ? shape.body : '';
    g.querySelectorAll('.halo, .glow, .wire').forEach((p) => p.setAttribute('d', body));
    g.querySelector('.tip').setAttribute('d', shape ? shape.tip : '');
    const pad = g.querySelector('.pad');
    if (shape) {
      pad.setAttribute('cx', fmt(shape.tail[0]));
      pad.setAttribute('cy', fmt(shape.tail[1]));
      pad.removeAttribute('visibility');
    } else pad.setAttribute('visibility', 'hidden');
    if (!g.classList.contains('energized')) return;
    // A charged trace leaves an afterglow on the route behind it.
    const a = Math.max(0, s - TRAIL);
    const b = Math.min(s, track.total);
    const near = Math.max(0, s - TRAIL * 0.4);
    g.querySelector('.trail').setAttribute('d', b > a ? toPath(slice(track, a, b)) : '');
    g.querySelector('.trail2').setAttribute('d', b > near ? toPath(slice(track, near, b)) : '');
    g.querySelector('.bolt').setAttribute('d', shape ? boltPath(track, s, shape.end) : '');
    // A second, fainter bolt reaches back into the afterglow.
    g.querySelector('.bolt2').setAttribute('d', b > near ? boltPath(track, near, shape ? shape.end : b) : '');
  }

  /*
   * The core is a battery: a ring of charge cells around a heart that
   * glows brighter as it fills. Each trace that arrives lights its share of
   * the cells.
   */
  const CHARGE_CELLS = 12;
  const RING_R = 1.34;

  function buildCore() {
    const g = el('g', { class: 'core' });
    const circ = 2 * Math.PI * RING_R;
    const seg = circ / CHARGE_CELLS;
    const turn = 'rotate(' + fmt(-90 + (360 / CHARGE_CELLS) * 0.14) + ')';
    g.appendChild(el('circle', { class: 'meter-track', r: RING_R, transform: turn, 'stroke-dasharray': fmt(seg * 0.72) + ' ' + fmt(seg * 0.28) }));
    const meter = el('circle', { class: 'meter', r: RING_R, transform: turn });
    g.appendChild(meter);
    g.appendChild(el('circle', { class: 'shell', r: 1 }));
    const heart = el('circle', { class: 'heart', r: 0.62 });
    g.appendChild(heart);
    const flash = el('circle', { class: 'flash', r: 0.95 });
    g.appendChild(flash);
    return { g, meter, heart, flash, circ, seg };
  }

  function updateCore() {
    if (!core) return;
    const n = game.puzzle.arrows.length;
    const p = n ? game.absorbed / n : 0;
    const lit = Math.round(p * CHARGE_CELLS);
    const dash = [];
    for (let k = 0; k < lit; k++) dash.push(fmt(core.seg * 0.72), fmt(core.seg * 0.28));
    core.meter.setAttribute('stroke-dasharray', (dash.length ? dash.join(' ') + ' ' : '') + '0 ' + fmt(core.circ * 2));
    core.heart.style.opacity = String(0.2 + 0.8 * p);
  }

  // Short jagged arcs of lightning jumping off the core.
  function arcs(color, count) {
    for (let k = 0; k < count; k++) {
      const ang = Math.random() * Math.PI * 2;
      const pts = [];
      for (let r = 0; r <= 4; r++) {
        const rad = 1.05 + r * (0.32 + Math.random() * 0.12);
        const wob = ang + (Math.random() - 0.5) * 0.5;
        pts.push([Math.cos(wob) * rad, Math.sin(wob) * rad]);
      }
      const arc = el('path', { class: 'arc', d: toPath(pts), stroke: Math.random() < 0.5 ? '#ffffff' : color });
      core.g.appendChild(arc);
      arc.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 0.9 }, { opacity: 0 }], { duration: 260, delay: k * 40, fill: 'both' });
      setTimeout(() => arc.remove(), 320 + k * 40);
    }
  }

  // The core takes in a trace: a flash in its color, arcs of lightning, and
  // a ring of light rippling out.
  function coreBurst(color, big) {
    if (!core || reduceMotion) return;
    core.heart.style.fill = color;
    core.flash.animate([{ opacity: big ? 1 : 0.8 }, { opacity: 0 }], { duration: big ? 700 : 380, easing: 'ease-out' });
    arcs(color, big ? 9 : 4);
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
    if (isCube()) return cubeBuild();
    board.innerHTML = '';
    const p = game.puzzle;
    stage = document.createElement('div');
    stage.className = 'stage';
    tray = document.createElement('div');
    tray.className = 'tray';
    svg = el('svg', { class: 'arrows', viewBox: '0 0 ' + p.w + ' ' + p.h, 'aria-hidden': 'true' });
    // The chip: a framed grid of cell tiles, labeled like a circuit board
    // (columns A, B, C..., rows 1, 2, 3...), and the bus around the rim.
    svg.appendChild(el('rect', { class: 'bus', x: -RIM, y: -RIM, width: p.w + 2 * RIM, height: p.h + 2 * RIM }));
    svg.appendChild(el('rect', { class: 'chip', x: -0.12, y: -0.12, width: p.w + 0.24, height: p.h + 0.24, rx: 0.14 }));
    const tiles = el('g', { class: 'tiles' });
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) tiles.appendChild(el('rect', { x: x + 0.07, y: y + 0.07, width: 0.86, height: 0.86, rx: 0.1 }));
    svg.appendChild(tiles);
    const silk = el('g', { class: 'silk' });
    for (let x = 0; x < p.w; x++) {
      const t = el('text', { x: x + 0.5, y: p.h + 0.42 });
      t.textContent = columnName(x);
      silk.appendChild(t);
    }
    for (let y = 0; y < p.h; y++) {
      const t = el('text', { x: -0.42, y: y + 0.5 });
      t.textContent = y + 1;
      silk.appendChild(t);
    }
    svg.appendChild(silk);
    paths = p.arrows.map((a, i) => trackOf(i));
    blockedBy = Core.blockers(p);
    arrowEls = p.arrows.map((a, i) => {
      const g = el('g', { class: 'arrow' });
      g.style.setProperty('--trace', colorOf(i).hex);
      ['halo', 'trail', 'trail2', 'glow', 'wire', 'tip', 'bolt', 'bolt2'].forEach((c) => g.appendChild(el('path', { class: c })));
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
    core = buildCore();
    svg.appendChild(core.g);
    updateCore();
    cursorEl = el('rect', { class: 'cursor', width: 0.9, height: 0.9, visibility: 'hidden' });
    svg.appendChild(cursorEl);
    stage.appendChild(tray);
    stage.appendChild(svg);
    board.appendChild(stage);
    zoomTools = document.createElement('div');
    zoomTools.className = 'zoom-tools';
    zoomTools.innerHTML =
      '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>' +
      '<button type="button" data-zoom="out" aria-label="Zoom out">−</button>' +
      '<button type="button" data-zoom="fit" aria-label="Fit the whole board"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>';
    zoomTools.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const W = board.clientWidth;
        const H = board.clientHeight;
        if (b.dataset.zoom === 'fit') {
          view.z = 1;
          applyView();
        } else zoomAt(b.dataset.zoom === 'in' ? 1.5 : 1 / 1.5, W / 2, H / 2);
        Sound.tap();
      })
    );
    zoomTools.addEventListener('pointerdown', (e) => e.stopPropagation());
    board.appendChild(zoomTools);
    view.z = 1;
    hovered = -1;
    if (game.hinted >= 0 && arrowEls[game.hinted]) arrowEls[game.hinted].classList.add('hint');
    drawCursor();
    layout();
  }

  // Column labels run A to Z, then AA, AB, and so on.
  function columnName(x) {
    return (x >= 26 ? String.fromCharCode(64 + Math.floor(x / 26)) : '') + String.fromCharCode(65 + (x % 26));
  }

  function layout() {
    if (isCube()) return cubeLayout();
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
    // Big boards can be zoomed until a cell is a comfortable tap size.
    view.box = { left, top, width: tw, height: th };
    view.maxZ = Math.max(1, 46 / cell);
    zoomTools.hidden = view.maxZ < 1.2;
    applyView();
  }

  // ---------- Zoom and pan (flat boards) ----------

  const view = { z: 1, x: 0, y: 0, maxZ: 1, box: null };
  let stage = null;
  let zoomTools = null;

  // Keeps the board in view: centered while it fits, edge to edge when
  // zoomed past the screen.
  function applyView() {
    if (!stage || !view.box) return;
    const W = board.clientWidth;
    const H = board.clientHeight;
    view.z = Math.min(view.maxZ, Math.max(1, view.z));
    const place = (size, start, len, pos) => {
      const scaled = len * view.z;
      if (scaled <= size) return (size - scaled) / 2 - start * view.z;
      return Math.min(-start * view.z, Math.max(size - (start + len) * view.z, pos));
    };
    view.x = place(W, view.box.left, view.box.width, view.x);
    view.y = place(H, view.box.top, view.box.height, view.y);
    stage.style.transform = 'translate(' + fmt(view.x) + 'px, ' + fmt(view.y) + 'px) scale(' + fmt(view.z) + ')';
    if (zoomTools) {
      zoomTools.querySelector('[data-zoom="in"]').disabled = view.z >= view.maxZ - 0.01;
      zoomTools.querySelector('[data-zoom="out"]').disabled = view.z <= 1.01;
      zoomTools.querySelector('[data-zoom="fit"]').disabled = view.z <= 1.01;
    }
  }

  // Zooms by a factor, keeping the point (in board pixels) where it is.
  function zoomAt(factor, px, py) {
    const z0 = view.z;
    const z1 = Math.min(view.maxZ, Math.max(1, z0 * factor));
    const sx = (px - view.x) / z0;
    const sy = (py - view.y) / z0;
    view.z = z1;
    view.x = px - sx * z1;
    view.y = py - sy * z1;
    applyView();
  }

  const zoomable = () => view.maxZ >= 1.2;

  // ---------- Animation ----------

  const easeIn = (t) => t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  // Speeds up over the first quarter, then runs at a steady speed.
  const LAUNCH = 0.25;
  const launch = (t) => (t < LAUNCH ? (t * t) / (2 * LAUNCH) : t - LAUNCH / 2) / (1 - LAUNCH / 2);

  // When launch() reaches a share of the way.
  function launchTime(f) {
    const k = 1 - LAUNCH / 2;
    const t = f * k + LAUNCH / 2;
    return t >= LAUNCH ? t : Math.sqrt(f * k * 2 * LAUNCH);
  }

  // Slides trace i from one spot on its route to another, telling onStep
  // where it is on every frame.
  function slide(i, from, to, ms, ease, onStep) {
    const epoch = game.epoch;
    return new Promise((resolve) => {
      if (reduceMotion || ms <= 0) {
        drawArrow(i, to);
        if (onStep) onStep(to);
        resolve(epoch === game.epoch);
        return;
      }
      const start = performance.now();
      function frame(now) {
        if (epoch !== game.epoch) return resolve(false);
        const t = Math.min(1, (now - start) / ms);
        const at = from + (to - from) * ease(t);
        drawArrow(i, at);
        if (onStep) onStep(at);
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
    const k = r.width / game.puzzle.w;
    const x = r.left - b.left + point[0] * k;
    const y = r.top - b.top + point[1] * k;
    for (let k = 0; k < 6; k++) {
      const s = document.createElement('i');
      s.className = 'puff';
      const ang = Math.random() * Math.PI * 2;
      const dist = k * (0.35 + Math.random() * 0.5);
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(ang) * dist + 'px;--dy:' + Math.sin(ang) * dist + 'px';
      board.appendChild(s);
      setTimeout(() => s.remove(), 480);
    }
  }

  // ---------- Playing ----------

  function tap(i) {
    if (!game.puzzle || game.done || i < 0 || game.gone[i] || game.busy.has(i)) return;
    const result = Core.probe(game.puzzle, i, game.gone);
    if (isCube()) {
      if (result.free) cubeLeave(i);
      else cubeShort(i, result);
    } else if (result.free) leave(i);
    else short(i, result);
  }

  /*
   * A free trace charges up: it turns white-hot with a bolt crackling
   * along it, runs its route trailing an afterglow, and pours into the
   * core. The core counts it once the whole trace is inside.
   */
  async function leave(i) {
    game.gone[i] = true;
    if (game.hinted === i) clearHint();
    if (hovered === i) setHover(-1);
    const total = game.puzzle.arrows.length;
    const remaining = left();
    if (remaining === 1) say('Just one left!');
    else if (remaining === Math.floor(total / 2) && total >= 8) say('Halfway there!');
    else if (remaining > 0 && Math.random() < 0.18) say(pickFrom(CLEARS));
    updateHud();
    saveRun();
    const g = arrowEls[i];
    const track = paths[i];
    const color = colorOf(i).hex;
    if (g) {
      g.classList.add('energized');
      svg.insertBefore(g, core.g); // charged traces run on top
    }
    const dist = track.total + TRAIL;
    const ms = 300 + dist * 36;
    Sound.charge((ms * launchTime(track.total / dist)) / 1000, game.absorbed / total);
    let feeding = false;
    let inside = false;
    const ok = await slide(i, 0, dist, ms, launch, (at) => {
      if (!feeding && at + track.len - 1 >= track.total) {
        feeding = true;
        setFeeding(1);
      }
      if (!inside && at >= track.total) {
        inside = true;
        setFeeding(-1);
        absorb(color);
      }
    });
    if (!ok) return;
    if (g) g.remove();
    arrowEls[i] = null;
  }

  // The core glows white while a trace is pouring into it.
  function setFeeding(change) {
    game.feeding = Math.max(0, game.feeding + change);
    if (core) core.g.classList.toggle('feeding', game.feeding > 0);
  }

  function absorb(color) {
    const total = game.puzzle.arrows.length;
    game.absorbed++;
    const full = game.absorbed === total;
    if (isCube()) cubeCharge(color, full);
    else {
      updateCore();
      coreBurst(color, full);
    }
    if (full) {
      Sound.overload();
      win();
    } else Sound.zap(game.absorbed / total);
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
    const k = r.width / game.puzzle.w;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }

  function boardPoint(e) {
    const b = board.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }

  /*
   * Pointers on a flat board. A small board taps on touch-down, for speed.
   * A board that can zoom waits for the finger to lift: a press that
   * hardly moved is a tap, a drag pans, and two fingers pinch to zoom.
   */
  const pointers = new Map();
  let gesture = null;

  function tapAt(e) {
    const [x, y] = pointToCells(e);
    const i = arrowAt(x, y);
    if (i >= 0) {
      hideCursor();
      tap(i);
    }
  }

  function onPointerDown(e) {
    if (isCube()) return cubeDown(e);
    if (!game.puzzle || !svg || game.done || e.button > 0) return;
    pointers.set(e.pointerId, boardPoint(e));
    if (!zoomable()) {
      if (e.isPrimary) {
        e.preventDefault();
        tapAt(e);
      }
      return;
    }
    e.preventDefault();
    if (board.setPointerCapture) board.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      gesture = { type: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: view.z, m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], x0: view.x, y0: view.y };
    } else if (pointers.size === 1) {
      const [x, y] = boardPoint(e);
      gesture = { type: 'press', sx: x, sy: y, x0: view.x, y0: view.y, moved: false };
    }
  }

  function onPointerMove(e) {
    if (isCube()) return cubeMove(e);
    if (!game.puzzle || !svg) return;
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, boardPoint(e));
      if (gesture && gesture.type === 'pinch' && pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values());
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const z1 = Math.min(view.maxZ, Math.max(1, gesture.z0 * (d / gesture.d0)));
        const sx = (gesture.m0[0] - gesture.x0) / gesture.z0;
        const sy = (gesture.m0[1] - gesture.y0) / gesture.z0;
        view.z = z1;
        view.x = m[0] - sx * z1;
        view.y = m[1] - sy * z1;
        applyView();
        return;
      }
      if (gesture && gesture.type === 'press') {
        const [x, y] = boardPoint(e);
        if (!gesture.moved && Math.hypot(x - gesture.sx, y - gesture.sy) > 8) {
          gesture.moved = true;
          board.classList.add('panning');
          setHover(-1);
        }
        if (gesture.moved) {
          view.x = gesture.x0 + (x - gesture.sx);
          view.y = gesture.y0 + (y - gesture.sy);
          applyView();
        }
        return;
      }
    }
    if (e.pointerType !== 'mouse') return;
    const [x, y] = pointToCells(e);
    setHover(game.done ? -1 : arrowAt(x, y));
  }

  function onPointerUp(e) {
    if (isCube()) return cubeUp(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.type === 'press' && !gesture.moved && e.type === 'pointerup' && !game.done) tapAt(e);
    if (gesture && gesture.type === 'pinch' && pointers.size === 1) {
      // One finger left after a pinch: carry on as a pan, not a tap.
      const [p] = Array.from(pointers.values());
      gesture = { type: 'press', sx: p[0], sy: p[1], x0: view.x, y0: view.y, moved: true };
      return;
    }
    if (!pointers.size) {
      gesture = null;
      board.classList.remove('panning');
    }
  }

  function onWheel(e) {
    if (isCube()) return cubeWheel(e);
    if (!zoomable()) return;
    e.preventDefault();
    const [x, y] = boardPoint(e);
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), x, y);
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
    if (isCube()) cubeShowHint(i);
    else if (arrowEls[i]) arrowEls[i].classList.add('hint');
    if (!free) updateHud();
  }

  function clearHint() {
    if (!isCube() && game.hinted >= 0 && arrowEls[game.hinted]) arrowEls[game.hinted].classList.remove('hint');
    game.hinted = -1;
    if (isCube()) cubeKick();
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
    $('winSet').textContent = isLevel ? Core.setOf(game.level).name : isCube() ? 'Your cube' : 'Your board';
    $('winTitle').textContent = isLevel ? 'Level ' + game.level + ' cleared!' : isCube() ? 'Cube cleared!' : 'Board cleared!';
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
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', onPointerUp);
    board.addEventListener('wheel', onWheel, { passive: false });
    board.addEventListener('pointerleave', () => (isCube() ? cubeHover(-1) : setHover(-1)));

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
      if (moves[e.key] && isCube()) {
        e.preventDefault();
        cubeTurn(moves[e.key][0] * 0.25, moves[e.key][1] * 0.25);
      } else if (moves[e.key]) {
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


  // ---------- The cube ----------

  /*
   * The cube is drawn on a canvas in 3D. Each face is its own board of
   * tiles; traces lie on the faces and may wrap over an edge. Only the
   * faces turned toward you are drawn, so you spin the cube to see the rest.
   * A trace whose lane is clear unzips to its face's edge and keeps going
   * straight out into space as a streak of energy, ending in a burst of
   * sparks, and the charge meter above the cube fills.
   */
  const CUBE_TILT = [0.34, 0.4, 1];
  const SPIN = 0.0105; // radians per pixel dragged

  const M3 = {
    mul(a, b) {
      const r = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      return r;
    },
    rx(t) {
      const c = Math.cos(t);
      const s = Math.sin(t);
      return [1, 0, 0, 0, c, -s, 0, s, c];
    },
    ry(t) {
      const c = Math.cos(t);
      const s = Math.sin(t);
      return [c, 0, s, 0, 1, 0, -s, 0, c];
    },
    // A turn of angle t about a unit axis.
    axis(a, t) {
      const c = Math.cos(t);
      const s = Math.sin(t);
      const k = 1 - c;
      const [x, y, z] = a;
      return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
    },
    apply(m, v) {
      return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
    },
  };

  const cube = {
    canvas: null,
    ctx: null,
    tip: null,
    W: 0,
    H: 0,
    dpr: 1,
    R: M3.mul(M3.rx(0.45), M3.ry(-0.62)),
    zoom: 1,
    s: 20,
    cx: 0,
    cy: 0,
    routes: [],
    anims: new Map(),
    particles: [],
    zaps: new Map(), // trace -> time it was hit by a short
    spin: { vx: 0, vy: 0 },
    focus: null,
    drag: null,
    hover: -1,
    meterFlash: 0,
    meterColor: '#ffffff',
    raf: 0,
    last: 0,
  };

  function cubeBuild() {
    board.innerHTML = '';
    stage = null;
    zoomTools = null;
    const p = game.puzzle;
    cube.canvas = document.createElement('canvas');
    cube.canvas.className = 'cube-canvas';
    cube.ctx = cube.canvas.getContext('2d');
    board.appendChild(cube.canvas);
    cube.tip = document.createElement('div');
    cube.tip.className = 'cube-tip';
    cube.tip.textContent = 'Drag to spin';
    board.appendChild(cube.tip);
    cube.routes = p.arrows.map((a, i) => cubeRoute(i));
    blockedBy = Core.blockers(p);
    cube.anims.clear();
    cube.zaps.clear();
    cube.particles = [];
    cube.hover = -1;
    cube.focus = null;
    cube.spin.vx = cube.spin.vy = 0;
    cubeLayout();
  }

  function cubeLayout() {
    if (!cube.canvas) return;
    const W = board.clientWidth;
    const H = board.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cube.W = W;
    cube.H = H;
    cube.dpr = dpr;
    cube.canvas.width = Math.round(W * dpr);
    cube.canvas.height = Math.round(H * dpr);
    const meter = 44;
    const n = game.puzzle.n;
    const L = Math.min(W, H - meter);
    cube.s = (L / (n * 1.85)) * cube.zoom;
    cube.cx = W / 2;
    cube.cy = meter + (H - meter) / 2;
    // The meter sits just above the cube however it is turned.
    cube.meterY = Math.max(22, cube.cy - n * 0.87 * cube.s * 1.18 - 20);
    cubeKick();
  }

  // Where a 3D point lands on screen, and how much nearer points grow.
  function project(p) {
    const n = game.puzzle.n;
    const q = M3.apply(cube.R, [p[0] - n / 2, p[1] - n / 2, p[2] - n / 2]);
    const D = n * 3.4;
    const k = D / (D - q[2]);
    return [cube.cx + q[0] * cube.s * k, cube.cy - q[1] * cube.s * k, k];
  }

  function faceFacing(f) {
    return M3.apply(cube.R, Core.CUBE_FACES[f].n)[2];
  }

  const shown = (f) => faceFacing(f) > 0.02;

  // A point on face f at face coordinates (a across, b down).
  function facePoint(f, a, b) {
    const F = Core.CUBE_FACES[f];
    const n = game.puzzle.n;
    return [F.o[0] * n + F.u[0] * a + F.v[0] * b, F.o[1] * n + F.u[1] * a + F.v[1] * b, F.o[2] * n + F.u[2] * a + F.v[2] * b];
  }

  const plus3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

  /*
   * A trace's route in 3D: its own cell centers (with a stop on the edge
   * wherever it wraps onto another face), then its lane to the edge of its
   * face, then straight on into space. Each segment remembers its face;
   * the part in space belongs to the head's face and shows with it.
   */
  function cubeRoute(i) {
    const p = game.puzzle;
    const n = p.n;
    const a = p.arrows[i];
    const pts = [];
    const faces = [];
    a.cells.forEach((c, k) => {
      const center = Core.cubeCenter(n, c[0], c[1], c[2]);
      if (k) {
        const prev = a.cells[k - 1];
        if (prev[0] !== c[0]) {
          pts.push(plus3(pts[pts.length - 1], Core.CUBE_FACES[c[0]].n, 0.5));
          faces.push(prev[0]);
        }
        faces.push(c[0]);
      }
      pts.push(center);
    });
    const head = a.cells[a.cells.length - 1];
    const hf = head[0];
    const step = Core.cubeStep(hf, Core.dirOf(a));
    const lane = Core.laneOf(p, i).length;
    const hp = pts[pts.length - 1];
    for (let j = 1; j <= lane; j++) {
      pts.push(plus3(hp, step, j));
      faces.push(hf);
    }
    pts.push(plus3(hp, step, lane + 0.5));
    faces.push(hf);
    const edgeIndex = pts.length - 1;
    pts.push(plus3(hp, step, lane + 0.5 + a.cells.length + 4));
    faces.push(hf);
    const at = [0];
    for (let k = 1; k < pts.length; k++) at.push(at[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]));
    return { pts, faces, at, total: at[at.length - 1], len: a.cells.length, edgeAt: at[edgeIndex], face: hf };
  }

  function routePoint(r, t) {
    const k = segmentAt(r, t);
    const a = r.pts[k];
    const b = r.pts[k + 1];
    const span = r.at[k + 1] - r.at[k] || 1;
    const f = Math.max(0, Math.min(1, (t - r.at[k]) / span));
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  // The route from a to b as runs of screen points, one run per stretch on
  // faces that are turned toward you.
  function routeRuns(r, a, b, jitter) {
    const runs = [];
    let run = null;
    const k0 = segmentAt(r, a);
    const k1 = segmentAt(r, Math.max(a, b - 1e-6));
    for (let k = k0; k <= k1; k++) {
      if (!shown(r.faces[k])) {
        run = null;
        continue;
      }
      const from = Math.max(a, r.at[k]);
      const to = Math.min(b, r.at[k + 1]);
      if (to <= from) continue;
      if (!run) {
        run = [];
        runs.push(run);
        run.push(project(routePoint(r, from)));
      }
      if (jitter) {
        const F = Core.CUBE_FACES[r.faces[k]];
        const A = r.pts[k];
        const B = r.pts[k + 1];
        const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1;
        const dir = [(B[0] - A[0]) / L, (B[1] - A[1]) / L, (B[2] - A[2]) / L];
        const side = [F.n[1] * dir[2] - F.n[2] * dir[1], F.n[2] * dir[0] - F.n[0] * dir[2], F.n[0] * dir[1] - F.n[1] * dir[0]];
        for (let t = from + 0.2; t < to; t += 0.2) run.push(project(plus3(routePoint(r, t), side, (Math.random() - 0.5) * 0.24)));
      }
      run.push(project(routePoint(r, to)));
    }
    return runs;
  }

  function strokeRuns(ctx, runs) {
    runs.forEach((run) => {
      if (run.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(run[0][0], run[0][1]);
      for (let k = 1; k < run.length; k++) ctx.lineTo(run[k][0], run[k][1]);
      ctx.stroke();
    });
  }

  // The head's open arrow, lying flat on its face.
  function chevron(r, end) {
    const k = segmentAt(r, Math.max(0, end - 1e-6));
    if (!shown(r.faces[k])) return null;
    const A = r.pts[k];
    const B = r.pts[k + 1];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1;
    const dir = [(B[0] - A[0]) / L, (B[1] - A[1]) / L, (B[2] - A[2]) / L];
    const N = Core.CUBE_FACES[r.faces[k]].n;
    const side = [N[1] * dir[2] - N[2] * dir[1], N[2] * dir[0] - N[0] * dir[2], N[0] * dir[1] - N[1] * dir[0]];
    const head = routePoint(r, end);
    const tip = plus3(head, dir, 0.3);
    const base = plus3(tip, dir, -0.28);
    return [project(plus3(base, side, 0.21)), project(tip), project(plus3(base, side, -0.21))];
  }

  function shade(rgb, k) {
    return 'rgb(' + rgb.map((v) => Math.round(v * k)).join(',') + ')';
  }

  function cubeDraw(now) {
    const ctx = cube.ctx;
    const p = game.puzzle;
    if (!ctx || !p) return;
    const n = p.n;
    ctx.setTransform(cube.dpr, 0, 0, cube.dpr, 0, 0);
    ctx.clearRect(0, 0, cube.W, cube.H);
    // Faces turned toward you, with their tiles.
    for (let f = 0; f < 6; f++) {
      const facing = faceFacing(f);
      if (facing <= 0.02) continue;
      const light = 0.55 + 0.45 * facing;
      const corners = [facePoint(f, 0, 0), facePoint(f, n, 0), facePoint(f, n, n), facePoint(f, 0, n)].map(project);
      ctx.beginPath();
      corners.forEach((c, k) => (k ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
      ctx.closePath();
      ctx.fillStyle = shade([10, 34, 39], light);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80, 240, 200, ' + (0.25 + 0.3 * facing).toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = shade([20, 58, 66], light);
      ctx.strokeStyle = 'rgba(80, 240, 200, ' + (0.08 + 0.1 * facing).toFixed(2) + ')';
      ctx.lineWidth = 1;
      for (let v = 0; v < n; v++) {
        for (let u = 0; u < n; u++) {
          const q = [facePoint(f, u + 0.08, v + 0.08), facePoint(f, u + 0.92, v + 0.08), facePoint(f, u + 0.92, v + 0.92), facePoint(f, u + 0.08, v + 0.92)].map(project);
          ctx.beginPath();
          ctx.moveTo(q[0][0], q[0][1]);
          ctx.lineTo(q[1][0], q[1][1]);
          ctx.lineTo(q[2][0], q[2][1]);
          ctx.lineTo(q[3][0], q[3][1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    // Traces at rest, then moving ones on top.
    const lw = Math.max(1.5, cube.s * 0.12);
    ctx.lineJoin = 'miter';
    const order = [];
    p.arrows.forEach((a, i) => {
      if (!game.gone[i] && !cube.anims.has(i)) order.push(i);
    });
    cube.anims.forEach((x, i) => order.push(i));
    order.forEach((i) => {
      const r = cube.routes[i];
      const anim = cube.anims.get(i);
      const s = anim ? anim.s : 0;
      const charged = anim && anim.mode === 'leave';
      const shorting = anim && anim.mode === 'short' && anim.hit;
      const zapped = cube.zaps.has(i) && now - cube.zaps.get(i) < 260;
      const color = shorting ? '#ff5d73' : colorOf(i).hex;
      const end = s + r.len - 1;
      const fade = charged && s > r.edgeAt ? Math.max(0, 1 - (s - r.edgeAt) / (r.len + 3)) : 1;
      ctx.globalAlpha = fade;
      ctx.lineCap = 'round';
      if (game.hinted === i && !charged) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + 0.32 * (0.5 + 0.5 * Math.sin(now / 160))).toFixed(2) + ')';
        ctx.lineWidth = lw * 5.5;
        strokeRuns(ctx, routeRuns(r, s, end));
      }
      if (charged) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3 * fade;
        ctx.lineWidth = lw * 4;
        strokeRuns(ctx, routeRuns(r, Math.max(0, s - TRAIL), s));
        ctx.globalAlpha = 0.85 * fade;
        ctx.lineWidth = lw * 1.4;
        strokeRuns(ctx, routeRuns(r, Math.max(0, s - TRAIL * 0.4), s));
        ctx.globalAlpha = fade;
      }
      const runs = routeRuns(r, s, end);
      ctx.strokeStyle = zapped ? '#ffffff' : color;
      ctx.globalAlpha = (charged ? 0.5 : cube.hover === i ? 0.32 : 0.17) * fade;
      ctx.lineWidth = lw * (charged ? 5 : 3);
      strokeRuns(ctx, runs);
      ctx.globalAlpha = fade;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = zapped || charged || cube.hover === i || game.hinted === i ? mixWhite(color, charged || zapped ? 0.6 : 0.4) : color;
      ctx.lineWidth = lw * (charged ? 1.25 : 1);
      strokeRuns(ctx, runs);
      const chev = end < r.total - 0.3 ? chevron(r, end) : null;
      if (chev) {
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(chev[0][0], chev[0][1]);
        ctx.lineTo(chev[1][0], chev[1][1]);
        ctx.lineTo(chev[2][0], chev[2][1]);
        ctx.stroke();
      }
      // The pad at the tail.
      const tk = segmentAt(r, s);
      if (shown(r.faces[tk]) && s < r.edgeAt + 0.5) {
        const t = project(routePoint(r, s));
        ctx.beginPath();
        ctx.arc(t[0], t[1], Math.max(2, cube.s * 0.14 * t[2]), 0, Math.PI * 2);
        ctx.fillStyle = '#0a1f24';
        ctx.fill();
        ctx.lineWidth = Math.max(1.2, cube.s * 0.075);
        ctx.stroke();
      }
      if (charged) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, lw * 0.55);
        ctx.lineJoin = 'bevel';
        strokeRuns(ctx, routeRuns(r, s, end, true));
        ctx.globalAlpha = 0.7 * fade;
        ctx.strokeStyle = mixWhite(color, 0.5);
        ctx.lineWidth = Math.max(1, lw * 0.35);
        strokeRuns(ctx, routeRuns(r, Math.max(0, s - TRAIL * 0.4), end, true));
        ctx.lineJoin = 'miter';
      }
      ctx.globalAlpha = 1;
    });
    // Sparks.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    cube.particles.forEach((q) => {
      const life = 1 - q.age / q.max;
      ctx.globalAlpha = Math.max(0, life);
      ctx.strokeStyle = q.color;
      ctx.lineWidth = q.size;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - q.vx * 30, q.y - q.vy * 30);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    cubeDrawMeter(now);
  }

  function mixWhite(hex, k) {
    const v = parseInt(hex.slice(1), 16);
    const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x + (255 - x) * k));
    return 'rgb(' + c.join(',') + ')';
  }

  // The charge meter above the cube: a ring of cells that light up as
  // traces leave, around a heart that brightens.
  function cubeDrawMeter(now) {
    const ctx = cube.ctx;
    const total = game.puzzle.arrows.length;
    const p = total ? game.absorbed / total : 0;
    const lit = Math.round(p * CHARGE_CELLS);
    const x = cube.W / 2;
    const y = cube.meterY || 24;
    const R = 15;
    const lab = getComputedStyle(document.documentElement).getPropertyValue('--lab').trim() || '#2fe6b4';
    const gap = 0.08;
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    for (let k = 0; k < CHARGE_CELLS; k++) {
      const a0 = -Math.PI / 2 + (k / CHARGE_CELLS) * Math.PI * 2 + gap;
      const a1 = -Math.PI / 2 + ((k + 1) / CHARGE_CELLS) * Math.PI * 2 - gap;
      ctx.strokeStyle = k < lit ? lab : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(x, y, R, a0, a1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#072324';
    ctx.fill();
    ctx.strokeStyle = lab;
    ctx.lineWidth = 2;
    ctx.stroke();
    const flash = Math.max(0, 1 - (now - cube.meterFlash) / 420);
    ctx.globalAlpha = 0.2 + 0.8 * p;
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = flash > 0 ? cube.meterColor : lab;
    ctx.fill();
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.beginPath();
      ctx.arc(x, y, R + 10 * (1 - flash), 0, Math.PI * 2);
      ctx.strokeStyle = cube.meterColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, color, count, speed) {
    if (reduceMotion) return;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      cube.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, max: 380 + Math.random() * 300, size: 1.2 + Math.random() * 1.8, color: Math.random() < 0.4 ? '#ffffff' : color });
    }
  }

  function cubeKick() {
    if (!cube.raf && cube.canvas) cube.raf = requestAnimationFrame(cubeFrame);
  }

  function cubeTurn(dx, dy) {
    cube.R = M3.mul(M3.rx(dy), M3.mul(M3.ry(dx), cube.R));
    if (cube.tip) cube.tip.style.opacity = '0';
    cubeKick();
  }

  function cubeFrame(now) {
    cube.raf = 0;
    if (!isCube() || !cube.canvas || screen !== 'play') return;
    const dt = Math.min(50, now - (cube.last || now));
    cube.last = now;
    let active = false;
    // Spin keeps going for a moment after a flick.
    if (!cube.drag && Math.abs(cube.spin.vx) + Math.abs(cube.spin.vy) > 0.00003) {
      cubeTurn(cube.spin.vx * dt, cube.spin.vy * dt);
      const decay = Math.pow(0.9, dt / 16);
      cube.spin.vx *= decay;
      cube.spin.vy *= decay;
      active = true;
    }
    // A hint turns the cube to face the hinted trace.
    if (cube.focus) {
      const f = cube.focus;
      const t = Math.min(1, (now - f.start) / f.ms);
      const a = f.angle * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      cube.R = M3.mul(M3.axis(f.axis, a - f.done), cube.R);
      f.done = a;
      if (t >= 1) cube.focus = null;
      active = true;
    }
    // Traces on the move.
    cube.anims.forEach((anim, i) => {
      if (anim.epoch !== game.epoch) {
        cube.anims.delete(i);
        return;
      }
      active = true;
      const t = anim.ms > 0 ? (now - anim.start) / anim.ms : 1;
      if (anim.mode === 'leave') {
        anim.s = anim.stop * launch(Math.min(1, t));
        const r = cube.routes[i];
        if (!anim.counted && anim.s >= r.edgeAt) {
          anim.counted = true;
          const out = project(routePoint(r, r.edgeAt + 0.4));
          if (shown(r.face)) burst(out[0], out[1], colorOf(i).hex, 16, 0.32);
          absorb(colorOf(i).hex);
        }
        if (t >= 1) {
          const tail = project(routePoint(r, anim.s + r.len - 1));
          if (shown(r.face)) burst(tail[0], tail[1], colorOf(i).hex, 10, 0.22);
          cube.anims.delete(i);
        }
      } else {
        // A short: lurch forward, hit, settle back.
        const forward = anim.t1;
        const back = anim.t2;
        const ms = now - anim.start;
        if (ms < forward) anim.s = anim.reach * easeIn(ms / forward);
        else {
          if (!anim.hit) {
            anim.hit = true;
            Sound.short();
            cube.zaps.set(anim.by, now);
            const r = cube.routes[i];
            const c = project(routePoint(r, anim.reach + r.len - 1 + 0.3));
            if (shown(r.face)) burst(c[0], c[1], '#ff5d73', 9, 0.2);
          }
          anim.s = anim.reach * (1 - easeOut(Math.min(1, (ms - forward) / back)));
          if (ms >= forward + back) {
            cube.anims.delete(i);
            game.busy.delete(i);
          }
        }
      }
    });
    if (cube.particles.length) {
      active = true;
      cube.particles = cube.particles.filter((q) => {
        q.age += dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.97;
        q.vy *= 0.97;
        return q.age < q.max;
      });
    }
    if (game.hinted >= 0 || now - cube.meterFlash < 450) active = true;
    cube.zaps.forEach((t, i) => (now - t < 280 ? (active = true) : cube.zaps.delete(i)));
    cubeDraw(now);
    if (active) cubeKick();
    else cube.last = 0;
  }

  function cubeLeave(i) {
    game.gone[i] = true;
    if (game.hinted === i) clearHint();
    const total = game.puzzle.arrows.length;
    const remaining = left();
    if (remaining === 1) say('Just one left!');
    else if (remaining === Math.floor(total / 2) && total >= 8) say('Halfway there!');
    else if (remaining > 0 && Math.random() < 0.18) say(pickFrom(CLEARS));
    updateHud();
    saveRun();
    const r = cube.routes[i];
    const stop = r.edgeAt + r.len + 3;
    const ms = reduceMotion ? 0 : 300 + stop * 36;
    Sound.charge(((ms || 300) * launchTime(r.edgeAt / stop)) / 1000, game.absorbed / total);
    cube.anims.set(i, { mode: 'leave', start: performance.now(), ms, stop, s: 0, counted: false, epoch: game.epoch });
    cubeKick();
  }

  function cubeShort(i, result) {
    game.bumps++;
    game.busy.add(i);
    const counter = $('bumpCount').parentElement;
    counter.classList.remove('bumped');
    void counter.offsetWidth;
    counter.classList.add('bumped');
    updateHud();
    saveRun();
    say('Short circuit! The ' + colorOf(result.by).name + ' trace is in the way.', true);
    const reach = result.steps + 0.18;
    const slow = reduceMotion ? 0 : 1;
    cube.anims.set(i, { mode: 'short', start: performance.now(), reach, by: result.by, t1: (70 + result.steps * 38) * slow, t2: (190 + result.steps * 22) * slow, s: 0, hit: false, epoch: game.epoch });
    cubeKick();
  }

  // The core's job on the cube: the meter flashes the trace's color.
  function cubeCharge(color, full) {
    cube.meterFlash = performance.now();
    cube.meterColor = color;
    burst(cube.W / 2, cube.meterY || 24, color, full ? 30 : 8, full ? 0.4 : 0.18);
    cubeKick();
  }

  // Turns the cube so the face holding the trace's head looks at you,
  // tilted a little so its neighbors show.
  function cubeShowHint(i) {
    const face = game.puzzle.arrows[i].cells[game.puzzle.arrows[i].cells.length - 1][0];
    const v = M3.apply(cube.R, Core.CUBE_FACES[face].n);
    const L = Math.hypot(CUBE_TILT[0], CUBE_TILT[1], CUBE_TILT[2]);
    const want = CUBE_TILT.map((x) => x / L);
    const axis = [v[1] * want[2] - v[2] * want[1], v[2] * want[0] - v[0] * want[2], v[0] * want[1] - v[1] * want[0]];
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    const angle = Math.acos(Math.max(-1, Math.min(1, v[0] * want[0] + v[1] * want[1] + v[2] * want[2])));
    cube.spin.vx = cube.spin.vy = 0;
    if (len > 1e-6 && angle > 0.05) cube.focus = { axis: axis.map((x) => x / len), angle, done: 0, start: performance.now(), ms: reduceMotion ? 1 : 520 };
    cubeKick();
  }

  // The trace under a point on the canvas, or -1. A tap a little off a
  // trace on the same face still finds it.
  function cubeHit(x, y) {
    const p = game.puzzle;
    const n = p.n;
    const g = Core.geometryOf(p);
    const occ = Core.occupancy(p, game.gone);
    const inQuad = (q) => {
      let sign = 0;
      for (let k = 0; k < 4; k++) {
        const a = q[k];
        const b = q[(k + 1) % 4];
        const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (c !== 0) {
          if (sign && Math.sign(c) !== sign) return false;
          sign = Math.sign(c);
        }
      }
      return true;
    };
    for (let f = 0; f < 6; f++) {
      if (!shown(f)) continue;
      for (let v = 0; v < n; v++) {
        for (let u = 0; u < n; u++) {
          const q = [facePoint(f, u, v), facePoint(f, u + 1, v), facePoint(f, u + 1, v + 1), facePoint(f, u, v + 1)].map(project);
          if (!inQuad(q)) continue;
          const here = occ[g.key([f, u, v])];
          if (here !== -1) return here;
          // An empty cell: take the nearest trace next to it on this face.
          let best = -1;
          let bestD = Infinity;
          const size = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
          for (let dv = -1; dv <= 1; dv++) {
            for (let du = -1; du <= 1; du++) {
              const uu = u + du;
              const vv = v + dv;
              if (uu < 0 || vv < 0 || uu >= n || vv >= n) continue;
              const j = occ[g.key([f, uu, vv])];
              if (j === -1) continue;
              const c = project(facePoint(f, uu + 0.5, vv + 0.5));
              const d = Math.hypot(c[0] - x, c[1] - y);
              if (d < bestD && d < size * 0.95) {
                bestD = d;
                best = j;
              }
            }
          }
          return best;
        }
      }
    }
    return -1;
  }

  function canvasPoint(e) {
    const r = cube.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // Drag to spin; a press that hardly moves is a tap.
  function cubeDown(e) {
    if (!cube.canvas || e.button > 0 || !e.isPrimary) return;
    e.preventDefault();
    if (cube.canvas.setPointerCapture) cube.canvas.setPointerCapture(e.pointerId);
    const [x, y] = canvasPoint(e);
    cube.drag = { id: e.pointerId, x0: x, y0: y, lx: x, ly: y, lt: performance.now(), moved: false };
    cube.spin.vx = cube.spin.vy = 0;
    cube.focus = null;
  }

  function cubeMove(e) {
    if (!cube.canvas) return;
    const [x, y] = canvasPoint(e);
    const d = cube.drag;
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 7) {
        d.moved = true;
        board.classList.add('spinning');
        cubeHover(-1);
      }
      if (d.moved) {
        const now = performance.now();
        const dt = Math.max(1, now - d.lt);
        const dx = (x - d.lx) * SPIN;
        const dy = (y - d.ly) * SPIN;
        cubeTurn(dx, dy);
        cube.spin.vx = cube.spin.vx * 0.5 + (dx / dt) * 0.5;
        cube.spin.vy = cube.spin.vy * 0.5 + (dy / dt) * 0.5;
        d.lx = x;
        d.ly = y;
        d.lt = now;
      }
      return;
    }
    if (e.pointerType === 'mouse' && game.puzzle && !game.done) cubeHover(cubeHit(x, y));
  }

  function cubeUp(e) {
    const d = cube.drag;
    if (!d || d.id !== e.pointerId) return;
    cube.drag = null;
    board.classList.remove('spinning');
    if (!d.moved && e.type === 'pointerup' && !game.done) {
      const [x, y] = canvasPoint(e);
      const i = cubeHit(x, y);
      if (i >= 0) tap(i);
    } else if (performance.now() - d.lt > 80) {
      cube.spin.vx = cube.spin.vy = 0; // held still before letting go
    }
    cubeKick();
  }

  function cubeHover(i) {
    if (i === cube.hover) return;
    cube.hover = i;
    board.style.cursor = i >= 0 ? 'pointer' : '';
    cubeKick();
  }

  function cubeWheel(e) {
    e.preventDefault();
    cube.zoom = Math.min(2.4, Math.max(0.6, cube.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
    cubeLayout();
  }

  // For the browser play-test: where a trace's first visible cell is on
  // screen, if any of it faces you.
  window.__unfoldTest = {
    cubePoint(i) {
      if (!isCube() || !cube.canvas) return null;
      const r = cube.canvas.getBoundingClientRect();
      for (const c of game.puzzle.arrows[i].cells) {
        if (!shown(c[0])) continue;
        const q = project(facePoint(c[0], c[1] + 0.5, c[2] + 0.5));
        return [r.left + q[0], r.top + q[1]];
      }
      return null;
    },
    showFace(f) {
      const v = M3.apply(cube.R, Core.CUBE_FACES[f].n);
      const want = [0, 0, 1];
      const axis = [v[1], -v[0], 0];
      const len = Math.hypot(axis[0], axis[1]);
      const angle = Math.acos(Math.max(-1, Math.min(1, v[2])));
      if (len > 1e-6) cube.R = M3.mul(M3.axis(axis.map((x) => x / len), angle), cube.R);
      else if (v[2] < 0) cube.R = M3.mul(M3.ry(Math.PI), cube.R);
      cubeDraw(performance.now());
      return want;
    },
  };

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
    $('setName').textContent = g.mode === 'level' ? Core.setOf(g.level).name : g.custom.shape === 'cube' ? 'Your cube' : 'Your board';
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
