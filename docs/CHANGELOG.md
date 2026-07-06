# Changelog

이 문서는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르며, 버전 번호는 가능한 경우 [Semantic Versioning](https://semver.org/)을 기준으로 관리합니다.

## [Unreleased]

### Added

- 저장소 문서 초안 추가
- 사용자용 `README.md` 초안 추가
- 아키텍처 설명 문서 추가
- 에이전트 작업 지침 문서 추가
- 로컬 개발 문서 집합을 위한 `docs/dev/` 작업 공간 추가
- 옵션 페이지 URL 검증 정책 추가
- favicon 후보 탐색, 다크/라이트 모드 우선순위, 기본 아이콘 fallback 추가
- 확장 패키지 공동 관리를 위한 템플릿 기반 생성 파이프라인 추가
- shortcut 번호를 포함하는 `Target URL access via shortcut {digit}` 문구 추가

### Changed

- `docs/dev/` 디렉터리를 로컬 개발 문서 영역으로 분리하고 `.gitignore`에 등록
- 스킴이 없는 사용자 입력 URL을 `https://`로 자동 보정하도록 변경
- favicon 저장 로직을 단일 endpoint 의존 방식에서 다중 후보 탐색 방식으로 변경
- 모든 사이트 접근 권한을 제거하고 favicon 조회 host permission을 `https://t0.gstatic.com/*`로 축소
- 사용하지 않는 `activeTab` 권한 제거
- 공통 확장 코드를 `src/extension-template/`에서 관리하도록 구조화

## [1.0.0] - 2025-01-24

### Added

- `Omni-Shortcut 1`부터 `Omni-Shortcut 9`까지 Chrome 확장 패키지 추가
- URL 저장 옵션 페이지 추가
- 저장된 URL로 현재 탭을 이동하는 툴바 버튼 동작 추가
- 대상 사이트 favicon을 확장 아이콘으로 저장하는 기능 추가
