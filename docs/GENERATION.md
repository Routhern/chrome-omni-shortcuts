# Extension Generation Pipeline

이 문서는 여러 Omni-Shortcut 확장 패키지를 공동 관리하는 생성 파이프라인을 설명합니다.

## 개요

Chrome은 하나의 확장 프로그램에서 여러 개의 독립 툴바 버튼을 제공하는 구조에 적합하지 않습니다. Omni-Shortcut은 이 제약 때문에 같은 기능을 가진 여러 확장 패키지를 생성해 사용합니다.

현재 기본 생성 개수는 9개입니다. 필요하면 7개, 13개처럼 다른 개수로 생성할 수 있습니다.

## 관리 구조

```text
config/
  extensions.json
src/
  extension-template/
scripts/
  generate-extensions.js
extensions/
  shortcut-1/
  shortcut-2/
  ...
```

- `src/extension-template/`: 공통 확장 원본입니다.
- `config/extensions.json`: 생성 개수와 번호별 문구 템플릿을 관리합니다.
- `scripts/generate-extensions.js`: 템플릿과 설정을 읽어 `extensions/shortcut-*` 결과물을 생성합니다.
- `extensions/shortcut-*`: Chrome에 실제로 로드하거나 배포할 결과물입니다.

## 생성하기

기본 설정의 개수만큼 생성합니다.

```powershell
node scripts\generate-extensions.js
```

임시로 다른 개수를 생성합니다.

```powershell
node scripts\generate-extensions.js --count 13
```

생성 개수를 줄이고 남는 `shortcut-*` 디렉터리까지 제거하려면 `--prune`을 명시합니다.

```powershell
node scripts\generate-extensions.js --count 7 --prune
```

`--prune`은 `extensions/shortcut-N` 형식의 디렉터리만 대상으로 합니다.

## 문구 템플릿

현재 manifest 설명과 툴바 제목은 번호를 포함합니다.

```text
Target URL access via shortcut {digit}
```

예를 들어 `shortcut-3`은 다음 문구를 갖습니다.

```text
Target URL access via shortcut 3
```

이 문구는 Chrome 확장 목록이나 툴바 정렬 시 각 확장을 구분하기 쉽게 하기 위한 것입니다.

## 설정 동기화와 확장 ID

Omni-Shortcut은 `chrome.storage.sync`를 사용하므로 같은 Chrome 계정에서는 저장된 URL과 아이콘이 동기화될 수 있습니다. 다만 이 동기화는 확장 ID 단위로 이루어집니다.

Windows, macOS, 여러 사용자 환경에서 같은 설정을 공유하려면 각 `shortcut-*` 확장의 ID가 환경마다 동일해야 합니다.

권장 방식:

- Chrome Web Store에 각 shortcut 패키지를 배포해 안정적인 확장 ID를 확보합니다.
- 개발용 또는 사내 배포에서는 `config/extensions.json`의 `manifestKeys`에 번호별 manifest key를 등록해 ID를 고정합니다.

`manifestKeys` 예시:

```json
{
  "manifestKeys": {
    "1": "BASE64_PUBLIC_KEY_FOR_SHORTCUT_1",
    "2": "BASE64_PUBLIC_KEY_FOR_SHORTCUT_2"
  }
}
```

`manifestKeys` 값이 비어 있으면 생성된 manifest에 `key` 필드를 넣지 않습니다.

## 작업 규칙

- 공통 코드 변경은 `src/extension-template/`에서 먼저 수정합니다.
- 수정 후 `node scripts\generate-extensions.js`를 실행합니다.
- `extensions/shortcut-*`를 직접 수정한 경우 템플릿과 다시 동기화해야 합니다.
- 생성 개수를 바꿀 때는 `config/extensions.json`의 `count`를 수정하거나 `--count` 인자를 사용합니다.
