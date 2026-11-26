/* 시드 기반 퍼즐 생성. 같은 테마 + 시드 + 난이도 = 같은 문제.
   모든 퍼즐은 문자열 answer 하나로 판정한다(두꺼비집만 공유 상태). */
(function () {
  'use strict';

  const DIFF = {
    easy:   { label: '쉬움',   minutes: 40, hints: 3, wrong: 15, mirror: false, symbols: 4, presses: 2, simon: 4, boxes: 3, steps: 2, items: 4, dirs: 4 },
    normal: { label: '보통',   minutes: 35, hints: 3, wrong: 30, mirror: false, symbols: 5, presses: 4, simon: 5, boxes: 4, steps: 3, items: 4, dirs: 5 },
    hard:   { label: '어려움', minutes: 30, hints: 3, wrong: 60, mirror: true,  symbols: 6, presses: 5, simon: 7, boxes: 5, steps: 4, items: 5, dirs: 6 },
  };
  const autoDiff = n => (n <= 1 ? 'easy' : n <= 3 ? 'normal' : 'hard');

  function rngFrom(seed) {
    let h = 2166136261;
    for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function tools(r) {
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const shuffle = arr => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    return { int, shuffle };
  }
  const permutations = a => a.length <= 1 ? [a] :
    a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));

  function flip(g, i) {
    const x = i % 3, y = Math.floor(i / 3);
    [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([a, b]) => {
      if (a >= 0 && a < 3 && b >= 0 && b < 3) g[b * 3 + a] ^= 1;
    });
  }

  const SYMBOLS = ['☽', '☀', '★', '♠', '♣', '♥', '♦', '⚓', '⚖', '☂', '♞', '✿'];
  const COLOR_HEX = ['#d0453a', '#3b7de0', '#34a862', '#e0b320'];
  const COLOR_NAME = ['빨강', '파랑', '초록', '노랑'];
  const FILLER = '가나다라마바사아자차카타파하구누두루무부수우주추';

  /* 각 생성기: (도구, 난이도, 테마 퍼즐 정의) → { kind, title, answer, pieces:{clueIndex:[문장]}, ... , hints:[..] } */
  const GEN = {
    color(t, d, def) {
      const nums = t.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
      const items = def.items.map((name, i) => ({ name, hex: COLOR_HEX[i], color: COLOR_NAME[i], num: nums[i] }));
      const order = t.shuffle([0, 1, 2, 3]);
      let code = order.map(i => items[i].num);
      if (d.mirror) code.reverse();
      const first = order.map((i, k) => `<span class="gem" style="background:${items[i].hex}"></span> ${k + 1}번째 색은 <b>${items[i].color}</b>`);
      if (d.mirror) first.push('구석의 낙서: “모든 것은 <b>거울</b>처럼 거꾸로”');
      return {
        input: 'digits', length: 4, answer: code.join(''),
        pieces: [first, t.shuffle(items).map(it => `<span class="gem" style="background:${it.hex}"></span> ${it.name}에 새겨진 숫자 <b>${it.num}</b>`)],
        hints: ['색의 순서와 각 색의 숫자를 짝지어 보세요.', `정답은 ${code.join('')}`],
      };
    },

    clock(t, d) {
      const sh = t.int(7, 10), sm = t.int(0, 11) * 5;
      let total = sh * 60 + sm;
      const pool = t.shuffle([
        () => { const m = t.int(3, 9) * 5; total += m; return `그로부터 <b>${m}분 뒤</b>, 현관에서 발소리가 들렸다.`; },
        () => { const m = t.int(4, 11) * 5; total += m; return `<b>${m}분이 더</b> 지나자 전화벨이 울렸다.`; },
        () => { const m = t.int(1, 4) * 5; total -= m; return `아차, 내 계산이 <b>${m}분 빨랐다</b>. 그만큼 빼야 한다.`; },
        () => { total += 60; return `그리고 정확히 <b>한 시간 뒤</b>, 누군가 문을 두드렸다.`; },
      ]);
      const lines = [`① <b>${sh}시 ${sm}분</b>, 나는 홍차를 우렸다.`];
      for (let i = 0; i < d.steps; i++) lines.push(`${'②③④⑤'[i]} ${pool[i]()}`);
      lines.push('마지막 순간의 시각에 시계를 맞춰라.');
      const h = Math.floor(total / 60) % 12 || 12, m = total % 60;
      const ans = `${h}:${m}`;
      return { input: 'clock', answer: ans, pieces: [lines], hints: ['①부터 순서대로 시간을 더하고 빼세요.', `정답은 ${h}시 ${m}분`] };
    },

    order(t, d, def) {
      const labels = t.shuffle(def.items).slice(0, d.items);
      const n = labels.length, ids = labels.map((_, i) => i);
      const answer = t.shuffle(ids);
      const pos = x => answer.indexOf(x);
      const cands = [];
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (a === b || pos(a) >= pos(b)) continue;
        cands.push({ a, b, ok: p => p.indexOf(a) < p.indexOf(b), text: `<b>${labels[a]}</b>은(는) <b>${labels[b]}</b>보다 <u>먼저</u>.` });
      }
      let chosen = [], left = permutations(ids);
      for (const c of t.shuffle(cands)) {
        const next = left.filter(c.ok);
        if (next.length < left.length) { chosen.push(c); left = next; }
        if (left.length === 1) break;
      }
      // 없어도 답이 유일한 문장은 제거
      for (const c of chosen.slice()) {
        const rest = chosen.filter(x => x !== c);
        if (permutations(ids).filter(p => rest.every(x => x.ok(p))).length === 1) chosen = rest;
      }
      return {
        input: 'order', labels, answer: answer.join(','),
        pieces: [chosen.map(c => c.text)],
        hints: [`맨 처음은 ${labels[answer[0]]}입니다.`, `순서: ${answer.map(i => labels[i]).join(' → ')}`],
      };
    },

    cipher(t, d, def) {
      const word = def.items[t.int(0, def.items.length - 1)];
      const chars = [...word];
      const filler = t.shuffle([...FILLER].filter(c => !chars.includes(c)));
      const cells = t.shuffle([...new Set(chars), ...filler].slice(0, 25));
      const grid = cells;
      const lines = chars.map((c, i) => {
        const k = grid.indexOf(c), row = Math.floor(k / 5) + 1, col = (k % 5) + 1;
        const f = v => { if (!d.mirror) return `${v}`; const a = t.int(1, 4); return `(${v + a}−${a})`; };
        return `${i + 1}번째 글자 → <b>${f(row)}행 ${f(col)}열</b>`;
      });
      return {
        input: 'cipher', grid, length: chars.length, answer: word,
        pieces: [lines],
        hints: ['글자판에서 행(가로줄)과 열(세로줄)을 세어 글자를 찾으세요.', `정답은 “${word}”`],
      };
    },

    direction(t, d, def) {
      const arrows = ['↑', '↓', '←', '→'];
      const seq = Array.from({ length: d.dirs }, () => t.int(0, 3));
      const lines = seq.map((s, i) => `${i + 1}번째: <b>${def.items[s]}</b>`);
      let ans = seq;
      if (d.mirror) {
        lines.push('덧붙임: “지시를 모두 <b>정반대</b>로 행하라.”');
        ans = seq.map(s => s ^ 1);
      }
      const answer = ans.map(s => arrows[s]).join('');
      return { input: 'direction', length: d.dirs, answer, pieces: [lines], hints: ['각 문장이 위·아래·왼쪽·오른쪽 중 어디인지 해석하세요.', `정답은 ${answer}`] };
    },

    symbols(t, d) {
      const syms = t.shuffle(SYMBOLS);
      const ans = syms.slice(0, d.symbols);
      const spots = t.shuffle([[14, 8], [38, 6], [62, 9], [86, 7], [8, 36], [34, 33], [66, 36], [92, 34], [22, 62], [50, 60], [78, 63], [38, 92]]);
      return {
        input: 'symbols', length: d.symbols, keypad: t.shuffle(syms.slice(0, 9)), answer: ans.join(''),
        marks: ans.map((s, i) => ({ s, order: i + 1, x: spots[i][0], y: spots[i][1] })),
        dark: true, pieces: [],
        hints: ['손전등으로 방 곳곳의 빛나는 기호를 찾으세요. 점의 개수가 순서입니다.', `순서: ${ans.join(' ')}`],
      };
    },

    lights(t, d) {
      const grid = Array(9).fill(1);
      const solution = t.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, d.presses);
      solution.forEach(i => flip(grid, i));
      return {
        input: 'lights', start: grid, answer: 'on', pieces: [],
        hints: ['스위치를 누르면 자신과 상하좌우가 뒤집힙니다. 9개를 모두 켜세요. 순서는 상관없습니다.',
          `처음 상태에서(↺ 초기화 후) 누를 칸: ${solution.map(i => `${Math.floor(i / 3) + 1}행${i % 3 + 1}열`).join(', ')}`],
      };
    },

    simon(t, d) {
      const seq = Array.from({ length: d.simon }, () => t.int(0, 3));
      return { input: 'simon', seq, answer: seq.join(''), pieces: [], hints: ['재생 버튼을 눌러 순서를 듣고 같은 순서로 누르세요.', `순서(1~4번): ${seq.map(x => x + 1).join(' - ')}`] };
    },

    boxes(t, d) {
      const n = d.boxes, N = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
      const make = self => {
        const a = t.int(0, n - 1), b = (a + t.int(1, n - 1)) % n;
        switch (t.int(0, 3)) {
          case 0: return { text: `열쇠는 ${N[a]}번 상자에 있다.`, f: k => k === a };
          case 1: return { text: `열쇠는 ${N[a]}번 상자에 없다.`, f: k => k !== a };
          case 2: return { text: '열쇠는 이 상자에 없다.', f: k => k !== self };
          default: return { text: `열쇠는 ${N[a]}번 아니면 ${N[b]}번에 있다.`, f: k => k === a || k === b };
        }
      };
      let found = null;
      for (let i = 0; i < 20000 && !found; i++) {
        const st = Array.from({ length: n }, (_, k) => make(k));
        if (new Set(st.map(s => s.text)).size < n) continue;
        const valid = [...Array(n).keys()].filter(k => st.filter(s => s.f(k)).length === 1);
        if (valid.length === 1) found = { st: st.map(s => s.text), ans: valid[0] };
      }
      if (!found) throw new Error('boxes: 유일해를 만들지 못함');
      return {
        input: 'boxes', names: N.slice(0, n), answer: String(found.ans),
        pieces: [found.st.map((s, i) => `<b>${N[i]}번 상자</b>: “${s}”`)],
        hints: ['“열쇠가 ○번에 있다”고 가정하고 참인 문장 수를 세어 보세요. 딱 하나여야 합니다.', `열쇠는 ${N[found.ans]}번 상자`],
      };
    },
  };

  function build(themeId, seed, diffKey) {
    const theme = window.THEMES.find(x => x.id === themeId) || window.THEMES[0];
    const d = DIFF[diffKey] || DIFF.normal;
    const base = `${theme.id}|${seed}|${diffKey}`;
    const t = tools(rngFrom(base));

    /* 범인 외 3명은 각각 정확히 한 가지 특징만 다르다 → 증거 3개가 모두 필요 */
    const order = t.shuffle([0, 1, 2, 3]);
    const truth = [t.int(0, 1), t.int(0, 1), t.int(0, 1)];
    const suspects = theme.suspects.map(([id, name, role, face, quote]) => ({ id, name, role, face, quote }));
    order.forEach((who, i) => {
      suspects[who].traits = truth.map((v, k) => (i === k + 1 ? 1 - v : v));
    });

    const puzzles = {};
    const stages = theme.stages.map((s, si) => ({
      name: s.name, msg: s.msg, decor: s.decor,
      secretAt: Math.floor(rngFrom(base + '|secret' + si)() * s.decor.length),
      puzzles: s.puzzles.map((def, pi) => {
        const id = `${si}-${pi}`;
        const data = GEN[def.p](tools(rngFrom(`${base}|${id}`)), d, def);
        puzzles[id] = Object.assign(data, { id, type: def.p, stage: si, lock: def.lock, clues: def.clues });
        return id;
      }),
    }));
    stages.forEach(s => { s.dark = s.puzzles.some(id => puzzles[id].dark); });

    /* k번째 증거까지 모두 들어맞는 용의자 (3명 → 2명 → 1명) */
    const survivors = k => suspects.filter(x => x.traits.slice(0, k + 1).every((v, j) => v === truth[j])).map(x => x.id);
    /* 최종 반박: 결백한 두 사람을 각각 어느 증거가 배제하는지 */
    const proof = tools(rngFrom(base + '|proof')).shuffle([0, 1, 2]).slice(0, 2).map(k => ({ who: suspects[order[k + 1]].id, answer: k }));

    return { theme, seed, diffKey, d, stages, puzzles, suspects, truth, survivors, proof, culprit: suspects[order[0]].id };
  }

  window.Puzzles = { build, DIFF, autoDiff, rngFrom, flip };
})();
