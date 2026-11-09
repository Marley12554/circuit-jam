# Circuit Jam

A sci-fi circuit puzzle for all ages. The board is a glowing chip packed with bent traces, each ending in an arrow. Tap one: if nothing is in front of its arrow, it unzips off the board, its body following the arrow around every bend, then runs along the bus around the rim into the power core. If something is in the way, it shorts out and settles back. Clear the board without a single short for 3 stars.

There is no fixed level list. Every level is generated from its number, so the levels never run out and level 47 is the same puzzle on every device. Every board can be cleared.

## Play

Open `index.html` in a browser. It works straight from disk, or from any web server:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

To put it online with GitHub Pages: make the repository public, open **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The game appears at `https://<your-username>.github.io/circuit-jam/`.

## What's in the game

- **The rule.** A trace can leave only when every cell straight ahead of its arrow, out to the edge, is empty. Its body doesn't matter: it just follows the arrow. Removing a trace only ever opens space, so a trace that is free stays free and there are no dead ends. The challenge is spotting which traces are free.
- **The core.** A trace that leaves charges up: it turns white-hot with a bolt of lightning crackling along it, and runs around the rim bus (the shorter way) trailing an afterglow, into the core at the top of the board. The core is a battery: it glows white while a trace pours in, then flashes the trace's color, throws off arcs of lightning, ripples, and lights its share of a ring of 12 charge cells. The last trace overloads it and the level is won. You can keep tapping while traces are still on their way.
- **Campaign.** Seven sets of ten levels (Breadboard, Relay, Capacitor, Transistor, Processor, Mainframe, Quantum), then endless sets after that (Fusion, Plasma, Photon, Neutrino, Tachyon, Singularity, then round again). Each set has its own trace colors: a main color and one accent at first, with a third and fourth color in later sets. Every level is open from the start; the level map has a "Go to level" box and shows more endless sets on request. Play continues from the first level you haven't finished. Level 1 is built by hand to teach the rule; levels 2 to 5 use straight traces only, and bends arrive at level 6. Campaign boards grow from 4 by 5 to 18 by 24 (and 20 by 26 in the endless sets), get fuller, and the traces get longer and twistier, while harder levels keep fewer traces free at once. Each set has a couple of easier "breather" levels. From level 14, two or three levels in each set are Overclocked (see below).
- **Overclock.** Overclocked boards are timed. A power bar under the HUD drains every second; each trace you clear tops it up, each short drains a chunk, and if it runs dry the core drains, the board goes dark, and you try again (no stars, no run kept). Under 30% the core starts dying, and it gets worse the closer it gets to empty: a low electrical hum sags in pitch and grows louder, warning beeps come faster and lower, the power cuts out in crackling sputters, the board browns out and blacks out for a moment when it does, the screen edges pulse red with each beep, and the seconds left count down beside the red bar. Refilling past 30% calms it all down. The clock waits a moment before it starts, and stops while the board is off screen, the tab is hidden, or a card is open. How much power a board gets depends on its trace count and rating: it starts with 12 to 30 seconds, and a clear refills more on harder boards. Overclocked levels look electrified everywhere: on the level map their buttons flicker blue-white with moving stripes and a bolt, the home screen says "Overclocked", and while you play the board's frame crackles with little arcs (a cube crackles around its edge). Build your own has an Overclock switch for flat boards and cubes alike.
- **The finale.** Clearing a board ends with the core powering up. Pulses of light race around the bus into the core from both sides and streaks pour in from the edges, a wave of light floods the chip outward from the core while the bus goes white-hot and lightning arcs off the core, then it bursts in a flash over the whole screen with shockwaves and sparks, and the chip keeps pulsing behind the win card. A long rising charge builds into a boom and a ringing chord, and phones that support it buzz faster and faster, then long on the burst. A zoomed-in board zooms back out for it. Reduced motion skips straight to the win card.
- **Shorts and stars.** Tapping a blocked trace is a short: the trace lurches up to the one in its way, flickers red with a shower of sparks, the one it hit flashes white, and the drone says which color is blocking. The board doesn't change. 3 stars for no shorts, 2 stars for a few (2, plus 1 for every 15 traces), 1 star otherwise. Restart starts the count over. There are no lives and no forced restarts.
- **Hints.** 3 per level. A hint makes the most useful free trace (the one holding up the most others) glow. Asking again before tapping it repeats the hint for free. Using a hint caps the level at 2 stars. Restart refills them.
- **Build your own.** Pick a shape, Flat or Cube. A flat board can be 4 to 30 cells wide and 4 to 40 tall; tap a preset (Easy, Medium, Hard, and Genius, each card showing a real board it makes, plus Impossible) or set things yourself. A cube has faces of 3 to 20 cells. Both have fill (Roomy, Snug, Packed), traces (Short, Mixed, Long), and bends (Straight, Bendy, Twisty). Presets work for both shapes (Easy 3, Medium 5, Hard 8, Genius 12 for a cube's faces), and Impossible turns everything all the way up: 30 by 40 (or a cube with 20 by 20 faces), Packed, Long, Twisty, and Overclock on. It is the only preset that touches the Overclock switch, and at those settings the generator also keeps the hardest of its candidates and pushes hardest for few free traces. Switching shape keeps the preset; a preset stays lit only while every setting matches it. Every board gets a code that friends can type in to play the same one: `0810121-4821` for a flat board (width, height, fill, traces, bends, then the seed) or `C06121-4821` for a cube (C, face size, the same three settings, then the seed). An overclocked board's code ends in X, and the board is the same with or without it. Big boards take up to a second or two to build, and the drone says so while it works.
- **The cube.** Six faces, each its own board, drawn in 3D. Drag to spin it freely; a flick keeps it turning for a moment. Pinch (or the mouse wheel, or the zoom buttons) zooms; two fingers, a right-button drag, or a Shift drag pans. Traces can wrap over an edge onto the next face, but a trace's arrow only looks ahead on its own face, out to that face's edge. Only the faces turned toward you are drawn, so you have to spin it to find what is free. A trace with a clear path unzips to the edge of its face and shoots straight out into space as a streak of energy, ending in a burst of sparks, and the charge meter above the cube fills. Clearing a face (every trace touching it gone, wrapped tails included) sets off its own moment: a wave of light sweeps across the face, its outline flashes, FACE CLEAR glows on it, sparks fly, a power-up chord plays a step higher for each face, phones that support it buzz, and the drone counts it ("Face cleared! 2 of 6"). Cleared faces keep a soft glow, and six pips beside the meter count them. Clearing the whole cube sets off a finale: the energy you discharged pours back in as streaks from every edge of the screen, the cube spins up by itself as every tile floods with light and lightning arcs off it, then it bursts in a flash with shockwaves and sparks, and keeps turning behind the win card as a glowing reactor. A long rising charge builds into a boom and a ringing chord, and phones that support it buzz faster and faster, then long on the burst. A hint turns the cube to face the trace it lights up. Arrow keys turn the cube too.
- **Zoom.** Boards too big to tap comfortably get zoom buttons (in, out, and fit) in the corner. Pinch or use the mouse wheel to zoom, and drag to pan. On those boards a tap counts when your finger lifts, so a drag never clears a trace by accident.
- **Pause and resume.** The current run is saved after every tap, so you can leave for the home screen, the level map, or another tab (or close the page) and pick it up again with Resume, or by opening that level again. Winning clears it; starting a different level or a new board replaces it.
- **Playtest recording.** Only in the claude.ai artifact build, where the page can keep data: each attempt at a board is saved for tuning the difficulty. That covers the board's settings and, for every tap, when it came, whether it cleared or shorted, how many traces were free and left, the power, the zoom, and on a cube which faces were in view and how far it was turned since the last tap. Pauses are marked so time away isn't counted. Nothing personal is kept; each player writes only under their own id and only the owner reads them all. A "Share play data" switch on the home screen turns it off. The GitHub Pages build never records.
- **Vibration.** On phones that let web pages vibrate (most Android phones; iPhones don't), clearing a cube face, winning, and the cube's finale give a buzz. A Vibration switch on the home screen turns it off; it is hidden where vibration isn't available.
- **Keyboard.** Arrow keys move a box around the board, Enter or Space taps the trace inside it, and H asks for a hint.
- **Sounds** are synthesized in the browser (no audio files): taps on buttons, a soft pop when the mouse moves onto one, a jingle when a level starts, an electric charge-up that lasts each trace's whole trip (a buzzing tone climbing in pitch with sparks crackling, starting higher as the core fills), a landing as it pours into the core (a crack and a thump, a quick upward sweep, and a ringing chime with a hum and stray sparks under it; each landing chimes a step higher up a pentatonic scale as the core fills), a crackle and buzz for a short, an overload surge when the core fills, a win tune, a warning beep when an overclocked core runs low, and a power-down when it drains.
- **The look.** A dark circuit board. The play area is a framed chip of cell tiles labeled like a circuit board (columns A, B, C..., rows 1, 2, 3...). Live wires run in from the screen edges behind every screen, each carrying a traveling spark. A small drone narrates while you play. Browsers block sound until the first tap, so the game is silent until then. Progress is saved in the browser.

The screens and their structure come from [Color Lab](https://github.com/Marley12554/color-lab).

## How levels are made

`js/core.js` holds everything that is not drawing. In the code a trace is an "arrow", and the rules and generator work on a board's geometry (how its cells are numbered and connected), so flat boards and cubes share one generator. On a cube, stepping off a face leads onto the next one, but a lane never leaves its face.

1. **Tile.** Leave a share of cells empty (more on roomier boards, almost none on packed ones), then cover the rest with paths. Each path starts in the most hemmed-in empty cell and walks into the neighbor with the fewest empty neighbors of its own, turning at the level's bend rate, so nothing gets stranded. A lone leftover cell joins the end of a neighboring path, or stays empty.
2. **Orient.** Every path can point either way. The cells never move, so each arrow's blockers depend only on its own direction and are worked out once for both. Each arrow starts pointing the way with fewer arrows in its lane. A board can be cleared exactly when no arrows block each other in a loop, so loops are untangled first, cheapest method first: flip an arrow in a loop when the flip takes it out of every loop (a small search from that one arrow tells, because a flip can only make a loop through the arrow flipped); then try flips that don't add to the loops; and if a loop runs through arrows that can only point one way, take those out (removing an arrow only ever frees others). Then a seeded hill climb flips arrows one at a time and keeps changes that don't make the board worse and don't make a loop. It avoids convoys (an arrow blocked by one heading the same way along the same line) and arrows side by side heading the same way, and on harder levels it keeps few arrows free and lanes long. Each of those depends on only a few arrows, so a flip is scored from just the ones it touches, which is why even a 30 by 40 board or a cube with 20 by 20 faces builds in well under a second.
3. **Fallback.** If a path's lane would run into its own body whichever way it points, the board is built the old way instead: arrows placed one at a time, each with an empty lane when placed, so taking them off newest first always works. This happens in well under 1% of boards.
4. **Color.** Touching arrows get different color slots. Each set maps the slots onto its own few trace colors, so in early sets neighbors can share a color; the tail pads keep each trace readable.
5. **Rate and pick.** Picture a player tapping at random: with *r* arrows left and *f* of them free, they need *r* / *f* taps to find a free one. The rating is that average over a whole clear (1 means every arrow is always free). Six boards (three on the biggest) are built at the level's settings, sorted by rating, and the one at the level's `pick` (0 easiest, 1 hardest) is kept.

Everything is seeded and nothing depends on time, so every device makes the same boards. The biggest boards take a few tens of milliseconds, so there is no background worker.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Page markup |
| `css/style.css` | All styles |
| `js/core.js` | Rules, generator, rating, campaign table, codes, stars. No DOM; runs in the page and in Node. |
| `js/game.js` | Screens, the flat board (SVG) with zoom and pan, the cube (canvas, in 3D), the charge-up, short, and core animations, background wires, tools, progress |
| `js/sound.js` | Web Audio sound effects |
| `test/` | Unit tests for the rules and generator, and the version stamp check |
| `tools/` | The campaign report, browser play-test, screenshots, version stamp, and the single-file build |

## Development

```bash
npm test
```

Runs the unit tests (Node 18 or newer, no dependencies), including checks that every level from 1 to 120, random custom boards, random cubes, and a 30 by 40 board can all be cleared, that cube edges connect correctly, and that overclocked levels and codes behave.

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

Plays whole levels through the real page in headless Chromium and checks the cube (tapping, shorts, spinning, resume, codes), zoom on a 30 by 40 board, shorts, stars, hints, restart, pause and resume, the level map, presets on both shapes, puzzle codes, Overclock (draining, refills, shorts, losing, Try again, resume), and keyboard play. This one and `tools/shoot.js` (screenshots) need Playwright.

```bash
node tools/build-artifact.js dist/circuit-jam.html --standalone
```

Packs the whole game into one HTML file.
