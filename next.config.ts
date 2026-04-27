import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용 standalone 출력
  output: "standalone",
  // better-sqlite3는 네이티브 모듈 — 번들러가 처리하지 못하게 server external로 지정
  serverExternalPackages: ["better-sqlite3", "argon2"],
};

export default nextConfig;
