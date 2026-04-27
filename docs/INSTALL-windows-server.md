# 집 Windows PC에 설치 가이드

Windows 10/11이 깔린 집 PC를 Super 플래너 서버로 사용하는 전체 과정입니다. **24시간 켜져 있을 PC** 기준으로 작성했습니다.

---

## 0. 준비물 체크

- [ ] **Windows 10 (21H2 이상) 또는 Windows 11** — Pro/Home 둘 다 가능
  - 최소 사양: CPU 2코어, RAM 4GB, 저장소 20GB 여유
  - BIOS에서 **가상화 활성화** (VT-x / AMD-V) 되어 있어야 함. 대부분 기본 ON
- [ ] **유선 인터넷** 권장 (Wi-Fi도 가능하지만 안정성 낮음)
- [ ] **공유기 관리자 페이지 접근 권한** (포트 포워딩용)
- [ ] **도메인** (선택) — 외부 접근용
  - 무료: [DuckDNS](https://www.duckdns.org/) 가장 쉬움
  - 이미 도메인 있으면 그걸 써도 됨

---

## 1. Windows 전원/절전 설정

서버는 꺼지면 안 됩니다. 제어판 → "전원 옵션":

1. "덮개를 닫을 때 작동" → **아무 작업 안 함** (노트북인 경우)
2. "디스플레이 끄기" → 30분 OK
3. **"컴퓨터를 절전 모드로 전환"** → **해당 없음 / 안 함**
4. 고급 전원 관리 → "하드 디스크 끄기" → 0 (안 끔)

`Win + I` → 시스템 → 전원 → 화면/절전: **"절전 모드 해제" 시간을 "안 함"** 으로.

---

## 2. Docker Desktop 설치

### 2.1 WSL2 활성화
`PowerShell`을 **관리자 권한**으로 열고:

```powershell
wsl --install
```

재부팅 → 부팅 후 Ubuntu가 자동으로 설치 시도할 수 있음 (사용자/비밀번호 설정). 그냥 진행.

이미 WSL 설치돼 있다면:
```powershell
wsl --update
wsl --set-default-version 2
```

### 2.2 Docker Desktop 설치
1. https://www.docker.com/products/docker-desktop/ 에서 `Docker Desktop Installer.exe` 다운로드
2. 실행 → "Use WSL 2 instead of Hyper-V" 체크되어 있는지 확인하고 설치
3. 재부팅 요구 시 재부팅
4. Docker Desktop 실행 → 로그인 건너뛰어도 OK
5. 확인:
   ```powershell
   docker --version
   docker compose version
   ```

### 2.3 Docker Desktop 자동 시작 설정
Docker Desktop 우측 상단 ⚙️ (Settings) → **General**:
- ✅ **Start Docker Desktop when you sign in to your computer**
- ✅ **Open Docker Dashboard at startup** (체크해도 안해도 됨)

> Windows가 부팅되고 **사용자 로그인까지 완료**돼야 Docker가 시작됩니다. 이 PC 전용 사용자를 하나 만들고 **자동 로그인** 설정하는 것을 권장 (아래 3.2).

---

## 3. Windows 서버 모드 설정

### 3.1 컴퓨터 이름과 네트워크 프로필
1. `Win + I` → 시스템 → 정보 → "이 PC의 이름 바꾸기" → `home-server` 같은 식별 가능한 이름
2. 네트워크 → 유선 LAN → **"개인 네트워크"** 로 설정 (공용이면 방화벽 과도하게 막음)

### 3.2 자동 로그인 (선택, 편리함)
Docker Desktop이 사용자 로그인 후에만 시작되므로, 정전 후 복구 시 자동 로그인이 되어야 Docker가 뜸.

```powershell
# 관리자 PowerShell
# 주의: 이 PC에 민감 정보 없어야 안전. 비밀번호가 저장됨.
netplwiz
```
창이 뜨면 계정 선택 → **"사용자 이름과 암호를 입력해야 이 컴퓨터를 사용할 수 있음"** 체크 해제 → 암호 2번 입력 → 확인.

### 3.3 원격 관리 (선택, 매우 편함)
코딩 PC에서 서버 PC를 원격으로 다루고 싶으면:

**옵션 A: OpenSSH Server (권장, 가벼움)**
```powershell
# 관리자 PowerShell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
# 방화벽 규칙 자동 생성되어 있음
```

이후 코딩 PC에서:
```powershell
ssh 사용자명@서버IP
```

**옵션 B: Windows 원격 데스크톱 (RDP)**
- Windows Pro만 가능
- `Win + I` → 시스템 → 원격 데스크톱 → ON

---

## 4. 앱 코드 서버로 옮기기

### 방법 A. Git for Windows (권장)
**서버 PC에서**:

1. https://git-scm.com/download/win 다운로드 & 설치 (기본값으로)
2. PowerShell:
   ```powershell
   cd ~
   git clone https://github.com/your-user/super-planner.git
   cd super-planner
   ```

### 방법 B. 폴더 복사 (가장 간단)

1. 코딩 PC에서 이 폴더 통째로 USB/네트워크 공유로 서버 PC에 복사
2. `node_modules`, `.next`, `data`, `.env.local` 폴더/파일은 **제외** (용량 + 민감정보)
3. 서버 PC에서 `C:\super-planner\` 같은 경로에 배치

---

## 5. 환경변수 파일 생성

서버 PC의 프로젝트 폴더에서 **PowerShell**:

```powershell
cd C:\super-planner   # 본인 경로로

# Node.js 없이 Docker로 해시 생성 (Docker Desktop이 켜져 있어야 함)
docker run --rm -v ${PWD}:/app -w /app node:20-alpine sh -c "npm install argon2 --silent && node scripts/hash-password.mjs 원하는비밀번호" | Out-File -Encoding utf8 .env

# 결과 확인
type .env
```

`.env`가 아래처럼 보여야 합니다:
```
APP_USERNAME=admin
APP_PASSWORD_HASH=\$argon2id\$v=19\$...
SESSION_SECRET=<64자 hex>
DB_PATH=/app/data/binder.sqlite
```

> ⚠️ PowerShell에서 `Out-File`은 기본이 UTF-16. `-Encoding utf8` 필수. 다르게 저장되면 Docker가 못 읽음.

만약 .env 상단에 `# Add these to your .env.local...` 주석이 없거나 첫 줄에 `BOM` 문자가 있어 오류 나면, 메모장으로 열어 직접 편집 가능.

---

## 6. Docker로 앱 기동

```powershell
cd C:\super-planner

# 이미지 빌드 (첫 빌드는 5~10분)
docker compose build

# 백그라운드 실행
docker compose up -d

# 로그 확인 (Ctrl+C로 빠져나와도 앱은 계속 돌아감)
docker compose logs -f app

# 상태
docker compose ps
```

로컬 테스트:
```powershell
curl.exe -I http://localhost:3000/login
# HTTP/1.1 200 뜨면 OK
```

같은 네트워크 내 다른 기기(휴대폰 Wi-Fi 연결)에서:
- 서버 PC IP 확인: `ipconfig` → IPv4 주소 (예: `192.168.0.100`)
- 휴대폰 브라우저에서 `http://192.168.0.100:3000`

여기까지 되면 **집 네트워크 내부**에서는 완성.

---

## 7. Windows 방화벽 설정

외부에서 접속하려면 **80, 443 포트**를 방화벽에서 허용해야 함.

관리자 PowerShell:
```powershell
# HTTP (Caddy가 인증서 발급 검증용으로 사용)
New-NetFirewallRule -DisplayName "Super Planner HTTP" `
  -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# HTTPS (실제 사용 포트)
New-NetFirewallRule -DisplayName "Super Planner HTTPS" `
  -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

> 3000 포트는 외부로 열 필요 없음. Caddy가 80/443을 받고 내부적으로 3000으로 전달.

---

## 8. 공유기 설정

### 8.1 서버 PC IP 고정
공유기 관리자 페이지 접속 (`192.168.0.1` 또는 `192.168.1.1`):
1. **DHCP 예약** 또는 **고정 IP 할당** 메뉴 찾기
2. 서버 PC의 MAC 주소 찾기
   - 서버 PC에서 `ipconfig /all` → "이더넷" 항목의 "물리적 주소"
3. 예: MAC `AA-BB-CC-DD-EE-FF` → 고정 IP `192.168.0.100` 할당
4. 서버 PC 재부팅 또는 `ipconfig /release` + `ipconfig /renew`

### 8.2 포트 포워딩
같은 공유기 페이지 → "포트 포워딩" / "NAT 설정":

| 외부 포트 | 내부 IP | 내부 포트 | 프로토콜 |
|---|---|---|---|
| 80 | 192.168.0.100 | 80 | TCP |
| 443 | 192.168.0.100 | 443 | TCP |

### 8.3 공인 IP 확인
```powershell
curl.exe ifconfig.me
```

휴대폰 데이터로 `http://<공인IP>` 접속해 확인 (아직 HTTPS 아니므로 HTTP).

---

## 9. DDNS 설정 (IP 자주 바뀌는 가정용 인터넷)

### DuckDNS 기준

1. https://www.duckdns.org 가입 → `myplanner` 같은 서브도메인 생성
2. 토큰 복사

3. 서버 PC에 자동 업데이트 스크립트 만들기:
   ```powershell
   # C:\super-planner\duckdns\update.ps1 생성
   New-Item -ItemType Directory -Force C:\super-planner\duckdns | Out-Null
   @'
   $domain = "myplanner"
   $token = "YOUR_TOKEN_HERE"
   Invoke-WebRequest -Uri "https://www.duckdns.org/update?domains=$domain&token=$token&ip=" -OutFile C:\super-planner\duckdns\last.log
   '@ | Out-File -Encoding utf8 C:\super-planner\duckdns\update.ps1
   ```

4. **작업 스케줄러**로 5분마다 실행:
   - `Win + R` → `taskschd.msc`
   - 작업 만들기 → 이름: "DuckDNS update"
   - 트리거: 매일 → 반복 주기 5분 → 무기한
   - 동작: 프로그램 시작
     - 프로그램: `powershell.exe`
     - 인수: `-ExecutionPolicy Bypass -File "C:\super-planner\duckdns\update.ps1"`
   - ✅ **사용자 로그온 여부에 상관없이 실행**

---

## 10. Caddy로 HTTPS

### 10.1 Caddyfile 편집
```powershell
cd C:\super-planner
Copy-Item Caddyfile.example Caddyfile
notepad Caddyfile
```

`planner.example.com` → 본인 도메인(예: `myplanner.duckdns.org`)으로 교체, 저장.

### 10.2 docker-compose.yml에서 Caddy 활성화
```powershell
notepad docker-compose.yml
```

`# caddy:` 블록과 맨 아래 `# volumes:` 블록의 `#` 전부 제거 → 저장.

### 10.3 재기동
```powershell
docker compose down
docker compose up -d
docker compose logs -f caddy
```

Caddy가 Let's Encrypt에서 인증서 자동 발급. `certificate obtained successfully` 비슷한 로그 뜨면 성공.

### 10.4 최종 확인
휴대폰 데이터로 `https://myplanner.duckdns.org` 접속 → 🔒 자물쇠 확인 → 로그인 화면.

---

## 11. 자동 시작 최종 확인

**정전 후 복구 시나리오**:
1. Windows 부팅 →
2. 자동 로그인 (3.2 설정) →
3. Docker Desktop 자동 시작 (2.3 설정) →
4. Docker가 `restart: unless-stopped` 정책으로 컨테이너 자동 재기동 →
5. Caddy가 인증서 캐시로 즉시 서비스 시작

**테스트 방법**: 서버 PC 전원 강제 종료 후 다시 켜기 → 5분 후 외부에서 접속 확인.

---

## 12. 자동 백업 (작업 스케줄러)

### 12.1 백업 스크립트
```powershell
# C:\super-planner\backup.ps1
@'
$date = Get-Date -Format "yyyyMMdd-HHmm"
$backupDir = "C:\super-planner-backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null

# SQLite 파일 복사 (WAL 모드 안전하게 내보내기)
cd C:\super-planner
docker compose exec -T app sh -c "cat /app/data/binder.sqlite" > "$backupDir\binder-$date.sqlite"

# 30일 넘은 백업 삭제
Get-ChildItem $backupDir -Filter "binder-*.sqlite" | 
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
  Remove-Item
'@ | Out-File -Encoding utf8 C:\super-planner\backup.ps1
```

### 12.2 스케줄러 등록
```powershell
# 관리자 PowerShell
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument '-ExecutionPolicy Bypass -File C:\super-planner\backup.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "SuperPlanner Backup" `
  -Action $action -Trigger $trigger -RunLevel Highest -User "SYSTEM"
```

### 12.3 외부 저장소 복제 (선택)
OneDrive / Google Drive 동기화 폴더에 백업을 두면 자동으로 클라우드 업로드:
- `$backupDir`를 `C:\Users\<당신>\OneDrive\planner-backups` 같은 경로로 변경

---

## 13. 업데이트 (코드 변경 반영)

### Git 방식
```powershell
cd C:\super-planner
git pull
docker compose build
docker compose up -d
```

### 파일 복사 방식
1. 코딩 PC에서 바뀐 파일만 서버 PC로 복사 (같은 경로에 덮어쓰기)
2. 서버에서:
   ```powershell
   cd C:\super-planner
   docker compose build
   docker compose up -d
   ```

DB 마이그레이션은 자동 적용됩니다.

---

## 14. 비밀번호 변경

```powershell
cd C:\super-planner
docker run --rm -v ${PWD}:/app -w /app node:20-alpine `
  sh -c "npm install argon2 --silent && node scripts/hash-password.mjs 새비밀번호" `
  | Out-File -Encoding utf8 .env

docker compose up -d --force-recreate app
```

---

## 15. 문제 해결

### Docker Desktop이 시작 안 됨
- **BIOS 가상화 확인**: 작업 관리자 → 성능 → CPU → "가상화: 사용" 이어야 함. "사용 안 함"이면 BIOS 들어가서 Intel VT-x / AMD-V 활성화
- WSL2 업데이트: `wsl --update`

### `docker compose build`가 오래 걸리다 멈춤
- Docker Desktop Settings → Resources → WSL Integration: 충분한 메모리 할당 (4GB+)
- 네트워크 문제면 `--no-cache` 옵션 빼고 다시 시도

### `.env` 읽히지 않음 (앱이 `SESSION_SECRET` 에러로 죽음)
- 파일 인코딩 문제. 메모장에서 `파일 → 다른 이름으로 저장` → 인코딩 **UTF-8 (BOM 없음)** 선택하여 덮어쓰기

### 외부 접속 안 됨
1. **공인 IP 체크**: `curl.exe ifconfig.me` 로 나온 IP가 DDNS에 실제로 등록되어 있는지 `nslookup myplanner.duckdns.org` 로 확인
2. **공유기 포트포워딩**: 관리자 페이지에서 80/443이 서버 IP로 향해 있는지 다시 확인
3. **통신사 80/443 차단**: 일부 ISP(SK/KT 일부 지역)가 80포트 차단. 이 경우:
   - Caddy 포트를 8443 등으로 바꾸고 `https://myplanner.duckdns.org:8443` 으로 접속
   - 또는 **Cloudflare Tunnel** 사용 (포트 포워딩 불필요)
4. **Windows 방화벽**: `Get-NetFirewallRule -DisplayName "Super Planner*"` 로 규칙 확인

### 인증서 발급 실패
```powershell
docker compose logs caddy | Select-String -Pattern "error"
```
- `no such host` → DNS 설정이 아직 전파 중 (5분~몇 시간 기다리기)
- `timeout` → 80 포트가 외부에서 서버까지 도달 못함. 포트포워딩 재확인

### Docker Desktop이 WSL2 용량을 너무 많이 먹음
```powershell
# 가끔 청소
docker system prune -a
wsl --shutdown
```

---

## 16. 보안 체크리스트

- [ ] 앱 비밀번호 12자 이상 (대/소/숫자/특수문자 섞기)
- [ ] Windows 사용자 비밀번호도 강력하게
- [ ] Windows 자동 업데이트 켜 두기
- [ ] Windows Defender 켜 두기 (기본 켜져 있음)
- [ ] RDP/SSH 열었다면 공인 IP 직접 노출 피하기 — Tailscale 같은 VPN 사용 추천
- [ ] 공유기 펌웨어 최신으로 유지
- [ ] 백업을 다른 저장소(OneDrive 등)에도 복제

---

## 17. 완료 체크리스트

1. ☐ Windows 절전/자동로그인 설정
2. ☐ Docker Desktop 설치 + 자동시작
3. ☐ 코드 복사
4. ☐ `.env` 생성
5. ☐ `docker compose up -d` 성공, 로컬 접속 확인
6. ☐ Windows 방화벽 80/443 허용
7. ☐ 공유기 IP 고정 + 포트포워딩
8. ☐ DDNS 도메인 + 자동 업데이트
9. ☐ Caddyfile 편집 + HTTPS 작동
10. ☐ 외부(휴대폰 데이터)에서 HTTPS 접속 OK
11. ☐ 재부팅 테스트 — 자동 복구 확인
12. ☐ 백업 스케줄러 등록

---

## 간편 요약 (참고용)

```powershell
# 최초 1회
wsl --install                              # WSL2
# Docker Desktop 설치 (수동)
cd C:\super-planner
docker run --rm -v ${PWD}:/app -w /app node:20-alpine `
  sh -c "npm install argon2 --silent && node scripts/hash-password.mjs mypass" `
  | Out-File -Encoding utf8 .env
docker compose build
docker compose up -d

# 방화벽
New-NetFirewallRule -DisplayName "Planner 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Planner 443" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# 업데이트
cd C:\super-planner
git pull
docker compose build
docker compose up -d
```

막히는 단계 있으면 그 번호 + 에러 메시지 알려주세요.
