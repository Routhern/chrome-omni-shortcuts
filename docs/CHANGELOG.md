# Changelog

이 문서는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르며, 버전 번호는 가능한 경우 [Semantic Versioning](https://semver.org/)을 기준으로 관리합니다.

## [Unreleased]

### Added

- 저장소 문서 초안 추가
- 사용자용 `README.md` 초안 추가
- 아키텍처 설명 문서 추가
- 문제 해결 문서 `docs/TROUBLESHOOTING.md` 추가
- 에이전트 작업 지침 문서 추가
- 로컬 개발 문서 집합을 위한 `docs/dev/` 작업 공간 추가
- 옵션 페이지 URL 검증 정책 추가
- favicon 후보 탐색, 다크/라이트 모드 우선순위, 기본 아이콘 fallback 추가
- 확장 패키지 공동 관리를 위한 템플릿 기반 생성 파이프라인 추가
- shortcut 번호를 포함하는 `Target URL access via shortcut {digit}` 문구 추가
- 브라우저 기반 GUI 숏컷 매니저 추가 (`node scripts\manager.js`, npm 의존성 없음)
- 숏컷별 `label`/`url`/`key`를 보관하는 중앙 `shortcuts` 콘테이너를 `config/extensions.json`에 추가
- 매니저에 라이트/다크 테마 전환과 영어/한국어 UI(i18n JSON) 추가
- 생성 시 중앙 URL을 각 패키지의 기본 대상 URL(`DEFAULT_TARGET_URL`)로 주입하는 기능 추가
- 매니저 문서 `docs/MANAGER.md` 추가
- 매니저에 설정 JSON 내보내기/가져오기 기능 추가
- 더블클릭 실행용 런처 `Open-Manager.bat`(Windows), `open-manager.command`(macOS) 추가
- 숏컷 목록에 URL `Validate` 버튼과 manifest key `ID`(확장 ID 계산) 버튼 추가
- 재생성 전 덮어쓰기·삭제 내용을 알리는 확인 창 추가
- README에 수동 확장 로드·핀 고정 가이드 추가
- 매니저에 manifest key 생성 버튼과 `POST /api/keygen` API 추가 (RSA-2048 공개키 + 확장 ID 반환)
- Manifest key 감사/복구 기능 추가: `GET /api/key-audit`, `POST /api/key-autofix`, UI의 키 상태 패널/행별 경고/자동복구 버튼
- UI 자동복구 버튼이 key 교체 후 확장 재생성까지 자동으로 이어지도록 개선
- 각 숏컷 패키지에 Chrome 시작 직후 표시할 공통 SVG 기본 아이콘 추가
- manifest key가 있는 압축해제 확장을 거부하는 Chrome 프로필을 위한 `--no-manifest-key` 생성 옵션 추가
- 다중 `--load-extension`을 영구 등록 해결책으로 안내하던 문구를 수동 로드 기준으로 정정
- Chrome 프로필 확장 등록부/동기화 문제를 조사하며 사용한 로컬 진단·복구 도구를 `docs/dev/` 아래 비공개 작업 자료로 분리
- Chrome 동기화/확장 등록부 꼬임으로 압축해제 확장이 재시작 후 사라졌던 원인과 복구 절차 문서화
- 매니저와 생성기에 `manifestKeyMode` 추가: 기본값은 manifest key를 생략하는 로컬 안전 모드, 고정 ID 모드는 명시 선택

### Fixed

- manifest `key`에 base64 공개키 대신 32자 확장 ID가 저장되던 문제 수정. 잘못된 key가 주입된 확장은 Chrome 재시작 시 로드에 실패해 목록에서 사라졌음. 서버·클라이언트 key 검증을 base64 문자 검사에서 실제 SPKI 공개키 파싱 검증으로 강화하고, `config/extensions.json`의 기존 잘못된 key 9개를 유효한 키로 교체
- 매니저의 `Save & Generate`가 브라우저 네이티브 `window.confirm()` 대화상자에 막혀 생성이 진행되지 않던 환경을 위해, 페이지 내부 `dialog` 기반 확인 창으로 교체
- 확장 재시작 후 사라짐 이슈를 줄이기 위해 key 저장 검증을 강화(공백 제거 canonical base64, DER SPKI, RSA, 2048비트 이상)하고 key 중복 확장 ID 충돌을 감지/자동복구하도록 개선
- `action.default_icon`과 manifest `icons`를 `icon.svg`로 통일해 favicon 동적 설정 전에도 툴바와 확장 관리 화면에 기본 아이콘이 보이도록 수정
- 매니저 재생성이 기본적으로 manifest key를 다시 주입해 Chrome 프로필 등록부/동기화 꼬임을 재발시킬 수 있던 경로 차단
- 확장 서비스 워커의 URL, storage, favicon, 탭 이동 예외 처리를 강화해 비정상 값은 `chrome://newtab` 또는 런타임 fallback 아이콘으로 처리

### Changed

- `docs/dev/` 디렉터리를 로컬 개발 문서 영역으로 분리하고 `.gitignore`에 등록
- 스킴이 없는 사용자 입력 URL을 `https://`로 자동 보정하도록 변경
- favicon 저장 로직을 단일 endpoint 의존 방식에서 다중 후보 탐색 방식으로 변경
- 모든 사이트 접근 권한을 제거하고 favicon 조회 host permission을 `https://t0.gstatic.com/*`로 축소
- 사용하지 않는 `activeTab` 권한 제거
- 공통 확장 코드를 `src/extension-template/`에서 관리하도록 구조화
- `config/extensions.json`의 `manifestKeys`를 `shortcuts[digit].key`로 통합
- `scripts/generate-extensions.js`를 모듈로 분리해 매니저 서버에서 재사용 가능하도록 변경
- favicon 조회와 아이콘 설정을 배경 서비스 워커로 이동해 확장이 로드 시 자동으로 아이콘을 설정하도록 변경
- 아이콘 캐시를 `chrome.storage.sync`에서 `chrome.storage.local`로 이동 (URL은 패키지에 주입되므로 동기화 불필요)
- 생성 직후 manifest 구조, 아이콘 참조, 권한, key 포함/생략 상태를 검증하도록 생성 파이프라인 강화
- 매니저의 생성/자동복구 확인 흐름을 페이지 내부 dialog 기반으로 통일
- 생성 개수 상한을 99개에서 64개로 변경
- shortcut 번호를 두 자리(`01`) 형식으로 변경 (`shortcut-01`, `Omni-Shortcut 01`)
- GitHub 저장소 이름을 `chrome-omni-shortcuts`(케밥 케이스)로 변경
- 매니저 숏컷 목록을 접기/펼치기 방식에서 테이블 방식으로 변경
- 매니저 타이틀을 `Chrome Omni-Shortcuts Manager`(한국어: `크롬 Omni-Shortcuts 매니저`)로 변경

### Removed

- 레거시 확장별 옵션 페이지(`option.html`/`option.css`/`option.js`) 제거. URL 설정은 숏컷 매니저에서 중앙 관리
- 구버전 `manifestKeys` 최상위 필드의 fallback 인식 제거 (`shortcuts[digit].key`만 사용)
- 제거된 옵션 페이지용 레거시 규격 삭제: config의 `optionPageTitleTemplate`/`optionHeadingTemplate` 필드와 생성기의 `__SHORTCUT_OPTION_PAGE_TITLE__`/`__SHORTCUT_OPTION_HEADING__` 플레이스홀더
- 번호별로 생성하던 레거시 PNG 아이콘(`icons/icon-*.png`) 제거

## [1.0.0] - 2025-01-24

### Added

- `Omni-Shortcut 1`부터 `Omni-Shortcut 9`까지 Chrome 확장 패키지 추가
- URL 저장 옵션 페이지 추가
- 저장된 URL로 현재 탭을 이동하는 툴바 버튼 동작 추가
- 대상 사이트 favicon을 확장 아이콘으로 저장하는 기능 추가
