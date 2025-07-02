const NodeCache = require('node-cache');
const { formatUUID } = require('../util');

const CACHE_DURATION_MS = 180; // 3분 TTL (NodeCache는 초 단위)
const cache = new NodeCache({ stdTTL: CACHE_DURATION_MS });

function cacheMiddleware(keyPrefix) {
    return (req, res, next) => {
        const { uuid } = req.query;
        if (!uuid) {
            return next();
        }

        const formattedUUID = req.formattedUUID;
        const key = `${keyPrefix}_${formattedUUID}`;
        const cachedData = cache.get(key);

        if (cachedData) {
            console.log(`🔍 [캐시] 데이터 사용: ${key}`);
            return res.json(cachedData);
        }

        res.sendResponse = res.json;
        res.json = (body) => {
            cache.set(key, body);
            console.log(`✅ [캐시] 데이터 저장: ${key}`);
            res.sendResponse(body);
        };

        next();
    };
}

module.exports = cacheMiddleware;