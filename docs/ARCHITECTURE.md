# Architecture

이 문서는 chrome-omni-shortcuts의 현재 구조와 주요 동작 흐름을 설명합니다.

## 목표

chrome-omni-shortcuts는 사용자가 지정한 URL을 Chrome 툴바 버튼으로 빠르게 여는 확장 프로그램 모음입니다. 하나의 확장에 여러 바로가기를 넣는 방식이 아니라, 같은 구현을 가진 여러 독립 확장을 나란히 설치하는 방식으로 여러 바로가기를 제공합니다.

## 패키지 구성

각 확장 패키지는 `extensions/shortcut-N` 디렉터리에 있습니다. 이 디렉터리들은 `src/extension-template/`와 `config/extensions.json`을 기반으로 생성됩니다.

```text
config/
  extensions.json
src/
  extension-template/
scripts/
  generate-extensions.js
extensions/shortcut-N/
  manifest.json
  background.js
```

패키지 디렉터리는 `shortcut-01`부터 두 자리 번호로 생성됩니다. 개수는 설정이나 생성 스크립트 인자로 1개부터 64개까지 조정할 수 있습니다.

## Chrome 확장 구성

각 확장은 Manifest V3 기반입니다.

- `background.service_worker`: `background.js`
- `action.default_title`: 툴바 버튼 제목
- `action.default_icon`: Chrome 시작 직후 표시할 번호 기반 PNG 아이콘
- `icons`: 확장 관리 화면과 툴바 fallback용 PNG 아이콘
- `permissions`: `storage`, `tabs`
- `host_permissions`: `https://t0.gstatic.com/*`

확장별 옵션 페이지는 없습니다. 대상 URL은 숏컷 매니저(`docs/MANAGER.md`)에서 중앙 관리하고, 생성 시 `background.js`의 `DEFAULT_TARGET_URL` 상수로 주입됩니다.

각 확장의 `description`과 `action.default_title`에는 shortcut 번호가 포함됩니다. 기본 문구는 `Target URL access via shortcut {digit}`입니다.

## 런타임 흐름

### URL 설정

1. 사용자가 숏컷 매니저에서 숏컷별 대상 URL을 입력하고 저장합니다.
2. 매니저 서버가 URL을 검증(`http://`/`https://`만 허용)해 `config/extensions.json`의 `shortcuts[digit].url`에 기록합니다.
3. 생성 스크립트가 URL을 각 패키지 `background.js`의 `DEFAULT_TARGET_URL` 상수로 주입합니다.
4. 사용자가 Chrome에서 해당 확장을 새로고침하면 새 URL이 반영됩니다.

레거시 호환: `DEFAULT_TARGET_URL`이 비어 있으면 과거 옵션 페이지가 `chrome.storage.sync`에 저장했던 `targetUrl`을 fallback으로 읽습니다. 그것도 없으면 `chrome://newtab`을 사용합니다.

## Favicon 정책

각 패키지는 생성 시 `icons/icon-{size}.png` 기본 아이콘을 포함합니다. 이 아이콘은 Chrome 시작 직후와 확장 관리 화면에서 먼저 표시됩니다. 대상 사이트 favicon 설정은 `background.js` 서비스 워커가 `onInstalled`/`onStartup` 시점에 수행합니다.

1. 대상 URL이 `http(s)`가 아니면 manifest의 기본 PNG 아이콘을 그대로 둡니다.
2. `chrome.storage.local`에 같은 URL로 캐시된 아이콘 픽셀이 있으면 그대로 복원합니다.
3. 없으면 Google favicon endpoint에서 대상 URL의 32px favicon을 조회해 `OffscreenCanvas`에 그립니다.
4. 조회 또는 이미지 검증이 실패하면 호스트명 첫 글자를 사용한 런타임 기본 아이콘을 생성합니다.
5. `chrome.action.setIcon()`으로 아이콘을 설정하고 픽셀 데이터를 `chrome.storage.local`에 캐시합니다.

이 정책은 모든 사이트 접근 권한인 `<all_urls>` 없이 동작하도록 설계했습니다. 대상 사이트의 HTML을 직접 읽지 않기 때문에 다크/라이트 모드별 favicon 후보 추출은 지원하지 않습니다.

## URL 정책

매니저에 저장할 수 있는 URL은 서버에서 검증합니다.

- `http://` 또는 `https://`로 시작해야 합니다.
- 빈 값은 허용됩니다(해당 숏컷은 `chrome://newtab` 동작).

`mailto:`, `ftp://`, `chrome://`, `javascript:` 같은 스킴은 허용하지 않습니다. 내부 기본값 `chrome://newtab`은 사용자 입력 정책과 별도로 `background.js`에서만 사용합니다.

### 바로가기 실행

1. 사용자가 Chrome 툴바의 확장 아이콘을 클릭합니다.
2. `background.js`의 `chrome.action.onClicked` listener가 실행됩니다.
3. `StorageManager.getTargetUrl()`이 `DEFAULT_TARGET_URL`(비어 있으면 레거시 sync 값, 그것도 없으면 `chrome://newtab`)을 반환합니다.
4. `chrome.tabs.update({ url: targetUrl })`로 현재 탭을 이동합니다.

## 데이터 모델

| 위치 | Key | Type | 설명 |
| --- | --- | --- | --- |
| 생성 시 주입 | `DEFAULT_TARGET_URL` | string | 툴바 버튼 클릭 시 이동할 대상 URL |
| `chrome.storage.local` | `iconUrl` | string | 캐시된 아이콘의 대상 URL |
| `chrome.storage.local` | `iconPixels` | number[] | 32×32 RGBA 픽셀 배열 |
| `chrome.storage.sync` (레거시) | `targetUrl` | string | 제거된 옵션 페이지가 저장했던 URL. fallback으로만 사용 |

`chrome.storage.sync`는 같은 Chrome 계정에서 동기화될 수 있지만, 동기화 범위는 확장 ID 단위입니다. Windows, macOS, 여러 사용자 환경에서 같은 shortcut 설정을 공유하려면 각 생성 패키지의 확장 ID가 동일하게 유지되어야 합니다. Chrome Web Store 배포 ID를 사용하거나, 개발 배포에서는 `config/extensions.json`의 `shortcuts[digit].key`로 번호별 manifest key를 관리합니다.

압축해제 확장의 설치/활성화 상태는 이 저장소가 아니라 Chrome 프로필의 `Preferences`/`Secure Preferences`와 확장 상태 폴더가 관리합니다. 해당 등록부가 꼬이면 확장 파일과 manifest가 정상이어도 재시작 후 언로드될 수 있습니다. 이 저장소의 복구 스크립트는 쿠키나 로그인 데이터를 지우지 않고 확장 등록부/상태 폴더만 백업 이동하도록 분리되어 있습니다. 자세한 복구 기록은 `docs/TROUBLESHOOTING.md`를 참고합니다.

## 외부 의존성

런타임에서 사용하는 외부 서비스는 Google favicon 조회 endpoint입니다.

```text
https://t0.gstatic.com/faviconV2
```

패키지 매니저, 번들러, 프레임워크 의존성은 현재 없습니다.

## 보안 및 권한 고려 사항

- 모든 사이트 접근 권한인 `<all_urls>`는 사용하지 않습니다.
- `activeTab` 권한은 현재 동작에 필요하지 않아 사용하지 않습니다.
- URL 검증(`http`/`https` 스킴만 허용)은 매니저 서버에서 수행하고, `background.js`도 `http(s)` URL만 아이콘 조회 대상으로 삼습니다.
- favicon 조회는 `https://t0.gstatic.com/*` 범위에서만 시도하며, 실패하면 로컬에서 기본 아이콘을 생성합니다.
- 아이콘 캐시는 `chrome.storage.local`에 저장합니다. `chrome.storage.sync`는 레거시 `targetUrl` fallback 용도로만 읽습니다.

## 변경 시 영향 범위

공통 로직은 `src/extension-template/`에서 관리하고 `scripts/generate-extensions.js`로 모든 `shortcut-*` 디렉터리에 반영합니다. 특정 동작을 수정할 때는 템플릿의 다음 파일을 먼저 수정합니다.

- `background.js`
- `manifest.json`

확장 표시 이름, 설명, 툴바 제목, 생성 개수는 `config/extensions.json`에서 관리합니다. 확장 ID 고정용 manifest key도 이 설정 파일에서 번호별로 관리합니다.

생성 스크립트는 각 패키지에 `icons/icon-16.png`, `icons/icon-24.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`도 함께 씁니다. 아이콘은 URL 또는 확장 이름에서 파생한 색상과 shortcut 번호로 구성됩니다.

## 향후 개선 후보

- 선택 권한 기반 고급 favicon 탐색 기능 검토
- 수동 검증 체크리스트 또는 간단한 자동 정적 검증 추가
