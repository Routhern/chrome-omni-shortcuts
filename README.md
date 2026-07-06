# Chrome-OmniShortcut

Chrome-OmniShortcut은 자주 여는 웹사이트를 Chrome 툴바 버튼으로 빠르게 접근하는 확장 프로그램의 모음집입니다. 9개의 동일 기능을 갖는 확장프로그램을 사용해서 길고 편의성이 떨어지는 주소표시줄의 남은 여백을 창의적으로 대체할 수 있습니다.

이 저장소에는 `Omni-Shortcut 1`부터 `Omni-Shortcut 9`까지 9개의 독립 확장 패키지가 들어 있습니다. 각 확장마다 서로 다른 URL을 저장해 두면, Chrome 툴바에 여러 개의 개인 바로가기 버튼을 둘 수 있습니다.

## 주요 기능

- 툴바 버튼 클릭으로 저장된 URL 열기
- 확장별 대상 URL 저장
- 대상 사이트의 favicon을 가져와 확장 아이콘으로 사용
- favicon을 찾지 못해도 사이트명 기반 기본 아이콘 자동 생성
- Chrome 동기화 저장소를 통한 URL과 아이콘 저장
- 별도 빌드 없이 Chrome에서 바로 로드 가능

## 설치하기

1. 이 저장소를 내려받거나 압축 파일로 다운로드합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 오른쪽 위의 개발자 모드를 켭니다.
4. 압축해제된 확장 프로그램을 로드합니다.
5. `extensions/shortcut-1` 같은 확장 디렉터리를 선택합니다.
6. 필요한 만큼 `shortcut-2`, `shortcut-3` 등을 같은 방식으로 추가합니다.

## 사용하기

1. Chrome 확장 관리 화면에서 원하는 Omni-Shortcut의 세부정보를 엽니다.
2. 확장 옵션을 엽니다.
3. 이동할 사이트 URL을 입력합니다.
4. `Save URL and Set Icon` 버튼을 누릅니다.
5. Chrome 툴바에서 해당 Omni-Shortcut 아이콘을 클릭합니다.

저장 후 아이콘은 입력한 사이트의 favicon으로 바뀝니다. 사이트에서 favicon을 찾지 못하면 사이트명 첫 글자를 사용한 기본 아이콘이 자동으로 만들어집니다.

URL은 `http://` 또는 `https://` 주소만 저장할 수 있습니다. `example.com`처럼 프로토콜 없이 입력하면 `https://example.com/`으로 자동 보정됩니다.

## 여러 바로가기 만들기

각 `shortcut-*` 디렉터리는 독립적인 Chrome 확장입니다. 예를 들어 다음처럼 사용할 수 있습니다.

- `shortcut-1`: 메일
- `shortcut-2`: 캘린더
- `shortcut-3`: 업무 대시보드
- `shortcut-4`: 문서 도구

Chrome에 여러 디렉터리를 각각 로드하면 툴바에 여러 바로가기 버튼을 둘 수 있습니다.

기본 패키지 수는 9개지만, 생성 파이프라인을 통해 7개나 13개처럼 다른 개수로도 관리할 수 있습니다. 자세한 내용은 `docs/GENERATION.md`를 참고하세요.

## 권한 안내

이 확장은 다음 Chrome 권한을 사용합니다.

- `storage`: 사용자가 저장한 URL과 아이콘 데이터를 보관합니다.
- `tabs`: 현재 탭을 저장된 URL로 이동합니다.
- `https://t0.gstatic.com/*` host permission: 저장한 URL의 favicon을 Google favicon endpoint에서 조회합니다.

## 프로젝트 구조

```text
Chrome-OmniShortcut/
  extensions/
    shortcut-1/
      manifest.json
      background.js
      option.html
      option.css
      option.js
    shortcut-2/
    ...
    shortcut-9/
  docs/
    ARCHITECTURE.md
    CHANGELOG.md
    GENERATION.md
  config/
    extensions.json
  scripts/
    generate-extensions.js
  src/
    extension-template/
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
