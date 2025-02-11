//----------------------------------------
// server.js
//----------------------------------------

const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3000;

//----------------------------------------
// 정적 파일 제공: public 폴더 내의 모든 파일 (HTML, CSS, JS, 이미지 등)
// 실제 호스팅 시에도 이 설정으로 public 폴더의 파일이 제공됩니다.
app.use(express.static(path.join(__dirname, 'public')));

//----------------------------------------
// 루트 경로: index.html 파일 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//----------------------------------------
// API 엔드포인트: 닉네임으로 UUID 조회 (Mojang API 이용)
// GET /api/uuid?nickname=<닉네임>
app.get('/api/uuid', async (req, res) => {
  const nickname = req.query.nickname;
  if (!nickname) {
    return res.status(400).json({ error: '닉네임 파라미터가 필요합니다.' });
  }
  try {
    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    // Node 18 이상에서는 전역 fetch 사용 가능, 이전 버전이라면 node-fetch 설치 후 사용하세요.
    const mojangResponse = await fetch(mojangUrl);
    if (!mojangResponse.ok) {
      return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }
    const mojangData = await mojangResponse.json();
    res.json({ uuid: mojangData.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'UUID를 가져오는데 실패했습니다.' });
  }
});

//----------------------------------------
// API 엔드포인트: 게임 기록 조회
// GET /api/gameHistory?uuid=<UUID>
// Data/gameHistory 폴더 내 모든 YML 파일에서, 
// doc.Game.joinedPlayers 문자열에 해당 UUID가 포함된 기록만 반환합니다.
app.get('/api/gameHistory', (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) {
    return res.status(400).json({ error: 'UUID 파라미터가 필요합니다.' });
  }
  const gameHistoryDir = path.join(__dirname, 'Data', 'gameHistory');

  fs.readdir(gameHistoryDir, (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '게임 기록 폴더를 읽을 수 없습니다.' });
    }
    const records = [];
    let pending = files.length;
    if (pending === 0) return res.json(records);

    files.forEach(file => {
      const filePath = path.join(gameHistoryDir, file);
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (!err) {
          try {
            const doc = yaml.load(data);
            // joinedPlayers는 콤마로 구분된 문자열입니다.
            const joinedPlayersStr = doc.Game.joinedPlayers;
            if (joinedPlayersStr) {
              const players = joinedPlayersStr.split(',').map(s => s.trim());
              if (players.includes(uuid)) {
                records.push(doc);
              }
            }
          } catch (e) {
            console.error(`YML 파싱 에러 (${file}):`, e);
          }
        }
        pending--;
        if (pending === 0) {
          res.json(records);
        }
      });
    });
  });
});

//----------------------------------------
// API 엔드포인트: 플레이어 배지 정보 조회
// GET /api/playerBadge?uuid=<UUID>
// Data/player/badge/<UUID>.yml 파일을 읽어 배지 정보를 반환합니다.
app.get('/api/playerBadge', (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) {
    return res.status(400).json({ error: 'UUID 파라미터가 필요합니다.' });
  }
  const badgeFilePath = path.join(__dirname, 'Data', 'player', 'badge', `${uuid}.yml`);

  fs.readFile(badgeFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(404).json({ error: '배지 정보를 찾을 수 없습니다.' });
    }
    try {
      const doc = yaml.load(data);
      res.json(doc.badge);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: '배지 정보를 파싱하는데 실패했습니다.' });
    }
  });
});

//----------------------------------------
// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
