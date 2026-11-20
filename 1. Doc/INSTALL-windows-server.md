# Windows 서버 설치 안내

PowerShell 실행·계정 관리·Docker·SQLite 백업/복구 안내를 [개발 환경과 운영](04-development-and-operations.md)으로 통합했습니다.

현재 저장소는 Docker Desktop 등에서 Compose의 app과 Caddy를 실행하는 구성입니다. Windows 절전·재부팅 후 Docker 시작, 방화벽과 공유기 포트, DDNS는 서버 환경에 맞춰 확인합니다. 과거 환경의 선택과 장애 이력은 [운영 기록](RUNBOOK.md)에 남아 있습니다.

이전 설치 문서의 실행 중인 SQLite 파일에 대한 `cat`/바이너리 리다이렉트 예제를 사용하지 말고 새 문서의 backup API 절차를 사용합니다.

[프로젝트 전체 문서](README.md)
