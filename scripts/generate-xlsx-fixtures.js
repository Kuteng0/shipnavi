#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(repoRoot, 'test-fixtures');

function csvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value.length || row.length || input.endsWith(',')) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function loadWorkbookBuilder() {
  const context = {
    console,
    Blob,
    Response,
    DecompressionStream,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    DataView,
    ArrayBuffer,
    URL: { createObjectURL() { return 'blob:xlsx-fixture-generation'; }, revokeObjectURL() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} },
    window: { setTimeout() {} },
    document: { body: { classList: { contains() { return false; } } }, querySelector() { return null; }, createElement() { return {}; } },
    FileReader: function FileReader() {},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(repoRoot, 'assets/dashboard.js'), 'utf8'), context, { filename: 'assets/dashboard.js' });
  return (sheets) => vm.runInContext('buildXlsxWorkbook(__sheets)', Object.assign(context, { __sheets: sheets }));
}

function listCsvFixtures(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCsvFixtures(fullPath);
    return entry.isFile() && entry.name.endsWith('.csv') ? [fullPath] : [];
  });
}

function writeXlsxFixture(buildWorkbook, csvFile) {
  const xlsxFile = csvFile.replace(/\.csv$/i, '.xlsx');
  const rows = csvRows(fs.readFileSync(csvFile, 'utf8'));
  const arrayBuffer = buildWorkbook([{ name: '入力データ', rows }]);
  fs.writeFileSync(xlsxFile, Buffer.from(arrayBuffer));
  return xlsxFile;
}

function main() {
  const buildWorkbook = loadWorkbookBuilder();
  const csvFiles = listCsvFixtures(fixtureRoot).sort();
  const generated = csvFiles.map((csvFile) => writeXlsxFixture(buildWorkbook, csvFile));
  generated.forEach((file) => console.log(`generated ${path.relative(repoRoot, file)}`));
  console.log(`Generated ${generated.length} XLSX fixture files.`);
}

if (require.main === module) main();

module.exports = { csvRows, listCsvFixtures, main };
