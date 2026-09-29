# Chrome Omni-Shortcuts Manager

이 문서는 브라우저 기반 GUI 숏컷 매니저의 구조와 사용법을 설명합니다.

## 개요

숏컷 매니저는 Chrome에서 직접 실행하는 로컬 HTML 앱입니다. Node.js, npm, 서버, 포트 설정이 필요 없습니다.

1. `src/manager/index.html`을 Chrome에서 엽니다. macOS에서는 `open-manager.command`, Windows에서는 `Open-Manager.bat` 또는 `Open-Manager.vbs`를 사용할 수도 있습니다.
2. Windows 런처는 기본 브라우저를 사용합니다. Chrome이 아니면 HTML 파일을 Chrome으로 직접 여세요.
3. **프로젝트 폴더 선택**을 눌러 저장소 루트를 선택하고 파일 편집을 허용합니다. 폴더를 선택하기 전에는 편집 버튼이 비활성화됩니다.
4. 매니저를 다시 열면 폴더를 다시 선택합니다. 선택을 취소하거나 잘못된 폴더를 고르면 기존 파일은 변경하지 않습니다.

## 기능

### 패키지 개수 관리

개수(1–64)를 입력하고 `Save & Generate`를 누르면 `config/extensions.json`의 `count`가 갱신되고 `extensions/shortcut-*`가 재생성됩니다. `prune` 스위치를 켜면 줄어든 번호의 디렉터리도 함께 제거됩니다.

### 생성 모드

`manifestKeyMode`는 재생성 시 manifest `key` 필드를 넣을지 결정합니다.

- `omit`(로컬 안전 모드, 권장): 생성된 manifest에 `key`를 넣지 않습니다. 이 PC의 Chrome 프로필에서 압축해제 확장이 재시작 후 사라지던 문제를 피하기 위한 기본값입니다. `config/extensions.json`의 key 값은 보관만 합니다.
- `include`(고정 ID 모드): 생성된 manifest에 key를 넣어 확장 ID를 고정합니다. 활성 숏컷의 key가 모두 유효하고 중복 ID가 없어야 생성됩니다.

### 중앙 URL 콘테이너

숏컷별 `label`, `url`, `key`는 `config/extensions.json`의 `shortcuts` 객체에 저장됩니다.

```json
"manifestKeyMode": "omit",
"shortcuts": {
  "1": { "label": "Mail", "url": "https://mail.google.com/", "key": "" }
}
```

- `url`은 `http://` 또는 `https://`로 시작해야 하며, 생성 시 각 패키지의 `background.js`에 `DEFAULT_TARGET_URL`로 주입됩니다. 확장별 옵션 페이지는 제거되었으므로 매니저가 URL의 유일한 편집 지점입니다. URL 변경 후에는 재생성하고 Chrome에서 해당 확장을 새로고침해야 반영됩니다.
- 숏컷 목록은 테이블 형태이며 행마다 이름·URL·manifest key를 바로 편집합니다.
- URL 입력 옆 `Validate` 버튼은 URL 형식(http/https, 호스트명)을 검사하고 favicon 미리보기와 열기 링크를 갱신합니다.
- Manifest key 입력 옆 `키 생성`(New key) 버튼은 브라우저 Web Crypto에서 RSA-2048 공개키를 새로 만들어 입력란을 채우고, 그 key로 고정될 확장 ID를 보여줍니다.
- Manifest key 입력 옆 `ID` 버튼은 key가 실제 base64 공개키(SPKI)인지 검사하고, 그 key로 고정될 Chrome 확장 ID(32자 a–p 문자열)를 계산해 보여줍니다. 32자 확장 ID를 key 자리에 넣으면 오류로 안내합니다.
- 상단의 `키 상태 다시 검사` 버튼은 활성 숏컷 범위의 key를 감사(audit)해 누락/형식오류/중복 확장 ID를 표시합니다. 로컬 안전 모드에서는 key가 생성물에 주입되지 않으므로 감사 결과도 생략 상태로 표시됩니다.
- `문제 키 자동복구` 버튼은 고정 ID 모드에서 누락 key, 잘못된 key, 중복 확장 ID key를 새 RSA-2048 key로 교체하고 즉시 `config/extensions.json`에 저장한 뒤, 확장 패키지 재생성까지 연속으로 실행합니다.
- `Save & Generate`는 실행 전에 덮어쓰기(및 prune 시 삭제) 내용을 페이지 안의 확인 창으로 다시 한 번 보여 줍니다. 브라우저의 네이티브 JS 대화상자 차단 정책에 덜 영향을 받습니다.

### JSON 내보내기 / 가져오기

- `Export JSON`: 현재 `count`와 `shortcuts` 전체를 `omni-shortcut-config.json` 파일로 다운로드합니다. 백업이나 다른 기기로의 이전에 사용합니다.
- `Import JSON`: 내보낸 형식(또는 `count`/`shortcuts`를 포함한 임의의 JSON 객체)을 읽어 브라우저 검증을 거쳐 `config/extensions.json`에 저장합니다. `shortcuts`는 전체 교체 방식이므로 파일에 없는 번호의 항목은 사라집니다. 가져온 뒤 `Save & Generate`로 재생성하세요.

### Manifest key (숏컷 해시) 관리

`key`는 Chrome Manifest V3의 `key` 필드로 주입되는 base64 공개키입니다. 같은 key를 가진 확장은 어느 기기(Windows/macOS)에서 로드해도 동일한 확장 ID를 갖게 되어 `chrome.storage.sync` 데이터가 기기 간에 연동됩니다.

**주의: 확장 ID(32자 a–p 문자열)는 key가 아닙니다.** key는 base64로 인코딩된 RSA 공개키(SPKI DER, 보통 `MIIB…`로 시작하는 긴 문자열)이며, 확장 ID는 그 key의 SHA-256 해시에서 파생되는 결과값입니다. key 자리에 확장 ID를 넣으면 Chrome이 manifest 로드에 실패하고, **로드에 실패한 압축해제 확장은 브라우저 재시작 시 목록에서 제거됩니다.**

key를 얻는 방법: 매니저의 `키 생성` 버튼을 누르면 브라우저가 새 RSA 키를 만들어 채워 줍니다. 또는 확장을 한 번 `.crx`로 패키징하거나 Chrome 웹 스토어 개발자 대시보드에서 확인한 공개키를 붙여넣어도 됩니다.

매니저는 key를 저장할 때 아래를 강제합니다.

- 공백 제거 후 canonical base64 형식
- DER(SPKI) 공개키 파싱 가능
- RSA 공개키
- RSA 2048비트 이상

또한 key 감사(audit)는 유효 key라도 같은 확장 ID를 만들면 중복 충돌로 표시합니다.

### 테마와 언어

- 라이트/다크/자동 테마 전환 (Pico CSS의 `data-theme` 사용, localStorage에 저장)
- UI 언어는 영어(기본)와 한국어를 지원합니다. 문구는 `src/manager/i18n/en.js`, `src/manager/i18n/ko.js`에서 관리합니다.

## 구조 및 파일 접근

- `index.html`, `app.js`: UI, 테마, JSON 가져오기/내보내기
- `workspace.js`: 설정 검증, File System Access API로 읽기·쓰기·생성, Web Crypto 키 생성·감사·복구
- `i18n/en.js`, `i18n/ko.js`: 로컬 파일에서도 서버 없이 읽을 수 있는 번역 스크립트
- `assets/pico.min.css`, `manager.css`: 스타일

HTTP API는 제거되었습니다. `/api/...` 문자열은 기존 UI 응답 형태를 유지하는 로컬 함수의 작업 식별자일 뿐 네트워크 요청을 보내지 않습니다. 파일 접근은 사용자가 선택하고 편집 권한을 허용한 프로젝트 폴더로 제한됩니다. URL은 실제 파싱 후 http/https 및 호스트명을 검증합니다. 출력은 `extensions` 아래 `shortcut-숫자` 폴더로 제한합니다.

Chrome의 File System Access API와 Web Crypto 지원이 필요합니다. 지원하지 않는 브라우저에서는 Chrome으로 열라는 안내가 표시됩니다. favicon 미리보기는 기존처럼 Google endpoint를 사용합니다.
