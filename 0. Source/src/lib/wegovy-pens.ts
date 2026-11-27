// Korean Wegovy multidose pre-filled pens. Capacity is stored by the journal in micrograms.
export const wegovyDosesPerPen = 4;
export const wegovyPens = [
  { stage: '1단계 · 시작', doseMcg: 250 },
  { stage: '2단계 · 증량', doseMcg: 500 },
  { stage: '3단계 · 증량', doseMcg: 1000 },
  { stage: '4단계 · 증량', doseMcg: 1700 },
  { stage: '5단계 · 유지', doseMcg: 2400 },
].map(pen => ({ ...pen, capacityMcg: pen.doseMcg * wegovyDosesPerPen }));

export const wegovyProductInfo = 'https://www.novonordisk.co.kr/patient/list-of-products.html';
export const wegovyInstructions = 'https://www.ema.europa.eu/en/documents/product-information/wegovy-epar-product-information_en.pdf';
