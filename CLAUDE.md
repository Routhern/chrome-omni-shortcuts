# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

chrome-omni-shortcuts는 툴바 버튼 클릭 시 저장된 URL로 현재 탭을 이동시키는 동일 기능의 Chrome 확장(Manifest V3) 묶음을 제공하는 저장소입니다. 패키지는 `shortcut-01`부터 두 자리 번호로 생성되며(기본 10개, 1~64개 조정 가능), 빌드 도구·패키지 매니저·자동 테스트 없이 순수 JS/HTML/CSS로 구성됩니다.

## 핵심 명령

```powershell
# 템플릿과 설정으로 extensions/shortcut-* 결과물 재생성
node scripts\generate-extensions.js

# 다른 개수로 생성 / 줄일 때 남는 디렉터리 제거
node scripts\generate-extensions.js --count 13
node scripts\generate-extensions.js --count 7 --prune

# GUI 숏컷 매니저 (127.0.0.1:8151, --no-open으로 자동 브라우저 열기 끄기)
node scripts\manager.js
```

검증은 자동화되어 있지 않습니다. `chrome://extensions`에서 개발자 모드로 `extensions/shortcut-*` 디렉터리를 압축해제 로드해 수동 확인합니다: Manifest 오류 없음, 매니저에서 URL 저장·재생성 후 확장 새로고침 시 아이콘이 favicon으로 변경, 버튼 클릭 시 탭 이동, 브라우저 재시작 후 유지.

## 아키텍처 (생성 파이프라인)

**절대 `extensions/shortcut-*`를 직접 수정하지 말 것.** 이들은 생성 결과물입니다. 공통 동작 수정 흐름:

1. `src/extension-template/` 수정 (모든 패키지의 단일 원본)
2. 번호별 문구·개수는 `config/extensions.json`의 템플릿(`{digit}` 토큰), 숏컷별 URL·manifest key는 같은 파일의 `shortcuts` 맵 수정
3. `node scripts\generate-extensions.js` 실행으로 `extensions/shortcut-NN` 재생성 (두 자리 번호)

`config/extensions.json`의 `shortcuts[digit]`은 `{ label, url, key }` 구조입니다. `url`은 생성 시 `background.js`의 `DEFAULT_TARGET_URL`로 주입되고, `key`는 manifest의 `key` 필드가 되어 기기 간 확장 ID를 고정합니다.

### 숏컷 매니저 (scripts/manager.js + src/manager/)

GUI 매니저는 npm 의존성 없는 Node http 서버로, `generate-extensions.js`를 모듈로 require해 재사용합니다. API: `GET /api/state`, `PUT /api/config`(count·shortcuts 전체 교체 방식), `POST /api/generate`. UI는 Pico CSS 벤더링(`src/manager/assets/pico.min.css`) + `src/manager/i18n/{en,ko}.json` 2개 국어(기본 영어)입니다. 문구를 추가할 때는 두 언어 파일 모두 갱신할 것. 설정 JSON 내보내기/가져오기는 클라이언트에서 처리하되 저장은 `PUT /api/config` 검증을 거칩니다.

`scripts/generate-extensions.js`는 템플릿 파일의 `__SHORTCUT_NAME__`, `__SHORTCUT_DESCRIPTION__`, `__SHORTCUT_ACTION_TITLE__` 등의 플레이스홀더를 config 템플릿 값으로 치환합니다.

### 확장 내부 구조 (src/extension-template/)

확장은 `manifest.json` + `background.js` 두 파일뿐입니다. 옵션 페이지는 제거되었고 URL 설정은 매니저에서만 합니다.

- `background.js` — 서비스 워커 단독으로 모든 동작 처리. `StorageManager`(URL 결정: `DEFAULT_TARGET_URL` → 레거시 sync `targetUrl` → `chrome://newtab`), `FaviconManager`(Google favicon endpoint 조회, 실패 시 호스트명 첫 글자 fallback 아이콘, OffscreenCanvas 사용), `IconManager`(`onInstalled`/`onStartup`에 아이콘 설정, `chrome.storage.local`에 픽셀 캐시), `TabManager`(버튼 클릭 시 탭 이동).

## 제약 및 규칙 (AGENTS.md 요약)

- `<all_urls>` 권한 금지. favicon 조회는 `https://t0.gstatic.com/*` host_permission 범위 내에서만 수행.
- 권한 추가 시 이유를 `README.md`와 `docs/ARCHITECTURE.md`에 문서화.
- 사용자에게 보이는 문구나 옵션 흐름 변경 시 README 사용 절차도 갱신.
- 변경 이력은 `docs/CHANGELOG.md`에 Keep a Changelog 형식으로 기록.
- `docs/dev/`는 gitignore된 로컬 작업 공간 — 작업 메모·초안은 여기에, 공개 문서는 루트와 `docs/`에.
- 모든 의사소통, 주석, PR 문구는 한국어로 작성.
