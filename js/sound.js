/*
 * Every sound is made on the spot with Web Audio, so there are no audio
 * files. Browsers only allow sound after a tap, so the context is created on
 * the first call.
 */
(function () {
  'use strict';

  let ctx = null;
  let master = null;
  let enabled = true;

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // One short note with a quick fade in and out.
  function tone(freq, start, dur, opts) {
    const ac = audio();
    if (!ac) return;
    opts = opts || {};
    const t0 = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const peak = opts.gain == null ? 0.25 : opts.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A short burst of filtered noise: the raw material for clicks and crackle.
  let noiseBuf = null;
  function noise(start, dur, opts) {
    const ac = audio();
    if (!ac) return;
    opts = opts || {};
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime + start;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ac.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 3000, t0);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    filter.Q.value = opts.q == null ? 4 : opts.q;
    const gain = ac.createGain();
    const peak = opts.gain == null ? 0.2 : opts.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.004, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0, Math.random() * 0.4);
    src.stop(t0 + dur + 0.02);
  }

  const Sound = {
    setEnabled(on) {
      enabled = !!on;
      if (!enabled && ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    // A soft pop when the pointer moves onto a button. Silent until the page
    // has been tapped once, like every sound, and never starts the audio on
    // its own (browsers only allow that from a tap).
    pop() {
      if (!ctx || ctx.state !== 'running') return;
      const f = 260 + Math.random() * 120;
      tone(f, 0, 0.08, { to: f * 1.9, gain: 0.07 });
    },
    // A short cheerful run for starting a level.
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.2, { type: 'triangle', gain: 0.16 }));
      tone(1568, 0.34, 0.25, { gain: 0.07 });
    },
    tap() {
      tone(720, 0, 0.06, { type: 'triangle', gain: 0.15 });
    },
    // A trace unzipping off the board: a run of tiny clicks, like zipper
    // teeth parting, speeding up and rising in pitch. Longer traces unzip
    // for longer.
    unzip(length) {
      const teeth = Math.max(7, Math.min(22, 5 + (length || 3) * 2));
      const span = 0.16 + teeth * 0.012;
      for (let k = 0; k < teeth; k++) {
        const p = k / teeth;
        const t = span * (1 - Math.pow(1 - p, 1.7)); // gaps shrink as it speeds up
        noise(t, 0.012, { freq: 1800 + p * 4200 + Math.random() * 400, q: 6, gain: 0.32 });
      }
      noise(0, span + 0.06, { type: 'highpass', freq: 2500, to: 6000, q: 0.7, gain: 0.03 });
    },
    // A short circuit: a crackle of sparks over a low electric buzz.
    short() {
      for (let k = 0; k < 6; k++) noise(k * 0.03 + Math.random() * 0.02, 0.025, { freq: 2500 + Math.random() * 3000, q: 2, gain: 0.3 });
      tone(85, 0, 0.22, { type: 'sawtooth', gain: 0.07, to: 70 });
      tone(170, 0, 0.18, { type: 'square', gain: 0.03, to: 130 });
    },
    // A trace reaching the core: a soft charge-up, pitched higher as the
    // board empties.
    absorb(progress) {
      const p = Math.max(0, Math.min(1, progress || 0));
      const base = 220 * Math.pow(2, p * 1.5);
      tone(base, 0, 0.22, { type: 'sine', to: base * 2, gain: 0.16 });
      tone(base * 2, 0.04, 0.16, { type: 'triangle', to: base * 3, gain: 0.05 });
      noise(0, 0.12, { freq: 900, to: 4000, q: 1.5, gain: 0.05 });
    },
    // The core filling up on the last trace.
    overload() {
      tone(110, 0, 0.7, { type: 'sawtooth', to: 880, gain: 0.08 });
      noise(0.05, 0.6, { freq: 600, to: 7000, q: 1, gain: 0.08 });
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, { type: 'triangle', gain: 0.2 }));
      [1568, 2093].forEach((f, i) => tone(f, 0.6 + i * 0.09, 0.4, { gain: 0.08 }));
    },
    hint() {
      tone(988, 0, 0.12, { gain: 0.15 });
      tone(1319, 0.1, 0.2, { gain: 0.15 });
    },
    whoosh() {
      tone(300, 0, 0.25, { to: 900, gain: 0.08, type: 'triangle' });
    },
  };

  window.UnfoldSound = Sound;
})();
