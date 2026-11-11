const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/** columns: [{ key, label }], rows: [{ [key]: value }] */
function toCsv(columns, rows) {
  const escape = (value) => {
    const str = value == null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

async function toExcelBuffer(title, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel sheet name limit

  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 2, 14) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

function toPdfBuffer(title, columns, rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('gray').text(`Generated ${new Date().toISOString()}`);
    doc.moveDown(1);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;

    const drawRow = (values, { bold = false } = {}) => {
      const y = doc.y;
      doc.fontSize(8).fillColor('black').font(bold ? 'Helvetica-Bold' : 'Helvetica');
      values.forEach((value, i) => {
        doc.text(value == null ? '' : String(value), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
      doc.moveDown(1);
    };

    drawRow(columns.map((c) => c.label), { bold: true });
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.3);

    rows.forEach((row) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage({ layout: 'landscape' });
      drawRow(columns.map((c) => row[c.key]));
    });

    doc.end();
  });
}

const CONTENT_TYPES = {
  csv: 'text/csv',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};
const EXTENSIONS = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };

async function sendExport(res, format, title, columns, rows) {
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${EXTENSIONS[format]}`;
  res.setHeader('Content-Type', CONTENT_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  if (format === 'csv') return res.send(toCsv(columns, rows));
  if (format === 'excel') return res.send(Buffer.from(await toExcelBuffer(title, columns, rows)));
  if (format === 'pdf') return res.send(await toPdfBuffer(title, columns, rows));
  throw new Error(`Unsupported export format '${format}'`);
}

module.exports = { toCsv, toExcelBuffer, toPdfBuffer, sendExport };
