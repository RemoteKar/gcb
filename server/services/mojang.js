const https = require('https');

async function getUUID(nickname) {
    if (!nickname) {
        throw new Error('닉네임을 입력하세요.');
    }

    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    console.log(`🔍 [Mojang API] 요청: ${mojangUrl}`);

    return new Promise((resolve, reject) => {
        https.get(mojangUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)', 'Accept': 'application/json' } }, (response) => {
            let data = '';

            console.log(`🔍 [Mojang API] 응답 코드: ${response.statusCode}`);

            if (response.statusCode !== 200) {
                return reject(new Error('유저를 찾을 수 없습니다.'));
            }

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    console.log(`✅ [Mojang API] UUID 응답 데이터: ${JSON.stringify(parsedData)}`);
                    resolve(parsedData.id);
                } catch (e) {
                    reject(new Error('Mojang API 응답 파싱 오류.'));
                }
            });

        }).on('error', (e) => {
            reject(new Error(`Mojang API 요청 오류: ${e.message}`));
        });
    });
}

module.exports = { getUUID };