const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const apiRoutes = require('./routes/api');

app.use('/api', apiRoutes);

// 서버 시작 시 랭킹 데이터 초기화가 완료될 때까지 기다림
async function startServer() {
  await apiRoutes.initializeLeaderboard();
  module.exports.handler = serverless(app);
}

startServer();