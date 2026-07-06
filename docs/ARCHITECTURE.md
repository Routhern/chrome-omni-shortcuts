# Architecture

이 문서는 Chrome-OmniShortcut의 현재 구조와 주요 동작 흐름을 설명합니다.

## 목표

Chrome-OmniShortcut은 사용자가 지정한 URL을 Chrome 툴바 버튼으로 빠르게 여는 확장 프로그램 모음입니다. 하나의 확장에 여러 바로가기를 넣는 방식이 아니라, 같은 구현을 가진 여러 독립 확장을 나란히 설치하는 방식으로 여러 바로가기를 제공합니다.

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
  option.html
  option.css
  option.js
```

현재 기본 설정은 `shortcut-1`부터 `shortcut-9`까지 9개 패키지를 생성합니다. 필요하면 설정이나 생성 스크립트 인자로 7개, 13개처럼 다른 개수를 생성할 수 있습니다.

## Chrome 확장 구성

각 확장은 Manifest V3 기반입니다.

- `background.service_worker`: `background.js`
- `action.default_title`: 툴바 버튼 제목
- `options_page`: `option.html`
- `permissions`: `storage`, `tabs`
- `host_permissions`: `https://t0.gstatic.com/*`

각 확장의 `description`과 `action.default_title`에는 shortcut 번호가 포함됩니다. 기본 문구는 `Target URL access via shortcut {digit}`입니다.

## 런타임 흐름

### URL 저장

1. 사용자가 옵션 페이지를 엽니다.
2. `option.js`의 `OptionsManager`가 입력 필드, 저장 버튼, 상태 영역을 초기화합니다.
3. 기존에 저장된 `targetUrl`이 있으면 `chrome.storage.sync`에서 읽어 입력 필드에 표시합니다.
4. 사용자가 URL을 입력하고 저장 버튼을 누릅니다.
5. `UrlPolicy.normalize()`가 입력값을 검증하고 저장 가능한 URL로 정규화합니다.
6. `FaviconManager.getIconData()`가 Google favicon endpoint에서 아이콘을 가져와 data URL로 변환합니다.
7. favicon을 찾지 못하면 사이트명 기반 기본 아이콘을 생성합니다.
8. canvas에 32px 아이콘을 그린 뒤 `chrome.storage.sync`에 `targetUrl`과 `iconData`를 저장합니다.
9. `chrome.action.setIcon()`으로 현재 확장 아이콘을 갱신합니다.

## Favicon 정책

저장 시점의 favicon 선택은 다음 순서로 진행됩니다.

1. Google favicon endpoint에서 대상 URL의 32px favicon을 조회합니다.
2. 가져온 응답이 이미지이고 실제로 로드 가능한지 확인합니다.
3. Google favicon 조회 또는 이미지 검증이 실패하면 호스트명 첫 글자를 사용한 기본 아이콘을 canvas로 생성합니다.

이 정책은 모든 사이트 접근 권한인 `<all_urls>` 없이 동작하도록 설계했습니다. 대상 사이트의 HTML을 직접 읽지 않기 때문에 다크/라이트 모드별 favicon 후보 추출은 지원하지 않습니다.

## URL 정책

옵션 페이지에서 저장할 수 있는 URL은 다음 정책을 따릅니다.

- 앞뒤 공백은 제거합니다.
- 입력값 안에 공백이 있으면 저장하지 않습니다.
- 스킴이 없는 일반 주소는 `https://`를 자동으로 붙입니다.
- 프로토콜 상대 URL은 `https:`를 붙여 저장합니다.
- `http://`와 `https://`만 허용합니다.
- 호스트명이 없는 URL은 저장하지 않습니다.
- 사용자 이름이나 비밀번호가 포함된 URL은 저장하지 않습니다.

예를 들어 `example.com/path`는 `https://example.com/path`로 저장됩니다. `mailto:`, `ftp://`, `chrome://`, `javascript:` 같은 스킴은 사용자 저장 URL로 허용하지 않습니다. 저장된 URL이 없을 때 사용하는 내부 기본값 `chrome://newtab`은 사용자 입력 정책과 별도로 `background.js`에서만 사용합니다.

### 바로가기 실행

1. 사용자가 Chrome 툴바의 확장 아이콘을 클릭합니다.
2. `background.js`의 `chrome.action.onClicked` listener가 실행됩니다.
3. `StorageManager.getTargetUrl()`이 `chrome.storage.sync`에서 `targetUrl`을 읽습니다.
4. 저장된 URL이 없으면 `chrome://newtab`을 기본값으로 사용합니다.
5. `chrome.tabs.update({ url: targetUrl })`로 현재 탭을 이동합니다.

### 브라우저 시작 시 아이콘 복원

1. Chrome 시작 시 `chrome.runtime.onStartup` listener가 실행됩니다.
2. 저장된 `iconData`를 `chrome.storage.sync`에서 읽습니다.
3. `IconManager.setIconFromBase64()`가 data URL을 bitmap으로 변환합니다.
4. `chrome.action.setIcon()`으로 툴바 아이콘을 복원합니다.

## 데이터 모델

각 확장은 Chrome 확장 ID가 다르므로 저장소도 독립적으로 분리됩니다.

| Key | Type | 설명 |
| --- | --- | --- |
| `targetUrl` | string | 툴바 버튼 클릭 시 이동할 대상 URL |
| `iconData` | string | favicon을 canvas로 변환한 data URL |

`chrome.storage.sync`는 같은 Chrome 계정에서 동기화될 수 있지만, 동기화 범위는 확장 ID 단위입니다. Windows, macOS, 여러 사용자 환경에서 같은 shortcut 설정을 공유하려면 각 생성 패키지의 확장 ID가 동일하게 유지되어야 합니다. Chrome Web Store 배포 ID를 사용하거나, 개발 배포에서는 `config/extensions.json`의 `manifestKeys`로 번호별 manifest key를 관리합니다.

## 외부 의존성

런타임에서 사용하는 외부 서비스는 Google favicon 조회 endpoint입니다.

```text
https://t0.gstatic.com/faviconV2
```

패키지 매니저, 번들러, 프레임워크 의존성은 현재 없습니다.

## 보안 및 권한 고려 사항

- 모든 사이트 접근 권한인 `<all_urls>`는 사용하지 않습니다.
- `activeTab` 권한은 현재 동작에 필요하지 않아 사용하지 않습니다.
- 옵션 페이지는 저장 시점에 URL 형식 검증, `https://` 자동 보정, `http`/`https` 허용 스킴 정책을 적용합니다.
- favicon 조회는 `https://t0.gstatic.com/*` 범위에서만 시도하며, 실패하면 로컬에서 기본 아이콘을 생성합니다.
- `chrome.storage.sync`는 동기화 저장소이므로 데이터 크기 제한과 동기화 지연을 고려해야 합니다.

## 변경 시 영향 범위

공통 로직은 `src/extension-template/`에서 관리하고 `scripts/generate-extensions.js`로 모든 `shortcut-*` 디렉터리에 반영합니다. 특정 동작을 수정할 때는 템플릿의 다음 파일을 먼저 수정합니다.

- `background.js`
- `option.js`
- `option.html`
- `option.css`

확장 표시 이름, 설명, 툴바 제목, 생성 개수는 `config/extensions.json`에서 관리합니다. 확장 ID 고정용 manifest key도 이 설정 파일에서 번호별로 관리합니다.

## 향후 개선 후보

- 선택 권한 기반 고급 favicon 탐색 기능 검토
- 수동 검증 체크리스트 또는 간단한 자동 정적 검증 추가
