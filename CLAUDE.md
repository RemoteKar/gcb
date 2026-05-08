# GCB.gg 프로젝트 작업 기록

## 프로젝트 개요
Minecraft 게임 통계 및 랭킹 API 서버 (풀스택 웹 애플리케이션)

### 기술 스택
- **백엔드**: Node.js + Express.js
- **데이터베이스**: PostgreSQL + Prisma ORM
- **프론트엔드**: Vanilla HTML/CSS/JS
- **배포**: Netlify (Serverless Functions)
- **외부 API**: Mojang API, GitHub API

---

## 2026-02-05 작업 내용: 캐릭터 정보 페이지 추가

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/character.html` | 캐릭터 목록 페이지 (그리드 형태로 초상화 표시) |
| `client/character_detail.html` | 캐릭터 상세 정보 페이지 |
| `client/scripts/character.js` | 목록 페이지 로직 |
| `client/scripts/character_detail.js` | 상세 페이지 로직 (마인크래프트 색코드 파싱 포함) |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/services/github.js` | `getCharacterList()`, `getCharacterInfo()` 함수 추가 |
| `server/routes/api.js` | `/api/character-list`, `/api/character-info` 엔드포인트 추가 |
| `client/styles/main.css` | 캐릭터 그리드, 상세 페이지, 스탯 그리드 스타일 추가 |
| `netlify.toml` | `/character/:id` 리다이렉트 추가 |
| 모든 HTML 페이지 | 헤더에 "캐릭터정보" 네비게이션 버튼 추가 |

### 주요 기능
1. **캐릭터 목록** (`/character.html`)
   - 1~899번 캐릭터 초상화를 그리드로 표시
   - 클릭 시 `/character/:id`로 이동

2. **캐릭터 상세** (`/character/:id`)
   - 캐릭터 이름: `Data/description/char_X/stat.yaml`의 `name` 값
   - 스탯 표시: 체력, 공격력, 공격속도, 사거리, 이동속도, 체력재생
   - 스킬 표시: 패시브(0), 기본공격(baseattack), 스킬1~4
   - 마인크래프트 색코드 지원 (&0~&f)

### 데이터 구조
```
Data/description/char_X/
├── stat.yaml      # 캐릭터 스탯 + name (캐릭터 이름)
├── 0.yaml         # 패시브
├── 1.yaml         # 스킬 1
├── 2.yaml         # 스킬 2
├── 3.yaml         # 스킬 3
├── 4.yaml         # 궁극기
└── baseattack.yaml # 기본 공격 (일부 캐릭터만)
```

### 마인크래프트 색코드 매핑
```
&0: #000000 (검정)    &1: #0000AA (어두운 파랑)
&2: #00AA00 (어두운 초록)  &3: #00AAAA (어두운 청록)
&4: #AA0000 (어두운 빨강)  &5: #AA00AA (어두운 보라)
&6: #FFAA00 (금색)    &7: #AAAAAA (회색)
&8: #555555 (어두운 회색)  &9: #5555FF (파랑)
&a: #55FF55 (연두)    &b: #55FFFF (청록)
&c: #FF5555 (빨강)    &d: #FF55FF (분홍)
&e: #FFFF55 (노랑)    &f: #FFFFFF (흰색)
```

### API 엔드포인트
- `GET /api/character-list` - 캐릭터 ID 목록 반환 (1~899)
- `GET /api/character-info?id=X` - 특정 캐릭터 정보 반환 (스탯 + 스킬)

### 리소스 폴더 구조
```
client/Resource/
├── character/     # 캐릭터 초상화 (0~48, 1000번대)
├── augment/icon/  # 증강 아이콘 (0~39)
└── badge/         # 배지 이미지
```

---

## 2026-02-10 작업 내용: 무기 상세 페이지 추가 (스킬 클릭 연동)

### 개요
캐릭터 스킬 YAML에 `id` 필드가 있는 경우, 해당 스킬 카드를 클릭하면 무기 상세 페이지(`/weapon/:id`)로 이동.
무기 페이지는 상단 네비게이션에 노출되지 않으며, 오직 캐릭터 상세 페이지에서만 진입 가능.

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/weapon_detail.html` | 무기 상세 페이지 (한 페이지에 모든 무기 표시) |
| `client/scripts/weapon_detail.js` | 무기 페이지 로직 (MC 색코드 파싱, 이미지 확장자 자동 탐색) |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/services/github.js` | `getSkillLinks()`, `getWeaponList(weaponId)` 함수 추가 |
| `server/routes/api.js` | `GET /api/skill-links`, `GET /api/weapon-info?id=X` 엔드포인트 추가 |
| `client/scripts/character_detail.js` | 스킬 링크 매핑 기반 클릭 이동 로직 추가 |
| `client/styles/main.css` | 클릭 가능 스킬 카드 스타일 + 무기 페이지 3열 그리드 스타일 추가 |
| `netlify.toml` | `/weapon/:id` → `/weapon_detail.html` 리다이렉트 추가 |

### 주요 기능
1. **범용 스킬 링크 시스템**: `GET /api/skill-links` → `{ skillId: path }` 매핑 반환. 클라이언트는 경로를 하드코딩하지 않음
2. **스킬 클릭 연동**: 매핑에 존재하는 `skill.id`만 클릭 가능 (금색 테두리 + ▶ 아이콘)
3. **무기 상세 페이지** (`/weapon/:id`)
   - 해당 `Data/description/weapons/{id}/` 폴더의 모든 YAML을 카드로 표시
   - 무기 이미지: `client/Resource/weapon/{id}/{weapon.id}.{ext}` (webp→png→jpg→jpeg→gif 순차 시도)
   - 이미지 비율 유동적 대응 (`object-fit: contain`, 고정 높이 컨테이너)
   - 마인크래프트 색코드 파싱 지원

### 데이터 구조
```
Data/description/weapons/APEXWeaponSelector/
├── wingman.yaml       # id, name, description
├── r301.yaml
├── peacekeeper.yaml
├── ... (총 17개 무기)
```

### 무기 YAML 형식
```yaml
id: wingman
name: 윙맨
description: "&f대구경 권총 입니다\n&f적중시 &660&f의 피해를..."
```

### 스킬 id가 APEXWeaponSelector인 캐릭터
- char_2 (스킬 1, 2)
- char_7 (스킬 1, 2)
- char_17 (스킬 1, 2)
- char_24 (스킬 1)
- char_58 (스킬 1, 2)

### API 엔드포인트
- `GET /api/skill-links` - 스킬 ID → 이동 경로 매핑 반환 (예: `{ "APEXWeaponSelector": "/weapon/APEXWeaponSelector" }`)
- `GET /api/weapon-info?id=X` - 무기 카테고리별 전체 무기 목록 반환

### 스킬 링크 확장 방법
`server/services/github.js`의 `getSkillLinks()` 함수에 새 폴더 스캔 블록 추가:
```js
// 예: titan 폴더 스캔 → /titan/{id} 경로로 매핑
const titanDirs = await retryOperation(async () => { ... });
if (titanDirs) {
    titanDirs.filter(item => item.type === 'dir')
        .forEach(item => { skillLinks[item.name] = `/titan/${item.name}`; });
}
```
그 후 해당 HTML/JS 페이지 생성 + `netlify.toml`에 리다이렉트 추가

### 리소스 폴더 구조 (추가)
```
client/Resource/weapon/
├── APEXWeaponSelector/  # 무기 이미지 (webp/png, 비율 유동적)
└── titan/               # 타이탄 무기 이미지
```

---

## 2026-02-10 작업 내용: 타이탄 페이지 추가

### 개요
캐릭터 24의 궁극기 "BT-7274" (skill id: `잭4`) 클릭 → 타이탄 7종 목록 → 개별 타이탄 상세.
기존 weapon 로직과 완전 분리된 별도 API/페이지로 구현.
타이탄 목록은 세로 1열 배치 (왼쪽 아이콘 + 오른쪽 이름/설명), 하단에 스마트 피스톨 설명 포함.

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/titan_list.html` | 타이탄 목록 페이지 (7종 아이콘+설명 + 하단 스마트피스톨) |
| `client/titan_detail.html` | 타이탄 상세 페이지 (캐릭터 상세와 동일 디자인) |
| `client/scripts/titan_list.js` | 목록 페이지 로직 |
| `client/scripts/titan_detail.js` | 상세 페이지 로직 (패시브+스킬1-4+기본공격) |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/services/github.js` | `getTitanList()`, `getTitanInfo()`, `fetchGithubDir()` 함수 추가, `getSkillLinks()`에 잭4 매핑 |
| `server/routes/api.js` | `GET /api/titan-list`, `GET /api/titan-info` 엔드포인트 추가 |
| `client/styles/main.css` | 타이탄 목록(세로 배치) + 스마트 피스톨 스타일 추가 |
| `netlify.toml` | `/titan/:skillId`, `/titan/:skillId/:titanName` 리다이렉트 추가 |

### 데이터 구조
```
Data/description/titan/
├── 잭0-2.yaml           # 공용 패시브 (모든 타이탄 공통)
├── smartpistol.yaml     # 스마트 피스톨 (목록 하단에 별도 표시)
├── vanguard/            # 각 타이탄 폴더 (7개)
│   ├── 잭4vanguard.yaml # index 정렬 offset 0 → 타이탄 설명
│   ├── (스킬 4개)       # offset 1-4 → 스킬 1-4
│   └── xo16.yaml        # offset 5 → 무기 (기본공격)
├── ion/ legion/ northstar/ ronin/ scorch/ tone/
```
**규칙**: 폴더 내 파일을 `index`로 정렬, offset 0=설명, 1-4=스킬, 5=무기

### URL 구조
- `/titan/잭4` → 타이탄 목록 (7종 + 스마트 피스톨)
- `/titan/잭4/ion` → 아이온 상세 (패시브+스킬+무기)

### API 엔드포인트
- `GET /api/titan-list` - 타이탄 7종 목록 + 스마트 피스톨 데이터
- `GET /api/titan-info?id=ion` - 개별 타이탄 상세 (패시브+스킬+무기)

### 리소스
- 타이탄 아이콘: `client/Resource/titan/{name}.png`
- 무기 이미지: `client/Resource/titan/weapon/{weaponId}.webp`

### 스킬 링크 매핑
- `getSkillLinks()`에서 titan 폴더 존재 시 `잭4` → `/titan/잭4` 자동 매핑
- 추후 새 시스템 추가 시 동일 패턴으로 `getSkillLinks()`에 스캔 블록 추가

---

## 2026-02-16 작업 내용: 증강 정보 페이지 + 팝업 시스템 추가

### 개요
증강 아이콘 그리드 페이지(`/augment.html`)를 추가하고, 클릭 시 팝업으로 이름+설명을 표시.
공용 팝업 모듈을 통해 증강 통계 페이지, 유저 전적 페이지에서도 증강 아이콘 클릭 시 동일 팝업 표시.

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/augment.html` | 증강 목록 페이지 (그리드 형태로 아이콘 표시) |
| `client/scripts/augment.js` | 증강 목록 페이지 로직 |
| `client/scripts/augment_popup.js` | 공용 증강 팝업 모듈 (모든 페이지에서 재사용) |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/services/github.js` | `getAugmentList()` 함수 추가 (증강 YAML 전체 로드) |
| `server/routes/api.js` | `GET /api/augment-list` 엔드포인트 추가 |
| `client/scripts/augment_stats.js` | 증강 아이콘 클릭 → 팝업 연동 |
| `client/scripts/user.js` | 게임 카드/모달 증강 아이콘 클릭 → 팝업 연동 |
| `client/augment_stats.html` | `augment_popup.js` 스크립트 추가 |
| `client/user.html` | `augment_popup.js` 스크립트 추가 |
| `client/styles/main.css` | 증강 팝업 오버레이/카드 스타일 추가 |
| 모든 HTML 페이지 (11개) | 헤더에 "증강정보" 네비게이션 버튼 추가 |

### 주요 기능
1. **증강 목록** (`/augment.html`)
   - 1~42번 증강 아이콘을 그리드로 표시 (캐릭터 그리드 스타일 재활용)
   - 클릭 시 팝업으로 이름+설명 표시

2. **공용 팝업 모듈** (`augment_popup.js`)
   - `showAugmentPopup(augmentId)` 전역 함수
   - `/api/augment-list` 데이터를 한 번만 fetch 후 내부 캐싱
   - 마인크래프트 색코드 파싱 지원
   - 화면 중앙 오버레이 + X 버튼/배경 클릭으로 닫기

3. **기존 페이지 연동**
   - 증강 통계 페이지: 아이콘 클릭 → 팝업
   - 유저 전적 페이지: 게임 카드 + 모달 내 증강 아이콘 클릭 → 팝업

### API 엔드포인트
- `GET /api/augment-list` - 전체 증강 목록 반환 `{ augments: [{id, name, description}, ...] }`

### 데이터 구조
```
Data/description/augments/
├── 1.yaml   # {id: 1, name: "다이아몬드 검", description: "&f공격력이 ..."}
├── 2.yaml
└── ... (총 42개)
```

---

## 2026-02-21 작업 내용: 건의/버그 페이지 + Google/GitHub 로그인 추가

### 개요
헤더에 붉은색 "건의/버그" 탭을 추가하고, Google 또는 GitHub으로 로그인한 유저만 건의/버그 글을 작성할 수 있도록 구현.
작성된 글은 GitHub Issues로 자동 등록되며, 목록은 누구나 열람 가능.

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/feedback.html` | 건의/버그 페이지 (Google/GitHub 로그인 + 폼 + 목록) |
| `client/scripts/feedback.js` | 피드백 페이지 로직 (Google GIS + GitHub OAuth 연동) |
| `server/middleware/auth.js` | Google JWT + GitHub 액세스 토큰 검증 미들웨어 |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/server.js` | `express.json()` 미들웨어 추가 (POST body 파싱) |
| `server/services/github.js` | `createFeedbackIssue()`, `getFeedbackIssues()` 함수 추가 |
| `server/routes/api.js` | `GET /api/config`, `POST /api/auth/github`, `POST /api/feedback`, `GET /api/feedback-list` 엔드포인트 추가 |
| `client/styles/main.css` | 붉은 버튼, GitHub 버튼, 피드백 폼/목록/라벨 스타일 추가 |
| 모든 HTML 페이지 (12개) | 헤더에 붉은색 "건의/버그" 네비게이션 버튼 추가 |
| `package.json` | `google-auth-library` 의존성 추가 |

### 주요 기능
1. **Google 로그인** (Google Identity Services)
   - 클라이언트: GIS SDK로 로그인 → ID Token을 localStorage에 저장
   - 서버: `google-auth-library`로 토큰 서명 검증
   - 환경변수 `GOOGLE_CLIENT_ID` 필요

2. **GitHub 로그인** (GitHub OAuth)
   - 클라이언트: GitHub 인증 페이지로 리다이렉트 → code 반환 → 서버에서 액세스 토큰 교환
   - 서버: `POST /api/auth/github`에서 code → access_token 교환, GitHub API로 유저 정보 조회
   - 인증 미들웨어: `Authorization: GitHub <token>` 형식으로 검증
   - 환경변수 `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` 필요

3. **건의/버그 작성** (Google 또는 GitHub 로그인 필수)
   - 카테고리 선택 (버그/건의/기타)
   - 제목 (100자 제한) + 내용 (2000자 제한)
   - GitHub Issues에 자동 등록 (라벨: `user-feedback` + 카테고리)
   - Rate limit: 유저당 10분에 3회

4. **건의/버그 목록** (비로그인도 열람 가능)
   - GitHub Issues API로 `user-feedback` 라벨 Issues 조회
   - 카테고리별 색상 라벨 (버그=빨강, 건의=파랑, 기타=회색)
   - 5분 캐시

### API 엔드포인트
- `GET /api/config` - 클라이언트 설정 (Google Client ID) 반환
- `POST /api/feedback` - 건의/버그 제출 (Google 인증 필수)
- `GET /api/feedback-list` - 건의/버그 목록 조회

### 인증 흐름
```
[Google 로그인]
버튼 클릭 → GIS 팝업 → JWT 토큰 → localStorage 저장
→ API 요청 시 "Authorization: Bearer <jwt>"
→ 서버: google-auth-library로 검증

[GitHub 로그인]
버튼 클릭 → GitHub 페이지 리다이렉트 → code 반환
→ POST /api/auth/github (code → access_token 교환)
→ localStorage 저장
→ API 요청 시 "Authorization: GitHub <token>"
→ 서버: GitHub API /user 호출로 검증
```

### 필요한 환경변수
- `GOOGLE_CLIENT_ID` - Google Cloud Console에서 생성한 OAuth 2.0 클라이언트 ID
- `GITHUB_OAUTH_CLIENT_ID` - GitHub Settings > Developer Settings > OAuth App의 Client ID
- `GITHUB_OAUTH_CLIENT_SECRET` - 같은 OAuth App의 Client Secret

### 필요한 GitHub 라벨
- `user-feedback`, `bug`, `enhancement`, `other` (레포에 미리 생성 필요)

---

## 2026-04-29 작업 내용: 창작 캐릭터 분리 처리

### 개요
4월부터 정식 캐릭터 외에 유저 창작 캐릭터(밸런스 미보장)의 게임 기록도 수집되기 시작.
창작 캐릭터는 캐릭터 정보/통계 페이지에서 제외하고, 유저 전적 페이지에서만 `0.png` + "창작캐릭터{id}" 형태로 표기.

### 캐릭터 분류 규칙
- **정식 캐릭터**: `id ≤ 100` 또는 `id ≥ 900`
- **창작 캐릭터**: `100 < id < 900` (4월부터 추가됨, 4월 데이터 기준 전체 플레이어 기록의 약 63%)

경계값 `100`, `900`은 `client/scripts/character-config.js`에 상수로 정의 (정식 캐릭터 번호 확장 시 이 파일만 수정).

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `client/scripts/character-config.js` | UMD 모듈. `CREATIVE_ID_MIN_EXCLUSIVE`, `CREATIVE_ID_MAX_EXCLUSIVE`, `isCreativeCharacter()`, `isOfficialCharacter()`, `getCreativeCharacterName()` 제공. 서버는 `require()`, 클라이언트는 `<script>` + `window.CharacterConfig` |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `server/services/github.js` | `getCharacterList()`에 `isOfficialCharacter` 필터 적용 |
| `server/utils/statistics.js` | `< 900` 리터럴을 `< CREATIVE_ID_MAX_EXCLUSIVE`로 교체. `computeGlobalCharacterStatistics`는 `!isOfficialCharacter` 조건으로 창작 캐릭터 제외 |
| `client/scripts/character_stats.js` | 클라이언트 필터를 `CharacterConfig.isOfficialCharacter`로 교체 |
| `client/scripts/user.js` | 모스트 캐릭터·캐릭터별 통계 리스트·게임 카드·모달 플레이어 카드에서 창작 캐릭터는 `0.png` + "창작캐릭터{id}" alt/라벨로 표시. 창작 캐릭터는 `/character/{id}` 클릭 비활성화 |
| `client/character_stats.html`, `client/user.html` | `<script src="scripts/character-config.js">` 추가 (페이지 스크립트보다 먼저 로드) |

### 페이지/통계별 집계 정책
| 페이지/통계 | 1~100 (정식) | 100~899 (창작) | 900+ (관리자) |
|---|---|---|---|
| 캐릭터 정보 (`character.html`) | 표시 | **제외** | (description 폴더 없어 미노출) |
| 캐릭터 통계 (`character_stats.html`) | 집계 | **제외** | 제외 (기존 `< 900` 유지) |
| 증강 통계 (`augment_stats.html`) | 집계 | 집계 | 집계 (캐릭터 제한 없음) |
| 랭킹 (`scripts/build-leaderboard.js`) | 집계 | **제외** | 제외 (기존 `< 900` 유지) |
| 유저 전적 (`user.html`) — 통계 수치 | 집계 | 집계 | 제외 (기존 `< 900` 유지) |
| 유저 전적 (`user.html`) — 게임 카드/모스트/캐릭터별 | 정상 표시 | `0.png` + "창작캐릭터{id}" 라벨, 비클릭 | 정상 표시 (날짜 빨강) |

요약: **창작 캐릭터는 유저 전적 페이지(전적 수치 + 게임별 카드)에서만 표시·집계됨.** 캐릭터 통계와 랭킹은 1~100만 집계, 증강 통계는 캐릭터 무관 집계.

---

## 2026-05-08 작업 내용: 캐릭터 정보 페이지 댓글 시스템 추가

### 개요
각 캐릭터 상세 페이지(`/character/:id`) 하단에 디시인사이드 스타일 댓글창 추가.
로그인 없이 매번 닉네임/비밀번호를 입력해서 작성하며, IP 앞 2옥텟이 닉네임 옆에 표시됨.
댓글은 PostgreSQL에 저장되며, 본인 비밀번호 또는 마스터 비밀번호로 삭제 가능.

### 생성된 파일
| 파일 | 설명 |
|------|------|
| `config.js` | 환경변수 → 설정 매핑 (`masterPassword: process.env.MASTER_PASSWORD`) |
| `server/utils/ip.js` | IP 추출 헬퍼 (`getClientIp`, `extractIpv4`, `getIpv4Prefix`) |
| `prisma/migrations/20260508120000_add_character_comments/migration.sql` | `CharacterComment` 테이블 마이그레이션 |

### 수정된 파일
| 파일 | 변경 내용 |
|------|---------|
| `package.json` | `bcryptjs` 의존성 추가 |
| `prisma/schema.prisma` | `CharacterComment` 모델 추가 |
| `server/routes/api.js` | `GET/POST/DELETE /api/character-comments` 엔드포인트 추가 |
| `client/character_detail.html` | 페이지 하단에 댓글 섹션 + 폼 추가 |
| `client/scripts/character_detail.js` | 댓글 작성/삭제/페이지네이션 로직 추가 |
| `client/styles/main.css` | 댓글 섹션 스타일 추가 |

### 댓글 사양
- **로그인 없음** — 매번 닉네임 + 비밀번호 입력
- **닉네임**: 1~15자, 공백 불가
- **비밀번호**: 영문/숫자 4자 (bcrypt 해시 저장)
- **내용**: 1~300자
- **IP 표시**: IPv4 앞 2옥텟 (예: `123.45`). IPv6 환경 거부
- **정렬**: 최신순 (DESC)
- **페이지네이션**: 페이지당 20개
- **Rate limit**: 동일 IPv4 30초당 1회 (인메모리 NodeCache)
- **캐릭터당 최대 100개**: 초과 시 작성 직후 가장 오래된 것부터 자동 삭제
- **삭제**: 작성 시 비밀번호 또는 마스터 비밀번호(env `MASTER_PASSWORD`)로 가능. 마스터 비교는 `crypto.timingSafeEqual` 사용. Hard delete (흔적 없음)

### Prisma 모델
```prisma
model CharacterComment {
  id           Int      @id @default(autoincrement())
  characterId  Int
  nickname     String
  passwordHash String
  ipPrefix     String
  content      String
  createdAt    DateTime @default(now())

  @@index([characterId, createdAt])
}
```

### API 엔드포인트
- `GET /api/character-comments?id=X&page=N` — 댓글 목록 + 페이지네이션 정보
- `POST /api/character-comments` (body: `{characterId, nickname, password, content}`) — 작성
- `DELETE /api/character-comments/:id` (body: `{password}`) — 삭제 (본인 비밀번호 또는 마스터)

### 배포 시 필요한 작업
- Netlify 빌드 시 `prisma migrate deploy`가 자동 실행되어 테이블 생성됨 (`netlify.toml`에 이미 포함)
- 로컬 개발 환경에서는 `npm install` + `npx prisma migrate dev` 실행 필요
- **환경변수 `MASTER_PASSWORD`** 등록 필수 (Netlify Site settings > Environment variables, 로컬은 `.env`). 미설정 시 마스터 삭제 기능 비활성화 (본인 비밀번호 삭제는 정상 동작)

---

## 페이지 목록
1. `index.html` - 메인 (닉네임 검색)
2. `user.html` - 유저 프로필
3. `ranking.html` - 랭킹
4. `character.html` - 캐릭터 목록 (캐릭터정보)
5. `character_detail.html` - 캐릭터 상세
6. `character_stats.html` - 캐릭터 통계
7. `augment.html` - 증강 목록 (증강정보)
8. `augment_stats.html` - 증강 통계
9. `weapon_detail.html` - 무기 상세 (상단바 미노출, 스킬 클릭으로만 진입)
10. `titan_list.html` - 타이탄 목록 (상단바 미노출, 스킬 클릭으로만 진입)
11. `titan_detail.html` - 타이탄 상세 (상단바 미노출, 목록에서 클릭으로 진입)
12. `feedback.html` - 건의/버그 (Google 로그인 필요, 붉은 탭)

---

## 작업 규칙
- 커밋 후 자동으로 push까지 수행
- 작업 내용은 CLAUDE.md에 기록

---

## 추후 작업 예정
- (사용자가 추가할 내용)
