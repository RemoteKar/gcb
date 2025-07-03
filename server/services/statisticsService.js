const NodeCache = require('node-cache');
const { fetchAllGameRecords } = require('./github');
const { computeGlobalCharacterStatistics, computeGlobalAugmentStatistics } = require('../utils/statistics');

const localCache = new NodeCache({ stdTTL: 3600 }); // 1시간 로컬 캐시
const CACHE_KEY_CHARACTER = 'global_character_stats_latest_60';
const CACHE_KEY_AUGMENT = 'global_augment_stats'; // 증강 통계 캐시 키

async function getCharacterStats() {
    // 1. 로컬 메모리 캐시 확인
    const localCachedData = localCache.get(CACHE_KEY_CHARACTER);
    if (localCachedData) {
        console.log('✅ [Statistics Service] 로컬 캐시 히트');
        return localCachedData;
    }

    // 2. 캐시 없으면 새로 계산
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

    // 3. 계산된 결과를 로컬 캐시에 저장
    localCache.set(CACHE_KEY_CHARACTER, stats);

    console.log('✅ [Statistics Service] 로컬 캐시에 새로운 통계 저장 완료');

    return stats;
}

async function getAugmentStats() {
    // 1. 로컬 메모리 캐시 확인
    const localCachedData = localCache.get(CACHE_KEY_AUGMENT);
    if (localCachedData) {
        console.log('✅ [Statistics Service] 증강 통계 로컬 캐시 히트');
        return localCachedData;
    }

    // 2. 캐시 없으면 새로 계산
    console.log('🔍 [Statistics Service] 증강 통계 캐시 미스. 새로운 통계 계산 시작...');
    const allGameRecordsWithFileName = await fetchAllGameRecords();
    console.log("DEBUG: allGameRecordsWithFileName.length (in getAugmentStats)", allGameRecordsWithFileName.length);

    // 모든 게임 기록을 사용하여 증강 통계 계산
    const allGameRecordsContent = allGameRecordsWithFileName.map(record => record.content);
    const stats = computeGlobalAugmentStatistics(allGameRecordsContent);
    console.log("DEBUG: calculated augment stats (in getAugmentStats)", stats);

    // 3. 계산된 결과를 로컬 캐시에 저장
    localCache.set(CACHE_KEY_AUGMENT, stats);

    console.log('✅ [Statistics Service] 로컬 캐시에 새로운 증강 통계 저장 완료');

    return stats;
}

module.exports = { getCharacterStats, getAugmentStats };
