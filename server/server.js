
const MAX_RECORDS = 50;
const CACHE_DURATION_MS = 60000; // 1분 (60,000ms) 동안 캐시 유지

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { formatUUID } = require('./util');

const app = express();

app.use(cors());

// GitHub 관련 설정 (환경 변수로 관리)
const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN; 

// Repository 루트 기준 Data 폴더의 경로는 다음과 같습니다.
const baseDataPath = '/Data';


// 캐시 객체들: key는 주로 UUID(또는 formattedUUID)로 사용
const badgeCache = {};       // { [formattedUUID]: { data: 캐시된 결과, timestamp: 타임스탬프 } }
const gameHistoryCache = {}; // { [formattedUUID]: { data: 캐시된 결과, timestamp: 타임스탬프 } }

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
// 📌 배지 데이터 조회 (GitHub Private Repository 사용 + 캐싱)
//----------------------------------------
app.get('/api/badge', async (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 배지 데이터 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);
  const now = Date.now();

  // 캐시된 결과가 있고, 1분 이내면 캐시 사용
  if (badgeCache[formattedUUID] && (now - badgeCache[formattedUUID].timestamp < CACHE_DURATION_MS)) {
    console.log(`🔍 [서버] 캐시된 배지 데이터 사용: UUID = ${formattedUUID}`);
    return res.json(badgeCache[formattedUUID].data);
  }

  // Repository 내의 파일 경로: Data/player/badge/{formattedUUID}.yaml
  const filePath = `${baseDataPath}/player/badge/${formattedUUID}.yaml`;
  // 한글 경로 등 문제가 발생할 수 있으므로 인코딩 처리
  const encodedFilePath = encodeURIComponent(filePath);
  const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedFilePath}?ref=${branch}`;
  console.log(`🔍 [서버] GitHub API 요청 URL: ${githubApiUrl}`);

  try {
    const response = await fetch(githubApiUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'Your App Name'
      }
    });

    if (!response.ok) {
      console.error(`❌ [서버] GitHub API 응답 코드: ${response.status}`);
      return res.status(404).json({ error: "배지 데이터를 찾을 수 없습니다." });
    }

    const data = await response.json();
    if (!data.content) {
      return res.status(404).json({ error: "배지 데이터가 없습니다." });
    }

    // Base64 디코딩 후 YAML 파싱
    const buff = Buffer.from(data.content, 'base64');
    const fileContents = buff.toString('utf8');
    const badgeData = yaml.load(fileContents);
    const responseData = badgeData.badge || badgeData;
    console.log(`✅ [서버] 배지 데이터 응답: ${JSON.stringify(responseData)}`);

    // 캐시에 저장
    badgeCache[formattedUUID] = {
      data: responseData,
      timestamp: now
    };

    res.json(responseData);
  } catch (error) {
    console.error("❌ [서버] 배지 데이터 조회 오류:", error);
    res.status(500).json({ error: "배지 데이터를 가져오는 중 오류가 발생했습니다." });
  }
});


//----------------------------------------
// 📌 게임 기록 조회 (GitHub Private Repository 사용 + 캐싱)
//----------------------------------------
app.get('/api/gameHistory', async (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);
  const now = Date.now();

  // 캐시된 결과가 있으면 사용
  if (gameHistoryCache[formattedUUID] && (now - gameHistoryCache[formattedUUID].timestamp < CACHE_DURATION_MS)) {
    console.log(`🔍 [서버] 캐시된 게임 기록 데이터 사용: UUID = ${formattedUUID}`);
    return res.json(gameHistoryCache[formattedUUID].data);
  }

  // Repository 내 게임 기록 폴더 경로: Data/gameHistory
  const dirPath = `${baseDataPath}/gameHistory`;
  const encodedDirPath = encodeURIComponent(dirPath);
  const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedDirPath}?ref=${branch}`;
  console.log(`🔍 [서버] GitHub API 게임 기록 폴더 URL: ${githubApiUrl}`);

  try {
    // 디렉터리 내 파일 목록 조회
    const dirResponse = await fetch(githubApiUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'Your App Name'
      }
    });

    if (!dirResponse.ok) {
      console.error(`❌ [서버] GitHub API 게임 기록 폴더 응답 코드: ${dirResponse.status}`);
      return res.status(500).json({ error: "게임 기록 폴더가 존재하지 않습니다." });
    }

    const filesList = await dirResponse.json();
    const gameHistory = [];

    // 파일 목록에서 각 파일의 내용을 읽어와 파싱
    for (const file of filesList) {
      if (gameHistory.length >= MAX_RECORDS) break;

      const fileResponse = await fetch(file.download_url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'User-Agent': 'Your App Name'
        }
      });
      if (!fileResponse.ok) {
        console.error(`❌ [서버] 파일 ${file.name} 다운로드 실패: ${fileResponse.status}`);
        continue;
      }
      const fileContents = await fileResponse.text();
      try {
        const parsedData = yaml.load(fileContents);
        if (parsedData && parsedData.Game && parsedData.Game.joinedPlayers) {
          const players = parsedData.Game.joinedPlayers.split(',').map(s => s.trim());
          if (players.includes(formattedUUID)) {
            gameHistory.push(parsedData);
          }
        }
      } catch (parseError) {
        console.error(`❌ [서버] 게임 기록 파일 파싱 오류 (${file.name}):`, parseError);
      }
    }

    if (gameHistory.length === 0) {
      return res.status(404).json({ error: "게임 기록을 찾을 수 없습니다." });
    }

    // 캐시에 저장
    gameHistoryCache[formattedUUID] = {
      data: gameHistory,
      timestamp: now
    };

    res.json(gameHistory);
  } catch (error) {
    console.error("❌ [서버] 게임 기록 조회 오류:", error);
    res.status(500).json({ error: "게임 기록을 가져오는 중 오류가 발생했습니다." });
  }
});

module.exports.handler = serverless(app);
