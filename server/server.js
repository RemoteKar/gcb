// server/server.js

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const yml = require('js-yaml'); 
const fetch = require('node-fetch'); // Node 18 이상에서는 글로벌 fetch가 내장되어 있을 수도 있음

// 유틸 함수 가져오기: UUID 하이픈 추가
const { formatUUID } = require('./util');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// API 엔드포인트가 정적 미들웨어보다 먼저 처리되도록 등록
//----------------------------------------
// 📌 UUID 조회 (Mojang API 사용)
//----------------------------------------
app.get('/api/uuid', async (req, res) => {
  const { nickname } = req.query;
  console.log(`🔍 [서버] UUID 요청: 닉네임 = ${nickname}`);

  if (!nickname) {
    return res.status(400).json({ error: "닉네임을 입력하세요." });
  }

  try {
    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    console.log(`🔍 [서버] Mojang API 요청: ${mojangUrl}`);

    const response = await fetch(mojangUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)',
        'Accept': 'application/json'
      }
    });
    console.log(`🔍 [서버] Mojang API 응답 코드: ${response.status}`);

    if (!response.ok) {
      return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
    }

    const data = await response.json();
    console.log(`✅ [서버] UUID 응답 데이터: ${JSON.stringify(data)}`);
    res.json({ uuid: data.id });
  } catch (error) {
    console.error("❌ [서버] UUID 조회 오류:", error);
    res.status(500).json({ error: "UUID 조회 중 오류가 발생했습니다." });
  }
});

//----------------------------------------
// 📌 배지 데이터 조회 (로컬 Data 폴더에서)
//----------------------------------------
app.get('/api/badge', (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 배지 데이터 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  // 하이픈 없는 UUID를 하이픈 포함 형식으로 변환
  const formattedUUID = formatUUID(uuid);
  const filePath = path.join(__dirname, '..', 'Data', 'player', 'badge', `${formattedUUID}.yaml`);
  console.log(`🔍 [서버] 배지 데이터 파일 경로: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "배지 데이터를 찾을 수 없습니다." });
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const badgeData = yaml.load(fileContents);
    console.log(`✅ [서버] 전체 배지 데이터 응답: ${JSON.stringify(badgeData)}`);
    res.json(badgeData.badge || badgeData);
  } catch (error) {
    console.error("❌ [서버] 배지 데이터 오류:", error);
    res.status(500).json({ error: "배지 데이터를 가져오는 중 오류가 발생했습니다." });
  }
});

//----------------------------------------
// 📌 게임 기록 조회 (로컬 Data 폴더에서)
//----------------------------------------
app.get('/api/gameHistory', (req, res) => {
  const { uuid } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }
  const formattedUUID = formatUUID(uuid);

  // Data 폴더가 프로젝트 루트에 있으므로, __dirname(현재 server 폴더)에서 상위 디렉토리로 이동하여 경로 지정
  const gameHistoryDir = path.join(__dirname, '..', 'Data', 'gameHistory');

  if (!fs.existsSync(gameHistoryDir)) {
    return res.status(500).json({ error: "게임 기록 폴더가 존재하지 않습니다." });
  }

  const files = fs.readdirSync(gameHistoryDir);
  const gameHistory = [];

  files.forEach(file => {
    const filePath = path.join(gameHistoryDir, file);
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const parsedData = yml.load(fileContents); 
      if (parsedData && parsedData.Game && parsedData.Game.joinedPlayers) {
        const players = parsedData.Game.joinedPlayers.split(',').map(s => s.trim());
        if (players.includes(formattedUUID)) {
          gameHistory.push(parsedData);
        }
      }
    } catch (error) {
      console.error(`❌ [서버] 게임 기록 파일 읽기 오류 (${file}):`, error);
    }
  });

  if (gameHistory.length === 0) {
    return res.status(404).json({ error: "게임 기록을 찾을 수 없습니다." });
  }
  res.json(gameHistory);
});



//----------------------------------------
// 정적 파일 제공 (API 등록 후)
//----------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

//----------------------------------------
// 서버 시작
//----------------------------------------
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});

