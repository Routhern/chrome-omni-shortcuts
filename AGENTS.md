# AGENTS.md

이 문서는 이 저장소에서 작업하는 자동화 에이전트와 사람 개발자가 공통으로 참고하는 운영 지침입니다.

## 프로젝트 개요

Chrome-OmniShortcut은 여러 개의 독립적인 Chrome 확장 프로그램 패키지를 제공하는 저장소입니다. 각 확장은 브라우저 툴바 버튼을 클릭했을 때 사용자가 저장한 대상 URL로 현재 탭을 이동시키는 단순한 바로가기 역할을 합니다.

현재 패키지는 `extensions/shortcut-1`부터 `extensions/shortcut-9`까지 존재합니다. 구현 파일은 동일하고, 각 확장의 표시 이름만 `Omni-Shortcut 1`처럼 번호를 달리합니다.

## 저장소 구조

- `extensions/shortcut-*/manifest.json`: Chrome Manifest V3 확장 설정
- `extensions/shortcut-*/background.js`: 툴바 버튼 클릭과 시작 시 아이콘 복원을 처리하는 서비스 워커
- `extensions/shortcut-*/option.html`: 옵션 페이지 마크업
- `extensions/shortcut-*/option.css`: 옵션 페이지 스타일
- `extensions/shortcut-*/option.js`: URL 저장, favicon 조회, 아이콘 저장 로직
- `src/extension-template/`: 모든 shortcut 패키지의 공통 원본
- `config/extensions.json`: 생성 개수와 번호별 문구 템플릿
- `scripts/generate-extensions.js`: `extensions/shortcut-*` 결과물 생성 스크립트
- `docs/`: 사용자와 유지보수자를 위한 공개 문서
- `docs/dev/`: 로컬 개발용 작업 문서. `.gitignore`에 등록되어 기본 커밋 대상이 아닙니다.

## 작업 원칙

1. 기존 `shortcut-*` 패키지 간 동작을 동일하게 유지합니다.
2. 공통 동작을 수정할 때는 `src/extension-template/`를 먼저 수정하고 `node scripts\generate-extensions.js`를 실행합니다.
3. Chrome 확장 권한을 추가할 때는 `README.md`와 `docs/ARCHITECTURE.md`에 이유를 문서화합니다.
4. 사용자에게 보이는 문구나 옵션 흐름을 바꾸면 README 사용 절차도 갱신합니다.
5. 변경 이력은 `docs/CHANGELOG.md`에 Keep a Changelog 형식으로 기록합니다.

## 개발 및 검증

현재 별도의 빌드, 패키지 매니저, 자동 테스트 설정은 없습니다. 검증은 Chrome의 확장 관리 페이지에서 압축해제된 확장 프로그램으로 각 `extensions/shortcut-*` 디렉터리를 로드해 수동으로 수행합니다.

확장 결과물을 다시 만들 때는 다음 명령을 사용합니다.

```powershell
node scripts\generate-extensions.js
```

수동 확인 항목:

- 확장 로드 시 Manifest V3 오류가 없는지 확인
- 옵션 페이지에서 URL 저장 가능 여부 확인
- 저장 후 툴바 아이콘이 대상 사이트 favicon으로 바뀌는지 확인
- 툴바 버튼 클릭 시 현재 탭이 저장된 URL로 이동하는지 확인
- 브라우저 재시작 후 저장된 아이콘과 URL이 유지되는지 확인

## 문서 관리

공개 문서는 저장소 루트와 `docs/` 아래에 둡니다. 작업 메모, 감사 로그, 작업 목록, 결정 초안, PR 문구 초안은 `docs/dev/` 아래에 둡니다. `docs/dev/`는 로컬 작업 공간으로 취급하므로 필요한 내용만 정리한 뒤 공개 문서로 옮깁니다.

## 주의할 점

- `chrome.storage.sync`는 사용자 Chrome 계정 동기화 영역을 사용합니다. 저장 데이터 크기와 동기화 지연을 고려해야 합니다.
- favicon은 Google favicon endpoint에서 가져옵니다. 네트워크 실패나 favicon 미제공 사이트에 대한 예외 처리를 유지해야 합니다.
- 모든 사이트 접근 권한인 `<all_urls>`는 사용하지 않습니다. favicon 조회는 `https://t0.gstatic.com/*` 범위에서만 수행합니다.
- 현재 URL 유효성 검사는 빈 값 확인 수준입니다. 프로토콜 누락, 잘못된 URL, Chrome 내부 URL 등은 추가 정책 결정이 필요합니다.

## 의사 소통

- 사용자와의 모든 의사소통, 발화, 안내, 주석 작성, PR 초안 작성 등은 `한국어`로 수행합니다.
