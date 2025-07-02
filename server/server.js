const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const apiRoutes = require('./routes/api');

app.use('/api', apiRoutes);

// 서버 시작 시 랭킹 데이터 초기화
apiRoutes.initializeLeaderboard();

module.exports.handler = serverless(app);