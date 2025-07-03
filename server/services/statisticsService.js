const NodeCache = require('node-cache');
const { PrismaClient } = require('@prisma/client/edge');
const { fetchAllGameRecords } = require('./github');
const { computeGlobalCharacterStatistics } = require('../utils/statistics');

const prisma = new PrismaClient();
const localCache = new NodeCache({ stdTTL: 3600 }); // 1시간 로컬 캐시
const CACHE_KEY = 'global_character_stats_latest_60';

async function getCharacterStats() {
    // 1. 로컬 메모리 캐시 확인
    const localCachedData = localCache.get(CACHE_KEY);
    if (localCachedData) {
        console.log('✅ [Statistics Service] 로컬 캐시 히트');
        return localCachedData;
    }

    // 2. Prisma 캐시 확인
    try {
        const prismaCachedData = await prisma.globalCharacterStatsCache.findUnique({
            where: { cacheKey: CACHE_KEY },
        });

        if (prismaCachedData && (!prismaCachedData.expiresAt || prismaCachedData.expiresAt > new Date())) {
            console.log('✅ [Statistics Service] Prisma 캐시 히트');
            localCache.set(CACHE_KEY, prismaCachedData.statsData); // 로컬 캐시에도 저장
            return prismaCachedData.statsData;
        }
    } catch (error) {
        console.error('❌ [Statistics Service] Prisma 캐시 조회 오류:', error);
    }

    // 3. 캐시 없으면 새로 계산
    console.log('🔍 [Statistics Service] 캐시 미스. 새로운 통계 계산 시작...');
    const allGameRecordsWithFileName = await fetchAllGameRecords();

    // 파일 이름으로 정렬 (최신순)
    const sortedRecords = allGameRecordsWithFileName.sort((a, b) => {
        // 파일 이름에서 날짜/시간 부분을 추출하여 비교
        const dateA = a.fileName.match(/(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/)[0];
        const dateB = b.fileName.match(/(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/)[0];
        return dateB.localeCompare(dateA); // 내림차순 정렬
    });

    const latest60RecordsContent = sortedRecords.slice(0, 60).map(record => record.content);

    const stats = computeGlobalCharacterStatistics(latest60RecordsContent);

    // 4. 계산된 결과를 캐시에 저장
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1시간 후 만료
    localCache.set(CACHE_KEY, stats);

    try {
        await prisma.globalCharacterStatsCache.upsert({
            where: { cacheKey: CACHE_KEY },
            update: { statsData: stats, cachedAt: new Date(), expiresAt },
            create: { cacheKey: CACHE_KEY, statsData: stats, cachedAt: new Date(), expiresAt },
        });
        console.log('✅ [Statistics Service] Prisma 캐시에 새로운 통계 저장 완료');
    } catch (error) {
        console.error('❌ [Statistics Service] Prisma 캐시 저장 오류:', error);
    }

    return stats;
}

module.exports = { getCharacterStats };
