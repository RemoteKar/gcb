const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const apiRoutes = require('./routes/api');
// apiRoutes.precalculatedLeaderboard가 undefined가 되지 않도록 초기화 보장
if (!apiRoutes.precalculatedLeaderboard) {
  apiRoutes.precalculatedLeaderboard = [];
}
app.use('/api', apiRoutes);

module.exports.handler = serverless(app);