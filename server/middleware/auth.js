const fetch = require('node-fetch');

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    if (!authHeader.startsWith('GitHub ')) {
        return res.status(401).json({ error: '유효하지 않은 인증 형식입니다.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'GCB-App'
            }
        });

        if (!response.ok) {
            return res.status(401).json({ error: '유효하지 않은 GitHub 토큰입니다.' });
        }

        const user = await response.json();

        // 차단된 유저 확인
        const blockCheck = await fetch(`https://api.github.com/user/blocks/${user.login}`, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'User-Agent': 'GCB-App'
            }
        });

        if (blockCheck.status === 204) {
            return res.status(403).json({ error: '차단된 사용자입니다.' });
        }

        req.user = {
            sub: `github_${user.id}`,
            email: user.email || `${user.login}@github`,
            name: user.name || user.login,
            login: user.login,
        };
        return next();
    } catch (error) {
        console.error('❌ [Auth] GitHub 토큰 검증 실패:', error.message);
        return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
    }
}

module.exports = authMiddleware;
