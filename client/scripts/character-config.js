(function (global) {
    const CREATIVE_ID_MIN_EXCLUSIVE = 100;
    const CREATIVE_ID_MAX_EXCLUSIVE = 900;

    function isCreativeCharacter(id) {
        const n = Number(id);
        return Number.isFinite(n) && n > CREATIVE_ID_MIN_EXCLUSIVE && n < CREATIVE_ID_MAX_EXCLUSIVE;
    }

    function isOfficialCharacter(id) {
        const n = Number(id);
        return Number.isFinite(n) && !isCreativeCharacter(n);
    }

    function getCreativeCharacterName(id) {
        return `창작캐릭터${id}`;
    }

    const api = {
        CREATIVE_ID_MIN_EXCLUSIVE,
        CREATIVE_ID_MAX_EXCLUSIVE,
        isCreativeCharacter,
        isOfficialCharacter,
        getCreativeCharacterName,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.CharacterConfig = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
