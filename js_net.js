/* P2P(WebRTC, PeerJS) 통신. 방장 브라우저가 게임 상태의 원본을 가진다. */
(function () {
  'use strict';
  const PREFIX = 'escroom-kr-v1-';
  const ICE = { config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun.relay.metered.ca:80'] },
    ...['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp']
      .map(urls => ({ urls, username: 'a70502666fef8cfd7c34f3e9', credential: 'fSa3VeFhXQQhiAxu' }))
  ] } };


  function available() { return typeof window.Peer === 'function'; }

  function host(code, handlers) {
    return new Promise((resolve, reject) => {
      if (!available()) return reject(new Error('통신 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하세요.'));
      const peer = new window.Peer(PREFIX + code, ICE);
      const conns = new Set();
      let opened = false;
      const timer = setTimeout(() => { if (!opened) { peer.destroy(); reject(new Error('중계 서버에 연결하지 못했어요.')); } }, 12000);
      peer.on('open', () => {
        opened = true; clearTimeout(timer);
        resolve({
          broadcast: fn => conns.forEach(c => c.open && c.send(fn(c.pid))),
          close: () => peer.destroy(),
        });
      });
      peer.on('connection', conn => {
        conns.add(conn);
        conn.on('data', msg => handlers.message(conn, msg));
        const gone = () => { if (conns.delete(conn)) handlers.leave(conn); };
        conn.on('close', gone);
        conn.on('error', gone);
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', err => {
        if (!opened) { clearTimeout(timer); peer.destroy(); reject(Object.assign(new Error('방을 만들지 못했어요 (' + err.type + ')'), { type: err.type })); }
      });
    });
  }

  function join(code, handlers) {
    return new Promise((resolve, reject) => {
      if (!available()) return reject(new Error('통신 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하세요.'));
      const peer = new window.Peer(undefined, ICE);
      let opened = false, quit = false, conn = null;
      const fail = text => { if (!opened) { clearTimeout(timer); peer.destroy(); reject(new Error(text)); } };
      const timer = setTimeout(() => fail('방에 연결하지 못했어요. 방장이 화면을 켜 두었는지 확인하세요.'), 15000);
      peer.on('open', () => {
        conn = peer.connect(PREFIX + code, { reliable: true });
        conn.on('open', () => {
          opened = true; clearTimeout(timer);
          resolve({ send: m => conn.open && conn.send(m), close: () => { quit = true; peer.destroy(); } });
        });
        conn.on('data', msg => handlers.message(msg));
        conn.on('close', () => opened && !quit && handlers.closed());
      });
      peer.on('error', err => fail(err.type === 'peer-unavailable' ? '그런 방이 없어요. 코드를 확인하세요.' : '연결 오류 (' + err.type + ')'));
    });
  }

  window.Net = { host, join, available };
})();
