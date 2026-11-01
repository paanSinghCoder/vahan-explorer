// Minimal reader for the first worksheet of the Excel export (Apache POI output).
import { strFromU8, unzipSync } from 'fflate';
import { decodeEntities } from './html.ts';

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Returns the first sheet as rows of cell text (empty cells are ''). */
export function readFirstSheet(data: Uint8Array): string[][] {
  const files = unzipSync(data);
  const sheetXml = files['xl/worksheets/sheet1.xml'];
  if (!sheetXml) throw new Error('Export did not contain a worksheet');

  const shared: string[] = [];
  if (files['xl/sharedStrings.xml']) {
    for (const si of strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeEntities([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
    }
  }

  const rows: string[][] = [];
  for (const row of strFromU8(sheetXml).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of row[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = (c[2].match(/t="(\w+)"/) || [])[1];
      const body = c[3] ?? '';
      let value = '';
      if (type === 's') value = shared[Number((body.match(/<v>([^<]*)<\/v>/) || [])[1])] ?? '';
      else if (type === 'inlineStr') value = decodeEntities([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
      else value = decodeEntities((body.match(/<v>([^<]*)<\/v>/) || [])[1] ?? '');
      const idx = columnIndex(c[1]);
      while (cells.length < idx) cells.push('');
      cells[idx] = value.trim();
    }
    rows.push(cells);
  }
  return rows;
}
