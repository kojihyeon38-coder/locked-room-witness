/* 점수·티어·랭킹 저장소 */
(function () {
  'use strict';
  const WEIGHT = { easy: 1, normal: 1.5, hard: 2 };
  const TIERS = [[0, '🥉', '브론즈'], [4000, '🥈', '실버'], [12000, '🥇', '골드'], [28000, '💠', '플래티넘'], [60000, '👑', '마스터']];
  const LOCAL = 'esc-board';
  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (e) { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const sort = list => list.sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.at - b.at).slice(0, 20);
  const url = () => String((window.CONFIG && window.CONFIG.rankUrl) || '').replace(/\/+$/, '');

  /* { won, diff, timeLeft(초), secrets, hintsLeft, wrong, solved } → 점수 */
  function score(r) {
    const raw = (r.won ? 1000 + r.timeLeft : 200) + r.secrets * 150 + r.hintsLeft * 100 - r.wrong * 30 + r.solved * 50;
    return Math.max(0, Math.round(raw * WEIGHT[r.diff]));
  }

  async function request(path, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(path, Object.assign({ cache: 'no-store', signal: ctrl.signal }, options));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  const localList = board => sort((read(LOCAL, {})[board] || []).slice());
  function localAdd(board, entry) {
    const all = read(LOCAL, {});
    all[board] = sort((all[board] || []).filter(e => e.id !== entry.id).concat(entry));
    write(LOCAL, all);
  }

  /* 반환: { list, scope: 'online' | 'server' | 'local' } */
  async function list(theme, diff) {
    const board = `${theme}_${diff}`;
    try {
      if (url()) {
        const data = await request(`${url()}/ranks/${board}.json`);
        return { list: sort(Object.values(data || {})), scope: 'online' };
      }
      const data = await request(`api/rank?board=${board}`);
      if (Array.isArray(data)) return { list: sort(data), scope: 'server' };
    } catch (e) { /* 아래의 내 기기 기록으로 대체 */ }
    return { list: localList(board), scope: 'local' };
  }

  async function submit(entry) {
    const board = `${entry.theme}_${entry.diff}`;
    localAdd(board, entry);
    const body = JSON.stringify(entry);
    try {
      if (url()) await request(`${url()}/ranks/${board}/${entry.id}.json`, { method: 'PUT', body });
      else await request('api/rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      return true;
    } catch (e) { return false; }
  }

  /* 개인 티어: 이 기기에서 성공한 랭크전 점수의 누적 */
  function career() {
    const c = read('esc-career', { total: 0, games: [] });
    let i = 0;
    while (i + 1 < TIERS.length && c.total >= TIERS[i + 1][0]) i++;
    const next = TIERS[i + 1];
    return { total: c.total, icon: TIERS[i][1], name: TIERS[i][2], next: next ? { need: next[0] - c.total, name: next[2] } : null };
  }
  function addCareer(gameId, pts) {
    const c = read('esc-career', { total: 0, games: [] });
    if (c.games.includes(gameId)) return;
    c.total += pts;
    c.games = c.games.concat(gameId).slice(-100);
    write('esc-career', c);
  }

  window.Rank = { score, list, submit, career, addCareer, WEIGHT };
})();
