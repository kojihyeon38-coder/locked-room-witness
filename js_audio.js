/* 효과음과 배경음은 파일 없이 WebAudio로 합성 */
(function () {
  'use strict';
  let ctx = null, drone = null, muted = false;
  try { muted = localStorage.getItem('esc-muted') === '1'; } catch (e) {}

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    click: () => tone(520, 0.06, 'triangle', 0.08),
    ok: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.09)),
    bad: () => { tone(150, 0.3, 'sawtooth', 0.14); tone(110, 0.35, 'sawtooth', 0.12, 0.12); },
    find: () => [880, 1320, 1760].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, i * 0.07)),
    msg: () => tone(900, 0.08, 'sine', 0.07),
    scare: () => { tone(60, 1.2, 'sawtooth', 0.25); tone(63, 1.2, 'square', 0.12); tone(1900, 0.18, 'sawtooth', 0.06, 0.1); },
    heart: () => { tone(55, 0.14, 'sine', 0.4); tone(50, 0.14, 'sine', 0.3, 0.2); },
    door: () => [90, 80, 70, 55].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.13, i * 0.18)),
  };
  const PADS = [329.6, 392, 493.9, 587.3];

  window.Sound = {
    play: name => SFX[name] && SFX[name](),
    pad: i => tone(PADS[i], 0.38, 'triangle', 0.2),
    unlock: () => { if (!muted) ac(); },
    ambient(on) {
      if (drone) { try { drone.forEach(o => o.stop()); } catch (e) {} drone = null; }
      if (!on || muted) return;
      const c = ac(); if (!c) return;
      drone = [48, 48.7].map(f => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = f; g.gain.value = 0.05;
        o.connect(g); g.connect(c.destination); o.start();
        return o;
      });
    },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('esc-muted', muted ? '1' : '0'); } catch (e) {}
      if (muted) this.ambient(false);
      return muted;
    },
    get muted() { return muted; },
  };
})();
