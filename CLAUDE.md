# CLAUDE.md

저장소 작업 규칙은 `AGENTS.md`를 따릅니다. 모든 안내와 주석은 한국어로 작성합니다.

## 개발 구조

- Chrome에서 `src/manager/index.html`을 열고 저장소 폴더를 선택합니다. Node.js와 CLI 생성기는 제거되었습니다.
- `src/manager/workspace.js`가 File System Access API로 설정 저장·확장 생성을 수행하고 Web Crypto로 RSA 키를 관리합니다.
- 공통 수정은 `src/extension-template/`에서 수행한 뒤 매니저에서 **Save & Generate**로 재생성합니다. `extensions/shortcut-*`는 직접 수정하지 않습니다.
- 설정은 `config/extensions.json`, 번역은 `src/manager/i18n/{en,ko}.js`에 있습니다.
- `omit` 모드는 manifest key를 생략하고, `include` 모드는 RSA 2048비트 이상의 SPKI 공개키 및 ID 중복을 검사합니다.
- 생성 개수는 1~64개입니다. prune은 생성 대상에서 빠진 `shortcut-숫자` 폴더만 삭제합니다.
- Chrome 확장 권한과 favicon 동작은 `docs/ARCHITECTURE.md`, 매니저 사용법은 `docs/MANAGER.md`를 참고합니다.
