// [일회성] 디시 스티브갤 작성 글 → Data/patchnotes/*.md 로 가져오기 (2026-08 최초 패치노트 채우기용)
//   1) Data/patchnotes.snapshot.json 의 글 목록 중 body 없는 글을 m.dcinside.com 에서 긁어 채움 (9초 간격, 차단되면 중단)
//   2) 패치노트로 판정되는 글을 Data/patchnotes/YYYY-MM-DD[-no].md 로 씀 (이미 있는 파일은 덮어쓰지 않음)
// 실행: node scripts/import-dc-patchnotes.js          (본문 수집 + md 생성)
//       node scripts/import-dc-patchnotes.js --no-fetch (수집 없이 md 생성만)
// 남은 글까지 전부 가져온 뒤에는 이 스크립트와 스냅샷은 삭제해도 됨. 이후 패치노트는 md 파일 수동 작성.
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const root = path.resolve(__dirname, '..');
const snapshotPath = path.join(root, 'Data', 'patchnotes.snapshot.json');
const outDir = path.join(root, 'Data', 'patchnotes');
const GALL_ID = 'steve';
const DELAY_MS = 9000; // 디시 차단 방지: 글당 9초
const NO_FETCH = process.argv.includes('--no-fetch');
const UA_MOBILE = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const postNo = url => (url.match(/[?&]no=(\d+)/) || [])[1];

// ---------- 본문 수집 (모바일 페이지 <div class="thum-txtin"> 텍스트) ----------
function extractMobileBody(html) {
  const start = html.indexOf('class="thum-txtin"');
  if (start < 0) return null;
  const open = html.lastIndexOf('<div', start);
  const re = /<\/?div\b/g;
  re.lastIndex = open;
  let depth = 0, end = -1, m;
  while ((m = re.exec(html))) {
    depth += m[0] === '<div' ? 1 : -1;
    if (depth === 0) { end = m.index; break; }
  }
  if (end < 0) return null;
  let t = html.slice(open, end);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = decode(t).replace(/ /g, ' ');
  t = t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchBody(url) {
  const no = postNo(url);
  if (!no) return null;
  const res = await fetch(`https://m.dcinside.com/board/${GALL_ID}/${no}`, {
    headers: { 'User-Agent': UA_MOBILE, 'Accept-Language': 'ko', 'Referer': `https://m.dcinside.com/board/${GALL_ID}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html) throw new Error('빈 응답 (디시 차단)');
  return extractMobileBody(html);
}

// ---------- 패치노트 판정 / 정리 ----------
const ARROW_RE = /(->|→|=>|➡)/g;
const KEYWORD_RE = /(신규|추가|삭제|리워크|너프|버프|재사용\s*대기시간|쿨타임|피해량?|체력|공격력|이동속도|사거리|지속시간|확률|계수|밸런스|패치|변경|수정)/g;
function isPatch(title, body) {
  if (!body) return false;
  if (/신캐|시즌\s*\d|리메이크|특집|증강업데이트|신규 캐릭터/.test(title)) return true;
  const a = (body.match(ARROW_RE) || []).length, k = (body.match(KEYWORD_RE) || []).length;
  if (/패치노트\s*(없음|:\s*<none>)/.test(body)) return a >= 2;
  if (/(패치노트|변경점|패치내역)\s*:/.test(body)) return true;
  if (/\d+\s*(초|%|발|명)?\s*에서\s*\d+.*(감소|증가|변경)/.test(body)) return true;
  if (/신캐|신규\s*(캐릭터|증강)|시즌\s*\d|리메이크|개선패치/.test(body)) return true;
  return a >= 2 || (a >= 1 && k >= 3) || k >= 8;
}

const NOISE_LINE = [
  /^\s*(\d{1,3}\.){3}\d{1,3}(:\d+)?(\s+\S+)?\s*$/,
  /서버\s*\.?\s*한국|ngrok|stella-?it|exaroton|kro\.kr|joinmc\.link|dropbox\.com|stevegallery|gcbattle|블로그\.한국|playit\.gg|\.tcp\.|gcbgg\.netlify/i,
  /^\s*코드\s*\d+\s*$/,
  /^\s*(모드\s*링크|모드링크)\s*:?\s*$/,
  /^\s*(open|오픈|시작|막타오픈)\s*$/i,
  /^\s*\d{1,2}\s*시\s*(\d{1,2}\s*분|반)?\s*(에|부터|쯤)?\s*(open|오픈|시작|입니다|임|열림)?\s*$/i,
  /^\s*(open|오픈)\s*\d{1,2}\s*시.*$/i,
  /^\s*패치\s*노트\s*:?\s*$/,
  /^\s*변경점\s*:?\s*$/,
];
function clean(body) {
  return body.replace(/\r/g, '').split('\n').filter(l => !NOISE_LINE.some(re => re.test(l))).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- main ----------
async function main() {
  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const posts = snap.posts;

  if (!NO_FETCH) {
    const need = posts.filter(p => p.body === undefined);
    console.log(`본문 없는 글 ${need.length}개 수집 시작 (${DELAY_MS}ms 간격)`);
    let ok = 0;
    for (const [i, p] of need.entries()) {
      if (i > 0) await sleep(DELAY_MS);
      try {
        p.body = (await fetchBody(p.url)) || '';
        ok++;
        if (ok % 10 === 0) { fs.writeFileSync(snapshotPath, JSON.stringify(snap, null, 1)); console.log(`  ${ok}/${need.length}`); }
      } catch (e) {
        console.warn(`  실패 ${p.url}: ${e.message}`);
        if (/차단|403|429/.test(e.message)) { console.warn('  디시 차단 → 중단. 나중에 다시 실행하세요.'); break; }
      }
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(snap, null, 1));
    console.log(`본문 수집 ${ok}개, 남은 글 ${posts.filter(p => p.body === undefined).length}개`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const patch = posts.filter(p => p.body && isPatch(p.title, p.body));
  let written = 0;
  for (const p of patch) {
    const date = p.date.replace(/\./g, '-');
    const sameDay = patch.filter(q => q.date === p.date).length > 1;
    const name = sameDay ? `${date}-${postNo(p.url)}.md` : `${date}.md`;
    const file = path.join(outDir, name);
    if (fs.existsSync(file)) continue;
    fs.writeFileSync(file, `# ${p.title.trim() || `패치노트 ${date}`}\nsource: ${p.url}\n\n${clean(p.body)}\n`);
    written++;
  }
  console.log(`패치노트 판정 ${patch.length}개, 새로 쓴 파일 ${written}개 (총 ${fs.readdirSync(outDir).length}개)`);
}

main().catch(e => { console.error(e); process.exit(1); });
