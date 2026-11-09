const test = require('node:test');
const assert = require('node:assert');
const Core = require('../js/core.js');

const board = (w, h, arrows) => ({ w, h, arrows: arrows.map((cells) => ({ cells, color: 0 })) });

test('an arrow points the way it travels into its head', () => {
  assert.strictEqual(Core.dirOf({ cells: [[0, 1], [0, 0]] }), 0);
  assert.strictEqual(Core.dirOf({ cells: [[0, 0], [1, 0]] }), 1);
  assert.strictEqual(Core.dirOf({ cells: [[0, 0], [0, 1]] }), 2);
  assert.strictEqual(Core.dirOf({ cells: [[1, 0], [0, 0]] }), 3);
  // A bent arrow: only the last step counts.
  assert.strictEqual(Core.dirOf({ cells: [[0, 0], [1, 0], [1, 1]] }), 2);
});

test('the lane runs straight from the head to the edge', () => {
  const b = board(5, 3, [[[0, 1], [1, 1]]]);
  assert.deepStrictEqual(Core.laneOf(b, 0), [[2, 1], [3, 1], [4, 1]]);
  const edge = board(3, 3, [[[1, 1], [2, 1]]]);
  assert.deepStrictEqual(Core.laneOf(edge, 0), []);
});

test('probe: free when the lane is empty, blocked by the first arrow in it', () => {
  const b = board(5, 3, [
    [[0, 1], [1, 1]], // points right
    [[3, 0], [3, 1], [3, 2]], // points down, sits in the first arrow's lane
  ]);
  const hit = Core.probe(b, 0, null);
  assert.strictEqual(hit.free, false);
  assert.strictEqual(hit.by, 1);
  assert.strictEqual(hit.steps, 1); // one empty cell before the bump
  assert.strictEqual(Core.probe(b, 1, null).free, true);
  // Once the blocker is gone the lane is open.
  assert.strictEqual(Core.probe(b, 0, [false, true]).free, true);
  assert.deepStrictEqual(Core.freeArrows(b, null), [1]);
});

test('a bent body never matters, only the head lane', () => {
  // Body wraps around; the head at (2,0) points up and the lane is empty.
  const b = board(4, 4, [[[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]]]);
  assert.strictEqual(Core.probe(b, 0, null).free, true);
});

test('two arrows facing each other in one lane can never be cleared', () => {
  const b = board(4, 1, [
    [[0, 0], [1, 0]], // points right
    [[3, 0], [2, 0]], // points left
  ]);
  assert.strictEqual(Core.isClearable(b), false);
  const r = Core.clearWaves(b);
  assert.strictEqual(r.stuck, 2);
});

test('clearing in waves counts how deep the blocking goes', () => {
  const lv = Core.generateLevel(1);
  const r = Core.clearWaves(lv);
  assert.ok(r.ok);
  assert.strictEqual(r.waves, 3); // the tutorial is a chain of three
  assert.deepStrictEqual(r.sizes, [1, 1, 1]);
});

test('the rating is 1 when every arrow is free', () => {
  const b = board(3, 3, [[[0, 0], [1, 0]], [[0, 2], [1, 2]]]);
  assert.strictEqual(Core.rate(b, 'x').rating, 1);
});

function checkBoard(lv, label) {
  const seen = new Set();
  lv.arrows.forEach((a, i) => {
    assert.ok(a.cells.length >= 2, label + ' arrow ' + i + ' too short');
    a.cells.forEach(([x, y], k) => {
      assert.ok(x >= 0 && y >= 0 && x < lv.w && y < lv.h, label + ' cell off the board');
      const key = x + ',' + y;
      assert.ok(!seen.has(key), label + ' two arrows share ' + key);
      seen.add(key);
      if (k) assert.notStrictEqual(Core.dirBetween(a.cells[k - 1], a.cells[k]), -1, label + ' arrow ' + i + ' has a gap');
    });
    // An arrow's lane never crosses its own body.
    const own = new Set(a.cells.map(([x, y]) => x + ',' + y));
    Core.laneOf(lv, i).forEach(([x, y]) => assert.ok(!own.has(x + ',' + y), label + ' arrow ' + i + ' blocks itself'));
    assert.ok(Number.isInteger(a.color) && a.color >= 0 && a.color < Core.PALETTE_SIZE, label + ' color');
  });
  assert.ok(Core.isClearable(lv), label + ' cannot be cleared');
  assert.ok(Core.freeArrows(lv, null).length >= 1, label + ' has no free arrow');
}

test('every campaign level from 1 to 120 can be cleared', () => {
  for (let n = 1; n <= 120; n++) checkBoard(Core.generateLevel(n), 'level ' + n);
});

test('touching arrows have different colors', () => {
  for (const n of [5, 25, 45, 65]) {
    const lv = Core.generateLevel(n);
    const occ = Core.occupancy(lv, null);
    lv.arrows.forEach((a, i) =>
      a.cells.forEach(([x, y]) => {
        for (let d = 0; d < 4; d++) {
          const nx = x + Core.DX[d];
          const ny = y + Core.DY[d];
          if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
          const j = occ[ny * lv.w + nx];
          if (j !== -1 && j !== i) assert.notStrictEqual(lv.arrows[j].color, a.color, 'level ' + n);
        }
      })
    );
  }
});

test('levels are the same every time', () => {
  for (const n of [2, 17, 48, 93]) {
    assert.deepStrictEqual(Core.generateLevel(n), Core.generateLevel(n));
  }
  assert.notDeepStrictEqual(Core.generateLevel(20).arrows, Core.generateLevel(21).arrows);
});

test('random custom mixes at every setting can be cleared', () => {
  const rng = Core.makeRng(7);
  for (let k = 0; k < 120; k++) {
    const c = {
      w: Core.CUSTOM.minW + rng.int(Core.CUSTOM.maxW - Core.CUSTOM.minW + 1),
      h: Core.CUSTOM.minH + rng.int(Core.CUSTOM.maxH - Core.CUSTOM.minH + 1),
      density: rng.int(3),
      length: rng.int(3),
      bend: rng.int(3),
      seed: 1000 + rng.int(9000),
    };
    checkBoard(Core.generate(Core.customSpec(c)), Core.codeOf(c));
  }
});

test('straight settings make straight arrows', () => {
  const lv = Core.generate(Core.customSpec({ w: 8, h: 8, density: 1, length: 1, bend: 0, seed: 5 }));
  lv.arrows.forEach((a) => {
    const d = Core.dirBetween(a.cells[0], a.cells[1]);
    a.cells.forEach((c, k) => k && assert.strictEqual(Core.dirBetween(a.cells[k - 1], c), d));
  });
});

test('denser settings fill more of the board', () => {
  const fill = (density) => {
    let sum = 0;
    for (let s = 0; s < 8; s++) sum += Core.generate(Core.customSpec({ w: 9, h: 11, density, length: 1, bend: 1, seed: s })).fill;
    return sum / 8;
  };
  const roomy = fill(0);
  const packed = fill(2);
  assert.ok(packed > roomy + 0.1, 'packed ' + packed.toFixed(2) + ' vs roomy ' + roomy.toFixed(2));
  assert.ok(packed > 0.85, 'packed boards are mostly full: ' + packed.toFixed(2));
});

test('share codes round-trip and reject bad input', () => {
  const c = { shape: 'flat', w: 8, h: 10, density: 1, length: 2, bend: 1, seed: 4821, overclock: false };
  const code = Core.codeOf(c);
  assert.strictEqual(code, '0810121-4821');
  assert.deepStrictEqual(Core.parseCode(code), c);
  assert.deepStrictEqual(Core.parseCode(' 0810121 4821 '), c);
  assert.strictEqual(Core.parseCode('0810321-4821'), null); // density out of range
  assert.strictEqual(Core.parseCode('3110121-4821'), null); // too wide
  assert.strictEqual(Core.parseCode('3041121-4821'), null); // too tall
  assert.strictEqual(Core.parseCode('3040211-4821').h, 40); // the biggest board
  assert.strictEqual(Core.parseCode('0303121-1'), null); // too small
  assert.strictEqual(Core.parseCode('hello'), null);
  // Same code, same board.
  assert.deepStrictEqual(Core.generate(Core.customSpec(c)), Core.generate(Core.customSpec(Core.parseCode(code))));
  // X on the end means Overclock; the board is the same either way.
  const oc = Core.parseCode('0810121-4821X');
  assert.strictEqual(oc.overclock, true);
  assert.strictEqual(Core.codeOf(oc), '0810121-4821X');
  assert.strictEqual(Core.parseCode(code).overclock, false);
  assert.deepStrictEqual(Core.generate(Core.customSpec(oc)).arrows, Core.generate(Core.customSpec(c)).arrows);
  assert.strictEqual(Core.parseCode('c06211-77x').overclock, true);
  // Cube codes start with C.
  const cube = { shape: 'cube', n: 6, density: 2, length: 1, bend: 1, seed: 77, overclock: false };
  assert.strictEqual(Core.codeOf(cube), 'C06211-77');
  assert.deepStrictEqual(Core.parseCode('c06211-77'), cube);
  assert.strictEqual(Core.parseCode('C21211-77'), null); // face too big
  assert.strictEqual(Core.parseCode('C20211-77').n, 20); // the biggest cube
  assert.strictEqual(Core.parseCode('C02211-77'), null); // face too small
});

test('stars: clean is 3, a few bumps 2, more 1, hints cap at 2', () => {
  assert.strictEqual(Core.starsFor(0, 10, false), 3);
  assert.strictEqual(Core.starsFor(0, 10, true), 2);
  assert.strictEqual(Core.starsFor(2, 10, false), 2);
  assert.strictEqual(Core.starsFor(3, 10, false), 1);
  assert.strictEqual(Core.bumpAllowance(30), 4);
  assert.strictEqual(Core.starsFor(4, 30, false), 2);
  assert.strictEqual(Core.starsFor(5, 30, true), 1);
});

test('sets: ten levels each, then endless sets', () => {
  assert.strictEqual(Core.setOf(1).name, 'Breadboard');
  assert.strictEqual(Core.setOf(10).name, 'Breadboard');
  assert.strictEqual(Core.setOf(11).name, 'Relay');
  assert.strictEqual(Core.setOf(Core.SET_COUNT * 10 + 1).name, 'Fusion');
  assert.strictEqual(Core.setOf(Core.SET_COUNT * 10 + 61).name, 'Fusion 2');
});

test('early levels have only straight arrows; bends arrive at level 6', () => {
  for (let n = 2; n <= 5; n++) assert.strictEqual(Core.levelSpec(n).bend, 0, 'level ' + n);
  assert.ok(Core.levelSpec(6).bend > 0);
});

// ---------- The cube ----------

test('cube neighbors: every step over an edge can be walked back', () => {
  for (const n of [3, 5, 8]) {
    const g = Core.cubeGeometry(n);
    assert.strictEqual(g.count, 6 * n * n);
    for (let k = 0; k < g.count; k++) {
      for (let d = 0; d < 4; d++) {
        const m = g.nb[k * 4 + d];
        assert.ok(m >= 0, 'every cube cell has four neighbors');
        assert.strictEqual(g.nb[m * 4 + ((g.nd[k * 4 + d] + 2) % 4)], k, 'n=' + n + ' cell ' + k + ' dir ' + d);
      }
    }
  }
});

test('cube neighbors are really next to each other in 3D', () => {
  const n = 4;
  const g = Core.cubeGeometry(n);
  for (let k = 0; k < g.count; k++) {
    const [f, u, v] = g.cellOf(k);
    const a = Core.cubeCenter(n, f, u, v);
    for (let d = 0; d < 4; d++) {
      const [f2, u2, v2] = g.cellOf(g.nb[k * 4 + d]);
      const b = Core.cubeCenter(n, f2, u2, v2);
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // One apart on a face; across an edge the centers are diagonal.
      assert.ok(Math.abs(dist - (f === f2 ? 1 : Math.SQRT1_2)) < 1e-9, 'distance ' + dist);
    }
  }
});

function checkCube(lv, label) {
  const g = Core.geometryOf(lv);
  const seen = new Set();
  lv.arrows.forEach((a, i) => {
    assert.ok(a.cells.length >= 2, label + ' arrow too short');
    a.cells.forEach((c, k) => {
      const key = g.key(c);
      assert.ok(!seen.has(key), label + ' two arrows share a cell');
      seen.add(key);
      if (k) {
        const prev = g.key(a.cells[k - 1]);
        let next = false;
        for (let d = 0; d < 4; d++) if (g.nb[prev * 4 + d] === key) next = true;
        assert.ok(next, label + ' arrow ' + i + ' has a gap');
      }
    });
    // The head's last step stays on one face, so it has a direction.
    assert.notStrictEqual(Core.dirOf(a), -1, label + ' arrow ' + i + ' has no direction');
    const own = new Set(a.cells.map((c) => g.key(c)));
    Core.laneOf(lv, i).forEach((c) => {
      assert.strictEqual(c[0], Core.headOf(a)[0], label + ' lane leaves its face');
      assert.ok(!own.has(g.key(c)), label + ' arrow ' + i + ' blocks itself');
    });
  });
  assert.ok(Core.isClearable(lv), label + ' cannot be cleared');
}

test('cube boards at every setting can be cleared', () => {
  const rng = Core.makeRng(11);
  for (let k = 0; k < 30; k++) {
    const c = {
      shape: 'cube',
      n: Core.CUSTOM.minFace + rng.int(6),
      density: rng.int(3),
      length: rng.int(3),
      bend: rng.int(3),
      seed: 1000 + rng.int(9000),
    };
    checkCube(Core.generate(Core.customSpec(c)), Core.codeOf(c));
  }
});

test('some cube traces wrap over an edge', () => {
  let wraps = 0;
  for (let seed = 0; seed < 5; seed++) {
    const lv = Core.generate(Core.customSpec({ shape: 'cube', n: 5, density: 2, length: 2, bend: 1, seed }));
    lv.arrows.forEach((a) => a.cells.some((c, k) => k && c[0] !== a.cells[k - 1][0]) && wraps++);
  }
  assert.ok(wraps > 5, 'traces cross edges: ' + wraps);
});

test('the biggest flat boards build and clear', () => {
  const lv = Core.generate(Core.customSpec({ shape: 'flat', w: 30, h: 40, density: 2, length: 1, bend: 1, seed: 3 }));
  checkBoard(lv, '30x40');
  assert.ok(lv.fill > 0.8, 'packed big board is mostly full: ' + lv.fill.toFixed(2));
});

test('overclocked levels start at 14 and come a few per set', () => {
  const oc = [];
  for (let n = 1; n <= 70; n++) if (Core.levelSpec(n).overclock) oc.push(n);
  assert.strictEqual(oc[0], 14);
  assert.ok(oc.every((n) => n > 10), 'none in the first set');
  for (let s = 1; s < 7; s++) {
    const inSet = oc.filter((n) => n > s * 10 && n <= s * 10 + 10).length;
    assert.ok(inSet >= 2 && inSet <= 3, 'set ' + s + ' has ' + inSet);
  }
});

test('overclock power: harder boards refill more per trace', () => {
  const easy = Core.overclockFor({ arrows: new Array(10), rating: 2 });
  const hard = Core.overclockFor({ arrows: new Array(40), rating: 12 });
  assert.ok(hard.refill > easy.refill);
  assert.ok(hard.max >= easy.max);
  assert.ok(easy.cost >= 3 && hard.cost > hard.refill);
});
