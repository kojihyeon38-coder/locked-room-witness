/* 온라인 랭킹 설정.
   rankUrl 이 비어 있으면: serve.py로 실행 중일 때는 그 컴퓨터에 저장, 그 외에는 각자 브라우저에만 저장.
   인터넷에 올려 모두가 같은 랭킹을 보려면 Firebase Realtime Database 주소를 넣는다. (README 참고)
   예: 'https://my-escape-default-rtdb.firebaseio.com' */
window.CONFIG = { rankUrl: '' };
