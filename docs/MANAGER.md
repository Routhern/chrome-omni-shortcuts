# Omni-Shortcut Manager

이 문서는 브라우저 기반 GUI 숏컷 매니저의 구조와 사용법을 설명합니다.

## 개요

숏컷 매니저는 CLI 생성 스크립트(`scripts/generate-extensions.js`)를 감싸는 로컬 GUI입니다. Node 내장 모듈만 사용하며 npm 의존성이 없습니다.

```powershell
node scripts\manager.js
```

- 서버는 `127.0.0.1:8151`에만 바인딩됩니다. 포트는 `OMNI_MANAGER_PORT` 환경변수로 변경할 수 있습니다.
- 실행 시 기본 브라우저가 자동으로 열립니다. `--no-open` 인자로 자동 열기를 끌 수 있습니다.

## 기능

### 패키지 개수 관리

개수(1–64)를 입력하고 `Save & Generate`를 누르면 `config/extensions.json`의 `count`가 갱신되고 `extensions/shortcut-*`가 재생성됩니다. `prune` 스위치를 켜면 줄어든 번호의 디렉터리도 함께 제거됩니다.

### 중앙 URL 콘테이너

숏컷별 `label`, `url`, `key`는 `config/extensions.json`의 `shortcuts` 객체에 저장됩니다.

```json
"shortcuts": {
  "1": { "label": "Mail", "url": "https://mail.google.com/", "key": "" }
}
```

- `url`은 `http://` 또는 `https://`로 시작해야 하며, 생성 시 각 패키지의 `background.js`에 `DEFAULT_TARGET_URL`로 주입됩니다. 확장별 옵션 페이지는 제거되었으므로 매니저가 URL의 유일한 편집 지점입니다. URL 변경 후에는 재생성하고 Chrome에서 해당 확장을 새로고침해야 반영됩니다.
- 매니저 목록에서 각 URL의 favicon 미리보기와 바로 열기 링크를 제공합니다.

### JSON 내보내기 / 가져오기

- `Export JSON`: 현재 `count`와 `shortcuts` 전체를 `omni-shortcut-config.json` 파일로 다운로드합니다. 백업이나 다른 기기로의 이전에 사용합니다.
- `Import JSON`: 내보낸 형식(또는 `count`/`shortcuts`를 포함한 임의의 JSON 객체)을 읽어 서버 검증을 거쳐 `config/extensions.json`에 저장합니다. `shortcuts`는 전체 교체 방식이므로 파일에 없는 번호의 항목은 사라집니다. 가져온 뒤 `Save & Generate`로 재생성하세요.

### Manifest key (숏컷 해시) 관리

`key`는 Chrome Manifest V3의 `key` 필드로 주입되는 base64 공개키입니다. 같은 key를 가진 확장은 어느 기기(Windows/macOS)에서 로드해도 동일한 확장 ID를 갖게 되어 `chrome.storage.sync` 데이터가 기기 간에 연동됩니다.

key를 얻는 일반적인 방법: 확장을 한 번 `.crx`로 패키징하거나 Chrome 웹 스토어 개발자 대시보드에서 확인한 공개키를 복사해 붙여넣습니다.

### 테마와 언어

- 라이트/다크/자동 테마 전환 (Pico CSS의 `data-theme` 사용, localStorage에 저장)
- UI 언어는 영어(기본)와 한국어를 지원합니다. 문구는 `src/manager/i18n/en.json`, `src/manager/i18n/ko.json`에서 관리합니다.

## 구조

```text
scripts/
  manager.js          # Node http 서버 + JSON API
src/manager/
  index.html          # 매니저 UI 마크업
  app.js              # UI 로직 (i18n, 테마, API 호출)
  manager.css         # Pico 위에 얹는 보조 스타일
  assets/pico.min.css # 벤더링된 Pico CSS v2
  i18n/en.json        # 영어 문구
  i18n/ko.json        # 한국어 문구
```

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/state` | 현재 설정과 디스크의 `shortcut-*` 목록 반환 |
| PUT | `/api/config` | `count`, `shortcuts` 갱신 (검증 후 `config/extensions.json`에 저장) |
| POST | `/api/generate` | 설정 기준으로 재생성. body `{"prune": true}`로 정리 가능 |

`PUT /api/config`의 `shortcuts`는 전체 교체(replace) 방식입니다. UI는 항상 기존 항목을 병합해 전체를 전송합니다.

## 보안 고려사항

- 루프백(127.0.0.1) 전용이며 외부에서 접근할 수 없습니다.
- 정적 파일은 `src/manager/` 내부로만 제한되고 경로 탈출은 403/404로 차단됩니다.
- URL은 `http(s)://` 접두사, key는 base64 문자만 허용하도록 서버에서 검증합니다.
