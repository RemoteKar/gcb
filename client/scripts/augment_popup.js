// 증강·코어 설명 팝업. 페이지는 요소에 data-augment-id / data-core-key 만 달면 누를 때 열린다
(function () {
    let overlay = null;

    function open(icon, fallback, item) {
        if (!overlay) {
            document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" style="display:none"><div class="modal info-popup" role="dialog" aria-modal="true">
  <button class="modal-close" aria-label="닫기">&times;</button>
  <img class="info-popup-icon" alt=""><h2 class="info-popup-name"></h2><div class="info-popup-desc"></div>
</div></div>`);
            overlay = document.body.lastElementChild;
        }
        const img = overlay.querySelector('.info-popup-icon');
        img.onerror = () => { img.onerror = null; img.src = fallback; };
        img.src = icon;
        overlay.querySelector('.info-popup-name').textContent = item.name;
        overlay.querySelector('.info-popup-desc').innerHTML = GCB.mc(item.description);
        overlay.style.display = 'flex';
    }

    const find = async (url, id) => (await GCB.json(url) || []).find(x => String(x.id) === String(id));

    window.showAugmentPopup = async id => {
        const aug = await find('/data/augments.json', id);
        if (aug) open(`/Resource/augment/icon/${id}.png`, '/Resource/augment/icon/0.png', aug);
    };
    window.showCorePopup = async key => {
        const core = await find('/data/cores.json', key);
        if (core) open(`/Resource/core/${key}.png`, '/Resource/core/0.png', core);
    };

    // 캡처 단계에서 받아 카드 클릭(상세 열기·이동)보다 먼저 팝업만 연다
    document.addEventListener('click', e => {
        const el = e.target.closest('[data-augment-id], [data-core-key]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        if (el.dataset.coreKey) showCorePopup(el.dataset.coreKey);
        else showAugmentPopup(el.dataset.augmentId);
    }, true);
})();
