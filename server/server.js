
const MAX_RECORDS = 200;
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
const statisticCache = {}; // { [formattedUUID]: { data: 캐시된 결과, timestamp: 타임스탬프 } }

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
app.get('/api/statistic', async (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);
  const now = Date.now();

  // 캐시된 결과가 있으면 사용
  if (statisticCache[formattedUUID] && (now - statisticCache[formattedUUID].timestamp < CACHE_DURATION_MS)) {
    console.log(`🔍 [서버] 캐시된 게임 기록 데이터 사용: UUID = ${formattedUUID}`);
    return res.json(statisticCache[formattedUUID].data);
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
    let gameHistory;
    if (gameHistoryCache[formattedUUID] && (now - gameHistoryCache[formattedUUID].timestamp < CACHE_DURATION_MS)) {
      gameHistory = gameHistoryCache[formattedUUID].data;
      console.log("1");
    }else{
      console.log("2");
      // 파일 목록에서 각 파일의 내용을 읽어와 파싱
      gameHistory = [];
      for (const file of filesList) {
        console.log("3");
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
      console.log("4");
      if (gameHistory.length === 0) {
        return res.status(404).json({ error: "게임 기록을 찾을 수 없습니다." });
      }
      gameHistoryCache[formattedUUID] = {
        data: gameHistory,
        timestamp: now
      };
    }

    const statistics = computeStatistics(gameHistory,uuid);
    // 캐시에 저장
    statisticCache[formattedUUID] = {
      data: statistics,
      timestamp: now
    };

    res.json(statistics);
  } catch (error) {
    console.error("❌ [서버] 게임 기록 조회 오류:", error);
    res.status(500).json({ error: "게임 기록을 가져오는 중 오류가 발생했습니다." });
  }
});


function computeStatistics(gameRecords, uuid) {
  let totalGames = gameRecords.length || 0;
  let winCount = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalKills = 0;
  let totalAliveTime = 0;
  let maxDamageDealt = 0;
  let maxDamageTaken = 0;
  let maxKill = 0;  
  let rankAtLeast50 = 0;
  const characterCounts = {};
  const augmentCounts = {};

  const formattedUUID = formatUUID(uuid);
  gameRecords.forEach(record => {
    if (record.Player && record.Player[formattedUUID]) {
      const playerData = record.Player[formattedUUID];
      const character = playerData.Character;
      
      if(character >= 900){
          return;
      }

      totalGames++;     
      if (playerData.Ranking / record.Game.amountOfPlayers <= 0.5) {
        rankAtLeast50++;
      }
      if (playerData.outCuase === "우승") {
        winCount++;
      }
      if (playerData.Damage) {
        if (typeof playerData.Damage.Dealt === "number") {
          if (playerData.Damage.Dealt >= maxDamageDealt) {
            maxDamageDealt = playerData.Damage.Dealt;
          }
          totalDamageDealt += playerData.Damage.Dealt;
        }
        if (typeof playerData.Damage.Taken === "number") {
          if (playerData.Damage.Taken >= maxDamageTaken) {
            maxDamageTaken = playerData.Damage.Taken;
          }
          totalDamageTaken += playerData.Damage.Taken;
        }
      }
      if (typeof playerData.kill === "number") {
        if (playerData.kill >= maxKill) {
          maxKill = playerData.kill;
        }
        totalKills += playerData.kill;
      }
      if (typeof playerData.TimeSurvived === "number") {
        totalAliveTime += playerData.TimeSurvived;
      }

      if (character !== undefined) {
        characterCounts[character] = (characterCounts[character] || 0) + 1;
      }

      if (playerData.Augment) {
        Object.values(playerData.Augment).forEach(augmentValue => {
          augmentCounts[augmentValue] = (augmentCounts[augmentValue] || 0) + 1;
        });
      }
    }
  });

  if (totalGames === 0) {
    return {
      winRate: "0.0",
      winCount: "0",
      avarageRankLeast50: 0.0,
      mostUsedCharacter: "N/A",
      mostUsedAugments: [],
      averageDamageDealt: "0",
      averageDamageTaken: "0",       
      averageKillRate: "0.0",
      averageAliveTime: "0.0",
      maxDamageDealt: "0",
      maxDamageTaken: "0",
      maxKill: "0",   
      totalGames: "0"
    };
  }

  const winRate = ((winCount / totalGames) * 100).toFixed(1);
  const avarageRankLeast50 = ((rankAtLeast50 / totalGames) * 100).toFixed(1);
  const averageDamageDealt = (totalDamageDealt / totalGames).toFixed(0);
  const averageDamageTaken = (totalDamageTaken / totalGames).toFixed(0);
  const averageKillRate = (totalKills / totalGames).toFixed(2);
  const averageAliveTime = (totalAliveTime / totalGames).toFixed(1);
  let mostUsedCharacter = "N/A";
  let maxCharacterCount = 0;
  maxDamageDealt = maxDamageDealt.toFixed(0);
  maxDamageTaken = maxDamageTaken.toFixed(0);

  for (const char in characterCounts) {
    if (characterCounts[char] > maxCharacterCount) {
      maxCharacterCount = characterCounts[char];
      mostUsedCharacter = char;
    }
  }

  const mostUsedAugments = Object.entries(augmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);

  return {
    winRate,
    winCount,
    avarageRankLeast50,
    mostUsedCharacter,
    mostUsedAugments,
    averageDamageDealt,
    averageDamageTaken,        
    averageKillRate,
    averageAliveTime,
    maxDamageDealt,
    maxDamageTaken,   
    maxKill,
    totalGames
  };
}


module.exports.handler = serverless(app);
