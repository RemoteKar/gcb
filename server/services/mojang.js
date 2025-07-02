const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

// 재시도 로직을 위한 헬퍼 함수
async function retryOperation(operation, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (error.message.includes('429') && i < retries - 1) {
                console.warn(`⚠️ [Mojang API] 재시도 (${i + 1}/${retries}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // 마지막 재시도에서도 실패하거나 다른 오류면 에러 발생
            }
        }
    }
}

// DATABASE_URL에서 'prisma+' 접두사 제거 (Netlify Prisma Postgres 확장 호환성)
const databaseUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('prisma+', '') : undefined;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function getUUID(nickname) {
    if (!nickname) {
        throw new Error('닉네임을 입력하세요.');
    }

    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;

    try {
        const response = await fetch(mojangUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // 유저를 찾을 수 없을 경우 null 반환
            }
            const errorText = await response.text();
            console.error(`❌ [Mojang API] 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error('Mojang API 오류가 발생했습니다.');
        }

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error("❌ [Mojang API] UUID 조회 중 오류 발생:", error);
        throw new Error("UUID 조회 중 오류가 발생했습니다.");
    }
}

async function getProfileByUUID(uuid) {
    if (!uuid) {
        throw new Error('UUID를 입력하세요.');
    }

    // 캐시에서 프로필 조회 (Prisma)
    try {
        const cachedProfile = await prisma.mojangProfileCache.findUnique({
            where: { uuid: uuid },
        });

        if (cachedProfile && (!cachedProfile.expiresAt || cachedProfile.expiresAt > new Date())) {
            console.log(`✅ [Mojang API] Prisma 캐시 히트: ${uuid}`);
            return cachedProfile.profileData;
        }
    } catch (error) {
        console.error(`❌ [Mojang API] Prisma 캐시 조회 오류: ${error}`);
        // 오류 발생 시 캐시 사용 안 하고 다음 로직으로 진행
    }

    const sessionServerUrl = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;

    try {
        const response = await retryOperation(async () => {
            const res = await fetch(sessionServerUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)',
                    'Accept': 'application/json'
                }
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`${res.status} ${res.statusText} - ${errorText}`);
            }
            return res;
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [Mojang API] 프로필 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error('프로필을 찾을 수 없습니다.');
        }

        const data = await response.json();
        
        // 캐시에 닉네임 저장 (Prisma)
        try {
            await prisma.mojangProfileCache.upsert({
                where: { uuid: uuid },
                update: {
                    name: data.name,
                    profileData: data,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                },
                create: {
                    uuid: uuid,
                    name: data.name,
                    profileData: data,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                }
            });
            console.log(`✅ [Mojang API] Prisma에 프로필 저장: ${uuid}`);
        } catch (error) {
            console.error(`❌ [Mojang API] Prisma 저장 오류: ${error}`);
            // 저장 실패해도 프로필 데이터는 반환
        }

        return data;
    } catch (error) {
        console.error("❌ [Mojang API] 프로필 조회 중 오류 발생:", error);
        throw new Error("프로필 조회 중 오류가 발생했습니다.");
    }
}

module.exports = { getUUID, getProfileByUUID };