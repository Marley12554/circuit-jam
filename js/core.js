/*
 * Circuit Jam core: the rules, the level generator, the difficulty meter, the
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

  // A cell is [x, y] on a flat board, or [face, u, v] on a cube. Moving
  // compares the last two coordinates; on a cube both cells must share a face.
  function dirBetween(a, b) {
    if (a.length === 3 && a[0] !== b[0]) return -1;
    const o = a.length - 2;
    const dx = b[o] - a[o];
    const dy = b[o + 1] - a[o + 1];
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

  // ---------- Board shapes ----------

  /*
   * A geometry numbers a board's cells and knows how they connect, so the
   * rules and the generator work the same on any shape:
   *   count            how many cells
   *   key(cell)        a cell's number; cellOf(k) turns it back
   *   nb[k * 4 + d]    the neighbor one step in direction d (-1 off the board)
   *   nd[k * 4 + d]    the direction you face after that step (a step over a
   *                    cube edge turns you onto the next face)
   *   lane(k, d)       cells straight ahead on the same face, out to its edge
   *   side(k, d)       the cell beside k, across the direction of travel
   *   sameLine(a,b,d)  whether two heads share a row or column on one face
   */
  function flatGeometry(w, h) {
    const count = w * h;
    const nb = new Int32Array(count * 4).fill(-1);
    const nd = new Int8Array(count * 4);
    for (let k = 0; k < count; k++) {
      const x = k % w;
      const y = (k - x) / w;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) nb[k * 4 + d] = ny * w + nx;
        nd[k * 4 + d] = d;
      }
    }
    return {
      kind: 'flat',
      count,
      nb,
      nd,
      key: (c) => c[1] * w + c[0],
      cellOf: (k) => [k % w, Math.floor(k / w)],
      lane(k, d) {
        const out = [];
        for (let c = nb[k * 4 + d]; c >= 0; c = nb[c * 4 + d]) out.push(c);
        return out;
      },
      dirBetween: (a, b) => {
        for (let d = 0; d < 4; d++) if (nb[a * 4 + d] === b) return d;
        return -1;
      },
      side: (k, d) => nb[k * 4 + (d % 2 === 0 ? 1 : 2)],
      sameLine: (a, b, d) => (d % 2 === 0 ? a % w === b % w : Math.floor(a / w) === Math.floor(b / w)),
    };
  }

  /*
   * The cube: six n by n faces. Each face has a corner `o` and two axes,
   * `u` (across) and `v` (down) as seen from outside, plus its outward
   * normal, in a box spanning 0 to n on every axis. Faces are numbered
   * front, right, back, left, top, bottom.
   */
  const CUBE_FACES = [
    { name: 'front', o: [0, 1, 1], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, 1] },
    { name: 'right', o: [1, 1, 1], u: [0, 0, -1], v: [0, -1, 0], n: [1, 0, 0] },
    { name: 'back', o: [1, 1, 0], u: [-1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] },
    { name: 'left', o: [0, 1, 0], u: [0, 0, 1], v: [0, -1, 0], n: [-1, 0, 0] },
    { name: 'top', o: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] },
    { name: 'bottom', o: [0, 0, 1], u: [1, 0, 0], v: [0, 0, -1], n: [0, -1, 0] },
  ];

  const add3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const same3 = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // The 3D step for moving in direction d on a face.
  function cubeStep(face, d) {
    const F = CUBE_FACES[face];
    return d === 0 ? add3([0, 0, 0], F.v, -1) : d === 1 ? F.u.slice() : d === 2 ? F.v.slice() : add3([0, 0, 0], F.u, -1);
  }

  // The center of a cube cell in 3D.
  function cubeCenter(n, f, u, v) {
    const F = CUBE_FACES[f];
    return add3(add3(add3([0, 0, 0], F.o, n), F.u, u + 0.5), F.v, v + 0.5);
  }

  function cubeGeometry(n) {
    const per = n * n;
    const count = 6 * per;
    const nb = new Int32Array(count * 4).fill(-1);
    const nd = new Int8Array(count * 4);
    const key = (c) => c[0] * per + c[2] * n + c[1];
    const cellOf = (k) => {
      const f = Math.floor(k / per);
      const r = k - f * per;
      return [f, r % n, Math.floor(r / n)];
    };
    for (let k = 0; k < count; k++) {
      const [f, u, v] = cellOf(k);
      for (let d = 0; d < 4; d++) {
        const nu = u + DX[d];
        const nv = v + DY[d];
        if (nu >= 0 && nv >= 0 && nu < n && nv < n) {
          nb[k * 4 + d] = f * per + nv * n + nu;
          nd[k * 4 + d] = d;
          continue;
        }
        // Over the edge: half a step to the edge, then half a step down
        // the next face, whose outward normal is the way we were heading.
        const s = cubeStep(f, d);
        const g = CUBE_FACES.findIndex((F) => same3(F.n, s));
        const c = add3(add3(cubeCenter(n, f, u, v), s, 0.5), CUBE_FACES[f].n, -0.5);
        const G = CUBE_FACES[g];
        const rel = add3(c, G.o, -n);
        const gu = Math.round(dot3(rel, G.u) - 0.5);
        const gv = Math.round(dot3(rel, G.v) - 0.5);
        nb[k * 4 + d] = g * per + gv * n + gu;
        const down = add3([0, 0, 0], CUBE_FACES[f].n, -1);
        for (let e = 0; e < 4; e++) if (same3(cubeStep(g, e), down)) nd[k * 4 + d] = e;
      }
    }
    return {
      kind: 'cube',
      n,
      count,
      nb,
      nd,
      key,
      cellOf,
      lane(k, d) {
        const [f, u, v] = cellOf(k);
        const out = [];
        for (let x = u + DX[d], y = v + DY[d]; x >= 0 && y >= 0 && x < n && y < n; x += DX[d], y += DY[d]) out.push(f * per + y * n + x);
        return out;
      },
      dirBetween: (a, b) => {
        if (Math.floor(a / per) !== Math.floor(b / per)) return -1;
        for (let d = 0; d < 4; d++) if (nb[a * 4 + d] === b) return d;
        return -1;
      },
      side(k, d) {
        const [f, u, v] = cellOf(k);
        const x = d % 2 === 0 ? u + 1 : u;
        const y = d % 2 === 0 ? v : v + 1;
        return x < n && y < n ? f * per + y * n + x : -1;
      },
      sameLine(a, b, d) {
        const A = cellOf(a);
        const B = cellOf(b);
        return A[0] === B[0] && (d % 2 === 0 ? A[1] === B[1] : A[2] === B[2]);
      },
    };
  }

  const geoCache = new Map();

  // The geometry for a puzzle or a spec: { kind: 'cube', n } or { w, h }.
  function geometryOf(p) {
    const id = p.kind === 'cube' ? 'c' + p.n : p.w + 'x' + p.h;
    if (!geoCache.has(id)) geoCache.set(id, p.kind === 'cube' ? cubeGeometry(p.n) : flatGeometry(p.w, p.h));
    return geoCache.get(id);
  }

  // ---------- Rules ----------

  // The lane: every cell straight ahead of the head, out to the edge of its
  // face.
  function laneOf(puzzle, i) {
    const g = geometryOf(puzzle);
    const arrow = puzzle.arrows[i];
    return g.lane(g.key(headOf(arrow)), dirOf(arrow)).map(g.cellOf);
  }

  // Which arrow sits in each cell (-1 for none), leaving out removed ones.
  function occupancy(puzzle, gone) {
    const g = geometryOf(puzzle);
    const occ = new Int16Array(g.count).fill(-1);
    puzzle.arrows.forEach((a, i) => {
      if (gone && gone[i]) return;
      a.cells.forEach((c) => (occ[g.key(c)] = i));
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
    const g = geometryOf(puzzle);
    occ = occ || occupancy(puzzle, gone);
    const lane = laneOf(puzzle, i);
    for (let k = 0; k < lane.length; k++) {
      const j = occ[g.key(lane[k])];
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
    const g = geometryOf(puzzle);
    const occ = occupancy(puzzle, null);
    return puzzle.arrows.map((a, i) => {
      const set = new Set();
      laneOf(puzzle, i).forEach((c) => {
        const j = occ[g.key(c)];
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
   * A simulated player, fitted to real play: after each clear they look
   * for the free trace nearest the one they just cleared, and finding it
   * takes about 0.5 s plus 0.14 s for every cell away it is (people
   * follow chains: a trace right beside the last one is spotted at once,
   * one across the board takes a scan). On a cube, moving to another face
   * costs about 2 s more for turning it and finding the trace there.
   * Shorts come at about 2.5% of taps.
   * `pace` scales the times (1 is the player it was fitted to).
   *
   * Returns the seconds per trace that player needs on average, the share
   * of clears whose next free trace was within 3 cells (how local the
   * board plays), and the runs of such clears ("bursts"): their average
   * length, the longest, and the share of clears in runs of 3 or more.
   */
  const HUMAN = { base: 0.51, perCell: 0.14, shortRate: 0.025, near: 3, spin: 2 };

  function humanPace(puzzle, pace) {
    const k = pace || 1;
    const g = geometryOf(puzzle);
    const n = puzzle.arrows.length;
    const pos = puzzle.arrows.map((a) => {
      const h = headOf(a);
      return puzzle.kind === 'cube' ? cubeCenter(puzzle.n, h[0], h[1], h[2]) : [h[0], h[1], 0];
    });
    const blk = blockers(puzzle);
    const waiting = blk.map((b) => b.length);
    const blocks = Array.from({ length: n }, () => []);
    blk.forEach((b, i) => b.forEach((j) => blocks[j].push(i)));
    const free = new Set();
    for (let i = 0; i < n; i++) if (!waiting[i]) free.add(i);
    const cube = puzzle.kind === 'cube';
    const faceOf = (i) => (cube ? headOf(puzzle.arrows[i])[0] : 0);
    let face = -1;
    let at = cube ? [puzzle.n / 2, puzzle.n / 2, 0] : [(puzzle.w - 1) / 2, (puzzle.h - 1) / 2, 0];
    let time = 0;
    let near = 0;
    let run = 0;
    const runs = [];
    let cleared = 0;
    while (free.size) {
      let best = -1;
      let bestD = Infinity;
      for (const i of free) {
        const p = pos[i];
        const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]);
        if (d < bestD || (d === bestD && i < best)) {
          bestD = d;
          best = i;
        }
      }
      time += HUMAN.base + HUMAN.perCell * bestD + (face >= 0 && faceOf(best) !== face ? HUMAN.spin : 0);
      face = faceOf(best);
      if (cleared > 0) {
        if (bestD <= HUMAN.near) {
          near++;
          run++;
        } else {
          runs.push(run);
          run = 1;
        }
      } else run = 1;
      free.delete(best);
      at = pos[best];
      cleared++;
      for (const j of blocks[best]) if (--waiting[j] === 0) free.add(j);
    }
    runs.push(run);
    time += cleared * HUMAN.shortRate * HUMAN.base;
    const inBursts = runs.filter((r) => r >= 3).reduce((a, b) => a + b, 0);
    return {
      perTrace: (time * k) / Math.max(1, cleared),
      local: near / Math.max(1, cleared - 1),
      burstMean: cleared / runs.length,
      burstMax: Math.max(...runs),
      inBursts: inBursts / Math.max(1, cleared),
    };
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
   *
   * This is the fallback; generate() first tries tile() and orient() below.
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
   * The main generator works in two steps.
   *
   * 1. Tile. Cover the board with paths: a share of cells is left empty
   *    first (more on roomier boards), then each path starts in the most
   *    hemmed-in empty cell and walks into the neighbor with the fewest
   *    empty neighbors of its own, so nothing gets stranded. A lone cell
   *    left over joins the end of a neighboring path, or stays empty.
   *
   * 2. Orient. Every path can point either way: one end is the head, the
   *    other the tail. Since the cells never move, each arrow's blockers
   *    depend only on its own direction, so each choice is worked out once.
   *    A seeded hill climb then flips arrows one at a time, keeping changes
   *    that don't make the board worse. It must stay clearable, and it
   *    avoids the patterns that make a board read itself: convoys (an arrow
   *    blocked by one heading the same way along the same line) and
   *    side-by-side arrows heading the same way. On harder levels (`hard`
   *    near 1) it also keeps few arrows free and makes the clear take many
   *    waves with long lanes.
   */
  const HOLE = -2;

  function tile(spec, rng) {
    const g = geometryOf(spec);
    const { nb, nd } = g;
    const N = g.count;
    const owner = new Int16Array(N).fill(-1);
    const straight = !spec.bend;
    const holes = shuffle(Array.from({ length: N }, (_, c) => c), rng).slice(0, Math.round(N * (1 - spec.density)));
    holes.forEach((c) => (owner[c] = HOLE));
    const openAround = (c) => {
      let n = 0;
      for (let d = 0; d < 4; d++) {
        const m = nb[c * 4 + d];
        if (m >= 0 && owner[m] === -1) n++;
      }
      return n;
    };
    const paths = [];
    for (;;) {
      let start = -1;
      let best = Infinity;
      for (let c = 0; c < N; c++) {
        if (owner[c] !== -1) continue;
        const score = openAround(c) + rng() * 0.5;
        if (score < best) {
          best = score;
          start = c;
        }
      }
      if (start < 0) break;
      const id = paths.length;
      const path = [start];
      owner[start] = id;
      const len = spec.minLen + rng.int(spec.maxLen - spec.minLen + 1);
      let dir = -1;
      while (path.length < len) {
        const c = path[path.length - 1];
        let pick = null;
        let pickScore = Infinity;
        for (let d = 0; d < 4; d++) {
          if (straight && dir >= 0 && d !== dir) continue;
          const m = nb[c * 4 + d];
          if (m < 0 || owner[m] !== -1) continue;
          let score = openAround(m) + rng() * 1.2;
          if (dir >= 0 && d !== dir) score += (1 - spec.bend) * 2.5 - spec.bend;
          if (score < pickScore) {
            pickScore = score;
            pick = [m, nd[c * 4 + d]];
          }
        }
        if (!pick) break;
        owner[pick[0]] = id;
        path.push(pick[0]);
        dir = pick[1];
      }
      paths.push(path);
    }
    // Lone cells join a neighboring path's end, in line with it if paths
    // must stay straight; otherwise they stay empty.
    paths.forEach((p, i) => {
      if (p.length !== 1) return;
      const c = p[0];
      for (let d = 0; d < 4; d++) {
        const m = nb[c * 4 + d];
        if (m < 0) continue;
        const j = owner[m];
        if (j < 0 || j === i || paths[j].length < 2 || paths[j].length >= spec.maxLen + STRETCH) continue;
        const q = paths[j];
        const atStart = q[0] === m;
        const atEnd = q[q.length - 1] === m;
        if (!atStart && !atEnd) continue;
        if (straight) {
          const next = atStart ? q[1] : q[q.length - 2];
          if (nb[m * 4 + nd[c * 4 + d]] !== next) continue;
        }
        if (atStart) q.unshift(c);
        else q.push(c);
        owner[c] = j;
        paths[i] = [];
        return;
      }
      owner[c] = HOLE;
      paths[i] = [];
    });
    return paths.filter((p) => p.length >= 2);
  }

  function orient(spec, paths, rng) {
    const g = geometryOf(spec);
    const n = paths.length;
    const hard = Math.min(1, Math.max(0, spec.hard == null ? 0.5 : spec.hard));
    const owner = new Int16Array(g.count).fill(-1);
    paths.forEach((p, i) => p.forEach((c) => (owner[c] = i)));
    // Both ways each path could point: its cells, head, direction, lane,
    // the arrows in its lane, and the first one it would hit. A way is
    // ruled out when its last step crosses a cube edge (no clear direction)
    // or its lane runs into its own body.
    const ways = paths.map((p, i) =>
      [p, p.slice().reverse()].map((cells) => {
        const head = cells[cells.length - 1];
        const d = g.dirBetween(cells[cells.length - 2], head);
        if (d < 0) return null;
        const lane = g.lane(head, d);
        const blk = new Set();
        let first = -1;
        for (const c of lane) {
          const j = owner[c];
          if (j === i) return null;
          if (j >= 0) {
            if (first < 0) first = j;
            blk.add(j);
          }
        }
        return { cells, head, d, lane, blk: Array.from(blk), first };
      })
    );
    // Start each arrow pointing the way with fewer arrows in its lane (a
    // coin flip on a tie). Few blockers means few loops to untangle, which
    // is what keeps big boards quick to build.
    const pick = ways.map((v) => {
      if (!(v[0] && v[1])) return v[0] ? 0 : 1;
      const a = v[0].blk.length;
      const b = v[1].blk.length;
      return a === b ? rng.int(2) : a < b ? 0 : 1;
    });
    // A path that can't point either way is left out; its cells stay empty.
    const alive = ways.map((v) => !!(v[0] || v[1]));

    const canFlip = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (ways[i][0] && ways[i][1]) canFlip[i] = 1;

    // The arrows that are part of a loop (not just stuck behind one): those
    // in a group where each one is blocked, through the others, by itself.
    // Found with Tarjan's method, written without recursion.
    function looped() {
      const index = new Int32Array(n).fill(-1);
      const low = new Int32Array(n);
      const onStack = new Uint8Array(n);
      const stack = [];
      const out = [];
      let next = 0;
      for (let root = 0; root < n; root++) {
        if (!alive[root] || index[root] >= 0) continue;
        const work = [[root, 0]];
        index[root] = low[root] = next++;
        stack.push(root);
        onStack[root] = 1;
        while (work.length) {
          const top = work[work.length - 1];
          const i = top[0];
          const blk = ways[i][pick[i]].blk;
          if (top[1] < blk.length) {
            const j = blk[top[1]++];
            if (!alive[j]) continue;
            if (index[j] < 0) {
              index[j] = low[j] = next++;
              stack.push(j);
              onStack[j] = 1;
              work.push([j, 0]);
            } else if (onStack[j]) low[i] = Math.min(low[i], index[j]);
          } else {
            work.pop();
            if (work.length) {
              const parent = work[work.length - 1][0];
              low[parent] = Math.min(low[parent], low[i]);
            }
            if (low[i] === index[i]) {
              const group = [];
              let j;
              do {
                j = stack.pop();
                onStack[j] = 0;
                group.push(j);
              } while (j !== i);
              if (group.length > 1) out.push(...group);
            }
          }
        }
      }
      return out;
    }

    // Whether arrow i sits in a loop pointing its current way: can
    // anything blocking it be blocked, through others, by i itself? A flip
    // only changes i's own blockers, so a flip can make a loop only through
    // i, and this small search is all it takes to check one.
    const seen = new Int32Array(n);
    let mark = 0;
    function inLoop(i) {
      mark++;
      const stack = [];
      for (const j of ways[i][pick[i]].blk) if (alive[j]) stack.push(j);
      while (stack.length) {
        const j = stack.pop();
        if (j === i) return true;
        if (seen[j] === mark) continue;
        seen[j] = mark;
        for (const k of ways[j][pick[j]].blk) if (alive[k] && seen[k] !== mark) stack.push(k);
      }
      return false;
    }

    /*
     * Untangling, in three tiers, cheapest first:
     *  1. Flip an arrow that sits in a loop if the flip takes it out of
     *     every loop. That never adds a loop anywhere else.
     *  2. If loops remain, try flips that don't add to the number of arrows
     *     in loops, which can break loops that need two flips together.
     *  3. If loops still won't break (some run through arrows that can
     *     only point one way), take those arrows out, leaving their cells
     *     empty, then any arrow still in a loop, one at a time, with the
     *     cheap pass in between. Removing an arrow only frees others, so
     *     this always ends.
     */
    let loops = looped();
    function quickUntangle() {
      for (let round = 0; round < 8 && loops.length; round++) {
        let fixed = 0;
        shuffle(loops.slice(), rng).forEach((i) => {
          if (!canFlip[i] || !inLoop(i)) return;
          pick[i] ^= 1;
          if (inLoop(i)) pick[i] ^= 1;
          else fixed++;
        });
        const before = loops.length;
        loops = looped();
        if (!fixed || loops.length >= before) break;
      }
    }
    function untangle() {
      quickUntangle();
      let best = loops.length;
      let idle = 0;
      for (let k = 0; k < n * 4 && loops.length && idle < 30 + loops.length; k++) {
        const options = loops.filter((i) => canFlip[i]);
        if (!options.length) break;
        const i = options[rng.int(options.length)];
        pick[i] ^= 1;
        const after = looped();
        if (after.length <= loops.length) loops = after;
        else pick[i] ^= 1;
        if (loops.length < best) {
          best = loops.length;
          idle = 0;
        } else idle++;
      }
    }
    untangle();
    // Arrows that can only point one way and sit in a loop all go at once;
    // after that, one arrow at a time, with the quick pass in between.
    if (loops.length) {
      loops.forEach((i) => !canFlip[i] && (alive[i] = false));
      loops = looped();
      quickUntangle();
    }
    while (loops.length) {
      alive[loops[rng.int(loops.length)]] = false;
      loops = looped();
      quickUntangle();
    }

    /*
     * Then improve: flip arrows one at a time and keep a flip when it
     * doesn't make the board worse and doesn't make a loop. The score adds
     * up, for every arrow: being free at the start, being in a convoy (its
     * first blocker heads the same way along the same line), and having a
     * neighbor beside it heading the same way; minus long lanes. Each part
     * depends on only a few arrows, so a flip is scored from just the ones
     * it touches.
     */
    let live = 0;
    for (let i = 0; i < n; i++) if (alive[i]) live++;
    // The first live arrow each way would hit (fixed now no more arrows
    // are taken out), and who would hit each arrow first.
    const firstHit = ways.map((v, i) =>
      v.map((w) => {
        if (!w || !alive[i]) return -1;
        for (const c of w.lane) {
          const j = owner[c];
          if (j >= 0 && alive[j]) return j;
        }
        return -1;
      })
    );

    const hitBy = Array.from({ length: n }, () => []);
    for (let j = 0; j < n; j++) for (let w = 0; w < 2; w++) if (firstHit[j][w] >= 0) hitBy[firstHit[j][w]].push(j * 2 + w);
    const headOf = new Int32Array(g.count).fill(-1);
    for (let i = 0; i < n; i++) if (alive[i]) headOf[ways[i][pick[i]].head] = i;
    const now = (i) => ways[i][pick[i]];

    const W_CONVOY = 4;
    const W_PAIR = 3;
    const W_FREE = 10 * hard;
    const W_LANE = (0.9 * hard) / Math.max(1, live);


    function convoyOf(j) {
      const u = firstHit[j][pick[j]];
      if (u < 0) return 0;
      const a = now(j);
      const b = now(u);
      return b.d === a.d && g.sameLine(b.head, a.head, a.d) ? 1 : 0;
    }

    function pairOf(j) {
      const a = now(j);
      const next = g.side(a.head, a.d);
      if (next < 0) return 0;
      const k = headOf[next];
      return k >= 0 && now(k).d === a.d ? 1 : 0;
    }

    // Everything whose score a flip of i can change: i, the arrows that hit
    // i first (their convoy depends on i's direction), and arrows whose
    // head sits just before either end of i (their pair depends on i).
    const touched = [];
    function gather(i) {
      touched.length = 0;
      touched.push(i);
      for (const code of hitBy[i]) {
        const j = code >> 1;
        if (alive[j] && pick[j] === (code & 1)) touched.push(j);
      }
      for (let w = 0; w < 2; w++) {
        const h = ways[i][w] && ways[i][w].head;
        if (h == null) continue;
        for (const d of [0, 3]) {
          const c = g.nb[h * 4 + d];
          if (c >= 0 && headOf[c] >= 0 && headOf[c] !== i) touched.push(headOf[c]);
        }
      }
    }

    function localScore(i) {
      let total = 0;
      for (const j of touched) total += W_CONVOY * convoyOf(j) + W_PAIR * pairOf(j);
      const v = now(i);
      total += (firstHit[i][pick[i]] < 0 ? W_FREE : 0) - v.lane.length * W_LANE;
      return total;
    }

    function flip(i) {
      headOf[now(i).head] = -1;
      pick[i] ^= 1;
      headOf[now(i).head] = i;
    }

    const flippable = [];
    for (let i = 0; i < n; i++) if (alive[i] && canFlip[i]) flippable.push(i);
    const steps = flippable.length ? Math.round(n * (12 + 28 * hard)) : 0;
    for (let k = 0; k < steps; k++) {
      const i = flippable[rng.int(flippable.length)];
      gather(i);
      const before = localScore(i);
      flip(i);
      if (localScore(i) > before || inLoop(i)) flip(i);
    }

    /*
     * Spread (optional): people clear boards in chains, spotting the next
     * free trace right beside the last one. So keep flips that make a
     * simulated player (see humanPace) take longer, which means the next
     * free trace is more often somewhere else on the board.
     */
    const spread = spec.spread == null ? (spec.kind === 'cube' ? 0 : 4 * hard) : spec.spread;
    if (spread > 0 && flippable.length) {
      const posOf = (key) => {
        const c = g.cellOf(key);
        return spec.kind === 'cube' ? cubeCenter(spec.n, c[0], c[1], c[2]) : [c[0], c[1], 0];
      };
      const pos = ways.map((v) => v.map((w) => (w ? posOf(w.head) : null)));
      const waiting = new Int32Array(n);
      const blocks = Array.from({ length: n }, () => []);
      const sim = () => {
        for (let i = 0; i < n; i++) blocks[i].length = 0;
        const free = [];
        for (let i = 0; i < n; i++) {
          if (!alive[i]) continue;
          let c = 0;
          for (const j of now(i).blk) if (alive[j]) {
            blocks[j].push(i);
            c++;
          }
          waiting[i] = c;
          if (!c) free.push(i);
        }
        let at = null;
        let total = 0;
        while (free.length) {
          let bi = 0;
          let bd = 0;
          if (at) {
            bd = Infinity;
            for (let k = 0; k < free.length; k++) {
              const p = pos[free[k]][pick[free[k]]];
              const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]);
              if (d < bd) {
                bd = d;
                bi = k;
              }
            }
          }
          const i = free[bi];
          free[bi] = free[free.length - 1];
          free.pop();
          total += bd;
          at = pos[i][pick[i]];
          for (const j of blocks[i]) if (--waiting[j] === 0) free.push(j);
        }
        return total;
      };
      let best = sim();
      const tries = Math.round(n * spread);
      for (let k = 0; k < tries; k++) {
        const i = flippable[rng.int(flippable.length)];
        flip(i);
        if (inLoop(i)) {
          flip(i);
          continue;
        }
        const t = sim();
        if (t >= best) best = t;
        else flip(i);
      }
    }

    let filled = 0;
    const arrows = [];
    ways.forEach((v, i) => {
      if (!alive[i]) return;
      filled += v[pick[i]].cells.length;
      arrows.push({ cells: v[pick[i]].cells.map(g.cellOf) });
    });
    return Object.assign(shapeOf(spec), { arrows, filled });
  }

  // The fields that say what shape a board is.
  function shapeOf(p) {
    return p.kind === 'cube' ? { kind: 'cube', n: p.n } : { w: p.w, h: p.h };
  }

  /*
   * Colors: touching arrows never share one, so every arrow reads clearly.
   * Placement order, with a seeded pick among the colors left.
   */
  const PALETTE_SIZE = 12;

  function colorArrows(puzzle, rng) {
    const g = geometryOf(puzzle);
    const occ = occupancy(puzzle, null);
    puzzle.arrows.forEach((a, i) => {
      const near = new Set();
      a.cells.forEach((cell) => {
        const k = g.key(cell);
        for (let d = 0; d < 4; d++) {
          const m = g.nb[k * 4 + d];
          if (m < 0) continue;
          const j = occ[m];
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
    const g = geometryOf(spec);
    // Only the very biggest boards build fewer candidates.
    const candidates = g.count > 1500 ? 3 : CANDIDATES;
    const found = [];
    for (let attempt = 0; attempt < candidates; attempt++) {
      const rng = makeRng(hashString(seed + ':' + attempt));
      let board = orient(spec, tile(spec, rng), rng);
      // Almost never needed: on a flat board, fall back to building in
      // reverse removal order, which always gives a clearable board.
      if (board.arrows.length < 2 && spec.kind !== 'cube') board = build(spec, rng);
      if (board.arrows.length < 2) continue;
      const r = rate(board, seed);
      found.push(Object.assign(board, r, { attempt, pace: humanPace(board).perTrace }));
    }
    if (!found.length) throw new Error('could not build a board for ' + JSON.stringify(spec));
    // Sorted by how long a person takes per trace (the simulated player),
    // which follows real play far better than the random tapper's rating.
    found.sort((a, b) => a.pace - b.pace || a.rating - b.rating || a.attempt - b.attempt);
    const pick = spec.pick == null ? 0.5 : Math.min(1, Math.max(0, spec.pick));
    const chosen = found[Math.round(pick * (found.length - 1))];
    colorArrows(chosen, makeRng(hashString('color:' + seed)));
    return Object.assign(shapeOf(chosen), {
      arrows: chosen.arrows,
      fill: chosen.filled / g.count,
      rating: chosen.rating,
      pace: chosen.pace,
      waves: chosen.waves,
      startFree: chosen.startFree,
      minFree: chosen.minFree,
      seed,
    });
  }

  // ---------- Campaign ----------

  /*
   * Ten levels per set. Each row is [width, height, density, shortest arrow,
   * longest arrow, bend, pick]. Sets get bigger (from 4 by 5 up to 18 by 24,
   * zoom taking over where cells get small), denser, longer, and bendier,
   * and within a set the pick rises with a couple of easier breathers so it
   * is not a steady grind. Straight arrows only until level 6, where bends
   * arrive.
   */
  const SETS = [
    { name: 'Breadboard', levels: [
      null, [4, 5, 0.8, 2, 3, 0, 0.4], [5, 5, 0.8, 2, 4, 0, 0.5], [5, 6, 0.85, 2, 4, 0, 0.6], [6, 6, 0.85, 2, 4, 0, 0.7],
      [6, 7, 0.85, 3, 5, 0.35, 0.5], [6, 7, 0.88, 2, 5, 0.3, 0.6], [7, 7, 0.85, 2, 5, 0.3, 0.5], [7, 8, 0.88, 3, 5, 0.35, 0.8], [8, 9, 0.9, 3, 6, 0.35, 0.9],
    ] },
    { name: 'Relay', levels: [
      [8, 9, 0.9, 3, 6, 0.4, 0.6], [8, 10, 0.9, 3, 6, 0.4, 0.7], [9, 10, 0.9, 3, 6, 0.4, 0.7], [8, 9, 0.88, 3, 5, 0.35, 0.5], [9, 11, 0.92, 3, 7, 0.45, 0.8],
      [9, 11, 0.92, 3, 7, 0.45, 0.7], [10, 11, 0.92, 3, 7, 0.45, 0.8], [8, 10, 0.9, 3, 6, 0.4, 0.5], [10, 12, 0.93, 3, 7, 0.45, 0.9], [10, 13, 0.93, 3, 8, 0.45, 1],
    ] },
    { name: 'Capacitor', levels: [
      [10, 12, 0.93, 3, 7, 0.45, 0.7], [10, 13, 0.93, 3, 8, 0.5, 0.8], [11, 13, 0.94, 3, 8, 0.5, 0.8], [10, 12, 0.92, 3, 7, 0.45, 0.6], [11, 14, 0.94, 3, 8, 0.5, 0.9],
      [11, 14, 0.95, 3, 8, 0.5, 0.8], [12, 14, 0.95, 3, 9, 0.5, 0.9], [10, 12, 0.93, 3, 7, 0.45, 0.6], [12, 15, 0.95, 3, 9, 0.5, 1], [12, 16, 0.95, 4, 10, 0.55, 1],
    ] },
    { name: 'Transistor', levels: [
      [12, 15, 0.95, 3, 9, 0.5, 0.8], [12, 16, 0.95, 4, 10, 0.55, 0.8], [13, 16, 0.96, 4, 10, 0.55, 0.9], [12, 14, 0.94, 3, 8, 0.5, 0.6], [13, 17, 0.96, 4, 10, 0.55, 0.9],
      [13, 17, 0.96, 4, 11, 0.55, 0.9], [14, 17, 0.96, 4, 11, 0.6, 1], [12, 15, 0.95, 3, 9, 0.5, 0.6], [14, 18, 0.97, 4, 11, 0.6, 1], [14, 19, 0.97, 4, 12, 0.6, 1],
    ] },
    { name: 'Processor', levels: [
      [13, 17, 0.96, 4, 10, 0.55, 0.8], [14, 18, 0.97, 4, 11, 0.6, 0.9], [14, 19, 0.97, 4, 12, 0.6, 0.9], [13, 16, 0.96, 4, 10, 0.55, 0.6], [15, 19, 0.97, 4, 12, 0.6, 1],
      [15, 20, 0.97, 4, 12, 0.6, 0.9], [15, 20, 0.98, 4, 12, 0.65, 1], [13, 17, 0.96, 4, 10, 0.55, 0.6], [16, 20, 0.98, 4, 12, 0.65, 1], [16, 21, 0.98, 4, 13, 0.65, 1],
    ] },
    { name: 'Mainframe', levels: [
      [15, 19, 0.97, 4, 12, 0.6, 0.9], [15, 20, 0.98, 4, 12, 0.65, 0.9], [16, 21, 0.98, 4, 13, 0.65, 1], [14, 18, 0.97, 4, 11, 0.6, 0.7], [16, 21, 0.98, 4, 13, 0.65, 1],
      [16, 22, 0.98, 5, 13, 0.65, 1], [16, 22, 0.98, 5, 14, 0.7, 1], [15, 19, 0.97, 4, 12, 0.6, 0.7], [16, 22, 0.98, 5, 14, 0.7, 1], [17, 22, 0.98, 5, 14, 0.7, 1],
    ] },
    { name: 'Quantum', levels: [
      [16, 21, 0.98, 5, 13, 0.65, 1], [16, 22, 0.98, 5, 14, 0.7, 1], [17, 22, 0.98, 5, 14, 0.7, 1], [15, 20, 0.97, 4, 12, 0.65, 0.8], [17, 23, 0.98, 5, 14, 0.7, 1],
      [17, 23, 0.99, 5, 15, 0.7, 1], [18, 23, 0.99, 5, 15, 0.7, 1], [16, 21, 0.98, 5, 13, 0.65, 0.8], [18, 24, 0.99, 5, 15, 0.7, 1], [18, 24, 0.99, 5, 16, 0.7, 1],
    ] },
  ];

  // After the last set the levels keep coming, drawn from these sizes.
  const ENDLESS_SIZES = [
    [16, 21, 0.98, 5, 13, 0.65], [17, 22, 0.98, 5, 14, 0.7], [18, 24, 0.99, 5, 15, 0.7], [19, 25, 0.99, 5, 16, 0.7],
    [16, 20, 0.97, 4, 12, 0.65], [20, 26, 0.99, 5, 16, 0.7], [18, 23, 0.98, 5, 15, 0.7], [17, 21, 0.98, 5, 14, 0.7],
  ];
  const ENDLESS_NAMES = ['Fusion', 'Plasma', 'Photon', 'Neutrino', 'Tachyon', 'Singularity'];

  // Level 1 is built by hand: a chain of three, so the first taps teach the
  // rule. Each trace waits on the one before it.
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
    let overclock;
    if (set.index < SETS.length) {
      row = SETS[set.index].levels[slot];
      overclock = isOverclocked(set.index, slot);
    } else {
      const rng = makeRng(hashString('endless:' + level));
      const size = ENDLESS_SIZES[rng.int(ENDLESS_SIZES.length)];
      row = size.concat([0.5 + 0.5 * rng()]);
      overclock = isOverclocked(set.index, slot);
    }
    if (!row) return { level, set: set.name, tutorial: true, overclock: false };
    return {
      level,
      set: set.name,
      overclock,
      w: row[0],
      h: row[1],
      density: row[2],
      minLen: row[3],
      maxLen: row[4],
      bend: row[5],
      pick: row[6],
      hard: row[6],
      cover: 0.4 + 1.6 * row[6],
      seed: 'level:' + level,
    };
  }

  /*
   * Overclocked levels: from the second set on, the fourth and eighth level
   * of each set, and from the fourth set on, the last one too. Level 14 is
   * the first.
   */
  /*
   * Which levels in a set are overclocked: none in the first set, then two
   * per set (three from the fourth set on), at seeded spots that differ
   * from set to set and never sit side by side. The second set's first
   * one is always its fourth level (14), where the drone explains it.
   */
  const ocSlots = new Map();

  function overclockSlots(setIndex) {
    if (setIndex < 1) return [];
    if (ocSlots.has(setIndex)) return ocSlots.get(setIndex);
    const rng = makeRng(hashString('overclock:' + setIndex));
    const want = setIndex >= 3 ? 3 : 2;
    // Every way to place them (never the set's first level, never two
    // side by side), picked from evenly.
    const ways = [];
    const walk = (from, chosen) => {
      if (chosen.length === want) return ways.push(chosen);
      for (let slot = from; slot <= 9; slot++) walk(slot + 2, chosen.concat(slot));
    };
    walk(1, []);
    const fit = setIndex === 1 ? ways.filter((w) => w.includes(3)) : ways;
    const picks = fit[rng.int(fit.length)];
    ocSlots.set(setIndex, picks);
    return picks;
  }

  function isOverclocked(setIndex, slot) {
    return overclockSlots(setIndex).includes(slot);
  }

  /*
   * An overclocked board's power, in seconds. The core starts full at
   * `max` and drains one second per second; each trace cleared adds
   * `refill` (up to `max`), and each short takes `cost`. `refill` is about
   * how long finding a free trace should take on this board: longer on
   * boards with a higher rating (fewer free traces among more).
   */
  /*
   * How much power an overclocked board gets. The refill per trace is the
   * time the simulated player needs per trace on this board, times
   * `slack`: 1 matches the player it was fitted to, more is kinder, less
   * is tighter (Impossible uses 0.93: in recorded play that player beat
   * the simulation by about 10% on newer boards). Cubes get 40% more on top: measured play
   * covers only the start of one cube, and they are the harder shape. The
   * bar starts full (12 to 30 seconds, more for more traces) and can
   * overcharge to twice that: the battery, so clearing fast is never
   * wasted. A short costs one and a half refills, but never more than 3
   * seconds, so a slip on a slow board isn't ruinous.
   */
  const CUBE_SLACK = 1.4;

  function overclockFor(puzzle, slack) {
    const n = puzzle.arrows.length;
    const pace = puzzle.pace || humanPace(puzzle).perTrace;
    const refill = pace * (slack || 1.2) * (puzzle.kind === 'cube' ? CUBE_SLACK : 1);
    const max = Math.max(12, Math.min(30, 10 + n * 0.15));
    return { max, cap: 2 * max, refill, cost: Math.min(3, refill * 1.5) };
  }

  // How kind the clock is: the campaign is for everyone, a custom board a
  // little tighter, and a board maxed out on every setting is tuned tight.
  function overclockSlack(mode, custom) {
    if (mode === 'level') return 1.5;
    return custom && customSpec(custom).hard === 1 ? 0.93 : 1.2;
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

  // ---------- Build your own ----------

  const CUSTOM = {
    minW: 4,
    maxW: 30,
    minH: 4,
    maxH: 40,
    minFace: 3,
    maxFace: 20,
    density: [0.65, 0.85, 0.98], // Roomy, Snug, Packed
    length: [[2, 3], [2, 6], [3, 10]], // Short, Mixed, Long
    bend: [0, 0.35, 0.65], // Straight, Bendy, Twisty
  };

  // A custom board's settings: { shape: 'flat', w, h } or { shape: 'cube',
  // n }, plus density, length, and bend (0-2 each) and a seed.
  function customSpec(c) {
    const len = CUSTOM.length[c.length];
    const shape = c.shape === 'cube' ? { kind: 'cube', n: c.n } : { w: c.w, h: c.h };
    // At the very top of every setting the generator goes all out too:
    // it keeps the hardest of its candidates and pushes hardest on few free
    // traces and long lanes.
    const biggest = c.shape === 'cube' ? c.n === CUSTOM.maxFace : c.w === CUSTOM.maxW && c.h === CUSTOM.maxH;
    const max = biggest && c.density === 2 && c.length === 2 && c.bend === 2;
    return Object.assign(shape, {
      density: CUSTOM.density[c.density],
      minLen: len[0],
      maxLen: len[1],
      bend: CUSTOM.bend[c.bend],
      pick: max ? 1 : 0.6,
      hard: max ? 1 : 0.75,
      cover: 1.4,
      overclock: !!c.overclock,
      // The same board with or without Overclock.
      seed: 'custom:' + codeOf(Object.assign({}, c, { seed: 0, overclock: false })) + ':' + c.seed,
    });
  }

  function validCustom(c) {
    const ok3 = (v) => Number.isInteger(v) && v >= 0 && v <= 2;
    const size =
      c.shape === 'cube'
        ? Number.isInteger(c.n) && c.n >= CUSTOM.minFace && c.n <= CUSTOM.maxFace
        : Number.isInteger(c.w) && c.w >= CUSTOM.minW && c.w <= CUSTOM.maxW && Number.isInteger(c.h) && c.h >= CUSTOM.minH && c.h <= CUSTOM.maxH;
    return size && ok3(c.density) && ok3(c.length) && ok3(c.bend);
  }

  /*
   * Share codes. A flat board: two digits of width, two of height, then
   * density, length, and bend (0-2 each), a dash, and the seed, like
   * 0810121-4821. A cube: C, two digits of face size, the same three
   * settings, and the seed, like C06121-4821. An X on the end means
   * Overclock is on: 0810121-4821X.
   */
  function codeOf(c) {
    const tail = '' + c.density + c.length + c.bend + '-' + c.seed + (c.overclock ? 'X' : '');
    if (c.shape === 'cube') return 'C' + String(c.n).padStart(2, '0') + tail;
    return String(c.w).padStart(2, '0') + String(c.h).padStart(2, '0') + tail;
  }

  function parseCode(text) {
    const t = String(text || '').trim().toUpperCase();
    let c = null;
    let m = /^C\s*(\d{2})([0-2])([0-2])([0-2])\s*-?\s*(\d{1,6})(X?)$/.exec(t);
    if (m) c = { shape: 'cube', n: +m[1], density: +m[2], length: +m[3], bend: +m[4], seed: +m[5], overclock: !!m[6] };
    m = m ? null : /^(\d{2})(\d{2})([0-2])([0-2])([0-2])\s*-?\s*(\d{1,6})(X?)$/.exec(t);
    if (m) c = { shape: 'flat', w: +m[1], h: +m[2], density: +m[3], length: +m[4], bend: +m[5], seed: +m[6], overclock: !!m[7] };
    return c && validCustom(c) ? c : null;
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
    flatGeometry,
    cubeGeometry,
    geometryOf,
    CUBE_FACES,
    cubeCenter,
    cubeStep,
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
    tile,
    orient,
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
    isOverclocked,
    humanPace,
    overclockSlack,
    HUMAN,
    overclockFor,
    HINTS,
    PALETTE_SIZE,
    SET_COUNT: SETS.length,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CircuitJamCore = api;
})(typeof self !== 'undefined' ? self : this);
