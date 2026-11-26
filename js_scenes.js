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


  /* ---------- 조립식 배경: 벽 색 + 소품 모듈 ---------- */
  const line = (x1, y1, x2, y2, c, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;
  const K = {
    windows: (n, y, sky, frame, w = 80, h = 120) => many(n, i => { const x = (W - n * (w + 24) + 24) / 2 + i * (w + 24); return rect(x, y, w, h, sky, `stroke="${frame}" stroke-width="7" rx="6"`) + line(x + w / 2, y, x + w / 2, y + h, frame, 4) + line(x, y + h / 2, x + w, y + h / 2, frame, 4); }),
    sky: (n, y, h, c, cls) => many(n, i => circle(20 + rnd(i + y) * 360, y + rnd(i * 3 + 1) * h, .8 + rnd(i) * 1.8, c, `class="${cls || (i % 4 ? '' : 'blink')}" style="animation-delay:-${rnd(i) * 4}s"`)),
    board: (x, y, w, h, bg, ink) => rect(x, y, w, h, bg, 'stroke="#6b4a2a" stroke-width="8"') + many(7, i => path(`M${x + 14 + rnd(i) * (w - 90)} ${y + 18 + i * (h - 30) / 7}q${15 + rnd(i + 2) * 30} -9 ${40 + rnd(i + 4) * 40} 2`, 'none', `stroke="${ink}" stroke-width="2"`)),
    desks: (y, c) => many(3, i => rect(24 + i * 128, y, 96, 14, c) + rect(34 + i * 128, y + 14, 8, 52, '#222') + rect(102 + i * 128, y + 14, 8, 52, '#222')),
    racks: (x, y, w, rows, colors) => rect(x, y, w, rows * 52, '#1b140f') + many(rows, r => many(Math.floor(w / 22), c => rect(x + 5 + c * 22, y + r * 52 + 12 + rnd(r * 11 + c) * 10, 13, 34 - rnd(r * 11 + c) * 10, colors[Math.floor(rnd(x + r * 7 + c) * colors.length)], 'rx="4"')) + rect(x, y + r * 52 + 46, w, 5, '#4a3320')),
    frames: (list, gold) => list.map(([x, y, w, h, c], i) => rect(x, y, w, h, c, `stroke="${gold}" stroke-width="8"`) + circle(x + w * .35, y + h * .4, Math.min(w, h) * .18, '#ffffff33') + path(`M${x} ${y + h}l${w * .4}-${h * .4} ${w * .25} ${h * .2} ${w * .35}-${h * .3}v${h * .5}z`, ['#2f5d50', '#5b3a5e', '#3c4f76'][i % 3])).join(''),
    pillars: (xs, c) => xs.map(x => rect(x - 17, 40, 34, FLOOR - 40, c) + rect(x - 25, 30, 50, 16, c) + rect(x - 25, FLOOR - 18, 50, 18, c) + line(x - 5, 52, x - 5, FLOOR - 22, '#0005', 3) + line(x + 7, 52, x + 7, FLOOR - 22, '#fff2', 3)).join(''),
    curtains: (c, c2) => many(8, i => path(`M${i * 52 - 10} 0h52q-14 40 0 80h-52q14-40 0-80z`, i % 2 ? c : c2)) + path(`M0 70q55 180-5 370H0zM400 70q-55 180 5 370h-5z`, c),
    stripes: (c1, c2) => many(10, i => path(`M200 0L${i * 80 - 180} ${FLOOR}h40z`, i % 2 ? c1 : c2)),
    bunting: y => path(`M0 ${y}q200 60 400 0`, 'none', 'stroke="#ddd" stroke-width="2"') + many(13, i => { const x = 12 + i * 31, yy = y + Math.sin((i + .4) / 13 * Math.PI) * 29; return path(`M${x} ${yy}h20l-10 24z`, ['#e0415a', '#f0c94c', '#3fa7d6', '#7ac96f'][i % 4]); }),
    ring: (x, y, r, c) => circle(x, y, r, 'none', `stroke="${c}" stroke-width="12"`) + circle(x, y, r * .62, 'none', 'stroke="#eee" stroke-width="12"') + circle(x, y, r * .25, c),
    mirrors: (y, glass) => many(3, i => path(`M${22 + i * 132} ${y + 230}V${y + 45}q46-75 92 0v185z`, glass, 'stroke="#b58a4a" stroke-width="7"') + line(40 + i * 132, y + 60, 74 + i * 132, y + 20, '#ffffff55', 5)),
    consoles: (y, accent) => path(`M20 ${y}h360l18 80H2z`, '#1d2430') + many(12, i => rect(36 + i * 28, y + 12, 20, 12, i % 3 ? accent : '#ffb347', `class="blink" style="animation-delay:-${rnd(i) * 3}s"`)) + many(3, i => rect(48 + i * 112, y + 34, 80, 36, '#07140f', `stroke="${accent}"`)),
    dome: c => path('M0 200Q200-110 400 200', 'none', `stroke="${c}" stroke-width="9"`) + many(7, i => line(200, 24, i * 66 + 2, 230, c, 3)),
    plants: y => many(5, i => { const x = 42 + i * 79; return path(`M${x - 22} ${y}h44l-7 32h-30z`, '#8a5a38') + many(5, k => `<ellipse cx="${x + (rnd(i * 5 + k) - .5) * 40}" cy="${y - 14 - rnd(k + i) * 40}" rx="8" ry="19" fill="${k % 2 ? '#4f9d57' : '#6fbf62'}" transform="rotate(${(rnd(k * 7 + i) - .5) * 90} ${x} ${y})"/>`); }),
    door: (x, y, r, c) => circle(x, y, r, '#1c2630', `stroke="${c}" stroke-width="13"`) + circle(x, y, r * .6, '#0e151c', `stroke="${c}" stroke-width="6"`) + many(6, i => line(x, y, x + Math.cos(i * 1.047) * r * .6, y + Math.sin(i * 1.047) * r * .6, c, 6)) + circle(x, y, r * .15, '#ddd'),
    gears: list => list.map(([x, y, r, c]) => `<g class="spin" style="transform-origin:${x}px ${y}px">${many(10, i => rect(x - 5, y - r - 9, 10, 14, c, `transform="rotate(${i * 36} ${x} ${y})"`))}${circle(x, y, r, c)}${circle(x, y, r * .35, '#111')}</g>`).join(''),
    boiler: () => rect(70, 150, 260, 240, '#33231c', 'rx="80" stroke="#8a5a3a" stroke-width="8"') + circle(200, 300, 52, '#1a0d08', 'stroke="#555" stroke-width="8"') + path('M200 264q40 36 0 68q-40-32 0-68z', '#ff8a2a', 'class="flame"') + many(3, i => circle(135 + i * 65, 205, 22, '#ddd7c8', 'stroke="#8a6a3a" stroke-width="4"') + line(135 + i * 65, 205, 148 + i * 65, 192, '#a22', 3)),
    crates: list => list.map(([x, y, s]) => rect(x, y, s, s, '#6a4a2a', 'stroke="#2c1d0e" stroke-width="4"') + line(x, y, x + s, y + s, '#2c1d0e', 4) + line(x + s, y, x, y + s, '#2c1d0e', 4)).join(''),
    herbs: () => line(0, 60, 400, 52, '#5a3c22', 8) + many(9, i => { const x = 24 + i * 44; return `<g class="sway" style="transform-origin:${x}px 56px;animation-delay:-${i}s">${line(x, 56, x, 90, '#8a7a4a')}${path(`M${x} 86q-18 24 0 54q18-30 0-54z`, i % 2 ? '#6b7f3a' : '#8a6a46')}</g>`; }),
    flasks: y => rect(20, y, 360, 14, '#4a2a14') + many(5, i => { const x = 58 + i * 71, c = ['#e0533d', '#4aa3e0', '#7ad06a', '#e0c13d', '#b06ae0'][i]; return path(`M${x - 8} ${y - 70}h16v28l22 42h-60l22-42z`, '#ffffff22', 'stroke="#cfe" stroke-width="2"') + path(`M${x - 19} ${y - 18}h38l11 18h-60z`, c) + circle(x, y - 30, 4, c, `class="bubble" style="animation-delay:-${i}s"`); }),
    stars: () => circle(200, 190, 130, '#0b1030', 'stroke="#b59a4a" stroke-width="8"') + many(34, i => circle(200 + Math.cos(i * 2.4) * rnd(i) * 118, 190 + Math.sin(i * 2.4) * rnd(i) * 118, 1.5 + rnd(i + 7) * 2, '#fff6c8', `class="${i % 5 ? '' : 'blink'}"`)) + path('M120 150L170 110 215 170 280 140 250 250', 'none', 'stroke="#fff6c855" stroke-width="2"'),
  };
  const lamp = (x, y, c, id = 'warm') => line(x, 0, x, y - 12, '#000', 3) + path(`M${x - 28} ${y}q28-40 56 0z`, '#333') + circle(x, y + 3, 8, c) + glow(x, y + 14, 150, id);

  const BUILT = {
    school: [['#2f4438', '#16221c', '#5a4126', '#23170a', '#0006'], () => K.board(70, 70, 260, 150, '#1f4a36', '#e8f0e8') + K.windows(2, 250, '#0b1526', '#5a5a4a', 70, 90) + K.desks(390, '#8a6236') + lamp(200, 40, '#fff4c0')],
    school2: [['#26343a', '#10181c', '#2a2f33', '#0b0d0f', '#ffffff18'], () => K.racks(14, 110, 120, 4, ['#7ab8a0', '#d0b36a', '#9a8ac0']) + K.racks(266, 110, 120, 4, ['#7ab8a0', '#d0b36a', '#9a8ac0']) + K.board(150, 90, 100, 80, '#d8d2bc', '#445') + K.flasks(390) + glow(200, 150, 130, 'cool')],
    school3: [['#3a2630', '#190f15', '#3b2414', '#120a05', '#0006'], () => K.curtains('#5b1f2c', '#6e2836') + K.frames([[96, 150, 56, 68, '#7a6a55'], [172, 138, 56, 68, '#6a5a60'], [248, 150, 56, 68, '#5a6a55']], '#a8843a') + path('M90 430V320q110-30 190 20l30 40v50z', '#0c0c0c') + rect(98, 372, 190, 16, '#eee') + many(18, i => rect(103 + i * 10, 372, 4, 10, '#111')) + glow(200, 80, 170, 'warm')],
    school4: [['#3d2c1f', '#1b120b', '#4a1c1c', '#180808', '#d9a35b33'], () => K.curtains('#3a2038', '#45263f') + K.racks(12, 200, 108, 4, ['#6e2b23', '#2d4a3e', '#2c3a5c']) + K.frames([[150, 100, 100, 74, '#33485a']], '#c39a45') + rect(130, 340, 150, 90, '#4a2a14', 'stroke="#220f05" stroke-width="5"') + K.door(340, 340, 40, '#777') + lamp(200, 36, '#ffe0a0')],
    train: [['#4a2430', '#231017', '#3a1a1a', '#100606', '#e8b6c822'], () => K.windows(3, 80, '#10233f', '#b58a4a') + K.sky(40, 86, 110, '#ffffffbb') + K.desks(380, '#e8e0d4') + candle(70, 352) + candle(198, 352) + candle(326, 352)],
    train2: [['#352a40', '#171020', '#2c1c28', '#0c060a', '#b58a4a33'], () => K.windows(1, 90, '#0d1c36', '#b58a4a', 150, 140) + K.sky(28, 96, 128, '#ffffffbb') + rect(14, 90, 70, 340, '#4a2e20', 'stroke="#b58a4a" stroke-width="3"') + rect(316, 90, 70, 340, '#4a2e20', 'stroke="#b58a4a" stroke-width="3"') + rect(110, 330, 190, 60, '#6a2838', 'rx="12"') + rect(110, 316, 54, 30, '#ddd', 'rx="10"') + lamp(200, 36, '#ffd9a0')],
    train3: [['#2b2622', '#121010', '#2a1f16', '#0a0704', '#ffffff14'], () => many(9, i => line(i * 50, 0, i * 50, FLOOR, '#0007', 4)) + K.crates([[14, 330, 100], [40, 232, 90], [286, 320, 110], [310, 216, 96], [152, 356, 74], [160, 282, 70]]) + glow(200, 90, 120, 'cool')],
    train4: [['#33211a', '#150c08', '#1e1612', '#070403', '#ff8a2a22'], () => K.boiler() + K.gears([[48, 140, 28, '#6a6a6a'], [352, 130, 36, '#7a5a3a'], [344, 200, 20, '#6a6a6a']]) + glow(200, 300, 200, 'red', 'pulse-light')],
    mars: [['#4a2418', '#1e0e0a', '#2f2a2c', '#0b090a', '#ff9a6233'], () => K.dome('#8a6a62') + K.windows(3, 130, '#b0502a', '#8a8f98', 92, 80) + K.consoles(300, '#ff9a62') + glow(200, 40, 150, 'red', 'pulse-light')],
    mars2: [['#1f3a2c', '#0c1a13', '#26302a', '#080c0a', '#7ad06a33'], () => K.dome('#6a8a7a') + K.sky(24, 30, 90, '#ffd0b0') + K.plants(260) + K.plants(390) + lamp(110, 70, '#f6b0ff', 'cool') + lamp(290, 70, '#f6b0ff', 'cool')],
    mars3: [['#2c3038', '#12141a', '#24262c', '#07080a', '#ffffff22'], () => K.door(200, 230, 130, '#8a94a4') + many(10, i => path(`M${i * 44 - 10} 30h22l-18 28h-22z`, '#e0b320')) + glow(50, 90, 100, 'red', 'pulse-light') + glow(350, 90, 100, 'red', 'pulse-light')],
    mars4: [['#101a30', '#05080f', '#1a2030', '#05060a', '#8fb8ff33'], () => K.windows(1, 60, '#02040c', '#7a8498', 300, 180) + K.sky(60, 68, 160, '#ffffffcc') + circle(280, 190, 40, '#c4623a') + circle(268, 180, 8, '#9a4528') + K.consoles(310, '#4fd1e0') + glow(200, 260, 140, 'cool')],
    circus: [['#4a1030', '#1c0612', '#4a2c18', '#150b05', '#0006'], () => K.stripes('#8a1f3f', '#e8d9b8') + K.bunting(60) + rect(130, 270, 140, 160, '#6a2a1a', 'stroke="#e8c164" stroke-width="5"') + rect(150, 296, 100, 66, '#1a0a08') + K.sky(22, 244, 22, '#ffe28a') + lamp(200, 50, '#ffd0e8')],
    circus2: [['#2a1230', '#100716', '#22141c', '#070307', '#ff7ac822'], () => K.curtains('#52164a', '#40103a') + rect(110, 130, 180, 190, '#9fb4c8', 'stroke="#c39a45" stroke-width="10"') + many(8, i => circle(110 + i * 25.7, 120, 8, '#fff3c0', 'class="blink"')) + rect(80, 340, 240, 20, '#5a3420') + K.flasks(340) + glow(200, 220, 150, 'warm')],
    circus3: [['#380c20', '#14040c', '#7a5a30', '#2a1a0a', '#00000044'], () => K.curtains('#8a1030', '#a01c3c') + K.ring(200, 230, 92, '#d4313f') + path('M60 0l80 430H0V0zM340 0l-80 430h140V0z', '#fff1') + K.bunting(40) + glow(200, 230, 180, 'warm')],
    circus4: [['#14142e', '#06060f', '#1c1830', '#05040a', '#b59aff33'], () => K.mirrors(130, '#3a4a6a') + K.sky(40, 20, 100, '#d8c8ff') + glow(200, 220, 170, 'cool') + candle(24, 390) + candle(376, 390)],
    museum: [['#26395c', '#101a2e', '#5a5f6a', '#1c1f26', '#ffffff22'], () => K.frames([[24, 96, 92, 120, '#6a5040'], [148, 70, 106, 150, '#41566a'], [286, 96, 92, 120, '#55485e']], '#c9a449') + line(20, 340, 380, 340, '#a2303c', 5) + many(4, i => rect(26 + i * 112, 332, 8, 98, '#c9a449')) + lamp(70, 40, '#fff', 'cool') + lamp(200, 30, '#fff') + lamp(330, 40, '#fff', 'cool')],
    museum2: [['#2c2a38', '#121119', '#3a3640', '#0e0d11', '#ffffff18'], () => K.pillars([34, 366], '#8d877c') + many(3, i => rect(80 + i * 88, 330, 64, 100, '#4a4650') + rect(80 + i * 88, 244, 64, 86, '#9fd8ff22', 'stroke="#cfe8ff" stroke-width="2"')) + path('M112 322q-16-24-4-40l-6-18h20l-6 18q12 16-4 40z', '#c9a449') + circle(200, 292, 22, '#c87a4a') + path('M288 258l22 40-22 24-22-24z', '#4fa3ff', 'class="blink"') + glow(288, 290, 80, 'cool')],
    museum3: [['#14202c', '#060b10', '#1c242c', '#050709', '#4fd1e022'], () => many(3, r => many(4, c => rect(20 + c * 92, 60 + r * 68, 82, 58, '#0a2018', 'stroke="#4a5a66" stroke-width="4"') + line(28 + c * 92, 90 + r * 68 + rnd(r * 4 + c) * 14, 94 + c * 92, 80 + r * 68 + rnd(c * 3 + r) * 22, '#5dffb0', 1.5))) + K.consoles(320, '#8fb8ff')],
    museum4: [['#2a2c30', '#101113', '#26262a', '#08080a', '#ffffff14'], () => K.door(200, 220, 120, '#9aa0a8') + K.crates([[8, 340, 90], [300, 330, 96], [320, 236, 72]]) + line(0, 120, 400, 330, '#ff3b4799', 2) + line(0, 340, 400, 150, '#ff3b4799', 2) + glow(200, 60, 110, 'warm')],
    alchemy: [['#37401c', '#161a0a', '#4a3218', '#150d05', '#cfe35a22'], () => K.herbs() + K.racks(14, 180, 110, 4, ['#8a6a46', '#6b7f3a', '#a85a3a']) + K.racks(276, 180, 110, 4, ['#8a6a46', '#6b7f3a', '#a85a3a']) + K.crates([[160, 362, 76]]) + candle(200, 326)],
    alchemy2: [['#30242c', '#140e12', '#33241a', '#0c0804', '#0006'], () => K.racks(12, 70, 376, 3, ['#6e2b23', '#2d4a3e', '#2c3a5c', '#7a5a24']) + rect(100, 336, 200, 16, '#4a2a14') + path('M140 336q30-26 60 0q30-26 60 0z', '#e8dfc4') + candle(122, 308) + candle(280, 308)],
    alchemy3: [['#1c3030', '#0a1414', '#2a2a26', '#090907', '#7ad06a22'], () => path('M40 150h90v60h80v-90h100v140h50', 'none', 'stroke="#cfe8e855" stroke-width="9"') + K.flasks(240) + K.flasks(390) + glow(200, 300, 160, 'cool') + glow(80, 100, 90, 'warm')],
    alchemy4: [['#161a3c', '#070818', '#2a2030', '#0a0710', '#b59a4a33'], () => K.stars() + K.sky(30, 10, 380, '#fff') + path('M120 400l150-90 20 26-150 90z', '#b58a4a') + line(190, 380, 150, 440, '#6a4a2a', 9) + line(190, 380, 240, 440, '#6a4a2a', 9) + candle(40, 390) + candle(360, 390)],
  };
  Object.keys(BUILT).forEach(key => {
    const id = key.replace(/\d$/, ''), [colors, props] = BUILT[key];
    (SCENES[id] = SCENES[id] || []).push(() => room(...colors) + props());
  });

  /* 기존 3테마의 네 번째 방 */
  SCENES.manor.push(() => room('#3a2c20', '#18100b', '#3a2614', '#120a04', '#0006') + path('M0 0h400v40L200 150 0 40z', '#1c120a') + line(0, 190, 200, 70, '#5a3c22', 10) + line(400, 190, 200, 70, '#5a3c22', 10) + circle(200, 200, 44, '#12213c', 'stroke="#5a3c22" stroke-width="8"') + line(200, 156, 200, 244, '#5a3c22', 4) + line(156, 200, 244, 200, '#5a3c22', 4) + K.crates([[14, 336, 94], [50, 258, 78], [296, 346, 88]]) + candle(200, 380) + glow(200, 200, 120, 'cool'));
  SCENES.abyss.push(() => room('#123048', '#06121e', '#1a2830', '#05090c', '#4fd1e033') + K.windows(2, 70, '#021420', '#6c8894', 100, 90) + K.sky(26, 76, 78, '#bff4ff88', 'bubble') + path('M90 330q110-130 220 0q-10 70-110 74q-100-4-110-74z', '#d8a23a', 'stroke="#6a4a14" stroke-width="6"') + circle(200, 316, 30, '#0d2a3a', 'stroke="#6c8894" stroke-width="8"') + many(10, i => path(`M${i * 44 - 10} 420h22l-16 18h-22z`, '#e0b320')) + glow(50, 60, 100, 'red', 'pulse-light'));
  SCENES.tomb.push(() => tombWall() + K.pillars([36, 364], '#8a6a2c') + torch(110, 150) + torch(290, 150) + hieroglyphs(140, 60, 5, 3, '#e0b75a66') + path('M80 430l30-50h180l30 50zM120 380l20-40h120l20 40z', '#7c5c25', 'stroke="#e8c164" stroke-width="2"') + circle(200, 300, 30, '#c9992f') + circle(200, 300, 12, '#3a2a6a', 'class="blink"') + glow(200, 300, 130, 'warm'));

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
