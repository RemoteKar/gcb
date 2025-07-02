const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// 랭킹 데이터 초기화 함수
async function initializeRankings() {
  await apiRoutes.initializeLeaderboard();
}

// 서버리스 핸들러 정의
module.exports.handler = async (event, context) => {
  // 랭킹 데이터가 초기화되지 않았다면 초기화
  await initializeRankings();
  return serverless(app)(event, context);
};

// 서버 시작 시 랭킹 데이터 초기화 (콜드 스타트 시)
initializeRankings();