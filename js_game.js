/* 게임 상태(방장 권한) + 화면 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const maxPlayers = themeId => (window.THEMES.find(t => t.id === themeId) || window.THEMES[0]).maxPlayers;
  const AVATARS = ['🕵️', '🦊', '🐼', '🐸', '🦉', '🐯'];
  const store = {
    get(k, s = localStorage) { try { return JSON.parse(s.getItem(k)); } catch (e) { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k, s = localStorage) { try { s.removeItem(k); } catch (e) {} },
  };
  const randomId = n => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  /* ---------- 로컬 상태 ---------- */
  const me = {
    pid: store.get('esc-pid', sessionStorage) || randomId(10),
    name: store.get('esc-name') || '',
  };
  store.set('esc-pid', me.pid, sessionStorage);
  me.uid = store.get('esc-uid') || randomId(12); // 개인 랭킹용 (이 브라우저에 계속 유지)
  store.set('esc-uid', me.uid);

  let S = null;          // 공유 상태 (방장이 원본)
  let P = null;          // S의 시드로 만든 퍼즐
  let role = null;       // 'host' | 'solo' | 'guest'
  let net = null;
  let endsAt = 0;        // 내 시계 기준 종료 시각
  let lastEvent = 0;
  let modal = null;      // {kind, id}
  let input = {};        // 퍼즐별 입력 중인 값 (다시 그려도 유지)
  let seenScreen = '';
  let collapsed = false; // 돌파 창을 접었는지 (다시 그려도 유지)
  let link = new URLSearchParams(location.search);
  let lanBase = null;

  const sel = { theme: link.get('theme') || 'manor', diff: link.get('diff') || 'auto', seed: link.get('seed') || '' };
  if (!window.THEMES.some(t => t.id === sel.theme)) sel.theme = 'manor';
  if (sel.diff !== 'auto' && !window.Puzzles.DIFF[sel.diff]) sel.diff = 'auto';

  /* =================== 방장 로직 =================== */
  function newState(code, solo) {
    return {
      code, solo, phase: 'lobby', theme: sel.theme, diffChoice: sel.diff, seed: sel.seed || randomId(6),
      diff: null, players: [], stage: 0, solved: {}, lights: {}, found: {}, hints: {}, hintsLeft: 0,
      wrong: 0, hintsUsed: 0, votes: {}, accused: null, result: null, chat: [], events: [], eseq: 0,
      endsAt: 0, scares: 0, cleared: null, picks: [], deduced: false, deduceHint: false,
      installed: {}, team: '', ranked: !sel.seed, gameId: '', proofStep: 0, points: 0, letter: 'C', board: [],
    };
  }
  const connected = () => S.players.filter(p => p.on);
  const emit = (type, data) => { S.events.push(Object.assign({ n: ++S.eseq, type }, data)); if (S.events.length > 20) S.events.shift(); };
  const nameOf = pid => (S.players.find(p => p.pid === pid) || {}).name || '누군가';

  function addPlayer(pid, name) {
    name = String(name || '').trim().slice(0, 10) || '탐정';
    let p = S.players.find(x => x.pid === pid);
    const max = maxPlayers(S.theme);
    if ((!p || !p.on) && connected().length >= max) return false;
    if (p) { p.on = true; p.name = name; return true; }
    if (S.players.length >= max) S.players.splice(S.players.findIndex(x => !x.on), 1);
    const used = S.players.map(x => x.av);
    p = { pid, name, on: true, av: AVATARS.find(a => !used.includes(a)) || '👤', host: pid === me.pid };
    S.players.push(p);
    if (!S.solo) emit('toast', { text: `${p.av} ${p.name}님이 들어왔어요` });
    return true;
  }

  function startGame() {
    const n = connected().length;
    S.diff = S.diffChoice === 'auto' ? window.Puzzles.autoDiff(n) : S.diffChoice;
    P = window.Puzzles.build(S.theme, S.seed, S.diff);
    input = {};
    const d = P.d;
    Object.assign(S, {
      phase: 'intro', stage: 0, solved: {}, lights: {}, found: {}, hints: {}, hintsLeft: d.hints, wrong: 0, hintsUsed: 0,
      votes: {}, accused: null, result: null, scares: 0, cleared: null, endsAt: 0, timeLeft: d.minutes * 60,
      installed: {}, picks: [], deduced: false, deduceHint: false, proofStep: 0, points: 0, letter: 'C', gameId: randomId(12),
      board: [],
      teamName: S.team || `${(S.players.find(p => p.host) || S.players[0]).name}팀`,
    });
    Object.values(P.puzzles).filter(z => z.type === 'lights').forEach(z => { S.lights[z.id] = z.start.slice(); });
  }

  /* 각 방의 두 번째 장치는 첫 장치에서 얻은 부품을 끼워야 작동한다 */
  const needsPart = z => z.id.endsWith('-1') && !(S.installed || {})[z.stage];
  const hasPart = stage => !!S.solved[`${stage}-0`] && !(S.installed || {})[stage];
  const partOf = stage => window.STORY[S.theme].items[stage];

  function solve(id, pid) {
    const z = P.puzzles[id];
    S.solved[id] = pid;
    emit('solved', { text: `✅ ${nameOf(pid)}님이 「${z.lock[1]}」 해결!` });
    if (hasPart(z.stage)) emit('toast', { text: `${partOf(z.stage)[0]} 「${partOf(z.stage)[1]}」 획득!` });
    const st = P.stages[S.stage];
    if (st.puzzles.every(x => S.solved[x])) { S.cleared = S.stage; emit('door', {}); }
  }

  function penalty(text) {
    S.wrong++;
    S.endsAt -= P.d.wrong * 1000;
    emit('wrong', { text: `❌ ${text} (−${P.d.wrong}초)` });
  }

  function finish(kind) {
    if (S.phase === 'play') S.timeLeft = Math.max(0, Math.round((S.endsAt - Date.now()) / 1000));
    const secrets = Object.keys(S.found).length;
    if (kind === 'good' && secrets === P.stages.length) kind = 'true';
    S.result = kind;
    S.phase = 'end';
    const won = kind === 'good' || kind === 'true';
    S.points = window.Rank.score({ won, diff: S.diff, timeLeft: S.timeLeft, secrets, hintsLeft: S.hintsLeft, wrong: S.wrong, solved: Object.keys(S.solved).length });
    S.letter = !won ? 'C' : kind === 'true' && S.hintsUsed === 0 && S.wrong <= 1 ? 'S' : S.hintsUsed + S.wrong <= 4 ? 'A' : 'B';
    if (won && S.ranked) {
      window.Rank.submit({
        id: S.gameId, theme: S.theme, diff: S.diff, team: S.teamName, players: connected().length, score: S.points,
        seconds: P.d.minutes * 60 - S.timeLeft, hints: S.hintsUsed, wrong: S.wrong, perfect: kind === 'true', at: Date.now(),
      }).then(ok => { if (!ok) toast('랭킹 서버에 저장하지 못해 이 기기에만 기록했어요', 'bad'); boardCache = {}; if (S && S.phase === 'end') render(); });
    }
  }

  function resolveVotes() {
    const voters = connected();
    if (!voters.length || !voters.every(p => S.votes[p.pid])) return;
    const count = {};
    voters.forEach(p => { count[S.votes[p.pid]] = (count[S.votes[p.pid]] || 0) + 1; });
    const max = Math.max(...Object.values(count));
    const top = Object.keys(count).filter(k => count[k] === max);
    const hostPlayer = voters.find(p => p.host) || voters[0];
    S.accused = top.includes(S.votes[hostPlayer.pid]) ? S.votes[hostPlayer.pid] : top[0];
    if (S.accused !== P.culprit) return finish('bad');
    S.phase = 'proof';
    emit('toast', { text: '지목 성공! 하지만 범인이 반박한다…' });
  }

  /* 모든 행동(방장 본인 포함)은 여기 한 곳을 거친다 */
  function apply(pid, a) {
    if (!S || !a || typeof a.type !== 'string') return;
    const isHost = pid === me.pid;
    const playing = S.phase === 'play';
    const z = playing && P && typeof a.id === 'string' && Object.prototype.hasOwnProperty.call(P.puzzles, a.id) ? P.puzzles[a.id] : null;
    const open = z && z.stage === S.stage && !S.solved[z.id] && !needsPart(z);

    switch (a.type) {
      case 'config':
        if (!isHost || S.phase !== 'lobby') return;
        if (window.THEMES.some(t => t.id === a.theme)) S.theme = a.theme;
        if (a.diff === 'auto' || window.Puzzles.DIFF[a.diff]) S.diffChoice = a.diff;
        if (typeof a.team === 'string') S.team = a.team.trim().slice(0, 12);
        break;
      case 'start': if (!isHost || S.phase !== 'lobby') return; startGame(); break;
      case 'begin':
        if (!isHost || S.phase !== 'intro') return;
        S.phase = 'play'; S.endsAt = Date.now() + S.timeLeft * 1000;
        break;
      case 'answer':
        if (!open || z.type === 'lights') return;
        if (String(a.value) === z.answer) solve(z.id, pid);
        else penalty(`${nameOf(pid)}: 「${z.lock[1]}」 오답`);
        break;
      case 'light': {
        if (!open || z.type !== 'lights' || !(Number.isInteger(a.i) && a.i >= 0 && a.i < S.lights[z.id].length)) return;
        window.Puzzles.flip(S.lights[z.id], a.i);
        if (S.lights[z.id].every(v => v)) solve(z.id, pid);
        break;
      }
      case 'lightReset': if (!open || z.type !== 'lights') return; S.lights[z.id] = z.start.slice(); break;
      case 'hint': {
        if (!open) return;
        const got = S.hints[z.id] || 0;
        if (got >= z.hints.length || S.hintsLeft <= 0) return;
        S.hints[z.id] = got + 1; S.hintsLeft--; S.hintsUsed++;
        emit('toast', { text: `💡 ${nameOf(pid)}님이 힌트를 열었어요` });
        break;
      }
      case 'install':
        if (!playing || !hasPart(S.stage)) return;
        S.installed[S.stage] = true;
        emit('install', { text: `⚙️ ${nameOf(pid)}님이 「${partOf(S.stage)[1]}」을(를) 끼웠다. 철컥!` });
        break;
      case 'secret': {
        if (!playing || S.found[S.stage] || a.i !== P.stages[S.stage].secretAt) return;
        S.found[S.stage] = pid;
        emit('secret', { text: `✨ ${nameOf(pid)}님이 ${P.theme.secretName} 발견!`, i: S.stage });
        break;
      }
      case 'pick': {
        if (!playing || S.cleared !== S.stage || S.deduced || !P.suspects.some(s => s.id === a.id)) return;
        const at = S.picks.indexOf(a.id);
        if (at < 0) S.picks.push(a.id); else S.picks.splice(at, 1);
        break;
      }
      case 'deduce': {
        if (!playing || S.cleared !== S.stage || S.deduced || !S.picks.length) return;
        const right = P.survivors(S.stage);
        if (S.picks.length === right.length && right.every(x => S.picks.includes(x))) {
          S.deduced = true;
          emit('solved', { text: `🧠 ${nameOf(pid)}님의 추리 적중!` });
        } else penalty('추리가 증거와 맞지 않아요');
        break;
      }
      case 'deduceHint':
        if (!playing || S.cleared !== S.stage || S.deduced || S.deduceHint || S.hintsLeft <= 0) return;
        S.deduceHint = true; S.hintsLeft--; S.hintsUsed++;
        break;
      case 'prove': {
        if (S.phase !== 'proof') return;
        if (a.k === P.proof[S.proofStep].answer) {
          S.proofStep++;
          emit('solved', { text: `⚖ ${nameOf(pid)}님이 반박을 깨뜨렸다!` });
          if (S.proofStep >= P.proof.length) finish('good');
        } else {
          S.wrong++; S.timeLeft = Math.max(0, S.timeLeft - P.d.wrong);
          emit('wrong', { text: '❌ 그 증거로는 반박할 수 없어요' });
        }
        break;
      }
      case 'next':
        if (!playing || !isHost || S.cleared !== S.stage) return;
        if (S.stage < P.stages.length - 1 && !S.deduced) return;
        S.cleared = null; S.picks = []; S.deduced = false; S.deduceHint = false;
        if (S.stage < P.stages.length - 1) S.stage++;
        else { S.timeLeft = Math.max(1, Math.round((S.endsAt - Date.now()) / 1000)); S.phase = 'accuse'; }
        break;
      case 'vote':
        if (S.phase !== 'accuse' || !P.suspects.some(s => s.id === a.id)) return;
        S.votes[pid] = a.id; resolveVotes();
        break;
      case 'chat': {
        const text = String(a.text || '').trim().slice(0, 120);
        if (!text) return;
        const p = S.players.find(x => x.pid === pid);
        if (!p) return;
        S.chat.push({ n: ++S.eseq, who: `${p.av} ${p.name}`, text });
        if (S.chat.length > 40) S.chat.shift();
        emit('chat', { from: pid, text: `${p.av} ${p.name}: ${text}` });
        break;
      }
      case 'note': {
        const text = String(a.text || '').trim().slice(0, 200);
        const p = S.players.find(x => x.pid === pid);
        if (!text || !p || S.phase === 'lobby') return;
        S.board.push({ n: ++S.eseq, pid, who: `${p.av} ${p.name}`, text });
        if (S.board.length > 60) S.board.shift();
        emit('note', { from: pid, text: `📌 ${p.name}님이 팀 메모를 남겼어요` });
        break;
      }
      case 'noteDel':
        S.board = S.board.filter(m => !(m.n === a.n && (m.pid === pid || isHost)));
        break;
      case 'lobby':
        if (!isHost) return;
        S.phase = 'lobby'; S.players = S.players.filter(p => p.on); S.seed = randomId(6); S.ranked = true;
        break;
      default: return;
    }
    sync();
  }

  function snapshot() {
    const timeLeft = S.phase === 'play' ? Math.max(0, (S.endsAt - Date.now()) / 1000) : S.timeLeft;
    return Object.assign({}, S, { timeLeft });
  }
  function sync() {
    const snap = snapshot();
    if (net) net.broadcast(() => ({ t: 'state', s: snap }));
    store.set('esc-save', { s: snap, pid: me.pid, at: Date.now() }, sessionStorage);
    receive(snap);
  }

  function hostTick() {
    if (!S || role === 'guest' || S.phase !== 'play') return;
    const left = (S.endsAt - Date.now()) / 1000;
    if (left <= 0) { finish('timeout'); return sync(); }
    const total = P.d.minutes * 60, elapsed = total - left;
    if (S.scares < P.theme.scares.length && elapsed > (S.scares + 1) * total / (P.theme.scares.length + 2)) {
      emit('scare', { text: P.theme.scares[S.scares++] });
      sync();
    }
  }

  /* =================== 접속 =================== */
  function ask(action) {
    if (role === 'guest') net && net.send({ t: 'act', a: action });
    else apply(me.pid, action);
  }

  const latest = new Map(); // pid → 가장 최근 연결 (재접속 후 옛 연결의 종료 통지는 무시)
  const hostHandlers = {
    message(conn, msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'join') {
        const pid = String(msg.pid || '').slice(0, 20);
        if (!pid || pid === me.pid) return;
        if (!addPlayer(pid, msg.name)) { conn.send({ t: 'full' }); return; }
        conn.pid = pid; latest.set(pid, conn); sync();
      } else if (msg.t === 'act' && conn.pid) apply(conn.pid, msg.a);
    },
    leave(conn) {
      if (latest.get(conn.pid) !== conn) return;
      latest.delete(conn.pid);
      const p = S && S.players.find(x => x.pid === conn.pid);
      if (!p) return;
      p.on = false;
      if (S.phase === 'lobby') S.players = S.players.filter(x => x !== p);
      emit('toast', { text: `${p.name}님의 연결이 끊겼어요` });
      if (S.phase === 'accuse') resolveVotes();
      sync();
    },
  };

  async function createRoom(solo, saved) {
    window.Sound.unlock();
    if (!saved) {
      S = newState(solo ? '' : randomId(5), solo);
      S.players = []; lastEvent = 0;
    } else {
      S = saved;
      S.players.forEach(p => { p.on = p.pid === me.pid; });
      lastEvent = S.eseq;
      if (S.diff) P = window.Puzzles.build(S.theme, S.seed, S.diff);
      if (S.phase === 'play') S.endsAt = Date.now() + S.timeLeft * 1000;
    }
    role = solo ? 'solo' : 'host';
    addPlayer(me.pid, me.name);
    if (!solo) {
      overlay('<div class="spinner"></div><p>방을 여는 중…</p>');
      try {
        // 새로고침 직후에는 중계 서버가 이전 방 ID를 잠시 붙들고 있어 몇 번 다시 시도한다
        for (let attempt = 1; ; attempt++) {
          try { net = await window.Net.host(S.code, hostHandlers); break; }
          catch (e) {
            if (e.type !== 'unavailable-id' || attempt >= 5) throw e;
            await new Promise(r => setTimeout(r, 2500));
          }
        }
      } catch (e) { role = null; S = null; closeOverlay(); home(); return toast(e.message, 'bad'); }
      closeOverlay();
      history.replaceState(null, '', `?room=${S.code}`);
    }
    sync();
  }

  async function joinRoom(code) {
    window.Sound.unlock();
    overlay('<div class="spinner"></div><p>방에 들어가는 중…</p>');
    try {
      role = 'guest';
      net = await window.Net.join(code, {
        message(m) {
          if (m && m.t === 'state') { closeOverlay(); receive(m.s); }
          else if (m && m.t === 'full') { leave(); toast('방이 가득 찼어요', 'bad'); }
        },
        closed() {
          overlay('<h2>🔌 연결이 끊겼어요</h2><p>방장이 화면을 닫았거나 네트워크가 바뀌었어요.</p><button class="btn primary" data-act="rejoin" data-code="' + esc(code) + '">다시 접속</button><button class="btn" data-act="leave">처음으로</button>');
        },
      });
      store.set('esc-guest', code, sessionStorage);
      history.replaceState(null, '', `?room=${code}`);
      net.send({ t: 'join', pid: me.pid, name: me.name });
    } catch (e) {
      role = null; closeOverlay(); home(); toast(e.message, 'bad');
    }
  }

  function leave() {
    if (net) net.close();
    net = null; role = null; S = null; P = null; modal = null; input = {}; seenScreen = '';
    store.del('esc-save', sessionStorage); store.del('esc-guest', sessionStorage);
    history.replaceState(null, '', location.pathname);
    link = new URLSearchParams();
    window.Sound.ambient(false);
    closeOverlay(); home();
  }

  function receive(snap) {
    const prev = S;
    S = snap;
    if (S.diff && S.phase !== 'lobby') {
      if (!P || P.seed !== S.seed || P.theme.id !== S.theme || P.diffKey !== S.diff) { P = window.Puzzles.build(S.theme, S.seed, S.diff); input = {}; }
    }
    if (S.phase === 'play') endsAt = Date.now() + S.timeLeft * 1000;
    if (role === 'guest' && !prev) lastEvent = S.eseq;
    const fresh = S.events.filter(e => e.n > lastEvent);
    lastEvent = S.eseq;
    render();
    fresh.forEach(playEvent);
  }

  function playEvent(e) {
    if (e.type === 'solved') { window.Sound.play('ok'); toast(e.text, 'good'); }
    else if (e.type === 'wrong') { window.Sound.play('bad'); toast(e.text, 'bad'); shake(); }
    else if (e.type === 'secret') { window.Sound.play('find'); toast(e.text, 'gold'); openModal('secret', e.i); }
    else if (e.type === 'install') { window.Sound.play('door'); toast(e.text, 'good'); }
    else if (e.type === 'door') { window.Sound.play('door'); closeModal(); }
    else if (e.type === 'scare') { window.Sound.play('scare'); toast(e.text, 'scare'); flash(); }
    else if (e.type === 'chat') { if (e.from !== me.pid) { window.Sound.play('msg'); if (!modal || modal.kind !== 'chat') toast(e.text); } }
    else if (e.type === 'note') { if (e.from !== me.pid) { window.Sound.play('msg'); toast(e.text); } }
    else if (e.type === 'toast') toast(e.text);
  }

  /* =================== 화면 공통 =================== */
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'scare' ? 4500 : 2800);
  }
  function overlay(html) { $('#overlay').innerHTML = `<div class="card">${html}</div>`; $('#overlay').hidden = false; }
  function closeOverlay() { $('#overlay').hidden = true; }
  function shake() { app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(120); }
  function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); if (navigator.vibrate) navigator.vibrate([80, 60, 200]); }

  /* 코옵: 단서 조각을 접속자에게 나눠준다. 나간 사람 몫은 남은 사람에게 자동 재분배 */
  function mine(i) {
    const on = connected();
    if (on.length < 2) return true;
    const idx = on.findIndex(p => p.pid === me.pid);
    return idx < 0 || i % on.length === idx;
  }
  const holder = i => { const on = connected(); return on[i % on.length]; };

  function setTheme(id) {
    const t = window.THEMES.find(x => x.id === id) || window.THEMES[0];
    const r = document.documentElement.style;
    r.setProperty('--bg1', t.colors[0]); r.setProperty('--bg2', t.colors[1]); r.setProperty('--accent', t.colors[2]);
  }

  /* =================== 화면: 처음/대기실 =================== */
  function records() { return store.get('esc-records') || {}; }

  function themeCards(selected, enabled) {
    const rec = records();
    return `<div class="themes">${window.THEMES.map(t => `
      <button class="theme ${t.id === selected ? 'on' : ''}" data-act="theme" data-id="${t.id}" ${enabled ? '' : 'disabled'}>
        <span class="ticon">${t.icon}</span><b>${t.name}</b><small>${t.tag} · 1~${t.maxPlayers}인 · ${t.stages.length}단계 + 최종 추리</small>
        <p>${t.blurb}</p>
        <em>${rec[t.id] ? `🏆 최고 ${rec[t.id].rank}등급 ${rec[t.id].score}점` : '미클리어'}</em>
      </button>`).join('')}</div>`;
  }
  function diffPicker(selected, enabled) {
    const opts = [['auto', '인원 자동'], ['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']];
    return `<div class="seg">${opts.map(([k, n]) => `<button data-act="diff" data-id="${k}" class="${k === selected ? 'on' : ''}" ${enabled ? '' : 'disabled'}>${n}</button>`).join('')}</div>`;
  }
  function diffInfo(choice, n) {
    const D = window.Puzzles.DIFF, k = choice === 'auto' ? window.Puzzles.autoDiff(n) : choice, d = D[k];
    return `<p class="muted">${choice === 'auto' ? `현재 ${n}명 → ` : ''}<b>${d.label}</b> · ${d.minutes}분 · 힌트 ${d.hints}회 · 오답 −${d.wrong}초${d.mirror ? ' · 함정 규칙 추가' : ''}${n > 1 ? ' · 단서가 인원별로 나뉨' : ''}</p>`;
  }

  function home() {
    setTheme(sel.theme);
    const room = (link.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const name = `<label class="field">닉네임<input id="name" maxlength="10" placeholder="탐정" value="${esc(me.name)}" autocomplete="off"></label>`;
    if (room) {
      app.innerHTML = `<main class="page narrow"><h1>🔐 초대장 도착</h1>
        <p>방 코드 <b class="code">${esc(room)}</b>의 방탈출에 초대받았어요.</p>${name}
        <button class="btn primary big" data-act="join" data-code="${esc(room)}">입장하기</button>
        <button class="btn" data-act="leave">직접 새 게임 하기</button></main>`;
      return;
    }
    const day = new Date(), today = `D${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    app.innerHTML = `<main class="page">
      <header class="hero"><h1>🔐 잠긴 방의 증인</h1><p>단서를 모으고, 문을 열고, 범인을 지목하라.</p></header>
      ${sel.seed ? `<div class="banner">🎯 도전장을 받았어요! 같은 문제(<b>${esc(sel.seed)}</b>)로 겨룹니다.</div>` : ''}
      ${tierBadge()}
      <div class="row"><button class="btn" data-act="rank">🏆 팀 랭킹</button></div>
      ${name}
      <h2>1. 테마</h2>${themeCards(sel.theme, true)}
      <h2>2. 난이도</h2>${diffPicker(sel.diff, true)}${diffInfo(sel.diff, 1)}
      <h2>3. 시작</h2>
      <div class="row">
        <button class="btn primary big" data-act="solo">🕵️ 혼자 하기</button>
        <button class="btn primary big" data-act="host">👥 친구 초대 (최대 ${maxPlayers(sel.theme)}명)</button>
      </div>
      <div class="row">
        <button class="btn" data-act="daily" data-seed="${today}">📅 오늘의 사건 (혼자)</button>
        <input id="code" maxlength="5" placeholder="방 코드" autocomplete="off"><button class="btn" data-act="joincode">코드로 입장</button>
      </div>
      <details><summary>게임 방법</summary><ul>
        <li>방 안의 물건을 눌러 단서를 찾고 자물쇠를 푸세요.</li>
        <li>단계마다 <b>관찰 증거</b>를 얻고, 남는 용의자를 추리해야 다음 방이 열립니다.</li>
        <li>마지막에는 범인을 단 한 번 지목한 뒤, 반박을 증거로 깨야 합니다.</li>
        <li>힌트는 팀 전체가 <b>3번</b>까지 쓸 수 있습니다.</li>
        <li><b>📝 메모</b>에 단서를 담고 용의자를 표시하세요. 팀 메모로 공유할 수도 있어요.</li>
        <li>함께 하면 단서가 사람마다 나뉘어 보여요. 말하거나 채팅으로 알려주세요.</li>
        <li>방마다 숨겨진 수집품이 하나씩 있어요. 모두 찾고 범인을 맞히면 <b>진엔딩</b>.</li>
      </ul></details></main>`;
  }

  function inviteUrl() {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const base = local && lanBase ? lanBase : location.origin + location.pathname;
    return `${base}?room=${S.code}`;
  }

  function lobby() {
    const host = role !== 'guest', n = connected().length;
    const url = inviteUrl();
    const localOnly = /^(file:|https?:\/\/(localhost|127\.0\.0\.1|\[::1\]))/.test(url);
    app.innerHTML = `<main class="page">
      <div class="top"><button class="btn small" data-act="leave">← 나가기</button><h1>대기실</h1></div>
      ${S.solo ? '' : `<section class="panel invite">
        <div>방 코드 <b class="code big">${esc(S.code)}</b></div>
        <input class="link" readonly value="${esc(url)}">
        <div class="row"><button class="btn primary" data-act="copy">🔗 링크 복사</button>${navigator.share ? '<button class="btn" data-act="share">📤 공유하기</button>' : ''}</div>
        ${localOnly ? '<p class="warn">⚠️ 이 주소는 이 컴퓨터에서만 열려요. <code>serve.py</code>로 실행하거나 웹에 올려야 친구가 접속할 수 있어요.</p>' : ''}
      </section>`}
      <section class="panel"><h2>참가자 ${n}/${maxPlayers(S.theme)}</h2>
        <div class="chips">${connected().map(p => `<span class="chip">${p.av} ${esc(p.name)}${p.host ? ' 👑' : ''}${p.pid === me.pid ? ' (나)' : ''}</span>`).join('')}</div></section>
      <section class="panel">${host
        ? `<label class="field">팀 이름 (랭킹에 표시)<input id="teamname" maxlength="12" placeholder="${esc((connected().find(p => p.host) || {}).name || '우리')}팀" value="${esc(S.team)}" autocomplete="off"></label>`
        : `<p class="center">팀: <b>${esc(S.team || '(방장이 정하는 중)')}</b></p>`}
        ${S.ranked ? '<p class="muted center">🏆 랭크전 — 성공하면 팀 랭킹에 기록됩니다.</p>' : '<p class="warn center">도전장·오늘의 사건은 문제가 고정되어 랭킹에 기록되지 않아요.</p>'}
        <div class="row"><button class="btn small" data-act="rank">🏆 랭킹 보기</button></div></section>
      <h2>테마${host ? '' : ' (방장이 선택)'}</h2>${themeCards(S.theme, host)}
      <h2>난이도</h2>${diffPicker(S.diffChoice, host)}${diffInfo(S.diffChoice, n)}
      ${host ? '<button class="btn primary big" data-act="start">▶ 게임 시작</button>' : '<p class="muted center">방장이 시작하기를 기다리는 중…</p>'}
      ${S.solo ? '' : chatBox()}
    </main>`;
  }

  function story(lines, buttons, title) {
    app.innerHTML = `<div class="storybg">${window.Scenes.draw(S.theme, 0)}</div><main class="page story">${title ? `<h1>${title}</h1>` : ''}
      ${lines.map((l, i) => `<p class="line" style="animation-delay:${i * 1.1}s">${l}</p>`).join('')}
      <div class="line" style="animation-delay:${lines.length * 1.1}s">${buttons}</div></main>`;
  }

  function tierBadge() {
    const c = window.Rank.career();
    return `<div class="banner">${c.icon} <b>${c.name}</b> · ${c.total.toLocaleString()}P ${c.next ? `<span class="muted">(${c.next.name}까지 ${c.next.need.toLocaleString()}P)</span>` : ''}</div>`;
  }

  let boardCache = {};
  function boardHtml(theme, diff) {
    const key = `${theme}_${diff}`;
    const data = boardCache[key];
    if (!data) {
      boardCache[key] = { loading: true };
      window.Rank.list(theme, diff).then(res => {
        boardCache[key] = res;
        if (modal && modal.kind === 'rank') drawModal();
        if (S && S.phase === 'end') render();
      });
    }
    if (!data || data.loading) return '<div class="spinner"></div>';
    const scope = { online: '🌐 온라인 전체 랭킹', server: '🖥 이 게임 서버의 랭킹', local: '📱 이 기기에만 저장된 기록' }[data.scope];
    const rows = data.list.map((e, i) => `<tr class="${S && e.id === S.gameId ? 'mine' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(e.team)}${e.perfect ? ' ✨' : ''}</td><td>${Number(e.players) || 1}명</td><td>${Math.floor(e.seconds / 60)}:${String(Math.floor(e.seconds % 60)).padStart(2, '0')}</td><td><b>${Number(e.score) || 0}</b></td></tr>`).join('');
    return `<p class="muted">${scope}</p>${rows ? `<table class="board"><thead><tr><th>#</th><th>팀</th><th>인원</th><th>시간</th><th>점수</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>아직 기록이 없어요. 첫 팀이 되어 보세요!</p>'}`;
  }

  /* =================== 화면: 플레이 =================== */
  const SLOTS = [[18, 22], [50, 18], [82, 22], [20, 50], [50, 47], [80, 50], [22, 79], [52, 78], [80, 80]];

  function hotspots() {
    const st = P.stages[S.stage];
    const list = [];
    st.puzzles.forEach(id => {
      const z = P.puzzles[id];
      list.push({ icon: z.lock[0], name: z.lock[1], act: 'puzzle', id, solved: !!S.solved[id], lock: true, broken: needsPart(z) });
      z.clues.forEach((c, i) => list.push({ icon: c[0], name: c[1], act: 'clue', id, i }));
    });
    st.decor.forEach((d, i) => list.push({ icon: d[0], name: d[1], act: 'decor', i }));
    const order = SLOTS.map((_, i) => i);
    const r = window.Puzzles.rngFrom(`${S.seed}|layout|${S.stage}`);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return list.slice(0, SLOTS.length).map((h, k) => Object.assign(h, { pos: SLOTS[order[k]] }));
  }

  function play() {
    const st = P.stages[S.stage];
    const dz = st.puzzles.map(id => P.puzzles[id]).find(z => z.dark);
    const dark = st.dark && !S.solved[dz.id];
    let marks = '';
    if (dz && !S.solved[dz.id]) {
      marks = dz.marks.map((m, k) => mine(k) ? `<div class="mark ${m.fake ? 'fake' : ''}" style="left:${m.x}%;top:${m.y}%">${m.s}<i>${'•'.repeat(m.order)}</i></div>` : '').join('');
    }
    app.innerHTML = `<div class="game">
      <header class="hud">
        <button class="btn small" data-act="menu" aria-label="메뉴">☰</button>
        <div class="stagebar">${P.stages.map((s, i) => `<span class="${i < S.stage ? 'done' : i === S.stage ? 'now' : ''}">${i + 1}</span>`).join('')}<span>⚖</span></div>
        <div id="timer" class="timer">--:--</div>
        <button class="btn small" data-act="memo" aria-label="메모">📝<span class="bt"> 메모</span></button>
        <button class="btn small" data-act="notes" aria-label="수첩">📓<span class="bt"> 수첩</span></button>
        ${S.solo ? '' : '<button class="btn small" data-act="chat">💬</button>'}
      </header>
      <div class="stagename"><b>${st.name}</b> <span>${st.msg}</span></div>
      <div class="scene ${dark ? 'dark' : ''}">
        ${window.Scenes.draw(S.theme, S.stage)}
        ${marks}
        ${hotspots().map(h => `<button class="spot ${h.lock ? 'lock' : ''} ${h.solved ? 'solved' : ''}" style="left:${h.pos[0]}%;top:${h.pos[1]}%" data-act="${h.act}" data-id="${h.id || ''}" data-i="${h.i === undefined ? '' : h.i}">
          <span class="ico">${h.icon}</span><span class="lbl">${h.solved ? '✔ ' : h.broken ? '⚙️ ' : h.lock ? '🔒 ' : ''}${h.name}</span></button>`).join('')}
        ${dark ? '<div class="torch"></div>' : ''}
      </div>
      <div class="inventory">${hasPart(S.stage) ? `<button class="item" data-act="item">${partOf(S.stage)[0]} ${partOf(S.stage)[1]}</button>` : '<span>🎒 가진 물건 없음</span>'}</div>
      <footer class="foot">💡 힌트 ${S.hintsLeft} · ✨ ${P.theme.secretName} ${Object.keys(S.found).length}/${P.stages.length} · 난이도 ${P.d.label}
        ${connected().length > 1 ? ` · ${connected().map(p => `<span title="${esc(p.name)}">${p.av}</span>`).join('')}` : ''}</footer>
      ${S.cleared === S.stage ? clearPanel() : ''}
    </div>`;
    paintTimer();
  }

  const evidenceText = i => `<b>${P.theme.evidence[i][0]}</b> — ${P.theme.obs[i][P.truth[i] ? 0 : 1]}`;
  const pinBtn = html => `<button class="pin" data-act="pin" data-v="${esc(plain(html))}" title="메모에 담기">📌 담기</button>`;
  const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim(); };
  const conclusion = i => `<mark>${P.theme.traits[i][P.truth[i] ? 1 : 2]}</mark>`;
  const testimony = k => `<ul class="clues">${P.suspects.map(s => `<li>${s.face} <b>${s.name}</b> ${window.STORY[S.theme].statements[s.id][k]}</li>`).join('')}</ul>`;

  function clearPanel() {
    const k = S.stage, last = k === P.stages.length - 1;
    const canGo = last || S.deduced;
    const deduction = last
      ? '<p class="muted">이 증거까지 합쳐, 최종 지목에서 범인을 가려내세요.</p>'
      : S.deduced
        ? `<p class="good">✔ 추리 성공! 범인의 특징: ${conclusion(k)}</p>`
        : `<h3>🧠 추리: 지금까지의 증거에 <u>모두</u> 맞는 사람을 전부 고르세요</h3>
          <ul class="clues">${Array.from({ length: k + 1 }, (_, i) => `<li>${evidenceText(i)}${i < k ? ' ' + conclusion(i) : ''}</li>`).join('')}</ul>
          <div class="suspects">${P.suspects.map(s => `<button class="suspect ${S.picks.includes(s.id) ? 'picked' : ''}" data-act="pick" data-id="${s.id}">
            <span class="face">${s.face}</span><b>${s.name}</b><small>${s.traits.map((v, t) => P.theme.traits[t][v ? 1 : 2]).join('<br>')}</small></button>`).join('')}</div>
          ${S.deduceHint ? `<p class="warn">💡 이번 증거가 뜻하는 것: ${conclusion(k)}</p>` : S.hintsLeft > 0 ? `<button class="btn small" data-act="deduceHint">💡 증거 해석 힌트 (남은 ${S.hintsLeft})</button>` : ''}
          <button class="btn primary" data-act="deduce" ${S.picks.length ? '' : 'disabled'}>추리 확정 (${S.picks.length}명)</button>`;
    return `<div class="clear ${collapsed ? 'min' : ''}"><div class="card">
      <h2>🚪 ${P.stages[k].name} 돌파!</h2>
      <button class="btn small" data-act="memo">📝 메모 열기</button>
      ${canGo ? `<p class="muted">새 증거</p><p>${evidenceText(k)} ${pinBtn(evidenceText(k))}</p>` : ''}
      ${deduction}
      <details><summary>🗣 이 방에 대한 용의자들의 진술</summary>${testimony(k)}</details>
      ${S.found[k] ? '' : `<p class="warn">이 방의 ${P.theme.secretName}을(를) 아직 못 찾았어요. 다음 방으로 가면 돌아올 수 없습니다.</p>`}
      <button class="btn" data-act="peek">${collapsed ? '🧠 추리 창 열기' : '🔍 방 둘러보기'}</button>
      ${!canGo ? '' : role === 'guest' ? '<p class="muted">방장이 문을 열기를 기다리는 중…</p>' : `<button class="btn primary big" data-act="next">${last ? '⚖ 최종 추리로' : '다음 방으로 →'}</button>`}
    </div></div>`;
  }

  function proof() {
    const target = P.suspects.find(s => s.id === P.proof[S.proofStep].who);
    const culprit = P.suspects.find(s => s.id === P.culprit);
    app.innerHTML = `<main class="page narrow center">
      <h1>⚖ 반박 ${S.proofStep + 1}/${P.proof.length}</h1>
      <p class="ending">${culprit.face} <b>${culprit.name}</b>: “잠깐, ${target.face} <b>${target.name}</b>일 수도 있잖아요?”</p>
      <p class="muted">${target.name} — ${target.traits.map((v, t) => P.theme.traits[t][v ? 1 : 2]).join(' · ')}</p>
      <p><b>${target.name}</b>의 결백을 증명하는 증거를 제시하세요.</p>
      ${P.stages.map((_, i) => `<button class="btn" data-act="prove" data-id="${i}">${evidenceText(i)}</button>`).join('')}
      ${S.solo ? '' : chatBox()}</main>`;
  }

  function suspectCards(voting) {
    return `<div class="suspects">${P.suspects.map(s => {
      const voters = connected().filter(p => S.votes[p.pid] === s.id);
      return `<div class="suspect"><span class="face">${s.face}</span><b>${s.name}</b><small>${s.role}</small>
        <ul>${s.traits.map((v, k) => `<li>${P.theme.traits[k][v ? 1 : 2]}</li>`).join('')}</ul>
        <p>${s.quote}</p>
        ${voting ? `<button class="btn ${S.votes[me.pid] === s.id ? 'primary' : ''}" data-act="vote" data-id="${s.id}">지목</button><div>${voters.map(p => p.av).join('')}</div>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function accuse() {
    app.innerHTML = `<main class="page"><div class="twist">${P.theme.twist.map((l, i) => `<p class="line" style="animation-delay:${S.votes[me.pid] || seenScreen === 'accuse' ? 0 : i * 1.2}s">${l}</p>`).join('')}</div>
      <section class="panel"><h2>확보한 증거</h2><ol>${P.stages.map((_, i) => `<li>${evidenceText(i)}${i < P.stages.length - 1 ? ' ' + conclusion(i) : ''}</li>`).join('')}</ol></section>
      <div class="row"><button class="btn small" data-act="memo">📝 메모 보기</button></div>
      <h2>범인은 누구인가? <small>기회는 한 번뿐</small></h2>${suspectCards(true)}
      ${S.solo ? '' : `<p class="muted center">모두 지목하면 다수결로 결정됩니다. (동점이면 방장의 선택) ${Object.keys(S.votes).length}/${connected().length}</p>${chatBox()}`}</main>`;
  }

  function end() {
    const pts = S.points, rank = S.letter, secrets = Object.keys(S.found).length, won = S.result === 'good' || S.result === 'true';
    if (won && S.ranked) { window.Rank.addCareer(S.gameId, pts); recordPersonal(); }
    const used = P.d.minutes * 60 - Math.round(S.timeLeft);
    const culprit = P.suspects.find(s => s.id === P.culprit);
    const accused = P.suspects.find(s => s.id === S.accused);
    const badges = [
      won && S.hintsUsed === 0 && ['🧠', '힌트 없는 천재'], won && S.wrong === 0 && ['🎯', '무결점 추리'],
      secrets === P.stages.length && ['✨', '수집가'], won && used < P.d.minutes * 30 && ['⚡', '번개 탈출'],
      won && S.diff === 'hard' && ['🔥', '어려움 정복'], won && connected().length >= 3 && ['🤝', '환상의 팀워크'],
    ].filter(Boolean);
    const rec = records();
    if (won && (!rec[S.theme] || rec[S.theme].score < pts)) { rec[S.theme] = { score: pts, rank }; store.set('esc-records', rec); }
    const title = { true: '🌟 진엔딩', good: '🎉 탈출 성공', bad: '💀 오판', timeout: '⌛ 시간 초과' }[S.result];
    const text = S.result === 'true' ? P.theme.trueEnd : S.result === 'good' ? P.theme.good : S.result === 'bad' ? P.theme.bad : '모든 불이 꺼졌다. 당신은 끝내 방을 나가지 못했다.';
    app.innerHTML = `<main class="page narrow center">
      <h1>${title}</h1><p class="ending">${text}</p>
      ${accused ? `<p>지목: ${accused.face} <b>${accused.name}</b> ${won ? '— 정답!' : ''}</p>` : ''}
      ${won ? `<p>진범: ${culprit.face} <b>${culprit.name}</b></p>` : '<p class="muted">진범은 밝혀지지 않았다. 다시 도전해 보세요.</p>'}
      ${won ? `<section class="panel casefile"><h2>📁 사건의 전말</h2>
        <p><b>수법</b> ${window.STORY[S.theme].method}</p>
        <p><b>동기</b> ${window.STORY[S.theme].motives[culprit.id]}</p>
        <p><b>결정적 증거</b></p><ol>${P.stages.map((_, i) => `<li>${evidenceText(i)} → ${conclusion(i)}</li>`).join('')}</ol></section>` : ''}
      <div class="rank r${rank}">${rank}</div><p><b>${pts}점</b> · ${Math.floor(used / 60)}분 ${used % 60}초 · 힌트 ${S.hintsUsed} · 오답 ${S.wrong} · 수집 ${secrets}/${P.stages.length}</p>
      <div class="chips">${badges.map(b => `<span class="chip">${b[0]} ${b[1]}</span>`).join('')}</div>
      ${won && secrets < P.stages.length ? `<p class="warn">숨겨진 ${P.theme.secretName} ${P.stages.length}개를 모두 찾으면 다른 결말이…</p>` : ''}
      ${S.ranked ? `<p class="muted">난이도 가중치 ×${window.Rank.WEIGHT[S.diff]}</p>` : '<p class="muted">고정 문제라 랭킹에는 기록되지 않았어요.</p>'}
      ${tierBadge()}
      <div class="row"><button class="btn" data-act="rank">🏅 팀·개인 랭킹</button></div>
      <section class="panel"><h2>🏆 ${P.theme.name} · ${P.d.label}</h2>${boardHtml(S.theme, S.diff)}</section>
      <button class="btn primary" data-act="challenge">📨 친구에게 도전장 보내기</button>
      ${role === 'guest' ? '<p class="muted">방장이 다시 시작할 수 있어요.</p>' : '<button class="btn" data-act="lobby">🔁 새 사건</button>'}
      <button class="btn" data-act="leave">처음으로</button></main>`;
  }

  function titleCard(title, sub) {
    document.querySelectorAll('.titlecard').forEach(e => e.remove());
    const el = document.createElement('div');
    el.className = 'titlecard';
    el.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function render() {
    if (!S) return home();
    setTheme(S.theme);
    const screen = S.phase === 'play' ? 'play' + S.stage : S.phase;
    const changed = screen !== seenScreen;
    if (changed) { closeModal(); collapsed = false; window.scrollTo(0, 0); window.Sound.ambient(['play', 'accuse', 'proof'].includes(S.phase)); boardCache = {}; }
    // 입력 중이던 글자와 커서를 보존
    const focused = document.activeElement && ['chatin', 'teamname'].includes(document.activeElement.id) ? document.activeElement.id : null;
    const typed = focused ? document.getElementById(focused).value : null;

    if (S.phase === 'lobby') lobby();
    else if (S.phase === 'intro') {
      if (changed) story(P.theme.intro, role === 'guest' ? '<p class="muted">방장이 시작하면 타이머가 흐릅니다.</p>' : '<button class="btn primary big" data-act="begin">⏱ 타이머 시작</button>', `${P.theme.icon} ${P.theme.name}`);
    } else if (S.phase === 'play') play();
    else if (S.phase === 'accuse') accuse();
    else if (S.phase === 'proof') proof();
    else if (S.phase === 'end') end();
    seenScreen = screen;
    // 메모를 쓰는 중에는 창을 다시 그리지 않는다 (한글 입력이 끊기지 않게)
    if (modal && !(modal.kind === 'memo' && ['memo', 'noteinput'].includes((document.activeElement || {}).id))) drawModal();
    if (changed && S.phase === 'play') titleCard(P.stages[S.stage].name, P.stages[S.stage].msg);
    const again = focused && document.getElementById(focused);
    if (again) { again.value = typed; again.focus(); }
  }

  /* =================== 모달 =================== */
  function openModal(kind, id, i) { modal = { kind, id, i }; drawModal(); }
  function closeModal() { modal = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  function pieces(z, idx) {
    return `<ul class="clues">${z.pieces[idx].map((line, k) => mine(k + idx)
      ? `<li>${line} ${pinBtn(line)}</li>`
      : `<li class="hidden-piece">🔒 ${holder(k + idx).av} ${esc(holder(k + idx).name)}님에게만 보이는 단서</li>`).join('')}</ul>`;
  }

  function puzzleBody(z) {
    const v = input[z.id] || (input[z.id] = []);
    const btn = (act, d, label, cls = '') => `<button class="key ${cls}" data-act="${act}" data-id="${z.id}" data-v="${esc(d)}">${label}</button>`;
    const controls = `<div class="row"><button class="btn" data-act="clear" data-id="${z.id}">지우기</button><button class="btn primary" data-act="submit" data-id="${z.id}">확인</button></div>`;
    const display = (n, f = x => x) => `<div class="display">${Array.from({ length: n }, (_, i) => `<span>${v[i] === undefined ? '·' : esc(f(v[i]))}</span>`).join('')}</div>`;
    switch (z.input) {
      case 'digits': return `${z.type === 'mastermind' || z.type === 'equations' ? '<p class="muted">이 방의 기록을 찾아 암호를 알아내세요.</p>' : ''}${display(z.length)}<div class="keys c3">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => btn('key', n, n)).join('')}</div>${controls}`;
      case 'symbols': return `<p class="muted">${connected().length > 1 ? '기호는 사람마다 다르게 보여요. 서로 알려주세요.' : '방 안을 손전등으로 비춰 보세요.'}</p><p class="warn">${z.note}</p>${display(z.length)}<div class="keys c3">${z.keypad.map(s => btn('key', s, s)).join('')}</div>${controls}`;
      case 'direction': return `${display(z.length)}<div class="dpad">${['↑', '←', '↓', '→'].map(a => btn('key', a, a, 'd' + '↑←↓→'.indexOf(a))).join('')}</div>${controls}`;
      case 'cipher': return `${display(z.length)}<div class="keys c5">${z.grid.map(s => btn('key', s, s)).join('')}</div><p class="muted">왼쪽 위가 1행 1열</p>${controls}`;
      case 'clock': {
        if (!v.length) v.push(12, 0);
        const [h, m] = v;
        return `<div class="clockface"><i class="hh" style="transform:rotate(${(h % 12) * 30 + m / 2}deg)"></i><i class="mh" style="transform:rotate(${m * 6}deg)"></i></div>
          <div class="stepper">${btn('hour', -1, '−')}<b>${h}시</b>${btn('hour', 1, '+')}</div>
          <div class="stepper">${btn('min', -5, '−')}<b>${String(m).padStart(2, '0')}분</b>${btn('min', 5, '+')}</div>
          <button class="btn primary" data-act="submit" data-id="${z.id}">시각 맞추기</button>`;
      }
      case 'order': return `<p class="muted">작동시킬 순서대로 누르세요.</p>${display(z.labels.length, i => z.labels[i])}<div class="keys c2">${z.labels.map((l, i) => btn('key', i, l, v.includes(i) ? 'used' : '')).join('')}</div>${controls}`;
      case 'lights': return `<p class="muted">모든 전등을 켜세요. 누르면 이웃도 함께 바뀝니다.</p><div class="keys c${Math.sqrt(S.lights[z.id].length)} bulbs">${S.lights[z.id].map((on, i) => btn('light', i, on ? '💡' : '⚫', on ? 'lit' : '')).join('')}</div><button class="btn" data-act="lightReset" data-id="${z.id}">↺ 초기화</button>`;
      case 'simon': return `${z.note ? `<p class="warn">${z.note}</p>` : ''}<button class="btn" data-act="replay" data-id="${z.id}">▶ 순서 재생 (${z.seq.length}음)</button>${display(z.length || z.seq.length, i => i + 1)}<div class="keys c2 pads">${[0, 1, 2, 3].map(i => btn('pad', i, i + 1, 'pad p' + i)).join('')}</div>`;
      case 'boxes': return `${pieces(z, 0)}<p><b>참인 문장은 정확히 ${z.truths}개다.</b> 열쇠가 든 상자를 고르시오.</p><div class="keys c${z.names.length > 3 ? 5 : 3}">${z.names.map((n, i) => btn('box', i, '📦<br>' + n)).join('')}</div>`;
    }
    return '';
  }

  function drawModal() {
    if (!modal) return;
    let html = '';
    const { kind, id, i } = modal;
    if (kind === 'puzzle' || kind === 'clue') {
      const z = P && P.puzzles[id];
      if (!z || S.phase !== 'play' || z.stage !== S.stage) return closeModal();
      if (kind === 'clue') html = `<h2>${z.clues[i][0]} ${z.clues[i][1]}</h2>${pieces(z, i)}<p class="muted">어딘가의 자물쇠와 연결되는 것 같다…</p>`;
      else if (S.solved[id]) html = `<h2>${z.lock[0]} ${z.lock[1]}</h2><p class="good">✔ 이미 해결했습니다.</p>`;
      else if (needsPart(z)) {
        const part = partOf(z.stage);
        html = `<h2>${z.lock[0]} ${z.lock[1]}</h2><p>장치의 한 부분이 비어 있어 움직이지 않는다.</p><div class="socket">?</div>
          ${hasPart(z.stage) ? `<button class="btn primary" data-act="install">${part[0]} 「${part[1]}」 끼우기</button>` : '<p class="muted">이 방 어딘가의 다른 장치에 부품이 있을 것 같다.</p>'}`;
      } else {
        const got = S.hints[id] || 0;
        html = `<h2>${z.lock[0]} ${z.lock[1]}</h2>${puzzleBody(z)}
          <div class="hints">${z.hints.slice(0, got).map(h => `<p>💡 ${h}</p>`).join('')}
          ${got < z.hints.length && S.hintsLeft > 0 ? `<button class="btn small" data-act="hint" data-id="${id}">💡 ${got ? '정답 보기' : '힌트'} (남은 ${S.hintsLeft})</button>` : ''}</div>`;
      }
    } else if (kind === 'item') {
      if (!S || !hasPart(S.stage)) return closeModal();
      const part = partOf(S.stage);
      html = `<h2>${part[1]}</h2><div class="bigicon">${part[0]}</div><p>${part[2]}</p><p class="muted">⚙️ 표시가 있는 장치를 열어 끼워 보세요.</p>`;
    } else if (kind === 'text') html = `<h2>${esc(id)}</h2><p>${esc(i)}</p>`;
    else if (kind === 'secret') html = `<h2>✨ ${P.theme.secretName} (${Number(id) + 1}/${P.stages.length})</h2><p class="paper">${P.theme.secrets[id]}</p>`;
    else if (kind === 'notes') {
      html = `<h2>📓 수사 수첩</h2><h3>증거</h3><ul>${P.stages.map((_, k) => `<li>${S.stage > k ? evidenceText(k) + ' ' + conclusion(k) : S.cleared === k ? evidenceText(k) + (S.deduced ? ' ' + conclusion(k) : '') : '??? — 아직 확보하지 못함'}</li>`).join('')}</ul>
        <h3>용의자</h3>${suspectCards(false)}
        <h3>🗣 심문 기록</h3>${P.stages.map((st, k) => S.stage > k || S.cleared === k ? `<h4>${st.name}</h4>${testimony(k)}` : '').join('') || '<p class="muted">방을 돌파하면 진술이 쌓입니다.</p>'}
        <h3>${P.theme.secretName}</h3><ul>${P.theme.secrets.map((s, k) => `<li>${S.found[k] ? s : '???'}</li>`).join('')}</ul>`;
    } else if (kind === 'rank') {
      const D = window.Puzzles.DIFF;
      const tabs = `<div class="seg two"><button data-act="rankView" data-v="team" class="${rankView === 'team' ? 'on' : ''}">👥 팀 랭킹</button><button data-act="rankView" data-v="me" class="${rankView === 'me' ? 'on' : ''}">🙋 개인 랭킹</button></div>`;
      html = rankView === 'me' ? `<h2>🏅 개인 랭킹</h2>${tabs}<p class="muted">성공한 랭크전 점수를 사람별로 모두 더한 순위</p>${playerHtml()}` : `<h2>🏆 팀 랭킹</h2>${tabs}
        <div class="row">${window.THEMES.map(t => `<button class="btn small ${t.id === id ? 'primary' : ''}" data-act="rankTab" data-id="${t.id}" data-v="${i}">${t.icon} ${t.name}</button>`).join('')}</div>
        <div class="row">${Object.keys(D).map(k => `<button class="btn small ${k === i ? 'primary' : ''}" data-act="rankTab" data-id="${id}" data-v="${k}">${D[k].label} ×${window.Rank.WEIGHT[k]}</button>`).join('')}</div>
        ${boardHtml(id, i)}`;
    } else if (kind === 'memo') html = memoHtml();
    else if (kind === 'chat') html = `<h2>💬 팀 채팅</h2>${chatBox()}`;
    else if (kind === 'menu') {
      html = `<h2>메뉴</h2>${S.solo ? '' : `<p>방 코드 <b class="code">${esc(S.code)}</b></p><button class="btn" data-act="copy">🔗 초대 링크 복사</button>`}
        <button class="btn" data-act="mute">${window.Sound.muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'}</button>
        <button class="btn danger" data-act="quit">게임 나가기</button>`;
    } else if (kind === 'quit') {
      html = `<h2>정말 나갈까요?</h2><p>${role === 'host' ? '방장이 나가면 모두의 게임이 끝납니다.' : '진행 상황이 사라질 수 있어요.'}</p><button class="btn danger" data-act="leave">나가기</button>`;
    }
    const el = $('#modal');
    const old = el.querySelector('.card');
    const scroll = old ? old.scrollTop : 0;
    const act = document.activeElement && el.contains(document.activeElement) && ['chatin', 'memo', 'noteinput'].includes(document.activeElement.id) ? document.activeElement : null;
    const keep = act && { id: act.id, value: act.value, at: act.selectionStart };
    el.innerHTML = `<div class="card"><button class="x" data-act="close" aria-label="닫기">✕</button>${html}</div>`;
    el.hidden = false;
    el.querySelector('.card').scrollTop = scroll;
    const back = keep && el.querySelector('#' + keep.id);
    if (back) { back.value = keep.value; back.focus(); back.setSelectionRange(keep.at, keep.at); }
  }

  /* ---------- 메모장: 개인 메모는 이 기기에, 팀 메모는 게임 상태에 ---------- */
  const memoKey = () => `esc-memo-${S.gameId}`;
  const memo = () => Object.assign({ text: '', pins: [], marks: {} }, store.get(memoKey()));
  const saveMemo = m => store.set(memoKey(), m);
  const MARKS = ['❔', '✅ 유력', '❌ 제외', '👀 의심'];

  function addPin(text) {
    if (!S || !S.gameId) return;
    const m = memo();
    if (m.pins.some(p => p.text === text)) return toast('이미 담은 단서예요');
    m.pins.push({ text, where: P.stages[S.stage].name });
    saveMemo(m); toast('📌 메모에 담았어요', 'good');
  }

  function memoHtml() {
    if (!S || !S.gameId) return '<p>게임을 시작하면 메모를 쓸 수 있어요.</p>';
    const m = memo(), team = !S.solo;
    return `<h2>📝 단서 메모장</h2>
      <h3>자유 메모 <small class="muted">나만 보임 · 자동 저장</small></h3>
      <textarea id="memo" rows="5" maxlength="2000" placeholder="숫자, 순서, 추리한 내용을 적어 두세요">${esc(m.text)}</textarea>
      ${team ? '<button class="btn small" data-act="shareMemo">📤 자유 메모를 팀에 공유</button>' : ''}
      <h3>담은 단서 (${m.pins.length})</h3>
      <ul class="clues">${m.pins.map((p, i) => `<li><small class="muted">${esc(p.where)}</small><br>${esc(p.text)}<br>${team ? `<button class="pin" data-act="sharePin" data-i="${i}">📤 팀에 공유</button>` : ''}<button class="pin" data-act="unpin" data-i="${i}">🗑 지우기</button></li>`).join('') || '<li class="muted">단서 옆의 📌 담기를 누르면 여기에 모여요.</li>'}</ul>
      <h3>용의자 표시 <small class="muted">누를 때마다 바뀜</small></h3>
      <div class="marks">${P.suspects.map(s => `<button class="btn small" data-act="mark" data-id="${s.id}">${s.face} ${s.name}<br>${MARKS[m.marks[s.id] || 0]}</button>`).join('')}</div>
      ${team ? `<h3>👥 팀 메모</h3><ul class="clues">${S.board.map(n => `<li><b>${esc(n.who)}</b> ${esc(n.text)} ${n.pid === me.pid || role === 'host' ? `<button class="pin" data-act="noteDel" data-i="${n.n}">🗑</button>` : ''}</li>`).join('') || '<li class="muted">아직 공유한 메모가 없어요.</li>'}</ul>
        <form class="noteform"><input id="noteinput" maxlength="200" placeholder="팀에게 남길 메모" autocomplete="off"><button class="btn">공유</button></form>` : ''}`;
  }

  /* ---------- 개인 랭킹 ---------- */
  let rankView = 'team', playerCache = null;
  function recordPersonal() {
    const sent = store.get('esc-sent') || [];
    if (sent.includes(S.gameId) || !S.players.some(p => p.pid === me.pid)) return;
    store.set('esc-sent', sent.concat(S.gameId).slice(-100));
    window.Rank.submitPlayer({ id: `${me.uid}_${S.gameId}`, uid: me.uid, name: me.name || '탐정', theme: S.theme, diff: S.diff, score: S.points, at: Date.now() })
      .then(() => { playerCache = null; if (modal && modal.kind === 'rank') drawModal(); });
  }
  function playerHtml() {
    if (!playerCache) {
      playerCache = { loading: true };
      window.Rank.players().then(res => { playerCache = res; if (modal && modal.kind === 'rank') drawModal(); });
    }
    if (playerCache.loading) return '<div class="spinner"></div>';
    const scope = { online: '🌐 온라인 전체 랭킹', server: '🖥 이 게임 서버의 랭킹', local: '📱 이 기기에만 저장된 기록' }[playerCache.scope];
    const rows = playerCache.list.map((e, i) => `<tr class="${e.uid === me.uid ? 'mine' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${window.Rank.tier(e.total).icon} ${esc(e.name)}</td><td>${e.games}회</td><td>${e.best}</td><td><b>${e.total}</b></td></tr>`).join('');
    return `<p class="muted">${scope}</p>${rows ? `<table class="board"><thead><tr><th>#</th><th>이름</th><th>성공</th><th>최고</th><th>누적</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>아직 기록이 없어요.</p>'}`;
  }

  function chatBox() {
    return `<div class="chat"><div class="log">${S.chat.slice(-12).map(m => `<p><b>${esc(m.who)}</b> ${esc(m.text)}</p>`).join('') || '<p class="muted">아직 대화가 없어요.</p>'}</div>
      <div class="quick">${['여기 봐!', '내 단서 말해줄게', '도와줘', '정답 알 것 같아', '👍'].map(q => `<button class="chip" data-act="quick" data-v="${q}">${q}</button>`).join('')}</div>
      <form class="chatform"><input id="chatin" maxlength="120" placeholder="메시지" autocomplete="off"><button class="btn">전송</button></form></div>`;
  }

  let simonBusy = false;
  function replay(z) {
    if (simonBusy) return;
    simonBusy = true; input[z.id] = []; drawModal();
    z.seq.forEach((n, k) => setTimeout(() => {
      window.Sound.pad(n);
      const el = $(`.pad.p${n}`);
      if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 330); }
    }, k * 600));
    setTimeout(() => { simonBusy = false; }, z.seq.length * 600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove();
      if (!ok) return openModal('text', '직접 복사해 주세요', text);
    }
    toast('복사했어요!', 'good');
  }

  /* =================== 입력 =================== */
  function readName() {
    const el = $('#name');
    if (el) { me.name = el.value.trim().slice(0, 10); store.set('esc-name', me.name); }
    if (!me.name) me.name = '탐정' + me.pid.slice(0, 2);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) { if (e.target.id === 'modal') closeModal(); return; }
    const { act, id, v, code } = el.dataset;
    const i = el.dataset.i;
    const z = P && P.puzzles[id];
    window.Sound.unlock();
    if (!['pad', 'light'].includes(act)) window.Sound.play('click');

    switch (act) {
      case 'theme': if (S) ask({ type: 'config', theme: id }); else { readName(); sel.theme = id; home(); } break;
      case 'diff': if (S) ask({ type: 'config', diff: id }); else { readName(); sel.diff = id; home(); } break;
      case 'solo': readName(); createRoom(true); break;
      case 'daily': readName(); sel.seed = el.dataset.seed; createRoom(true); sel.seed = ''; break;
      case 'host': readName(); createRoom(false); break;
      case 'join': readName(); joinRoom(code); break;
      case 'rejoin': closeOverlay(); if (net) net.close(); S = null; joinRoom(code); break;
      case 'joincode': {
        readName();
        const c = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c.length === 5) joinRoom(c); else toast('5자리 방 코드를 입력하세요', 'bad');
        break;
      }
      case 'leave': closeModal(); leave(); break;
      case 'copy': copy(inviteUrl()); break;
      case 'share': navigator.share({ title: '방탈출 초대', text: '같이 탈출하자!', url: inviteUrl() }).catch(() => {}); break;
      case 'challenge': {
        const base = inviteUrl().split('?')[0];
        copy(`🔐 ${P.theme.name} (${P.d.label}) ${S.letter}등급 ${S.points}점! 같은 사건에 도전해 봐.\n${base}?theme=${S.theme}&diff=${S.diff}&seed=${S.seed}`);
        break;
      }
      case 'start': {
        const team = $('#teamname');
        if (team) ask({ type: 'config', team: team.value });
        ask({ type: act }); break;
      }
      case 'begin': case 'next': case 'lobby': case 'deduce': case 'deduceHint': ask({ type: act }); break;
      case 'pick': ask({ type: 'pick', id }); break;
      case 'prove': ask({ type: 'prove', k: Number(id) }); break;
      case 'rankView': rankView = v; drawModal(); break;
      case 'memo': openModal('memo'); break;
      case 'pin': addPin(v); break;
      case 'unpin': { const m = memo(); m.pins.splice(Number(i), 1); saveMemo(m); drawModal(); break; }
      case 'sharePin': ask({ type: 'note', text: memo().pins[Number(i)].text }); toast('팀에 공유했어요', 'good'); break;
      case 'shareMemo': { const text = memo().text.trim(); if (!text) return toast('메모가 비어 있어요'); ask({ type: 'note', text }); toast('팀에 공유했어요', 'good'); break; }
      case 'noteDel': ask({ type: 'noteDel', n: Number(i) }); break;
      case 'mark': { const m = memo(); m.marks[id] = ((m.marks[id] || 0) + 1) % MARKS.length; saveMemo(m); drawModal(); break; }
      case 'rank': if (!S) readName(); boardCache = {}; playerCache = null; openModal('rank', S ? S.theme : sel.theme, S && S.diff ? S.diff : sel.diff === 'auto' ? 'easy' : sel.diff); break;
      case 'rankTab': openModal('rank', id, v); break;
      case 'peek': collapsed = !collapsed; render(); break;
      case 'menu': case 'notes': case 'chat': openModal(act); break;
      case 'quit': openModal('quit'); break;
      case 'close': closeModal(); break;
      case 'mute': window.Sound.toggle(); window.Sound.ambient(S && S.phase === 'play'); drawModal(); break;
      case 'puzzle': openModal('puzzle', id); break;
      case 'item': openModal('item'); break;
      case 'install': ask({ type: 'install' }); drawModal(); break;
      case 'clue': openModal('clue', id, Number(i)); break;
      case 'decor': {
        const k = Number(i), st = P.stages[S.stage];
        if (k === st.secretAt && !S.found[S.stage]) ask({ type: 'secret', i: k });
        else openModal('text', st.decor[k][1], st.decor[k][2]);
        break;
      }
      case 'key': {
        const max = z.input === 'order' ? z.labels.length : z.length;
        const val = z.input === 'order' || z.input === 'digits' ? Number(v) : v;
        const cur = input[id];
        if (cur.length < max && !(z.input === 'order' && cur.includes(val))) cur.push(val);
        drawModal(); break;
      }
      case 'clear': input[id] = []; drawModal(); break;
      case 'hour': input[id][0] = ((input[id][0] - 1 + Number(v) + 12) % 12) + 1; drawModal(); break;
      case 'min': input[id][1] = (input[id][1] + Number(v) + 60) % 60; drawModal(); break;
      case 'submit': {
        const cur = input[id];
        const value = z.input === 'clock' ? `${cur[0]}:${cur[1]}` : z.input === 'order' ? cur.join(',') : cur.join('');
        if (z.input !== 'clock' && cur.length < (z.input === 'order' ? z.labels.length : z.length)) return toast('아직 다 입력하지 않았어요');
        if (z.input !== 'clock') input[id] = [];
        ask({ type: 'answer', id, value }); drawModal(); break;
      }
      case 'light': window.Sound.play('click'); ask({ type: 'light', id, i: Number(v) }); break;
      case 'lightReset': ask({ type: 'lightReset', id }); break;
      case 'replay': replay(z); break;
      case 'pad': {
        if (simonBusy) return;
        window.Sound.pad(Number(v));
        const cur = input[id];
        cur.push(Number(v));
        if (cur.length === z.seq.length) { input[id] = []; ask({ type: 'answer', id, value: cur.join('') }); }
        drawModal(); break;
      }
      case 'box': ask({ type: 'answer', id, value: v }); break;
      case 'hint': ask({ type: 'hint', id }); break;
      case 'vote': ask({ type: 'vote', id }); break;
      case 'quick': ask({ type: 'chat', text: v }); break;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'teamname' && S) ask({ type: 'config', team: e.target.value });
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'memo' && S) { const m = memo(); m.text = e.target.value; saveMemo(m); }
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    const n = e.target.querySelector('#noteinput');
    if (n && n.value.trim()) { const text = n.value; n.value = ''; ask({ type: 'note', text }); }
    const c = e.target.querySelector('#chatin');
    if (c && c.value.trim()) { const text = c.value; c.value = ''; ask({ type: 'chat', text }); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') return closeModal();
    if (!modal || modal.kind !== 'puzzle') return;
    const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'clear', Enter: 'submit' };
    const k = map[e.key] || e.key;
    if (e.target.tagName === 'INPUT') return;
    const el = [...document.querySelectorAll('#modal [data-act]')].find(b => b.dataset.act === k || (b.dataset.act === 'key' && b.dataset.v === k));
    if (el) { e.preventDefault(); el.click(); }
  });

  /* 손전등: 마우스 이동 / 터치 드래그 */
  const torch = { x: 50, y: 50 };
  function moveTorch(e) {
    const scene = $('.scene.dark');
    if (!scene) return;
    const r = scene.getBoundingClientRect();
    torch.x = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
    torch.y = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
    applyTorch();
  }
  function applyTorch() {
    const t = $('.torch');
    if (t) { t.style.setProperty('--x', torch.x + '%'); t.style.setProperty('--y', torch.y + '%'); }
  }
  document.addEventListener('pointermove', moveTorch);
  document.addEventListener('pointerdown', moveTorch);

  function paintTimer() {
    applyTorch();
    const el = $('#timer');
    if (!el || !S || S.phase !== 'play') return;
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('danger', left <= 180);
  }
  setInterval(() => {
    hostTick(); paintTimer();
    if (S && S.phase === 'play' && endsAt - Date.now() < 60000) window.Sound.play('heart');
  }, 1000);

  /* 방장 새로고침 대비: 남은 시간을 주기적으로 저장 */
  window.addEventListener('pagehide', () => {
    if (S && role && role !== 'guest') store.set('esc-save', { s: snapshot(), pid: me.pid, at: Date.now() }, sessionStorage);
  });

  /* =================== 시작 =================== */
  fetch('lan.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => {
    if (j && j.url) { lanBase = j.url; if (S && S.phase === 'lobby') render(); }
  }).catch(() => {});

  const saved = store.get('esc-save', sessionStorage);
  const guestCode = store.get('esc-guest', sessionStorage);
  if (saved && saved.pid === me.pid && saved.s && Date.now() - saved.at < 3600e3) createRoom(saved.s.solo, saved.s);
  else if (guestCode && guestCode === link.get('room')) joinRoom(guestCode);
  else home();
})();
