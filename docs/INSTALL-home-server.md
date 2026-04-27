# 집 서버 설치 가이드

Super 플래너를 집에 있는 여분 PC(또는 NAS)에 올려 외부에서도 접속할 수 있게 만드는 전체 과정입니다.

---

## 0. 준비물 체크리스트

- [ ] **서버 역할 PC** — 24시간 켜 둘 여분 컴퓨터 (오래된 노트북도 OK)
  - 최소 사양: CPU 2코어, RAM 2GB, 저장소 10GB
  - 권장: RAM 4GB 이상 (여유)
- [ ] **유선 인터넷** — 서버는 Wi-Fi보다 랜선 권장
- [ ] **공유기 관리자 접근** — 포트 포워딩 설정 위해
- [ ] **도메인** (선택) — `planner.example.com` 같은 주소로 접속하려면. 무료 옵션:
  - [DuckDNS](https://www.duckdns.org/) — `yourname.duckdns.org` 무료
  - [No-IP](https://www.noip.com/) — 한 달마다 수동 갱신 필요
  - 이미 가지고 있으면 Cloudflare/가비아 등 아무거나
- [ ] **코딩 PC에서 서버 PC로 파일 옮길 방법** — USB, SSH/SCP, Git 등

---

## 1. 서버 OS 설치 및 준비

### 선택지 A. Ubuntu Server 24.04 LTS (권장)
가장 안정적이고 문서 많음. 원격 관리 쉬움.

1. https://ubuntu.com/download/server 에서 ISO 다운로드
2. Rufus 같은 도구로 USB에 기록
3. 서버 PC에서 USB 부팅 → 설치 중 "OpenSSH 설치" 체크 (원격 접속용)
4. 설치 끝나면 유선 랜 꽂고 재부팅
5. 설치 중에 설정한 아이디/비밀번호로 로그인

> 이후 모든 작업은 코딩 PC에서 **SSH**로 원격 접속해서 하면 편합니다. Windows PowerShell에서:
> ```powershell
> ssh youruser@192.168.0.100
> ```
> (서버 IP는 서버 로그인 후 `ip addr | grep inet` 으로 확인)

### 선택지 B. Windows 10/11
이미 Windows가 깔려 있으면 그대로 써도 됨. **Docker Desktop** 설치 필요:
- https://www.docker.com/products/docker-desktop/
- 설치 후 WSL2 백엔드 활성화
- 이 경우 아래 Linux 명령 대부분은 PowerShell에서 동일하게 동작

### 선택지 C. Synology/QNAP NAS
- DSM/QTS 패키지센터에서 "Container Manager" (구 Docker) 설치
- SSH 켜고 `docker compose` 명령 사용 — 이후 과정은 Ubuntu와 거의 동일

---

## 2. Docker 설치 (Ubuntu 기준)

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 공식 설치 스크립트
curl -fsSL https://get.docker.com | sudo sh

# 현재 사용자를 docker 그룹에 추가 (sudo 없이 docker 쓰려고)
sudo usermod -aG docker $USER

# 로그아웃 후 다시 로그인 (또는 재부팅)
exit
# 다시 SSH 접속

# 설치 확인
docker --version
docker compose version
```

---

## 3. 앱 코드 서버로 옮기기

### 방법 A. Git (권장, 나중에 업데이트 편함)

1. 코딩 PC에서 GitHub(또는 Gitea/GitLab) private repo 만들고 push:
   ```bash
   cd "C:\Users\young\Desktop\young\5. 3P바인더\3p-binder"
   git init  # 이미 git repo 인지 먼저 확인
   git add .
   git commit -m "initial"
   git remote add origin <repo-url>
   git push -u origin main
   ```

2. 서버에서 pull:
   ```bash
   cd ~
   git clone <repo-url> super-planner
   cd super-planner
   ```

### 방법 B. 압축 파일 전송

1. 코딩 PC에서 폴더 압축 (`node_modules`, `.next`, `data` 제외)
   - 7-Zip으로 `super-planner.zip` 만들기
2. SCP로 전송:
   ```powershell
   scp super-planner.zip youruser@192.168.0.100:~/
   ```
3. 서버에서 압축 해제:
   ```bash
   cd ~
   unzip super-planner.zip -d super-planner
   cd super-planner
   ```

---

## 4. 환경변수 설정

서버에서:

```bash
cd ~/super-planner

# Node.js가 서버에 있어야 아래 스크립트 실행 가능.
# 없으면 Docker로 한 번만 실행:
docker run --rm -v $(pwd):/app -w /app node:20-alpine \
  sh -c "npm install argon2 && node scripts/hash-password.mjs 원하는비밀번호" \
  > .env

# 또는 Node 직접 설치해서:
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# sudo apt install -y nodejs
# npm install argon2
# node scripts/hash-password.mjs 원하는비밀번호 > .env

# 결과 확인
cat .env
```

`.env`에 3가지가 있어야 합니다:
```
APP_USERNAME=admin
APP_PASSWORD_HASH=\$argon2id\$v=19\$...
SESSION_SECRET=<64자 hex>
DB_PATH=/app/data/binder.sqlite
```

---

## 5. Docker로 앱 띄우기

```bash
cd ~/super-planner

# 이미지 빌드 (처음 한 번, 5~10분 소요)
docker compose build

# 백그라운드 실행
docker compose up -d

# 로그 확인 (Ctrl+C로 빠져나와도 앱은 계속 실행)
docker compose logs -f app

# 상태 확인
docker compose ps
```

정상 기동 시 로컬에서 접속 테스트:
```bash
curl -I http://localhost:3000/login
# HTTP/1.1 200 OK 떠야 함
```

여기까지 되면 **집 네트워크 내부**에서는 `http://서버IP:3000` 으로 접속 가능. 외부 노출은 다음 단계.

---

## 6. 공유기 설정 (외부에서 접근하려면)

### 6.1 서버 내부 IP 고정
공유기 관리자 페이지 접속 (보통 `192.168.0.1` 또는 `192.168.1.1`):
- **DHCP 예약** 또는 **고정 IP 할당** 기능 찾기
- 서버의 MAC 주소를 찾아 IP를 고정 (예: `192.168.0.100`)
- 서버에서 MAC 확인: `ip link`

### 6.2 포트 포워딩
공유기 관리자 페이지 → "포트 포워딩" / "NAT" 메뉴:

| 외부 포트 | 내부 IP | 내부 포트 | 프로토콜 |
|---|---|---|---|
| 80 | 192.168.0.100 | 80 | TCP |
| 443 | 192.168.0.100 | 443 | TCP |

> 3000 포트는 **열지 마세요**. HTTPS 종료는 Caddy(80/443)가 담당하고, 3000은 내부 전용.

### 6.3 공인 IP 확인
```bash
curl ifconfig.me
```
이 IP로 외부에서 서버에 도달 가능한지 휴대폰 데이터로 `http://<공인IP>` 접속해 테스트.

### 6.4 DDNS 설정 (IP가 바뀌는 경우)
대부분 가정용 인터넷은 IP가 주기적으로 바뀝니다. **DuckDNS 예시**:

1. https://www.duckdns.org 가입 → `myplanner` 같은 서브도메인 하나 생성
2. 주어진 토큰 복사
3. 서버에서 자동 업데이트 cron 설정:
   ```bash
   mkdir -p ~/duckdns
   cat > ~/duckdns/duck.sh << 'EOF'
   echo url="https://www.duckdns.org/update?domains=myplanner&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
   EOF
   chmod +x ~/duckdns/duck.sh
   crontab -e
   # 아래 줄 추가 후 저장
   # */5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
   ```
4. 이제 `myplanner.duckdns.org` 으로 서버 접속 가능

---

## 7. Caddy로 HTTPS 붙이기

### 7.1 Caddyfile 준비
```bash
cd ~/super-planner
cp Caddyfile.example Caddyfile
nano Caddyfile
```

`planner.example.com` 부분을 본인 도메인으로 교체 (예: `myplanner.duckdns.org`), 저장.

### 7.2 compose에서 Caddy 서비스 활성화
```bash
nano docker-compose.yml
```

파일 아래쪽의 `# caddy:` 블록과 맨 아래 `# volumes:` 블록의 `#` 제거해서 활성화 → 저장.

### 7.3 재기동
```bash
docker compose down
docker compose up -d
docker compose logs -f caddy
```

Caddy가 자동으로 Let's Encrypt에서 인증서를 받아옵니다. 로그에 `certificate obtained successfully` 같은 메시지가 뜨면 성공.

### 7.4 접속 테스트
휴대폰 데이터 켜고 `https://myplanner.duckdns.org` 접속 → 로그인 화면 → 🔒 자물쇠 표시 확인.

---

## 8. 자동 시작 설정

Docker는 `restart: unless-stopped` 정책 덕분에 재부팅 시 자동 재기동됩니다. 다만 Docker 서비스 자체는 부팅 시 시작되도록 해야 합니다.

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

테스트: 서버 재부팅 후 몇 분 뒤 접속 확인.

```bash
sudo reboot
```

---

## 9. 백업 설정 (자동)

### 9.1 SQLite 파일 정기 백업

서버에 `~/backups` 폴더 만들고 cron 등록:

```bash
mkdir -p ~/backups
cat > ~/backup-planner.sh << 'EOF'
#!/bin/bash
cd ~/super-planner
DATE=$(date +%Y%m%d-%H%M)
docker compose exec -T app sh -c "cat /app/data/binder.sqlite" > ~/backups/binder-$DATE.sqlite
# 30일 넘은 백업 자동 삭제
find ~/backups -name "binder-*.sqlite" -mtime +30 -delete
EOF
chmod +x ~/backup-planner.sh

crontab -e
# 매일 새벽 3시 백업:
# 0 3 * * * ~/backup-planner.sh
```

### 9.2 외부 저장소로 복제 (선택)
중요한 데이터라면 다른 곳에도 복사:
```bash
# rclone 으로 Google Drive/Dropbox 에 올리기
sudo apt install rclone -y
rclone config  # 대화식 설정
# backup 스크립트 끝에 추가:
# rclone copy ~/backups/ gdrive:planner-backups/
```

---

## 10. 업데이트 (코드 변경 반영)

### Git 방식으로 올린 경우
```bash
cd ~/super-planner
git pull
docker compose build
docker compose up -d
```

### 압축 파일 방식
1. 코딩 PC에서 새 zip 만들어 SCP 전송
2. 서버에서 해제 → `docker compose build && docker compose up -d`

> **DB 마이그레이션**은 자동 적용됩니다 (`getDb()` 가 시작 시 실행).

---

## 11. 비밀번호 변경
```bash
cd ~/super-planner
docker run --rm -v $(pwd):/app -w /app node:20-alpine \
  sh -c "npm install argon2 --silent && node scripts/hash-password.mjs 새비밀번호" \
  > .env
docker compose up -d --force-recreate app
```

---

## 12. 문제 해결

### 컨테이너가 계속 재시작됨
```bash
docker compose logs app --tail 100
```
자주 보이는 원인:
- `.env` 에 `SESSION_SECRET` 이 32자 미만 → 새로 생성
- `APP_PASSWORD_HASH` 에 `$` 이스케이프 안 됨 → `hash-password.mjs` 다시 실행
- `./data` 권한 문제 → `sudo chown -R 1001:1001 ./data`

### 외부에서 접속 안 됨
1. 공유기 포트 포워딩 다시 확인 (외부 80/443 → 내부 IP 80/443)
2. 통신사가 80/443 포트를 막은 경우 → 비표준 포트(예: 8443) 쓰고 Caddy 설정에서 대응
3. 방화벽: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow ssh`

### HTTPS 인증서 발급 실패
- 도메인 A 레코드가 공인 IP를 정확히 가리키는지 확인
- 80 포트가 열려 있어야 Let's Encrypt 검증 가능
- `docker compose logs caddy` 에서 상세 에러 확인

### 느림
- SQLite는 WAL 모드이지만 RAM 적으면 한계. `docker stats` 로 메모리 확인
- 사진/이미지 저장은 지원 안 함 → 용량 걱정 적음

---

## 13. 보안 체크리스트 (외부 노출 시)

- [ ] 비밀번호는 12자 이상, 사전 공격 어려운 조합
- [ ] SSH 는 비밀번호 로그인 금지, 공개키 인증만 허용
  ```bash
  sudo nano /etc/ssh/sshd_config
  # PasswordAuthentication no
  sudo systemctl restart ssh
  ```
- [ ] `sudo ufw enable` 로 방화벽 활성화, 필요한 포트만 허용
- [ ] 정기적으로 `sudo apt upgrade` 로 OS 업데이트
- [ ] 로그인 실패 반복 시 IP 차단 — `sudo apt install fail2ban`
- [ ] SQLite 백업은 암호화해서 외부 저장소에 올리기

---

## 요약 체크리스트

1. ☐ Ubuntu Server 설치
2. ☐ Docker + docker compose 설치
3. ☐ 코드 서버로 복사
4. ☐ `.env` 생성 (비밀번호 해시)
5. ☐ `docker compose build && docker compose up -d`
6. ☐ 공유기 IP 고정 + 80/443 포트 포워딩
7. ☐ 도메인 (DDNS) 설정
8. ☐ `Caddyfile` 편집 + Caddy 서비스 활성화
9. ☐ HTTPS 접속 확인
10. ☐ 자동 백업 cron 등록

막히는 단계 있으면 그 단계 번호와 에러 메시지 알려주시면 도와드릴게요.
