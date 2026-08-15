const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const gameHistoryDir = path.resolve(__dirname, '..', 'Data', 'gameHistory');

// Data/gameHistory 의 모든 기록을 파일명순(=시간순)으로 읽어 [{ fileName, content }] 반환
function readGameRecords() {
  if (!fs.existsSync(gameHistoryDir)) {
    console.warn(`[빌드] gameHistory 폴더가 없습니다: ${gameHistoryDir}`);
    return [];
  }

  return fs.readdirSync(gameHistoryDir)
    .filter(fileName => fileName.endsWith('.yaml') || fileName.endsWith('.yml'))
    .sort()
    .map(fileName => ({
      fileName,
      content: yaml.load(fs.readFileSync(path.join(gameHistoryDir, fileName), 'utf8')),
    }))
    .filter(record => record.content);
}

module.exports = { readGameRecords };
