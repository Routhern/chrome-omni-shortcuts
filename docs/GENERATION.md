# Extension Generation Pipeline

이 문서는 여러 Omni-Shortcut 확장 패키지를 공동 관리하는 생성 파이프라인을 설명합니다.

## 개요

Chrome은 하나의 확장 프로그램에서 여러 개의 독립 툴바 버튼을 제공하는 구조에 적합하지 않습니다. Omni-Shortcut은 이 제약 때문에 같은 기능을 가진 여러 확장 패키지를 생성해 사용합니다.

현재 기본 생성 개수는 9개이며, 1개부터 64개까지 조정할 수 있습니다.

일상적인 관리(URL·이름·key 편집, 재생성)는 GUI 숏컷 매니저(`docs/MANAGER.md`)를 사용하는 것이 편합니다. 이 문서의 CLI는 매니저가 내부적으로 재사용하는 저수준 도구입니다.

## 관리 구조

```text
config/
  extensions.json
src/
  extension-template/
scripts/
  generate-extensions.js
extensions/
  shortcut-01/
    icon.svg
  shortcut-02/
  ...
```

- `src/extension-template/`: 공통 확장 원본입니다.
- `config/extensions.json`: 생성 개수, 번호별 문구 템플릿, 숏컷별 `label`/`url`/`key`를 관리합니다.
- `scripts/generate-extensions.js`: 템플릿과 설정을 읽어 `extensions/shortcut-*` 결과물을 생성합니다. CLI이자 매니저 서버가 require하는 모듈입니다.
- `extensions/shortcut-*`: Chrome에 실제로 로드하거나 배포할 결과물입니다. **직접 수정하지 마세요** — 재생성 시 덮어써집니다.

패키지 디렉터리와 표시 이름은 두 자리 번호를 사용합니다(`shortcut-01`, `Omni-Shortcut 01`).
각 패키지는 템플릿에서 복사된 `icon.svg`를 함께 포함합니다. 이 공통 SVG 기본 아이콘은 Chrome 시작 직후와 확장 관리 화면에서 표시되고, 런타임에는 대상 사이트 favicon으로 교체될 수 있습니다.

## 생성하기

기본 설정(`config/extensions.json`의 `count`)만큼 생성합니다.

```powershell
node scripts\generate-extensions.js
```

임시로 다른 개수를 생성합니다. `--count`는 해당 실행에만 적용되고 config에 저장되지 않습니다.

```powershell
node scripts\generate-extensions.js --count 13
```

생성 개수를 줄이고 남는 `shortcut-*` 디렉터리까지 제거하려면 `--prune`을 명시합니다.

```powershell
node scripts\generate-extensions.js --count 7 --prune
```

`--prune`은 `extensions/shortcut-N` 형식의 디렉터리만 대상으로 합니다.

기본값은 `config/extensions.json`의 `manifestKeyMode`를 따릅니다. 현재 기본은 로컬 안전 모드(`omit`)라서 생성된 manifest에서 `key` 필드를 생략합니다.

```powershell
node scripts\generate-extensions.js
```

명령줄에서 임시로 모드를 바꿀 수도 있습니다.

```powershell
node scripts\generate-extensions.js --no-manifest-key
node scripts\generate-extensions.js --with-manifest-key
node scripts\generate-extensions.js --manifest-key-mode include
```

로컬 안전 모드는 생성 결과물의 manifest에서만 key를 생략합니다. `config/extensions.json`의 `shortcuts[digit].key` 값은 보존됩니다. 고정 ID 모드(`include`)는 활성 숏컷의 key가 모두 유효하고 중복 확장 ID가 없을 때만 생성됩니다.

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
- 여러 기기에서 같은 확장 ID가 반드시 필요하면 `manifestKeyMode: "include"`로 바꾸고, `config/extensions.json`의 `shortcuts[digit].key`에 base64 공개키를 등록해 ID를 고정합니다. 키는 매니저의 `키 생성` 버튼(또는 `POST /api/keygen`)으로 만들 수 있습니다.
- Chrome Web Store에 배포하는 경우 스토어가 부여한 안정적인 확장 ID를 사용합니다.

**주의**: `key`는 base64 공개키이지 32자 확장 ID가 아닙니다. 잘못된 key가 주입되면 Chrome 재시작 시 확장이 로드에 실패해 목록에서 제거됩니다. 자세한 내용은 `docs/MANAGER.md`를 참고하세요.

## 작업 규칙

- 공통 코드 변경은 `src/extension-template/`에서 먼저 수정합니다.
- 수정 후 `node scripts\generate-extensions.js`를 실행합니다.
- `extensions/shortcut-*`를 직접 수정한 경우 템플릿과 다시 동기화해야 합니다.
- 생성 개수를 영구히 바꿀 때는 `config/extensions.json`의 `count`를 수정합니다(매니저의 `저장 후 생성`이 같은 일을 합니다).
