//----------------------------------------
// public/js/api.js
//----------------------------------------

// 플레이어 스킨 이미지 URL 반환 함수 (Crafatar API 사용)
export function getSkinUrl(uuid) {
  return `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
}

//----------------------------------------
// Helper 함수: 닉네임을 받아 서버의 /api/uuid 엔드포인트를 호출하여 UUID를 반환
export async function getUUID(nickname) {
  const response = await fetch(`/api/uuid?nickname=${nickname}`);
  if (!response.ok) {
    throw new Error(`유저를 찾을 수 없습니다: ${nickname}`);
  }
  const data = await response.json();
  return data.uuid;
}
