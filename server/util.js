// server/util.js

/**
 * 32자리 하이픈 없는 UUID 문자열을 표준 UUID 형식(8-4-4-4-12)으로 변환
 * 예: "9937b375a6cb497da3c01395207ce7ed" → "9937b375-a6cb-497d-a3c0-1395207ce7ed"
 *
 * @param {string} uuid - 하이픈 없는 32자리 UUID 문자열
 * @returns {string} - 하이픈이 포함된 표준 UUID 문자열
 */
function formatUUID(uuid) {
    if (typeof uuid !== "string" || uuid.length !== 32) {
      return uuid;
    }
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  }
  
  module.exports = { formatUUID, toNonHyphenatedUUID };

function toNonHyphenatedUUID(uuid) {
    if (typeof uuid !== "string") {
        return uuid;
    }
    return uuid.replace(/-/g, '');
}