# Unfold

A sci-fi circuit puzzle for all ages. The board is a glowing chip packed with bent traces, each ending in an arrow. Tap one: if nothing is in front of its arrow, it unzips off the board, its body following the arrow around every bend, then runs along the bus around the rim into the power core. If something is in the way, it shorts out and settles back. Clear the board without a single short for 3 stars.

There is no fixed level list. Every level is generated from its number, so the levels never run out and level 47 is the same puzzle on every device. Every board can be cleared.

## Play

Open `index.html` in a browser. It works straight from disk, or from any web server:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

To put it online with GitHub Pages: make the repository public, open **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The game appears at `https://<your-username>.github.io/unfold/`.

## What's in the game

- **The rule.** A trace can leave only when every cell straight ahead of its arrow, out to the edge, is empty. Its body doesn't matter: it just follows the arrow. Removing a trace only ever opens space, so a trace that is free stays free and there are no dead ends. The challenge is spotting which traces are free.
- **The core.** Every trace that leaves runs around the rim bus (the shorter way) into the core at the top of the board. The core flashes the trace's color, sends out a ring of light, and its meter fills; the last trace overloads it and the level is won. You can keep tapping while traces are still on their way.
- **Campaign.** Seven sets of ten levels (Breadboard, Relay, Capacitor, Transistor, Processor, Mainframe, Quantum), then endless sets after that (Fusion, Plasma, Photon, Neutrino, Tachyon, Singularity, then round again). Each set has its own trace colors: a main color and one accent at first, with a third and fourth color in later sets. Every level is open from the start; the level map has a "Go to level" box and shows more endless sets on request. Play continues from the first level you haven't finished. Level 1 is built by hand to teach the rule; levels 2 to 5 use straight traces only, and bends arrive at level 6. Boards grow from 4 by 4 to 12 by 16, get fuller, and the traces get longer and twistier. Each set has a couple of easier "breather" levels.
- **Shorts and stars.** Tapping a blocked trace is a short: the trace lurches up to the one in its way, flickers red with a shower of sparks, the one it hit flashes white, and the drone says which color is blocking. The board doesn't change. 3 stars for no shorts, 2 stars for a few (2, plus 1 for every 15 traces), 1 star otherwise. Restart starts the count over. There are no lives and no forced restarts.
- **Hints.** 3 per level. A hint makes the most useful free trace (the one holding up the most others) glow. Asking again before tapping it repeats the hint for free. Using a hint caps the level at 2 stars. Restart refills them.
- **Build your own.** Tap a preset (Easy, Medium, Hard, Genius; each card shows a real board it makes) or set things yourself: width (4 to 12), height (4 to 16), fill (Roomy, Snug, Packed), traces (Short, Mixed, Long), and bends (Straight, Bendy, Twisty). A preset stays lit only while every setting matches it. Every board gets a code like `0810121-4821` (width, height, fill, traces, bends, then the seed) that friends can type in to play the same board.
- **Pause and resume.** The current run is saved after every tap, so you can leave for the home screen, the level map, or another tab (or close the page) and pick it up again with Resume, or by opening that level again. Winning clears it; starting a different level or a new board replaces it.
- **Keyboard.** Arrow keys move a box around the board, Enter or Space taps the trace inside it, and H asks for a hint.
- **Sounds** are synthesized in the browser (no audio files): taps on buttons, a soft pop when the mouse moves onto one, a jingle when a level starts, an unzip when a trace leaves (a run of tiny clicks, longer for longer traces), a crackle and buzz for a short, a charge-up as each trace reaches the core (pitched higher as the board empties), an overload when the core fills, and a win tune.
- **The look.** A dark circuit board. Live wires run in from the screen edges behind every screen, each carrying a traveling spark. A small drone narrates while you play. Browsers block sound until the first tap, so the game is silent until then. Progress is saved in the browser.

The screens and their structure come from [Color Lab](https://github.com/Marley12554/color-lab).

## How levels are made

`js/core.js` holds everything that is not drawing. In the code a trace is an "arrow":

1. **Build in reverse.** Arrows are placed one at a time. Each new arrow needs an empty lane (the cells straight ahead of its head) at the moment it is placed, but later arrows are free to sit in earlier lanes. Taking arrows off newest first therefore always works, so every board can be cleared by construction: no loop of arrows blocking each other can ever form. A head cell is chosen among those with an open lane, and the body grows backward from it by a random walk that turns at the level's bend rate and never crosses its own lane.
2. **Keep few arrows free.** Each step tries several placements and prefers the one that closes the most lanes that are still open, plus heads deep inside the board. That keeps the number of free arrows low at every moment, which is what makes a board hard to read.
3. **Fill the gaps.** When long arrows no longer fit, short ones fill pockets, and a few empty cells next to a tail join that arrow (only where no later arrow's lane runs through the cell, so it can't make a loop).
4. **Color.** Touching arrows get different color slots. Each set maps the slots onto its own few trace colors, so in early sets neighbors can share a color; the tail pads keep each trace readable.
5. **Rate and pick.** Picture a player tapping at random: with *r* arrows left and *f* of them free, they need *r* / *f* taps to find a free one. The rating is that average over a whole clear (1 means every arrow is always free). Six boards are built at the level's settings, sorted by rating, and the one at the level's `pick` (0 easiest, 1 hardest) is kept.

Everything is seeded and nothing depends on time, so every device makes the same boards. A big board takes a few milliseconds, so there is no background worker.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup |
| `css/style.css` | All styles |
| `js/core.js` | Rules, generator, rating, campaign table, codes, stars. No DOM; runs in the page and in Node. |
| `js/game.js` | Screens, the circuit board, unzip, short, and core animations, background wires, tools, progress |
| `js/sound.js` | Web Audio sound effects |
| `test/` | Unit tests for the rules and generator, and the version stamp check |
| `tools/` | The campaign report, browser play-test, screenshots, version stamp, and the single-file build |

## Development

```bash
npm test
```

Runs the unit tests (Node 18 or newer, no dependencies), including a check that every level from 1 to 120 can be cleared.

```bash
node tools/stamp.js
```

Stamps a version on the page's script and style links after you change them, so browsers (Safari especially) fetch the new files instead of reusing cached ones. `npm test` fails if the stamp is out of date.

```bash
node tools/campaign.js 1 70
```

Prints every campaign level's size, arrow count, fill, free arrows at the start, waves, rating, and generation time, and checks each can be cleared. Change the `SETS` table in `js/core.js` to retune the curve.

```bash
node tools/playtest.js http://localhost:8765/index.html
```

Plays whole levels through the real page in headless Chromium and checks shorts, stars, hints, restart, pause and resume, the level map, presets, puzzle codes, and keyboard play. This one and `tools/shoot.js` (screenshots) need Playwright.

```bash
node tools/build-artifact.js dist/unfold.html --standalone
```

Packs the whole game into one HTML file.
