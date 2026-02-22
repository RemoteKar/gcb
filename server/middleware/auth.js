const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    // GitHub 토큰: "GitHub <access_token>"
    if (authHeader.startsWith('GitHub ')) {
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
            req.user = {
                sub: `github_${user.id}`,
                email: user.email || `${user.login}@github`,
                name: user.name || user.login,
            };
            return next();
        } catch (error) {
            console.error('❌ [Auth] GitHub 토큰 검증 실패:', error.message);
            return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
        }
    }

    // Google 토큰: "Bearer <jwt>"
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            req.user = {
                sub: payload.sub,
                email: payload.email,
                name: payload.name || payload.email,
            };
            return next();
        } catch (error) {
            console.error('❌ [Auth] Google 토큰 검증 실패:', error.message);
            return res.status(401).json({ error: '토큰이 유효하지 않거나 만료되었습니다.' });
        }
    }

    return res.status(401).json({ error: '유효하지 않은 인증 형식입니다.' });
}

module.exports = authMiddleware;
