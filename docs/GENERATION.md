# Extension Generation Pipeline

이 문서는 여러 Omni-Shortcut 확장 패키지를 공동 관리하는 생성 파이프라인을 설명합니다.

## 개요

Chrome은 하나의 확장 프로그램에서 여러 개의 독립 툴바 버튼을 제공하는 구조에 적합하지 않습니다. Omni-Shortcut은 이 제약 때문에 같은 기능을 가진 여러 확장 패키지를 생성해 사용합니다.

현재 기본 생성 개수는 9개이며, 1개부터 64개까지 조정할 수 있습니다.

## 생성하기

1. Chrome에서 `src/manager/index.html`을 엽니다.
2. **프로젝트 폴더 선택**에서 저장소 루트를 선택하고 파일 편집을 허용합니다.
3. 개수(1~64), URL, 생성 모드를 설정하고 **Save & Generate**를 누릅니다.
4. 필요하면 prune을 켭니다. 생성 대상에서 빠진 `extensions/shortcut-숫자` 폴더만 삭제합니다.
5. Chrome 확장 관리 페이지에서 해당 확장을 새로고침합니다.

Node.js와 CLI 생성기는 제거되었습니다. `src/manager/workspace.js`가 브라우저의 File System Access API로 `config/extensions.json`과 `src/extension-template/`을 읽고 기존 `extensions/shortcut-*` 경로에 직접 씁니다. 설정 및 모든 생성 manifest를 검증한 뒤 패키지를 기록합니다. 파일 쓰기는 파일별로 이루어지므로 도중에 권한 취소나 디스크 오류가 나면 다시 생성하세요.

생성 결과물을 직접 수정하지 마세요. 공통 수정은 `src/extension-template/`에서 진행하고 매니저에서 재생성합니다. 기본 SVG 아이콘과 바이너리 파일도 복사됩니다.

로컬 안전 모드(`omit`)는 저장된 key를 보존하고 manifest에서만 생략합니다. 고정 ID 모드(`include`)는 활성 키가 유효하고 중복 ID가 없을 때만 생성합니다.

## config/extensions.json 규격

```json
{
  "count": 9,
  "manifestKeyMode": "omit",
  "start": 1,
  "directoryTemplate": "shortcut-{digit}",
  "nameTemplate": "Omni-Shortcut {digit}",
  "descriptionTemplate": "Target URL access via shortcut {digit}",
  "actionTitleTemplate": "Target URL access via shortcut {digit}",
  "shortcuts": {
    "1": { "label": "메일", "url": "https://mail.google.com/", "key": "MIIB…" }
  }
}
```

- `count`/`start`: `start`부터 `count`개의 패키지를 생성합니다.
- `manifestKeyMode`: `omit`이면 생성된 manifest에서 key를 생략하고, `include`이면 숏컷별 key를 검증한 뒤 manifest에 주입합니다.
- `*Template`: `{digit}` 토큰이 두 자리 번호로 치환되는 문구 템플릿입니다.
- `shortcuts[digit]`: 숏컷별 설정입니다.
  - `url`: 생성 시 `background.js`의 `DEFAULT_TARGET_URL` 상수로 주입됩니다.
  - `key`: 고정 ID 모드에서 manifest의 `key` 필드로 주입되는 base64 공개키(SPKI)입니다. 로컬 안전 모드에서는 보관만 하고 생성물에는 넣지 않습니다.
  - `label`: 매니저 UI 표시용 이름입니다. 생성 결과물에는 들어가지 않습니다.

## 문구 템플릿

manifest 설명과 툴바 제목은 두 자리 번호를 포함합니다.

```text
Target URL access via shortcut {digit}
```

예를 들어 `shortcut-03`은 `Target URL access via shortcut 03` 문구를 갖습니다. 이 문구는 Chrome 확장 목록이나 툴바 정렬 시 각 확장을 구분하기 쉽게 하기 위한 것입니다.

## 설정 동기화와 확장 ID

Omni-Shortcut의 아이콘 캐시는 `chrome.storage.local`에 저장되고, URL은 패키지에 주입되므로 동기화가 필요 없습니다. 다만 기기 간에 같은 확장으로 인식되게 하려면 확장 ID를 고정해야 합니다.

권장 방식:

- 로컬 압축해제 확장 사용 중 Chrome 프로필 등록부/동기화 꼬임이 있었던 환경에서는 `manifestKeyMode: "omit"`를 유지합니다.
- 여러 기기에서 같은 확장 ID가 반드시 필요하면 `manifestKeyMode: "include"`로 바꾸고, `config/extensions.json`의 `shortcuts[digit].key`에 base64 공개키를 등록해 ID를 고정합니다. 키는 매니저의 `키 생성` 버튼으로 만들 수 있습니다.
- Chrome Web Store에 배포하는 경우 스토어가 부여한 안정적인 확장 ID를 사용합니다.

**주의**: `key`는 base64 공개키이지 32자 확장 ID가 아닙니다. 잘못된 key가 주입되면 Chrome 재시작 시 확장이 로드에 실패해 목록에서 제거됩니다. 자세한 내용은 `docs/MANAGER.md`를 참고하세요.

## 작업 규칙

- 공통 코드 변경은 `src/extension-template/`에서 먼저 수정합니다.
- 수정 후 매니저에서 **Save & Generate**를 실행합니다.
- `extensions/shortcut-*`를 직접 수정한 경우 템플릿과 다시 동기화해야 합니다.
- 생성 개수를 영구히 바꿀 때는 `config/extensions.json`의 `count`를 수정합니다(매니저의 `저장 후 생성`이 같은 일을 합니다).
