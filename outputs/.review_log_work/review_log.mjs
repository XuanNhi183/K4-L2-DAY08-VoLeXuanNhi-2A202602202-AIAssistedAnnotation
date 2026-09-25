import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const workDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(workDir, '../..');
const target = path.join(root, 'reports/REVIEW_LOG.csv');
const destination = process.argv.includes('--draft') ? path.join(workDir, 'REVIEW_LOG.csv') : target;
const workbook = await Workbook.fromCSV(await fs.readFile(target, 'utf8'), {sheetName: 'Review'});
const sheet = workbook.worksheets.getItem('Review');
const inspectOnly = process.argv.includes('--inspect');
if (inspectOnly) {
  console.log(workbook.help('workbook.toCSV', {include: 'index,examples,notes', maxChars: 2000}).ndjson);
} else {
  sheet.getRange('A2:E4').values = [
    [1, 'frame_0182.jpg', 'xe bị cắt ở mép dưới bên phải', 'added', 'Bổ sung khung cho phần xe còn nhìn thấy trong ảnh.'],
    [1, 'frame_0107.jpg', 'khung gộp hai xe có đèn hậu ở giữa ảnh', 'deleted', 'Xóa khung gộp để mỗi xe có một khung riêng.'],
    [1, 'frame_0099.jpg', 'xe tối có hai đèn hậu ở nửa phải ảnh', 'edited', 'Mở rộng cạnh trái của khung để bao đủ phần thân xe nhìn thấy.'],
  ];
}
// Formatting is only for temporary QA previews; the requested file remains CSV.
sheet.getRange('A1:E4').format.font = {name: 'Arial', size: 11};
for (const [column, width] of [['A', 65], ['B', 135], ['C', 360], ['D', 90], ['E', 590]]) {
  sheet.getRange(`${column}1:${column}4`).format.columnWidthPx = width;
}
sheet.getRange('A1:E4').format.rowHeightPx = 28;
workbook.recalculate();
const range = inspectOnly ? 'A1:E2' : 'A1:E4';
console.log((await workbook.inspect({kind: 'table', range: `Review!${range}`, include: 'values', tableMaxRows: 4, tableMaxCols: 5, maxChars: 3500})).ndjson);
const preview = await workbook.render({sheetName: 'Review', range, scale: 1, format: 'png'});
await fs.writeFile(path.join(workDir, inspectOnly ? 'before.png' : 'after.png'), new Uint8Array(await preview.arrayBuffer()));
if (!inspectOnly) {
  const rows = sheet.getRange('A1:E4').values;
  const quote = value => /[",\r\n]/.test(String(value)) ? '"' + String(value).replaceAll('"', '""') + '"' : String(value);
  await fs.writeFile(destination, rows.map(row => row.map(quote).join(',')).join('\n') + '\n', 'utf8');
  console.log(`Saved ${path.relative(root, destination)}`);
}
