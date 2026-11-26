/* 시드 기반 퍼즐 생성. 같은 테마 + 시드 + 난이도 = 같은 문제.
   모든 퍼즐은 문자열 answer 하나로 판정한다(두꺼비집만 공유 상태). */
(function () {
  'use strict';

  const DIFF = {
    easy:   { label: '쉬움',   level: 1, minutes: 55, hints: 3, wrong: 30, mirror: false, items: 5, steps: 3, dirs: 5, symbols: 5, fakes: 2, size: 3, presses: 4, simon: 5, boxes: 4, truths: 1, digits: 3, vars: 3 },
    normal: { label: '보통',   level: 2, minutes: 50, hints: 3, wrong: 60, mirror: false, items: 5, steps: 4, dirs: 6, symbols: 6, fakes: 3, size: 4, presses: 4, simon: 6, boxes: 5, truths: 2, digits: 4, vars: 3 },
    hard:   { label: '어려움', level: 3, minutes: 45, hints: 3, wrong: 90, mirror: true,  items: 6, steps: 5, dirs: 7, symbols: 7, fakes: 4, size: 4, presses: 6, simon: 7, boxes: 5, truths: 2, digits: 4, vars: 4 },
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
    const n = Math.round(Math.sqrt(g.length)), x = i % n, y = Math.floor(i / n);
    [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([a, b]) => {
      if (a >= 0 && a < n && b >= 0 && b < n) g[b * n + a] ^= 1;
    });
  }

  /* 후보를 하나로 좁히는 조건들을 고른 뒤, 없어도 되는 조건은 제거 */
  function narrow(all, cands) {
    let chosen = [], left = all;
    for (const c of cands) {
      const next = left.filter(c.ok);
      if (next.length < left.length) { chosen.push(c); left = next; }
      if (left.length === 1) break;
    }
    if (left.length !== 1) return null;
    for (const c of chosen.slice()) {
      const rest = chosen.filter(x => x !== c);
      if (all.filter(p => rest.every(x => x.ok(p))).length === 1) chosen = rest;
    }
    return chosen;
  }

  /* 순서 추리 조건: 직접적인 조건은 뒤로 밀어 여러 단서를 엮어야 풀리게 한다 */
  function orderClues(t, labels, level) {
    const n = labels.length, ids = labels.map((_, i) => i), all = permutations(ids);
    const answer = t.shuffle(ids), at = x => answer.indexOf(x), B = i => `<b>${labels[i]}</b>`;
    const weak = [], mid = [], strong = [];
    const add = (list, ok, text) => { if (ok(answer)) list.push({ ok, text }); };
    ids.forEach(a => {
      add(weak, p => p[0] !== a && p[n - 1] !== a, `${B(a)}: 맨 처음도, 맨 마지막도 아니다.`);
      add(weak, p => p.indexOf(a) !== at(a) - 1, `${B(a)}: ${at(a)}번째는 아니다.`);
      add(weak, p => p.indexOf(a) !== at(a) + 1, `${B(a)}: ${at(a) + 2}번째는 아니다.`);
      ids.forEach(b => {
        if (a === b) return;
        add(mid, p => p.indexOf(a) < p.indexOf(b), `${B(a)}: ${B(b)}보다 <u>먼저</u>.`);
        if (a < b) {
          add(weak, p => Math.abs(p.indexOf(a) - p.indexOf(b)) !== 1, `${B(a)}, ${B(b)}: 서로 <u>붙어 있지 않다</u>.`);
          add(mid, p => Math.abs(p.indexOf(a) - p.indexOf(b)) === 2, `${B(a)}, ${B(b)}: 둘 사이에 <u>정확히 하나</u>가 있다.`);
          ids.forEach(c => {
            if (c === a || c === b) return;
            add(mid, p => (p.indexOf(a) - p.indexOf(c)) * (p.indexOf(b) - p.indexOf(c)) < 0, `${B(c)}: ${B(a)}와(과) ${B(b)} <u>사이</u> 어딘가.`);
          });
        }
        add(strong, p => p.indexOf(b) - p.indexOf(a) === 1, `${B(a)} <u>바로 다음</u>이 ${B(b)}.`);
      });
    });
    const W = t.shuffle(weak), M = t.shuffle(mid), S = t.shuffle(strong);
    const pool = level >= 3 ? [...W.slice(0, 4), ...M, ...W.slice(4), ...S]
      : level === 2 ? [...W.slice(0, 2), ...M, ...S.slice(0, 1), ...W.slice(2), ...S]
        : [...S.slice(0, 1), ...M, ...W, ...S];
    return { answer, clues: t.shuffle(narrow(all, pool).map(c => c.text)) };
  }

  const SYMBOLS = ['☽', '☀', '★', '♠', '♣', '♥', '♦', '⚓', '⚖', '☂', '♞', '✿'];
  const COLOR_HEX = ['#d0453a', '#3b7de0', '#34a862', '#e0b320'];
  const COLOR_NAME = ['빨강', '파랑', '초록', '노랑'];
  const FILLER = '가나다라마바사아자차카타파하구누두루무부수우주추';

  const tick = '①②③④⑤⑥⑦';

  /* 각 생성기: (도구, 난이도, 테마 퍼즐 정의) → { kind, title, answer, pieces:{clueIndex:[문장]}, ... , hints:[..] } */
  const GEN = {
    /* 색의 순서도, 각 색의 숫자도 추리해야 한다 */
    color(t, d, def) {
      const items = def.items.map((name, i) => ({ name, hex: COLOR_HEX[i], color: COLOR_NAME[i] }));
      const gem = i => `<span class="gem" style="background:${items[i].hex}"></span>`;
      const { answer: order, clues } = orderClues(t, COLOR_NAME.map((c, i) => `${gem(i)}${c}`), d.level);
      const nums = t.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
      const chain = t.shuffle([0, 1, 2, 3]);
      const name = i => `${gem(i)}${items[i].name}`;
      const links = [`${name(chain[0])}의 숫자는 <b>${nums[chain[0]]}</b>.`];
      for (let k = 1; k < 4; k++) {
        const a = chain[k], b = chain[k - 1], diff = nums[a] - nums[b];
        if (d.level >= 2 && k === 2) links.push(`${name(a)}와(과) ${name(b)}의 숫자를 더하면 <b>${nums[a] + nums[b]}</b>.`);
        else links.push(`${name(a)}의 숫자는 ${name(b)}보다 <b>${Math.abs(diff)}</b> ${diff > 0 ? '크다' : '작다'}.`);
      }
      let code = order.map(i => nums[i]);
      const first = ['네 색을 읽는 순서를 알아내라.', ...clues];
      if (d.mirror) { code = code.slice().reverse(); first.push('구석의 낙서: “모든 것은 <b>거울</b>처럼 거꾸로”'); }
      return {
        input: 'digits', length: 4, answer: code.join(''),
        pieces: [first, t.shuffle(links)],
        hints: [`색 순서(거울 규칙 적용 전): ${order.map(i => COLOR_NAME[i]).join(' → ')}`, `정답은 ${code.join('')}`],
      };
    },

    clock(t, d) {
      const sh = t.int(1, 12), sm = t.int(0, 11) * 5;
      let total = sh * 60 + sm;
      const add = (m, text) => () => { total += m(); return text(); };
      let v = 0;
      const pool = t.shuffle([
        add(() => (v = t.int(5, 11) * 5), () => `그로부터 <b>${v}분 뒤</b>, 발소리가 들렸다.`),
        add(() => 90, () => '분침이 시계를 <b>한 바퀴 반</b> 돌았다.'),
        add(() => (v = t.int(2, 4)) * 15, () => `<b>15분짜리 모래시계</b>를 ${v}번 뒤집어 다 흘려보냈다.`),
        add(() => -(v = t.int(2, 7) * 5), () => `아차, 내 계산이 <b>${v}분 빨랐다</b>. 그만큼 빼야 한다.`),
        add(() => 150, () => '시침이 <b>숫자 두 칸 반</b>만큼 움직였다.'),
        add(() => -((v = t.int(1, 2)) * 60 + 20), () => `사실 직전의 일은 <b>${v}시간 20분 전</b>에 일어난 것이었다. 되돌려라.`),
        add(() => 135, () => '<b>두 시간하고도 15분</b>이 더 지났다.'),
      ]);
      const lines = [`① <b>${sh}시 ${sm}분</b>, 나는 마지막으로 시계를 확인했다.`];
      for (let i = 0; i < d.steps; i++) lines.push(`${tick[i + 1]} ${pool[i]()}`);
      let final = ((total % 720) + 720) % 720;
      if (d.mirror) { final = (720 - final) % 720; lines.push('마지막 순간의 시계가 <b>거울에 비친 모습</b> 그대로 바늘을 맞춰라.'); }
      else lines.push('마지막 순간의 시각에 시계를 맞춰라.');
      const h = Math.floor(final / 60) || 12, m = final % 60;
      return { input: 'clock', answer: `${h}:${m}`, pieces: [lines], hints: [d.mirror ? '시각을 먼저 구한 뒤, 좌우를 뒤집은 바늘 위치를 생각하세요. (12시에서 뺀 값)' : '①부터 순서대로 더하고 빼세요.', `정답은 ${h}시 ${m}분`] };
    },

    order(t, d, def) {
      const labels = t.shuffle(def.items).slice(0, d.items);
      const { answer, clues } = orderClues(t, labels, d.level);
      return {
        input: 'order', labels, answer: answer.join(','),
        pieces: [clues],
        hints: [`맨 처음은 ${labels[answer[0]]}입니다.`, `순서: ${answer.map(i => labels[i]).join(' → ')}`],
      };
    },

    cipher(t, d, def) {
      const word = def.items[t.int(0, def.items.length - 1)];
      const chars = [...word];
      const filler = t.shuffle([...FILLER].filter(c => !chars.includes(c)));
      const grid = t.shuffle([...new Set(chars), ...filler].slice(0, 25));
      const pos = c => { const k = grid.indexOf(c); return [Math.floor(k / 5) + 1, (k % 5) + 1]; };
      const f = v => {
        const a = t.int(2, 6);
        if (d.level === 1) return `(${v + a}−${a})`;
        return t.int(0, 1) ? `(${v * a}÷${a})` : `(${a}×${a}−${a * a - v})`;
      };
      const lines = chars.map((c, i) => {
        const [row, col] = pos(c);
        if (i === 0 || d.level === 1) return `${i + 1}번째 글자 → <b>${f(row)}행 ${f(col)}열</b>`;
        const [pr, pc] = pos(chars[i - 1]);
        const dr = row - pr, dc = (col - pc) * (d.mirror ? -1 : 1);
        const v = dr ? `${dr > 0 ? '아래' : '위'}로 ${Math.abs(dr)}칸` : '';
        const h = dc ? `${dc > 0 ? '오른쪽' : '왼쪽'}으로 ${Math.abs(dc)}칸` : '';
        return `${i + 1}번째 글자 → ${i}번째에서 <b>${[v, h].filter(Boolean).join(', ') || '움직이지 않음'}</b>`;
      });
      if (d.mirror) lines.push('항해자의 주석: “이 지도의 <b>왼쪽과 오른쪽은 거울처럼 뒤바뀌어</b> 있다. (이동 지시에만 해당)”');
      return {
        input: 'cipher', grid, length: chars.length, answer: word,
        pieces: [d.level === 1 ? lines : t.shuffle(lines)],
        hints: [`첫 글자는 “${chars[0]}” 입니다.`, `정답은 “${word}”`],
      };
    },

    /* 문장 해석 + 직전 방향을 기준으로 한 회전 */
    direction(t, d, def) {
      const arrows = ['↑', '→', '↓', '←'];
      const word = [def.items[0], def.items[3], def.items[1], def.items[2]]; // 위, 오른쪽, 아래, 왼쪽
      const seq = [t.int(0, 3)];
      const lines = [`1번째: <b>${word[seq[0]]}</b>`];
      const relative = [
        [() => 1, () => '직전 방향에서 <b>시계 방향으로 90°</b>'],
        [() => 3, () => '직전 방향에서 <b>반시계 방향으로 90°</b>'],
        [() => 2, () => '직전의 <b>정반대</b>'],
      ];
      for (let i = 1; i < d.dirs; i++) {
        const kind = t.int(0, d.level >= 2 && i >= 3 ? 3 : 2);
        if (kind === 0) { const s = t.int(0, 3); seq.push(s); lines.push(`${i + 1}번째: <b>${word[s]}</b>`); }
        else if (kind === 3) { const j = t.int(0, i - 2); seq.push((seq[j] + 2) % 4); lines.push(`${i + 1}번째: <b>${j + 1}번째의 반대 방향</b>`); }
        else { const [turn, text] = relative[t.int(0, 2)]; seq.push((seq[i - 1] + turn()) % 4); lines.push(`${i + 1}번째: ${text()}`); }
      }
      let ans = seq;
      if (d.mirror) { lines.push('덧붙임: “모두 해석한 뒤, <b>마지막 것부터 거꾸로</b> 행하라.”'); ans = seq.slice().reverse(); }
      const answer = ans.map(s => arrows[s]).join('');
      return { input: 'direction', length: d.dirs, answer, pieces: [lines], hints: [`1번째 방향은 ${arrows[seq[0]]} 입니다. 차례로 해석하세요.`, `정답은 ${answer}`] };
    },

    symbols(t, d) {
      const syms = t.shuffle(SYMBOLS);
      const real = syms.slice(0, d.symbols);
      const spots = t.shuffle([[14, 8], [38, 6], [62, 9], [86, 7], [8, 36], [34, 33], [66, 36], [92, 34], [22, 62], [50, 60], [78, 63], [38, 92]]);
      const marks = real.map((s, i) => ({ s, order: i + 1, x: spots[i][0], y: spots[i][1] }));
      /* 가짜(붉은) 기호: 진짜와 같은 점 개수로 헷갈리게 한다 */
      for (let k = 0; k < d.fakes && real.length + k < spots.length; k++) {
        marks.push({ s: syms[t.int(0, 8)], order: t.int(1, d.symbols), x: spots[real.length + k][0], y: spots[real.length + k][1], fake: true });
      }
      const ans = d.mirror ? real.slice().reverse() : real;
      return {
        input: 'symbols', length: d.symbols, keypad: t.shuffle(syms.slice(0, 9)), answer: ans.join(''),
        marks, dark: true, pieces: [],
        note: `<b>붉은 기호는 함정</b>이다. 점의 개수가 ${d.mirror ? '<b>많은 것부터 거꾸로</b>' : '순서'}.`,
        hints: ['초록 기호만 모으세요. 점의 개수가 순서입니다.', `정답 순서: ${ans.join(' ')}`],
      };
    },

    lights(t, d) {
      const n = d.size, cells = Array.from({ length: n * n }, (_, i) => i);
      let grid, solution;
      do {
        grid = Array(n * n).fill(1);
        solution = t.shuffle(cells).slice(0, d.presses);
        solution.forEach(i => flip(grid, i));
      } while (grid.every(v => v));
      return {
        input: 'lights', start: grid, answer: 'on', pieces: [],
        hints: ['스위치를 누르면 자신과 상하좌우가 뒤집힙니다. 맨 윗줄의 꺼진 불은 바로 아랫줄에서 켜 보세요.',
          `처음 상태에서(↺ 초기화 후) 누를 칸: ${solution.map(i => `${Math.floor(i / n) + 1}행${i % n + 1}열`).join(', ')}`],
      };
    },

    simon(t, d) {
      const seq = Array.from({ length: d.simon }, () => t.int(0, 3));
      const ans = d.mirror ? seq.slice().reverse() : seq;
      return {
        input: 'simon', seq, answer: ans.join(''), pieces: [],
        note: d.mirror ? '테이프에 적힌 글: “<b>들은 것을 거꾸로</b> 돌려주어라.”' : '',
        hints: [d.mirror ? '들은 순서의 마지막 음부터 누르세요.' : '재생 버튼을 눌러 순서를 듣고 같은 순서로 누르세요.', `누를 순서(1~4번): ${ans.map(x => x + 1).join(' - ')}`],
      };
    },

    /* 참인 문장이 정확히 K개. 보통 이상은 다른 문장의 참·거짓을 말하는 문장이 섞인다 */
    boxes(t, d) {
      const n = d.boxes, K = d.truths, N = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
      const make = self => {
        const a = t.int(0, n - 1), b = (a + t.int(1, n - 1)) % n;
        switch (t.int(0, 4)) {
          case 0: return { text: `열쇠는 ${N[a]}번 상자에 있다.`, f: k => k === a };
          case 1: return { text: `열쇠는 ${N[a]}번 상자에 없다.`, f: k => k !== a };
          case 2: return { text: '열쇠는 이 상자에 없다.', f: k => k !== self };
          case 3: return { text: `열쇠는 ${N[a]}번 아니면 ${N[b]}번에 있다.`, f: k => k === a || k === b };
          default: return { text: `열쇠는 ${N[a]}번보다 뒤 번호의 상자에 있다.`, f: k => k > a };
        }
      };
      let found = null;
      for (let i = 0; i < 40000 && !found; i++) {
        const st = Array.from({ length: n }, (_, k) => make(k));
        if (d.level >= 2) {
          const refs = t.shuffle([...Array(n).keys()]).slice(0, d.level >= 3 ? 2 : 1);
          const plain = [...Array(n).keys()].filter(k => !refs.includes(k));
          refs.forEach(r => {
            const to = plain[t.int(0, plain.length - 1)], yes = !!t.int(0, 1), base = st[to];
            st[r] = { text: `${N[to]}번 상자의 문장은 ${yes ? '참' : '거짓'}이다.`, f: k => base.f(k) === yes };
          });
        }
        if (new Set(st.map(s => s.text)).size < n) continue;
        if (st.some(s => [...Array(n).keys()].every(k => s.f(k) === s.f(0)))) continue;
        const valid = [...Array(n).keys()].filter(k => st.filter(s => s.f(k)).length === K);
        if (valid.length === 1) found = { st: st.map(s => s.text), ans: valid[0] };
      }
      if (!found) throw new Error('boxes: 유일해를 만들지 못함');
      return {
        input: 'boxes', names: N.slice(0, n), truths: K, answer: String(found.ans),
        pieces: [found.st.map((s, i) => `<b>${N[i]}번 상자</b>: “${s}”`)],
        hints: [`“열쇠가 ○번에 있다”고 하나씩 가정하고 참인 문장 수를 세어 보세요. 정확히 ${K}개여야 합니다.`, `열쇠는 ${N[found.ans]}번 상자`],
      };
    },

    /* 숫자 야구: 지난 시도의 판정 기록으로 암호를 역추적 */
    mastermind(t, d) {
      const len = d.digits, all = [];
      (function walk(p) {
        if (p.length === len) return all.push(p);
        for (let v = 1; v <= 9; v++) if (!p.includes(v)) walk([...p, v]);
      })([]);
      const answer = all[t.int(0, all.length - 1)];
      const judge = (g, a) => {
        const s = g.filter((v, i) => a[i] === v).length;
        return [s, g.filter(v => a.includes(v)).length - s];
      };
      let chosen = null;
      while (!chosen) {
        const pool = t.shuffle(all).slice(0, 220)
          .filter(g => { const [s] = judge(g, answer); return s <= (d.level >= 2 ? 1 : 2) && s < len; })
          .map(g => { const [s, b] = judge(g, answer); return { g, s, b, ok: a => { const r = judge(g, a); return r[0] === s && r[1] === b; } }; });
        chosen = narrow(all, pool);
        if (chosen && chosen.length > 7) chosen = null;
      }
      return {
        input: 'digits', length: len, answer: answer.join(''),
        pieces: [[`서로 다른 숫자 <b>${len}자리</b>(1~9). ● = 숫자와 자리가 맞음, ○ = 숫자만 맞음`,
          ...chosen.map(c => `<b class="guess">${c.g.join(' ')}</b> → ● ${c.s} · ○ ${c.b}`)]],
        hints: [`첫 번째 자리는 ${answer[0]} 입니다.`, `정답은 ${answer.join('')}`],
      };
    },

    /* 기호 연립식: 기호마다 숫자를 구해 지정된 순서로 입력 */
    equations(t, d, def) {
      const icons = def.items.slice(0, d.vars), n = icons.length;
      const all = [];
      (function walk(p) {
        if (p.length === n) return all.push(p);
        for (let v = 1; v <= 9; v++) if (!p.includes(v)) walk([...p, v]);
      })([]);
      const answer = all[t.int(0, all.length - 1)];
      const forms = [];
      const add = (text, f) => forms.push({ text: `${text} = <b>${f(answer)}</b>`, ok: a => f(a) === f(answer) });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const A = icons[i], B = icons[j];
        if (i < j) { add(`${A} + ${B}`, a => a[i] + a[j]); add(`${A} × ${B}`, a => a[i] * a[j]); }
        add(`${A} + ${A} − ${B}`, a => 2 * a[i] - a[j]);
        if (d.level >= 2) add(`${A} × ${B} − ${A}`, a => a[i] * a[j] - a[i]);
        for (let k = j + 1; k < n; k++) if (k !== i) add(`${B} + ${icons[k]} − ${A}`, a => a[j] + a[k] - a[i]);
      }
      let chosen = null;
      while (!chosen) {
        chosen = narrow(all, t.shuffle(forms));
        if (chosen && chosen.length < (d.level >= 2 ? 3 : 2)) chosen = null;
      }
      const show = t.shuffle([...Array(n).keys()]);
      const code = show.map(i => answer[i]).join('');
      return {
        input: 'digits', length: n, answer: code,
        pieces: [['각 기호는 1~9의 <b>서로 다른</b> 숫자다.', ...chosen.map(c => c.text), `자물쇠에 새겨진 순서: <b>${show.map(i => icons[i]).join(' ')}</b>`]],
        hints: [`${icons[0]} = ${answer[0]}`, `정답은 ${code}`],
      };
    },
  };

  function build(themeId, seed, diffKey) {
    const theme = window.THEMES.find(x => x.id === themeId) || window.THEMES[0];
    const d = DIFF[diffKey] || DIFF.normal;
    const base = `${theme.id}|${seed}|${diffKey}`;
    const t = tools(rngFrom(base));

    /* 용의자는 단계 수 + 1명. 범인 외에는 각각 정확히 한 가지 특징만 다르다 → 모든 증거가 필요 */
    const count = theme.stages.length;
    const order = t.shuffle(theme.suspects.map((_, i) => i));
    const truth = theme.traits.map(() => t.int(0, 1));
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

    /* k번째 증거까지 모두 들어맞는 용의자 (4명 → … → 1명) */
    const survivors = k => suspects.filter(x => x.traits.slice(0, k + 1).every((v, j) => v === truth[j])).map(x => x.id);
    /* 최종 반박: 결백한 세 사람을 각각 어느 증거가 배제하는지 */
    const proof = tools(rngFrom(base + '|proof')).shuffle([...Array(count).keys()]).slice(0, 3).map(k => ({ who: suspects[order[k + 1]].id, answer: k }));

    return { theme, seed, diffKey, d, stages, puzzles, suspects, truth, survivors, proof, culprit: suspects[order[0]].id };
  }

  window.Puzzles = { build, DIFF, autoDiff, rngFrom, flip };
})();
