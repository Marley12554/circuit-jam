/*
 * Unfold: screens, the arrow board, unfold and bump animations, tools, and
 * progress. The rules and the level generator live in core.js. Generating a
 * board takes a few milliseconds, so everything runs on the page.
 */
(function () {
  'use strict';

  const Core = window.UnfoldCore;
  const Sound = window.UnfoldSound;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const rootStyle = getComputedStyle(document.documentElement);
  const PALETTE = Array.from({ length: Core.PALETTE_SIZE }, (_, i) => rootStyle.getPropertyValue('--c' + i).trim());
  const COLOR_NAMES = ['red', 'orange', 'yellow', 'lime', 'green', 'aqua', 'sky blue', 'blue', 'purple', 'pink', 'brown', 'navy'];
  const SET_COLORS = ['#0e9aad', '#ee6c1f', '#e93f72', '#2a85e8', '#14a06f', '#7a4bf0', '#d4541e'];

  const ICONS = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M11 5 6.5 9H3.5v6h3l4.5 4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M11 5 6.5 9H3.5v6h3l4.5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z"/></svg>',
  };

  const INTROS = {
    1: 'Tap the glowing arrow. Nothing is in front of it, so it slides right off!',
    2: 'Blocked arrows bump and stay put. Look before you tap!',
    6: 'Bendy arrows! Only the path ahead of the head matters. The body just follows.',
    11: 'Bigger boards now. Find the arrows with a clear path!',
    21: 'Longer arrows that twist and turn. Follow each one to its head!',
  };
  const CHEERS = ["Let's unfold this!", 'Find a clear path!', 'Look before you tap!', 'One clear lane at a time!', 'You can do it!'];
  const CLEARS = ['Zoom!', 'Off it goes!', 'Nice one!', 'Swoosh!', 'Clear lane!', 'Great eye!'];

  // Make your own: three-way settings, each with a tiny picture.
  const CHOICES = {
    density: [
      { name: 'Roomy', icon: '<rect class="solid" x="3" y="4" width="6" height="6" rx="1.5"/><rect class="solid" x="17" y="4" width="6" height="6" rx="1.5"/>' },
      { name: 'Snug', icon: '<rect class="solid" x="1.5" y="4" width="6" height="6" rx="1.5"/><rect class="solid" x="10" y="4" width="6" height="6" rx="1.5"/><rect class="solid" x="18.5" y="4" width="6" height="6" rx="1.5"/>' },
      { name: 'Packed', icon: '<rect class="solid" x="0.5" y="1" width="12" height="5.5" rx="1.5"/><rect class="solid" x="13.5" y="1" width="12" height="5.5" rx="1.5"/><rect class="solid" x="0.5" y="7.5" width="12" height="5.5" rx="1.5"/><rect class="solid" x="13.5" y="7.5" width="12" height="5.5" rx="1.5"/>' },
    ],
    length: [
      { name: 'Short', icon: '<path d="M9 7h7"/><path d="m13.5 4 3 3-3 3"/>' },
      { name: 'Mixed', icon: '<path d="M5 7h15"/><path d="m17.5 4 3 3-3 3"/>' },
      { name: 'Long', icon: '<path d="M1.5 7h22"/><path d="m21 4 3 3-3 3"/>' },
    ],
    bend: [
      { name: 'Straight', icon: '<path d="M2 7h20"/><path d="m19.5 4 3 3-3 3"/>' },
      { name: 'Bendy', icon: '<path d="M2 11h10V3h10"/><path d="m19.5 0.5 3 2.5-3 2.5"/>' },
      { name: 'Twisty', icon: '<path d="M1.5 11h5V3h6v8h6V3h4"/><path d="m20.5 0.5 3 2.5-3 2.5"/>' },
    ],
  };
  const CHOICE_KEYS = ['density', 'length', 'bend'];
  const CHOICE_ROWS = { density: 'densityRow', length: 'lengthRow', bend: 'bendRow' };

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
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
    if (name === 'custom') renderCustom();
  }

  function setColor(index) {
    return SET_COLORS[index % SET_COLORS.length];
  }

  function useSet(index) {
    document.documentElement.style.setProperty('--lab', setColor(index));
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
      const where = run.mode === 'level' ? 'Level ' + run.level : 'Your puzzle';
      const left = run.puzzle.arrows.length - run.gone.length;
      $('resumeSub').textContent = where + ' · ' + left + (left === 1 ? ' arrow left' : ' arrows left');
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
      section.style.setProperty('--lab', setColor(i));
      section.innerHTML =
        '<div class="lab-head"><h3>' + set.name + '</h3><span>' + earned + ' of 30 stars</span></div><div class="level-grid"></div>';
      const grid = section.querySelector('.level-grid');
      for (let n = first; n < first + 10; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-btn' + (n === next ? ' current' : '');
        const stars = saved.stars[n] || 0;
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

  // ---------- Make your own ----------

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
    let out = '';
    lv.arrows.forEach((a) => {
      const pts = a.cells.map(([x, y]) => (x + 0.5) + ' ' + (y + 0.5)).join(' L');
      out += '<path d="M' + pts + '" stroke="' + PALETTE[a.color] + '"/>';
    });
    return (
      '<svg class="preset-board" viewBox="-0.3 -0.3 ' + (lv.w + 0.6) + ' ' + (lv.h + 0.6) + '" aria-hidden="true">' +
      '<rect class="mini-dot" x="-0.3" y="-0.3" width="' + (lv.w + 0.6) + '" height="' + (lv.h + 0.6) + '" rx="0.8"/>' +
      '<g fill="none" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round">' + out + '</g></svg>'
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

  // ---------- The game ----------

  const board = $('board');
  const game = {
    mode: 'level',
    level: 1,
    custom: null,
    puzzle: null,
    gone: [],
    bumps: 0,
    hintsLeft: Core.HINTS,
    helped: false,
    hinted: -1,
    done: false,
    epoch: 0,
    busy: new Set(),
    exiting: 0,
    cursor: null,
  };

  let tray = null;
  let svg = null;
  let arrowEls = [];
  let paths = [];
  let blockedBy = [];
  let cursorEl = null;
  let cell = 40;
  let hovered = -1;

  function nameOf(i) {
    return COLOR_NAMES[game.puzzle.arrows[i].color];
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
    useSet(set.index);
    show('play');
    $('setName').textContent = set.name;
    $('levelTitle').textContent = 'Level ' + n;
    let puzzle;
    try {
      puzzle = getLevel(n);
    } catch (err) {
      say('Oops, that board got tangled. Go back and try again!');
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
    useSet(5);
    show('play');
    $('setName').textContent = 'Your puzzle';
    $('levelTitle').textContent = Core.codeOf(spec);
    let puzzle;
    try {
      puzzle = Core.generate(Core.customSpec(spec));
    } catch (err) {
      say("I couldn't fold that one. Try different settings!");
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
    game.exiting = 0;
    game.gone = new Array(game.puzzle.arrows.length).fill(false);
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
    $('hintBtn').disabled = !game.puzzle || game.done || (game.hintsLeft <= 0 && !repeat);
  }

  // ---------- Drawing the board ----------

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  }

  /*
   * Each arrow moves along one fixed track: its own cells from tail to head,
   * then its lane, then on past the edge. At rest it covers the first part;
   * leaving or bumping slides that window forward along the track, so the
   * body follows the head around every bend.
   */
  function trackOf(i) {
    const p = game.puzzle;
    const a = p.arrows[i];
    const pts = a.cells.map(([x, y]) => [x + 0.5, y + 0.5]);
    const d = Core.dirOf(a);
    const lane = Core.laneOf(p, i).length;
    const head = pts[pts.length - 1];
    for (let k = 1; k <= lane + a.cells.length + 3; k++) pts.push([head[0] + Core.DX[d] * k, head[1] + Core.DY[d] * k]);
    return { pts, len: a.cells.length, lane };
  }

  function pointAt(pts, t) {
    const i = Math.min(pts.length - 2, Math.max(0, Math.floor(t)));
    const f = t - i;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  }

  // The arrow's outline with its body starting s cells along the track.
  function shapeAt(i, s) {
    const { pts, len } = paths[i];
    const end = s + len - 1;
    const line = [pointAt(pts, s)];
    for (let k = Math.floor(s) + 1; k < end; k++) line.push(pts[k]);
    const head = pointAt(pts, end);
    line.push(head);
    const k = Math.min(pts.length - 2, Math.floor(end));
    const ux = pts[k + 1][0] - pts[k][0];
    const uy = pts[k + 1][1] - pts[k][1];
    const tip = [head[0] + ux * 0.36, head[1] + uy * 0.36];
    const bx = head[0] - ux * 0.1;
    const by = head[1] - uy * 0.1;
    const corners = [
      [bx - uy * 0.33, by + ux * 0.33],
      [bx + uy * 0.33, by - ux * 0.33],
    ];
    const f = (n) => Math.round(n * 1000) / 1000;
    const body = 'M' + line.map((q) => f(q[0]) + ' ' + f(q[1])).join('L');
    const arrowTip = 'M' + [tip, corners[0], corners[1]].map((q) => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z';
    return { body, tip: arrowTip, head };
  }

  function drawArrow(i, s) {
    const g = arrowEls[i];
    if (!g) return;
    const shape = shapeAt(i, s);
    g.querySelectorAll('.halo, .under, .body, .shine').forEach((p) => p.setAttribute('d', shape.body));
    g.querySelectorAll('.halo-tip, .under-tip, .tip').forEach((p) => p.setAttribute('d', shape.tip));
    // Fade out once the head is past the edge.
    const { lane, len } = paths[i];
    const out = (s - lane - 0.3) / (len * 0.8 + 0.6);
    g.style.opacity = out > 0 ? String(Math.max(0, 1 - out)) : '';
  }

  function buildBoard() {
    board.innerHTML = '';
    const p = game.puzzle;
    tray = document.createElement('div');
    tray.className = 'tray';
    svg = el('svg', { class: 'arrows', viewBox: '0 0 ' + p.w + ' ' + p.h, 'aria-hidden': 'true' });
    const dots = el('g');
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) dots.appendChild(el('circle', { class: 'dot', cx: x + 0.5, cy: y + 0.5, r: 0.07 }));
    svg.appendChild(dots);
    paths = p.arrows.map((a, i) => trackOf(i));
    blockedBy = Core.blockers(p);
    arrowEls = p.arrows.map((a, i) => {
      const g = el('g', { class: 'arrow' });
      g.style.setProperty('--c', PALETTE[a.color]);
      g.appendChild(el('path', { class: 'halo' }));
      g.appendChild(el('path', { class: 'halo-tip' }));
      g.appendChild(el('path', { class: 'under', transform: 'translate(0 0.08)' }));
      g.appendChild(el('path', { class: 'under-tip', transform: 'translate(0 0.08)' }));
      g.appendChild(el('path', { class: 'body' }));
      g.appendChild(el('path', { class: 'tip' }));
      g.appendChild(el('path', { class: 'shine', transform: 'translate(-0.05 -0.06)' }));
      svg.appendChild(g);
      return g;
    });
    // Arrows already gone (a resumed run) are not drawn.
    arrowEls.forEach((g, i) => {
      if (game.gone[i]) {
        g.remove();
        arrowEls[i] = null;
      } else drawArrow(i, 0);
    });
    cursorEl = el('rect', { class: 'cursor', width: 0.9, height: 0.9, rx: 0.22, visibility: 'hidden' });
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
    const PAD = 0.4;
    cell = Math.max(8, Math.min(64, W / (p.w + PAD * 2), H / (p.h + PAD * 2)));
    const tw = (p.w + PAD * 2) * cell;
    const th = (p.h + PAD * 2) * cell;
    const left = (W - tw) / 2;
    const top = (H - th) / 2;
    Object.assign(tray.style, { left: left + 'px', top: top + 'px', width: tw + 'px', height: th + 'px', borderRadius: Math.min(26, cell * 0.7) + 'px' });
    Object.assign(svg.style, { left: left + PAD * cell + 'px', top: top + PAD * cell + 'px', width: p.w * cell + 'px', height: p.h * cell + 'px' });
  }

  // ---------- Animation ----------

  const easeIn = (t) => t * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Slides arrow i's window from one spot on its track to another.
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

  function wait(ms) {
    return new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  }

  // A burst of little stars where a bump lands.
  function puff(point) {
    if (reduceMotion) return;
    const r = svg.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const x = r.left - b.left + point[0] * cell;
    const y = r.top - b.top + point[1] * cell;
    for (let k = 0; k < 5; k++) {
      const s = document.createElement('i');
      s.className = 'puff';
      const ang = Math.random() * Math.PI * 2;
      const dist = cell * (0.4 + Math.random() * 0.4);
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(ang) * dist + 'px;--dy:' + Math.sin(ang) * dist + 'px';
      board.appendChild(s);
      setTimeout(() => s.remove(), 520);
    }
  }

  // ---------- Playing ----------

  function tap(i) {
    if (!game.puzzle || game.done || i < 0 || game.gone[i] || game.busy.has(i)) return;
    const result = Core.probe(game.puzzle, i, game.gone);
    if (result.free) leave(i);
    else bump(i, result);
  }

  async function leave(i) {
    game.gone[i] = true;
    if (game.hinted === i) clearHint();
    if (hovered === i) hovered = -1;
    const total = game.puzzle.arrows.length;
    const remaining = left();
    Sound.slide(1 - remaining / total);
    if (remaining === 0) say('All clear!');
    else if (remaining === 1) say('Just one left!');
    else if (remaining === Math.floor(total / 2) && total >= 8) say('Halfway there!');
    else if (Math.random() < 0.18) say(pickFrom(CLEARS));
    updateHud();
    saveRun();
    const g = arrowEls[i];
    const { lane, len } = paths[i];
    const dist = lane + len + 1;
    game.exiting++;
    const epoch = game.epoch;
    await slide(i, 0, dist, 150 + dist * 26, easeIn);
    if (epoch !== game.epoch) return;
    game.exiting--;
    if (g) g.remove();
    arrowEls[i] = null;
    if (remaining === 0 && game.exiting === 0) win();
    else if (remaining === 0) whenExited(win);
  }

  function whenExited(fn) {
    const epoch = game.epoch;
    const check = () => {
      if (epoch !== game.epoch) return;
      if (game.exiting === 0) fn();
      else setTimeout(check, 50);
    };
    check();
  }

  async function bump(i, result) {
    game.bumps++;
    game.busy.add(i);
    const counter = $('bumpCount').parentElement;
    counter.classList.remove('bumped');
    void counter.offsetWidth;
    counter.classList.add('bumped');
    updateHud();
    saveRun();
    say('Bonk! The ' + nameOf(result.by) + ' arrow is in the way.', true);
    const g = arrowEls[i];
    const reach = result.steps + 0.18;
    const epoch = game.epoch;
    await slide(i, 0, reach, 70 + result.steps * 38, easeIn);
    if (epoch !== game.epoch) return;
    Sound.bump();
    if (g) g.classList.add('bumping');
    const blocker = arrowEls[result.by];
    if (blocker) {
      blocker.classList.remove('wobble');
      void blocker.getBoundingClientRect();
      blocker.classList.add('wobble');
      setTimeout(() => blocker.classList.remove('wobble'), 420);
    }
    puff(shapeAt(i, reach + 0.3).head);
    await slide(i, reach, 0, 170 + result.steps * 22, easeOut);
    if (g) g.classList.remove('bumping');
    game.busy.delete(i);
  }

  // ---------- Tapping and pointing ----------

  // The arrow under a point on the board, in cells. A tap a little off an
  // arrow (in an empty cell or just past the edge) still finds it.
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
  // Space taps the arrow inside it.
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

  // The most useful free arrow: the one holding up the most others.
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
    if (!game.puzzle || game.done) return;
    // Asking again before the hinted arrow is gone repeats it for free.
    if (game.hinted >= 0 && !game.gone[game.hinted]) {
      say('Try the glowing ' + nameOf(game.hinted) + ' arrow!');
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
    say('Try the glowing ' + nameOf(i) + ' arrow!');
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
    say('Fresh start! Every arrow is back.');
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
    say(stars === 3 ? 'A perfect clear! Brilliant!' : 'All clear! Great work!');
    const epoch = game.epoch;
    setTimeout(() => {
      if (!game.done || epoch !== game.epoch || screen !== 'play') return;
      Sound.win();
      confetti();
      showWin(stars);
    }, reduceMotion ? 100 : 350);
  }

  function showWin(stars) {
    const isLevel = game.mode === 'level';
    const n = game.puzzle.arrows.length;
    $('winSet').textContent = isLevel ? Core.setOf(game.level).name : 'Your puzzle';
    $('winTitle').textContent = isLevel ? 'Level ' + game.level + ' cleared!' : 'Puzzle cleared!';
    $('winStars').querySelectorAll('i').forEach((s, i) => s.classList.toggle('on', i < stars));
    $('winStars').setAttribute('aria-label', stars + (stars === 1 ? ' star' : ' stars'));
    const b = game.bumps;
    $('winStats').textContent = (b === 0 ? 'No bumps!' : b + (b === 1 ? ' bump' : ' bumps')) + (game.helped ? ' · hint used' : '');
    let note;
    if (stars === 3) note = n + ' arrows, every tap a clear path.';
    else if (game.helped && b <= Core.bumpAllowance(n)) note = '3 stars: no bumps and no hints.';
    else note = '3 stars: no bumps. 2 stars: ' + Core.bumpAllowance(n) + ' bumps or fewer.';
    $('winNote').textContent = note;
    const code = $('winCode');
    code.hidden = isLevel;
    if (!isLevel) code.innerHTML = 'Puzzle code <b>' + Core.codeOf(game.custom) + '</b> · share it so friends can play this one';
    $('nextBtn').querySelector('.big-label').textContent = isLevel ? 'Next level' : 'Make another';
    $('win').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
  }

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
    const bits = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: -6 - Math.random() * 10,
      size: 6 + Math.random() * 7,
      spin: Math.random() * 6,
      vs: (Math.random() - 0.5) * 0.4,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      round: Math.random() < 0.35,
    }));
    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      bits.forEach((b) => {
        b.vy += 0.32;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.spin += b.vs;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2800);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.fillStyle = b.color;
        if (b.round) {
          ctx.beginPath();
          ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      });
      if (t < 2800) requestAnimationFrame(frame);
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
    // Fold it get a jingle, the rest a tap. Moving the mouse onto anything
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
   * nothing. Winning clears it; starting a different level or a new puzzle
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
    useSet(g.mode === 'level' ? Core.setOf(g.level).index : 5);
    show('play');
    $('setName').textContent = g.mode === 'level' ? Core.setOf(g.level).name : 'Your puzzle';
    $('levelTitle').textContent = g.mode === 'level' ? 'Level ' + g.level : Core.codeOf(g.custom);
    game.puzzle = g.puzzle;
    resetState();
    (g.gone || []).forEach((i) => (game.gone[i] = true));
    Object.assign(game, {
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
    wire();
    setSound(saved.sound);
    show('home');
  }

  start();
})();
