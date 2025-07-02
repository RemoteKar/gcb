const MAX_RECORDS = 400;
const CACHE_DURATION_MS = 180 * 1000; // 캐시 유지 시간 (300초 = 5분)

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { computeStatistics } = require('./utils/statistics');

const app = express();

app.use(cors());

// GitHub 관련 설정 (환경 변수로 관리)
const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN; 

// Repository 루트 기준 Data 폴더 경로
const baseDataPath = '/Data';

// 캐시 객체들
const badgeCache = {};       // { [formattedUUID]: { data, timestamp } }
const statisticCache = {};   // { [formattedUUID]: { data, timestamp } }

//----------------------------------------
// 📌 UUID 조회 (Mojang API 사용)
//----------------------------------------
const apiRoutes = require('./routes/api');

app.use('/api', apiRoutes);

//----------------------------------------
// 📌 게임 기록 기반 통계 계산 함수
//----------------------------------------


module.exports.handler = serverless(app);
