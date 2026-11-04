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
  const c = { w: 8, h: 10, density: 1, length: 2, bend: 1, seed: 4821 };
  const code = Core.codeOf(c);
  assert.strictEqual(code, '0810121-4821');
  assert.deepStrictEqual(Core.parseCode(code), c);
  assert.deepStrictEqual(Core.parseCode(' 0810121 4821 '), c);
  assert.strictEqual(Core.parseCode('0810321-4821'), null); // density out of range
  assert.strictEqual(Core.parseCode('1310121-4821'), null); // too wide
  assert.strictEqual(Core.parseCode('0303121-1'), null); // too small
  assert.strictEqual(Core.parseCode('hello'), null);
  // Same code, same board.
  assert.deepStrictEqual(Core.generate(Core.customSpec(c)), Core.generate(Core.customSpec(Core.parseCode(code))));
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
