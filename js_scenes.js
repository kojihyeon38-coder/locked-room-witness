/* 방 배경 일러스트(SVG)를 테마·단계별로 그린다. 외부 이미지 없이 동작. */
(function () {
  'use strict';

  const W = 400, H = 600, FLOOR = 430;
  const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const circle = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function room(wallTop, wallBottom, floorTop, floorBottom, line) {
    return `<defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wallTop}"/><stop offset="1" stop-color="${wallBottom}"/></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floorTop}"/><stop offset="1" stop-color="${floorBottom}"/></linearGradient>
      <radialGradient id="warm"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
      <radialGradient id="red"><stop offset="0" stop-color="#ff4136" stop-opacity=".5"/><stop offset="1" stop-color="#ff4136" stop-opacity="0"/></radialGradient>
      <radialGradient id="cool"><stop offset="0" stop-color="#7be8ff" stop-opacity=".45"/><stop offset="1" stop-color="#7be8ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
    </defs>${rect(0, 0, W, FLOOR, 'url(#wall)')}${rect(0, FLOOR, W, H - FLOOR, 'url(#floor)')}
    <g stroke="${line}" stroke-width="1.5" fill="none">${many(9, i => `<line x1="${(i - 4) * 40 + 200}" y1="${FLOOR}" x2="${(i - 4) * 130 + 200}" y2="${H}"/>`)}
    <line x1="0" y1="${FLOOR + 30}" x2="${W}" y2="${FLOOR + 30}"/><line x1="0" y1="${FLOOR + 90}" x2="${W}" y2="${FLOOR + 90}"/></g>
    ${rect(0, FLOOR - 6, W, 8, '#0007')}`;
  }
  const glow = (x, y, r, id, cls = 'flick') => circle(x, y, r, `url(#${id})`, `class="${cls}"`);
  const candle = (x, y) => `${rect(x - 4, y, 8, 26, '#d8cba8')}${path(`M${x} ${y - 20}q9 11 0 19q-9-8 0-19z`, '#ffb347', 'class="flame"')}${glow(x, y - 8, 70, 'warm')}`;
  const shelf = (x, y, w, rows, seed) => rect(x, y, w, rows * 46 + 6, '#241209') + many(rows, r => {
    let out = '', cx = x + 5;
    for (let i = 0; cx < x + w - 14; i++) {
      const bw = 7 + rnd(seed + r * 31 + i) * 8, bh = 28 + rnd(seed + r * 17 + i * 3) * 12;
      out += rect(cx, y + r * 46 + 44 - bh, bw, bh, ['#6e2b23', '#2d4a3e', '#2c3a5c', '#7a5a24', '#4a2e4f'][Math.floor(rnd(seed + i + r * 7) * 5)]);
      cx += bw + 1.5;
    }
    return out + rect(x, y + r * 46 + 44, w, 5, '#4a2a14');
  });

  const SCENES = {
    manor: [
      () => room('#3b1f1a', '#25130f', '#2b1a10', '#0f0805', '#00000055')
        + many(13, i => rect(i * 32, 0, 3, FLOOR, '#ffffff08'))
        + rect(142, 46, 116, 160, '#0e1830', 'stroke="#5a3a1c" stroke-width="9"') + circle(226, 82, 17, '#e8e4cf') + circle(219, 77, 15, '#0e1830')
        + many(22, i => `<line class="rain" style="animation-delay:-${rnd(i) * 2}s" x1="${150 + rnd(i + 3) * 100}" y1="${52 + rnd(i + 9) * 120}" x2="${146 + rnd(i + 3) * 100}" y2="${68 + rnd(i + 9) * 120}" stroke="#9fc0ff66" stroke-width="1.2"/>`)
        + `<line x1="200" y1="46" x2="200" y2="206" stroke="#5a3a1c" stroke-width="5"/>`
        + path('M128 36q30 90 4 184h-26V36zM272 36q-30 90-4 184h26V36z', '#5b1620')
        + shelf(8, 190, 90, 5, 1) + shelf(302, 190, 90, 5, 9)
        + rect(120, 350, 160, 14, '#4a2a14') + rect(132, 364, 12, 74, '#351d0e') + rect(256, 364, 12, 74, '#351d0e')
        + candle(150, 322) + path('M60 560q140-80 280 0z', '#5b162066'),
      () => room('#2a0b0d', '#120405', '#17080a', '#050102', '#ff000018')
        + `<path d="M0 96Q200 130 400 92" stroke="#222" stroke-width="3" fill="none"/>`
        + many(6, i => { const x = 28 + i * 66, y = 108 + Math.sin(i / 5 * Math.PI) * 16; return `<g class="sway" style="transform-origin:${x}px ${y}px;animation-delay:-${i}s">${rect(x - 18, y, 36, 46, '#d9d2c3')}${rect(x - 14, y + 4, 28, 32, ['#3a2a2a', '#241f2e', '#2f2a22'][i % 3])}${rect(x - 3, y - 6, 6, 10, '#8a6a3a')}</g>`; })
        + rect(30, 370, 340, 16, '#2a1a1a') + many(3, i => rect(52 + i * 110, 344, 86, 26, '#111', 'stroke="#6a3a3a" stroke-width="2"'))
        + glow(200, 40, 200, 'red', 'pulse-light') + circle(200, 34, 13, '#ff5548'),
      () => room('#241a16', '#141010', '#1c1714', '#080606', '#ffffff14')
        + many(11, r => many(7, c => rect(c * 66 - (r % 2) * 33, r * 40, 63, 37, rnd(r * 9 + c) > .5 ? '#ffffff08' : '#00000030')))
        + many(3, i => rect(18 + i * 130, 190, 100, 230, '#2c2f31', 'stroke="#000" stroke-width="3"') + many(4, k => rect(26 + i * 130, 200 + k * 54, 84, 46, '#3a3f42') + rect(56 + i * 130, 218 + k * 54, 24, 6, '#aaa')))
        + `<line x1="200" y1="0" x2="200" y2="76" stroke="#000" stroke-width="3"/><g class="sway" style="transform-origin:200px 0">${path('M170 100q30-48 60 0z', '#3d3d3d')}${circle(200, 103, 9, '#ffe9a8')}</g>` + glow(200, 120, 190, 'warm'),
    ],
    abyss: [
      () => room('#0b3149', '#061a29', '#0a2230', '#02090e', '#4fd1e033')
        + many(3, i => { const x = 70 + i * 130; return circle(x, 118, 52, '#02131f', 'stroke="#7b929e" stroke-width="10"') + many(5, k => circle(x - 25 + rnd(i * 7 + k) * 50, 150, 1.5 + rnd(k) * 3, '#bff4ff88', `class="bubble" style="animation-delay:-${rnd(i + k * 3) * 5}s"`)) + many(8, k => circle(x + Math.cos(k * .785) * 52, 118 + Math.sin(k * .785) * 52, 3, '#cfe0e8')); })
        + path('M30 300h340l22 90H8z', '#12384c') + many(12, i => rect(36 + i * 28, 314, 20, 12, i % 3 ? '#4fd1e0' : '#ffb347', `class="blink" style="animation-delay:-${rnd(i) * 3}s"`))
        + many(3, i => rect(48 + i * 112, 338, 80, 40, '#021a14', 'stroke="#2c7a66"') + `<polyline points="${many(9, k => `${52 + i * 112 + k * 9},${358 + (rnd(i * 13 + k) - .5) * 28} `)}" fill="none" stroke="#5dffb0" stroke-width="1.5"/>`)
        + glow(200, 20, 180, 'red', 'pulse-light'),
      () => room('#102a30', '#071316', '#0c1c20', '#020708', '#4fd1e022')
        + many(5, i => rect(0, 40 + i * 68, W, 15, i % 2 ? '#3b4c52' : '#5a3f2a') + many(6, k => rect(20 + k * 72 + (i % 2) * 30, 36 + i * 68, 10, 23, '#8b9ba1')))
        + many(2, i => circle(92 + i * 216, 372, 54, '#1c3036', 'stroke="#6f858c" stroke-width="6"') + `<g class="spin" style="transform-origin:${92 + i * 216}px 372px">${many(4, k => `<ellipse cx="${92 + i * 216}" cy="346" rx="10" ry="25" fill="#3f5a62" transform="rotate(${k * 90} ${92 + i * 216} 372)"/>`)}</g>` + circle(92 + i * 216, 372, 9, '#9fb4bb'))
        + glow(200, 220, 130, 'cool'),
      () => room('#0a2436', '#04111c', '#06202c', '#010a10', '#4fd1e033')
        + circle(200, 180, 112, '#17303c', 'stroke="#6c8894" stroke-width="14"') + circle(200, 180, 70, '#0d1f29', 'stroke="#4c6772" stroke-width="6"')
        + many(6, i => `<line x1="200" y1="180" x2="${200 + Math.cos(i * 1.047) * 70}" y2="${180 + Math.sin(i * 1.047) * 70}" stroke="#8aa6b1" stroke-width="7"/>`) + circle(200, 180, 17, '#c3d6dd')
        + `<path class="wave" d="M-80 470q40-18 80 0t80 0t80 0t80 0t80 0t80 0t80 0V600H-80z" fill="#1f9bc455"/>`
        + glow(60, 60, 100, 'red', 'pulse-light') + glow(340, 60, 100, 'red', 'pulse-light'),
    ],
    tomb: [
      () => tombWall() + many(2, i => torch(54 + i * 292, 190))
        + path('M140 430V150q60-60 120 0v280z', '#120b03', 'stroke="#8a6a2c" stroke-width="8"') + hieroglyphs(148, 180, 4, 5, '#c79a3d66')
        + path('M0 600q90-90 200-40t200-20v60z', '#a97f3a55'),
      () => tombWall() + torch(200, 110) + hieroglyphs(20, 40, 3, 6, '#e0b75a55') + hieroglyphs(300, 40, 3, 6, '#e0b75a55')
        + many(3, i => path(`M${10 + i * 140} 440l55-78 55 78z`, '#b88d2c') + many(24, k => circle(25 + i * 140 + rnd(i * 50 + k) * 80, 400 + rnd(k * 3 + i) * 38, 5, k % 7 ? '#f2cc55' : '#d4553f', `class="${k % 9 ? '' : 'blink'}"`))),
      () => tombWall() + many(2, i => torch(48 + i * 304, 150)) + hieroglyphs(96, 40, 8, 3, '#e0b75a66')
        + path('M200 130l48 44-12 74h-72l-12-74z', '#c9992f') + circle(182, 184, 6, '#1b1206') + circle(218, 184, 6, '#1b1206') + many(4, i => rect(170, 214 + i * 8, 60, 4, '#2a4a8a'))
        + path('M70 430l18-96h224l18 96z', '#7c5c25', 'stroke="#e8c164" stroke-width="3"') + rect(80, 318, 240, 18, '#9a742e') + hieroglyphs(108, 356, 7, 2, '#2a1c08'),
    ],
  };
  function tombWall() {
    return room('#5a4118', '#2c1f0a', '#4a3513', '#171004', '#f0c75e22')
      + many(11, r => many(6, c => rect(c * 80 - (r % 2) * 40 + 2, r * 40 + 2, 76, 36, rnd(r * 7 + c) > .5 ? '#ffe3a00d' : '#00000028')));
  }
  function torch(x, y) {
    return glow(x, y - 14, 120, 'warm') + path(`M${x - 6} ${y}h12l-4 56h-4z`, '#5a3716') + path(`M${x} ${y - 40}q22 26 0 42q-22-16 0-42z`, '#ff8a2a', 'class="flame"') + path(`M${x} ${y - 22}q10 13 0 22q-10-9 0-22z`, '#ffd75e', 'class="flame"');
  }
  function hieroglyphs(x, y, cols, rows, color) {
    const g = '𓂀𓆣𓃭𓅓𓆓𓇳𓊖𓋹𓏏𓈖';
    const list = Array.from(g);
    return `<g fill="${color}" font-size="19">${many(rows, r => many(cols, c => `<text x="${x + c * 26}" y="${y + r * 28}">${list[Math.floor(rnd(x + r * 11 + c) * list.length)]}</text>`))}</g>`;
  }

  window.Scenes = {
    draw(theme, stage) {
      const f = (SCENES[theme] || SCENES.manor)[stage] || SCENES.manor[0];
      const motes = many(16, i => circle(rnd(i + 40) * W, rnd(i + 80) * H, .8 + rnd(i) * 1.4, '#ffffff55', `class="mote" style="animation-delay:-${rnd(i + 5) * 9}s"`));
      const svg = `<svg class="backdrop" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${f()}${motes}${rect(0, 0, W, H, 'url(#vig)')}</svg>`;
      // 그라데이션 id가 다른 SVG와 겹치지 않게 방마다 접두어를 붙인다
      return svg.replace(/(id="|url\(#)(wall|floor|warm|red|cool|vig)/g, `$1${theme}${stage}-$2`);
    },
  };
})();
