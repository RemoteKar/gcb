const { PrismaClient } = require('@prisma/client/edge'); // PrismaClient 복원
const NodeCache = require('node-cache');
const profileCache = new NodeCache({ stdTTL: 82800 }); // 23 hours in seconds

const fetch = require('node-fetch');

let prisma; // prisma 인스턴스를 전역으로 선언

try {
  const databaseUrl = process.env.DATABASE_URL;
  console.log(`[DEBUG] DATABASE_URL (processed): ${databaseUrl ? '*****' : 'UNDEFINED'}`); // 민감 정보이므로 실제 값은 ***** 처리
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  }); // withAccelerate 적용
  console.log("✅ [Prisma] PrismaClient 초기화 성공.");
} catch (error) {
  console.error("❌ [Prisma] PrismaClient 초기화 오류: 데이터베이스 연결 실패. 캐싱 기능 비활성화.", error);
  console.error(`[DEBUG] DATABASE_URL (raw): ${process.env.DATABASE_URL ? '*****' : 'UNDEFINED'}`); // 민감 정보이므로 실제 값은 ***** 처리
  console.error(`[DEBUG] PrismaClientInitializationError details: ${error.message}`);
  prisma = null; // 초기화 실패 시 prisma를 null로 설정
}

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

    // 1. 인메모리 캐시에서 프로필 조회
    const inMemoryCachedProfile = profileCache.get(uuid);
    if (inMemoryCachedProfile) {
        console.log(`✅ [Mojang API] 인메모리 캐시 히트: ${uuid}`);
        return inMemoryCachedProfile;
    }

    // 2. Prisma 캐시에서 프로필 조회 (Prisma가 유효할 경우)
    if (prisma) {
        try {
            const cachedProfile = await prisma.mojangProfileCache.findUnique({
                where: { uuid: uuid },
            });

            // 캐시 유효기간 1시간 (3600000 밀리초)
            if (cachedProfile && (!cachedProfile.expiresAt || cachedProfile.expiresAt > new Date())) {
                console.log(`✅ [Mojang API] Prisma 캐시 히트: ${uuid}`);
                profileCache.set(uuid, cachedProfile.profileData); // 인메모리 캐시에도 저장
                return cachedProfile.profileData;
            }
        } catch (error) {
            console.error(`❌ [Mojang API] Prisma 캐시 조회 오류: ${error}`);
            // 오류 발생 시 캐시 사용 안 하고 다음 로직으로 진행
        }
    }

    // 3. Mojang API에서 프로필 조회
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
        
        // 4. 캐시에 저장
        profileCache.set(uuid, data); // 인메모리 캐시에 저장

        if (prisma) { // prisma가 유효할 때만 Prisma 캐시 저장 로직 실행
            try {
                await prisma.mojangProfileCache.upsert({
                    where: { uuid: uuid },
                    update: {
                        name: data.name,
                        profileData: data,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60)) // 1시간 캐시
                    },
                    create: {
                        uuid: uuid,
                        name: data.name,
                        profileData: data,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60)) // 1시간 캐시
                    }
                });
                console.log(`✅ [Mojang API] Prisma에 프로필 저장: ${uuid}`);
            } catch (error) {
                console.error(`❌ [Mojang API] Prisma 저장 오류: ${error}`);
                // 저장 실패해도 프로필 데이터는 반환
            }
        }

        return data;
    } catch (error) {
        console.error("❌ [Mojang API] 프로필 조회 중 오류 발생:", error);
        throw new Error("프로필 조회 중 오류가 발생했습니다.");
    }
}

module.exports = { getUUID, getProfileByUUID };