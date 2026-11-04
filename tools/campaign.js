// Prints every campaign level's size, arrow count, fill, rating, and
// generation time, and checks each board can be cleared.
// Usage: node tools/campaign.js [from] [to]
const Core = require('../js/core.js');

const from = Number(process.argv[2]) || 1;
const to = Number(process.argv[3]) || 70;
let bad = 0;
console.log('level  set         size   arrows  fill  free  waves  rating   ms');
for (let n = from; n <= to; n++) {
  const t0 = process.hrtime.bigint();
  const lv = Core.generateLevel(n);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ok = Core.isClearable(lv);
  if (!ok) bad++;
  console.log(
    String(n).padStart(5) + '  ' + lv.set.padEnd(10) + '  ' + (lv.w + 'x' + lv.h).padEnd(5) + '  ' +
    String(lv.arrows.length).padStart(6) + '  ' + lv.fill.toFixed(2) + '  ' + String(lv.startFree).padStart(4) + '  ' +
    String(lv.waves).padStart(5) + '  ' + lv.rating.toFixed(2).padStart(6) + '  ' + ms.toFixed(0).padStart(4) +
    (ok ? '' : '  NOT CLEARABLE')
  );
}
if (bad) {
  console.error(bad + ' boards could not be cleared');
  process.exit(1);
}
