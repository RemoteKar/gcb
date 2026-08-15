document.addEventListener("DOMContentLoaded", async () => {
    const characterGrid = document.getElementById("character-grid");

    async function fetchJson(url) {
        try {
            const res = await fetch(url);
            return res.ok ? await res.json() : null;
        } catch (e) {
            return null;
        }
    }

    characterGrid.innerHTML = Array.from({ length: 24 }, () => '<div class="skeleton skeleton-tile"></div>').join('');

    const [list, names] = await Promise.all([fetchJson('/api/character-list'), fetchJson('/data/names.json')]);
    const characters = list?.characters;

    if (!characters || characters.length === 0) {
        characterGrid.innerHTML = '<div class="empty-state">캐릭터를 찾을 수 없습니다.</div>';
        return;
    }

    characterGrid.innerHTML = characters.map(charId => {
        const name = names?.characters?.[charId] || `캐릭터 ${charId}`;
        return `<a class="character-grid-item" href="/character/${charId}" data-tip="${name.replace(/"/g, '&quot;')}" aria-label="${name.replace(/"/g, '&quot;')}">
            <img src="/Resource/character/${charId}.png" alt="" class="character-grid-img" loading="lazy" onerror="this.src='/Resource/character/0.png'">
        </a>`;
    }).join('');
});
