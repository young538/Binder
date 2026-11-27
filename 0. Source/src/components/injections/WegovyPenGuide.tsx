import { mg } from '@/lib/injections';
import { wegovyDosesPerPen, wegovyInstructions, wegovyPens, wegovyProductInfo } from '@/lib/wegovy-pens';
import styles from './journal.module.css';

export function WegovyPenGuide() {
  return <details className={styles.guide}>
    <summary>위고비 펜 규격·다이얼 안내</summary>
    <table>
      <caption>국내 위고비 프리필드펜 · 펜당 {wegovyDosesPerPen}회분</caption>
      <thead><tr><th scope="col">성인 체중관리 단계</th><th scope="col">1회 표시 용량</th><th scope="col">펜 전체 용량</th></tr></thead>
      <tbody>{wegovyPens.map(pen => <tr key={pen.doseMcg}>
        <th scope="row">{pen.stage}</th><td>{mg(pen.doseMcg)} mg</td><td>{mg(pen.capacityMcg)} mg</td>
      </tr>)}</tbody>
    </table>
    <p className={styles.note}>다이얼의 용량 표시창에서 처방된 mg을 확인하세요. 제조사는 클릭 소리를 세어 용량을 설정하지 말라고 안내합니다.</p>
    <p className={styles.note}>국내 제품의 개봉 후 사용 기한은 최대 6주입니다.{' '}
      <a href={wegovyProductInfo} target="_blank" rel="noreferrer">국내 제품정보</a> ·{' '}
      <a href={wegovyInstructions} target="_blank" rel="noreferrer">펜 사용설명서</a>
    </p>
  </details>;
}
