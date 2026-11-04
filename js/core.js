/*
 * Unfold core: the rules, the level generator, the difficulty meter, the
 * campaign, share codes, and stars. No DOM. Runs in the page and in Node.
 *
 * A board is a w by h grid holding arrows. An arrow is a bent path of cells,
 * listed tail first, each one next to the one before it. The last cell is
 * the head, and the arrow points the way it travels into its head. Tapping
 * an arrow sends it forward: the head moves straight on and the body follows
 * along its own path, so the arrow can leave only if every cell straight
 * ahead of its head, out to the edge, is empty (its "lane").
 *
 * Removing an arrow only ever empties cells, so an arrow that is free stays
 * free and the order of removal never matters. A board can be cleared if
 * and only if no arrows block each other in a loop. The generator builds
 * boards in reverse removal order so that can never happen.
 */
(function (root) {
  'use strict';

  // ---------- Seeded random numbers ----------

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let a = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
    const rng = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (n) => Math.floor(rng() * n);
    return rng;
  }

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      const t = list[i];
      list[i] = list[j];
      list[j] = t;
    }
    return list;
  }

  // ---------- Rules ----------

  // Directions: 0 up, 1 right, 2 down, 3 left.
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIR_NAMES = ['up', 'right', 'down', 'left'];

  function dirBetween(a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    for (let d = 0; d < 4; d++) if (DX[d] === dx && DY[d] === dy) return d;
    return -1;
  }

  function headOf(arrow) {
    return arrow.cells[arrow.cells.length - 1];
  }

  function dirOf(arrow) {
    const c = arrow.cells;
    return dirBetween(c[c.length - 2], c[c.length - 1]);
  }

  // The lane: every cell straight ahead of the head, out to the edge.
  function laneOf(puzzle, i) {
    const arrow = puzzle.arrows[i];
    const d = dirOf(arrow);
    const out = [];
    let [x, y] = headOf(arrow);
    for (;;) {
      x += DX[d];
      y += DY[d];
      if (x < 0 || y < 0 || x >= puzzle.w || y >= puzzle.h) return out;
      out.push([x, y]);
    }
  }

  // Which arrow sits in each cell (-1 for none), leaving out removed ones.
  function occupancy(puzzle, gone) {
    const occ = new Int16Array(puzzle.w * puzzle.h).fill(-1);
    puzzle.arrows.forEach((a, i) => {
      if (gone && gone[i]) return;
      a.cells.forEach(([x, y]) => (occ[y * puzzle.w + x] = i));
    });
    return occ;
  }

  /*
   * What happens if arrow i is tapped: free (it leaves), or blocked by the
   * first arrow in its lane. `steps` is how many empty cells lie ahead of
   * the head before the blocker (or the whole lane when free), which is how
   * far the arrow lurches before it bumps.
   */
  function probe(puzzle, i, gone, occ) {
    occ = occ || occupancy(puzzle, gone);
    const lane = laneOf(puzzle, i);
    for (let k = 0; k < lane.length; k++) {
      const j = occ[lane[k][1] * puzzle.w + lane[k][0]];
      if (j !== -1) return { free: false, by: j, steps: k, lane: lane.length };
    }
    return { free: true, by: -1, steps: lane.length, lane: lane.length };
  }

  function freeArrows(puzzle, gone) {
    const occ = occupancy(puzzle, gone);
    const out = [];
    puzzle.arrows.forEach((a, i) => {
      if (!(gone && gone[i]) && probe(puzzle, i, gone, occ).free) out.push(i);
    });
    return out;
  }

  // For each arrow, every other arrow with a cell in its lane.
  function blockers(puzzle) {
    const occ = occupancy(puzzle, null);
    return puzzle.arrows.map((a, i) => {
      const set = new Set();
      laneOf(puzzle, i).forEach(([x, y]) => {
        const j = occ[y * puzzle.w + x];
        if (j !== -1) set.add(j);
      });
      return Array.from(set);
    });
  }

  /*
   * Clears the board in waves: each wave removes every arrow that is free at
   * that moment. Returns whether the board empties, the number of waves, and
   * how many arrows were free in each wave.
   */
  function clearWaves(puzzle) {
    const by = blockers(puzzle);
    const n = puzzle.arrows.length;
    const gone = new Array(n).fill(false);
    const sizes = [];
    let left = n;
    while (left > 0) {
      const wave = [];
      for (let i = 0; i < n; i++) if (!gone[i] && by[i].every((j) => gone[j])) wave.push(i);
      if (!wave.length) break;
      wave.forEach((i) => (gone[i] = true));
      left -= wave.length;
      sizes.push(wave.length);
    }
    return { ok: left === 0, waves: sizes.length, sizes, stuck: left };
  }

  function isClearable(puzzle) {
    return clearWaves(puzzle).ok;
  }

  /*
   * Difficulty: picture a player who taps arrows at random. With r arrows
   * left and f of them free, they need r / f taps on average to find a free
   * one. The rating is that average over a whole clear, so 1 means every
   * arrow is free and 3 means a random tapper bumps twice per arrow. Arrows
   * are removed in a seeded order so the rating never changes.
   */
  function rate(puzzle, seed) {
    const by = blockers(puzzle);
    const n = puzzle.arrows.length;
    const gone = new Array(n).fill(false);
    const rng = makeRng(hashString('rate:' + (seed == null ? '' : seed)));
    let total = 0;
    let minFree = n;
    let startFree = 0;
    for (let left = n; left > 0; left--) {
      const free = [];
      for (let i = 0; i < n; i++) if (!gone[i] && by[i].every((j) => gone[j])) free.push(i);
      if (!free.length) return { rating: Infinity, startFree, minFree: 0 };
      if (left === n) startFree = free.length;
      minFree = Math.min(minFree, free.length);
      total += left / free.length;
      gone[free[rng.int(free.length)]] = true;
    }
    const waves = clearWaves(puzzle).waves;
    return { rating: n ? total / n : 1, startFree, minFree, waves };
  }

  // ---------- Generator ----------

  /*
   * Builds one board. Arrows are placed one at a time, each with an empty
   * lane at the moment it is placed; later arrows may sit in earlier lanes.
   * Taking arrows off newest first therefore always works, so every board is
   * clearable by construction. Each step tries several placements and keeps
   * the one that covers the most lanes that are still open (weighted by
   * `cover`), which keeps few arrows free at a time.
   *
   * spec: { w, h, density (share of cells to fill), minLen, maxLen,
   *         bend (chance an arrow turns at each step), cover }
   */
  const PROPOSALS = 14;
  const MAX_MISSES = 6;
  const LANE_WEIGHT = 1.0;
  const STRETCH = 3; // how far past the longest length a tail may grow to fill a pocket

  function build(spec, rng) {
    const { w, h } = spec;
    const N = w * h;
    const owner = new Int16Array(N).fill(-1);
    const laneHits = Array.from({ length: N }, () => []); // arrows whose lane crosses each cell
    const covered = []; // filled cells in each arrow's lane
    const arrows = [];
    const target = Math.min(N, Math.round(N * spec.density));
    const cover = spec.cover == null ? 1 : spec.cover;
    const straight = !spec.bend;
    let filled = 0;

    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const laneCells = (x, y, d) => {
      const out = [];
      for (x += DX[d], y += DY[d]; inside(x, y); x += DX[d], y += DY[d]) out.push(y * w + x);
      return out;
    };

    // One placement: a head cell with an empty lane, then a body grown
    // backward from it by a random walk.
    // Every empty cell that could be a head: its lane is open and the cell
    // behind it is empty too.
    function heads() {
      const out = [];
      for (let head = 0; head < N; head++) {
        if (owner[head] !== -1) continue;
        const hx = head % w;
        const hy = (head - hx) / w;
        for (let d = 0; d < 4; d++) {
          const px = hx - DX[d];
          const py = hy - DY[d];
          if (!inside(px, py) || owner[py * w + px] !== -1) continue;
          let open = true;
          for (let x = hx + DX[d], y = hy + DY[d]; inside(x, y); x += DX[d], y += DY[d]) {
            if (owner[y * w + x] !== -1) {
              open = false;
              break;
            }
          }
          if (open) out.push(head * 4 + d);
        }
      }
      return out;
    }

    function propose(minLen, maxLen, options) {
      for (let tries = 0; tries < 4 && options.length; tries++) {
        const pick = options[rng.int(options.length)];
        const head = pick >> 2;
        const d = pick & 3;
        const hx = head % w;
        const hy = (head - hx) / w;
        const px = hx - DX[d];
        const py = hy - DY[d];
        const lane = laneCells(hx, hy, d);
        const laneSet = new Set(lane);
        const len = minLen + rng.int(maxLen - minLen + 1);
        const body = [head, py * w + px];
        const used = new Set(body);
        let back = (d + 2) % 4; // walking from the head toward the tail
        let [cx, cy] = [px, py];
        while (body.length < len) {
          const turn = rng() < spec.bend;
          const side = rng() < 0.5 ? 1 : 3;
          const order = straight ? [back] : turn ? [(back + side) % 4, (back + 4 - side) % 4, back] : [back, (back + side) % 4, (back + 4 - side) % 4];
          let moved = false;
          for (const nd of order) {
            const nx = cx + DX[nd];
            const ny = cy + DY[nd];
            if (!inside(nx, ny)) continue;
            const c = ny * w + nx;
            if (owner[c] !== -1 || used.has(c) || laneSet.has(c)) continue;
            body.push(c);
            used.add(c);
            cx = nx;
            cy = ny;
            back = nd;
            moved = true;
            break;
          }
          if (!moved) break;
        }
        if (body.length < minLen) continue;
        return { cells: body.reverse(), lane, dir: d };
      }
      return null;
    }

    function score(p) {
      // Open lanes this placement would close.
      const closes = new Set();
      p.cells.forEach((c) => laneHits[c].forEach((j) => covered[j] === 0 && closes.add(j)));
      return closes.size * cover + p.lane.length * LANE_WEIGHT + rng();
    }

    function place(p) {
      const i = arrows.length;
      arrows.push({ cells: p.cells, dir: p.dir });
      covered.push(0);
      p.cells.forEach((c) => {
        owner[c] = i;
        laneHits[c].forEach((j) => covered[j]++);
      });
      p.lane.forEach((c) => laneHits[c].push(i));
      filled += p.cells.length;
    }

    function fill(minLen, maxLen) {
      let misses = 0;
      while (filled < target && misses < MAX_MISSES) {
        const options = heads();
        if (!options.length) return;
        let best = null;
        let bestScore = -Infinity;
        for (let k = 0; k < PROPOSALS; k++) {
          const p = propose(minLen, maxLen, options);
          if (!p) continue;
          const s = score(p);
          if (s > bestScore) {
            best = p;
            bestScore = s;
          }
        }
        if (best) {
          place(best);
          misses = 0;
        } else misses++;
      }
    }

    fill(spec.minLen, spec.maxLen);
    // Leftover pockets: short arrows where long ones no longer fit.
    if (filled < target && spec.minLen > 2) fill(2, spec.minLen);
    if (filled < target) fill(2, 2);

    // Still-empty cells next to a tail can join that arrow, as long as no
    // arrow placed later has its lane through the cell (that would make a
    // loop). A few cells past the length limit at most, and straight in
    // line with the tail when arrows must stay straight.
    if (filled < target) {
      let grew = true;
      while (grew && filled < target) {
        grew = false;
        for (let c = 0; c < N && filled < target; c++) {
          if (owner[c] !== -1) continue;
          const x = c % w;
          const y = (c - x) / w;
          for (let d = 0; d < 4; d++) {
            const nx = x + DX[d];
            const ny = y + DY[d];
            if (!inside(nx, ny)) continue;
            const i = owner[ny * w + nx];
            if (i === -1) continue;
            const a = arrows[i];
            if (a.cells[0] !== ny * w + nx || a.cells.length >= spec.maxLen + STRETCH) continue;
            if (straight && a.cells[1] !== (ny + DY[d]) * w + nx + DX[d]) continue;
            if (laneHits[c].some((j) => j >= i)) continue;
            a.cells.unshift(c);
            owner[c] = i;
            laneHits[c].forEach((j) => covered[j]++);
            filled++;
            grew = true;
            break;
          }
        }
      }
    }

    return {
      w,
      h,
      arrows: arrows.map((a) => ({ cells: a.cells.map((c) => [c % w, Math.floor(c / w)]) })),
      filled,
    };
  }

  /*
   * Colors: touching arrows never share one, so every arrow reads clearly.
   * Placement order, with a seeded pick among the colors left.
   */
  const PALETTE_SIZE = 12;

  function colorArrows(puzzle, rng) {
    const occ = occupancy(puzzle, null);
    const { w, h } = puzzle;
    puzzle.arrows.forEach((a, i) => {
      const near = new Set();
      a.cells.forEach(([x, y]) => {
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = occ[ny * w + nx];
          if (j !== -1 && j < i) near.add(puzzle.arrows[j].color);
        }
      });
      const open = [];
      for (let c = 0; c < PALETTE_SIZE; c++) if (!near.has(c)) open.push(c);
      a.color = open.length ? open[rng.int(open.length)] : rng.int(PALETTE_SIZE);
    });
    return puzzle;
  }

  /*
   * Deals several boards at the same settings, rates them, sorts them from
   * easiest to hardest, and keeps the one at `pick` (0 easiest, 1 hardest).
   * Everything is seeded and nothing depends on time, so the same spec gives
   * the same board on every device.
   */
  const CANDIDATES = 6;

  function generate(spec) {
    const seed = spec.seed == null ? 'unfold' : spec.seed;
    const found = [];
    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const rng = makeRng(hashString(seed + ':' + attempt));
      const board = build(spec, rng);
      if (board.arrows.length < 2) continue;
      const r = rate(board, seed);
      found.push(Object.assign(board, r, { attempt }));
    }
    if (!found.length) throw new Error('could not build a board for ' + JSON.stringify(spec));
    found.sort((a, b) => a.rating - b.rating || a.attempt - b.attempt);
    const pick = spec.pick == null ? 0.5 : Math.min(1, Math.max(0, spec.pick));
    const chosen = found[Math.round(pick * (found.length - 1))];
    colorArrows(chosen, makeRng(hashString('color:' + seed)));
    return {
      w: chosen.w,
      h: chosen.h,
      arrows: chosen.arrows,
      fill: chosen.filled / (chosen.w * chosen.h),
      rating: chosen.rating,
      waves: chosen.waves,
      startFree: chosen.startFree,
      minFree: chosen.minFree,
      seed,
    };
  }

  // ---------- Campaign ----------

  /*
   * Ten levels per set. Each row is [width, height, density, shortest arrow,
   * longest arrow, bend, pick]. Sets get bigger, denser, longer, and
   * bendier, and within a set the pick rises with a couple of easier
   * breathers so it is not a steady grind. Straight arrows only until level
   * 6, where bends arrive.
   */
  const SETS = [
    { name: 'Ribbon', levels: [
      null, [4, 4, 0.75, 2, 3, 0, 0.3], [4, 5, 0.8, 2, 3, 0, 0.5], [5, 5, 0.8, 2, 3, 0, 0.5], [5, 6, 0.8, 2, 4, 0, 0.7],
      [5, 5, 0.8, 3, 4, 0.35, 0.3], [5, 6, 0.85, 2, 4, 0.3, 0.5], [6, 6, 0.8, 2, 4, 0.3, 0.4], [6, 7, 0.85, 2, 4, 0.3, 0.7], [6, 7, 0.85, 2, 5, 0.3, 0.8],
    ] },
    { name: 'Zigzag', levels: [
      [6, 7, 0.85, 2, 5, 0.35, 0.5], [6, 8, 0.85, 2, 5, 0.35, 0.6], [7, 8, 0.85, 2, 5, 0.35, 0.4], [7, 8, 0.88, 2, 5, 0.4, 0.8], [6, 7, 0.85, 2, 4, 0.3, 0.3],
      [7, 9, 0.88, 2, 5, 0.4, 0.6], [7, 9, 0.9, 2, 6, 0.4, 0.7], [6, 8, 0.85, 2, 5, 0.35, 0.4], [7, 9, 0.9, 2, 6, 0.4, 0.8], [8, 9, 0.9, 2, 6, 0.4, 0.9],
    ] },
    { name: 'Spiral', levels: [
      [7, 9, 0.9, 3, 6, 0.45, 0.5], [8, 9, 0.9, 3, 6, 0.45, 0.6], [8, 10, 0.9, 3, 6, 0.45, 0.6], [7, 8, 0.88, 2, 5, 0.4, 0.4], [8, 10, 0.92, 3, 7, 0.45, 0.8],
      [8, 10, 0.92, 3, 7, 0.5, 0.6], [8, 11, 0.92, 3, 7, 0.5, 0.7], [7, 9, 0.9, 3, 6, 0.45, 0.4], [8, 11, 0.93, 3, 7, 0.5, 0.8], [9, 11, 0.93, 3, 7, 0.5, 0.9],
    ] },
    { name: 'Twist', levels: [
      [8, 10, 0.93, 3, 7, 0.5, 0.6], [9, 11, 0.93, 3, 7, 0.5, 0.6], [9, 11, 0.94, 3, 8, 0.5, 0.7], [8, 10, 0.92, 3, 6, 0.45, 0.4], [9, 12, 0.94, 3, 8, 0.5, 0.8],
      [9, 12, 0.95, 3, 8, 0.55, 0.6], [9, 12, 0.95, 3, 8, 0.55, 0.8], [8, 10, 0.93, 3, 7, 0.5, 0.4], [9, 12, 0.95, 3, 8, 0.55, 0.9], [10, 12, 0.95, 3, 8, 0.55, 0.9],
    ] },
    { name: 'Tangle', levels: [
      [9, 12, 0.95, 3, 8, 0.55, 0.6], [10, 12, 0.95, 3, 8, 0.55, 0.7], [10, 13, 0.96, 3, 9, 0.55, 0.7], [9, 11, 0.94, 3, 7, 0.5, 0.4], [10, 13, 0.96, 3, 9, 0.6, 0.8],
      [10, 13, 0.96, 3, 9, 0.6, 0.7], [10, 14, 0.96, 3, 9, 0.6, 0.8], [9, 12, 0.95, 3, 8, 0.55, 0.5], [10, 14, 0.97, 3, 9, 0.6, 0.9], [10, 14, 0.97, 4, 10, 0.6, 0.9],
    ] },
    { name: 'Knot', levels: [
      [10, 13, 0.97, 3, 9, 0.6, 0.7], [10, 14, 0.97, 3, 10, 0.6, 0.7], [11, 14, 0.97, 3, 10, 0.6, 0.8], [10, 12, 0.96, 3, 8, 0.55, 0.5], [11, 14, 0.97, 4, 10, 0.65, 0.8],
      [11, 14, 0.98, 4, 10, 0.65, 0.8], [11, 15, 0.98, 4, 10, 0.65, 0.8], [10, 13, 0.96, 3, 9, 0.6, 0.5], [11, 15, 0.98, 4, 11, 0.65, 0.9], [11, 15, 0.98, 4, 11, 0.65, 1],
    ] },
    { name: 'Labyrinth', levels: [
      [11, 14, 0.98, 4, 10, 0.65, 0.8], [11, 15, 0.98, 4, 11, 0.65, 0.8], [12, 15, 0.98, 4, 11, 0.65, 0.8], [11, 14, 0.97, 3, 9, 0.6, 0.5], [12, 15, 0.98, 4, 12, 0.7, 0.9],
      [12, 16, 0.98, 4, 12, 0.7, 0.8], [12, 16, 0.98, 4, 12, 0.7, 0.9], [11, 14, 0.97, 4, 10, 0.65, 0.5], [12, 16, 0.98, 4, 12, 0.7, 1], [12, 16, 0.99, 4, 12, 0.7, 1],
    ] },
  ];

  // After the last set the levels keep coming, drawn from these sizes.
  const ENDLESS_SIZES = [
    [10, 13, 0.96, 3, 9, 0.6], [11, 14, 0.97, 4, 10, 0.65], [12, 15, 0.98, 4, 11, 0.65], [12, 16, 0.98, 4, 12, 0.7],
    [9, 12, 0.95, 3, 8, 0.55], [11, 15, 0.98, 4, 11, 0.65], [10, 14, 0.97, 3, 10, 0.6], [12, 14, 0.97, 4, 10, 0.7],
  ];
  const ENDLESS_NAMES = ['Vortex', 'Helix', 'Weave', 'Lattice', 'Circuit', 'Maze'];

  // Level 1 is built by hand: a chain of three, so the first taps teach the
  // rule. The blue arrow waits on the red one, the yellow on the blue.
  const TUTORIAL = {
    w: 3,
    h: 4,
    arrows: [
      { cells: [[0, 3], [0, 2], [0, 1]], color: 0 },
      { cells: [[2, 1], [1, 1]], color: 7 },
      { cells: [[1, 3], [2, 3], [2, 2]], color: 2 },
    ],
  };

  function setOf(level) {
    const i = Math.floor((level - 1) / 10);
    if (i < SETS.length) return { index: i, name: SETS[i].name };
    const j = i - SETS.length;
    const name = ENDLESS_NAMES[j % ENDLESS_NAMES.length];
    const round = Math.floor(j / ENDLESS_NAMES.length);
    return { index: i, name: round ? name + ' ' + (round + 1) : name };
  }

  function levelSpec(level) {
    const set = setOf(level);
    const slot = (level - 1) % 10;
    let row;
    if (set.index < SETS.length) {
      row = SETS[set.index].levels[slot];
    } else {
      const rng = makeRng(hashString('endless:' + level));
      const size = ENDLESS_SIZES[rng.int(ENDLESS_SIZES.length)];
      row = size.concat([0.5 + 0.5 * rng()]);
    }
    if (!row) return { level, set: set.name, tutorial: true };
    return {
      level,
      set: set.name,
      w: row[0],
      h: row[1],
      density: row[2],
      minLen: row[3],
      maxLen: row[4],
      bend: row[5],
      pick: row[6],
      cover: 0.4 + 1.6 * row[6],
      seed: 'level:' + level,
    };
  }

  function cloneArrows(arrows) {
    return arrows.map((a) => ({ cells: a.cells.map((c) => c.slice()), color: a.color }));
  }

  function generateLevel(level) {
    const spec = levelSpec(level);
    if (spec.tutorial) {
      const p = { w: TUTORIAL.w, h: TUTORIAL.h, arrows: cloneArrows(TUTORIAL.arrows) };
      return Object.assign(p, rate(p, 'tutorial'), { fill: 8 / 12, seed: 'tutorial' }, spec);
    }
    return Object.assign(generate(spec), spec);
  }

  // ---------- Mix your own ----------

  const CUSTOM = {
    minW: 4,
    maxW: 12,
    minH: 4,
    maxH: 16,
    density: [0.65, 0.85, 0.98], // Roomy, Snug, Packed
    length: [[2, 3], [2, 6], [3, 10]], // Short, Mixed, Long
    bend: [0, 0.35, 0.65], // Straight, Bendy, Twisty
  };

  function customSpec(c) {
    const len = CUSTOM.length[c.length];
    return {
      w: c.w,
      h: c.h,
      density: CUSTOM.density[c.density],
      minLen: len[0],
      maxLen: len[1],
      bend: CUSTOM.bend[c.bend],
      pick: 0.6,
      cover: 1.4,
      seed: 'custom:' + codeOf(Object.assign({}, c, { seed: 0 })) + ':' + c.seed,
    };
  }

  function validCustom(c) {
    const ok3 = (v) => Number.isInteger(v) && v >= 0 && v <= 2;
    return (
      Number.isInteger(c.w) && c.w >= CUSTOM.minW && c.w <= CUSTOM.maxW &&
      Number.isInteger(c.h) && c.h >= CUSTOM.minH && c.h <= CUSTOM.maxH &&
      ok3(c.density) && ok3(c.length) && ok3(c.bend)
    );
  }

  /*
   * Share codes: two digits of width, two of height, then density, length,
   * and bend (0-2 each), a dash, and the seed, like 0810121-4821.
   */
  function codeOf(c) {
    return String(c.w).padStart(2, '0') + String(c.h).padStart(2, '0') + c.density + c.length + c.bend + '-' + c.seed;
  }

  function parseCode(text) {
    const m = /^\s*(\d{2})(\d{2})([0-2])([0-2])([0-2])\s*-?\s*(\d{1,6})\s*$/.exec(text || '');
    if (!m) return null;
    const c = { w: +m[1], h: +m[2], density: +m[3], length: +m[4], bend: +m[5], seed: +m[6] };
    return validCustom(c) ? c : null;
  }

  // ---------- Stars ----------

  /*
   * A clean clear (no bumps) earns 3 stars. 2 stars allow a few bumps, more
   * on bigger boards; anything else is 1. A hint caps a level at 2 stars.
   */
  function bumpAllowance(arrows) {
    return 2 + Math.floor(arrows / 15);
  }

  function starsFor(bumps, arrows, helped) {
    let stars = bumps === 0 ? 3 : bumps <= bumpAllowance(arrows) ? 2 : 1;
    if (helped) stars = Math.min(stars, 2);
    return stars;
  }

  const HINTS = 3;

  const api = {
    hashString,
    makeRng,
    shuffle,
    DX,
    DY,
    DIR_NAMES,
    dirBetween,
    headOf,
    dirOf,
    laneOf,
    occupancy,
    probe,
    freeArrows,
    blockers,
    clearWaves,
    isClearable,
    rate,
    build,
    colorArrows,
    generate,
    setOf,
    levelSpec,
    generateLevel,
    cloneArrows,
    CUSTOM,
    customSpec,
    validCustom,
    codeOf,
    parseCode,
    bumpAllowance,
    starsFor,
    HINTS,
    PALETTE_SIZE,
    SET_COUNT: SETS.length,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UnfoldCore = api;
})(typeof self !== 'undefined' ? self : this);
