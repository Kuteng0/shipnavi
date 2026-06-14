#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(repoRoot, 'test-fixtures');

const results = [];
let failureCount = 0;
let pendingCount = 0;

function report(status, name, details = {}) {
  const line = { status, name, ...details };
  results.push(line);
  if (status === 'FAIL') failureCount += 1;
  if (status.endsWith('_PENDING') || status === 'PENDING') pendingCount += 1;
  const suffix = Object.keys(details).length ? ` ${JSON.stringify(details)}` : '';
  console.log(`${status} ${name}${suffix}`);
}

function fail(name, details) {
  report('FAIL', name, details);
}

function pass(name, details) {
  report('PASS', name, details);
}

function pending(kind, name, details) {
  report(kind, name, details);
}

function warning(name, details) {
  report('WARNING', name, details);
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function fixturePath(...parts) {
  return path.join(fixtureRoot, ...parts);
}

function expectedXlsxFixtures() {
  if (!fs.existsSync(fixtureRoot)) return [];
  const csvFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.csv')) csvFiles.push(fullPath);
    }
  }
  walk(fixtureRoot);
  return csvFiles.map((file) => file.replace(/\.csv$/i, '.xlsx')).sort();
}

function ensureXlsxFixturesGenerated() {
  const missing = expectedXlsxFixtures().filter((file) => !fs.existsSync(file));
  if (!missing.length) return;
  console.log(`INFO XLSX fixtures missing; generating with node scripts/generate-xlsx-fixtures.js {\"count\":${missing.length}}`);
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'generate-xlsx-fixtures.js')], { cwd: repoRoot, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    fail('XLSX fixture generation succeeds', { expected: 0, actual: result.status, command: 'node scripts/generate-xlsx-fixtures.js' });
    return;
  }
  const stillMissing = missing.filter((file) => !fs.existsSync(file));
  if (stillMissing.length) {
    fail('XLSX fixtures generated', { expected: 'all generated', actual: stillMissing.map((file) => path.relative(repoRoot, file)) });
  } else {
    pass('XLSX fixtures generated from CSV sources', { count: missing.length });
  }
}

function assertEqual(name, actual, expected, details = {}) {
  if (actual === expected) pass(name, details);
  else fail(name, { ...details, expected, actual });
}

function assertTruthy(name, actual, details = {}) {
  if (actual) pass(name, details);
  else fail(name, { ...details, expected: 'truthy', actual });
}

function assertIncludes(name, list, expected, details = {}) {
  if (Array.isArray(list) && list.includes(expected)) pass(name, details);
  else fail(name, { ...details, expected, actual: list });
}

function loadDashboardContext() {
  const store = new Map();
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
    URL: { createObjectURL() { return 'blob:fixture-validation'; }, revokeObjectURL() {} },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    },
    window: { setTimeout() {} },
    document: {
      body: { classList: { contains() { return false; } } },
      querySelector() { return null; },
      createElement() { return {}; },
    },
    FileReader: function FileReader() {
      this.listeners = {};
      this.result = null;
      this.addEventListener = (name, callback) => { this.listeners[name] = callback; };
      this.readAsText = (file) => {
        this.result = file._text ?? fs.readFileSync(file.path, 'utf8');
        this.listeners.load?.();
      };
      this.readAsArrayBuffer = (file) => {
        const buffer = file._buffer ?? fs.readFileSync(file.path);
        this.result = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        this.listeners.load?.();
      };
    },
  };
  vm.createContext(context);
  const code = fs.readFileSync(path.join(repoRoot, 'assets/dashboard.js'), 'utf8');
  vm.runInContext(code, context, { filename: 'assets/dashboard.js' });
  context.__store = store;
  return context;
}

ensureXlsxFixturesGenerated();
const ctx = loadDashboardContext();
function run(expr) {
  return vm.runInContext(expr, ctx);
}
function setData(key, value) {
  ctx.__store.set(key, JSON.stringify(value));
}
function parseCsvFile(file) {
  const literal = JSON.stringify(readText(file));
  return vm.runInContext(`parseCsv(${literal})`, ctx);
}
function parseCsvText(text) {
  const literal = JSON.stringify(text.replace(/^\uFEFF/, ''));
  return vm.runInContext(`parseCsv(${literal})`, ctx);
}
function parseCsvFromHeaderLine(file, headerMatcher) {
  const raw = readText(file);
  const lines = raw.split(/\r?\n/);
  const index = lines.findIndex(headerMatcher);
  if (index < 0) return { rows: [], headerLine: 0 };
  return { rows: parseCsvText(lines.slice(index).join('\n')), headerLine: index + 1 };
}
async function readImportFixtureFile(file) {
  ctx.__fixtureFile = {
    name: path.basename(file),
    path: file,
    _text: file.endsWith('.csv') ? readText(file) : undefined,
    _buffer: file.endsWith('.xlsx') || file.endsWith('.xls') ? fs.readFileSync(file) : undefined,
  };
  return new Promise((resolve) => {
    ctx.__resolveImportFile = resolve;
    vm.runInContext('readImportFile(__fixtureFile, {}, (result) => __resolveImportFile(result))', ctx);
  });
}

function rowsFromEmbeddedHeader(rows, headerMatcher) {
  const rowValues = rows.map((row) => Object.values(row));
  const index = rowValues.findIndex((values) => headerMatcher(values));
  if (index < 0) return { rows: [], headerLine: 0 };
  const headers = rowValues[index].map((header) => vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx));
  return {
    rows: rowValues.slice(index + 1).map((values) => Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] || '']))),
    headerLine: index + 1,
  };
}
function callFunction(name, args) {
  ctx.__args = args;
  return vm.runInContext(`${name}(...__args)`, ctx);
}

function resetImportIssues() {
  callFunction('setImportIssues', [[]]);
}

function getImportIssuesFromDashboard() {
  return callFunction('getImportIssues', []);
}

function getOpenImportIssuesFromDashboard() {
  return callFunction('getOpenImportIssues', []);
}

function assertIssueType(name, issues, type, details = {}) {
  const found = issues.find((issue) => issue.type === type && issue.status === 'open');
  if (found) pass(name, { ...details, field: found.field || details.field, actual: found.message });
  else fail(name, { ...details, expected: `open issue type ${type}`, actual: issues.map((issue) => ({ type: issue.type, status: issue.status, field: issue.field, message: issue.message })) });
}

function assertSuggestionShape(name, issue, details = {}) {
  const suggestion = issue?.suggestion;
  const required = ['issueId', 'issueType', 'sourceField', 'detectedColumn', 'suggestedField', 'suggestedValue', 'confidence', 'reason', 'status'];
  const missing = required.filter((field) => !(field in (suggestion || {})));
  if (suggestion && missing.length === 0 && suggestion.status === 'pending') pass(name, { ...details, field: 'suggestion', actual: suggestion });
  else fail(name, { ...details, field: 'suggestion', expected: required, actual: suggestion || { missing } });
}

function ensureFile(file, kind = 'fixture') {
  if (fs.existsSync(file)) {
    pass(`${kind} exists`, { fixture: path.relative(repoRoot, file) });
    return true;
  }
  fail(`${kind} exists`, { fixture: path.relative(repoRoot, file), expected: 'file exists', actual: 'missing' });
  return false;
}

async function validateImportFileReaderLayer() {
  const productCsv = fixturePath('products', 'product-master-normal.csv');
  const productXlsx = fixturePath('products', 'product-master-normal.xlsx');
  const fareCsv = fixturePath('fares', 'fare-matrix-normal.csv');
  const fareXlsx = fixturePath('fares', 'fare-matrix-normal.xlsx');
  ensureFile(productCsv);
  ensureFile(productXlsx, 'XLSX fixture');
  ensureFile(fareCsv);
  ensureFile(fareXlsx, 'XLSX fixture');

  const csvResult = await readImportFixtureFile(productCsv);
  assertEqual('readImportFile reads CSV sourceType', csvResult.sourceType, 'csv', { fixture: path.relative(repoRoot, productCsv), field: 'sourceType' });
  assertTruthy('readImportFile reads CSV rows', csvResult.rows.length > 0, { fixture: path.relative(repoRoot, productCsv), expected: 'rows.length > 0', actual: csvResult.rows.length });
  assertEqual('readImportFile CSV has no errors', csvResult.errors.length, 0, { fixture: path.relative(repoRoot, productCsv), field: 'errors' });

  const xlsxResult = await readImportFixtureFile(productXlsx);
  assertEqual('readImportFile reads XLSX sourceType', xlsxResult.sourceType, 'xlsx', { fixture: path.relative(repoRoot, productXlsx), field: 'sourceType' });
  assertTruthy('readImportFile reads XLSX sheetName', xlsxResult.sheetName, { fixture: path.relative(repoRoot, productXlsx), field: 'sheetName' });
  assertTruthy('readImportFile reads XLSX rows', xlsxResult.rows.length > 0, { fixture: path.relative(repoRoot, productXlsx), expected: 'rows.length > 0', actual: xlsxResult.rows.length });
  assertEqual('readImportFile XLSX has no errors', xlsxResult.errors.length, 0, { fixture: path.relative(repoRoot, productXlsx), field: 'errors' });
  assertEqual('CSV and XLSX product rows use same headers', JSON.stringify(Object.keys(csvResult.rows[0] || {})), JSON.stringify(Object.keys(xlsxResult.rows[0] || {})), {
    fixture: path.relative(repoRoot, productXlsx),
    field: 'headers',
    expected: Object.keys(csvResult.rows[0] || {}),
    actual: Object.keys(xlsxResult.rows[0] || {}),
  });

  const fareCsvResult = await readImportFixtureFile(fareCsv);
  const fareXlsxResult = await readImportFixtureFile(fareXlsx);
  assertEqual('CSV and XLSX fare rows use same headers', JSON.stringify(Object.keys(fareCsvResult.rows[0] || {})), JSON.stringify(Object.keys(fareXlsxResult.rows[0] || {})), {
    fixture: path.relative(repoRoot, fareXlsx),
    field: 'headers',
    expected: Object.keys(fareCsvResult.rows[0] || {}),
    actual: Object.keys(fareXlsxResult.rows[0] || {}),
  });

  const orderCsv = fixturePath('orders', 'rakuten', 'normal.csv');
  const orderXlsx = fixturePath('orders', 'rakuten', 'normal.xlsx');
  const orderCsvResult = await readImportFixtureFile(orderCsv);
  const orderXlsxResult = await readImportFixtureFile(orderXlsx);
  assertEqual('CSV and XLSX order rows use same headers', JSON.stringify(Object.keys(orderCsvResult.rows[0] || {})), JSON.stringify(Object.keys(orderXlsxResult.rows[0] || {})), {
    fixture: path.relative(repoRoot, orderXlsx),
    field: 'headers',
    expected: Object.keys(orderCsvResult.rows[0] || {}),
    actual: Object.keys(orderXlsxResult.rows[0] || {}),
  });

  const xlsxFiles = Array.from(fs.readdirSync(fixturePath('orders'), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturePath('orders'), entry.name, 'normal.xlsx'))
    .filter((file) => fs.existsSync(file));
  if (xlsxFiles.length) pass('XLSX_PARSE_READY order normal fixtures are present for Step5/6/7 connection', { count: xlsxFiles.length });
  else fail('XLSX order fixtures exist', { expected: '>= 1', actual: 0 });

  const xlsResult = await new Promise((resolve) => {
    ctx.__fixtureFile = { name: 'legacy.xls', _buffer: Buffer.from('legacy') };
    ctx.__resolveImportFile = resolve;
    vm.runInContext('readImportFile(__fixtureFile, {}, (result) => __resolveImportFile(result))', ctx);
  });
  assertEqual('XLS_SUPPORTED=false', run('XLS_SUPPORTED'), false, { field: 'XLS_SUPPORTED' });
  assertEqual('XLSX_SUPPORTED=true', run('XLSX_SUPPORTED'), true, { field: 'XLSX_SUPPORTED' });
  assertIncludes('XLS returns Japanese guidance error', xlsResult.errors, 'Excelファイルの形式を確認してください。XLSX形式で保存して再度アップロードしてください。', { field: 'errors' });
}

async function validateProductFixtures() {
  const normalFile = fixturePath('products', 'product-master-normal.csv');
  const normalXlsxFile = fixturePath('products', 'product-master-normal.xlsx');
  const edgeFile = fixturePath('products', 'product-master-edge-cases.csv');
  const edgeXlsxFile = fixturePath('products', 'product-master-edge-cases.xlsx');
  ensureFile(normalFile);
  ensureFile(normalXlsxFile, 'XLSX fixture');
  ensureFile(edgeFile);
  ensureFile(edgeXlsxFile, 'XLSX fixture');

  const normalRows = parseCsvFile(normalFile);
  const normalResult = callFunction('importProductCsvRows', [normalRows]);
  assertTruthy('product-master-normal.csv imports products', normalResult.products.length > 0, { fixture: path.relative(repoRoot, normalFile), expected: 'successCount > 0', actual: normalResult.successCount });
  assertEqual('product-master-normal.csv has no fatal message', normalResult.message, '', { fixture: path.relative(repoRoot, normalFile) });

  const normalXlsx = await readImportFixtureFile(normalXlsxFile);
  const normalXlsxResult = callFunction('importProductCsvRows', [normalXlsx.rows]);
  assertTruthy('product-master-normal.xlsx imports products', normalXlsxResult.products.length > 0, { fixture: path.relative(repoRoot, normalXlsxFile), expected: 'successCount > 0', actual: normalXlsxResult.successCount });
  assertEqual('product-master-normal.xlsx has no fatal message', normalXlsxResult.message, '', { fixture: path.relative(repoRoot, normalXlsxFile) });

  const wholeEdgeRows = parseCsvFile(edgeFile);
  const wholeEdgeResult = callFunction('importProductCsvRows', [wholeEdgeRows]);
  if (wholeEdgeResult.message || wholeEdgeResult.failureCount > 0 || wholeEdgeResult.warningCount > 0) {
    pass('product-master-edge-cases.csv produces warning or failure with explanatory header', {
      fixture: path.relative(repoRoot, edgeFile),
      line: 1,
      field: 'header',
      actual: wholeEdgeResult.message || `warnings=${wholeEdgeResult.warningCount}, failures=${wholeEdgeResult.failureCount}`,
    });
  } else {
    fail('product-master-edge-cases.csv produces warning or failure', {
      fixture: path.relative(repoRoot, edgeFile),
      line: 1,
      field: 'header',
      expected: 'warning or failure',
      actual: wholeEdgeResult,
    });
  }

  const parsedEdge = parseCsvFromHeaderLine(edgeFile, (line) => line.includes('商品ID') && line.includes('bundleEligible'));
  if (!parsedEdge.rows.length) {
    fail('product edge CSV header can be located', { fixture: path.relative(repoRoot, edgeFile), expected: '商品ID header', actual: 'not found' });
    return;
  }
  const edgeXlsx = await readImportFixtureFile(edgeXlsxFile);
  const parsedEdgeXlsx = Object.keys(edgeXlsx.rows[0] || {}).includes('商品id')
    ? { rows: edgeXlsx.rows, headerLine: 2 }
    : rowsFromEmbeddedHeader(edgeXlsx.rows, (values) => values.includes('商品ID') && values.includes('bundleEligible'));
  if (!parsedEdgeXlsx.rows.length) {
    fail('product edge XLSX header can be located', { fixture: path.relative(repoRoot, edgeXlsxFile), expected: '商品ID header', actual: 'not found' });
    return;
  }

  const edgeCases = [
    { label: 'csv', file: edgeFile, rows: parsedEdge.rows, headerLine: parsedEdge.headerLine },
    { label: 'xlsx', file: edgeXlsxFile, rows: parsedEdgeXlsx.rows, headerLine: parsedEdgeXlsx.headerLine },
  ];

  for (const edgeCase of edgeCases) {
    const edgeResult = callFunction('importProductCsvRows', [edgeCase.rows]);
    assertTruthy(`product edge ${edgeCase.label} rows import at least one row after locating header`, edgeResult.products.length > 0, { fixture: path.relative(repoRoot, edgeCase.file), line: edgeCase.headerLine });
    assertIncludes(`product edge ${edgeCase.label} SKU fallback warning is produced`, edgeResult.warningDetails, '商品名をSKUとして使用', { fixture: path.relative(repoRoot, edgeCase.file), line: edgeCase.headerLine + 2, field: '商品ID', expected: '商品名をSKUとして使用' });
    assertIncludes(`product edge ${edgeCase.label} missing weight warning is produced`, edgeResult.warningDetails, '重量未設定', { fixture: path.relative(repoRoot, edgeCase.file), line: edgeCase.headerLine + 3, field: '重量kg', expected: '重量未設定' });
    const mmProduct = edgeResult.products.find((product) => product.sku === 'SKU-P-EDGE-005');
    assertEqual(`product edge ${edgeCase.label} converts mm dimensions and infers size`, JSON.stringify([mmProduct?.length, mmProduct?.width, mmProduct?.height, mmProduct?.size]), JSON.stringify(['30', '25', '20', '80']), { fixture: path.relative(repoRoot, edgeCase.file), field: 'length,width,height,size' });
    const bundleProduct = edgeResult.products.find((product) => product.sku === 'SKU-P-EDGE-007');
    assertEqual(`product edge ${edgeCase.label} maps bundleEligible to bundleable`, bundleProduct?.bundleable, false, { fixture: path.relative(repoRoot, edgeCase.file), field: 'bundleEligible' });

    resetImportIssues();
    callFunction('recordProductImportIssues', [edgeResult, path.basename(edgeCase.file), edgeCase.rows]);
    const productIssues = getImportIssuesFromDashboard();
    assertIssueType(`product edge ${edgeCase.label} SKU fallback creates persistent issue`, productIssues, 'missing_sku', { fixture: path.relative(repoRoot, edgeCase.file), line: edgeCase.headerLine + 2, field: 'SKU', expected: 'missing_sku issue' });
    assertIssueType(`product edge ${edgeCase.label} missing weight creates persistent issue`, productIssues, 'missing_weight', { fixture: path.relative(repoRoot, edgeCase.file), line: edgeCase.headerLine + 3, field: 'weight', expected: 'missing_weight issue' });
    assertIssueType(`product edge ${edgeCase.label} unit mismatch creates persistent issue`, productIssues, 'unit_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), field: 'unit', expected: 'unit_mismatch issue' });
    assertIssueType(`product edge ${edgeCase.label} size mismatch creates persistent issue`, productIssues, 'size_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), field: 'size', expected: 'size_mismatch issue' });
    assertIssueType(`product edge ${edgeCase.label} oversized creates persistent issue`, productIssues, 'oversized_size', { fixture: path.relative(repoRoot, edgeCase.file), field: 'size', expected: 'oversized_size issue' });
    assertIssueType(`product edge ${edgeCase.label} bundleEligible mapping creates persistent issue`, productIssues, 'bundle_field_mapping', { fixture: path.relative(repoRoot, edgeCase.file), field: 'bundleEligible', expected: 'bundle_field_mapping issue' });
    assertIssueType(`product edge ${edgeCase.label} column mismatch creates persistent issue`, productIssues, 'column_name_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), field: 'column', expected: 'column_name_mismatch issue' });
    assertSuggestionShape(`product edge ${edgeCase.label} SKU fallback issue keeps Phase10 suggestion metadata`, productIssues.find((issue) => issue.type === 'missing_sku'), { fixture: path.relative(repoRoot, edgeCase.file), field: 'suggestion' });
  }

  const xlsResult = await new Promise((resolve) => {
    ctx.__fixtureFile = { name: 'product-master-legacy.xls', _buffer: Buffer.from('legacy') };
    ctx.__resolveImportFile = resolve;
    vm.runInContext('readImportFile(__fixtureFile, {}, (result) => __resolveImportFile(result))', ctx);
  });
  assertIncludes('product .xls returns Japanese guidance error', xlsResult.errors, 'Excelファイルの形式を確認してください。XLSX形式で保存して再度アップロードしてください。', { field: 'errors' });
}

async function validateFareFixtures() {
  const normalFile = fixturePath('fares', 'fare-matrix-normal.csv');
  const normalXlsxFile = fixturePath('fares', 'fare-matrix-normal.xlsx');
  const edgeFile = fixturePath('fares', 'fare-matrix-edge-cases.csv');
  const edgeXlsxFile = fixturePath('fares', 'fare-matrix-edge-cases.xlsx');
  ensureFile(normalFile);
  ensureFile(normalXlsxFile, 'XLSX fixture');
  ensureFile(edgeFile);
  ensureFile(edgeXlsxFile, 'XLSX fixture');

  const normalCases = [
    { label: 'csv', file: normalFile, rows: parseCsvFile(normalFile) },
    { label: 'xlsx', file: normalXlsxFile, rows: (await readImportFixtureFile(normalXlsxFile)).rows },
  ];

  for (const normalCase of normalCases) {
    const headers = Object.keys(normalCase.rows[0] || {});
    const format = callFunction('detectFareTableFormat', [headers, normalCase.rows]);
    assertEqual(`fare-matrix-normal.${normalCase.label} is detected as matrix`, format, 'matrix', { fixture: path.relative(repoRoot, normalCase.file), field: 'headers' });
    const normalized = callFunction('normalizeFareMatrix', [normalCase.rows, 'ヤマト', '宅急便']);
    assertTruthy(`fare-matrix-normal.${normalCase.label} creates normalizedFareRows`, normalized.length > 0, { fixture: path.relative(repoRoot, normalCase.file), expected: 'normalizedFareRows.length > 0', actual: normalized.length });
    const matrixView = callFunction('createMatrixView', [normalCase.rows, 'ヤマト', '宅急便']);
    assertTruthy(`fare-matrix-normal.${normalCase.label} creates matrixView and normalizedFareRows`, matrixView && matrixView.rows && normalized.length > 0, { fixture: path.relative(repoRoot, normalCase.file), expected: 'matrixView + normalizedFareRows', actual: { matrixRows: matrixView?.rows?.length || 0, normalizedRows: normalized.length } });
    setData('shipnaviDashboardFareTables', { matrixView, normalizedFareRows: normalized });
    const options = callFunction('getFareOptions', [60, '東京', 1000]);
    assertTruthy(`fare-matrix-normal.${normalCase.label} normalizedFareRows are usable by getFareOptions`, options.length > 0, { fixture: path.relative(repoRoot, normalCase.file), field: 'getFareOptions', expected: 'options.length > 0', actual: options.length });
  }

  const wholeEdgeRows = parseCsvFile(edgeFile);
  const edgeHeaders = Object.keys(wholeEdgeRows[0] || {});
  const edgeFormat = callFunction('detectFareTableFormat', [edgeHeaders, wholeEdgeRows]);
  if (edgeFormat === 'unknown' || callFunction('normalizeFareMatrix', [wholeEdgeRows, 'ヤマト', '宅急便']).length === 0) {
    pass('fare-matrix-edge-cases.csv produces warning or failure with explanatory header', {
      fixture: path.relative(repoRoot, edgeFile),
      line: 1,
      field: 'header',
      expected: 'warning or failure',
      actual: edgeFormat,
    });
  } else {
    fail('fare-matrix-edge-cases.csv produces warning or failure', { fixture: path.relative(repoRoot, edgeFile), line: 1, field: 'header', expected: 'unknown or zero normalized rows', actual: edgeFormat });
  }

  resetImportIssues();
  callFunction('recordFareImportIssues', [wholeEdgeRows, edgeFormat, null, callFunction('normalizeFareMatrix', [wholeEdgeRows, 'ヤマト', '宅急便']), path.basename(edgeFile)]);
  const wholeEdgeIssues = getImportIssuesFromDashboard();
  assertIssueType('fare matrix explanatory header creates parse failed issue', wholeEdgeIssues, 'fare_matrix_parse_failed', { fixture: path.relative(repoRoot, edgeFile), line: 1, field: 'headers', expected: 'fare_matrix_parse_failed issue' });
  assertIssueType('fare matrix explanatory header creates missing zone issue', wholeEdgeIssues, 'missing_zone_column', { fixture: path.relative(repoRoot, edgeFile), line: 1, field: 'zone', expected: 'missing_zone_column issue' });

  const parsedEdge = parseCsvFromHeaderLine(edgeFile, (line) => line.includes('サイズ(mm)') && line.includes('東京都'));
  const edgeXlsx = await readImportFixtureFile(edgeXlsxFile);
  const parsedEdgeXlsx = Object.keys(edgeXlsx.rows[0] || {}).includes('サイズ(mm)')
    ? { rows: edgeXlsx.rows, headerLine: 2 }
    : rowsFromEmbeddedHeader(edgeXlsx.rows, (values) => values.includes('サイズ(mm)') && values.includes('東京都'));
  const edgeCases = [
    { label: 'csv', file: edgeFile, rows: parsedEdge.rows, headerLine: parsedEdge.headerLine },
    { label: 'xlsx', file: edgeXlsxFile, rows: parsedEdgeXlsx.rows, headerLine: parsedEdgeXlsx.headerLine },
  ];

  for (const edgeCase of edgeCases) {
    if (!edgeCase.rows.length) {
      fail(`fare edge ${edgeCase.label} header can be located`, { fixture: path.relative(repoRoot, edgeCase.file), expected: 'サイズ(mm) header', actual: 'not found' });
      continue;
    }
    const headers = Object.keys(edgeCase.rows[0] || {});
    const format = callFunction('detectFareTableFormat', [headers, edgeCase.rows]);
    assertEqual(`fare edge ${edgeCase.label} is detected as matrix after header location`, format, 'matrix', { fixture: path.relative(repoRoot, edgeCase.file), field: 'headers' });
    const matrixView = callFunction('createMatrixView', [edgeCase.rows, 'ヤマト', '宅急便']);
    const normalized = callFunction('normalizeFareMatrix', [edgeCase.rows, 'ヤマト', '宅急便']);
    assertTruthy(`fare edge ${edgeCase.label} keeps matrixView and normalizedFareRows`, matrixView && normalized.length > 0, { fixture: path.relative(repoRoot, edgeCase.file), expected: 'matrixView + normalizedFareRows', actual: { matrixRows: matrixView?.rows?.length || 0, normalizedRows: normalized.length } });
    resetImportIssues();
    callFunction('recordFareImportIssues', [edgeCase.rows, format, matrixView, normalized, path.basename(edgeCase.file)]);
    const fareIssues = getImportIssuesFromDashboard();
    assertIssueType(`fare edge ${edgeCase.label} missing fare creates issue`, fareIssues, 'missing_fare', { fixture: path.relative(repoRoot, edgeCase.file), field: 'fare', expected: 'missing_fare issue' });
    assertIssueType(`fare edge ${edgeCase.label} missing size creates issue`, fareIssues, 'missing_size', { fixture: path.relative(repoRoot, edgeCase.file), field: 'size', expected: 'missing_size issue' });
    assertIssueType(`fare edge ${edgeCase.label} invalid weightLimit creates issue`, fareIssues, 'invalid_weight_limit', { fixture: path.relative(repoRoot, edgeCase.file), field: 'weightLimit', expected: 'invalid_weight_limit issue' });
    assertIssueType(`fare edge ${edgeCase.label} unit mismatch creates issue`, fareIssues, 'unit_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), field: 'unit', expected: 'unit_mismatch issue' });
    assertIssueType(`fare edge ${edgeCase.label} column mismatch creates issue`, fareIssues, 'column_name_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), field: 'column', expected: 'column_name_mismatch issue' });
  }

  const xlsResult = await new Promise((resolve) => {
    ctx.__fixtureFile = { name: 'fare-matrix-legacy.xls', _buffer: Buffer.from('legacy') };
    ctx.__resolveImportFile = resolve;
    vm.runInContext('readImportFile(__fixtureFile, {}, (result) => __resolveImportFile(result))', ctx);
  });
  assertIncludes('fare .xls returns Japanese guidance error', xlsResult.errors, 'Excelファイルの形式を確認してください。XLSX形式で保存して再度アップロードしてください。', { field: 'errors' });
}

const orderPlatforms = [
  { slug: 'rakuten', expected: '楽天', pendingSupport: false },
  { slug: 'yahoo', expected: 'Yahooショッピング', pendingSupport: false },
  { slug: 'amazon', expected: 'Amazon', pendingSupport: false },
  { slug: 'shopify', expected: 'Shopify', pendingSupport: false },
  { slug: 'base', expected: 'BASE', pendingSupport: false },
  { slug: 'stores', expected: 'STORES', pendingSupport: false },
  { slug: 'mercari-shops', expected: 'メルカリShops', pendingSupport: false },
];

const documentedOrderPlatforms = ['ShipNavi標準', ...orderPlatforms.map((platform) => platform.expected)];
const platformSpecKeys = ['requiredSignals', 'optionalSignals', 'orderNo', 'customer', 'postal', 'address', 'sku', 'productName', 'quantity'];
const requiredPhase7OrderEdgeIds = [
  'EDGE-SPLIT-ADDRESS',
  'EDGE-COMBINED-ADDRESS',
  'EDGE-ALT-RECIPIENT',
  'EDGE-ALT-SKU',
  'EDGE-MALFORMED-QUANTITY',
  'EDGE-MISSING-POSTAL',
];
const phase7ExistingPlatformAliasPlatforms = new Set(['楽天', 'Yahooショッピング', 'Amazon', 'Shopify', 'BASE', 'STORES', 'メルカリShops']);

function parsePlatformFieldSpecs() {
  const specText = readText(path.join(repoRoot, 'docs', 'IMPORT_SPEC.md'));
  const specs = {};
  for (const platform of documentedOrderPlatforms) {
    const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<!-- phase7-platform-spec:start ${escaped} -->([\\s\\S]*?)<!-- phase7-platform-spec:end ${escaped} -->`);
    const match = specText.match(pattern);
    if (!match) {
      fail(`Phase7 platform field spec exists for ${platform}`, { platform, expected: 'documented table' });
      continue;
    }
    specs[platform] = {};
    match[1].split(/\r?\n/).forEach((line) => {
      const row = line.trim();
      if (!row.startsWith('| `')) return;
      const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
      const key = cells[0]?.replace(/^`|`$/g, '');
      if (!platformSpecKeys.includes(key)) return;
      specs[platform][key] = (cells[2] || '')
        .split(';')
        .map((item) => item.trim().replace(/^`|`$/g, ''))
        .filter(Boolean);
    });
  }
  return specs;
}

function runtimeCandidateLabels(mapping, key) {
  if (key === 'requiredSignals' || key === 'optionalSignals') return mapping[key] || [];
  return (mapping.fieldCandidates?.[key] || []).map((candidate) => {
    if (typeof candidate === 'string') return candidate;
    return (candidate.fields || []).join(' + ');
  });
}

function validatePlatformFieldSpecs() {
  const docsSpecs = parsePlatformFieldSpecs();
  const runtimeMappings = run('JSON.parse(JSON.stringify(platformFieldMappings))');
  for (const platform of documentedOrderPlatforms) {
    const docsSpec = docsSpecs[platform];
    const runtimeMapping = runtimeMappings[platform];
    assertTruthy(`Phase7 platform mapping exists at runtime for ${platform}`, runtimeMapping, { platform, field: 'platformFieldMappings' });
    if (!docsSpec || !runtimeMapping) continue;
    for (const key of platformSpecKeys) {
      assertEqual(`Phase7 ${platform} ${key} docs match runtime mapping`, JSON.stringify(docsSpec[key] || []), JSON.stringify(runtimeCandidateLabels(runtimeMapping, key)), {
        platform,
        field: key,
        expected: runtimeCandidateLabels(runtimeMapping, key),
        actual: docsSpec[key] || [],
      });
    }
  }
}

async function validateOrderFixtures() {
  validatePlatformFieldSpecs();
  for (const platform of orderPlatforms) {
    const dir = fixturePath('orders', platform.slug);
    const normalFile = path.join(dir, 'normal.csv');
    const normalXlsxFile = path.join(dir, 'normal.xlsx');
    const edgeFile = path.join(dir, 'edge-cases.csv');
    const edgeXlsxFile = path.join(dir, 'edge-cases.xlsx');
    ensureFile(normalFile);
    ensureFile(normalXlsxFile, 'XLSX fixture');
    ensureFile(edgeFile);
    ensureFile(edgeXlsxFile, 'XLSX fixture');

    const normalCases = [
      { label: 'csv', file: normalFile, rows: parseCsvFile(normalFile) },
      { label: 'xlsx', file: normalXlsxFile, rows: (await readImportFixtureFile(normalXlsxFile)).rows },
    ];
    for (const normalCase of normalCases) {
      const normalHeaders = Object.keys(normalCase.rows[0] || {});
      const detected = callFunction('detectOrderCsvFormat', [normalHeaders]);
      assertEqual(`${platform.expected} normal.${normalCase.label} detects platform`, detected, platform.expected, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, field: 'headers' });
      const result = callFunction('importOrderCsvRows', [normalCase.rows]);
      assertTruthy(`${platform.expected} normal.${normalCase.label} imports orders`, result.orders.length > 0, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, expected: 'orders.length > 0', actual: result.orders.length });
      const sourcePlatforms = [...new Set(result.orders.map((order) => order.sourcePlatform))];
      assertIncludes(`${platform.expected} normal.${normalCase.label} sourcePlatform is preserved`, sourcePlatforms, platform.expected, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, field: 'sourcePlatform' });
      assertEqual(`${platform.expected} normal.${normalCase.label} preview detects platform`, result.preview?.detectedPlatform, platform.expected, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, field: 'preview.detectedPlatform' });
      assertEqual(`${platform.expected} normal.${normalCase.label} preview row count`, result.preview?.rowCount, normalCase.rows.length, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, field: 'preview.rowCount' });
      assertTruthy(`${platform.expected} normal.${normalCase.label} preview mapped fields are present`, (result.preview?.mappedFields || []).length >= 5, { fixture: path.relative(repoRoot, normalCase.file), platform: platform.expected, field: 'preview.mappedFields', actual: result.preview?.mappedFields });
    }

    const wholeEdgeRows = parseCsvFile(edgeFile);
    const wholeEdgeHeaders = Object.keys(wholeEdgeRows[0] || {});
    const wholeEdgeDetected = callFunction('detectOrderCsvFormat', [wholeEdgeHeaders]);
    if (wholeEdgeDetected === 'unknown') {
      pass(`${platform.expected} edge-cases.csv produces failure with explanatory header`, {
        fixture: path.relative(repoRoot, edgeFile),
        platform: platform.expected,
        line: 1,
        field: 'header',
        expected: 'unknown due explanatory row before header',
        actual: wholeEdgeDetected,
      });
    } else {
      pass(`${platform.expected} edge-cases.csv remains parseable despite explanatory header`, {
        fixture: path.relative(repoRoot, edgeFile),
        platform: platform.expected,
        line: 1,
        field: 'header',
        actual: wholeEdgeDetected,
      });
    }

    const headerMatcher = (lineOrValues) => {
      const text = Array.isArray(lineOrValues) ? lineOrValues.join(',') : lineOrValues;
      const lower = text.toLowerCase();
      if (platform.slug === 'amazon') return lower.includes('order-id') && lower.includes('seller-sku-candidate');
      if (platform.slug === 'shopify') return (lower.includes('variant sku candidate') || lower.includes('lineitem sku')) && lower.includes('lineitem');
      if (platform.slug === 'stores') return text.includes('品番候補');
      if (platform.slug === 'mercari-shops') return text.includes('商品コード候補');
      return text.includes('商品コード候補') || text.includes('注文番号');
    };
    const parsedEdgeCsv = parseCsvFromHeaderLine(edgeFile, headerMatcher);
    const edgeXlsx = await readImportFixtureFile(edgeXlsxFile);
    const parsedEdgeXlsx = rowsFromEmbeddedHeader(edgeXlsx.rows, headerMatcher);
    const edgeCases = [
      { label: 'csv', file: edgeFile, rows: parsedEdgeCsv.rows, headerLine: parsedEdgeCsv.headerLine },
      { label: 'xlsx', file: edgeXlsxFile, rows: parsedEdgeXlsx.rows.length ? parsedEdgeXlsx.rows : edgeXlsx.rows, headerLine: parsedEdgeXlsx.headerLine || 3 },
    ];

    for (const edgeCase of edgeCases) {
      if (!edgeCase.rows.length) {
        fail(`${platform.expected} edge ${edgeCase.label} header can be located`, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, expected: 'edge header line', actual: 'not found' });
        continue;
      }
      requiredPhase7OrderEdgeIds.forEach((edgeId) => {
        assertTruthy(`${platform.expected} edge.${edgeCase.label} includes ${edgeId}`, edgeCase.rows.some((row) => Object.values(row).includes(edgeId)), {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          expected: edgeId,
        });
      });
      const edgeDetected = callFunction('detectOrderCsvFormat', [Object.keys(edgeCase.rows[0] || {})]);
      assertEqual(`${platform.expected} edge.${edgeCase.label} detects platform`, edgeDetected, platform.expected, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'headers' });
      const edgeResult = callFunction('importOrderCsvRows', [edgeCase.rows]);
      assertEqual(`${platform.expected} edge.${edgeCase.label} preview detects platform`, edgeResult.preview?.detectedPlatform, platform.expected, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'preview.detectedPlatform' });
      assertEqual(`${platform.expected} edge.${edgeCase.label} preview warning count matches result`, edgeResult.preview?.warningCount, edgeResult.warningCount, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'preview.warningCount' });
      assertTruthy(`${platform.expected} edge.${edgeCase.label} preview includes mapped fields`, (edgeResult.preview?.mappedFields || []).length >= 5, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'preview.mappedFields', actual: edgeResult.preview?.mappedFields });
      if (phase7ExistingPlatformAliasPlatforms.has(platform.expected)) {
        const altRecipientOrder = edgeResult.allOrders.find((order) => order.orderNo === 'EDGE-ALT-RECIPIENT');
        assertTruthy(`${platform.expected} edge.${edgeCase.label} alternate recipient alias is normalized`, altRecipientOrder?.customer === '代替テスト購入者', {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          field: 'customer',
          expected: '代替テスト購入者',
          actual: altRecipientOrder?.customer,
        });
        const altSkuOrder = edgeResult.allOrders.find((order) => order.orderNo === 'EDGE-ALT-SKU');
        assertTruthy(`${platform.expected} edge.${edgeCase.label} alternate SKU alias is normalized`, altSkuOrder?.sku === 'ALT-SKU-001', {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          field: 'sku',
          expected: 'ALT-SKU-001',
          actual: altSkuOrder?.sku,
        });
      }
      if (edgeResult.warningCount > 0 || edgeResult.failureCount > 0 || edgeResult.missingHeaders?.length) {
        pass(`${platform.expected} edge.${edgeCase.label} produces warning or failure after header location`, {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          line: edgeCase.headerLine,
          expected: 'warning or failure',
          actual: { warningCount: edgeResult.warningCount, failureCount: edgeResult.failureCount, missingHeaders: edgeResult.missingHeaders },
        });
      } else {
        fail(`${platform.expected} edge.${edgeCase.label} produces warning or failure after header location`, {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          line: edgeCase.headerLine,
          expected: 'warning or failure',
          actual: edgeResult,
        });
      }
      assertIncludes(`${platform.expected} edge.${edgeCase.label} SKU missing fallback warning`, edgeResult.warningDetails, '商品名をSKUとして使用', {
        fixture: path.relative(repoRoot, edgeCase.file),
        platform: platform.expected,
        field: 'SKU',
        expected: '商品名をSKUとして使用',
      });
      resetImportIssues();
      callFunction('recordOrderImportIssues', [edgeResult, path.basename(edgeCase.file)]);
      const orderIssues = getImportIssuesFromDashboard();
      assertIssueType(`${platform.expected} edge.${edgeCase.label} SKU fallback creates persistent issue`, orderIssues, 'missing_sku', {
        fixture: path.relative(repoRoot, edgeCase.file),
        platform: platform.expected,
        line: edgeCase.headerLine,
        field: 'SKU',
        expected: 'missing_sku issue',
      });
      const postalIssue = orderIssues.find((issue) => ['missing_postal', 'invalid_postal'].includes(issue.type) && issue.status === 'open');
      if (postalIssue) {
        pass(`${platform.expected} edge.${edgeCase.label} postal missing or invalid creates persistent issue`, {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          line: postalIssue.rowNumber || edgeCase.headerLine,
          field: 'postal',
          expected: 'missing_postal or invalid_postal issue',
          actual: postalIssue.message,
        });
      } else {
        fail(`${platform.expected} edge.${edgeCase.label} postal missing or invalid creates persistent issue`, {
          fixture: path.relative(repoRoot, edgeCase.file),
          platform: platform.expected,
          line: edgeCase.headerLine,
          field: 'postal',
          expected: 'missing_postal or invalid_postal issue',
          actual: orderIssues.map((issue) => ({ type: issue.type, field: issue.field, message: issue.message })),
        });
      }
      assertIssueType(`${platform.expected} edge.${edgeCase.label} column mismatch creates persistent issue`, orderIssues, 'column_name_mismatch', { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'column', expected: 'column_name_mismatch issue' });
      assertSuggestionShape(`${platform.expected} edge.${edgeCase.label} SKU fallback issue keeps Phase10 suggestion metadata`, orderIssues.find((issue) => issue.type === 'missing_sku'), {
        fixture: path.relative(repoRoot, edgeCase.file),
        platform: platform.expected,
        field: 'suggestion',
      });

      const quantityHeader = Object.keys(edgeCase.rows[0] || {}).find((header) => {
        const normalized = vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx);
        return ['数量', '個数', 'quantity-purchased', 'lineitem quantity'].includes(normalized) || normalized.includes('quantity');
      }) || '数量';
      const invalidQuantityRows = edgeCase.rows.map((row, index) => index === 0 ? { ...row, [quantityHeader]: 'abc' } : row);
      const invalidQuantityResult = callFunction('importOrderCsvRows', [invalidQuantityRows]);
      resetImportIssues();
      callFunction('recordOrderImportIssues', [invalidQuantityResult, path.basename(edgeCase.file)]);
      assertIssueType(`${platform.expected} edge.${edgeCase.label} invalid quantity creates persistent issue`, getImportIssuesFromDashboard(), 'invalid_quantity', { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'quantity', expected: 'invalid_quantity issue' });

      const customerHeaders = run(`(platformFieldMappings[${JSON.stringify(platform.expected)}].fieldCandidates.customer || []).flatMap((candidate) => fieldCandidate(candidate).fields)`);
      const presentCustomerHeaders = customerHeaders.filter((header) => Object.prototype.hasOwnProperty.call(edgeCase.rows[0] || {}, vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx)));
      const missingRecipientRows = edgeCase.rows.map((row, index) => {
        if (index !== 0) return row;
        const next = { ...row };
        presentCustomerHeaders.forEach((header) => {
          next[vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx)] = '';
        });
        return next;
      });
      const missingRecipientResult = callFunction('importOrderCsvRows', [missingRecipientRows]);
      assertIncludes(`${platform.expected} edge.${edgeCase.label} missing recipient warning`, missingRecipientResult.warningDetails, '顧客名未設定', {
        fixture: path.relative(repoRoot, edgeCase.file),
        platform: platform.expected,
        field: 'customer',
        expected: '顧客名未設定',
      });
      resetImportIssues();
      callFunction('recordOrderImportIssues', [missingRecipientResult, path.basename(edgeCase.file)]);
      assertIssueType(`${platform.expected} edge.${edgeCase.label} missing recipient creates persistent issue`, getImportIssuesFromDashboard(), 'missing_recipient', { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'customer', expected: 'missing_recipient issue' });
    }
  }

  const unsupportedRows = [{ '独自注文列': 'X-001', '独自顧客列': '匿名顧客', '備考': '独自形式' }];
  const unsupportedResult = callFunction('importOrderCsvRows', [unsupportedRows]);
  assertEqual('unsupported order format returns unknown platform', unsupportedResult.platform, 'unknown', { field: 'platform' });
  assertIncludes('unsupported order format guidance includes detected headers', unsupportedResult.unsupportedGuidance?.detectedHeaders || [], '独自注文列', { field: 'unsupportedGuidance.detectedHeaders' });
  assertIncludes('unsupported order format guidance includes missing order number concept', unsupportedResult.unsupportedGuidance?.missingConcepts || [], '注文番号', { field: 'unsupportedGuidance.missingConcepts' });
  assertIncludes('unsupported order format guidance includes Japanese next step', unsupportedResult.unsupportedGuidance?.nextSteps || [], 'ShipNavi標準テンプレートに合わせて列名を変更してください。', { field: 'unsupportedGuidance.nextSteps' });
  const unsupportedMessage = callFunction('formatUnsupportedOrderFormatGuidance', [unsupportedResult.unsupportedGuidance]);
  assertTruthy('unsupported order format message includes detected headers', unsupportedMessage.includes('検出ヘッダー: 独自注文列, 独自顧客列, 備考'), { field: 'message', expected: 'detected headers in message', actual: unsupportedMessage });
  resetImportIssues();
  callFunction('recordOrderImportIssues', [unsupportedResult, 'unsupported-orders.csv']);
  assertIssueType('unsupported order format creates persistent platform issue', getImportIssuesFromDashboard(), 'platform_mapping_warning', { field: 'headers', expected: 'platform_mapping_warning issue' });

  const xlsResult = await new Promise((resolve) => {
    ctx.__fixtureFile = { name: 'orders-legacy.xls', _buffer: Buffer.from('legacy') };
    ctx.__resolveImportFile = resolve;
    vm.runInContext('readImportFile(__fixtureFile, {}, (result) => __resolveImportFile(result))', ctx);
  });
  assertIncludes('orders .xls returns Japanese guidance error', xlsResult.errors, 'Excelファイルの形式を確認してください。XLSX形式で保存して再度アップロードしてください。', { field: 'errors' });
}
function validatePersistentIssueStatusLifecycle() {
  resetImportIssues();
  callFunction('addImportIssue', [{
    id: 'issue_status_dismiss',
    type: 'missing_sku',
    severity: 'warning',
    sourceFlow: 'product_import',
    field: 'sku',
    message: '商品コードが見つかりません。',
    suggestion: {
      issueId: 'issue_status_dismiss',
      issueType: 'missing_sku',
      sourceField: '商品コード',
      detectedColumn: '商品コード',
      suggestedField: 'SKU',
      suggestedValue: null,
      confidence: 0.98,
      reason: '商品コードはSKUとして利用できる可能性が高いです。',
      status: 'pending',
    },
  }]);
  callFunction('addImportIssue', [{
    id: 'issue_status_resolve',
    type: 'missing_weight',
    severity: 'warning',
    sourceFlow: 'product_import',
    field: 'weight',
    message: '重量が見つかりません。',
  }]);
  assertEqual('persistent issue open count before status changes', getOpenImportIssuesFromDashboard().length, 2, { field: 'status', expected: 2 });
  callFunction('dismissImportIssue', ['issue_status_dismiss']);
  callFunction('resolveImportIssue', ['issue_status_resolve']);
  const issues = getImportIssuesFromDashboard();
  assertEqual('dismissImportIssue marks issue dismissed', issues.find((issue) => issue.id === 'issue_status_dismiss')?.status, 'dismissed', { field: 'status' });
  assertEqual('resolveImportIssue marks issue resolved', issues.find((issue) => issue.id === 'issue_status_resolve')?.status, 'resolved', { field: 'status' });
  assertEqual('getOpenImportIssues excludes dismissed and resolved issues', getOpenImportIssuesFromDashboard().length, 0, { field: 'status', expected: 0 });
  callFunction('clearResolvedImportIssues', []);
  const afterClear = getImportIssuesFromDashboard();
  assertTruthy('clearResolvedImportIssues keeps dismissed but removes resolved issues', afterClear.some((issue) => issue.id === 'issue_status_dismiss') && !afterClear.some((issue) => issue.id === 'issue_status_resolve'), { field: 'status' });
  assertSuggestionShape('persistent issue suggestion schema is stored without AI auto repair', afterClear.find((issue) => issue.id === 'issue_status_dismiss'), { field: 'suggestion' });
}


async function validateImportTemplates() {
  const cases = [
    { type: 'products', format: 'csv', headers: ['SKU', '商品名', '重量', 'サイズ', '長さ', '幅', '高さ', '同梱可否'], exampleSku: 'SKU-001' },
    { type: 'products', format: 'xlsx', headers: ['SKU', '商品名', '重量', 'サイズ', '長さ', '幅', '高さ', '同梱可否'], exampleSku: 'SKU-001' },
    { type: 'orders', format: 'csv', headers: ['注文番号', '顧客名', '郵便番号', '配送先住所', 'SKU', '数量'], exampleSku: 'SKU-001' },
    { type: 'orders', format: 'xlsx', headers: ['注文番号', '顧客名', '郵便番号', '配送先住所', 'SKU', '数量'], exampleSku: 'SKU-001' },
    { type: 'fares', format: 'csv', headers: ['サイズ', '重量', '東京', '関東', '関西'], exampleSku: '60' },
    { type: 'fares', format: 'xlsx', headers: ['サイズ', '重量', '東京', '関東', '関西'], exampleSku: '60' },
  ];

  for (const testCase of cases) {
    const template = callFunction('generateImportTemplate', [testCase.type, testCase.format]);
    assertEqual(`${testCase.type} ${testCase.format} template has no errors`, template.errors.length, 0, { field: 'errors' });
    assertTruthy(`${testCase.type} ${testCase.format} template has file name`, template.fileName && template.fileName.endsWith(`.${testCase.format}`), { field: 'fileName', actual: template.fileName });
    const headers = template.rows[0] || [];
    testCase.headers.forEach((header) => assertIncludes(`${testCase.type} ${testCase.format} template header ${header}`, headers, header, { field: 'headers' }));
    assertTruthy(`${testCase.type} ${testCase.format} template has example row`, (template.rows[1] || []).includes(testCase.exampleSku), { field: 'example row', actual: template.rows[1] });

    if (testCase.format === 'csv') {
      const parsedRows = parseCsvText(template.csvText);
      assertTruthy(`${testCase.type} csv template can be parsed for upload`, parsedRows.length > 0, { field: 'csvText', actual: parsedRows.length });
    } else {
      assertEqual(`${testCase.type} xlsx template Sheet1 name`, template.sheets[0]?.name, '入力データ', { field: 'sheetName' });
      assertEqual(`${testCase.type} xlsx template Sheet2 name`, template.sheets[1]?.name, '入力説明', { field: 'sheetName' });
      ctx.__templateBuffer = template.arrayBuffer;
      const sheetNames = await vm.runInContext('unzipXlsxEntries(__templateBuffer).then((entries) => parseWorkbookSheets(entries).map((sheet) => sheet.name))', ctx);
      assertEqual(`${testCase.type} xlsx workbook contains Japanese sheet names`, JSON.stringify(sheetNames), JSON.stringify(['入力データ', '入力説明']), { field: 'sheetName', actual: sheetNames });
      const parsed = await vm.runInContext('parseXlsxArrayBuffer(__templateBuffer)', ctx);
      const parsedHeaders = Object.keys(parsed.rows[0] || {});
      assertTruthy(`${testCase.type} xlsx template can be parsed for upload`, parsed.rows.length > 0, { field: 'rows', actual: parsed.rows.length });
      testCase.headers.forEach((header) => assertIncludes(`${testCase.type} xlsx parsed header ${header}`, parsedHeaders, vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx), { field: 'headers' }));
    }
  }

  const orderXlsx = callFunction('generateImportTemplate', ['orders', 'xlsx']);
  const explanationText = orderXlsx.sheets[1].rows.flat().join(' ');
  ['ShipNavi標準', '楽天', 'Yahoo', 'Amazon', 'Shopify', 'BASE', 'STORES', 'メルカリShops'].forEach((platform) => {
    assertTruthy(`orders xlsx template explains ${platform} mapping`, explanationText.includes(platform), { field: '入力説明' });
  });

  const fareXlsx = callFunction('generateImportTemplate', ['fares', 'xlsx']);
  const fareExplanation = fareXlsx.sheets[1].rows.flat().join(' ');
  assertTruthy('fares xlsx template explains vertical format', fareExplanation.includes('縦持ち形式'), { field: '入力説明' });
  assertTruthy('fares xlsx template explains matrix format', fareExplanation.includes('マトリクス形式'), { field: '入力説明' });
}


function stripHtmlTags(text) {
  return String(text || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n');
}

function htmlDecode(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractHtmlVisibleText(file) {
  const source = readText(file);
  const values = [];
  ['title', 'placeholder', 'aria-label', 'content'].forEach((attr) => {
    [...source.matchAll(new RegExp(`\\b${attr}="([^"]+)"`, 'g'))].forEach((match) => {
      const value = htmlDecode(match[1]).trim();
      if (value && !value.startsWith('width=') && !value.startsWith('https://') && !value.includes('charset=')) values.push(value);
    });
  });
  stripHtmlTags(source).split(/\n+/).map((value) => htmlDecode(value).replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((value) => values.push(value));
  return values;
}

function stripTemplateExpressions(text) {
  let output = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (depth === 0 && char === '$' && next === '{') {
      depth = 1;
      index += 1;
      output += ' ';
      continue;
    }
    if (depth > 0) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      continue;
    }
    output += char;
  }
  return output;
}

function extractDashboardVisibleText() {
  const source = readText(path.join(repoRoot, 'assets', 'dashboard.js')).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const values = [];
  source.split(/\n/).forEach((line) => {
    const trimmed = line.trim();
    const likelyVisibleLine = /showToast|textContent|innerHTML|outerHTML|<|message\s*=|errors:/.test(trimmed);
    if (!likelyVisibleLine) return;
    [...trimmed.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)].forEach((match) => {
      const value = (match[1] ?? match[2] ?? '').replace(/\\uFEFF/g, '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (/[ぁ-んァ-ン一-龯]|\b(SKU|CSV|Excel|API|URL|ID)\b/.test(value)) values.push(value);
    });
    [...trimmed.matchAll(/`([^`]*)`/g)].forEach((match) => {
      const withoutExpressions = stripTemplateExpressions(match[1]);
      stripHtmlTags(withoutExpressions).split(/\n+/).map((value) => value.replace(/[`;]+/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((value) => {
        if (/[ぁ-んァ-ン一-龯]|\b(SKU|CSV|Excel|API|URL|ID)\b/.test(value)) values.push(value);
      });
    });
    if (!trimmed.includes('`') && trimmed.includes('<')) {
      stripHtmlTags(trimmed).split(/\n+/).map((value) => value.replace(/[`;]+/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((value) => {
        if (/[ぁ-んァ-ン一-龯]|\b(SKU|CSV|Excel|API|URL|ID)\b/.test(value)) values.push(value);
      });
    }
  });
  return values;
}

function validateUiTextScan() {
  const htmlFiles = fs.readdirSync(repoRoot).filter((file) => file.endsWith('.html')).map((file) => path.join(repoRoot, file));
  const visibleTexts = [
    ...htmlFiles.flatMap((file) => extractHtmlVisibleText(file).map((text) => ({ file: path.relative(repoRoot, file), text }))),
    ...extractDashboardVisibleText().map((text) => ({ file: 'assets/dashboard.js', text })),
  ];
  const forbiddenChinese = /(商品主档|不足字段|CSV导出|推荐配送方式|节省金额|导入来源平台|[导节荐额订单汉测验码邮编错关闭继续创经运输])/;
  const chineseHits = visibleTexts.filter((item) => forbiddenChinese.test(item.text));
  if (chineseHits.length) fail('UI text scan forbidden Chinese', { expected: '0 forbidden Chinese UI strings', actual: chineseHits.slice(0, 10) });
  else pass('UI text scan forbidden Chinese', { expected: 0, actual: 0 });

  const allowedEnglish = new Set(['ShipNavi', 'SKU', 'CSV', 'Excel', 'XLSX', 'API', 'URL', 'ID', 'Amazon', 'Yahoo', 'Shopify', 'BASE', 'STORES', 'MakeShop', 'Shops', 'S', 'g', 'kg', 'cm', 'mm']);
  const englishWords = new Map();
  visibleTexts.forEach(({ file, text }) => {
    const scanText = stripTemplateExpressions(text).replace(/<[^>]+>/g, ' ');
    [...scanText.matchAll(/[A-Za-z][A-Za-z0-9-]*/g)].forEach((match) => {
      const word = match[0];
      if (allowedEnglish.has(word) || word.startsWith('SKU-') || /@/.test(text)) return;
      if (/^(https?|charset|UTF|Noto|Sans|JP|css|html|xlsx|xls|csv|text)$/.test(word)) return;
      if (!englishWords.has(word)) englishWords.set(word, { word, file, text });
    });
  });
  const remaining = [...englishWords.values()].slice(0, 30);
  if (remaining.length) warning('UI text scan unapproved English', { expected: 'Japanese UI or approved terms only', actual: remaining });
  else pass('UI text scan unapproved English', { expected: 0, actual: 0 });

  const japaneseCount = visibleTexts.filter((item) => /[ぁ-んァ-ン一-龯]/.test(item.text) && !forbiddenChinese.test(item.text)).length;
  const englishCount = visibleTexts.filter((item) => /[A-Za-z]/.test(item.text)).length;
  pass('UI text scan summary', { chineseCount: chineseHits.length, englishCount, japaneseCount });
}

function validateShipmentQueue() {
  assertEqual('Phase8 shipment status ready is supported', callFunction('normalizeShipmentStatus', ['ready']), 'ready', { field: 'shipmentStatus' });
  assertEqual('Phase8 shipment status fallback is imported', callFunction('normalizeShipmentStatus', ['unknown_status']), 'imported', { field: 'shipmentStatus' });
  assertEqual('Phase8 shipment status label is Japanese', callFunction('getShipmentStatusLabel', ['on_hold']), '保留', { field: 'shipmentStatusLabel' });

  setData('shipnaviDashboardProducts', [
    { sku: 'SKU-Q-OK', bundleable: true, weight: '500', length: '20', width: '20', height: '20', size: '60' },
  ]);
  setData('shipnaviDashboardFareTables', { matrixView: null, normalizedFareRows: [
    { carrier: 'ヤマト', service: '宅急便', size: '60', zone: '東京', fare: '850', weightLimit: '2000' },
    { carrier: '佐川', service: '飛脚宅配便', size: '60', zone: '東京', fare: '950', weightLimit: '2000' },
  ] });
  setData('shipnaviDashboardOrders', [
    { id: 'q1', orderNo: 'QUEUE-OK', customer: '出荷テストA', postal: '100-0001', address: '東京都テスト区', sku: 'SKU-Q-OK', quantity: '1', sourcePlatform: 'Fixture', shipmentStatus: 'pending', warnings: [] },
    { id: 'q2', orderNo: 'QUEUE-POSTAL-ISSUE', customer: '出荷テストB', postal: '', address: '東京都テスト区', sku: 'SKU-Q-OK', quantity: '1', sourcePlatform: 'Fixture', shipmentStatus: 'imported', warnings: ['郵便番号未設定'] },
    { id: 'q3', orderNo: 'QUEUE-MISSING-PRODUCT', customer: '出荷テストC', postal: '100-0001', address: '東京都テスト区', sku: 'SKU-Q-MISSING', quantity: '1', sourcePlatform: 'Fixture', shipmentStatus: 'imported', warnings: [] },
  ]);
  const queueRows = callFunction('getShipmentQueueRows', []);
  assertEqual('Phase8 shipment queue creates one row per non-bundled shipment', queueRows.length, 3, { field: 'shipmentQueue.length' });
  const readyRow = queueRows.find((row) => row.orderNos === 'QUEUE-OK');
  assertEqual('Phase8 shipment queue keeps pending status for clean row', readyRow?.shipmentStatus, 'pending', { field: 'shipmentStatus', actual: readyRow });
  assertTruthy('Phase8 shipment queue shows recommended shipping method', Boolean(readyRow?.recommendedCarrier), { field: 'recommendedCarrier', actual: readyRow });
  const errorRow = queueRows.find((row) => row.orderNos === 'QUEUE-POSTAL-ISSUE');
  assertEqual('Phase8 shipment queue moves critical issue row to error', errorRow?.shipmentStatus, 'error', { field: 'shipmentStatus', actual: errorRow });
  assertTruthy('Phase8 shipment queue counts issue rows', Number(errorRow?.issueCount) > 0, { field: 'issueCount', actual: errorRow });
  const holdRow = queueRows.find((row) => row.orderNos === 'QUEUE-MISSING-PRODUCT');
  assertEqual('Phase8 shipment queue moves blocking recommendation row to hold', holdRow?.shipmentStatus, 'on_hold', { field: 'shipmentStatus', actual: holdRow });
  const queueSummary = callFunction('getShipmentQueueSummary', []);
  assertEqual('Phase8 shipment queue summary counts orders', queueSummary.totalOrders, 3, { field: 'totalOrders' });
  assertTruthy('Phase8 shipment queue summary includes error count', queueSummary.statusCounts.error >= 1, { field: 'statusCounts', actual: queueSummary.statusCounts });
  const updatedOrders = callFunction('updateShipmentStatusForOrders', [['q1'], 'ready']);
  assertEqual('Phase8 shipment status action updates selected orders', updatedOrders[0]?.shipmentStatus, 'ready', { field: 'shipmentStatus', actual: updatedOrders });
  const updatedQueueRows = callFunction('getShipmentQueueRows', []);
  const updatedReadyRow = updatedQueueRows.find((row) => row.orderNos === 'QUEUE-OK');
  assertEqual('Phase8 shipment queue reflects status action', updatedReadyRow?.shipmentStatus, 'ready', { field: 'shipmentStatus', actual: updatedReadyRow });
  const exportPreview = callFunction('getShipmentExportPreview', []);
  assertEqual('Phase8 shipment export preview counts exportable orders', exportPreview.exportableCount, 1, { field: 'exportableCount', actual: exportPreview });
  assertEqual('Phase8 shipment export preview counts hold orders', exportPreview.onHoldCount, 1, { field: 'onHoldCount', actual: exportPreview });
  assertEqual('Phase8 shipment export preview counts error orders', exportPreview.errorCount, 1, { field: 'errorCount', actual: exportPreview });
  assertEqual('Phase8 shipment export preview counts carrier orders', exportPreview.carrierCounts['ヤマト'], 1, { field: 'carrierCounts', actual: exportPreview.carrierCounts });
  const exportRows = callFunction('getShipmentExportRows', []);
  assertEqual('Phase8 shipment export excludes hold and error by default', exportRows.length, 1, { field: 'shipmentExport.length', actual: exportRows });
  assertEqual('Phase8 shipment export includes order number', exportRows[0]?.注文番号, 'QUEUE-OK', { field: '注文番号', actual: exportRows[0] });
  assertEqual('Phase8 shipment export includes recommended carrier', exportRows[0]?.推奨配送会社, 'ヤマト', { field: '推奨配送会社', actual: exportRows[0] });
  assertEqual('Phase8 shipment export includes Japanese status', exportRows[0]?.出荷状態, '出荷準備中', { field: '出荷状態', actual: exportRows[0] });
  const exportAllRows = callFunction('getShipmentExportRows', [{ includeBlocked: true }]);
  assertEqual('Phase8 shipment group export can include blocked rows when requested', exportAllRows.length, 3, { field: 'shipmentExport.length', actual: exportAllRows });
  callFunction('updateShipmentStatusForOrders', [['q1'], 'shipped']);
  const resultsSummary = callFunction('getShipmentResultsSummary', []);
  assertEqual('Phase8 results center summary counts total orders', resultsSummary.totalOrders, 3, { field: 'totalOrders', actual: resultsSummary });
  assertEqual('Phase8 results center summary counts shipped orders', resultsSummary.shippedCount, 1, { field: 'shippedCount', actual: resultsSummary });
  assertEqual('Phase8 results center summary counts hold orders', resultsSummary.onHoldCount, 1, { field: 'onHoldCount', actual: resultsSummary });
  assertEqual('Phase8 results center summary counts error orders', resultsSummary.errorCount, 1, { field: 'errorCount', actual: resultsSummary });
  assertEqual('Phase8 results center carrier breakdown counts Yamato', resultsSummary.carrierCounts['ヤマト'], 2, { field: 'carrierCounts', actual: resultsSummary.carrierCounts });
  assertTruthy('Phase8 results center carrier breakdown includes Sagawa', Object.prototype.hasOwnProperty.call(resultsSummary.carrierCounts, '佐川'), { field: 'carrierCounts', actual: resultsSummary.carrierCounts });
  assertTruthy('Phase8 results center carrier breakdown includes Japan Post', Object.prototype.hasOwnProperty.call(resultsSummary.carrierCounts, '日本郵便'), { field: 'carrierCounts', actual: resultsSummary.carrierCounts });
  assertEqual('Phase8 results center status breakdown counts shipped', resultsSummary.statusCounts.shipped, 1, { field: 'statusCounts', actual: resultsSummary.statusCounts });
  assertTruthy('Phase8 results center estimated savings uses fare comparison rows', resultsSummary.fareComparisonCount >= 1, { field: 'fareComparisonCount', actual: resultsSummary });
  assertTruthy('Phase8 results center estimated savings count uses existing savings', resultsSummary.estimatedSavingsCount >= 1, { field: 'estimatedSavingsCount', actual: resultsSummary });
}

function validateP0Regression() {
  assertEqual('P0-1 postal 100-0001 maps to 東京', callFunction('getZoneByPostal', ['100-0001', '']), '東京', { field: 'postal' });
  assertEqual('P0-1 valid unknown postal does not fallback to address', callFunction('getZoneByPostal', ['999-9999', '東京都テスト区']), 'unknown', { field: 'postal,address' });

  setData('shipnaviDashboardFareTables', { matrixView: null, normalizedFareRows: [
    { carrier: 'ヤマト', service: '60', size: '60', zone: '東京', fare: '1000' },
    { carrier: 'ヤマト', service: '80', size: '80', zone: '東京', fare: '900' },
    { carrier: 'ヤマト', service: '60-heavy', size: '60', zone: '東京', fare: '800', weightLimit: '500' },
    { carrier: '佐川', service: 'default', size: '60', zone: 'default', fare: '1100' },
  ] });
  const fareOptions = callFunction('getFareOptions', [70, '東京', 1000]).map((fare) => [fare.service, fare.size, fare.fare]);
  assertEqual('P0-2 fare options upsize/filter/sort', JSON.stringify(fareOptions), JSON.stringify([['80', '80', '900']]), { field: 'fareOptions', expected: [['80', '80', '900']], actual: fareOptions });

  setData('shipnaviDashboardProducts', [
    { sku: 'A', bundleable: true, weight: '100', length: '10', width: '10', height: '10', size: '60' },
    { sku: 'B', bundleable: false, weight: '100', length: '10', width: '10', height: '10', size: '60' },
  ]);
  assertEqual('P0-3 missing product is not bundleable', callFunction('isOrderBundleable', [{ sku: 'MISSING' }]), false, { field: 'sku' });
  assertEqual('P0-3 bundleable false product is not bundleable', callFunction('isOrderBundleable', [{ sku: 'B' }]), false, { field: 'sku' });

  setData('shipnaviDashboardOrders', [
    { id: 'o1', orderNo: 'O1', customer: '同梱テスト', postal: '100-0001', address: '東京都テスト区', sku: 'A', quantity: '1', sourcePlatform: 'Fixture' },
    { id: 'o2', orderNo: 'O2', customer: '同梱テスト', postal: '100-0001', address: '東京都テスト区', sku: 'A', quantity: '1', sourcePlatform: 'Fixture' },
    { id: 'o3', orderNo: 'O3', customer: '不可テスト', postal: '100-0001', address: '東京都テスト区', sku: 'B', quantity: '1', sourcePlatform: 'Fixture' },
    { id: 'o4', orderNo: 'O4', customer: '不可テスト', postal: '100-0001', address: '東京都テスト区', sku: 'B', quantity: '1', sourcePlatform: 'Fixture' },
  ]);
  const bundleCandidates = callFunction('getBundleCandidates', []);
  assertEqual('P0-3 getBundleCandidates only includes all-bundleable groups', bundleCandidates.length, 1, { field: 'bundleCandidates.length' });
  const shipmentGroups = callFunction('getShipmentOrderGroups', []);
  assertTruthy('P0-3 getShipmentOrderGroups keeps groups available', shipmentGroups.length >= 3, { field: 'shipmentGroups.length', expected: '>= 3', actual: shipmentGroups.length });
}

async function main() {
  console.log('ShipNavi Phase6 fixture validation');
  console.log(`Fixture root: ${path.relative(repoRoot, fixtureRoot)}`);
  if (!fs.existsSync(fixtureRoot)) {
    fail('test-fixtures directory exists', { fixture: 'test-fixtures', expected: 'directory exists', actual: 'missing' });
  }

  await validateImportFileReaderLayer();
  await validateProductFixtures();
  await validateFareFixtures();
  await validateOrderFixtures();
  await validateImportTemplates();
  validateUiTextScan();
  validatePersistentIssueStatusLifecycle();
  validateShipmentQueue();
  validateP0Regression();

  console.log(`SUMMARY PASS=${results.filter((r) => r.status === 'PASS').length} PENDING=${pendingCount} FAIL=${failureCount}`);
  if (failureCount > 0) {
    console.log('RESULT FAIL');
    process.exit(1);
  }
  console.log('RESULT PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
