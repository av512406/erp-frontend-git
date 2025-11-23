// Convert a number into Indian currency words (Rupees ... Only).
// Supports up to crores; handles paise if decimals present.
export function amountToIndianWords(n: number): string {
  if (!isFinite(n)) return '';
  const rounded = Math.round(n * 100); // in paise
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;

  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(num: number): string {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return tens[t] + (o ? ' ' + ones[o] : '');
  }

  function threeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return (h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? twoDigits(rest) : '');
  }

  // Indian grouping: Crore, Lakh, Thousand, Hundred
  let words: string[] = [];
  function pushSegment(value: number, label: string) {
    if (value > 0) words.push((value < 100 ? twoDigits(value) : threeDigits(value)) + ' ' + label);
  }

  const crore = Math.floor(rupees / 10000000); // 1,00,00,000
  const lakh = Math.floor((rupees % 10000000) / 100000); // 1,00,000
  const thousand = Math.floor((rupees % 100000) / 1000); // 1,000
  const hundredRest = rupees % 1000;

  pushSegment(crore, 'Crore');
  pushSegment(lakh, 'Lakh');
  pushSegment(thousand, 'Thousand');
  if (hundredRest > 0) words.push(threeDigits(hundredRest));

  const rupeeWords = words.join(' ').trim() || 'Zero';
  const paiseWords = paise ? twoDigits(paise) + ' Paise' : '';
  return 'Rupees ' + rupeeWords + (paiseWords ? ' and ' + paiseWords : '') + ' Only';
}
