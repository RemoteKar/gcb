// js/ui.js
import { getSkinUrl } from './api.js';
import { createBadgeIcon } from './badge.js';

/**
 * @function updatePlayerHead
 * @desc 플레이어 머리 이미지를 업데이트
 * @param {HTMLElement} playerHeadContainer - 플레이어 머리 이미지가 들어갈 컨테이너
 * @param {string} uuid - 유저 UUID
 * @param {string} nickname - 유저 닉네임
 */
export function updatePlayerHead(playerHeadContainer, uuid, nickname) {
  playerHeadContainer.innerHTML = '';
  const img = document.createElement('img');
  img.src = getSkinUrl(uuid);
  img.alt = `${nickname}'s Head`;
  playerHeadContainer.appendChild(img);
}

/**
 * @function updateBadgeDisplay
 * @desc 배지 데이터를 받아서 배지 영역을 업데이트
 * @param {HTMLElement} badgeContainer - 배지 정보를 표시할 컨테이너
 * @param {object} badges - 배지 데이터 (예: { current: 'badgeName', List: ['badge1', 'badge2'] })
 */
export async function updateBadgeDisplay(badgeContainer, badges) {
  badgeContainer.innerHTML = '';

  if (!badges) {
    badgeContainer.textContent = '배지 데이터가 없습니다.';
    return;
  }

  const badgeList = badges.List || [];
  const currentBadge = badges.current || '없음';

  const currentBadgeContainer = document.createElement('div');
  currentBadgeContainer.innerHTML = `<strong>현재 배지:</strong> `;
  currentBadgeContainer.appendChild(await createBadgeIcon(currentBadge));
  badgeContainer.appendChild(currentBadgeContainer);

  const ownedBadgesContainer = document.createElement('div');
  ownedBadgesContainer.innerHTML = `<strong>보유 배지:</strong> `;
  for (const badgeName of badgeList) {
    ownedBadgesContainer.appendChild(await createBadgeIcon(badgeName));
  }
  badgeContainer.appendChild(ownedBadgesContainer);
}

/**
 * @function updateStatisticsDisplay
 * @desc 통계 데이터를 받아 통계 영역을 업데이트
 * @param {HTMLElement} statsContainer - 통계 정보를 표시할 컨테이너
 * @param {object|null} statistics - 통계 데이터
 */
export function updateStatisticsDisplay(statsContainer, statistics) {
  statsContainer.innerHTML = '';

  if (!statistics) {
    statsContainer.textContent = '통계 데이터가 없습니다.';
    return;
  }

  statsContainer.innerHTML = `
    <p><strong>승률:</strong> ${statistics.winRate}%</p>
    <p><strong>가장 많이 사용한 캐릭터:</strong> ${statistics.mostUsedCharacter}</p>
    <p><strong>가장 많이 사용한 증강:</strong> ${statistics.mostUsedAugments.join(', ')}</p>
    <p><strong>평균 데미지:</strong> ${statistics.averageDamageDealt}</p>
    <p><strong>평균 킬 수:</strong> ${statistics.averageKillRate}</p>
    <p><strong>평균 생존시간:</strong> ${statistics.averageAliveTime}</p>
  `;
}
