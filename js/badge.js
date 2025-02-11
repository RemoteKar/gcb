// js/badge.js
//---------------------------------------------------------
// 🔹 배지 관련 유틸리티 함수 모듈
//---------------------------------------------------------
/**
 * @function createBadgeIcon
 * @desc 배지 이름을 받아 이미지 엘리먼트를 생성하고 반환
 * @param {string} badgeName - 배지 파일 이름 (확장자 제외)
 * @returns {Promise<HTMLImageElement>} - 배지 아이콘 이미지 엘리먼트
 */
export async function createBadgeIcon(badgeName) {
    const img = document.createElement('img');
    img.src = `Resource/badge/${badgeName}.png`; // 로컬 배지 이미지 경로
    img.alt = badgeName;
    img.classList.add('badge-icon');
  
    img.onerror = () => {
      // 이미지 로딩 실패 시 기본 이미지로 대체
      img.src = 'path/to/default-image.png';
      console.error(`Failed to load badge image: ${badgeName}`);
    };
  
    return img;
  }
  