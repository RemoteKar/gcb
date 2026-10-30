const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const gameHistoryDir = path.resolve(__dirname, '..', 'Data', 'gameHistory');
const KST_MINUTES = 9 * 60;
const RECORD_NAME = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})\.ya?ml$/;

// 파일명 = 게임이 끝난 서버 현지 시각, Game.timeZone = 그 서버의 "UTC±hh:mm"(없으면 KST 로 본다) → 실제 순간(ms)
function recordInstant(fileName, timeZone) {
  const [, y, mo, d, h, mi, s] = RECORD_NAME.exec(fileName);
  const z = /^UTC([+-])(\d{2}):(\d{2})$/.exec(timeZone || '');
  const offset = z ? (z[1] === '-' ? -1 : 1) * (z[2] * 60 + +z[3]) : KST_MINUTES;
  return Date.UTC(y, mo - 1, d, h, mi, s) - offset * 60000;
}

// 실제 순간 → KST 시각, 파일명과 같은 모양 "yyyy.MM.dd-HH.mm.ss"
function kstTime(instant) {
  const t = new Date(instant + KST_MINUTES * 60000);
  const p = n => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}.${p(t.getUTCMonth() + 1)}.${p(t.getUTCDate())}-${p(t.getUTCHours())}.${p(t.getUTCMinutes())}.${p(t.getUTCSeconds())}`;
}

// Data/gameHistory 의 모든 기록을 실제 시간순으로 읽어 [{ fileName, time(KST), content }] 반환
function readGameRecords() {
  if (!fs.existsSync(gameHistoryDir)) {
    console.warn(`[빌드] gameHistory 폴더가 없습니다: ${gameHistoryDir}`);
    return [];
  }

  return fs.readdirSync(gameHistoryDir)
    .filter(fileName => RECORD_NAME.test(fileName))
    .sort()
    .map(fileName => ({
      fileName,
      content: yaml.load(fs.readFileSync(path.join(gameHistoryDir, fileName), 'utf8')),
    }))
    .filter(record => record.content)
    .map(record => ({ record, instant: recordInstant(record.fileName, record.content.Game?.timeZone) }))
    .sort((a, b) => a.instant - b.instant)
    .map(({ record, instant }) => ({ ...record, time: kstTime(instant) }));
}

module.exports = { readGameRecords, recordInstant, kstTime };
