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
  assertEqual('CSV and XLSX fare matrix raw rows use same title', fareCsvResult.rawRows?.[0]?.[0], fareXlsxResult.rawRows?.[0]?.[0], {
    fixture: path.relative(repoRoot, fareXlsx),
    field: 'rawRows',
    expected: fareCsvResult.rawRows?.[0]?.[0],
    actual: fareXlsxResult.rawRows?.[0]?.[0],
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
  const xlsxStyleFile = fixturePath('fares', 'fare-matrix-xlsx-style.csv');
  const xlsxStyleXlsxFile = fixturePath('fares', 'fare-matrix-xlsx-style.xlsx');
  const edgeFile = fixturePath('fares', 'fare-matrix-edge-cases.csv');
  const edgeXlsxFile = fixturePath('fares', 'fare-matrix-edge-cases.xlsx');
  ensureFile(normalFile);
  ensureFile(normalXlsxFile, 'XLSX fixture');
  ensureFile(xlsxStyleFile);
  ensureFile(xlsxStyleXlsxFile, 'XLSX fixture');
  ensureFile(edgeFile);
  ensureFile(edgeXlsxFile, 'XLSX fixture');

  const normalCsv = await readImportFixtureFile(normalFile);
  const normalXlsx = await readImportFixtureFile(normalXlsxFile);
  const normalCases = [
    { label: 'csv', file: normalFile, rows: normalCsv.rawRows },
    { label: 'xlsx', file: normalXlsxFile, rows: normalXlsx.rawRows },
  ];

  for (const normalCase of normalCases) {
    const headers = Array.isArray(normalCase.rows[0]) ? normalCase.rows[0] : Object.keys(normalCase.rows[0] || {});
    const format = callFunction('detectFareTableFormat', [headers, normalCase.rows]);
    assertEqual(`fare-matrix-normal.${normalCase.label} is detected as matrix`, format, 'matrix', { fixture: path.relative(repoRoot, normalCase.file), field: 'headers' });
    const normalized = callFunction('normalizeFareMatrix', [normalCase.rows, 'ヤマト', '宅急便']);
    assertTruthy(`fare-matrix-normal.${normalCase.label} creates normalizedFareRows`, normalized.length > 0, { fixture: path.relative(repoRoot, normalCase.file), expected: 'normalizedFareRows.length > 0', actual: normalized.length });
    const matrixView = callFunction('createMatrixView', [normalCase.rows, 'ヤマト', '宅急便']);
    assertTruthy(`fare-matrix-normal.${normalCase.label} creates matrixView and normalizedFareRows`, matrixView && matrixView.rows && normalized.length > 0, { fixture: path.relative(repoRoot, normalCase.file), expected: 'matrixView + normalizedFareRows', actual: { matrixRows: matrixView?.rows?.length || 0, normalizedRows: normalized.length } });
    assertEqual(`fare-matrix-normal.${normalCase.label} infers Yamato service default`, `${matrixView.carrier}/${matrixView.service}`, 'ヤマト/宅急便', { field: 'carrier/service' });
    assertEqual(`fare-matrix-normal.${normalCase.label} zoneCount is 13`, matrixView.zoneHeaders.length, 13, { field: 'matrixView.zoneHeaders.length', actual: matrixView.zoneHeaders });
    assertIncludes(`fare-matrix-normal.${normalCase.label} keeps 北海道 zone header`, matrixView.zoneHeaders, '北海道', { field: 'matrixView.zoneHeaders' });
    assertTruthy(`fare-matrix-normal.${normalCase.label} does not create bogus S zone`, !matrixView.zoneHeaders.includes('S'), { field: 'matrixView.zoneHeaders', actual: matrixView.zoneHeaders });
    assertEqual(`fare-matrix-normal.${normalCase.label} preserves required zone order`, JSON.stringify(matrixView.zoneHeaders), JSON.stringify(['北海道', '北東北', '南東北', '関東', '東京', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄']), { field: 'matrixView.zoneHeaders' });
    assertEqual(`fare-matrix-normal.${normalCase.label} preserves 東京 prefecture group`, JSON.stringify(matrixView.zoneGroups?.東京), JSON.stringify(['東京都']), { field: 'matrixView.zoneGroups.東京' });
    const kantoPrefectures = matrixView.zoneGroups?.関東 || [];
    ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '神奈川県', '山梨県'].forEach((prefecture) => {
      assertIncludes(`fare-matrix-normal.${normalCase.label} preserves 関東 prefecture ${prefecture}`, kantoPrefectures, prefecture, { field: 'matrixView.zoneGroups.関東' });
    });
    assertEqual(`fare-matrix-normal.${normalCase.label} preserves 九州 prefecture group`, JSON.stringify(matrixView.zoneGroups?.九州), JSON.stringify(['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県']), { field: 'matrixView.zoneGroups.九州' });
    assertTruthy(`fare-matrix-normal.${normalCase.label} never treats numeric cells as prefectures`, !Object.values(matrixView.zoneGroups || {}).flat().some((value) => /^\d+$/.test(value)), { field: 'matrixView.zoneGroups', actual: matrixView.zoneGroups });
    const hokkaido60 = normalized.find((fare) => fare.zone === '北海道' && fare.size === '60' && fare.weight === '2');
    assertEqual(`fare-matrix-normal.${normalCase.label} 北海道 60 / 2kg fare`, hokkaido60?.fare, '700', { field: 'normalizedFareRows', expected: '700', actual: hokkaido60 });
    const kanto80 = normalized.find((fare) => fare.zone === '関東' && fare.size === '80' && fare.weight === '5');
    assertEqual(`fare-matrix-normal.${normalCase.label} 関東 80 / 5kg fare`, kanto80?.fare, '480', { field: 'normalizedFareRows', expected: '480', actual: kanto80 });
    const kyushu100 = normalized.find((fare) => fare.zone === '九州' && fare.size === '100' && fare.weight === '10');
    assertEqual(`fare-matrix-normal.${normalCase.label} 九州 100 / 10kg fare`, kyushu100?.fare, '800', { field: 'normalizedFareRows', expected: '800', actual: kyushu100 });
    const okinawa160 = normalized.find((fare) => fare.zone === '沖縄' && fare.size === '160' && fare.weight === '25');
    assertEqual(`fare-matrix-normal.${normalCase.label} 沖縄 160 / 25kg fare`, okinawa160?.fare, '3780', { field: 'normalizedFareRows', expected: '3780', actual: okinawa160 });
    [hokkaido60, kanto80, kyushu100, okinawa160].forEach((fare) => {
      assertEqual(`fare-matrix-normal.${normalCase.label} matrixView matches normalizedFareRows for ${fare?.size}/${fare?.zone}`, matrixView.rows.find((row) => row.size === fare?.size)?.fares?.[fare?.zone], fare?.fare, { field: `${fare?.size}/${fare?.zone}` });
    });
    ['carrier', 'service', 'size', 'weight', 'zone', 'prefectures', 'fare'].forEach((field) => {
      assertTruthy(`fare-matrix-normal.${normalCase.label} normalizedFareRows include ${field}`, Object.prototype.hasOwnProperty.call(kanto80 || {}, field), { field, actual: kanto80 });
    });
    assertEqual(`fare-matrix-normal.${normalCase.label} normalized rows cover every matrix zone tier`, normalized.length, matrixView.rows.length * matrixView.zoneHeaders.length, { field: 'normalizedFareRows.length' });
    const reconstructed = callFunction('normalizeMatrixView', [matrixView]);
    assertEqual(`fare-matrix-normal.${normalCase.label} reconstructs original zone headers`, JSON.stringify(reconstructed.zoneHeaders), JSON.stringify(matrixView.zoneHeaders), { field: 'matrixView.zoneHeaders' });
    assertEqual(`fare-matrix-normal.${normalCase.label} reconstructs prefecture layout`, JSON.stringify(reconstructed.zoneGroups?.関東), JSON.stringify(kantoPrefectures), { field: 'matrixView.zoneGroups.関東' });
    resetImportIssues();
    const successIssues = callFunction('recordFareImportIssues', [normalCase.rows, format, matrixView, normalized, path.basename(normalCase.file)]);
    assertEqual(`fare-matrix-normal.${normalCase.label} successful matrix import creates no unresolved warnings`, successIssues.length, 0, { field: 'importIssues' });
    assertEqual(`fare-matrix-normal.${normalCase.label} successful matrix import leaves unresolvedIssues at 0`, getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });
    assertTruthy(`fare-matrix-normal.${normalCase.label} successful matrix warningCount is not 100`, successIssues.length !== 100, { field: 'warningCount', actual: successIssues.length });
    const parsedRows = normalCase.label === 'csv' ? normalCsv.rows : normalXlsx.rows;
    resetImportIssues();
    const uiShapeIssues = callFunction('recordFareImportIssues', [parsedRows, format, matrixView, normalized, path.basename(normalCase.file)]);
    const falseLegacyIssues = uiShapeIssues.filter((issue) => ['column_name_mismatch', 'missing_size', 'missing_fare'].includes(issue.type));
    assertEqual(`fare-matrix-normal.${normalCase.label} UI parsed rows create no false legacy warnings`, falseLegacyIssues.length, 0, { field: 'importIssues', actual: uiShapeIssues });
    assertEqual(`fare-matrix-normal.${normalCase.label} UI parsed rows leave unresolvedIssues at 0`, getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });
    setData('shipnaviDashboardFareTables', { matrixView, normalizedFareRows: normalized });
    const options = callFunction('getFareOptions', [60, '東京', 1000]);
    assertTruthy(`fare-matrix-normal.${normalCase.label} normalizedFareRows are usable by getFareOptions`, options.length > 0, { fixture: path.relative(repoRoot, normalCase.file), field: 'getFareOptions', expected: 'options.length > 0', actual: options.length });
  }

  const fareComparableRows = (rows) => rows.map((fare) => ({
    carrier: fare.carrier,
    service: fare.service,
    size: fare.size,
    weight: fare.weight,
    weightLimit: fare.weightLimit,
    zone: fare.zone,
    prefectures: fare.prefectures,
    fare: fare.fare,
  })).sort((a, b) => `${a.carrier}|${a.service}|${a.size}|${a.weight}|${a.zone}`.localeCompare(`${b.carrier}|${b.service}|${b.size}|${b.weight}|${b.zone}`, 'ja'));
  const matrixDisplayComparable = (view) => ({
    carrier: view.carrier,
    service: view.service,
    sizeLabel: view.sizeLabel,
    weightLabel: view.weightLabel,
    zoneHeaders: view.zoneHeaders,
    zoneGroups: view.zoneGroups,
    prefectureRows: view.prefectureRows,
    rows: view.rows,
  });
  const xlsxStyleCsv = await readImportFixtureFile(xlsxStyleFile);
  const xlsxStyleXlsx = await readImportFixtureFile(xlsxStyleXlsxFile);
  const xlsxStyleCsvHeaders = Array.isArray(xlsxStyleCsv.rawRows[0]) ? xlsxStyleCsv.rawRows[0] : Object.keys(xlsxStyleCsv.rawRows[0] || {});
  const xlsxStyleXlsxHeaders = Array.isArray(xlsxStyleXlsx.rawRows[0]) ? xlsxStyleXlsx.rawRows[0] : Object.keys(xlsxStyleXlsx.rawRows[0] || {});
  const xlsxStyleCsvFormat = callFunction('detectFareTableFormat', [xlsxStyleCsvHeaders, xlsxStyleCsv.rawRows]);
  const xlsxStyleXlsxFormat = callFunction('detectFareTableFormat', [xlsxStyleXlsxHeaders, xlsxStyleXlsx.rawRows]);
  const xlsxStyleCsvView = callFunction('createMatrixView', [xlsxStyleCsv.rawRows, 'ヤマト', '宅急便']);
  const xlsxStyleXlsxView = callFunction('createMatrixView', [xlsxStyleXlsx.rawRows, 'ヤマト', '宅急便']);
  const xlsxStyleCsvRows = callFunction('normalizeFareMatrix', [xlsxStyleCsv.rawRows, 'ヤマト', '宅急便']);
  const xlsxStyleXlsxRows = callFunction('normalizeFareMatrix', [xlsxStyleXlsx.rawRows, 'ヤマト', '宅急便']);
  assertEqual('fare-matrix-xlsx-style.csv is detected as matrix', xlsxStyleCsvFormat, 'matrix', { fixture: path.relative(repoRoot, xlsxStyleFile), field: 'headers' });
  assertEqual('fare-matrix-xlsx-style.xlsx is detected as matrix', xlsxStyleXlsxFormat, 'matrix', { fixture: path.relative(repoRoot, xlsxStyleXlsxFile), field: 'headers' });
  assertEqual('CSV and XLSX equivalent matrix zone order match', JSON.stringify(xlsxStyleXlsxView.zoneHeaders), JSON.stringify(xlsxStyleCsvView.zoneHeaders), { field: 'matrixView.zoneHeaders', actual: xlsxStyleXlsxView.zoneHeaders });
  assertEqual('CSV and XLSX equivalent matrix prefecture groups match', JSON.stringify(xlsxStyleXlsxView.zoneGroups), JSON.stringify(xlsxStyleCsvView.zoneGroups), { field: 'matrixView.zoneGroups' });
  assertEqual('CSV and XLSX equivalent matrix display rows match', JSON.stringify(matrixDisplayComparable(xlsxStyleXlsxView)), JSON.stringify(matrixDisplayComparable(xlsxStyleCsvView)), { field: 'matrixView.displayData' });
  assertEqual('CSV and XLSX equivalent normalizedFareRows count match', xlsxStyleXlsxRows.length, xlsxStyleCsvRows.length, { field: 'normalizedFareRows.length' });
  assertEqual('CSV and XLSX equivalent normalizedFareRows values match', JSON.stringify(fareComparableRows(xlsxStyleXlsxRows)), JSON.stringify(fareComparableRows(xlsxStyleCsvRows)), { field: 'normalizedFareRows' });
  assertEqual('XLSX-style matrix zoneCount is 13', xlsxStyleXlsxView.zoneHeaders.length, 13, { field: 'matrixView.zoneHeaders', actual: xlsxStyleXlsxView.zoneHeaders });
  assertEqual('XLSX-style matrix first zone is 北海道', xlsxStyleXlsxView.zoneHeaders[0], '北海道', { field: 'matrixView.zoneHeaders[0]', actual: xlsxStyleXlsxView.zoneHeaders });
  assertEqual('XLSX-style matrix second zone is 北東北', xlsxStyleXlsxView.zoneHeaders[1], '北東北', { field: 'matrixView.zoneHeaders[1]', actual: xlsxStyleXlsxView.zoneHeaders });
  assertIncludes('XLSX-style matrix keeps 北海道 zone header', xlsxStyleXlsxView.zoneHeaders, '北海道', { field: 'matrixView.zoneHeaders' });
  assertTruthy('XLSX-style matrix has no extra 2 zone column', !xlsxStyleXlsxView.zoneHeaders.includes('2'), { field: 'matrixView.zoneHeaders', actual: xlsxStyleXlsxView.zoneHeaders });
  assertEqual('XLSX-style matrix preserves exact zone order', JSON.stringify(xlsxStyleXlsxView.zoneHeaders), JSON.stringify(['北海道', '北東北', '南東北', '関東', '東京', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄']), { field: 'matrixView.zoneHeaders' });
  assertEqual('XLSX-style matrix preserves 九州 prefecture group', JSON.stringify(xlsxStyleXlsxView.zoneGroups?.九州), JSON.stringify(['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県']), { field: 'matrixView.zoneGroups.九州' });
  assertEqual('XLSX-style matrix first display row keeps 北海道 prefecture cell', xlsxStyleXlsxView.prefectureRows?.[0]?.cells?.北海道, '北海道', { field: 'matrixView.prefectureRows' });
  assertEqual('XLSX-style matrix preserves blank prefecture row label', xlsxStyleXlsxView.prefectureRows?.[1]?.label, '', { field: 'matrixView.prefectureRows' });
  assertEqual('XLSX-style matrix keeps blank second visual column via display rows', xlsxStyleXlsxView.prefectureRows?.[1]?.cells?.北海道, '', { field: 'matrixView.prefectureRows' });
  assertEqual('XLSX-style matrix 60 北海道 fare', xlsxStyleXlsxRows.find((fare) => fare.zone === '北海道' && fare.size === '60')?.fare, '700', { field: 'normalizedFareRows' });
  assertEqual('XLSX-style matrix 60 北東北 fare', xlsxStyleXlsxRows.find((fare) => fare.zone === '北東北' && fare.size === '60')?.fare, '500', { field: 'normalizedFareRows' });
  assertEqual('XLSX-style matrix 80 関東 fare', xlsxStyleXlsxRows.find((fare) => fare.zone === '関東' && fare.size === '80')?.fare, '480', { field: 'normalizedFareRows' });
  assertEqual('XLSX-style matrix 160 沖縄 fare', xlsxStyleXlsxRows.find((fare) => fare.zone === '沖縄' && fare.size === '160')?.fare, '3780', { field: 'normalizedFareRows' });
  resetImportIssues();
  const xlsxStyleIssues = callFunction('recordFareImportIssues', [xlsxStyleXlsx.rawRows, xlsxStyleXlsxFormat, xlsxStyleXlsxView, xlsxStyleXlsxRows, path.basename(xlsxStyleXlsxFile)]);
  assertEqual('XLSX-style successful matrix warningCount is 0', xlsxStyleIssues.length, 0, { field: 'warningCount', actual: xlsxStyleIssues });
  assertEqual('XLSX-style successful matrix unresolvedIssues is 0', getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });

  const manualMappingRows = [
    ['ヤマト運輸 宅急便'],
    ['配送先', '', '北海道', '北東北', '南東北', '関東', '東京', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄'],
    ['都道府県', '', '北海道', '青森県', '宮城県', '茨城県', '東京都', '新潟県', '富山県', '愛知県', '大阪府', '岡山県', '香川県', '福岡県', '沖縄県'],
    ['', '', '', '岩手県', '山形県', '栃木県', '', '長野県', '石川県', '岐阜県', '京都府', '広島県', '徳島県', '佐賀県', ''],
    ['', '', '', '秋田県', '福島県', '群馬県', '', '', '福井県', '静岡県', '兵庫県', '山口県', '愛媛県', '長崎県', ''],
    ['', '', '', '', '', '埼玉県', '', '', '', '三重県', '奈良県', '鳥取県', '高知県', '熊本県', ''],
    ['', '', '', '', '', '千葉県', '', '', '', '', '滋賀県', '島根県', '', '大分県', ''],
    ['', '', '', '', '', '神奈川県', '', '', '', '', '和歌山県', '', '', '宮崎県', ''],
    ['', '', '', '', '', '山梨県', '', '', '', '', '', '', '', '鹿児島県', ''],
    ['３辺合計(cm)', '重量(kg)', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['60', '2', '700', '500', '460', '430', '430', '460', '460', '460', '500', '550', '550', '700', '1240'],
    ['80', '5', '900', '700', '660', '480', '480', '660', '660', '660', '700', '770', '770', '900', '1740'],
    ['100', '10', '1100', '900', '860', '650', '650', '860', '860', '860', '900', '990', '990', '800', '2240'],
    ['120', '15', '1300', '1100', '1060', '850', '850', '1060', '1060', '1060', '1100', '1210', '1210', '1300', '2740'],
    ['140', '20', '1500', '1300', '1260', '1050', '1050', '1260', '1260', '1260', '1300', '1430', '1430', '1500', '3260'],
    ['160', '25', '1700', '1500', '1460', '1250', '1250', '1460', '1460', '1460', '1500', '1650', '1650', '1700', '3780'],
  ];
  const manualHeaders = manualMappingRows[0];
  const manualFormat = callFunction('detectFareTableFormat', [manualHeaders, manualMappingRows]);
  assertEqual('low-confidence XLSX-style matrix is not imported as a confident matrix', manualFormat, 'unknown', { field: 'fareFormat' });
  const manualConfidence = callFunction('getFareImportConfidence', [manualFormat, null, []]);
  assertEqual('low-confidence XLSX-style matrix reports low confidence', manualConfidence.level, '低', { field: 'confidence', actual: manualConfidence });
  assertTruthy('low-confidence XLSX-style matrix goes to mapping wizard state', callFunction('shouldOpenFareMappingWizard', [manualFormat, null, []]), { field: 'mappingWizard' });
  const manualRule = {
    name: 'ヤマト手動マッピング',
    carrier: 'ヤマト',
    service: '宅急便',
    carrierCell: 'A1',
    zoneHeaderRow: 2,
    zoneStartCol: 'C',
    zoneEndCol: 'O',
    prefectureStartRow: 3,
    prefectureEndRow: 9,
    sizeCol: 'A',
    weightCol: 'B',
    fareStartRow: 11,
    fareEndRow: 16,
  };
  const manualPreview = callFunction('previewFareImportMapping', [manualMappingRows, manualRule]);
  assertTruthy('manual fare mapping creates matrixView', manualPreview.matrixView?.rows?.length > 0, { field: 'matrixView' });
  assertTruthy('manual fare mapping creates normalizedFareRows', manualPreview.normalizedFareRows.length > 0, { field: 'normalizedFareRows.length', actual: manualPreview.normalizedFareRows.length });
  assertEqual('manual fare mapping preserves zone count', manualPreview.matrixView.zoneHeaders.length, 13, { field: 'matrixView.zoneHeaders' });
  assertEqual('manual fare mapping first zone is 北海道', manualPreview.matrixView.zoneHeaders[0], '北海道', { field: 'matrixView.zoneHeaders' });
  assertEqual('manual fare mapping 80 関東 fare', manualPreview.normalizedFareRows.find((fare) => fare.zone === '関東' && fare.size === '80' && fare.weight === '5')?.fare, '480', { field: 'normalizedFareRows' });
  resetImportIssues();
  const manualIssues = callFunction('recordFareImportIssues', [manualMappingRows, 'matrix', manualPreview.matrixView, manualPreview.normalizedFareRows, 'manual-mapping.xlsx']);
  assertEqual('valid manual mapping warningCount is 0', manualIssues.length, 0, { field: 'warningCount', actual: manualIssues });
  assertEqual('valid manual mapping unresolvedIssues is 0', getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });
  const invalidMappingValidation = callFunction('validateFareImportMapping', [manualMappingRows, { ...manualRule, zoneStartCol: 'Z', zoneEndCol: 'Z' }]);
  assertTruthy('invalid manual mapping shows Japanese guidance', !invalidMappingValidation.valid && invalidMappingValidation.guidance.some((message) => message.includes('ゾーン') || message.includes('運賃')), { field: 'guidance', actual: invalidMappingValidation.guidance });
  setData('shipnaviFareImportMappingRules', []);
  const savedManualRule = callFunction('saveFareImportMappingRule', [manualRule]);
  const savedRules = callFunction('getFareImportMappingRules', []);
  assertTruthy('manual mapping rule is saved to LocalStorage', savedRules.some((rule) => rule.name === savedManualRule.name), { field: 'shipnaviFareImportMappingRules', actual: savedRules });
  const reusedPreview = callFunction('previewFareImportMapping', [manualMappingRows, savedRules.find((rule) => rule.name === savedManualRule.name)]);
  assertEqual('saved mapping rule can be reused', JSON.stringify(fareComparableRows(reusedPreview.normalizedFareRows)), JSON.stringify(fareComparableRows(manualPreview.normalizedFareRows)), { field: 'normalizedFareRows' });
  const renamedRule = callFunction('renameFareImportMappingRule', [savedManualRule.name, 'ヤマト手動マッピング 改']);
  assertEqual('saved mapping rule can be renamed', renamedRule?.name, 'ヤマト手動マッピング 改', { field: 'shipnaviFareImportMappingRules' });
  const afterDeleteRules = callFunction('deleteFareImportMappingRule', ['ヤマト手動マッピング 改']);
  assertTruthy('saved mapping rule can be deleted', !afterDeleteRules.some((rule) => rule.name === 'ヤマト手動マッピング 改'), { field: 'shipnaviFareImportMappingRules', actual: afterDeleteRules });
  const sagawaManualPreview = callFunction('previewFareImportMapping', [manualMappingRows, { ...manualRule, name: '佐川手動マッピング', carrier: '佐川', service: '飛脚宅配便' }]);
  setData('shipnaviDashboardFareTables', { matrixView: null, normalizedFareRows: [] });
  callFunction('mergeImportedFareTable', [manualPreview.matrixView, manualPreview.normalizedFareRows]);
  callFunction('mergeImportedFareTable', [sagawaManualPreview.matrixView, sagawaManualPreview.normalizedFareRows]);
  let manualFareState = callFunction('getFareTableState', []);
  assertTruthy('manual mapping import appends another carrier', ['ヤマト', '佐川'].every((carrier) => manualFareState.normalizedFareRows.some((fare) => fare.carrier === carrier)), { field: 'normalizedFareRows', actual: [...new Set(manualFareState.normalizedFareRows.map((fare) => fare.carrier))] });
  const replacementManualRows = manualPreview.normalizedFareRows.map((fare) => (fare.carrier === 'ヤマト' && fare.service === '宅急便' && fare.size === '60' && fare.zone === '北海道' ? { ...fare, fare: '701' } : fare));
  callFunction('mergeImportedFareTable', [manualPreview.matrixView, replacementManualRows]);
  manualFareState = callFunction('getFareTableState', []);
  const yamatoManualHokkaido60 = manualFareState.normalizedFareRows.filter((fare) => fare.carrier === 'ヤマト' && fare.service === '宅急便' && fare.size === '60' && fare.zone === '北海道');
  assertEqual('manual mapping same carrier/service replaces only that table', yamatoManualHokkaido60.length, 1, { field: 'normalizedFareRows' });
  assertEqual('manual mapping replacement updates the same table', yamatoManualHokkaido60[0]?.fare, '701', { field: 'fare' });
  assertTruthy('manual mapping replacement preserves unrelated carrier', manualFareState.normalizedFareRows.some((fare) => fare.carrier === '佐川'), { field: 'normalizedFareRows' });
  manualFareState = callFunction('deleteFareTableByScope', ['ヤマト', '宅急便']);
  assertTruthy('manual mapping delete removes one carrier/service only', !manualFareState.normalizedFareRows.some((fare) => fare.carrier === 'ヤマト') && manualFareState.normalizedFareRows.some((fare) => fare.carrier === '佐川'), { field: 'normalizedFareRows', actual: [...new Set(manualFareState.normalizedFareRows.map((fare) => fare.carrier))] });

  setData('shipnaviDashboardFareTables', { matrixView: null, normalizedFareRows: [
    { carrier: '佐川', service: '飛脚宅配便', size: '60', zone: '東京', fare: '990', weightLimit: '2000' },
  ] });
  const realMatrixView = callFunction('createMatrixView', [normalCsv.rawRows, 'ヤマト', '宅急便']);
  const realMatrixRows = callFunction('normalizeFareMatrix', [normalCsv.rawRows, 'ヤマト', '宅急便']);
  callFunction('mergeImportedFareTable', [realMatrixView, realMatrixRows]);
  let fareState = callFunction('getFareTableState', []);
  assertTruthy('real matrix import appends new carrier without replacing unrelated carrier', fareState.normalizedFareRows.some((fare) => fare.carrier === '佐川') && fareState.normalizedFareRows.some((fare) => fare.carrier === 'ヤマト'), { field: 'normalizedFareRows', actual: [...new Set(fareState.normalizedFareRows.map((fare) => fare.carrier))] });
  assertTruthy('real matrix import preserves matrixView tables', (fareState.matrixView?.tables || []).some((table) => table.carrier === 'ヤマト'), { field: 'matrixView.tables' });
  const replacementRows = realMatrixRows.map((fare) => (fare.carrier === 'ヤマト' && fare.service === '宅急便' && fare.size === '60' && fare.zone === '東京' ? { ...fare, fare: '777' } : fare));
  callFunction('mergeImportedFareTable', [realMatrixView, replacementRows]);
  fareState = callFunction('getFareTableState', []);
  const yamatoTokyo60 = fareState.normalizedFareRows.filter((fare) => fare.carrier === 'ヤマト' && fare.service === '宅急便' && fare.size === '60' && fare.zone === '東京');
  assertEqual('same carrier/service matrix import replaces only that fare scope', yamatoTokyo60.length, 1, { field: 'normalizedFareRows' });
  assertEqual('same carrier/service replacement updates imported fare', yamatoTokyo60[0]?.fare, '777', { field: 'fare' });
  assertTruthy('same carrier/service replacement keeps unrelated carrier fares', fareState.normalizedFareRows.some((fare) => fare.carrier === '佐川'), { field: 'carrier' });
  const sagawaMatrixView = callFunction('normalizeMatrixView', [{ ...realMatrixView, carrier: '佐川', carrierLabel: '佐川急便', service: '飛脚宅配便' }]);
  const sagawaMatrixRows = callFunction('normalizeFareMatrix', [sagawaMatrixView]);
  const japanPostMatrixView = callFunction('normalizeMatrixView', [{ ...realMatrixView, carrier: '日本郵便', carrierLabel: '日本郵便', service: 'ゆうパック' }]);
  const japanPostMatrixRows = callFunction('normalizeFareMatrix', [japanPostMatrixView]);
  setData('shipnaviDashboardFareTables', {
    matrixView: callFunction('makeMatrixViewState', [[realMatrixView, sagawaMatrixView, japanPostMatrixView]]),
    normalizedFareRows: [...realMatrixRows, ...sagawaMatrixRows, ...japanPostMatrixRows],
  });
  fareState = callFunction('getFareTableState', []);
  assertTruthy('ヤマト/佐川/日本郵便 matrix tables coexist', ['ヤマト', '佐川', '日本郵便'].every((carrier) => fareState.normalizedFareRows.some((fare) => fare.carrier === carrier)), { field: 'normalizedFareRows', actual: [...new Set(fareState.normalizedFareRows.map((fare) => fare.carrier))] });
  const replacementJapanPostRows = japanPostMatrixRows.map((fare) => (fare.carrier === '日本郵便' && fare.service === 'ゆうパック' && fare.size === '60' && fare.zone === '東京' ? { ...fare, fare: '888' } : fare));
  callFunction('mergeImportedFareTable', [japanPostMatrixView, replacementJapanPostRows]);
  fareState = callFunction('getFareTableState', []);
  const japanPostTokyo60 = fareState.normalizedFareRows.filter((fare) => fare.carrier === '日本郵便' && fare.service === 'ゆうパック' && fare.size === '60' && fare.zone === '東京');
  assertEqual('re-importing 日本郵便 replaces only that matrix scope', japanPostTokyo60.length, 1, { field: 'normalizedFareRows' });
  assertEqual('re-imported 日本郵便 matrix updates its fare', japanPostTokyo60[0]?.fare, '888', { field: 'fare' });
  assertTruthy('re-importing 日本郵便 keeps ヤマト and 佐川 matrices', ['ヤマト', '佐川'].every((carrier) => fareState.normalizedFareRows.some((fare) => fare.carrier === carrier)), { field: 'normalizedFareRows', actual: [...new Set(fareState.normalizedFareRows.map((fare) => fare.carrier))] });
  fareState = callFunction('deleteFareTableByScope', ['ヤマト', '宅急便']);
  assertTruthy('deleting one carrier/service matrix removes only that carrier rows', !fareState.normalizedFareRows.some((fare) => fare.carrier === 'ヤマト') && fareState.normalizedFareRows.some((fare) => fare.carrier === '佐川') && fareState.normalizedFareRows.some((fare) => fare.carrier === '日本郵便'), { field: 'normalizedFareRows', actual: [...new Set(fareState.normalizedFareRows.map((fare) => fare.carrier))] });
  assertTruthy('deleting one carrier/service matrix keeps other matrix table', (fareState.matrixView?.tables || []).some((table) => table.carrier === '佐川' && table.service === '飛脚宅配便'), { field: 'matrixView.tables' });
  assertTruthy('deleting one carrier/service matrix keeps 日本郵便 matrix table', (fareState.matrixView?.tables || []).some((table) => table.carrier === '日本郵便' && table.service === 'ゆうパック'), { field: 'matrixView.tables' });

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

async function validateOrderFixtures() {
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
      const edgeDetected = callFunction('detectOrderCsvFormat', [Object.keys(edgeCase.rows[0] || {})]);
      assertEqual(`${platform.expected} edge.${edgeCase.label} detects platform`, edgeDetected, platform.expected, { fixture: path.relative(repoRoot, edgeCase.file), platform: platform.expected, field: 'headers' });
      const edgeResult = callFunction('importOrderCsvRows', [edgeCase.rows]);
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
    { type: 'fares', format: 'csv', headers: ['ヤマト運輸', '佐川急便 飛脚宅配便', '日本郵便 ゆうパック', '着地', '北海道', '関東', '東京', '3辺合計(cm)', '重量(kg)'], exampleSku: '60', matrixTemplate: true },
    { type: 'fares', format: 'xlsx', headers: ['ヤマト運輸', '佐川急便 飛脚宅配便', '日本郵便 ゆうパック', '着地', '北海道', '関東', '東京', '3辺合計(cm)', '重量(kg)'], exampleSku: '60', matrixTemplate: true },
  ];

  for (const testCase of cases) {
    const template = callFunction('generateImportTemplate', [testCase.type, testCase.format]);
    assertEqual(`${testCase.type} ${testCase.format} template has no errors`, template.errors.length, 0, { field: 'errors' });
    assertTruthy(`${testCase.type} ${testCase.format} template has file name`, template.fileName && template.fileName.endsWith(`.${testCase.format}`), { field: 'fileName', actual: template.fileName });
    const templateValues = testCase.matrixTemplate ? template.rows.flat() : (template.rows[0] || []);
    testCase.headers.forEach((header) => assertIncludes(`${testCase.type} ${testCase.format} template header ${header}`, templateValues, header, { field: 'headers' }));
    const exampleValues = testCase.matrixTemplate ? template.rows.flat() : (template.rows[1] || []);
    assertTruthy(`${testCase.type} ${testCase.format} template has example row`, exampleValues.includes(testCase.exampleSku), { field: 'example row', actual: exampleValues });

    if (testCase.format === 'csv') {
      const parsedRows = parseCsvText(template.csvText);
      assertTruthy(`${testCase.type} csv template can be parsed for upload`, parsedRows.length > 0, { field: 'csvText', actual: parsedRows.length });
      if (testCase.matrixTemplate) {
        const rawRows = template.rows;
        const format = callFunction('detectFareTableFormat', [rawRows[0] || [], rawRows]);
        const matrixView = callFunction('createMatrixView', [rawRows, 'ヤマト', '宅急便']);
        const normalizedRows = callFunction('normalizeFareMatrix', [rawRows, 'ヤマト', '宅急便']);
        assertEqual(`${testCase.type} csv template parses as matrix`, format, 'matrix', { field: 'fareFormat' });
        assertTruthy(`${testCase.type} csv template includes three carrier matrices`, ['ヤマト', '佐川', '日本郵便'].every((carrier) => normalizedRows.some((fare) => fare.carrier === carrier)), { field: 'normalizedFareRows', actual: [...new Set(normalizedRows.map((fare) => fare.carrier))] });
        resetImportIssues();
        const issues = callFunction('recordFareImportIssues', [rawRows, format, matrixView, normalizedRows, template.fileName]);
        assertEqual(`${testCase.type} csv template upload warningCount is 0`, issues.length, 0, { field: 'warningCount', actual: issues });
        assertEqual(`${testCase.type} csv template upload unresolvedIssues is 0`, getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });
      }
    } else {
      assertEqual(`${testCase.type} xlsx template Sheet1 name`, template.sheets[0]?.name, '入力データ', { field: 'sheetName' });
      assertEqual(`${testCase.type} xlsx template Sheet2 name`, template.sheets[1]?.name, '入力説明', { field: 'sheetName' });
      ctx.__templateBuffer = template.arrayBuffer;
      const sheetNames = await vm.runInContext('unzipXlsxEntries(__templateBuffer).then((entries) => parseWorkbookSheets(entries).map((sheet) => sheet.name))', ctx);
      assertEqual(`${testCase.type} xlsx workbook contains Japanese sheet names`, JSON.stringify(sheetNames), JSON.stringify(['入力データ', '入力説明']), { field: 'sheetName', actual: sheetNames });
      const parsed = await vm.runInContext('parseXlsxArrayBuffer(__templateBuffer)', ctx);
      const parsedHeaders = Object.keys(parsed.rows[0] || {});
      assertTruthy(`${testCase.type} xlsx template can be parsed for upload`, parsed.rows.length > 0, { field: 'rows', actual: parsed.rows.length });
      if (testCase.matrixTemplate) {
        const parsedValues = (parsed.rawRows || []).flat();
        testCase.headers.forEach((header) => assertIncludes(`${testCase.type} xlsx parsed matrix value ${header}`, parsedValues, header, { field: 'rawRows' }));
        const matrixView = callFunction('createMatrixView', [parsed.rawRows, 'ヤマト', '宅急便']);
        const format = callFunction('detectFareTableFormat', [parsed.rawRows[0] || [], parsed.rawRows]);
        const normalizedRows = callFunction('normalizeFareMatrix', [parsed.rawRows, 'ヤマト', '宅急便']);
        assertTruthy(`${testCase.type} xlsx template parses as real matrix`, matrixView?.rows?.length > 0, { field: 'matrixView' });
        assertTruthy(`${testCase.type} xlsx template includes three carrier matrices`, ['ヤマト', '佐川', '日本郵便'].every((carrier) => normalizedRows.some((fare) => fare.carrier === carrier)), { field: 'normalizedFareRows', actual: [...new Set(normalizedRows.map((fare) => fare.carrier))] });
        resetImportIssues();
        const issues = callFunction('recordFareImportIssues', [parsed.rawRows, format, matrixView, normalizedRows, template.fileName]);
        assertEqual(`${testCase.type} xlsx template upload warningCount is 0`, issues.length, 0, { field: 'warningCount', actual: issues });
        assertEqual(`${testCase.type} xlsx template upload unresolvedIssues is 0`, getOpenImportIssuesFromDashboard().length, 0, { field: 'unresolvedIssues' });
      } else {
        testCase.headers.forEach((header) => assertIncludes(`${testCase.type} xlsx parsed header ${header}`, parsedHeaders, vm.runInContext(`normalizeHeader(${JSON.stringify(header)})`, ctx), { field: 'headers' }));
      }
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
  const ordersHtml = readText(path.join(repoRoot, 'orders.html'));
  assertEqual('orders page duplicate Excel import section removed', (ordersHtml.match(/注文Excel取込/g) || []).length, 0, { fixture: 'orders.html' });
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
  const queueRowMarkup = callFunction('renderCompactShipmentQueueRow', [{ ...shipmentGroups[0], shipmentStatus: 'pending' }]);
  assertTruthy('P0-3 shipment queue compact row still renders grouped columns', (queueRowMarkup.match(/<td/g) || []).length === 6 && queueRowMarkup.includes('shipment-status-actions'), { field: 'shipmentQueueMarkup' });
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
