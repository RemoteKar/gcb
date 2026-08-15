// 빌드 시 디시 갤로그(스티브 갤러리 작성 글) 최신 몇 페이지만 긁어 Data/patchnotes.json 스냅샷과 합친 뒤
// client/data/patchnotes.json 생성. 디시가 요청을 막아도(빈 응답) 스냅샷만으로 빌드 계속.
// 스냅샷 갱신: 로컬에서 `node scripts/build-patchnotes.js --refresh-snapshot` (전체 페이지 수집 후 Data/patchnotes.json 덮어씀)
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const GALLOG_USER = 'a4sanbvcxz';
const GALLOG_CNO = 7; // 스티브(마인크래프트)
const REFRESH = process.argv.includes('--refresh-snapshot');
const MAX_PAGES = REFRESH ? 30 : 3; // 빌드 시엔 최신 3페이지(60개)만
const PAGE_DELAY_MS = 1500;
const snapshotPath = path.resolve(__dirname, '..', 'Data', 'patchnotes.json');
const outPath = path.resolve(__dirname, '..', 'client', 'data', 'patchnotes.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ITEM_RE = /<a class="link\s*"\s+href="([^"]+)"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>(?:<span class="comment_num">\[(\d+)\]<\/span>)?[\s\S]*?<span class="date">([^<]+)<\/span>/g;

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function fetchPage(p) {
  const url = `https://gallog.dcinside.com/${GALLOG_USER}/posting/index?cno=${GALLOG_CNO}&p=${p}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const items = [];
  for (const m of html.matchAll(ITEM_RE)) {
    items.push({ url: decode(m[1]), title: decode(m[2]), comments: Number(m[3] || 0), date: m[4].trim() });
  }
  return items;
}

function loadSnapshot() {
  try { return JSON.parse(fs.readFileSync(snapshotPath, 'utf8')).posts || []; } catch (e) { return []; }
}

async function main() {
  const fetched = [];
  const seen = new Set();
  try {
    for (let p = 1; p <= MAX_PAGES; p++) {
      if (p > 1) await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      const items = await fetchPage(p);
      const fresh = items.filter(i => !seen.has(i.url));
      if (fresh.length === 0) break;
      fresh.forEach(i => { seen.add(i.url); fetched.push(i); });
    }
    console.log(`[빌드] 패치노트(갤로그) ${fetched.length}개 수집`);
  } catch (e) {
    console.warn(`[빌드] 패치노트 수집 실패 (스냅샷만 사용): ${e.message}`);
  }

  // 새로 받은 글 + 스냅샷 (url 기준 중복 제거, 최신순 유지)
  const posts = [...fetched];
  for (const old of loadSnapshot()) if (!seen.has(old.url)) { seen.add(old.url); posts.push(old); }
  posts.sort((a, b) => b.date.localeCompare(a.date) || b.url.localeCompare(a.url));

  const payload = { source: `https://gallog.dcinside.com/${GALLOG_USER}/posting/index?cno=${GALLOG_CNO}`, posts };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload));
  if (REFRESH && fetched.length > 0) {
    fs.writeFileSync(snapshotPath, JSON.stringify(payload));
    console.log(`[빌드] 스냅샷 갱신: ${snapshotPath} (${posts.length}개)`);
  }
  console.log(`[빌드] patchnotes.json 저장 (${posts.length}개)`);
}

main();
