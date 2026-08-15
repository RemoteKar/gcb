document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("search-button");
  const nicknameInput = document.getElementById("nickname");

  const goSearch = () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      return;
    }
    // 검색 후 /user/{닉네임}으로 이동
    window.location.href = `/user/${encodeURIComponent(nickname)}`;
  };
  searchButton.addEventListener("click", goSearch);
  nicknameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goSearch(); });

  loadHome();
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function portraitSrc(characterId) {
  if (characterId == null || CharacterConfig.isCreativeCharacter(characterId)) return '/Resource/character/0.png';
  return `/Resource/character/${characterId}.png`;
}

function characterLabel(characterId, names) {
  if (characterId == null) return '알 수 없음';
  if (CharacterConfig.isCreativeCharacter(characterId)) return CharacterConfig.getCreativeCharacterName(characterId);
  return names?.characters?.[characterId] || `캐릭터 ${characterId}`;
}

function formatDate(fileName) {
  // 2026.08.14-22.18.53.yml → 08.14 22:18
  const m = fileName.match(/(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})/);
  return m ? `${m[2]}.${m[3]} ${m[4]}:${m[5]}` : fileName;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

async function loadHome() {
  const [home, leaderboard, names] = await Promise.all([
    fetchJson('/data/home.json'),
    fetchJson('/data/leaderboard.json'),
    fetchJson('/data/names.json'),
  ]);

  renderTopPlayers(leaderboard);
  renderTopCharacters(home, names);
  await renderRecentGames(home, names);
  renderStrip(home, leaderboard);
}

function renderStrip(home, leaderboard) {
  const el = document.getElementById('home-stat-strip');
  if (!home) return;
  el.innerHTML = `
    <span class="home-stat-chip">기록된 게임<strong>${home.totalGames.toLocaleString()}판</strong></span>
    <span class="home-stat-chip">랭킹 등록 유저<strong>${(leaderboard || []).length}명</strong></span>
    ${home.recentGames[0] ? `<span class="home-stat-chip">마지막 게임<strong>${esc(formatDate(home.recentGames[0].fileName))}</strong></span>` : ''}
  `;
}

function renderTopPlayers(leaderboard) {
  const el = document.getElementById('home-top-players');
  if (!leaderboard || leaderboard.length === 0) {
    el.innerHTML = '<div class="empty-state">랭킹 데이터 없음</div>';
    return;
  }
  el.innerHTML = leaderboard.slice(0, 5).map((p, i) => `
    <a class="home-row" href="/user/${encodeURIComponent(p.nickname)}">
      <span class="home-rank top${i + 1}">${i + 1}</span>
      <img src="https://mc-heads.net/avatar/${p.uuid}/36" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/${p.uuid}?size=36&overlay'">
      <div class="home-row-main">
        <span class="home-row-title">${esc(p.nickname)}</span>
        <span class="home-row-sub">${p.totalGames}판</span>
      </div>
      <div class="home-row-side"><strong>${p.winRate}%</strong>승률</div>
    </a>
  `).join('');
}

function renderTopCharacters(home, names) {
  const el = document.getElementById('home-top-characters');
  if (!home || !home.topCharacters?.length) {
    el.innerHTML = '<div class="empty-state">데이터 없음</div>';
    return;
  }
  el.innerHTML = home.topCharacters.map((c, i) => `
    <a class="home-row" href="/character/${c.characterId}">
      <span class="home-rank top${i + 1}">${i + 1}</span>
      <img src="${portraitSrc(c.characterId)}" alt="" loading="lazy">
      <div class="home-row-main">
        <span class="home-row-title">${esc(characterLabel(c.characterId, names))}</span>
        <span class="home-row-sub">${c.picks}픽 · 승률 ${c.winRate}%</span>
      </div>
      <div class="home-row-side"><strong>${c.wins}승</strong></div>
    </a>
  `).join('');
}

async function renderRecentGames(home, names) {
  const el = document.getElementById('home-recent-games');
  if (!home || !home.recentGames?.length) {
    el.innerHTML = '<div class="empty-state">게임 기록 없음</div>';
    return;
  }
  const uuids = [...new Set(home.recentGames.map(g => g.winner?.uuid).filter(Boolean).map(u => u.replace(/-/g, '')))];
  let nickMap = {};
  if (uuids.length) nickMap = (await fetchJson(`/api/profiles?uuids=${uuids.join(',')}`)) || {};

  el.innerHTML = home.recentGames.map(g => {
    const w = g.winner;
    const cleanUuid = w ? w.uuid.replace(/-/g, '') : '';
    const nick = w ? (nickMap[cleanUuid] || cleanUuid.slice(0, 8)) : '-';
    const href = w ? `/user/${encodeURIComponent(nickMap[cleanUuid] || w.uuid)}` : '#';
    return `
      <a class="home-row" href="${href}">
        <div class="home-avatar-stack">
          <img src="${w ? portraitSrc(w.character) : '/Resource/character/0.png'}" alt="" loading="lazy" data-tip="${esc(w ? characterLabel(w.character, names) : '')}">
          ${w ? `<img src="https://mc-heads.net/avatar/${cleanUuid}/36" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/${cleanUuid}?size=36&overlay'">` : ''}
        </div>
        <div class="home-row-main">
          <span class="home-row-title">🏆 ${esc(nick)}</span>
          <span class="home-row-sub">${esc(w ? characterLabel(w.character, names) : '')} · ${w?.kills ?? 0}킬</span>
        </div>
        <div class="home-row-side"><strong>${esc(formatDate(g.fileName))}</strong>${g.players}명</div>
      </a>
    `;
  }).join('');
}
