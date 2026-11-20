// No-op stub for the `server-only` module so Vitest can import server modules.
// Next.js provides `server-only` to enforce that a file is only imported in
// server contexts; in unit tests we bypass that constraint deliberately.
export {};
