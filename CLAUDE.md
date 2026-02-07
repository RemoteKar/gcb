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

## 페이지 목록
1. `index.html` - 메인 (닉네임 검색)
2. `user.html` - 유저 프로필
3. `ranking.html` - 랭킹
4. `character.html` - 캐릭터 목록 (캐릭터정보)
5. `character_detail.html` - 캐릭터 상세
6. `character_stats.html` - 캐릭터 통계
7. `augment_stats.html` - 증강 통계

---

## 추후 작업 예정
- (사용자가 추가할 내용)
