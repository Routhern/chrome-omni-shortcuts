# Troubleshooting

이 문서는 Chrome Omni-Shortcuts를 압축해제 확장으로 사용할 때 겪은 재시작 후 언로드 문제와 복구 절차를 기록합니다.

## 재시작 후 확장이 사라지는 문제

### 최종 원인

원인은 확장 코드, URL 저장 로직, favicon, 쿠키, Chrome 설치 파일 문제가 아니었습니다.

실제 문제는 원래 Chrome 프로필의 확장 등록부와 Chrome 동기화 상태가 꼬인 것이었습니다. 프로필의 `Secure Preferences`에는 과거 Omni-Shortcut 확장 ID와 경로가 여러 개 남아 있었지만, 각 항목의 manifest 정보가 비어 있는 상태였습니다. Chrome은 이 상태에서 압축해제 확장을 로드한 것처럼 일부 흔적을 남겼지만, 재시작 후 정상 확장으로 복원하지 못했습니다.

확장 등록부를 백업 후 초기화하자 로컬 확장 목록은 모두 지워졌고, Chrome 계정의 서버 동기화 데이터가 다시 내려오면서 기존 확장 상태가 복원되었습니다. 그 뒤 key 없는 `shortcut-*` 패키지를 다시 수동 로드하자 재시작 후에도 유지되었습니다.

### 관측된 증상

- `chrome://extensions`에서 개발자 모드가 켜져 있어도 재시작 후 Omni-Shortcut이 사라졌습니다.
- `--load-extension`으로 여러 `shortcut-*` 폴더를 넘겨도 일부만 처리되거나, 명령줄 로드 흔적만 남았습니다.
- 원래 프로필의 `Secure Preferences`에는 `chrome-omni-shortcuts` 경로가 여러 ID로 남아 있었지만 `manifest`가 비어 있었습니다.
- 전용/진단 프로필에서는 수동 로드한 확장이 유지되어, 확장 파일 자체가 원인이 아님을 확인했습니다.
- Chrome 재설치나 쿠키 삭제 없이, 확장 등록부 초기화와 동기화 복원 후 정상화되었습니다.

### 하지 말아야 할 것

- Chrome을 바로 재설치하지 않습니다. 프로필의 확장 등록부가 문제면 재설치로 해결되지 않을 수 있습니다.
- 쿠키, 로그인 세션, 방문 기록을 먼저 지우지 않습니다. 이 문제와 직접 관련이 없습니다.
- `Preferences` 또는 `Secure Preferences`를 수동 편집하지 않습니다. Chrome 보호 해시 때문에 더 꼬일 수 있습니다.
- `--load-extension`만으로 여러 압축해제 확장을 영구 등록하려고 의존하지 않습니다. 이 환경에서는 안정적으로 동작하지 않았습니다.

### 복구 절차

1. Chrome 창을 모두 닫습니다.
2. 작업 관리자에 남은 `chrome.exe` 프로세스가 있으면 종료합니다.
3. 확장 상태 캐시를 백업 후 초기화합니다. 로컬 작업용 스크립트는 `docs/dev/` 아래에 보관합니다.
4. 로컬 호환 모드로 key 없는 결과물을 생성합니다.
   ```powershell
   node scripts\generate-extensions.js --no-manifest-key
   ```
5. `chrome://extensions`에서 개발자 모드를 켭니다.
6. `extensions/shortcut-01`부터 `extensions/shortcut-09`까지 각각 압축해제 확장으로 수동 로드합니다.
7. Chrome을 재시작해 유지되는지 확인합니다.

위 절차로도 원래 프로필에서 유지되지 않으면 더 강한 초기화를 진행합니다.

1. Chrome 창을 모두 닫습니다.
2. 작업 관리자에 남은 `chrome.exe` 프로세스가 있으면 종료합니다.
3. 확장 등록부(`Secure Preferences`)와 확장 상태 폴더를 백업 후 초기화합니다. 로컬 작업용 스크립트는 `docs/dev/` 아래에 보관합니다.
4. Chrome을 다시 시작합니다.
5. Chrome 계정 동기화가 켜져 있다면 서버의 확장 데이터가 복원될 때까지 기다립니다.
6. `extensions/shortcut-01`부터 `extensions/shortcut-09`까지 각각 다시 수동 로드합니다.
7. Chrome을 재시작해 유지되는지 확인합니다.

확장 등록부 초기화는 `Secure Preferences`, `Extension State`, `Extension Rules`, `Extension Scripts`를 `%TEMP%` 아래 백업 폴더로 이동하는 방식으로 진행했습니다. 쿠키, 로그인 세션, 방문 기록, 비밀번호 파일은 이동하지 않습니다. 다만 다른 Chrome 확장은 다시 켜거나 다시 로드해야 할 수 있습니다.

## Manifest key 관련 주의

`config/extensions.json`에는 여전히 각 숏컷의 manifest key가 저장될 수 있습니다. 이 key는 여러 기기에서 확장 ID를 고정하기 위한 값입니다.

하지만 이번 환경에서는 key가 있는 압축해제 확장이 원래 프로필에서 안정적으로 유지되지 않았습니다. 그래서 로컬 호환 모드로 아래 명령을 사용했습니다.

```powershell
node scripts\generate-extensions.js --no-manifest-key
```

이 모드는 생성된 `extensions/shortcut-*`의 manifest에서만 key를 생략합니다. `config/extensions.json`의 key 값은 보존되므로, 나중에 일반 생성으로 되돌릴 수 있습니다.
