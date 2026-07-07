# chrome-omni-shortcuts

chrome-omni-shortcuts는 자주 여는 웹사이트를 Chrome 툴바 버튼으로 빠르게 접근하는 확장 프로그램의 모음집입니다. 9개의 동일 기능을 갖는 확장프로그램을 사용해서 길고 편의성이 떨어지는 주소표시줄의 남은 여백을 창의적으로 대체할 수 있습니다.

이 저장소에는 `Omni-Shortcut 1`부터 `Omni-Shortcut 9`까지 9개의 독립 확장 패키지가 들어 있습니다. 각 확장마다 서로 다른 URL을 저장해 두면, Chrome 툴바에 여러 개의 개인 바로가기 버튼을 둘 수 있습니다.

## 주요 기능

- 툴바 버튼 클릭으로 저장된 URL 열기
- 확장별 대상 URL 저장
- 대상 사이트의 favicon을 가져와 확장 아이콘으로 사용
- favicon을 찾지 못해도 사이트명 기반 기본 아이콘 자동 생성
- Chrome 재시작 직후에도 보이는 번호 기반 기본 PNG 아이콘 포함
- 별도 빌드 없이 Chrome에서 바로 로드 가능

## 설치하기 — 확장 로드와 핀 고정

Chrome 보안 정책상 압축해제 확장의 설치와 툴바 핀 고정은 자동화할 수 없어 직접 해야 합니다. 다행히 **처음 한 번만 하면 됩니다.** manifest key로 확장 ID가 고정되어 있으면, 이후 매니저에서 URL을 바꾸고 재생성해도 Chrome은 같은 확장으로 인식하므로 다시 설치하거나 핀을 다시 박을 필요가 없습니다.

이 환경에서는 Chrome 명령줄의 `--load-extension`으로 여러 `shortcut-*` 폴더를 한 번에 영구 등록하는 방식이 안정적이지 않았습니다. 실제 설치는 `chrome://extensions`에서 각 폴더를 하나씩 **압축해제된 확장 프로그램으로 로드**하는 방식을 기준으로 합니다.

재시작 후 확장이 사라지는 문제의 원인 분석과 복구 기록은 `docs/TROUBLESHOOTING.md`에 정리되어 있습니다.

Chrome이 manifest key가 있는 압축해제 확장을 거부하는 환경에서는 로컬 호환 모드로 생성 결과물의 `key` 필드를 뺄 수 있습니다. 이 경우 같은 PC의 같은 폴더에서는 숏컷 기능을 그대로 사용할 수 있지만, Windows/macOS 간 동일 확장 ID 고정은 포기합니다.

```powershell
node scripts\generate-extensions.js --no-manifest-key
```

### 1단계: 확장 로드

1. 이 저장소를 내려받거나 압축 파일로 다운로드합니다.
2. Chrome 주소창에 `chrome://extensions`를 입력해 확장 관리 페이지를 엽니다.
3. 오른쪽 위의 **개발자 모드** 스위치를 켭니다. 압축해제 확장은 이 스위치가 꺼져 있으면 로드되거나 복원되지 않을 수 있습니다.
4. 왼쪽 위의 **압축해제된 확장 프로그램을 로드합니다** 버튼을 누릅니다.
5. `extensions/shortcut-01` 폴더를 선택합니다.
6. 필요한 만큼 `shortcut-02`, `shortcut-03` … 폴더를 같은 방식으로 반복해 추가합니다.

### 2단계: 툴바에 핀 고정

1. Chrome 툴바 오른쪽의 **퍼즐 조각(🧩) 아이콘**을 클릭합니다.
2. 목록에서 `Omni-Shortcut 01` 등 각 숏컷 옆의 **핀(📌) 아이콘**을 클릭합니다.
3. 핀이 파랗게 켜지면 툴바에 버튼이 항상 표시됩니다.
4. 툴바에서 아이콘을 드래그하면 순서도 바꿀 수 있습니다.

### 이후에는

URL 변경은 숏컷 매니저에서 하고, 재생성 후 `chrome://extensions`에서 해당 확장의 **새로고침(↻)** 버튼만 누르면 됩니다. 설치와 핀은 그대로 유지됩니다.

## 사용하기

URL 설정은 숏컷 매니저에서 중앙 관리합니다. (확장별 옵션 페이지는 제거되었습니다.)

1. 숏컷 매니저를 엽니다. Windows에서는 `Open-Manager.bat`, macOS에서는 `open-manager.command`를 더블클릭하거나, 터미널에서 `node scripts\manager.js`를 실행합니다.
2. 원하는 숏컷의 대상 URL을 입력하고 `Save & Generate`를 누른 뒤, 페이지 안의 확인 창에서 생성 여부를 확인합니다.
3. Chrome 확장 관리 화면에서 해당 확장을 새로고침(또는 새로 로드)합니다.
4. Chrome 툴바에서 해당 Omni-Shortcut 아이콘을 클릭합니다.

확장이 재시작 후 사라지는 문제가 있었다면, 매니저 상단의 `키 상태 다시 검사`로 key 충돌/오류를 확인하고 `문제 키 자동복구`를 실행하세요. 자동복구는 문제 key 교체와 확장 재생성까지 한 번에 수행합니다.

키가 정상인데도 Chrome을 껐다 켤 때 확장이 언로드된다면, `chrome://extensions`에서 개발자 모드가 켜져 있는지 먼저 확인하세요. 그래도 반복되면 `docs/TROUBLESHOOTING.md`의 확장 등록부 복구 절차를 참고합니다.

확장이 로드되면 우선 번호가 들어간 기본 PNG 아이콘이 표시되고, 서비스 워커가 실행되면 대상 사이트의 favicon으로 자동으로 바뀝니다. 사이트에서 favicon을 찾지 못하면 사이트명 첫 글자를 사용한 기본 아이콘이 자동으로 만들어집니다.

URL은 `http://` 또는 `https://` 주소만 저장할 수 있습니다.

## 여러 바로가기 만들기

각 `shortcut-*` 디렉터리는 독립적인 Chrome 확장입니다. 예를 들어 다음처럼 사용할 수 있습니다.

- `shortcut-01`: 메일
- `shortcut-02`: 캘린더
- `shortcut-03`: 업무 대시보드
- `shortcut-04`: 문서 도구

Chrome에 여러 디렉터리를 각각 로드하면 툴바에 여러 바로가기 버튼을 둘 수 있습니다.

기본 패키지 수는 9개지만, 생성 파이프라인을 통해 7개나 13개처럼 다른 개수로도 관리할 수 있습니다. 자세한 내용은 `docs/GENERATION.md`를 참고하세요.

## 숏컷 매니저 (GUI)

CLI 생성 스크립트 대신 브라우저 기반 GUI로 숏컷을 관리할 수 있습니다. Windows에서는 저장소 루트의 `Open-Manager.bat`, macOS에서는 `open-manager.command`를 더블클릭하면 됩니다. 터미널에서는 다음 명령을 사용합니다.

```powershell
node scripts\manager.js
```

실행하면 `http://127.0.0.1:8151`이 브라우저에서 열립니다. 매니저에서 다음을 할 수 있습니다.

- 숏컷 패키지 개수 변경과 재생성 (prune 옵션 포함)
- 숏컷별 이름·대상 URL·manifest key를 중앙 JSON(`config/extensions.json`)에서 편집
- 저장된 URL 목록을 favicon과 함께 한눈에 탐색하고 바로 열기
- Chrome 재시작 직후에도 보이는 기본 PNG 아이콘 자동 생성
- 설정 전체를 JSON 파일로 내보내기/가져오기 (백업, 기기 간 이전)
- 라이트/다크 테마 전환, 영어/한국어 UI 전환

manifest key를 지정하면 Chrome 확장 ID가 고정되어 Windows와 macOS에서 같은 확장으로 인식되고, `chrome.storage.sync` 데이터가 기기 간에 연동됩니다. key는 base64 공개키여야 하며(32자 확장 ID가 아님), 매니저의 `키 생성` 버튼으로 만들 수 있습니다. 잘못된 key가 들어가면 Chrome 재시작 시 확장이 로드에 실패해 목록에서 사라지므로 주의하세요. 매니저에 저장한 URL은 생성된 패키지에 기본 대상 URL로 주입됩니다. 자세한 내용은 `docs/MANAGER.md`를 참고하세요.

매니저는 key를 저장할 때 SPKI/RSA/2048비트 이상을 검증하고, 중복 확장 ID를 key 감사에서 탐지합니다.

## 권한 안내

이 확장은 다음 Chrome 권한을 사용합니다.

- `storage`: favicon 픽셀 캐시와 레거시 옵션 페이지 URL fallback을 읽고 씁니다.
- `tabs`: 현재 탭을 저장된 URL로 이동합니다.
- `https://t0.gstatic.com/*` host permission: 저장한 URL의 favicon을 Google favicon endpoint에서 조회합니다.

## 프로젝트 구조

```text
chrome-omni-shortcuts/
  Open-Manager.bat
  open-manager.command
  extensions/
    shortcut-01/
      manifest.json
      background.js
    shortcut-02/
    ...
    shortcut-10/
  docs/
    ARCHITECTURE.md
    CHANGELOG.md
    GENERATION.md
    MANAGER.md
    TROUBLESHOOTING.md
  config/
    extensions.json
  scripts/
    generate-extensions.js
    manager.js
  src/
    extension-template/
    manager/
```

## 개발 상태

현재는 별도의 빌드 과정이나 자동 테스트 설정이 없습니다. 변경 후에는 Chrome에서 각 확장을 압축해제된 확장 프로그램으로 로드해 수동으로 확인합니다.

공통 확장 코드는 `src/extension-template/`에서 관리하고, 다음 명령으로 `extensions/shortcut-*` 결과물을 생성합니다.

```powershell
node scripts\generate-extensions.js
```

자세한 구조와 유지보수 기준은 `docs/ARCHITECTURE.md`를 참고하세요.

## 라이선스

이 프로젝트는 저장소의 `LICENSE` 파일에 명시된 라이선스를 따릅니다.
