// محلّل CSV صغير بدون أي مكتبة خارجية (المشروع ما فيه أي مكتبة CSV أصلاً،
// وحجم الاستخدام هنا -- تقارير تصدير من Awin/CJ/Amazon -- ما يستاهل إضافة
// اعتمادية جديدة). يدعم الحقول المقتبسة بعلامات اقتباس مزدوجة ("...") مع
// فواصل و"" هروب لعلامة اقتباس داخل الحقل، مطابقاً RFC 4180 الأساسي --
// كافي لتقارير Associates Central وأشباهها.
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? '';
    });
    return record;
  });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      if (row.some((v) => v !== '')) rows.push(row); // يتجاهل الأسطر الفاضية تماماً
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== '')) rows.push(row);
  }

  return rows;
}
