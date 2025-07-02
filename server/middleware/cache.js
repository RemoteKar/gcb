const NodeCache = require('node-cache');
const { formatUUID } = require('../util');

const cache = new NodeCache({ stdTTL: 0 }); // 0은 영구 캐시를 의미합니다.

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