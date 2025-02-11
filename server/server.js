// netlify/functions/server.js

const MAX_RECORDS = 50;  

const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
const yml = require('js-yaml'); 
const fetch = require('node-fetch'); // Node 18 이상에서는 글로벌 fetch가 내장되어 있을 수도 있음

// util.js는 netlify/functions 폴더 내에 있다고 가정(또는 올바른 경로로 수정)
const { formatUUID } = require('./util');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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

  const formattedUUID = formatUUID(uuid);

  const filePath = path.join(__dirname, 'Data', 'player', 'badge', `${formattedUUID}.yaml`);
  console.log(`🔍 [서버] 배지 데이터 파일 경로: ${filePath}`);

  const serverDir = __dirname;
  try {
    const files = fs.readdirSync(serverDir);
    console.log('Server 폴더 파일 목록:', files);
  } catch (err) {
    console.error('Server 폴더 읽기 실패:', err);
  }
  
  

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "배지 데이터를 찾을 수 없습니다." });
  }

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const badgeData = yaml.load(fileContents);
    console.log(`✅ [서버] 전체 배지 데이터 응답: ${JSON.stringify(badgeData)}`);
    res.json(badgeData.badge || badgeData);
  } catch (error) {
    res.status(500).json({ error: "배지 데이터를 가져오는 중 오류가 발생했습니다." });
  }
});

//----------------------------------------
// 📌 게임 기록 조회 (로컬 Data 폴더에서)
//----------------------------------------
app.get('/api/gameHistory', (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);
  // 수정된 경로: 상위 두 단계로 올라가서 Data 폴더 접근
  const gameHistoryDir = path.join(__dirname, 'Data', 'gameHistory');
  console.log(`🔍 [서버] 게임 기록 폴더 경로: ${gameHistoryDir}`);

  if (!fs.existsSync(gameHistoryDir)) {
    return res.status(500).json({ error: "게임 기록 폴더가 존재하지 않습니다." });
  }

  let files = fs.readdirSync(gameHistoryDir);
  files.sort((a, b) => {
    const aTime = fs.statSync(path.join(gameHistoryDir, a)).mtime;
    const bTime = fs.statSync(path.join(gameHistoryDir, b)).mtime;
    return bTime - aTime;
  });

  const gameHistory = [];
  for (const file of files) {
    if (gameHistory.length >= MAX_RECORDS) break;
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
  }

  if (gameHistory.length === 0) {
    return res.status(404).json({ error: "게임 기록을 찾을 수 없습니다." });
  }

  res.json(gameHistory);
});

//----------------------------------------
// Express 앱을 Netlify Functions로 래핑하여 핸들러 내보내기
//----------------------------------------
module.exports.handler = serverless(app);
