import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용 standalone 출력
  output: "standalone",
  // 네이티브/대형 바이너리 파서 패키지는 번들러가 처리하지 않게 server external로 지정
  serverExternalPackages: ["better-sqlite3", "argon2", "exceljs", "officecrypto-tool"],
};

export default nextConfig;
