// Data/patchnotes/*.md → client/data/patchnotes.json
//
// 패치노트는 수동 관리: Data/patchnotes/ 에 파일 하나 = 패치노트 하나
//   파일명: YYYY-MM-DD.md  또는  YYYY-MM-DD-아무설명.md  (날짜 = 패치 날짜, 같은 날 여러 개면 뒤에 설명 붙이기)
//   내용:   첫 줄 `# 제목`, 나머지는 본문 (줄바꿈/들여쓰기 그대로 표시됨. "A -> B" 형태의 수치 변경은 자동 강조)
//   선택:   본문 어디든 `source: https://...` 한 줄을 넣으면 원문 링크로 표시
const fs = require('fs');
const path = require('path');

const notesDir = path.resolve(__dirname, '..', 'Data', 'patchnotes');
const outPath = path.resolve(__dirname, '..', 'client', 'data', 'patchnotes.json');

function parseNote(fileName, raw) {
  const m = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let title = fileName.replace(/\.md$/, '');
  if (lines[0]?.startsWith('#')) title = lines.shift().replace(/^#+\s*/, '').trim();
  let source = null;
  const body = lines.filter(l => {
    const s = l.match(/^source:\s*(\S+)/i);
    if (s) { source = s[1]; return false; }
    return true;
  }).join('\n').trim();
  return { date: m[1], title, body, source, file: fileName };
}

function main() {
  let notes = [];
  if (fs.existsSync(notesDir)) {
    notes = fs.readdirSync(notesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => parseNote(f, fs.readFileSync(path.join(notesDir, f), 'utf8')))
      .filter(Boolean)
      .sort((a, b) => b.file.localeCompare(a.file));
  } else {
    console.warn(`[빌드] 패치노트 폴더 없음: ${notesDir}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ notes }));
  console.log(`[빌드] patchnotes.json 저장 (${notes.length}개)`);
}

main();
