export const hexToRgba = (hex: string, alpha: number): string => {
  const h = (hex || '#999999').replace('#', '');
  if (h.length !== 6) return `rgba(161,161,170,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Standard tint levels used across the app.
// 사용자 카테고리는 이미 파스텔톤(밝은 색)이라 투명도를 충분히 높여야 눈에 띕니다.
// TimeBlocks 앱처럼 색이 분명히 보이는 것이 목표.
export const tint = {
  subtle: (hex: string) => hexToRgba(hex, 0.35),  // 행 배경, hover — 은은하지만 분명히 보임
  soft:   (hex: string) => hexToRgba(hex, 0.70),  // 타임블록 본체, 칩 배경 — 색 정체성 뚜렷
  strong: (hex: string) => hexToRgba(hex, 0.90),  // 선택됨/활성 상태
  bar:    (hex: string) => hex,                   // 솔리드 악센트 (좌측 바)
};
