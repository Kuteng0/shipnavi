const storage = {
  read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const keys = {
  products: 'shipnaviDashboardProducts',
  carriers: 'shipnaviDashboardCarriers',
  orders: 'shipnaviDashboardOrders',
  fareTables: 'shipnaviDashboardFareTables',
  templates: 'shipnaviDashboardTemplates',
  templateMappings: 'shipnaviDashboardTemplateMappings',
  resultSnapshots: 'shipnaviDashboardResultSnapshots',
  settings: 'shipnaviDashboardSettings',
  importIssues: 'shipnaviDashboardImportIssues',
  shipmentStatuses: 'shipnaviDashboardShipmentStatuses',
};

const supportedCarriers = ['ヤマト', '佐川', '日本郵便'];
const shippingSizes = [60, 80, 100, 120, 140, 160];

const emptyData = {
  products: [],
  carriers: [],
  orders: [],
  fareTables: { matrixView: null, normalizedFareRows: [] },
  templates: [],
  templateMappings: [],
  resultSnapshots: [],
  settings: { company: 'ShipNavi', email: 'shipping@example.jp', defaultCarrier: 'ヤマト', cutoffTime: '15:00' },
  importIssues: [],
  shipmentStatuses: {},
};

function seedDashboardData() {
  Object.entries(keys).forEach(([name, key]) => {
    if (!localStorage.getItem(key)) storage.write(key, emptyData[name]);
  });
}

function getData(name) {
  return storage.read(keys[name], emptyData[name] || []);
}

function setData(name, value) {
  storage.write(keys[name], value);
}

function normalizeIssueStatus(status) {
  return ['open', 'dismissed', 'resolved'].includes(status) ? status : 'open';
}

function normalizeIssueSuggestion(issueId, issueType, suggestion = null) {
  if (!suggestion) return null;
  return {
    issueId,
    issueType,
    sourceField: normalize(suggestion.sourceField),
    detectedColumn: normalize(suggestion.detectedColumn),
    suggestedField: normalize(suggestion.suggestedField),
    suggestedValue: suggestion.suggestedValue ?? null,
    confidence: Number.isFinite(Number(suggestion.confidence)) ? Number(suggestion.confidence) : 0,
    reason: normalize(suggestion.reason),
    status: normalize(suggestion.status || 'pending') || 'pending',
  };
}

function normalizeImportIssue(issue = {}) {
  const now = new Date().toISOString();
  const id = normalize(issue.id) || makeId('issue');
  const type = normalize(issue.type) || 'import_warning';
  return {
    id,
    type,
    severity: normalize(issue.severity) || 'warning',
    sourceFlow: normalize(issue.sourceFlow),
    sourceFileName: normalize(issue.sourceFileName),
    sourcePlatform: normalize(issue.sourcePlatform),
    rowNumber: issue.rowNumber ?? '',
    field: normalize(issue.field),
    detectedColumn: normalize(issue.detectedColumn),
    message: normalize(issue.message) || '未解決の取込エラーがあります。',
    status: normalizeIssueStatus(issue.status),
    createdAt: normalize(issue.createdAt) || now,
    updatedAt: normalize(issue.updatedAt) || now,
    suggestion: normalizeIssueSuggestion(id, type, issue.suggestion),
  };
}

function getImportIssues() {
  const issues = getData('importIssues');
  return Array.isArray(issues) ? issues.map(normalizeImportIssue) : [];
}

function setImportIssues(issues) {
  setData('importIssues', Array.isArray(issues) ? issues.map(normalizeImportIssue) : []);
}

function addImportIssue(issue) {
  const normalizedIssue = normalizeImportIssue(issue);
  setImportIssues([...getImportIssues(), normalizedIssue]);
  return normalizedIssue;
}

function updateImportIssueStatus(issueId, status) {
  const now = new Date().toISOString();
  const normalizedStatus = normalizeIssueStatus(status);
  setImportIssues(getImportIssues().map((issue) => (
    issue.id === issueId ? { ...issue, status: normalizedStatus, updatedAt: now } : issue
  )));
}

function updateAllOpenImportIssueStatuses(status) {
  const now = new Date().toISOString();
  const normalizedStatus = normalizeIssueStatus(status);
  setImportIssues(getImportIssues().map((issue) => (
    issue.status === 'open' ? { ...issue, status: normalizedStatus, updatedAt: now } : issue
  )));
}

function dismissImportIssue(issueId) {
  updateImportIssueStatus(issueId, 'dismissed');
}

function resolveImportIssue(issueId) {
  updateImportIssueStatus(issueId, 'resolved');
}

function getOpenImportIssues() {
  return getImportIssues().filter((issue) => issue.status === 'open');
}

function clearResolvedImportIssues() {
  setImportIssues(getImportIssues().filter((issue) => issue.status !== 'resolved'));
}

function makeImportSuggestion(issueType, options = {}) {
  return {
    issueId: options.issueId || '',
    issueType,
    sourceField: options.sourceField || '',
    detectedColumn: options.detectedColumn || '',
    suggestedField: options.suggestedField || '',
    suggestedValue: options.suggestedValue ?? null,
    confidence: options.confidence ?? 0,
    reason: options.reason || '',
    status: options.status || 'pending',
  };
}

function isValidPostalFormat(value) {
  const digits = normalizePostal(value).replace(/[^0-9]/g, '');
  return digits.length === 7;
}

function appendImportIssue(issue) {
  const addedIssue = addImportIssue({ severity: 'warning', status: 'open', ...issue });
  renderGlobalImportIssues();
  return addedIssue;
}

function getImportIssueSourceHref(issue) {
  if (issue.sourceFlow === 'product_import') return 'products.html';
  if (issue.sourceFlow === 'order_import') return 'orders.html';
  if (issue.sourceFlow === 'fare_import') return 'carriers.html';
  return 'index.html';
}

function renderImportIssuePanelHtml(issues) {
  if (!issues.length) return '';
  const issueRows = issues.map((issue) => {
    const meta = [issue.sourcePlatform, issue.sourceFileName, issue.rowNumber ? `${issue.rowNumber}行目` : '', issue.field]
      .filter(Boolean)
      .map(escapeHtml)
      .join(' / ');
    const suggestion = issue.suggestion?.reason ? `<p class="muted">修正候補があります。${escapeHtml(issue.suggestion.reason)} 自動修正はまだ利用できません。今後のバージョンで対応予定です。</p>` : '';
    return `
      <article class="panel issue-item">
        <p><strong>${escapeHtml(issue.message)}</strong></p>
        ${meta ? `<p class="muted">${meta}</p>` : ''}
        ${suggestion}
        <div class="button-row compact-actions">
          <a class="button secondary compact-button" href="${escapeHtml(getImportIssueSourceHref(issue))}">問題の画面を開く</a>
          <button class="button secondary compact-button" type="button" data-dismiss-import-issue="${escapeHtml(issue.id)}">この警告を閉じる</button>
        </div>
      </article>
    `;
  }).join('');
  return `
    <section class="panel full-width import-issue-panel" id="global-import-issues">
      <details open>
        <summary>
          <span>未解決の取込エラーがあります。</span>
          <strong>未解決 ${issues.length}件</strong>
          <span class="issue-panel-actions">
            <button class="small-button" type="button" data-dismiss-all-import-issues="true">すべて閉じる</button>
            <button class="small-button" type="button" data-resolve-all-import-issues="true">すべて解決済みにする</button>
            <button class="small-button" type="button" data-dismiss-visible-import-issues="true">表示中のエラーを閉じる</button>
          </span>
        </summary>
        <p class="issue-panel-help">商品コード・重量・郵便番号・配送地域・列名など、取込後に確認が必要な警告です。操作しても警告履歴は削除されず、ステータスのみ更新されます。</p>
        <div class="issue-list">${issueRows}</div>
      </details>
    </section>
  `;
}

function renderGlobalImportIssues() {
  if (typeof document === 'undefined' || !document.querySelector) return;
  const anchor = document.querySelector('.app-main') || document.querySelector('main') || document.querySelector('.app-topbar')?.parentElement;
  if (!anchor) return;
  document.querySelector('#global-import-issues')?.remove();
  const html = renderImportIssuePanelHtml(getOpenImportIssues());
  if (!html) return;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const panel = holder.firstElementChild;
  if (!panel) return;
  anchor.prepend(panel);
}

function initImportIssueActions() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('click', (event) => {
    const target = event.target;
    const issueId = target?.dataset?.dismissImportIssue;
    if (target?.dataset?.dismissAllImportIssues || target?.dataset?.dismissVisibleImportIssues) {
      event.preventDefault();
      updateAllOpenImportIssueStatuses('dismissed');
      renderGlobalImportIssues();
      showToast('未解決の取込エラーを閉じました。');
      return;
    }
    if (target?.dataset?.resolveAllImportIssues) {
      event.preventDefault();
      updateAllOpenImportIssueStatuses('resolved');
      renderGlobalImportIssues();
      showToast('未解決の取込エラーを解決済みにしました。');
      return;
    }
    if (!issueId) return;
    event.preventDefault();
    dismissImportIssue(issueId);
    renderGlobalImportIssues();
    showToast('取込エラーを閉じました。');
  });
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeSize(value) {
  const match = normalize(value).match(/\d+/);
  return match ? match[0] : '';
}

function normalizeCarrier(value) {
  const text = normalize(value);
  return supportedCarriers.find((carrier) => text.includes(carrier)) || text;
}

function toNumber(value) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseWeightLimitValue(value) {
  const text = normalize(value).toLowerCase();
  const numeric = toNumber(text);
  if (!numeric) return '';
  return String(/kg|キロ/.test(text) ? Math.round(numeric * 1000) : numeric);
}

function formatYen(value) {
  return `¥${Math.round(toNumber(value)).toLocaleString('ja-JP')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function parseCsv(text) {
  const sanitizedText = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < sanitizedText.length; index += 1) {
    const char = sanitizedText[index];
    const next = sanitizedText[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);

  const headers = (rows.shift() || []).map((header) => normalizeHeader(header));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(','))].join('\r\n');
}

function downloadCsv(fileName, rows) {
  const csv = buildCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadBlob(fileName, blob) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  if (document.body?.appendChild) document.body.appendChild(link);
  link.click();
  if (link.remove) link.remove();
  URL.revokeObjectURL(link.href);
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function encodeUtf8(text) {
  return new TextEncoder().encode(String(text));
}

function buildZip(entries) {
  const output = [];
  const central = [];
  let offset = 0;
  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.name);
    const dataBytes = encodeUtf8(entry.content);
    const checksum = crc32(dataBytes);
    const localOffset = offset;
    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0x0800);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint32(output, checksum);
    writeUint32(output, dataBytes.length);
    writeUint32(output, dataBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...dataBytes);
    offset = output.length;

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0x0800);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, checksum);
    writeUint32(central, dataBytes.length);
    writeUint32(central, dataBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, localOffset);
    central.push(...nameBytes);
  });
  const centralOffset = output.length;
  output.push(...central);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, entries.length);
  writeUint16(output, entries.length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);
  return new Uint8Array(output).buffer;
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function worksheetXml(rows) {
  const sheetData = rows.map((row, rowIndex) => `
    <row r="${rowIndex + 1}">${row.map((value, cellIndex) => `<c r="${columnName(cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`;
}

function buildXlsxWorkbook(sheets) {
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const relationships = sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const sheetContentTypes = sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const entries = [
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetContentTypes}</Types>` },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>` },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet.rows) })),
  ];
  return buildZip(entries);
}

function templateRowsFor(type) {
  const productRows = [
    ['SKU', '商品名', '重量', 'サイズ', '長さ', '幅', '高さ', '同梱可否', '注意事項'],
    ['SKU-001', 'サンプル商品', '500', '60', '20', '15', '10', '可', '重量はg、寸法はcmで入力してください。'],
  ];
  const orderRows = [
    ['注文番号', '顧客名', '郵便番号', '配送先住所', 'SKU', '数量', 'プラットフォーム', '注意事項'],
    ['ORD-001', '匿名顧客A', '100-0001', '東京都千代田区匿名1-1-1', 'SKU-001', '1', 'ShipNavi標準', '個人情報は匿名化してからアップロードしてください。'],
  ];
  const fareRows = [
    ['サイズ', '重量', '東京', '関東', '関西', '九州', '沖縄'],
    ['60', '2kg', '850', '900', '950', '1100', '1300'],
    ['80', '5kg', '1050', '1100', '1200', '1400', '1700'],
  ];
  if (type === 'products') return productRows;
  if (type === 'orders') return orderRows;
  if (type === 'fares') return fareRows;
  return [];
}

function templateDescriptionRows(type) {
  const common = [
    ['項目', '説明'],
    ['入力データ', '1枚目の入力データにサンプル行を残したまま、値を置き換えてアップロードできます。'],
    ['CSV', 'CSVテンプレートはダウンロード後、そのまま再アップロードして取込テストできます。'],
  ];
  if (type === 'products') {
    return [
      ...common,
      ['SKU', '商品を一意に識別するコードです。商品コード、品番、商品IDからの自動判定にも対応します。'],
      ['重量', 'gまたはkgで入力できます。単位が不明な場合は取込時に警告します。'],
      ['サイズ', '60/80/100/120/140/160サイズを入力します。長さ・幅・高さから自動判定できます。'],
      ['同梱可否', '可、不可、はい、いいえなどを入力します。'],
    ];
  }
  if (type === 'orders') {
    return [
      ...common,
      ['ShipNavi標準', '注文番号、顧客名、郵便番号、配送先住所、SKU、数量を基本項目として取り込みます。'],
      ['楽天', '注文番号、注文者名字、注文者名前、送付先郵便番号、送付先住所、商品番号、商品名、個数を自動判定します。'],
      ['Yahoo', '注文ID、お届け先氏名、郵便番号、住所、商品コード、商品名、数量を自動判定します。'],
      ['Amazon', '注文番号、宛先氏名、郵便番号、配送先住所、SKU、商品名、数量を自動判定します。'],
      ['Shopify', '注文番号、配送先氏名、郵便番号、配送先住所、SKU、数量を自動判定します。'],
      ['BASE', '注文ID、購入者名、郵便番号、住所、商品コード、商品名、数量を自動判定します。'],
      ['STORES', 'オーダー番号、購入者名、郵便番号、都道府県、市区町村、住所1、品番、数量を自動判定します。'],
      ['メルカリShops', '取引ID、お届け先氏名、郵便番号、お届け先住所、商品コード、数量を自動判定します。'],
    ];
  }
  return [
    ...common,
    ['マトリクス形式', 'サイズ、重量、地域列（東京、関東、関西など）を横持ちで入力します。'],
    ['縦持ち形式', '配送会社、サービス、配送サイズ、配送地域、送料、重量上限を縦持ちで入力できます。'],
    ['注意事項', '金額は数字、¥、円、カンマを含めて入力できます。重量上限はkgまたはgで入力してください。'],
  ];
}

function generateImportTemplate(type, format) {
  const normalizedType = normalize(type);
  const normalizedFormat = normalize(format).toLowerCase();
  const rows = templateRowsFor(normalizedType);
  const descriptionRows = templateDescriptionRows(normalizedType);
  const prefix = { products: '商品マスタ', orders: '注文データ', fares: '送料マトリクス' }[normalizedType] || '取込';
  if (!rows.length || !['csv', 'xlsx'].includes(normalizedFormat)) {
    return { type: normalizedType, format: normalizedFormat, fileName: '', rows: [], sheets: [], errors: ['テンプレート種別を確認してください。'] };
  }
  const fileName = `shipnavi-${normalizedType}-template.${normalizedFormat}`;
  const sheets = [
    { name: '入力データ', rows },
    { name: '入力説明', rows: descriptionRows },
  ];
  if (normalizedFormat === 'csv') {
    return { type: normalizedType, format: 'csv', fileName, rows, sheets: [sheets[0]], csvText: rows.map((row) => row.map(csvValue).join(',')).join('\r\n'), errors: [] };
  }
  return { type: normalizedType, format: 'xlsx', fileName, rows, sheets, arrayBuffer: buildXlsxWorkbook(sheets), errors: [], label: prefix };
}

function downloadImportTemplate(type, format) {
  const template = generateImportTemplate(type, format);
  if (template.errors?.length) return showToast(template.errors.join(' '));
  if (template.format === 'csv') {
    downloadBlob(template.fileName, new Blob([`\uFEFF${template.csvText}`], { type: 'text/csv;charset=utf-8' }));
  } else {
    downloadBlob(template.fileName, new Blob([template.arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
  showToast(`${template.label || '取込'}${template.format.toUpperCase()}テンプレートをダウンロードしました。`);
}

function readFileAsText(file, callback) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(String(reader.result || '').replace(/^\uFEFF/, '')));
  reader.readAsText(file);
}

function readFileAsArrayBuffer(file, callback, errorCallback = () => {}) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.addEventListener('error', () => errorCallback('ファイルを読み込めませんでした。'));
  reader.readAsArrayBuffer(file);
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .replace(/[【】「」『』]/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[：]/g, ':')
    .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .trim()
    .toLowerCase();
}

function compactText(value) {
  return String(value ?? '').replace(/[\s\u3000]+/g, ' ').trim();
}

function normalizePostal(value) {
  return compactText(value).replace(/^〒/, '');
}

function normalizeJapaneseAddress(parts) {
  return parts.map((part) => compactText(part)).filter(Boolean).join('');
}

function isImageFile(file) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file?.name || '');
}

function isExcelFile(file) {
  return /\.(xlsx|xls)$/i.test(file?.name || '');
}

const XLS_SUPPORTED = false;
const XLSX_SUPPORTED = true;

function isXlsFile(file) {
  return /\.xls$/i.test(file?.name || '') && !/\.xlsx$/i.test(file?.name || '');
}

function isXlsxFile(file) {
  return /\.xlsx$/i.test(file?.name || '');
}

function createImportFileResult({ rows = [], sourceType = '', sheetName = '', warnings = [], errors = [] } = {}) {
  return { rows, sourceType, sheetName, warnings, errors };
}

function excelFormatErrorResult(sourceType = 'xls') {
  return createImportFileResult({
    sourceType,
    errors: ['Excelファイルの形式を確認してください。XLSX形式で保存して再度アップロードしてください。'],
  });
}

function xmlDecode(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getXmlAttribute(tag, name) {
  const match = String(tag || '').match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? xmlDecode(match[1]) : '';
}

function columnIndexFromCellRef(ref) {
  const letters = String(ref || '').match(/^[A-Z]+/i)?.[0] || '';
  return letters.toUpperCase().split('').reduce((sum, letter) => (sum * 26) + letter.charCodeAt(0) - 64, 0) - 1;
}

function trimEmptyTrailingCells(row) {
  const next = [...row];
  while (next.length && !normalize(next[next.length - 1])) next.pop();
  return next;
}

async function inflateZipEntry(bytes, method) {
  if (method === 0) return bytes;
  if (method !== 8 || typeof DecompressionStream === 'undefined') {
    throw new Error('unsupported_zip_compression');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipXlsxEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error('xlsx_zip_end_not_found');
  const totalEntries = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries = {};

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) throw new Error('xlsx_central_directory_invalid');
    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const nameStart = centralOffset + 46;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('xlsx_local_header_invalid');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    entries[name] = decoder.decode(await inflateZipEntry(compressed, method));
    centralOffset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseSharedStrings(xml = '') {
  return [...String(xml).matchAll(/<si[\s\S]*?<\/si>/g)].map(([si]) => (
    [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => xmlDecode(match[1])).join('')
  ));
}

function parseWorkbookSheets(entries) {
  const workbook = entries['xl/workbook.xml'] || '';
  const rels = entries['xl/_rels/workbook.xml.rels'] || '';
  const relMap = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
    getXmlAttribute(tag, 'Id'),
    getXmlAttribute(tag, 'Target').replace(/^\//, ''),
  ]));
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map(([tag], index) => {
    const relId = getXmlAttribute(tag, 'r:id');
    const target = relMap[relId] || `worksheets/sheet${index + 1}.xml`;
    return {
      name: getXmlAttribute(tag, 'name') || `Sheet${index + 1}`,
      path: target.startsWith('xl/') ? target : `xl/${target}`,
    };
  });
}

function parseWorksheetRows(xml = '', sharedStrings = []) {
  return [...String(xml).matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)]
    .map(([rowXml]) => {
      const row = [];
      [...rowXml.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)].forEach(([cellXml]) => {
        const openTag = cellXml.match(/<c\b[^>]*>/)?.[0] || '';
        const cellType = getXmlAttribute(openTag, 't');
        const ref = getXmlAttribute(openTag, 'r');
        const colIndex = Math.max(0, columnIndexFromCellRef(ref));
        let value = '';
        if (cellType === 's') {
          const sharedIndex = toNumber(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]);
          value = sharedStrings[sharedIndex] || '';
        } else if (cellType === 'inlineStr') {
          value = [...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => xmlDecode(match[1])).join('');
        } else {
          value = xmlDecode(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '');
        }
        row[colIndex] = normalize(value);
      });
      return trimEmptyTrailingCells(row);
    })
    .filter((row) => row.some((value) => normalize(value)));
}

function rowsArrayToObjects(rowArrays) {
  const headerIndex = rowArrays.findIndex((row) => row.filter((value) => normalize(value)).length > 1 && !normalize(row[0]).startsWith('#'));
  const headers = (rowArrays[Math.max(0, headerIndex)] || []).map((header) => normalizeHeader(header));
  return rowArrays.slice(Math.max(0, headerIndex) + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

async function parseXlsxArrayBuffer(arrayBuffer) {
  const entries = await unzipXlsxEntries(arrayBuffer);
  const sharedStrings = parseSharedStrings(entries['xl/sharedStrings.xml'] || '');
  const sheets = parseWorkbookSheets(entries);
  const warnings = [];
  for (const sheet of sheets.length ? sheets : [{ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' }]) {
    const rowArrays = parseWorksheetRows(entries[sheet.path] || '', sharedStrings);
    if (!rowArrays.length) continue;
    return createImportFileResult({ rows: rowsArrayToObjects(rowArrays), sourceType: 'xlsx', sheetName: sheet.name, warnings });
  }
  return createImportFileResult({ sourceType: 'xlsx', warnings, errors: ['Excelファイルに読み込めるシートがありません。'] });
}

function readImportFile(file, options = {}, callback = () => {}) {
  if (!file) return callback(createImportFileResult({ errors: ['ファイルを選択してください。'] }));
  if (isXlsFile(file)) return callback(excelFormatErrorResult('xls'));
  if (isXlsxFile(file)) {
    return readFileAsArrayBuffer(file, (arrayBuffer) => {
      parseXlsxArrayBuffer(arrayBuffer)
        .then(callback)
        .catch(() => callback(excelFormatErrorResult('xlsx')));
    }, (message) => callback(createImportFileResult({ sourceType: 'xlsx', errors: [message] })));
  }
  return readFileAsText(file, (text) => callback(createImportFileResult({ rows: parseCsv(text), sourceType: 'csv', sheetName: '', warnings: [], errors: [] })));
}

function normalizeMatrixView(view) {
  if (!view || typeof view !== 'object') return null;
  const zoneHeaders = Array.isArray(view.zoneHeaders) ? view.zoneHeaders.map((zone) => compactText(zone)).filter(Boolean) : [];
  return {
    carrier: normalizeCarrier(view.carrier || 'ヤマト'),
    service: normalize(view.service || '宅急便'),
    sizeLabel: compactText(view.sizeLabel || 'サイズ') || 'サイズ',
    weightLabel: compactText(view.weightLabel || '重量') || '重量',
    zoneHeaders,
    rows: Array.isArray(view.rows) ? view.rows.map((row) => ({
      size: normalizeSize(row?.size),
      weight: normalize(row?.weight) ? parseWeightLimitValue(row?.weight) : '',
      fares: Object.fromEntries(zoneHeaders.map((zone) => [zone, normalize(row?.fares?.[zone]) ? String(toNumber(row?.fares?.[zone])) : ''])),
    })).filter((row) => row.size || row.weight || Object.values(row.fares).some((fare) => toNumber(fare) > 0)) : [],
  };
}

function normalizeFareTableState(raw) {
  if (Array.isArray(raw)) {
    return { matrixView: null, normalizedFareRows: raw.map(normalizeFare).filter((fare) => fare.size && toNumber(fare.fare) > 0) };
  }
  if (raw && typeof raw === 'object') {
    const matrixView = normalizeMatrixView(raw.matrixView);
    const normalizedFareRows = Array.isArray(raw.normalizedFareRows) && raw.normalizedFareRows.length
      ? raw.normalizedFareRows.map(normalizeFare).filter((fare) => fare.size && toNumber(fare.fare) > 0)
      : (matrixView ? normalizeFareMatrix(matrixView) : []);
    return { matrixView, normalizedFareRows };
  }
  return { matrixView: null, normalizedFareRows: [] };
}

function getFareTableState() {
  return normalizeFareTableState(getData('fareTables'));
}

function setFareTableState(matrixView, normalizedFareRows) {
  setData('fareTables', normalizeFareTableState({ matrixView, normalizedFareRows }));
}

function requireColumns(rows, columns) {
  const headers = Object.keys(rows[0] || {});
  return columns.filter((column) => !headers.includes(column));
}

function hasHeaders(headers, requiredHeaders) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return requiredHeaders.every((header) => normalizedHeaders.includes(normalizeHeader(header)));
}

function hasAnyHeader(headers, candidateHeaders) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return candidateHeaders.some((header) => normalizedHeaders.includes(normalizeHeader(header)));
}

function fieldCandidate(raw) {
  return typeof raw === 'string' ? { fields: [raw], join: '' } : raw;
}

function headerSet(headers) {
  return new Set(headers.map((header) => normalizeHeader(header)));
}

const standardOrderFields = ['orderNo', 'customer', 'address', 'sku', 'quantity'];

const platformFieldMappings = {
  'ShipNavi標準': {
    requiredSignals: ['orderno', 'customer', 'address', 'sku', 'quantity'],
    optionalSignals: ['postal', 'sourceplatform', '注文番号', '顧客名', '郵便番号', '配送先住所', '数量'],
    fieldCandidates: {
      orderNo: ['orderNo', '注文番号'],
      customer: ['customer', '顧客名'],
      postal: ['postal', '郵便番号'],
      address: ['address', '配送先住所'],
      sku: ['sku', 'SKU'],
      quantity: ['quantity', '数量'],
    },
  },
  '楽天': {
    requiredSignals: ['注文番号', '個数'],
    optionalSignals: ['注文者名字', '注文者名前', '送付先氏名', '送付先郵便番号', '送付先住所:都道府県', '送付先住所:都市区', '送付先住所:町以降', '送付先住所', '商品番号', '商品管理番号', '商品名'],
    fieldCandidates: {
      orderNo: ['注文番号'],
      customer: [{ fields: ['注文者名字', '注文者名前'], join: '' }, '送付先氏名'],
      postal: ['送付先郵便番号'],
      address: [{ fields: ['送付先住所:都道府県', '送付先住所:都市区', '送付先住所:町以降'], join: '' }, '送付先住所'],
      sku: ['商品番号', '商品管理番号'],
      productName: ['商品名'],
      quantity: ['個数'],
    },
  },
  Amazon: {
    requiredSignals: ['order-id', 'quantity-purchased'],
    optionalSignals: ['buyer-email', 'recipient-name', 'ship-postal-code', 'ship-state', 'ship-city', 'ship-address-1', 'sku', 'product-name'],
    fieldCandidates: {
      orderNo: ['order-id'],
      customer: ['buyer-email', 'recipient-name'],
      postal: ['ship-postal-code'],
      address: [
        { fields: ['ship-state', 'ship-city', 'ship-address-1'], join: '' },
        { fields: ['ship-state', 'ship-city'], join: '' },
      ],
      sku: ['sku'],
      productName: ['product-name'],
      quantity: ['quantity-purchased'],
    },
  },
  'Yahooショッピング': {
    requiredSignals: ['注文id', '数量'],
    optionalSignals: ['お届け先氏名', '郵便番号', '住所', '商品コード'],
    fieldCandidates: {
      orderNo: ['注文ID'],
      customer: ['お届け先氏名'],
      postal: ['郵便番号'],
      address: ['住所'],
      sku: ['商品コード'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
  Shopify: {
    requiredSignals: ['name', 'lineitem quantity'],
    optionalSignals: ['shipping name', 'shipping zip', 'shipping province', 'shipping city', 'shipping address1', 'lineitem sku'],
    fieldCandidates: {
      orderNo: ['Name'],
      customer: ['Shipping Name'],
      postal: ['Shipping Zip'],
      address: [
        { fields: ['Shipping Province', 'Shipping City', 'Shipping Address1'], join: '' },
        { fields: ['Shipping Province', 'Shipping City'], join: '' },
        'Shipping Address1',
      ],
      sku: ['Lineitem sku'],
      productName: ['Lineitem name'],
      quantity: ['Lineitem quantity'],
    },
  },
  BASE: {
    requiredSignals: ['注文id', '数量'],
    optionalSignals: ['購入者名', '郵便番号', '住所', '商品コード'],
    fieldCandidates: {
      orderNo: ['注文ID'],
      customer: ['購入者名'],
      postal: ['郵便番号'],
      address: ['住所'],
      sku: ['商品コード'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
  MakeShop: {
    requiredSignals: ['注文番号', '数量'],
    optionalSignals: ['送付先名', '送付先郵便番号', '送付先住所', '商品コード'],
    fieldCandidates: {
      orderNo: ['注文番号'],
      customer: ['送付先名'],
      postal: ['送付先郵便番号'],
      address: ['送付先住所'],
      sku: ['商品コード'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
  'カラーミー': {
    requiredSignals: ['受注番号', '数量'],
    optionalSignals: ['お名前', '郵便番号', '住所', '商品型番'],
    fieldCandidates: {
      orderNo: ['受注番号'],
      customer: ['お名前'],
      postal: ['郵便番号'],
      address: ['住所'],
      sku: ['商品型番'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
  STORES: {
    requiredSignals: ['オーダー番号', '数量'],
    optionalSignals: ['購入者名', '郵便番号', '都道府県', '市区町村', '住所1', '品番', '品番候補'],
    fieldCandidates: {
      orderNo: ['オーダー番号'],
      customer: ['購入者名'],
      postal: ['郵便番号'],
      address: [
        { fields: ['都道府県', '市区町村', '住所1'], join: '' },
        { fields: ['都道府県', '市区町村'], join: '' },
        '住所1',
      ],
      sku: ['品番', '品番候補'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
  'メルカリShops': {
    requiredSignals: ['取引id', '数量'],
    optionalSignals: ['お届け先氏名', '郵便番号', 'お届け先住所', '商品コード', '商品コード候補'],
    fieldCandidates: {
      orderNo: ['取引ID'],
      customer: ['お届け先氏名'],
      postal: ['郵便番号'],
      address: ['お届け先住所'],
      sku: ['商品コード', '商品コード候補'],
      productName: ['商品名'],
      quantity: ['数量'],
    },
  },
};

function hasResolvableField(headers, candidates) {
  const normalizedHeaders = headerSet(headers);
  return (candidates || []).some((candidate) => {
    const resolved = fieldCandidate(candidate);
    return resolved.fields.every((field) => normalizedHeaders.has(normalizeHeader(field)));
  });
}

function detectOrderCsvFormat(headers) {
  const candidates = Object.entries(platformFieldMappings)
    .map(([platform, config]) => {
      const normalizedHeaders = headerSet(headers);
      const requiredMatches = (config.requiredSignals || []).filter((signal) => normalizedHeaders.has(normalizeHeader(signal))).length;
      const optionalMatches = (config.optionalSignals || []).filter((signal) => normalizedHeaders.has(normalizeHeader(signal))).length;
      const fieldCoverage = standardOrderFields.filter((field) => hasResolvableField(headers, config.fieldCandidates?.[field] || []) || (field === 'sku' && hasResolvableField(headers, config.fieldCandidates?.productName || []))).length;
      return {
        platform,
        score: (requiredMatches * 5) + (optionalMatches * 2) + (fieldCoverage * 3),
        requiredMatches,
        fieldCoverage,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return 'unknown';
  const threshold = best.platform === 'ShipNavi標準' ? 18 : 12;
  return (best.score >= threshold && best.requiredMatches >= 1 && best.fieldCoverage >= 4) ? best.platform : 'unknown';
}

function getPlatformMissingHeaders(headers, platform) {
  const mapping = platformFieldMappings[platform];
  if (!mapping?.fieldCandidates) return [];
  const missing = standardOrderFields
    .flatMap((field) => {
      if (field === 'sku') {
        return hasResolvableField(headers, mapping.fieldCandidates.sku || []) || hasResolvableField(headers, mapping.fieldCandidates.productName || [])
          ? []
          : (mapping.fieldCandidates.sku || []).flatMap((candidate) => fieldCandidate(candidate).fields);
      }
      return hasResolvableField(headers, mapping.fieldCandidates[field] || [])
        ? []
        : (mapping.fieldCandidates[field] || []).flatMap((candidate) => fieldCandidate(candidate).fields);
    });
  return missing.filter((header, index, list) => list.findIndex((item) => normalizeHeader(item) === normalizeHeader(header)) === index);
}

function resolveField(row, candidates) {
  return (candidates || []).reduce((found, candidate) => {
    if (found) return found;
    const resolved = fieldCandidate(candidate);
    const values = resolved.fields.map((field) => compactText(row[normalizeHeader(field)]));
    return values.every(Boolean) ? values.join(resolved.join ?? '') : '';
  }, '');
}

function normalizePlatformOrderRow(row, platform) {
  const mapping = platformFieldMappings[platform];
  const orderNo = resolveField(row, mapping?.fieldCandidates?.orderNo || []);
  const customer = resolveField(row, mapping?.fieldCandidates?.customer || []);
  const postal = normalizePostal(resolveField(row, mapping?.fieldCandidates?.postal || []));
  const address = compactText(resolveField(row, mapping?.fieldCandidates?.address || []));
  let sku = resolveField(row, mapping?.fieldCandidates?.sku || []);
  const productName = resolveField(row, mapping?.fieldCandidates?.productName || []);
  const rawQuantity = resolveField(row, mapping?.fieldCandidates?.quantity || []);
  const numericQuantity = toNumber(rawQuantity);
  const warnings = [];

  if (!customer) warnings.push('顧客名未設定');
  if (!postal) warnings.push('郵便番号未設定');
  if (postal && !isValidPostalFormat(postal)) warnings.push('郵便番号形式不正');
  if (postal && isValidPostalFormat(postal) && getZoneByPostal(postal, address) === 'unknown') warnings.push('配送地域未判定');
  if (!sku && productName) {
    sku = productName;
    warnings.push('商品名をSKUとして使用');
  }
  if (!normalize(rawQuantity)) warnings.push('数量未設定');
  else if (!numericQuantity) warnings.push('数量形式不正');

  return {
    id: makeId('o'),
    orderNo,
    customer,
    postal,
    address,
    sku,
    quantity: String(Math.max(1, numericQuantity || 1)),
    sourcePlatform: platform,
    warnings,
  };
}

function hasStandardOrderFields(order) {
  return standardOrderFields.every((field) => normalize(order[field]));
}

function importOrderCsvRows(rows) {
  const headers = Object.keys(rows[0] || {});
  const platform = detectOrderCsvFormat(headers);
  if (platform === 'unknown') {
    return {
      platform: 'unknown',
      orders: [],
      successCount: 0,
      failureCount: rows.length,
      warningCount: 0,
      warningDetails: [],
      missingHeaders: [],
      detectedHeaders: headers,
      allOrders: [],
    };
  }
  const missingHeaders = getPlatformMissingHeaders(headers, platform);
  if (missingHeaders.length) {
    return {
      platform,
      orders: [],
      successCount: 0,
      failureCount: rows.length,
      warningCount: 0,
      warningDetails: [],
      missingHeaders,
      detectedHeaders: headers,
      allOrders: [],
    };
  }
  const normalizedOrders = rows.map((row) => normalizePlatformOrderRow(row, platform));
  const validOrders = normalizedOrders.filter(hasStandardOrderFields);
  const warningDetails = [...new Set(normalizedOrders.flatMap((order) => order.warnings || []))];
  return {
    platform,
    orders: validOrders,
    successCount: validOrders.length,
    failureCount: normalizedOrders.length - validOrders.length,
    warningCount: normalizedOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0),
    warningDetails,
    missingHeaders: [],
    detectedHeaders: headers,
    allOrders: normalizedOrders,
  };
}

function initAppMenu() {
  const toggle = document.querySelector('.app-menu-toggle');
  const menu = document.querySelector('#app-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.classList.toggle('is-open', !isOpen);
    menu.classList.toggle('is-open', !isOpen);
  });
}

function normalizeOrder(row) {
  return {
    id: makeId('o'),
    orderNo: normalize(row.orderNo),
    customer: normalize(row.customer),
    postal: normalizePostal(row.postal),
    address: compactText(row.address),
    sku: normalize(row.sku),
    quantity: String(Math.max(1, toNumber(row.quantity) || 1)),
    sourcePlatform: normalize(row.sourcePlatform) || 'ShipNavi',
    warnings: Array.isArray(row.warnings) ? row.warnings : (!normalizePostal(row.postal) ? ['\u90f5\u4fbf\u756a\u53f7\u672a\u8a2d\u5b9a'] : []),
  };
}

const productFieldCandidates = {
  sku: ['sku', 'SKU', '商品コード', '商品管理番号', '品番', '商品ID', '管理番号', '商品番号', '型番'],
  name: ['商品名', 'name', 'title', 'item_name', '商品名称', 'product-name', 'Product Name', '品名'],
  size: ['size', 'サイズ', '箱サイズ', '配送サイズ', 'package_size', '梱包サイズ', '入力サイズ'],
  weight: ['重量', 'weight', '重量kg', '重量(g)', 'weight_kg', 'item_weight', '商品重量', '梱包重量'],
  length: ['長さ', 'length', '奥行き', '奥行', '縦', '梱包長さ'],
  width: ['幅', 'width', '横', '梱包幅'],
  height: ['高さ', 'height', '厚さ', '梱包高さ'],
  totalSize: ['三辺', '三辺合計', '総長'],
  bundleable: ['bundleEligible', 'bundleable', '同梱', '同梱可', '同梱区分', '同梱可否'],
};

function parseProductWeight(header, value) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return { value: '', unitMismatch: false };
  const normalizedHeader = normalizeHeader(header);
  const numeric = toNumber(normalizedValue);
  if (!numeric) return { value: '', unitMismatch: true };
  const valueText = normalizedValue.toLowerCase();
  const isKg = normalizedHeader.includes('kg') || /kg|キロ/.test(valueText);
  return { value: String(Math.round(isKg ? numeric * 1000 : numeric)), unitMismatch: false };
}

function parseProductDimension(header, value) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return { value: '', unitMismatch: false, sourceUnit: '' };
  const numeric = toNumber(normalizedValue);
  if (!numeric) return { value: '', unitMismatch: true, sourceUnit: 'unknown' };
  const text = `${normalizeHeader(header)} ${normalizedValue}`.toLowerCase();
  const isMm = /mm|㎜|ミリ/.test(text);
  const isCm = /cm|センチ/.test(text);
  return {
    value: String(isMm ? numeric / 10 : numeric),
    unitMismatch: !isMm && !isCm && /[^0-9.,\s-]/.test(normalizedValue),
    sourceUnit: isMm ? 'mm' : (isCm ? 'cm' : 'cm_assumed'),
  };
}

function detectProductFieldMapping(headers) {
  return Object.fromEntries(Object.entries(productFieldCandidates).map(([field, candidates]) => [
    field,
    candidates.find((candidate) => hasAnyHeader(headers, [candidate])) || '',
  ]));
}

function detectProductImportCapability(headers, mapping) {
  const identifiedFieldCount = Object.values(mapping).filter(Boolean).length;
  const hasIdentity = Boolean(mapping.sku || mapping.name);
  return {
    identifiedFieldCount,
    hasIdentity,
    recognized: identifiedFieldCount > 0,
  };
}

function productRowIssue(type, field, message, extra = {}) {
  return { type, field, message, ...extra };
}

function normalizeProductImportRow(row, mapping) {
  const name = compactText(resolveField(row, mapping.name ? [mapping.name] : []));
  let sku = compactText(resolveField(row, mapping.sku ? [mapping.sku] : []));
  const rawSize = normalizeSize(resolveField(row, mapping.size ? [mapping.size] : []));
  const totalSizeRaw = resolveField(row, mapping.totalSize ? [mapping.totalSize] : []);
  const lengthValue = parseProductDimension(mapping.length || '', resolveField(row, mapping.length ? [mapping.length] : []));
  const widthValue = parseProductDimension(mapping.width || '', resolveField(row, mapping.width ? [mapping.width] : []));
  const heightValue = parseProductDimension(mapping.height || '', resolveField(row, mapping.height ? [mapping.height] : []));
  const totalSizeValue = parseProductDimension(mapping.totalSize || '', totalSizeRaw);
  const length = lengthValue.value;
  const width = widthValue.value;
  const height = heightValue.value;
  const dimensionTotal = toNumber(length) + toNumber(width) + toNumber(height);
  const inferredTotal = dimensionTotal > 0 ? dimensionTotal : toNumber(totalSizeValue.value);
  const inferredSize = inferredTotal > 0 ? sizeFromTotal(inferredTotal) : null;
  const computedSize = inferredSize || rawSize || '';
  const rawWeightField = mapping.weight || '';
  const weightResult = parseProductWeight(rawWeightField, resolveField(row, rawWeightField ? [rawWeightField] : []));
  const weight = weightResult.value;
  const warnings = [];
  const importIssues = [];

  if (!sku && name) {
    sku = name;
    warnings.push('商品名をSKUとして使用');
    importIssues.push(productRowIssue('missing_sku', 'sku', '商品コードが見つかりません。商品名を SKU として扱いました。', {
      detectedColumn: mapping.name || '商品名',
      suggestion: makeImportSuggestion('missing_sku', {
        sourceField: mapping.name || '商品名',
        detectedColumn: mapping.name || '商品名',
        suggestedField: 'SKU',
        suggestedValue: sku,
        confidence: 0.75,
        reason: '商品名をSKUとして利用しています。',
      }),
    }));
  }
  if (!weight) {
    warnings.push('重量未設定');
    importIssues.push(productRowIssue('missing_weight', 'weight', '重量が見つかりません。', { detectedColumn: mapping.weight || '' }));
  }
  if (weightResult.unitMismatch || [lengthValue, widthValue, heightValue, totalSizeValue].some((item) => item.unitMismatch)) {
    warnings.push('単位確認が必要');
    importIssues.push(productRowIssue('unit_mismatch', 'unit', 'サイズ単位を確認してください。'));
  }
  if (inferredSize) {
    warnings.push('三辺合計から配送サイズを自動判定');
  }
  if (rawSize && inferredSize && String(rawSize) !== String(inferredSize)) {
    warnings.push('入力サイズと自動判定サイズが不一致');
    importIssues.push(productRowIssue('size_mismatch', 'size', '入力サイズと自動判定サイズが一致しません。'));
  }
  if (inferredTotal > 160) {
    warnings.push('三辺サイズが160サイズ超過');
    importIssues.push(productRowIssue('oversized_size', 'size', '三辺サイズが160サイズを超えています。'));
  }

  return {
    id: makeId('p'),
    sku,
    name,
    size: computedSize ? String(computedSize) : '',
    weight,
    length,
    width,
    height,
    bundleable: mapping.bundleable ? !['false', '0', 'no', 'n', '不可', '不可同梱'].includes(normalize(resolveField(row, [mapping.bundleable])).toLowerCase()) : true,
    warnings,
    importIssues,
  };
}

function importProductCsvRows(rows) {
  const headers = Object.keys(rows[0] || {});
  const mapping = detectProductFieldMapping(headers);
  const capability = detectProductImportCapability(headers, mapping);
  if (!capability.recognized) {
    return {
      products: [],
      successCount: 0,
      failureCount: rows.length,
      warningCount: 0,
      warningDetails: [],
      message: '商品マスタとして認識できません',
      mapping,
      detectedHeaders: headers,
      normalizedProducts: [],
    };
  }
  if (!capability.hasIdentity) {
    return {
      products: [],
      successCount: 0,
      failureCount: rows.length,
      warningCount: 0,
      warningDetails: [],
      message: '必要な商品識別項目が見つかりません',
      mapping,
      detectedHeaders: headers,
      normalizedProducts: [],
    };
  }
  const normalizedProducts = rows.map((row) => normalizeProductImportRow(row, mapping));
  const validProducts = normalizedProducts
    .filter((product) => normalize(product.sku) || normalize(product.name))
    .map((product) => ({ ...normalizeProduct(product), warnings: product.warnings || [], importIssues: product.importIssues || [] }));
  const warningDetails = [...new Set(validProducts.flatMap((product) => product.warnings || []))];
  return {
    products: validProducts,
    successCount: validProducts.length,
    failureCount: normalizedProducts.length - validProducts.length,
    warningCount: validProducts.reduce((sum, product) => sum + (product.warnings?.length || 0), 0),
    warningDetails,
    message: '',
    mapping,
    detectedHeaders: headers,
    normalizedProducts,
  };
}

function recordProductImportIssues(importResult, sourceFileName = '', rows = []) {
  if (!importResult) return [];
  const issues = [];
  const products = Array.isArray(importResult.products) ? importResult.products : [];
  products.forEach((product, index) => {
    const rowNumber = index + 2;
    (product.importIssues || []).forEach((issue) => {
      issues.push(appendImportIssue({
        type: issue.type,
        sourceFlow: 'product_import',
        sourceFileName,
        rowNumber,
        field: issue.field,
        detectedColumn: issue.detectedColumn || '',
        message: issue.message,
        suggestion: issue.suggestion || null,
      }));
    });
  });

  const headers = importResult.detectedHeaders || Object.keys(rows[0] || {});
  const hasBundleEligibleHeader = headers.some((header) => ['bundleeligible', 'bundle eligible'].includes(normalizeHeader(header)));
  if (hasBundleEligibleHeader) {
    issues.push(appendImportIssue({
      type: 'bundle_field_mapping',
      sourceFlow: 'product_import',
      sourceFileName,
      field: 'bundleable',
      detectedColumn: 'bundleEligible',
      message: 'bundleEligible 列を同梱可否として扱いました。',
      suggestion: makeImportSuggestion('bundle_field_mapping', {
        sourceField: 'bundleEligible',
        detectedColumn: 'bundleEligible',
        suggestedField: 'bundleable',
        confidence: 0.9,
        reason: 'bundleEligible は同梱可否として利用できる可能性が高いです。',
      }),
    }));
  }
  const recognizedHeaders = Object.values(importResult.mapping || {}).filter(Boolean).map((header) => normalizeHeader(header));
  headers.filter((header) => normalize(header) && !recognizedHeaders.includes(normalizeHeader(header))).forEach((header) => {
    issues.push(appendImportIssue({
      type: 'column_name_mismatch',
      sourceFlow: 'product_import',
      sourceFileName,
      field: header,
      detectedColumn: header,
      message: '列名を確認してください。商品マスタの項目として自動判定できませんでした。',
    }));
  });
  return issues;
}


function recordOrderImportIssues(importResult, sourceFileName = '') {
  if (!importResult) return [];
  const issues = [];
  const knownHeaders = importResult.platform && platformFieldMappings[importResult.platform]
    ? Object.values(platformFieldMappings[importResult.platform].fieldCandidates || {}).flatMap((candidates) => (candidates || []).flatMap((candidate) => fieldCandidate(candidate).fields).map(normalizeHeader))
    : [];
  if (importResult.platform === 'unknown') {
    issues.push(appendImportIssue({
      type: 'platform_mapping_warning',
      sourceFlow: 'order_import',
      sourceFileName,
      field: 'headers',
      message: '列名を確認してください。取込元プラットフォームを判定できません。',
    }));
  }
  (importResult.missingHeaders || []).forEach((header) => {
    issues.push(appendImportIssue({
      type: 'platform_mapping_warning',
      sourceFlow: 'order_import',
      sourceFileName,
      sourcePlatform: importResult.platform,
      field: header,
      detectedColumn: header,
      message: '列名を確認してください。プラットフォーム項目を標準項目へ対応できません。',
      suggestion: makeImportSuggestion('platform_mapping_warning', {
        sourceField: header,
        detectedColumn: header,
        suggestedField: header,
        confidence: 0.4,
        reason: '列名の対応候補を確認してください。',
      }),
    }));
  });
  (importResult.detectedHeaders || []).forEach((header) => {
    const normalizedHeader = normalizeHeader(header);
    if (!normalize(header) || knownHeaders.includes(normalizedHeader)) return;
    issues.push(appendImportIssue({
      type: 'column_name_mismatch',
      sourceFlow: 'order_import',
      sourceFileName,
      sourcePlatform: importResult.platform,
      field: header,
      detectedColumn: header,
      message: '列名を確認してください。注文データの項目として自動判定できませんでした。',
    }));
  });
  (importResult.allOrders || importResult.orders || []).forEach((order, index) => {
    const rowNumber = index + 2;
    if ((order.warnings || []).includes('商品名をSKUとして使用')) {
      issues.push(appendImportIssue({
        type: 'missing_sku',
        sourceFlow: 'order_import',
        sourceFileName,
        sourcePlatform: order.sourcePlatform,
        rowNumber,
        field: 'sku',
        detectedColumn: '商品名',
        message: '商品コードが見つかりません。商品名を SKU として扱いました。',
        suggestion: makeImportSuggestion('missing_sku', {
          sourceField: '商品名',
          detectedColumn: '商品名',
          suggestedField: 'SKU',
          suggestedValue: order.sku,
          confidence: 0.75,
          reason: '商品名をSKUとして利用しています。',
        }),
      }));
    }
    if ((order.warnings || []).includes('顧客名未設定') || !normalize(order.customer)) {
      issues.push(appendImportIssue({ type: 'missing_recipient', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'customer', message: '顧客名が見つかりません。' }));
    }
    if ((order.warnings || []).includes('郵便番号未設定') || !normalizePostal(order.postal)) {
      issues.push(appendImportIssue({ type: 'missing_postal', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'postal', message: '郵便番号が見つかりません。' }));
    } else if ((order.warnings || []).includes('郵便番号形式不正') || !isValidPostalFormat(order.postal)) {
      issues.push(appendImportIssue({ type: 'invalid_postal', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'postal', message: '郵便番号の形式が正しくありません。' }));
    } else if ((order.warnings || []).includes('配送地域未判定')) {
      issues.push(appendImportIssue({ type: 'unknown_zone', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'postal', message: '配送地域を判定できません。' }));
    }
    if ((order.warnings || []).includes('数量未設定')) {
      issues.push(appendImportIssue({ type: 'missing_quantity', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'quantity', message: '数量が見つかりません。' }));
    }
    if ((order.warnings || []).includes('数量形式不正')) {
      issues.push(appendImportIssue({ type: 'invalid_quantity', sourceFlow: 'order_import', sourceFileName, sourcePlatform: order.sourcePlatform, rowNumber, field: 'quantity', message: '数量の形式が正しくありません。' }));
    }
  });
  return issues;
}

function recordFareImportIssues(rows, fareFormat, matrixView, normalizedRows, sourceFileName = '') {
  const issues = [];
  const headers = Object.keys(rows[0] || {});
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const zoneSignals = ['北海道', '東北', '東京', '東京都', '関東', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄'];
  const knownMatrixHeaders = ['size', 'サイズ', 'サイズ(cm)', 'サイズ(mm)', '総長', '重量', '重量kg', '重量(kg)', 'weight', 'weightlimit'];
  const knownVerticalHeaders = ['carrier', '配送会社', 'service', 'サービス', 'size', 'サイズ', 'zone', '地域', '配送地域', 'fare', '運賃', '送料', 'weightlimit', '重量', '重量kg'];
  const hasZoneColumn = normalizedHeaders.some((header) => ['zone', '地域', '配送地域', '地区'].includes(header) || zoneSignals.includes(header)) || Boolean(matrixView?.zoneHeaders?.length);
  if (!hasZoneColumn) {
    issues.push(appendImportIssue({
      type: 'missing_zone_column',
      sourceFlow: 'fare_import',
      sourceFileName,
      field: 'zone',
      message: '配送地域の列が見つかりません。列名を確認してください。',
    }));
  }
  if (fareFormat === 'unknown' || !normalizedRows?.length) {
    issues.push(appendImportIssue({
      type: 'fare_matrix_parse_failed',
      sourceFlow: 'fare_import',
      sourceFileName,
      field: 'headers',
      message: '送料マトリクスとして認識できません。列名を確認してください。',
    }));
  }
  headers.forEach((header) => {
    const normalizedHeader = normalizeHeader(header);
    const isKnown = knownMatrixHeaders.includes(normalizedHeader) || knownVerticalHeaders.includes(normalizedHeader) || zoneSignals.includes(normalizedHeader);
    if (!isKnown && normalize(header)) {
      issues.push(appendImportIssue({
        type: 'column_name_mismatch',
        sourceFlow: 'fare_import',
        sourceFileName,
        field: header,
        detectedColumn: header,
        message: '列名を確認してください。運賃表の項目として自動判定できませんでした。',
      }));
    }
  });
  const sizeHeader = headers[0] || 'size';
  const weightHeader = headers.find((header) => ['weight', '重量', '重量(kg)', '重量kg', 'weightlimit'].includes(normalizeHeader(header))) || 'weightLimit';
  (rows || []).forEach((row, index) => {
    const rowNumber = index + 2;
    const sizeValue = normalize(row[sizeHeader] ?? row.size);
    const weightValue = normalize(row[weightHeader] ?? row.weight ?? row.weightLimit);
    if (!sizeValue) {
      issues.push(appendImportIssue({ type: 'missing_size', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'size', message: 'サイズが見つかりません。' }));
    }
    if (/mm|㎜|ミリ/i.test(`${matrixView?.sizeLabel || sizeHeader} ${sizeValue}`)) {
      issues.push(appendImportIssue({ type: 'unit_mismatch', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'size', message: 'サイズ単位を確認してください。cm単位のサイズとして取り込んでください。' }));
    }
    const fares = headers
      .filter((header) => !['carrier', 'service', 'size', 'サイズ', 'サイズ(mm)', 'サイズ(cm)', 'zone', '地域', '配送地域', 'weight', '重量', '重量(kg)', '重量kg', 'weightlimit'].includes(normalizeHeader(header)))
      .map((header) => [header, row[header]]);
    fares.forEach(([zone, fare]) => {
      if (!normalize(fare) || toNumber(fare) <= 0) {
        issues.push(appendImportIssue({ type: 'missing_fare', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: zone || 'fare', message: '運賃が見つかりません。' }));
      }
    });
    if (weightValue && !/^[0-9.,]+$/.test(weightValue)) {
      issues.push(appendImportIssue({ type: 'invalid_weight_limit', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'weightLimit', message: '重量上限の形式を確認してください。' }));
      issues.push(appendImportIssue({ type: 'unit_mismatch', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'weightLimit', message: '重量単位を確認してください。' }));
    }
  });
  return issues;
}

function normalizeProduct(row) {
  return {
    id: row.id || makeId('p'),
    sku: normalize(row.sku),
    name: normalize(row.name),
    size: normalizeSize(row.size),
    weight: String(toNumber(row.weight)),
    length: String(toNumber(row.length)),
    width: String(toNumber(row.width)),
    height: String(toNumber(row.height)),
    bundleable: row.bundleable === true || ['true', '1', 'yes', 'y', '可', '可能'].includes(normalize(row.bundleable).toLowerCase()),
  };
}

function normalizeFare(row) {
  return {
    id: row.id || makeId('rate'),
    carrier: normalizeCarrier(row.carrier),
    service: normalize(row.service),
    size: normalizeSize(row.size),
    weightLimit: parseWeightLimitValue(row.weightLimit || row.weight) || '0',
    zone: normalize(row.zone) || 'default',
    fare: String(toNumber(row.fare)),
  };
}

function createMatrixView(rows, carrierName = 'ヤマト', serviceName = '宅急便') {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0] || {}).map((header) => normalizeHeader(header));
  const sizeHeader = headers[0];
  const weightHeader = headers.find((header) => ['weight', '重量', '重量(kg)', '重量kg', 'weightlimit'].includes(header));
  const zoneHeaders = headers.filter((header) => header !== sizeHeader && header !== weightHeader);
  return normalizeMatrixView({
    carrier: carrierName,
    service: serviceName,
    sizeLabel: ['size'].includes(sizeHeader) ? 'サイズ' : sizeHeader,
    weightLabel: weightHeader || '重量',
    zoneHeaders,
    rows: rows.map((row) => ({
      size: row[sizeHeader],
      weight: weightHeader ? row[weightHeader] : '',
      fares: Object.fromEntries(zoneHeaders.map((zone) => [zone, row[zone] || ''])),
    })),
  });
}

function detectFareTableFormat(headers, rows) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  if (hasHeaders(normalizedHeaders, ['carrier', 'service', 'size', 'zone', 'fare']) || hasHeaders(normalizedHeaders, ['配送会社', 'サービス', 'サイズ', '地域', '送料'])) return 'vertical';
  const firstHeader = normalizedHeaders[0];
  const zoneSignals = ['北海道', '関東', '東京', '関西', '沖縄', '九州'];
  if ((['size', 'サイズ', '総長', 'サイズ(cm)', 'サイズ(mm)'].includes(firstHeader) || firstHeader.includes('サイズ')) && normalizedHeaders.some((header) => zoneSignals.includes(header))) return 'matrix';
  return 'unknown';
}

function normalizeFareMatrix(matrixInput, carrierName = 'ヤマト', serviceName = '宅急便') {
  const matrixView = Array.isArray(matrixInput) ? createMatrixView(matrixInput, carrierName, serviceName) : normalizeMatrixView(matrixInput);
  if (!matrixView?.rows?.length) return [];
  return matrixView.rows.flatMap((row) => matrixView.zoneHeaders.map((zone) => normalizeFare({
    carrier: matrixView.carrier,
    service: matrixView.service,
    size: row.size,
    weightLimit: row.weight,
    zone,
    fare: row.fares?.[zone],
  }))).filter((fare) => fare.size && fare.zone && toNumber(fare.fare) > 0);
}

function getProductsBySku() {
  return Object.fromEntries(getData('products').map((product) => [product.sku, product]));
}

function getFareRows() {
  return getFareTableState().normalizedFareRows;
}

function getDataHealth() {
  const orders = getData('orders');
  const products = getData('products');
  const fares = getFareRows();
  return {
    hasOrders: orders.length > 0,
    hasProducts: products.length > 0,
    hasFares: fares.length > 0,
    errors: [
      products.length ? '' : '商品マスタがありません。商品CSVを先に取り込んでください。',
      fares.length ? '' : '運賃表がありません。運賃表CSVを先に取り込んでください。',
    ].filter(Boolean),
  };
}

function getZoneByPostal(postal, address = '') {
  // 邮编范围到都道府县的映射表（日本郵便番号的前3位）
  const postalCodeRanges = [
    { min: 100, max: 199, zone: '東京' },      // 東京都
    { min: 200, max: 209, zone: '関東' },      // 神奈川県
    { min: 210, max: 219, zone: '関東' },      // 神奈川県
    { min: 220, max: 229, zone: '関東' },      // 神奈川県
    { min: 230, max: 249, zone: '関東' },      // 神奈川県
    { min: 250, max: 299, zone: '関東' },      // 神奈川県
    { min: 310, max: 319, zone: '関東' },      // 茨城県
    { min: 320, max: 329, zone: '関東' },      // 栃木県
    { min: 330, max: 369, zone: '関東' },      // 埼玉県
    { min: 370, max: 399, zone: '関東' },      // 群馬県
    { min: 400, max: 409, zone: '関東' },      // 山梨県
    { min: 500, max: 549, zone: '関西' },      // 大阪府・滋賀県・三重県
    { min: 600, max: 619, zone: '関西' },      // 京都府
    { min: 650, max: 679, zone: '関西' },      // 兵庫県
    { min: 800, max: 829, zone: '九州' },      // 福岡県
    { min: 830, max: 859, zone: '九州' },      // 福岡県・佐賀県
    { min: 860, max: 899, zone: '九州' },      // 佐賀県・長崎県・熊本県・大分県・宮崎県
    { min: 900, max: 909, zone: '沖縄' }       // 沖縄県のみ
  ];
  
  // Step 1: 尝试从邮编提取前3位数字，按范围识别
  const cleanPostal = normalize(postal).replace(/[-〒\s]/g, '');
  if (cleanPostal.length >= 3 && /^\d{7}$/.test(cleanPostal)) {
    const postalPrefix = parseInt(cleanPostal.slice(0, 3), 10);
    for (const range of postalCodeRanges) {
      if (postalPrefix >= range.min && postalPrefix <= range.max) {
        return range.zone;
      }
    }
    // 邮编格式正确（7位数字）但不在任何有效范围内，返回 unknown
    return 'unknown';
  }
  
  // Step 2: 地址文本作为 fallback
  const normalizedAddress = compactText(address);
  if (normalizedAddress.includes('東京都')) return '東京';
  if (['神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県', '山梨県'].some((name) => normalizedAddress.includes(name))) return '関東';
  if (['大阪府', '京都府', '兵庫県', '奈良県', '滋賀県', '和歌山県'].some((name) => normalizedAddress.includes(name))) return '関西';
  if (normalizedAddress.includes('北海道')) return '北海道';
  if (normalizedAddress.includes('沖縄県')) return '沖縄';
  if (['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'].some((name) => normalizedAddress.includes(name))) return '九州';
  
  // Step 3: 识别失败返回 unknown
  return 'unknown';
}

function sizeFromTotal(value) {
  const numeric = Math.max(0, toNumber(value));
  return shippingSizes.find((size) => numeric <= size) || null;
}

function getProductSize(product) {
  const savedSize = sizeFromTotal(product?.size);
  if (savedSize) return savedSize;
  const totalLength = toNumber(product?.length) + toNumber(product?.width) + toNumber(product?.height);
  return sizeFromTotal(totalLength);
}

function estimateBundledSize(totalVolume, largestItemSize) {
  const cubeSide = Math.ceil(Math.cbrt(Math.max(0, totalVolume)));
  const volumeSize = sizeFromTotal(cubeSide * 3);
  if (!volumeSize && !largestItemSize) return null;
  return Math.max(volumeSize || 0, largestItemSize || 0);
}

function isOrderBundleable(order, productsBySku = getProductsBySku()) {
  const product = productsBySku[order.sku];
  return product ? product.bundleable !== false : false;
}

function getBundleKey(order) {
  return [order.customer, order.postal, order.address].map((value) => normalize(value).toLowerCase()).join('|');
}

function getBundleCandidates() {
  if (!getData('products').length) return [];
  const productsBySku = getProductsBySku();
  const grouped = getData('orders').reduce((acc, order) => {
    const key = getBundleKey(order);
    if (!key.replace(/\|/g, '')) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(order);
    return acc;
  }, {});

  return Object.values(grouped)
    .filter((orders) => orders.length > 1 && orders.every((order) => isOrderBundleable(order, productsBySku)))
    .map((orders) => ({ key: getBundleKey(orders[0]), orders }));
}

function getShipmentOrderGroups() {
  const orders = getData('orders');
  const productsBySku = getProductsBySku();
  const bundleKeys = new Set(getBundleCandidates().map((group) => group.key));
  const grouped = orders.reduce((acc, order) => {
    const key = getBundleKey(order);
    const shipmentKey = bundleKeys.has(key) && isOrderBundleable(order, productsBySku) ? key : order.id;
    acc[shipmentKey] = acc[shipmentKey] || [];
    acc[shipmentKey].push(order);
    return acc;
  }, {});
  return Object.values(grouped);
}

function getFareOptions(size, zone = 'unknown', totalWeight = 0) {
  if (!getFareRows().length || !size) return [];
  
  // 区域未识别时返回空列表
  if (zone === 'unknown') return [];
  
  const numericSize = toNumber(size);
  const numericWeight = toNumber(totalWeight);
  
  return getFareRows()
    .map(normalizeFare)
    .filter((fare) => supportedCarriers.includes(fare.carrier) && toNumber(fare.fare) > 0)
    .filter((fare) => fare.zone === zone || fare.zone === 'default')
    // 尺寸向上匹配：选择大于等于需求尺寸的最小可用尺寸
    .filter((fare) => {
      const fareSize = toNumber(fare.size);
      return fareSize >= numericSize && shippingSizes.includes(fareSize);
    })
    // 重量限制检查：weightLimit为空或0表示无限制，否则检查实际重量
    .filter((fare) => {
      const weightLimit = toNumber(fare.weightLimit);
      return weightLimit === 0 || numericWeight <= weightLimit;
    })
    .sort((a, b) => {
      // 优先按尺寸排序（较小的尺寸优先），然后按运费排序
      const sizeDiff = toNumber(a.size) - toNumber(b.size);
      return sizeDiff !== 0 ? sizeDiff : toNumber(a.fare) - toNumber(b.fare);
    });
}

function buildShipmentGroup(orders, index, productsBySku = getProductsBySku()) {
  const itemMap = {};
  let totalWeight = 0;
  let totalVolume = 0;
  let largestItemSize = 0;
  let missingProduct = false;

  orders.forEach((order) => {
    const quantity = Math.max(1, toNumber(order.quantity) || 1);
    const product = productsBySku[order.sku];
    itemMap[order.sku] = (itemMap[order.sku] || 0) + quantity;
    if (!product) {
      missingProduct = true;
      return;
    }
    totalWeight += toNumber(product.weight) * quantity;
    totalVolume += toNumber(product.length) * toNumber(product.width) * toNumber(product.height) * quantity;
    largestItemSize = Math.max(largestItemSize, getProductSize(product) || 0);
  });

  const isBundled = orders.length > 1;
  const estimatedSize = missingProduct ? null : (isBundled ? estimateBundledSize(totalVolume, largestItemSize) : largestItemSize);
  const zone = getZoneByPostal(orders[0]?.postal, orders[0]?.address);
  const fareOptions = missingProduct ? [] : getFareOptions(estimatedSize, zone, totalWeight);
  const best = fareOptions[0] || null;
  const second = fareOptions[1] || null;
  const warningTexts = [...new Set(orders.flatMap((order) => order.warnings || []))];
  let status;
  if (missingProduct) {
    status = '商品未登録';
  } else if (zone === 'unknown') {
    status = '区域未識別';
  } else if (best) {
    status = warningTexts.join(' / ') || '';
  } else {
    status = '対応運賃なし';
  }

  return {
    shipmentGroupId: `SG-${String(index + 1).padStart(3, '0')}`,
    orderNos: orders.map((order) => order.orderNo).join(', '),
    customer: orders[0]?.customer || '',
    postal: orders[0]?.postal || '',
    address: orders[0]?.address || '',
    sourcePlatform: [...new Set(orders.map((order) => order.sourcePlatform).filter(Boolean))].join(', '),
    items: Object.entries(itemMap).map(([sku, quantity]) => `${sku} × ${quantity}`).join(', '),
    estimatedSize: estimatedSize || '',
    totalWeight,
    recommendedCarrier: best?.carrier || '',
    recommendedService: best?.service || '',
    estimatedFare: best ? toNumber(best.fare) : '',
    secondCarrier: second ? `${second.carrier} ${second.service}` : '',
    secondFare: second ? toNumber(second.fare) : '',
    savings: best && second ? Math.max(0, toNumber(second.fare) - toNumber(best.fare)) : 0,
    status,
  };
}

function getShipmentGroups() {
  const health = getDataHealth();
  if (!health.hasOrders) return [];
  return getShipmentOrderGroups().map((orders, index) => buildShipmentGroup(orders, index));
}


const shipmentStatusModel = ['imported', 'pending', 'ready', 'shipped', 'on_hold', 'error'];
const shipmentStatusLabels = {
  imported: '取込済み',
  pending: '確認待ち',
  ready: '出荷可能',
  shipped: '出荷済み',
  on_hold: '保留',
  error: 'エラー',
};
const shipmentStatusActionLabels = {
  imported: '取込済みに戻す',
  pending: '確認待ち',
  ready: '出荷可能にする',
  shipped: '出荷済みにする',
  on_hold: '保留にする',
  error: 'エラーにする',
};

function normalizeShipmentStatus(status) {
  return shipmentStatusModel.includes(status) ? status : 'pending';
}

function getShipmentStatusStore() {
  const value = getData('shipmentStatuses');
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function setShipmentStatusStore(value) {
  setData('shipmentStatuses', value && typeof value === 'object' && !Array.isArray(value) ? value : {});
}

function getDefaultShipmentStatus(shipment) {
  if (!shipment) return 'pending';
  if (!shipment.recommendedCarrier || shipment.status === '商品未登録' || shipment.status === '区域未識別' || shipment.status === '対応運賃なし') return 'error';
  return 'ready';
}

function getShipmentStatus(shipment) {
  const savedStatus = getShipmentStatusStore()[shipment.shipmentGroupId];
  return normalizeShipmentStatus(savedStatus || getDefaultShipmentStatus(shipment));
}

function updateShipmentStatus(shipmentGroupId, status) {
  const normalizedStatus = normalizeShipmentStatus(status);
  setShipmentStatusStore({ ...getShipmentStatusStore(), [shipmentGroupId]: normalizedStatus });
}

function getShipmentRowsWithStatus() {
  return getShipmentGroups().map((shipment) => ({ ...shipment, shipmentStatus: getShipmentStatus(shipment) }));
}

function getExportableShipmentRows() {
  return getShipmentRowsWithStatus().filter((shipment) => !['error', 'on_hold'].includes(shipment.shipmentStatus));
}

function getShipmentStatusCounts(shipments = getShipmentRowsWithStatus()) {
  return shipmentStatusModel.reduce((counts, status) => ({
    ...counts,
    [status]: shipments.filter((shipment) => shipment.shipmentStatus === status).length,
  }), {});
}

function getCarrierShipmentCounts(shipments = getShipmentRowsWithStatus()) {
  return shipments.reduce((counts, shipment) => {
    const carrier = shipment.recommendedCarrier || '未設定';
    counts[carrier] = (counts[carrier] || 0) + 1;
    return counts;
  }, {});
}

function makeShipmentExportRows(shipments) {
  return shipments.map((row) => ({
    '同梱グループ': row.shipmentGroupId,
    '出荷状態': shipmentStatusLabels[row.shipmentStatus] || row.shipmentStatus,
    '対象注文番号': row.orderNos,
    '顧客名': row.customer,
    '郵便番号': row.postal,
    '配送先住所': row.address,
    'SKU明細': row.items,
    '推定サイズ': row.estimatedSize,
    '合計重量': row.totalWeight,
    '推奨配送会社': row.recommendedCarrier,
    '推奨サービス': row.recommendedService,
    '推定運賃': row.estimatedFare,
  }));
}

function getRecommendationRows() {
  return getShipmentGroups();
}

function getResultSummary() {
  const health = getDataHealth();
  const shipments = getShipmentGroups();
  const topRecommendation = shipments.find((shipment) => shipment.recommendedCarrier) || null;
  return {
    orderCount: getData('orders').length,
    bundleCount: getBundleCandidates().length,
    saving: shipments.reduce((sum, shipment) => sum + toNumber(shipment.savings), 0),
    topRecommendation,
    errors: health.errors,
  };
}

function renderDashboard() {
  const target = document.querySelector('#dashboard-view');
  if (!target) return;
  const summary = getResultSummary();
  const notices = summary.errors.length ? `<section class="panel full-width"><h2>確認が必要です</h2>${summary.errors.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}</section>` : '';
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推定節省額</p><strong>${formatYen(summary.saving)}</strong></article>
      <article class="stat-card"><p>最低運賃</p><strong>${formatYen(summary.topRecommendation?.estimatedFare || 0)}</strong></article>
    </section>
    ${notices}
    <section class="panel full-width">
      <h2>初期機能</h2>
      <p>注文CSV、商品マスタ、運賃表をブラウザに保存し、同梱候補と最低運賃を自動計算します。</p>
      <div class="action-grid">
        <a class="action-card" href="orders.html"><b>注文CSV</b><span>orderNo, customer, postal, address, sku, quantity</span></a>
        <a class="action-card" href="products.html"><b>商品マスタ</b><span>sku, name, size, weight, length, width, height, bundleable</span></a>
        <a class="action-card" href="carriers.html"><b>運賃表</b><span>carrier, service, size, zone, fare</span></a>
        <a class="action-card" href="results.html"><b>結果センター</b><span>推奨配送方法とCSV出力</span></a>
      </div>
    </section>
  `;
}

function renderProducts(filter = '') {
  const tbody = document.querySelector('#products-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const products = getData('products').filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(keyword));
  tbody.innerHTML = products.map((product) => `
    <tr>
      <td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.name)}</td><td><span class="badge">${escapeHtml(product.size)}</span></td>
      <td>${escapeHtml(product.weight)}g</td><td>${product.bundleable ? '可同梱' : '不可同梱'} / ${escapeHtml(product.length)}×${escapeHtml(product.width)}×${escapeHtml(product.height)}cm</td>
      <td><div class="row-actions"><button class="small-button" data-edit-product="${product.id}">編集</button><button class="small-button danger" data-delete-product="${product.id}">削除</button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="6">商品データがありません。</td></tr>';
}

function setProductImportSummary(message) {
  const form = document.querySelector('#product-import-form');
  if (!form) return;
  let summary = document.querySelector('#product-import-summary');
  if (!summary) {
    summary = document.createElement('p');
    summary.id = 'product-import-summary';
    form.insertAdjacentElement('afterend', summary);
  }
  summary.textContent = message;
}

function setFareImportSummary(message) {
  const form = document.querySelector('#fare-import-form');
  if (!form) return;
  let summary = document.querySelector('#fare-import-summary');
  if (!summary) {
    summary = document.createElement('p');
    summary.id = 'fare-import-summary';
    form.insertAdjacentElement('afterend', summary);
  }
  summary.textContent = message;
}

function initProducts() {
  const form = document.querySelector('#product-form');
  if (!form) return;
  const search = document.querySelector('#product-search');
  renderProducts();
  search?.addEventListener('input', () => renderProducts(search.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    const product = normalizeProduct({ ...formData, bundleable: formData.bundleable || 'true' });
    const products = getData('products');
    setData('products', formData.id ? products.map((item) => item.id === formData.id ? { ...product, id: formData.id } : item) : [{ ...product, id: makeId('p') }, ...products]);
    form.reset();
    renderProducts(search?.value || '');
    showToast('商品マスタを保存しました。');
  });
  document.addEventListener('click', (event) => {
    const editId = event.target.dataset?.editProduct;
    const deleteId = event.target.dataset?.deleteProduct;
    if (editId) {
      const product = getData('products').find((item) => item.id === editId);
      if (product) Object.entries(product).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    }
    if (deleteId) {
      setData('products', getData('products').filter((product) => product.id !== deleteId));
      renderProducts(search?.value || '');
      showToast('商品を削除しました。');
    }
  });
  document.querySelector('#product-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('商品マスタファイルを選択してください。');
    if (isImageFile(file)) {
      const message = '画像読み取りには対応していません。CSVまたはExcelをアップロードしてください。';
      setProductImportSummary(message);
      return showToast(message);
    }
    readImportFile(file, { flow: 'product_import' }, (fileResult) => {
      if (fileResult.errors?.length) {
        const message = fileResult.errors.join(' ');
        setProductImportSummary(message);
        appendImportIssue({
          type: 'product_file_read_error',
          sourceFlow: 'product_import',
          sourceFileName: file.name,
          field: 'file',
          message,
        });
        return showToast(message);
      }
      const rows = fileResult.rows || [];
      const importResult = importProductCsvRows(rows);
      if (importResult.message) {
        appendImportIssue({
          type: 'product_mapping_warning',
          sourceFlow: 'product_import',
          sourceFileName: file.name,
          field: 'headers',
          message: `列名を確認してください。${importResult.message}`,
        });
        setProductImportSummary(importResult.message);
        return showToast(importResult.message);
      }
      recordProductImportIssues(importResult, file.name, rows);
      const imported = importResult.products.map(({ importIssues, ...product }) => product);
      setData('products', [...imported, ...getData('products')]);
      renderProducts(search?.value || '');
      const warningText = (importResult.warningDetails || []).join('、') || 'なし';
      const fileType = (fileResult.sourceType || 'csv').toUpperCase();
      const sheetText = fileResult.sheetName ? ` / シート名: ${fileResult.sheetName}` : '';
      const unresolvedCount = getOpenImportIssues().length;
      const message = `取込ファイル種別: ${fileType}${sheetText} / 商品数: ${rows.length} / 成功数: ${importResult.successCount} / 失敗数: ${importResult.failureCount} / 警告数: ${importResult.warningCount} / 未解決問題数: ${unresolvedCount} / 警告内容: ${warningText}`;
      setProductImportSummary(message);
      showToast(message);
    });
  });
}

function renderCarriers(filter = '') {
  const tbody = document.querySelector('#carriers-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const fareState = getFareTableState();
  if (fareState.matrixView?.rows?.length) {
    const matrix = fareState.matrixView;
    const matchesFilter = !keyword || `${matrix.carrier} ${matrix.service} ${matrix.zoneHeaders.join(' ')}`.toLowerCase().includes(keyword);
    if (!matchesFilter) {
      tbody.innerHTML = '<tr><td colspan="6">該当する運賃表がありません。</td></tr>';
      return;
    }
    const zoneHeaderCells = matrix.zoneHeaders.map((zone) => `<th>${escapeHtml(zone)}</th>`).join('');
    const matrixRows = matrix.rows.map((row, rowIndex) => `
      <tr>
        <td><input data-matrix-size="${rowIndex}" value="${escapeHtml(row.size)}" /></td>
        <td><input data-matrix-weight="${rowIndex}" value="${escapeHtml(row.weight)}" /></td>
        ${matrix.zoneHeaders.map((zone, zoneIndex) => `<td><input data-matrix-fare="${rowIndex}" data-zone-index="${zoneIndex}" value="${escapeHtml(row.fares?.[zone] || '')}" /></td>`).join('')}
      </tr>
    `).join('');
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="table-toolbar">
            <strong>${escapeHtml(matrix.carrier)} / ${escapeHtml(matrix.service)}</strong>
            <div class="row-actions">
              <button class="small-button" type="button" data-save-fare-matrix="true">保存</button>
            </div>
          </div>
          <div class="responsive-table">
            <table>
              <thead><tr><th>${escapeHtml(matrix.sizeLabel)}</th><th>${escapeHtml(matrix.weightLabel)}</th>${zoneHeaderCells}</tr></thead>
              <tbody>${matrixRows}</tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  const fares = fareState.normalizedFareRows.filter((fare) => `${fare.carrier} ${fare.service} ${fare.size} ${fare.zone}`.toLowerCase().includes(keyword));
  tbody.innerHTML = fares.map((fare) => `
    <tr>
      <td>${escapeHtml(fare.carrier)}</td><td>${escapeHtml(fare.service)}</td><td>${formatYen(fare.fare)}</td>
      <td>${escapeHtml(fare.size)} / ${escapeHtml(fare.zone)}</td><td>運賃表</td>
      <td><div class="row-actions"><button class="small-button danger" data-delete-fare="${fare.id}">削除</button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="6">運賃表データがありません。</td></tr>';
}

function initCarriers() {
  const form = document.querySelector('#carrier-form');
  if (!form) return;
  const search = document.querySelector('#carrier-search');
  renderCarriers();
  search?.addEventListener('input', () => renderCarriers(search.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const fare = normalizeFare({ carrier: data.name || data.carrier, service: data.service, size: data.sizes || data.size, zone: 'default', fare: data.baseFare || data.fare });
    setFareTableState(null, [{ ...fare, id: data.id || makeId('rate') }, ...getFareRows()]);
    form.reset();
    renderCarriers(search?.value || '');
    showToast('運賃表を保存しました。');
  });
  document.addEventListener('click', (event) => {
    const deleteId = event.target.dataset?.deleteFare;
    if (deleteId) {
      setFareTableState(null, getFareRows().filter((fare) => fare.id !== deleteId));
      renderCarriers(search?.value || '');
      showToast('運賃行を削除しました。');
      return;
    }
    if (event.target.dataset?.saveFareMatrix !== 'true') return;
    const currentMatrix = getFareTableState().matrixView;
    if (!currentMatrix) return;
    const nextMatrix = normalizeMatrixView({
      ...currentMatrix,
      rows: currentMatrix.rows.map((row, rowIndex) => ({
        size: document.querySelector(`[data-matrix-size="${rowIndex}"]`)?.value || '',
        weight: document.querySelector(`[data-matrix-weight="${rowIndex}"]`)?.value || '',
        fares: Object.fromEntries(currentMatrix.zoneHeaders.map((zone, zoneIndex) => [zone, document.querySelector(`[data-matrix-fare="${rowIndex}"][data-zone-index="${zoneIndex}"]`)?.value || ''])),
      })),
    });
    const normalizedFareRows = normalizeFareMatrix(nextMatrix);
    setFareTableState(nextMatrix, normalizedFareRows);
    setData('carriers', normalizedFareRows);
    renderCarriers(search?.value || '');
    showToast('マトリクス運賃表を保存しました。');
  });
  document.querySelector('#fare-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('運賃表ファイルを選択してください。');
    if (isImageFile(file)) return showToast('画像ではなく、CSV または Excel ファイルをアップロードしてください。');
    readImportFile(file, { flow: 'fare_import' }, (fileResult) => {
      if (fileResult.errors?.length) {
        const message = fileResult.errors.join(' ');
        setFareImportSummary(message);
        appendImportIssue({ type: 'fare_file_read_error', sourceFlow: 'fare_import', sourceFileName: file.name, field: 'file', message });
        return showToast(message);
      }
      const rows = fileResult.rows || [];
      const headers = Object.keys(rows[0] || {});
      const carrierName = normalizeCarrier(form?.elements?.name?.value || form?.elements?.carrier?.value || 'ヤマト');
      const serviceName = normalize(form?.elements?.service?.value || '宅急便');
      let imported = [];
      let matrixView = null;
      const fareFormat = detectFareTableFormat(headers, rows);
      if (fareFormat === 'vertical') {
        imported = rows.map(normalizeFare).filter((fare) => supportedCarriers.includes(fare.carrier));
      } else if (fareFormat === 'matrix') {
        imported = normalizeFareMatrix(rows, carrierName, serviceName);
        matrixView = createMatrixView(rows, carrierName, serviceName);
      } else {
        const missing = requireColumns(rows, ['carrier', 'service', 'size', 'zone', 'fare']);
        recordFareImportIssues(rows, fareFormat, matrixView, imported, file.name);
        const message = `不足している項目: ${missing.join(', ')}`;
        setFareImportSummary(message);
        return showToast(message);
      }
      const issues = recordFareImportIssues(rows, fareFormat, matrixView, imported, file.name);
      setFareTableState(matrixView, imported);
      setData('carriers', imported);
      renderCarriers(search?.value || '');
      const fileType = (fileResult.sourceType || 'csv').toUpperCase();
      const sheetText = fileResult.sheetName ? ` / シート名: ${fileResult.sheetName}` : '';
      const failureCount = Math.max(0, rows.length - imported.length);
      const unresolvedCount = getOpenImportIssues().length;
      const message = `取込ファイル種別: ${fileType}${sheetText} / 形式: ${fareFormat} / 成功数: ${imported.length} / 失敗数: ${failureCount} / 警告数: ${issues.length} / 未解決問題数: ${unresolvedCount}`;
      setFareImportSummary(message);
      showToast(message);
    });
  });
}

function renderOrders(filter = '') {
  const tbody = document.querySelector('#orders-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const bundleIds = new Set(getBundleCandidates().flatMap((group) => group.orders.map((order) => order.id)));
  const orders = getData('orders').filter((order) => `${order.orderNo} ${order.customer} ${order.sku}`.toLowerCase().includes(keyword));
  tbody.innerHTML = orders.map((order) => `
    <tr>
      <td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.postal || '郵便番号未設定')}</td>
      <td>${escapeHtml(order.sku)} × ${escapeHtml(order.quantity)}</td><td>${escapeHtml(order.address)}</td><td>${bundleIds.has(order.id) ? '同梱候補' : '単独'}</td>
      <td><span class="badge ${bundleIds.has(order.id) ? 'green' : 'orange'}">${bundleIds.has(order.id) ? '可同梱' : '確認済'}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="7">注文データがありません。</td></tr>';
  const summary = document.querySelector('#order-preview-summary');
  if (summary) summary.textContent = `${orders.length}件の注文をブラウザ保存データから表示しています。`;
}

function importShipNaviStandardRows(rows, headers) {
  const orders = rows.map((row) => normalizeOrder({ ...row, sourcePlatform: 'ShipNavi標準' }));
  const validOrders = orders.filter(hasStandardOrderFields);
  return {
    platform: 'ShipNavi標準',
    orders: validOrders,
    successCount: validOrders.length,
    failureCount: orders.length - validOrders.length,
    missingHeaders: [],
    warningCount: validOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0),
    warningDetails: [...new Set(validOrders.flatMap((order) => order.warnings || []))],
    detectedHeaders: headers,
    allOrders: orders,
  };
}

function handleOrderImportFile(file, search) {
  const summary = document.querySelector('#order-preview-summary');
  if (!file) return showToast('注文ファイルを選択してください。');
  if (isImageFile(file)) return showToast('画像ではなく、CSV または Excel ファイルをアップロードしてください。');
  readImportFile(file, { flow: 'order_import' }, (fileResult) => {
    if (fileResult.errors?.length) {
      const message = fileResult.errors.join(' ');
      if (summary) summary.textContent = message;
      appendImportIssue({ type: 'order_file_read_error', sourceFlow: 'order_import', sourceFileName: file.name, field: 'file', message });
      return showToast(message);
    }
    const rows = fileResult.rows || [];
    const headers = Object.keys(rows[0] || {});
    let importResult;
    const platform = detectOrderCsvFormat(headers);
    if (platform !== 'unknown') {
      importResult = importOrderCsvRows(rows);
      if (importResult.missingHeaders.length) {
        recordOrderImportIssues(importResult, file.name);
        const message = `${platform} 不足している項目: ${importResult.missingHeaders.join(', ')}`;
        if (summary) summary.textContent = message;
        return showToast(message);
      }
    } else if (hasHeaders(headers, ['orderNo', 'customer', 'address', 'sku', 'quantity'])) {
      importResult = importShipNaviStandardRows(rows, headers);
    }
    if (!importResult || importResult.platform === 'unknown') {
      const detectedHeaderText = headers.length ? headers.join(', ') : 'なし';
      recordOrderImportIssues(importResult || { platform: 'unknown', orders: [], missingHeaders: [], detectedHeaders: headers }, file.name);
      const message = `未対応CSV形式 / ヘッダー: ${detectedHeaderText} / 後続で手動マッピング対応予定`;
      if (summary) summary.textContent = message;
      return showToast(message);
    }
    recordOrderImportIssues(importResult, file.name);
    const imported = importResult.orders;
    setData('orders', imported);
    renderOrders(search?.value || '');
    const fileType = (fileResult.sourceType || 'csv').toUpperCase();
    const sheetText = fileResult.sheetName ? ` / シート名: ${fileResult.sheetName}` : '';
    const message = `取込ファイル種別: ${fileType}${sheetText} / 検出プラットフォーム: ${importResult.platform} / 注文件数: ${rows.length} / 成功数: ${importResult.successCount} / 失敗数: ${importResult.failureCount} / 警告数: ${importResult.warningCount || 0} / 未解決問題数: ${getOpenImportIssues().length}`;
    if (summary) summary.textContent = message;
    showToast(message);
  });
}

function initOrders() {
  if (!document.querySelector('#orders-table')) return;
  const search = document.querySelector('#order-search');
  renderOrders();
  search?.addEventListener('input', () => renderOrders(search.value));
  document.querySelector('#order-csv-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleOrderImportFile(event.currentTarget.elements.file.files[0], search);
  });
  document.querySelector('#order-excel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleOrderImportFile(event.currentTarget.elements.file?.files?.[0], search);
  });
}

function renderTemplates() {
  const target = document.querySelector('#templates-view');
  if (!target) return;
  target.outerHTML = `
    <section class="panel full-width">
      <h2>CSV項目</h2>
      <p>注文CSV: 注文番号、顧客名、郵便番号、配送先住所、SKU、数量</p>
      <p>商品マスタ: SKU、商品名、配送サイズ、重量、長さ、幅、高さ、同梱可否</p>
      <p>運賃表: 配送会社、サービス、配送サイズ、配送地域、送料</p>
    </section>
  `;
}

function renderResults() {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const summary = getResultSummary();
  const shipments = getShipmentRowsWithStatus();
  const health = getDataHealth();
  const alertPanel = summary.errors.length ? `
    <section class="panel full-width">
      <h2>エラー</h2>
      ${summary.errors.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}
    </section>
  ` : '';
  const shipmentRows = shipments.length
    ? shipments.map((row) => `
      <tr>
        <td>${escapeHtml(row.shipmentGroupId)}</td>
        <td>${escapeHtml(row.orderNos)}</td>
        <td>${escapeHtml(row.customer)}</td>
        <td>${escapeHtml(row.sourcePlatform || '-')}</td>
        <td><span class="badge status-${escapeHtml(row.shipmentStatus)}">${escapeHtml(shipmentStatusLabels[row.shipmentStatus] || row.shipmentStatus)}</span></td>
        <td>${escapeHtml(row.postal || '郵便番号未設定')}</td>
        <td class="wrap-cell address-cell">${escapeHtml(row.address)}</td>
        <td class="wrap-cell sku-cell">${escapeHtml(row.items)}</td>
        <td>${row.estimatedSize ? `${escapeHtml(row.estimatedSize)}サイズ` : escapeHtml(row.status)}</td>
        <td>${toNumber(row.totalWeight).toLocaleString('ja-JP')}g</td>
        <td>${escapeHtml(row.recommendedCarrier || row.status)}</td>
        <td>${escapeHtml(row.recommendedService)}</td>
        <td class="money-cell">${row.estimatedFare === '' ? escapeHtml(row.status) : formatYen(row.estimatedFare)}</td>
        <td>${escapeHtml(row.secondCarrier || '-')}</td>
        <td class="money-cell">${row.secondFare === '' ? '-' : formatYen(row.secondFare)}</td>
        <td class="money-cell"><span class="badge green">${formatYen(row.savings)}</span></td>
      </tr>
    `).join('')
    : `<tr><td colspan="16">${health.hasOrders ? '商品マスタと運賃表を取り込むと計算されます。' : '注文データがありません。'}</td></tr>`;
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推奨配送方法</p><strong>${escapeHtml(summary.topRecommendation ? `${summary.topRecommendation.recommendedCarrier} ${summary.topRecommendation.recommendedService}` : '-')}</strong></article>
      <article class="stat-card"><p>削減見込み額</p><strong>${formatYen(summary.saving)}</strong></article>
    </section>
    ${alertPanel}
    <section class="panel full-width">
      <h2>出荷結果サマリー</h2>
      <div class="result-grid">
        <article class="empty-card"><p>出荷対象</p><strong>${shipments.length}</strong></article>
        <article class="empty-card"><p>出荷CSV対象</p><strong>${getExportableShipmentRows().length}</strong></article>
        <article class="empty-card"><p>保留・エラー</p><strong>${shipments.filter((shipment) => ['on_hold', 'error'].includes(shipment.shipmentStatus)).length}</strong></article>
        <article class="empty-card"><p>推定削減サマリー</p><strong>${formatYen(summary.saving)}</strong></article>
      </div>
    </section>
    <section class="result-grid full-width">
      <article class="panel">
        <h2>配送会社別件数</h2>
        <ul class="status-list">${Object.entries(getCarrierShipmentCounts(shipments)).map(([carrier, count]) => `<li><span>${escapeHtml(carrier)}</span><strong>${count}件</strong></li>`).join('') || '<li><span>配送会社なし</span><strong>0件</strong></li>'}</ul>
      </article>
      <article class="panel">
        <h2>出荷状態別件数</h2>
        <ul class="status-list">${Object.entries(getShipmentStatusCounts(shipments)).map(([status, count]) => `<li><span>${escapeHtml(shipmentStatusLabels[status])}</span><strong>${count}件</strong></li>`).join('')}</ul>
      </article>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>運賃比較結果</h2><button class="button secondary" type="button" id="export-results-csv">CSV出力</button></div>
      <div class="responsive-table results-table"><table><thead><tr><th>同梱グループ</th><th>対象注文番号</th><th>顧客名</th><th>取込元プラットフォーム</th><th>出荷状態</th><th>郵便番号</th><th>配送先住所</th><th>SKU明細</th><th>推定サイズ</th><th>合計重量</th><th>推奨配送会社</th><th>推奨サービス</th><th>推定運賃</th><th>第二候補</th><th>第二候補運賃</th><th>削減見込み額</th></tr></thead>
      <tbody>${shipmentRows}</tbody></table></div>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>同梱結果</h2></div>
      <div class="responsive-table queue-table"><table><thead><tr><th>同梱グループ</th><th>対象注文番号</th><th>顧客名</th><th>取込元プラットフォーム</th><th>郵便番号</th><th>配送先住所</th><th>SKU明細</th><th>推定サイズ</th><th>合計重量</th><th>推奨配送会社</th><th>推定運賃</th></tr></thead><tbody>${shipments.length ? shipments.map((row) => `<tr><td>${escapeHtml(row.shipmentGroupId)}</td><td>${escapeHtml(row.orderNos)}</td><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.sourcePlatform || '-')}</td><td>${escapeHtml(row.postal || '郵便番号未設定')}</td><td class="wrap-cell address-cell">${escapeHtml(row.address)}</td><td class="wrap-cell sku-cell">${escapeHtml(row.items)}</td><td>${row.estimatedSize ? `${escapeHtml(row.estimatedSize)}サイズ` : escapeHtml(row.status)}</td><td>${toNumber(row.totalWeight).toLocaleString('ja-JP')}g</td><td>${escapeHtml(row.recommendedCarrier || row.status)}</td><td class="money-cell">${row.estimatedFare === '' ? escapeHtml(row.status) : formatYen(row.estimatedFare)}</td></tr>`).join('') : '<tr><td colspan="11">注文データがありません。</td></tr>'}</tbody></table></div>
    </section>
  `;
  document.querySelector('#export-results-csv')?.addEventListener('click', () => {
    const rows = shipments.map((row) => ({
      '同梱グループ': row.shipmentGroupId,
      '対象注文番号': row.orderNos,
      '顧客名': row.customer,
      '郵便番号': row.postal,
      '配送先住所': row.address,
      'SKU明細': row.items,
      '推定サイズ': row.estimatedSize,
      '合計重量': row.totalWeight,
      '推奨配送会社': row.recommendedCarrier,
      '推奨サービス': row.recommendedService,
      '推定運賃': row.estimatedFare,
      '第二候補配送会社': row.secondCarrier,
      '第二候補運賃': row.secondFare,
      '削減見込み額': row.savings,
    }));
    downloadCsv('shipnavi-results.csv', rows);
    showToast('結果センターCSVを出力しました。');
  });
}



function renderShipmentQueue() {
  const target = document.querySelector('#shipment-queue-view');
  if (!target) return;
  const shipments = getShipmentRowsWithStatus();
  const statusCounts = getShipmentStatusCounts(shipments);
  const rows = shipments.length ? shipments.map((row) => `
    <tr>
      <td>${escapeHtml(row.shipmentGroupId)}</td>
      <td>${escapeHtml(row.orderNos)}</td>
      <td>${escapeHtml(row.customer)}</td>
      <td>${escapeHtml(row.sourcePlatform || '-')}</td>
      <td><span class="badge status-${escapeHtml(row.shipmentStatus)}">${escapeHtml(shipmentStatusLabels[row.shipmentStatus] || row.shipmentStatus)}</span></td>
      <td class="wrap-cell address-cell">${escapeHtml(row.address)}</td>
      <td class="wrap-cell sku-cell">${escapeHtml(row.items)}</td>
      <td class="compact-reason">${escapeHtml(row.status || '出荷可能')}</td>
      <td>${escapeHtml(row.recommendedCarrier || '-')}</td>
      <td class="money-cell">${row.estimatedFare === '' ? '-' : formatYen(row.estimatedFare)}</td>
      <td><div class="row-actions shipment-actions">${shipmentStatusModel.map((status) => `<button class="small-button" type="button" data-shipment-status="${escapeHtml(status)}" data-shipment-group-id="${escapeHtml(row.shipmentGroupId)}">${escapeHtml(shipmentStatusActionLabels[status])}</button>`).join('')}</div></td>
    </tr>
  `).join('') : '<tr><td colspan="11">出荷対象の注文データがありません。</td></tr>';
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>出荷対象</p><strong>${shipments.length}</strong></article>
      <article class="stat-card"><p>出荷可能</p><strong>${statusCounts.ready || 0}</strong></article>
      <article class="stat-card"><p>保留</p><strong>${statusCounts.on_hold || 0}</strong></article>
      <article class="stat-card"><p>エラー</p><strong>${statusCounts.error || 0}</strong></article>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><div><h2>出荷キュー</h2><p class="help-text">出荷状態を更新し、エラー・保留を除いた出荷CSVを出力します。</p></div><button class="button secondary" type="button" id="export-shipment-csv">出荷CSV出力</button></div>
      <div class="responsive-table queue-table"><table><thead><tr><th>同梱グループ</th><th>対象注文番号</th><th>顧客名</th><th>取込元</th><th>出荷状態</th><th>配送先住所</th><th>SKU明細</th><th>理由</th><th>推奨配送会社</th><th>推定運賃</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
  document.querySelector('#export-shipment-csv')?.addEventListener('click', () => {
    const exportRows = makeShipmentExportRows(getExportableShipmentRows());
    downloadCsv('shipnavi-shipments.csv', exportRows);
    showToast('出荷CSVを出力しました。');
  });
}

function initShipmentQueue() {
  if (!document.querySelector('#shipment-queue-view')) return;
  renderShipmentQueue();
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-shipment-status][data-shipment-group-id]');
    if (!button) return;
    updateShipmentStatus(button.dataset.shipmentGroupId, button.dataset.shipmentStatus);
    renderShipmentQueue();
    showToast('出荷状態を更新しました。');
  });
}

function initTemplateDownloadActions() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-template-type][data-template-format]');
    if (!button) return;
    downloadImportTemplate(button.dataset.templateType, button.dataset.templateFormat);
  });
}

function renderSettings() {
  const target = document.querySelector('#settings-view');
  if (!target) return;
  const settings = getData('settings');
  target.outerHTML = `
    <section class="form-card full-width">
      <h2>設定</h2>
      <form id="settings-form"><div class="form-grid">
        <label class="input-group">会社名<input name="company" value="${escapeHtml(settings.company)}" required /></label>
        <label class="input-group">メール<input name="email" type="email" value="${escapeHtml(settings.email)}" required /></label>
        <label class="input-group">標準配送会社<input name="defaultCarrier" value="${escapeHtml(settings.defaultCarrier)}" /></label>
        <label class="input-group">締切時刻<input name="cutoffTime" value="${escapeHtml(settings.cutoffTime)}" /></label>
      </div><button class="button primary" type="submit">保存</button></form>
    </section>
    <section class="panel full-width"><h2>ブラウザ保存データ</h2><p>初期データを初期状態へ戻します。</p><button class="button secondary" type="button" id="reset-dashboard-data">リセット</button></section>
  `;
  document.querySelector('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    setData('settings', Object.fromEntries(new FormData(event.currentTarget).entries()));
    showToast('設定を保存しました。');
  });
  document.querySelector('#reset-dashboard-data')?.addEventListener('click', () => {
    Object.entries(keys).forEach(([name, key]) => storage.write(key, emptyData[name]));
    showToast('ブラウザ保存データをリセットしました。');
  });
}

if (document.body.classList.contains('app-body')) {
  seedDashboardData();
  initAppMenu();
  renderDashboard();
  initProducts();
  initCarriers();
  initOrders();
  renderTemplates();
  renderResults();
  initShipmentQueue();
  renderSettings();
  initImportIssueActions();
  initTemplateDownloadActions();
  renderGlobalImportIssues();
}
