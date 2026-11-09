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
    /*
     * A trace charging up as it runs to the core: a buzzing electric tone
     * that climbs in pitch and opens up in brightness, with a thin
     * high whine on top and sparks crackling more and more toward the end.
     * It lasts as long as the trip; later traces start higher.
     */
    charge(seconds, progress) {
      const ac = audio();
      if (!ac) return;
      const dur = Math.max(0.25, Math.min(2.5, seconds || 0.6));
      const p = Math.max(0, Math.min(1, progress || 0));
      const t0 = ac.currentTime;
      const t1 = t0 + dur;
      const low = 55 * Math.pow(2, p);
      const high = low * 9;
      // The body: a sawtooth and a square, a hair apart, through a sweeping
      // resonant filter.
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 8;
      filter.frequency.setValueAtTime(380, t0);
      filter.frequency.exponentialRampToValueAtTime(6500, t1);
      // Mains-style hum: the level wobbles fast, quicker as it charges.
      const hum = ac.createGain();
      hum.gain.value = 0.65;
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.setValueAtTime(40, t0);
      lfo.frequency.exponentialRampToValueAtTime(110, t1);
      depth.gain.value = 0.35;
      lfo.connect(depth);
      depth.connect(hum.gain);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(0.13, t0 + 0.04);
      env.gain.setValueAtTime(0.13, t1 - 0.06);
      env.gain.exponentialRampToValueAtTime(0.2, t1 - 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
      filter.connect(hum);
      hum.connect(env);
      env.connect(master);
      [['sawtooth', 1], ['square', 2.006]].forEach(([type, mult]) => {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(low * mult, t0);
        o.frequency.exponentialRampToValueAtTime(high * mult, t1);
        o.connect(filter);
        o.start(t0);
        o.stop(t1 + 0.08);
      });
      lfo.start(t0);
      lfo.stop(t1 + 0.08);
      // The whine of a charging capacitor.
      tone(700 * Math.pow(2, p * 0.5), 0, dur, { to: 3600 * Math.pow(2, p * 0.5), gain: 0.035 });
      // Sparks, sparse at first and thick at the end.
      const pops = Math.round(dur * 26);
      for (let k = 0; k < pops; k++) {
        const at = dur * Math.sqrt(Math.random());
        noise(at, 0.012 + Math.random() * 0.012, { freq: 2500 + Math.random() * 5000, q: 3, gain: 0.08 + 0.18 * (at / dur) });
      }
    },
    // A charge landing in the core: a heavy thump, a crack of static, and
    // a bright ping that rises as the core fills.
    zap(progress) {
      const p = Math.max(0, Math.min(1, progress || 0));
      tone(170, 0, 0.22, { to: 42, gain: 0.42 });
      tone(2600, 0, 0.11, { type: 'sawtooth', to: 260, gain: 0.06 });
      noise(0, 0.09, { freq: 5200, q: 0.8, gain: 0.3 });
      noise(0.02, 0.18, { type: 'highpass', freq: 3000, to: 9000, q: 0.5, gain: 0.05 });
      const ping = 880 * Math.pow(2, p);
      tone(ping, 0.03, 0.32, { type: 'triangle', to: ping * 1.06, gain: 0.07 });
    },
    // A short circuit: a crackle of sparks over a low electric buzz.
    short() {
      for (let k = 0; k < 6; k++) noise(k * 0.03 + Math.random() * 0.02, 0.025, { freq: 2500 + Math.random() * 3000, q: 2, gain: 0.3 });
      tone(85, 0, 0.22, { type: 'sawtooth', gain: 0.07, to: 70 });
      tone(170, 0, 0.18, { type: 'square', gain: 0.03, to: 130 });
    },
    // A cube face cleared: a bright power-up chord that rings out, with a
    // thump under it and a sweep of static over it. Each face sounds a
    // step higher than the last.
    faceClear(count) {
      const step = Math.pow(2, ((Math.max(1, count) - 1) * 2) / 12);
      const root = 392 * step;
      [1, 1.26, 1.5, 2].forEach((m, i) => {
        tone(root * m, i * 0.06, 0.6, { type: 'triangle', gain: 0.11 });
        tone(root * m * 1.004, i * 0.06, 0.6, { type: 'sine', gain: 0.05 });
      });
      tone(root * 4, 0.24, 0.5, { gain: 0.04, to: root * 4.2 });
      tone(140, 0, 0.25, { to: 50, gain: 0.35 });
      noise(0, 0.35, { freq: 1500, to: 9000, q: 0.8, gain: 0.06 });
    },
    /*
     * The cube's finale: a long rising charge that builds for `seconds`
     * (a buzzing swell opening up, a climbing whine, beeps that come
     * faster and higher, and thickening crackle), then a deep boom with a
     * crack of static and a shimmering chord that rings out.
     */
    finale(seconds) {
      const ac = audio();
      if (!ac) return;
      const T = Math.max(1, seconds || 2.3);
      const t0 = ac.currentTime;
      const t1 = t0 + T;
      // The swell.
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 7;
      filter.frequency.setValueAtTime(220, t0);
      filter.frequency.exponentialRampToValueAtTime(7500, t1);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(0.06, t0 + 0.3);
      env.gain.exponentialRampToValueAtTime(0.2, t1 - 0.05);
      env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
      const trem = ac.createGain();
      trem.gain.value = 0.7;
      const lfo = ac.createOscillator();
      const depth = ac.createGain();
      lfo.frequency.setValueAtTime(6, t0);
      lfo.frequency.exponentialRampToValueAtTime(48, t1);
      depth.gain.value = 0.3;
      lfo.connect(depth);
      depth.connect(trem.gain);
      filter.connect(trem);
      trem.connect(env);
      env.connect(master);
      [['sawtooth', 1], ['sawtooth', 1.007], ['square', 2.003]].forEach(([type, m]) => {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(45 * m, t0);
        o.frequency.exponentialRampToValueAtTime(720 * m, t1);
        o.connect(filter);
        o.start(t0);
        o.stop(t1 + 0.1);
      });
      lfo.start(t0);
      lfo.stop(t1 + 0.1);
      tone(500, 0, T, { to: 4200, gain: 0.04 });
      // Beeps, faster and higher as it charges.
      let at = 0.1;
      let gap = 0.32;
      let pitch = 660;
      while (at < T - 0.05) {
        tone(pitch, at, 0.06, { type: 'square', gain: 0.035 });
        at += gap;
        gap = Math.max(0.035, gap * 0.82);
        pitch *= 1.045;
      }
      // Crackle, thickening.
      const pops = Math.round(T * 30);
      for (let k = 0; k < pops; k++) {
        const when = T * Math.sqrt(Math.random());
        noise(when, 0.014, { freq: 2500 + Math.random() * 5000, q: 3, gain: 0.06 + 0.2 * (when / T) });
      }
      // The burst.
      tone(130, T, 1.4, { to: 28, gain: 0.6 });
      tone(65, T, 1.6, { to: 24, gain: 0.4 });
      noise(T, 0.9, { type: 'lowpass', freq: 3500, to: 150, q: 0.6, gain: 0.5 });
      noise(T, 0.25, { type: 'highpass', freq: 3000, q: 0.5, gain: 0.25 });
      [523, 659, 784, 988, 1319].forEach((f, i) => {
        tone(f, T + 0.08 + i * 0.05, 1.8, { type: 'triangle', gain: 0.07 });
        tone(f * 1.005, T + 0.08 + i * 0.05, 1.8, { gain: 0.04 });
      });
      tone(2093, T + 0.35, 1.6, { gain: 0.035, to: 2150 });
    },
    // Overclock, power running low: a short warning beep.
    lowPower() {
      tone(880, 0, 0.07, { type: 'square', gain: 0.05 });
      tone(660, 0.09, 0.07, { type: 'square', gain: 0.04 });
    },
    // The core running dry: everything winds down.
    powerDown() {
      tone(440, 0, 1.1, { type: 'sawtooth', to: 30, gain: 0.12 });
      tone(220, 0, 1.2, { type: 'square', to: 20, gain: 0.05 });
      noise(0, 0.9, { type: 'lowpass', freq: 4000, to: 120, q: 1, gain: 0.12 });
      tone(90, 0.02, 0.5, { to: 35, gain: 0.3 });
    },
    // The core filling up on the last trace: the landing, then a surge
    // that climbs and bursts.
    overload() {
      this.zap(1);
      tone(90, 0.05, 0.75, { type: 'sawtooth', to: 1400, gain: 0.07 });
      noise(0.05, 0.7, { freq: 500, to: 8000, q: 1.2, gain: 0.1 });
      tone(160, 0.78, 0.5, { to: 38, gain: 0.45 });
      noise(0.78, 0.4, { type: 'highpass', freq: 2000, to: 9000, q: 0.5, gain: 0.12 });
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

  window.CircuitJamSound = Sound;
})();
