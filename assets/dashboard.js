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
  fareImportMappingRules: 'shipnaviFareImportMappingRules',
};

const supportedCarriers = ['ヤマト', '佐川', '日本郵便'];
const shippingSizes = [60, 80, 100, 120, 140, 160];
const shipmentStatusModel = ['imported', 'pending', 'ready', 'shipped', 'on_hold', 'error'];
const shipmentStatusLabels = {
  imported: '取込済み',
  pending: '確認待ち',
  ready: '出荷準備完了',
  shipped: '出荷済み',
  on_hold: '保留',
  error: 'エラー',
};

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
  fareImportMappingRules: [],
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

function normalizeShipmentStatus(status) {
  return shipmentStatusModel.includes(status) ? status : 'imported';
}

function getShipmentStatuses() {
  const statuses = getData('shipmentStatuses');
  return statuses && typeof statuses === 'object' && !Array.isArray(statuses) ? statuses : {};
}

function setShipmentStatuses(statuses) {
  setData('shipmentStatuses', statuses && typeof statuses === 'object' && !Array.isArray(statuses) ? statuses : {});
}

function getShipmentStatus(shipmentGroupId) {
  return normalizeShipmentStatus(getShipmentStatuses()[shipmentGroupId]?.status);
}

function updateShipmentStatus(shipmentGroupId, status) {
  const normalizedStatus = normalizeShipmentStatus(status);
  const statuses = getShipmentStatuses();
  setShipmentStatuses({
    ...statuses,
    [shipmentGroupId]: {
      shipmentGroupId,
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
    },
  });
}

function getShipmentStatusLabel(status) {
  return shipmentStatusLabels[normalizeShipmentStatus(status)];
}

function getShipmentStatusClass(status) {
  return `shipment-status-${normalizeShipmentStatus(status).replace('_', '-')}`;
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

function parseCsvArrays(text) {
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
  return rows;
}

function parseCsv(text) {
  const rows = parseCsvArrays(text);
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
    <row r="${rowIndex + 1}">${row.map((value, cellIndex) => (
      normalize(value) ? `<c r="${columnName(cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>` : ''
    )).join('')}</row>`).join('');
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
  const matrixRows = (title, zoneHeaders, zoneGroups, fareRows) => {
    const maxPrefectureRows = Math.max(...zoneHeaders.map((zone) => zoneGroups[zone]?.length || 0));
    const prefectureRows = Array.from({ length: maxPrefectureRows }, (_, index) => [
      index === 0 ? '都道府県' : '',
      '',
      ...zoneHeaders.map((zone) => zoneGroups[zone]?.[index] || ''),
    ]);
    return [
      [title],
      ['着地', '', ...zoneHeaders],
      ...prefectureRows,
      ['3辺合計(cm)', '重量(kg)', ...zoneHeaders.map(() => '')],
      ...fareRows,
    ];
  };
  const yamatoZones = ['北海道', '北東北', '南東北', '関東', '東京', '信越', '北陸', '中部', '関西', '中国', '四国', '九州', '沖縄'];
  const yamatoGroups = {
    北海道: ['北海道'],
    北東北: ['青森県', '岩手県', '秋田県'],
    南東北: ['宮城県', '山形県', '福島県'],
    関東: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '神奈川県', '山梨県'],
    東京: ['東京都'],
    信越: ['新潟県', '長野県'],
    北陸: ['富山県', '石川県', '福井県'],
    中部: ['愛知県', '岐阜県', '静岡県', '三重県'],
    関西: ['大阪府', '京都府', '兵庫県', '奈良県', '滋賀県', '和歌山県'],
    中国: ['岡山県', '広島県', '山口県', '鳥取県', '島根県'],
    四国: ['香川県', '徳島県', '愛媛県', '高知県'],
    九州: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'],
    沖縄: ['沖縄県'],
  };
  const sagawaZones = ['北海道', '北東北', '南東北', '関東', '信越', '東海', '北陸', '関西', '中国', '四国', '北九州', '南九州', '沖縄'];
  const sagawaGroups = {
    北海道: ['北海道'],
    北東北: ['青森県', '岩手県', '秋田県'],
    南東北: ['宮城県', '山形県', '福島県'],
    関東: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '山梨県'],
    信越: ['新潟県', '長野県'],
    東海: ['岐阜県', '静岡県', '愛知県', '三重県'],
    北陸: ['富山県', '石川県', '福井県'],
    関西: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
    中国: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
    四国: ['徳島県', '香川県', '愛媛県', '高知県'],
    北九州: ['福岡県', '佐賀県', '長崎県', '大分県'],
    南九州: ['熊本県', '宮崎県', '鹿児島県'],
    沖縄: ['沖縄県'],
  };
  const postZones = ['北海道', '東北', '関東', '東京', '南関東', '信越', '北陸', '東海', '近畿', '中国', '四国', '九州', '沖縄'];
  const postGroups = {
    北海道: ['北海道'],
    東北: ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
    関東: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県'],
    東京: ['東京都'],
    南関東: ['神奈川県', '山梨県'],
    信越: ['新潟県', '長野県'],
    北陸: ['富山県', '石川県', '福井県'],
    東海: ['岐阜県', '静岡県', '愛知県', '三重県'],
    近畿: ['滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
    中国: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
    四国: ['徳島県', '香川県', '愛媛県', '高知県'],
    九州: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'],
    沖縄: ['沖縄県'],
  };
  const fareRows = [
    ...matrixRows('ヤマト運輸', yamatoZones, yamatoGroups, [
      ['60', '2', '700', '500', '460', '430', '430', '460', '460', '460', '500', '550', '550', '700', '1240'],
      ['80', '5', '900', '700', '660', '480', '480', '660', '660', '660', '700', '770', '770', '900', '1740'],
      ['100', '10', '1100', '900', '860', '650', '650', '860', '860', '860', '900', '990', '990', '800', '2240'],
      ['120', '15', '1300', '1100', '1060', '850', '850', '1060', '1060', '1060', '1100', '1210', '1210', '1300', '2740'],
      ['140', '20', '1500', '1300', '1260', '1050', '1050', '1260', '1260', '1260', '1300', '1430', '1430', '1500', '3260'],
      ['160', '25', '1700', '1500', '1460', '1250', '1250', '1460', '1460', '1460', '1500', '1650', '1650', '1700', '3780'],
    ]),
    [],
    ...matrixRows('佐川急便 飛脚宅配便', sagawaZones, sagawaGroups, [
      ['60', '2', '770', '550', '520', '500', '520', '520', '520', '550', '620', '650', '720', '760', '1300'],
      ['80', '5', '990', '770', '740', '700', '740', '740', '740', '770', '850', '880', '980', '1020', '1800'],
      ['100', '10', '1210', '990', '960', '900', '960', '960', '960', '990', '1080', '1120', '1230', '1280', '2300'],
      ['120', '15', '1430', '1210', '1180', '1100', '1180', '1180', '1180', '1210', '1320', '1360', '1490', '1540', '2800'],
      ['140', '20', '1650', '1430', '1400', '1300', '1400', '1400', '1400', '1430', '1560', '1600', '1750', '1800', '3300'],
      ['160', '25', '1870', '1650', '1620', '1500', '1620', '1620', '1620', '1650', '1800', '1840', '2010', '2060', '3800'],
    ]),
    [],
    ...matrixRows('日本郵便 ゆうパック', postZones, postGroups, [
      ['60', '25', '1410', '880', '880', '820', '880', '880', '880', '880', '990', '1150', '1150', '1410', '1450'],
      ['80', '25', '1710', '1200', '1200', '1130', '1200', '1200', '1200', '1200', '1310', '1440', '1440', '1710', '1810'],
      ['100', '25', '2020', '1500', '1500', '1450', '1500', '1500', '1500', '1500', '1620', '1780', '1780', '2020', '2160'],
      ['120', '25', '2340', '1830', '1830', '1770', '1830', '1830', '1830', '1830', '1940', '2080', '2080', '2340', '2490'],
      ['140', '25', '2680', '2170', '2170', '2120', '2170', '2170', '2170', '2170', '2300', '2440', '2440', '2680', '2860'],
      ['160', '25', '3010', '2500', '2500', '2450', '2500', '2500', '2500', '2500', '2610', '2750', '2750', '3010', '3180'],
    ]),
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
    ['マトリクス形式', '1行目に配送会社とサービス、着地行に地域、３辺合計(cm)と重量(kg)の行に見出しを入力します。'],
    ['縦持ち形式', '配送会社、サービス、配送サイズ、配送地域、送料、重量上限を縦持ちで入力する既存形式も利用できます。'],
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

function createImportFileResult({ rows = [], rawRows = [], sourceType = '', sheetName = '', warnings = [], errors = [] } = {}) {
  return { rows, rawRows, sourceType, sheetName, warnings, errors };
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
      path: normalizeWorkbookTargetPath(target),
    };
  });
}

function normalizeWorkbookTargetPath(target = '') {
  const clean = String(target || '').replace(/^\//, '');
  if (clean.startsWith('xl/')) return clean;
  const parts = `xl/${clean}`.split('/');
  const normalizedParts = [];
  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') normalizedParts.pop();
    else normalizedParts.push(part);
  });
  return normalizedParts.join('/');
}

function worksheetEntriesFromZip(entries) {
  return Object.keys(entries)
    .filter((path) => /^xl\/worksheets\/[^/]+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }))
    .map((path, index) => ({ name: `Sheet${index + 1}`, path }));
}

function parseWorksheetRows(xml = '', sharedStrings = []) {
  const parsedRows = [...String(xml).matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)]
    .map(([rowXml], rowMatchIndex) => {
      const rowTag = rowXml.match(/<row\b[^>]*>/)?.[0] || '';
      const rowNumber = toNumber(getXmlAttribute(rowTag, 'r'));
      const rowIndex = rowNumber > 0 ? rowNumber - 1 : rowMatchIndex;
      const row = [];
      let maxColIndex = -1;
      [...rowXml.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)].forEach(([cellXml]) => {
        const openTag = cellXml.match(/<c\b[^>]*>/)?.[0] || '';
        const cellType = getXmlAttribute(openTag, 't');
        const ref = getXmlAttribute(openTag, 'r');
        const colIndex = Math.max(0, columnIndexFromCellRef(ref));
        maxColIndex = Math.max(maxColIndex, colIndex);
        let value = '';
        if (cellType === 's') {
          const sharedIndex = toNumber(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]);
          value = sharedStrings[sharedIndex] || '';
        } else if (cellType === 'inlineStr') {
          value = [...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => xmlDecode(match[1])).join('');
        } else if (cellType === 'str') {
          value = xmlDecode(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '');
        } else {
          value = xmlDecode(cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '');
        }
        row[colIndex] = normalize(value);
      });
      return { rowIndex, row: trimEmptyTrailingCells(Array.from({ length: maxColIndex + 1 }, (_, index) => row[index] || '')) };
    })
    .filter(({ row }) => row.some((value) => normalize(value)));
  const maxRowIndex = Math.max(-1, ...parsedRows.map(({ rowIndex }) => rowIndex));
  if (maxRowIndex < 0) return [];
  const byRowIndex = Object.fromEntries(parsedRows.map(({ rowIndex, row }) => [rowIndex, row]));
  return Array.from({ length: maxRowIndex + 1 }, (_, rowIndex) => byRowIndex[rowIndex] || []);
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
  const worksheetFallbacks = worksheetEntriesFromZip(entries);
  const warnings = [];
  for (const sheet of [...sheets, ...worksheetFallbacks.filter((fallback) => !sheets.some((sheet) => sheet.path === fallback.path))]) {
    const rowArrays = parseWorksheetRows(entries[sheet.path] || '', sharedStrings);
    if (!rowArrays.length) continue;
    return createImportFileResult({ rows: rowsArrayToObjects(rowArrays), rawRows: rowArrays, sourceType: 'xlsx', sheetName: sheet.name, warnings });
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
  return readFileAsText(file, (text) => {
    const rawRows = parseCsvArrays(text);
    callback(createImportFileResult({ rows: parseCsv(text), rawRows, sourceType: 'csv', sheetName: '', warnings: [], errors: [] }));
  });
}

function normalizeMatrixView(view) {
  if (!view || typeof view !== 'object') return null;
  if (Array.isArray(view.tables)) {
    const tables = view.tables.map(normalizeMatrixView).filter((table) => table?.rows?.length);
    if (!tables.length) return null;
    return { ...tables[0], tables };
  }
  const zoneHeaders = Array.isArray(view.zoneHeaders) ? view.zoneHeaders.map((zone) => compactText(zone)).filter(Boolean) : [];
  const zoneGroups = zoneHeaders.reduce((groups, zone) => {
    const rawPrefectures = view.zoneGroups?.[zone] || view.prefectures?.[zone] || [];
    groups[zone] = Array.isArray(rawPrefectures) ? rawPrefectures.map(compactText).filter(Boolean) : [];
    return groups;
  }, {});
  const rawPrefectureRows = Array.isArray(view.prefectureRows) ? view.prefectureRows : [];
  const prefectureRows = rawPrefectureRows.length
    ? rawPrefectureRows.map((row) => ({
      label: compactText(row?.label || ''),
      cells: Object.fromEntries(zoneHeaders.map((zone) => [zone, compactText(row?.cells?.[zone] ?? row?.[zone] ?? '')])),
    })).filter((row) => row.label || Object.values(row.cells).some(Boolean))
    : Array.from({ length: Math.max(0, ...Object.values(zoneGroups).map((prefectures) => prefectures.length)) }, (_, rowIndex) => ({
      label: rowIndex === 0 ? '都道府県' : '',
      cells: Object.fromEntries(zoneHeaders.map((zone) => [zone, zoneGroups[zone]?.[rowIndex] || ''])),
    }));
  const carrier = normalizeCarrier(view.carrier || 'ヤマト');
  return {
    carrier,
    carrierLabel: compactText(view.carrierLabel || view.titleCarrier || view.displayCarrier || view.carrier || carrier),
    service: normalize(view.service || '宅急便'),
    sizeLabel: compactText(view.sizeLabel || 'サイズ') || 'サイズ',
    weightLabel: compactText(view.weightLabel || '重量') || '重量',
    zoneHeaders,
    zoneGroups,
    prefectureRows,
    rows: Array.isArray(view.rows) ? view.rows.map((row) => ({
      size: normalizeSize(row?.size),
      weight: normalize(row?.weight),
      fares: Object.fromEntries(zoneHeaders.map((zone) => [zone, normalize(row?.fares?.[zone]) ? String(toNumber(row?.fares?.[zone])) : ''])),
    })).filter((row) => row.size || row.weight || Object.values(row.fares).some((fare) => toNumber(fare) > 0)) : [],
  };
}

function getMatrixTables(matrixView) {
  const normalizedMatrixView = normalizeMatrixView(matrixView);
  if (!normalizedMatrixView) return [];
  if (Array.isArray(normalizedMatrixView.tables)) return normalizedMatrixView.tables;
  return normalizedMatrixView.rows?.length ? [normalizedMatrixView] : [];
}

function makeMatrixViewState(tables) {
  const normalizedTables = tables.map(normalizeMatrixView).filter((table) => table?.rows?.length);
  return normalizedTables.length ? normalizeMatrixView({ tables: normalizedTables }) : null;
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
  const zoneSignals = ['北海道', '東北', '北東北', '南東北', '東京', '東京都', '関東', '南関東', '信越', '北陸', '中部', '東海', '関西', '近畿', '中国', '四国', '九州', '北九州', '南九州', '沖縄'];
  const knownMatrixHeaders = ['size', 'サイズ', 'サイズ(cm)', 'サイズ(mm)', '総長', '重量', '重量kg', '重量(kg)', 'weight', 'weightlimit'];
  const knownVerticalHeaders = ['carrier', '配送会社', 'service', 'サービス', 'size', 'サイズ', 'zone', '地域', '配送地域', 'fare', '運賃', '送料', 'weightlimit', '重量', '重量kg'];
  const hasZoneColumn = normalizedHeaders.some((header) => ['zone', '地域', '配送地域', '地区'].includes(header) || zoneSignals.includes(header)) || Boolean(matrixView?.zoneHeaders?.length);
  if (fareFormat === 'matrix' && matrixView?.rows?.length && normalizedRows?.length) {
    const knownMatrixZones = ['北海道', '東北', '北東北', '南東北', '関東', '東京', '東京都', '南関東', '信越', '北陸', '中部', '東海', '関西', '近畿', '中国', '四国', '九州', '北九州', '南九州', '沖縄'];
    matrixView.zoneHeaders
      .filter((zone) => normalize(zone) && !knownMatrixZones.includes(normalize(zone)))
      .forEach((zone) => {
        issues.push(appendImportIssue({
          type: 'column_name_mismatch',
          sourceFlow: 'fare_import',
          sourceFileName,
          field: zone,
          detectedColumn: zone,
          message: '列名を確認してください。運賃表の項目として自動判定できませんでした。',
        }));
      });
    matrixView.rows.forEach((row, index) => {
      const rowNumber = index + 1;
      if (!normalize(row.size)) {
        issues.push(appendImportIssue({ type: 'missing_size', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'size', message: 'サイズが見つかりません。' }));
      }
      if (/mm|㎜|ミリ/i.test(`${matrixView.sizeLabel} ${row.size}`)) {
        issues.push(appendImportIssue({ type: 'unit_mismatch', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'size', message: 'サイズ単位を確認してください。cm単位のサイズとして取り込んでください。' }));
      }
      if (normalize(row.weight) && !/^[0-9.,]+$/.test(normalize(row.weight))) {
        issues.push(appendImportIssue({ type: 'invalid_weight_limit', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'weightLimit', message: '重量上限の形式を確認してください。' }));
        issues.push(appendImportIssue({ type: 'unit_mismatch', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: 'weightLimit', message: '重量単位を確認してください。' }));
      }
      matrixView.zoneHeaders.forEach((zone) => {
        if (!normalize(row.fares?.[zone]) || toNumber(row.fares?.[zone]) <= 0) {
          issues.push(appendImportIssue({ type: 'missing_fare', sourceFlow: 'fare_import', sourceFileName, rowNumber, field: zone || 'fare', message: '運賃が見つかりません。' }));
        }
      });
    });
    return issues;
  }
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
  const prefectures = Array.isArray(row.prefectures) ? row.prefectures.map(compactText).filter(Boolean) : [];
  return {
    id: row.id || makeId('rate'),
    carrier: normalizeCarrier(row.carrier),
    service: normalize(row.service),
    size: normalizeSize(row.size),
    weight: normalize(row.weight || row.weightLimit),
    weightLimit: parseWeightLimitValue(row.weightLimit || row.weight) || '0',
    zone: normalize(row.zone) || 'default',
    prefectures,
    fare: String(toNumber(row.fare)),
  };
}

function rowArraysFromRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (Array.isArray(rows[0])) return rows;
  const headers = Object.keys(rows[0] || {});
  return [headers, ...rows.map((row) => headers.map((header) => row[header] || ''))];
}

function isMatrixSizeHeader(value) {
  const header = normalizeHeader(value);
  return ['size', 'サイズ', 'サイズ(cm)', 'サイズ(mm)', '総長', '3辺合計(cm)', '三辺合計(cm)'].includes(header)
    || header.includes('3辺合計')
    || header.includes('三辺合計');
}

function isMatrixWeightHeader(value) {
  return ['weight', 'weightlimit', '重量', '重量(kg)', '重量kg'].includes(normalizeHeader(value));
}

function inferMatrixCarrierService(title, fallbackCarrier = 'ヤマト', fallbackService = '宅急便') {
  const text = compactText(title);
  const carrier = normalizeCarrier(text || fallbackCarrier);
  let service = normalize(text.replace(/ヤマト運輸|ヤマト|佐川急便|佐川|日本郵便/g, ''));
  if (!service || service === carrier) service = normalize(fallbackService);
  if (['ヤマト', 'ヤマト運輸'].includes(carrier) && !service) service = '宅急便';
  if (carrier === 'ヤマト' && !service.includes('宅急便')) service = service || '宅急便';
  return { carrier, service: service || '宅急便' };
}

function matrixWeightValue(value, weightLabel) {
  const text = normalize(value);
  if (!text) return '';
  return /kg|キロ/i.test(weightLabel) && !/kg|g|キロ|グラム/i.test(text) ? `${text}kg` : text;
}

function matrixDisplayCarrier(carrier, label = '') {
  const display = compactText(label || carrier);
  if (carrier === 'ヤマト' && display === 'ヤマト') return 'ヤマト運輸';
  return display || carrier;
}

function isMatrixPrefectureLabel(value) {
  const header = normalizeHeader(value);
  return ['都道府県', '県', '府県', '地域'].includes(header);
}

const japanesePrefectures = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '山梨県',
  '新潟県', '長野県', '富山県', '石川県', '福井県', '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

function isJapanesePrefecture(value) {
  return japanesePrefectures.includes(compactText(value));
}

const japaneseMatrixZones = ['北海道', '東北', '北東北', '南東北', '関東', '東京', '南関東', '信越', '北陸', '中部', '東海', '関西', '近畿', '中国', '四国', '九州', '北九州', '南九州', '沖縄'];

function isValidMatrixZoneHeader(value) {
  const text = compactText(value);
  if (!text) return false;
  if (/^[0-9.,]+$/.test(text)) return false;
  if (isMatrixSizeHeader(text) || isMatrixWeightHeader(text) || isMatrixPrefectureLabel(text)) return false;
  if (isJapanesePrefecture(text) && text !== '北海道') return false;
  return japaneseMatrixZones.includes(text) || /地方|地域|エリア|Zone|ZONE/.test(text);
}

function columnInputToIndex(value) {
  const text = compactText(value);
  if (!text) return -1;
  if (/^[0-9]+$/.test(text)) return Math.max(0, toNumber(text) - 1);
  return columnIndexFromCellRef(text);
}

function rowInputToIndex(value) {
  const text = compactText(value);
  if (!text) return -1;
  const number = toNumber(text.replace(/[^0-9]/g, ''));
  return number > 0 ? number - 1 : -1;
}

function cellInputToPosition(value) {
  const text = compactText(value);
  const match = text.match(/^([A-Z]+)([0-9]+)$/i);
  return match ? { row: rowInputToIndex(match[2]), col: columnInputToIndex(match[1]) } : { row: -1, col: -1 };
}

function getFareImportMappingRules() {
  const rules = getData('fareImportMappingRules');
  return Array.isArray(rules) ? rules : [];
}

function saveFareImportMappingRule(rule) {
  const normalizedRule = normalizeFareImportMappingRule(rule);
  const rules = getFareImportMappingRules().filter((saved) => normalize(saved.name) !== normalizedRule.name);
  setData('fareImportMappingRules', [...rules, normalizedRule]);
  return normalizedRule;
}

function deleteFareImportMappingRule(ruleName) {
  const name = normalize(ruleName);
  const rules = getFareImportMappingRules().filter((saved) => normalize(saved.name) !== name);
  setData('fareImportMappingRules', rules);
  return rules;
}

function renameFareImportMappingRule(oldName, newName) {
  const currentName = normalize(oldName);
  const nextName = normalize(newName);
  if (!currentName || !nextName) return null;
  const rules = getFareImportMappingRules();
  const target = rules.find((rule) => normalize(rule.name) === currentName);
  if (!target) return null;
  const renamed = normalizeFareImportMappingRule({ ...target, name: nextName });
  setData('fareImportMappingRules', [...rules.filter((rule) => normalize(rule.name) !== currentName && normalize(rule.name) !== nextName), renamed]);
  return renamed;
}

function normalizeFareImportMappingRule(rule = {}) {
  const carrierCell = cellInputToPosition(rule.carrierCell || '');
  const serviceCell = cellInputToPosition(rule.serviceCell || '');
  return {
    name: normalize(rule.name) || `運賃表マッピング ${new Date().toLocaleString('ja-JP')}`,
    carrier: normalize(rule.carrier),
    service: normalize(rule.service),
    carrierCell: normalize(rule.carrierCell),
    serviceCell: normalize(rule.serviceCell),
    carrierRow: rule.carrierRow ?? carrierCell.row + 1,
    carrierCol: rule.carrierCol ?? (carrierCell.col >= 0 ? columnName(carrierCell.col) : ''),
    serviceRow: rule.serviceRow ?? serviceCell.row + 1,
    serviceCol: rule.serviceCol ?? (serviceCell.col >= 0 ? columnName(serviceCell.col) : ''),
    zoneHeaderRow: rowInputToIndex(rule.zoneHeaderRow) + 1,
    zoneStartCol: normalize(rule.zoneStartCol),
    zoneEndCol: normalize(rule.zoneEndCol),
    prefectureStartRow: rowInputToIndex(rule.prefectureStartRow) + 1,
    prefectureEndRow: rowInputToIndex(rule.prefectureEndRow) + 1,
    sizeCol: normalize(rule.sizeCol),
    weightCol: normalize(rule.weightCol),
    fareStartRow: rowInputToIndex(rule.fareStartRow) + 1,
    fareEndRow: rowInputToIndex(rule.fareEndRow) + 1,
  };
}

function createMatrixViewFromMapping(rows, mapping = {}) {
  const rowArrays = rowArraysFromRows(rows).map((row) => Array.from({ length: row.length }, (_, index) => compactText(row[index])));
  const rule = normalizeFareImportMappingRule(mapping);
  const zoneRowIndex = rowInputToIndex(rule.zoneHeaderRow);
  const zoneStartIndex = columnInputToIndex(rule.zoneStartCol);
  const zoneEndIndex = columnInputToIndex(rule.zoneEndCol);
  const prefectureStartIndex = rowInputToIndex(rule.prefectureStartRow);
  const prefectureEndIndex = rowInputToIndex(rule.prefectureEndRow);
  const sizeIndex = columnInputToIndex(rule.sizeCol);
  const weightIndex = columnInputToIndex(rule.weightCol);
  const fareStartIndex = rowInputToIndex(rule.fareStartRow);
  const fareEndIndex = rowInputToIndex(rule.fareEndRow);
  if ([zoneRowIndex, zoneStartIndex, zoneEndIndex, sizeIndex, weightIndex, fareStartIndex, fareEndIndex].some((index) => index < 0)) return null;
  const zoneHeaders = rowArrays[zoneRowIndex]?.slice(zoneStartIndex, zoneEndIndex + 1).map(compactText).filter(Boolean) || [];
  if (!zoneHeaders.length) return null;
  const carrierPosition = cellInputToPosition(rule.carrierCell);
  const servicePosition = cellInputToPosition(rule.serviceCell);
  const carrierText = rule.carrier || (carrierPosition.row >= 0 ? rowArrays[carrierPosition.row]?.[carrierPosition.col] : '') || 'ヤマト';
  const serviceText = rule.service || (servicePosition.row >= 0 ? rowArrays[servicePosition.row]?.[servicePosition.col] : '') || '宅急便';
  const { carrier, service } = inferMatrixCarrierService(`${carrierText} ${serviceText}`, carrierText, serviceText);
  const prefectureRows = rowArrays.slice(prefectureStartIndex, prefectureEndIndex + 1)
    .map((row, index) => ({
      label: index === 0 ? compactText(row[0] || '都道府県') : compactText(row[0] || ''),
      cells: Object.fromEntries(zoneHeaders.map((zone, zoneIndex) => {
        const value = compactText(row[zoneStartIndex + zoneIndex]);
        return [zone, isJapanesePrefecture(value) ? value : ''];
      })),
    }))
    .filter((row) => row.label || Object.values(row.cells).some(Boolean));
  const zoneGroups = Object.fromEntries(zoneHeaders.map((zone) => [
    zone,
    prefectureRows.map((row) => row.cells[zone]).filter(Boolean),
  ]));
  return normalizeMatrixView({
    carrier,
    carrierLabel: matrixDisplayCarrier(carrier, carrierText),
    service,
    sizeLabel: rowArrays[Math.max(0, fareStartIndex - 1)]?.[sizeIndex] || '3辺合計(cm)',
    weightLabel: rowArrays[Math.max(0, fareStartIndex - 1)]?.[weightIndex] || '重量(kg)',
    zoneHeaders,
    zoneGroups,
    prefectureRows,
    rows: rowArrays.slice(fareStartIndex, fareEndIndex + 1).map((row) => ({
      size: row[sizeIndex],
      weight: row[weightIndex],
      fares: Object.fromEntries(zoneHeaders.map((zone, zoneIndex) => [zone, row[zoneStartIndex + zoneIndex] || ''])),
    })),
  });
}

function previewFareImportMapping(rows, mapping = {}) {
  const matrixView = createMatrixViewFromMapping(rows, mapping);
  const normalizedFareRows = matrixView ? normalizeFareMatrix(matrixView) : [];
  const validation = validateFareImportMapping(rows, mapping, matrixView, normalizedFareRows);
  return {
    valid: validation.valid,
    guidance: validation.guidance,
    matrixView,
    normalizedFareRows,
    carrier: matrixView?.carrier || '',
    service: matrixView?.service || '',
    zones: matrixView?.zoneHeaders || [],
    zoneGroups: matrixView?.zoneGroups || {},
    tiers: matrixView?.rows?.map((row) => ({ size: row.size, weight: row.weight })) || [],
    fareCellCount: normalizedFareRows.length,
    samples: normalizedFareRows.slice(0, 8),
  };
}

function validateFareImportMapping(rows, mapping = {}, matrixView = null, normalizedFareRows = null) {
  const view = matrixView || createMatrixViewFromMapping(rows, mapping);
  const fareRows = normalizedFareRows || (view ? normalizeFareMatrix(view) : []);
  const guidance = [];
  if (!view?.carrier) guidance.push('配送会社セルまたは配送会社名を指定してください。');
  if (!view?.zoneHeaders?.length) guidance.push('地域ヘッダー行を確認してください。');
  if (!view?.rows?.some((row) => normalize(row.size))) guidance.push('サイズ列または運賃開始/終了行を確認してください。');
  if (!view?.rows?.some((row) => normalize(row.weight))) guidance.push('重量列または運賃開始/終了行を確認してください。');
  if (!view?.rows?.some((row) => Object.values(row.fares || {}).some((fare) => toNumber(fare) > 0))) guidance.push('運賃範囲を確認してください。');
  if (!fareRows.length) guidance.push('normalizedFareRowsを生成できません。マッピング範囲を見直してください。');
  return { valid: guidance.length === 0, guidance, matrixView: view, normalizedFareRows: fareRows };
}

function getFareImportConfidence(fareFormat, matrixView, importedRows) {
  const reasons = [];
  if (fareFormat !== 'matrix') reasons.push('マトリクス形式として自動判定できませんでした。');
  if (!matrixView?.zoneHeaders?.length) reasons.push('ゾーン見出しを確認できませんでした。');
  if (matrixView?.zoneHeaders?.some((zone) => /^[0-9.,]+$/.test(normalize(zone)))) reasons.push('数値がゾーン見出しとして検出されています。');
  if (!matrixView?.rows?.some((row) => normalize(row.size))) reasons.push('サイズ行を確認できませんでした。');
  if (!matrixView?.rows?.some((row) => normalize(row.weight))) reasons.push('重量行を確認できませんでした。');
  if (!importedRows?.length) reasons.push('正規化運賃行を生成できませんでした。');
  const confidence = reasons.length === 0 ? 100 : Math.max(0, 100 - (reasons.length * 20));
  const level = confidence >= 80 ? '高' : (confidence >= 50 ? '中' : '低');
  return { level, confidence, score: confidence, reasons };
}

function shouldOpenFareMappingWizard(fareFormat, matrixView, importedRows) {
  return getFareImportConfidence(fareFormat, matrixView, importedRows).confidence < 80;
}

function createRealMatrixViewFromRows(rowArrays, zoneRowIndex, fallbackCarrier = 'ヤマト', fallbackService = '宅急便', endIndex = rowArrays.length) {
  if (zoneRowIndex < 0) return null;
  const headerRowIndex = rowArrays.findIndex((row, index) => index > zoneRowIndex && index < endIndex && row.some(isMatrixSizeHeader) && row.some(isMatrixWeightHeader));
  if (headerRowIndex < 0) return null;
  const headerRow = rowArrays[headerRowIndex];
  const sizeIndex = headerRow.findIndex(isMatrixSizeHeader);
  const weightIndex = headerRow.findIndex(isMatrixWeightHeader);
  const dataStartIndex = Math.max(sizeIndex, weightIndex) + 1;
  const zoneLabelIndex = rowArrays[zoneRowIndex].findIndex((cell) => normalizeHeader(cell) === '着地');
  const zoneStartIndex = rowArrays[zoneRowIndex].findIndex((zone, index) => index > zoneLabelIndex && isValidMatrixZoneHeader(zone));
  if (zoneStartIndex < 0) return null;
  const zoneEntries = rowArrays[zoneRowIndex]
    .map((zone, index) => ({ zone, index, fareIndex: dataStartIndex + index - zoneStartIndex }))
    .filter(({ zone, index }) => index >= zoneStartIndex && isValidMatrixZoneHeader(zone));
  if (!zoneEntries.length) return null;
  const title = [...rowArrays.slice(0, zoneRowIndex)].reverse().find((row) => row.some((cell) => normalize(cell) && normalizeHeader(cell) !== '着地' && !isMatrixSizeHeader(cell) && !isMatrixWeightHeader(cell)))?.filter(Boolean).join(' ') || '';
  const { carrier, service } = inferMatrixCarrierService(title, fallbackCarrier, fallbackService);
  const rawCarrierLabel = compactText(title.replace(service, '').trim()) || carrier;
  const zoneGroups = Object.fromEntries(zoneEntries.map(({ zone, index }) => [
    zone,
    rowArrays
      .slice(zoneRowIndex + 1, headerRowIndex)
      .map((row) => row[index])
      .map(compactText)
      .filter((value) => value && !isMatrixPrefectureLabel(value) && isJapanesePrefecture(value)),
  ]));
  const prefectureRows = rowArrays.slice(zoneRowIndex + 1, headerRowIndex)
    .map((row) => ({
      label: row.slice(0, zoneStartIndex).find(isMatrixPrefectureLabel) || '',
      cells: Object.fromEntries(zoneEntries.map(({ zone, index }) => {
        const value = compactText(row[index]);
        return [zone, isJapanesePrefecture(value) ? value : ''];
      })),
    }))
    .filter((row) => Object.values(row.cells).some(Boolean));
  return normalizeMatrixView({
    carrier,
    carrierLabel: matrixDisplayCarrier(carrier, rawCarrierLabel),
    service,
    sizeLabel: headerRow[sizeIndex] || 'サイズ',
    weightLabel: headerRow[weightIndex] || '重量',
    zoneHeaders: zoneEntries.map(({ zone }) => zone),
    zoneGroups,
    prefectureRows,
    rows: rowArrays.slice(headerRowIndex + 1, endIndex).map((row) => ({
      size: row[sizeIndex],
      weight: row[weightIndex],
      fares: Object.fromEntries(zoneEntries.map(({ zone, fareIndex }) => [zone, row[fareIndex] || ''])),
    })),
  });
}

function createRealMatrixViews(rows, fallbackCarrier = 'ヤマト', fallbackService = '宅急便') {
  const rowArrays = rowArraysFromRows(rows).map((row) => Array.from({ length: row.length }, (_, index) => compactText(row[index])));
  const zoneRowIndexes = rowArrays
    .map((row, index) => (row.some((cell) => normalizeHeader(cell) === '着地') ? index : -1))
    .filter((index) => index >= 0);
  return zoneRowIndexes
    .map((zoneRowIndex, index) => createRealMatrixViewFromRows(rowArrays, zoneRowIndex, fallbackCarrier, fallbackService, zoneRowIndexes[index + 1] ?? rowArrays.length))
    .filter((view) => view?.rows?.length);
}

function createRealMatrixView(rows, fallbackCarrier = 'ヤマト', fallbackService = '宅急便') {
  return createRealMatrixViews(rows, fallbackCarrier, fallbackService)[0] || null;
}

function createMatrixView(rows, carrierName = 'ヤマト', serviceName = '宅急便') {
  if (!rows.length) return null;
  const realMatrixViews = createRealMatrixViews(rows, carrierName, serviceName);
  if (realMatrixViews.length > 1) return makeMatrixViewState(realMatrixViews);
  if (realMatrixViews.length === 1) return realMatrixViews[0];
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

function detectFareTableFormatDetails(headers, rows) {
  const rowArrays = rowArraysFromRows(rows).map((row) => Array.from({ length: row.length }, (_, index) => compactText(row[index])));
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const realMatrixView = createRealMatrixView(rows);
  const firstHeader = normalizedHeaders[0];
  const zoneSignals = ['北海道', '関東', '東京', '関西', '沖縄', '九州'];
  const headerMatrix = (['size', 'サイズ', '総長', 'サイズ(cm)', 'サイズ(mm)'].includes(firstHeader) || firstHeader.includes('サイズ')) && normalizedHeaders.some((header) => zoneSignals.includes(header));
  const vertical = hasHeaders(normalizedHeaders, ['carrier', 'service', 'size', 'zone', 'fare']) || hasHeaders(normalizedHeaders, ['配送会社', 'サービス', 'サイズ', '地域', '送料']);
  const allCells = rowArrays.flat().map(compactText).filter(Boolean);
  const carrierCandidate = allCells.find((cell) => supportedCarriers.some((carrier) => cell.includes(carrier))) || '';
  const serviceCandidate = allCells.find((cell) => /宅急便|飛脚|ゆうパック|サービス|便/.test(cell) && !isMatrixSizeHeader(cell) && !isMatrixWeightHeader(cell)) || '';
  const landingRowIndex = rowArrays.findIndex((row) => row.some((cell) => normalizeHeader(cell) === '着地'));
  const zoneHeaderRowIndex = landingRowIndex >= 0
    ? landingRowIndex
    : rowArrays.findIndex((row) => row.filter(isValidMatrixZoneHeader).length >= 3);
  const zoneHeaders = zoneHeaderRowIndex >= 0 ? rowArrays[zoneHeaderRowIndex].filter(isValidMatrixZoneHeader) : [];
  const prefectureRows = rowArrays.filter((row) => row.some(isJapanesePrefecture));
  const sizeRowIndex = rowArrays.findIndex((row) => row.some(isMatrixSizeHeader));
  const weightRowIndex = rowArrays.findIndex((row) => row.some(isMatrixWeightHeader));
  const fareValueCount = rowArrays
    .slice(Math.max(sizeRowIndex, weightRowIndex) + 1)
    .flat()
    .filter((cell) => toNumber(cell) > 0).length;
  const candidates = {
    carrier: carrierCandidate,
    service: serviceCandidate,
    landingRow: landingRowIndex >= 0 ? landingRowIndex + 1 : null,
    zoneHeaderRow: zoneHeaderRowIndex >= 0 ? zoneHeaderRowIndex + 1 : null,
    zoneHeaders,
    prefectureRowCount: prefectureRows.length,
    sizeRow: sizeRowIndex >= 0 ? sizeRowIndex + 1 : null,
    weightRow: weightRowIndex >= 0 ? weightRowIndex + 1 : null,
    fareValueCount,
  };
  const confidenceFactors = [
    Boolean(carrierCandidate),
    Boolean(serviceCandidate),
    landingRowIndex >= 0,
    zoneHeaders.length >= 3,
    prefectureRows.length > 0,
    sizeRowIndex >= 0,
    weightRowIndex >= 0,
    fareValueCount > 0,
  ];
  let confidence = Math.round((confidenceFactors.filter(Boolean).length / confidenceFactors.length) * 100);
  const reasons = [];
  if (!carrierCandidate) reasons.push('配送会社候補を確認できませんでした。');
  if (!serviceCandidate) reasons.push('サービス候補を確認できませんでした。');
  if (landingRowIndex < 0) reasons.push('着地行を確認できませんでした。');
  if (zoneHeaders.length < 3) reasons.push('地域ヘッダー行を確認してください。');
  if (!prefectureRows.length) reasons.push('都道府県行を確認できませんでした。');
  if (sizeRowIndex < 0) reasons.push('サイズ列を確認してください。');
  if (weightRowIndex < 0) reasons.push('重量列を確認してください。');
  if (!fareValueCount) reasons.push('運賃範囲を確認してください。');
  let format = 'unknown';
  if (vertical) format = 'vertical';
  else if (realMatrixView || headerMatrix) format = 'matrix';
  if (landingRowIndex < 0) confidence = Math.min(confidence, 70);
  if (format === 'unknown') confidence = Math.min(confidence, 60);
  return {
    format,
    confidence,
    reason: reasons.join(' '),
    reasons,
    detectedCandidates: candidates,
  };
}

function detectFareTableFormat(headers, rows) {
  return detectFareTableFormatDetails(headers, rows).format;
}

function normalizeFareMatrix(matrixInput, carrierName = 'ヤマト', serviceName = '宅急便') {
  const matrixView = Array.isArray(matrixInput) ? createMatrixView(matrixInput, carrierName, serviceName) : normalizeMatrixView(matrixInput);
  const matrixTables = getMatrixTables(matrixView);
  if (matrixTables.length > 1) return matrixTables.flatMap((table) => normalizeFareMatrix(table));
  if (!matrixView?.rows?.length) return [];
  return matrixView.rows.flatMap((row) => matrixView.zoneHeaders.map((zone) => normalizeFare({
    carrier: matrixView.carrier,
    service: matrixView.service,
    size: row.size,
    weight: row.weight,
    weightLimit: matrixWeightValue(row.weight, matrixView.weightLabel),
    zone,
    prefectures: matrixView.zoneGroups?.[zone] || [],
    fare: row.fares?.[zone],
  }))).filter((fare) => fare.size && fare.zone && toNumber(fare.fare) > 0);
}

function getProductsBySku() {
  return Object.fromEntries(getData('products').map((product) => [product.sku, product]));
}

function getFareRows() {
  return getFareTableState().normalizedFareRows;
}

function getZoneByFareGroups(address = '') {
  const normalizedAddress = normalize(address);
  if (!normalizedAddress) return '';
  const match = getFareRows()
    .map(normalizeFare)
    .find((fare) => fare.zone && fare.zone !== 'default' && fare.prefectures?.some((prefecture) => normalizedAddress.includes(prefecture)));
  return match?.zone || '';
}

function getShipmentFareZone(postal, address = '') {
  const zone = getZoneByPostal(postal, address);
  if (zone !== 'unknown') return zone;
  return getZoneByFareGroups(address) || zone;
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
  const zone = getShipmentFareZone(orders[0]?.postal, orders[0]?.address);
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
  return getShipmentOrderGroups().map((orders, index) => {
    const shipment = buildShipmentGroup(orders, index);
    return {
      ...shipment,
      shipmentStatus: getShipmentStatus(shipment.shipmentGroupId),
    };
  });
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
        <a class="action-card" href="shipment-queue.html"><b>出荷キュー</b><span>出荷状態の確認と出荷CSV出力</span></a>
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

let fareMappingWizardState = null;

const fareMappingSelectionFields = {
  carrierCell: { label: '配送会社セル', kind: 'cell' },
  serviceCell: { label: 'サービスセル', kind: 'cell' },
  zoneHeaderRow: { label: '地域ヘッダー行', kind: 'row' },
  zoneStartCol: { label: '地域開始列', kind: 'col' },
  zoneEndCol: { label: '地域終了列', kind: 'col' },
  prefectureStartRow: { label: '都道府県開始行', kind: 'row' },
  prefectureEndRow: { label: '都道府県終了行', kind: 'row' },
  sizeCol: { label: 'サイズ列', kind: 'col' },
  weightCol: { label: '重量列', kind: 'col' },
  fareStartRow: { label: '運賃開始行', kind: 'row' },
  fareEndRow: { label: '運賃終了行', kind: 'row' },
};

function fareMappingWizardContainer() {
  const form = document.querySelector('#fare-import-form');
  if (!form) return null;
  let container = document.querySelector('#fare-mapping-wizard');
  if (!container) {
    container = document.createElement('section');
    container.id = 'fare-mapping-wizard';
    container.className = 'fare-mapping-wizard';
    form.insertAdjacentElement('afterend', container);
  }
  return container;
}

function defaultFareMappingRule(rows, carrierName = '', serviceName = '') {
  const rowArrays = rowArraysFromRows(rows);
  const zoneRowIndex = rowArrays.findIndex((row) => row.some((cell) => normalizeHeader(cell) === '着地'));
  const headerRowIndex = rowArrays.findIndex((row) => row.some(isMatrixSizeHeader) && row.some(isMatrixWeightHeader));
  const headerRow = rowArrays[headerRowIndex] || [];
  const sizeIndex = headerRow.findIndex(isMatrixSizeHeader);
  const weightIndex = headerRow.findIndex(isMatrixWeightHeader);
  const zoneLabelIndex = zoneRowIndex >= 0 ? rowArrays[zoneRowIndex].findIndex((cell) => normalizeHeader(cell) === '着地') : -1;
  const zoneStartIndex = zoneRowIndex >= 0
    ? rowArrays[zoneRowIndex].findIndex((cell, index) => index > zoneLabelIndex && compactText(cell))
    : Math.max(sizeIndex, weightIndex) + 1;
  const zoneEndIndex = zoneRowIndex >= 0
    ? rowArrays[zoneRowIndex].reduce((last, cell, index) => (index >= zoneStartIndex && compactText(cell) ? index : last), zoneStartIndex)
    : Math.max(zoneStartIndex, rowArrays[0]?.length - 1 || zoneStartIndex);
  return normalizeFareImportMappingRule({
    name: carrierName ? `${carrierName} ${serviceName}`.trim() : '',
    carrier: carrierName,
    service: serviceName,
    carrierCell: 'A1',
    zoneHeaderRow: zoneRowIndex >= 0 ? zoneRowIndex + 1 : 2,
    zoneStartCol: columnName(Math.max(0, zoneStartIndex)),
    zoneEndCol: columnName(Math.max(zoneStartIndex, zoneEndIndex)),
    prefectureStartRow: zoneRowIndex >= 0 ? zoneRowIndex + 2 : 3,
    prefectureEndRow: headerRowIndex > zoneRowIndex ? headerRowIndex : 9,
    sizeCol: columnName(Math.max(0, sizeIndex)),
    weightCol: columnName(Math.max(1, weightIndex)),
    fareStartRow: headerRowIndex >= 0 ? headerRowIndex + 2 : 10,
    fareEndRow: rowArrays.length,
  });
}

function getFareMappingCellClasses(rowIndex, colIndex, rule = {}, activeField = '') {
  const classes = [];
  const carrier = cellInputToPosition(rule.carrierCell);
  const service = cellInputToPosition(rule.serviceCell);
  if (carrier.row === rowIndex && carrier.col === colIndex) classes.push('is-carrier-cell');
  if (service.row === rowIndex && service.col === colIndex) classes.push('is-service-cell');
  const zoneRow = rowInputToIndex(rule.zoneHeaderRow);
  const zoneStart = columnInputToIndex(rule.zoneStartCol);
  const zoneEnd = columnInputToIndex(rule.zoneEndCol);
  const prefectureStart = rowInputToIndex(rule.prefectureStartRow);
  const prefectureEnd = rowInputToIndex(rule.prefectureEndRow);
  const sizeCol = columnInputToIndex(rule.sizeCol);
  const weightCol = columnInputToIndex(rule.weightCol);
  const fareStart = rowInputToIndex(rule.fareStartRow);
  const fareEnd = rowInputToIndex(rule.fareEndRow);
  if (rowIndex === zoneRow && colIndex >= zoneStart && colIndex <= zoneEnd) classes.push('is-zone-range');
  if (rowIndex >= prefectureStart && rowIndex <= prefectureEnd && colIndex >= zoneStart && colIndex <= zoneEnd) classes.push('is-prefecture-range');
  if (colIndex === sizeCol && rowIndex >= fareStart && rowIndex <= fareEnd) classes.push('is-size-range');
  if (colIndex === weightCol && rowIndex >= fareStart && rowIndex <= fareEnd) classes.push('is-weight-range');
  if (rowIndex >= fareStart && rowIndex <= fareEnd && colIndex >= zoneStart && colIndex <= zoneEnd) classes.push('is-fare-range');
  if (activeField) {
    const meta = fareMappingSelectionFields[activeField];
    if (meta?.kind === 'row' && rowIndex === rowInputToIndex(rule[activeField])) classes.push('is-active-selection');
    if (meta?.kind === 'col' && colIndex === columnInputToIndex(rule[activeField])) classes.push('is-active-selection');
    if (meta?.kind === 'cell') {
      const active = cellInputToPosition(rule[activeField]);
      if (active.row === rowIndex && active.col === colIndex) classes.push('is-active-selection');
    }
  }
  return classes.join(' ');
}

function renderFarePreviewGrid(rows, rule = {}, activeField = '') {
  const rowArrays = rowArraysFromRows(rows);
  const previewRows = rowArrays.slice(0, 20);
  const maxCols = Math.min(20, Math.max(1, ...previewRows.map((row) => row.length)));
  const headerCells = Array.from({ length: maxCols }, (_, index) => `<th>${escapeHtml(columnName(index))}</th>`).join('');
  const bodyRows = previewRows.map((row, rowIndex) => `
    <tr>
      <th class="preview-row-number">${rowIndex + 1}</th>
      ${Array.from({ length: maxCols }, (_, colIndex) => `<td class="${getFareMappingCellClasses(rowIndex, colIndex, rule, activeField)}" data-fare-preview-cell data-row-index="${rowIndex}" data-col-index="${colIndex}">${escapeHtml(compactText(row[colIndex]))}</td>`).join('')}
    </tr>
  `).join('');
  return `
    <div class="fare-preview-grid-wrap">
      <table class="fare-preview-grid">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function mappingInput(name, label, value = '', placeholder = '') {
  const selectable = fareMappingSelectionFields[name] ? ` data-mapping-field="${name}"` : '';
  return `<label class="input-group compact-input">${label}<input name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${selectable} /></label>`;
}

function mappingFormValues() {
  const container = document.querySelector('#fare-mapping-wizard');
  if (!container) return {};
  const form = container.querySelector('[data-fare-mapping-form]');
  return form ? Object.fromEntries(new FormData(form).entries()) : {};
}

function renderFareMappingPreview(preview) {
  if (!preview?.valid) {
    return `
      <div class="mapping-guidance">
        <strong>取り込み前に修正してください</strong>
        <ul>${(preview?.guidance?.length ? preview.guidance : ['ゾーン、サイズ、重量、運賃のいずれかが不足しています。']).map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>
      </div>
    `;
  }
  const zones = preview.zones.map(escapeHtml).join(' / ');
  const groups = preview.zones.slice(0, 6).map((zone) => `${escapeHtml(zone)}: ${escapeHtml((preview.zoneGroups[zone] || []).join('、'))}`).join('<br>');
  const tiers = preview.tiers.slice(0, 6).map((tier) => `${escapeHtml(tier.size)} / ${escapeHtml(tier.weight)}`).join('、');
  const sampleTargets = [
    ['60', '北海道'],
    ['80', '関東'],
    ['160', '沖縄'],
  ];
  const targetSamples = sampleTargets
    .map(([size, zone]) => preview.normalizedFareRows.find((fare) => fare.size === size && fare.zone === zone))
    .filter(Boolean);
  const fallbackSamples = preview.samples.filter((fare) => !targetSamples.some((sample) => sample.size === fare.size && sample.zone === fare.zone));
  const displaySamples = [...targetSamples, ...fallbackSamples].slice(0, 8);
  return `
    <div class="mapping-preview-result">
      <p><strong>${escapeHtml(preview.carrier)} / ${escapeHtml(preview.service)}</strong></p>
      <p>ゾーン: ${zones}</p>
      <p>サイズ/重量: ${tiers}</p>
      <p>運賃セル数: ${preview.fareCellCount}</p>
      <p>${groups}</p>
      <div class="mapping-result-summary">
        <span>配送会社: <strong>${escapeHtml(preview.carrier)}</strong></span>
        <span>サービス: <strong>${escapeHtml(preview.service)}</strong></span>
        <span>ゾーン数: <strong>${preview.zones.length}</strong></span>
        <span>都道府県グループ数: <strong>${Object.values(preview.zoneGroups).filter((prefectures) => prefectures.length).length}</strong></span>
        <span>運賃行数: <strong>${preview.normalizedFareRows.length}</strong></span>
      </div>
      <div class="responsive-table">
        <table>
          <thead><tr><th>carrier</th><th>service</th><th>size</th><th>weight</th><th>zone</th><th>fare</th></tr></thead>
          <tbody>${displaySamples.map((fare) => `
            <tr>
              <td>${escapeHtml(fare.carrier)}</td>
              <td>${escapeHtml(fare.service)}</td>
              <td>${escapeHtml(fare.size)}</td>
              <td>${escapeHtml(fare.weight)}</td>
              <td>${escapeHtml(fare.zone)}</td>
              <td class="money-cell">${escapeHtml(fare.fare)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFareMappingResultConfirmation(preview) {
  if (!preview?.valid) return '';
  const samples = [
    ['60', '北海道'],
    ['80', '関東'],
    ['160', '沖縄'],
  ].map(([size, zone]) => preview.normalizedFareRows.find((fare) => fare.size === size && fare.zone === zone)).filter(Boolean);
  return `
    <div class="mapping-result-confirmation">
      <h4>直近の取込結果</h4>
      <div class="mapping-result-summary">
        <span>配送会社: <strong>${escapeHtml(preview.carrier)}</strong></span>
        <span>サービス: <strong>${escapeHtml(preview.service)}</strong></span>
        <span>ゾーン数: <strong>${preview.zones.length}</strong></span>
        <span>都道府県グループ数: <strong>${Object.values(preview.zoneGroups).filter((prefectures) => prefectures.length).length}</strong></span>
        <span>運賃行数: <strong>${preview.normalizedFareRows.length}</strong></span>
      </div>
      ${samples.length ? `<p class="help-text">サンプル運賃: ${samples.map((fare) => `${escapeHtml(fare.size)} ${escapeHtml(fare.zone)} ${escapeHtml(fare.fare)}円`).join(' / ')}</p>` : '<p class="help-text">指定サンプル運賃はこの表には含まれていません。</p>'}
    </div>
  `;
}

function renderFareMappingWizard(state = fareMappingWizardState) {
  const container = fareMappingWizardContainer();
  if (!container) return;
  if (!state) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  const rules = getFareImportMappingRules();
  const rule = normalizeFareImportMappingRule(state.rule || defaultFareMappingRule(state.rows, state.carrierName, state.serviceName));
  const preview = previewFareImportMapping(state.rows, rule);
  const confidence = state.confidence || getFareImportConfidence(state.fareFormat || 'unknown', state.matrixView || null, state.importedRows || []);
  const activeField = state.activeField || 'carrierCell';
  const selectedRuleName = state.selectedRuleName || '';
  const ruleOptions = ['<option value="">保存済みマッピングを選択</option>']
    .concat(rules.map((saved) => `<option value="${escapeHtml(saved.name)}" ${saved.name === selectedRuleName ? 'selected' : ''}>${escapeHtml(saved.name)}</option>`))
    .join('');
  container.innerHTML = `
    <div class="mapping-wizard-header">
      <div>
        <h3>運賃表マッピングウィザード</h3>
        <p class="help-text">${escapeHtml(state.reason || '自動判定できない運賃表です。表の位置を指定して取り込みます。')}</p>
        <p class="help-text">入力欄を選び、左の表セルをクリックすると行・列・セルを指定できます。青はゾーン、緑は都道府県、黄は運賃範囲です。</p>
      </div>
      <span class="badge confidence-${confidence.level}">自動判定信頼度: ${escapeHtml(confidence.level)}</span>
      <button class="small-button" type="button" data-fare-mapping-close>閉じる</button>
    </div>
    ${confidence.reasons?.length ? `<div class="mapping-guidance"><strong>自動判定メモ</strong><ul>${confidence.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>` : ''}
    <div class="mapping-wizard-layout">
      <section>
        <h4>ファイルプレビュー</h4>
        <p class="help-text">行番号と列記号を確認しながら、必要なセルまたは範囲を選択してください。</p>
        ${renderFarePreviewGrid(state.rows, rule, activeField)}
      </section>
      <section>
        <h4>マッピング設定</h4>
        <form data-fare-mapping-form>
          <label class="input-group compact-input">保存済みルール
            <select name="savedRule" data-fare-mapping-rule-select>${ruleOptions}</select>
          </label>
          <div class="row-actions">
            <button class="small-button" type="button" data-fare-mapping-apply-rule>保存済みルールを適用</button>
            <button class="small-button" type="button" data-fare-mapping-rename-rule>名前変更</button>
            <button class="small-button danger" type="button" data-fare-mapping-delete-rule>削除</button>
          </div>
          <div class="mapping-control-grid">
            ${mappingInput('name', 'ルール名', rule.name)}
            ${mappingInput('carrierCell', '配送会社セル', rule.carrierCell, 'A1')}
            ${mappingInput('serviceCell', 'サービスセル', rule.serviceCell, 'B1')}
            ${mappingInput('carrier', '配送会社名', rule.carrier, 'ヤマト運輸')}
            ${mappingInput('service', 'サービス名', rule.service, '宅急便')}
            ${mappingInput('zoneHeaderRow', '地域ヘッダー行', rule.zoneHeaderRow, '2')}
            ${mappingInput('zoneStartCol', '地域開始列', rule.zoneStartCol, 'C')}
            ${mappingInput('zoneEndCol', '地域終了列', rule.zoneEndCol, 'O')}
            ${mappingInput('prefectureStartRow', '都道府県開始行', rule.prefectureStartRow, '3')}
            ${mappingInput('prefectureEndRow', '都道府県終了行', rule.prefectureEndRow, '9')}
            ${mappingInput('sizeCol', 'サイズ列', rule.sizeCol, 'A')}
            ${mappingInput('weightCol', '重量列', rule.weightCol, 'B')}
            ${mappingInput('fareStartRow', '運賃開始行', rule.fareStartRow, '11')}
            ${mappingInput('fareEndRow', '運賃終了行', rule.fareEndRow, '16')}
          </div>
          <div class="row-actions">
            <button class="small-button" type="button" data-fare-mapping-preview>プレビュー更新</button>
            <button class="small-button" type="button" data-fare-mapping-apply>取り込む</button>
            <button class="small-button" type="button" data-fare-mapping-save-apply>保存して取り込む</button>
          </div>
        </form>
      </section>
      <section>
        <h4>取込プレビュー</h4>
        ${renderFareMappingResultConfirmation(state.lastResult)}
        ${renderFareMappingPreview(preview)}
      </section>
    </div>
  `;
}

function showFareMappingWizard(fileResult, sourceRows, sourceFileName, carrierName, serviceName, reason = '') {
  fareMappingWizardState = {
    rows: sourceRows,
    sourceFileName,
    sourceType: fileResult?.sourceType || 'unknown',
    sheetName: fileResult?.sheetName || '',
    carrierName,
    serviceName,
    reason,
    confidence: fileResult?.confidence || null,
    fareFormat: fileResult?.fareFormat || 'unknown',
    matrixView: fileResult?.matrixView || null,
    importedRows: fileResult?.importedRows || [],
    activeField: 'carrierCell',
    rule: defaultFareMappingRule(sourceRows, carrierName, serviceName),
  };
  renderFareMappingWizard();
}

function applyFareMappingFromWizard(saveRule = false, filter = '') {
  if (!fareMappingWizardState) return;
  const rule = normalizeFareImportMappingRule(mappingFormValues());
  const validation = validateFareImportMapping(fareMappingWizardState.rows, rule);
  const preview = previewFareImportMapping(fareMappingWizardState.rows, rule);
  if (!validation.valid) {
    const message = `マッピングを確認してください。${validation.guidance.join(' ')}`;
    setFareImportSummary(message);
    renderFareMappingWizard({ ...fareMappingWizardState, rule });
    return showToast('マッピングを確認してください。');
  }
  if (saveRule) saveFareImportMappingRule(rule);
  mergeImportedFareTable(validation.matrixView, validation.normalizedFareRows);
  setImportIssues(getImportIssues().filter((issue) => issue.sourceFlow !== 'fare_import'));
  const resultPreview = previewFareImportMapping(fareMappingWizardState.rows, rule);
  fareMappingWizardState = { ...fareMappingWizardState, rule, lastResult: resultPreview };
  renderFareMappingWizard(fareMappingWizardState);
  renderCarriers(filter);
  const unresolvedCount = getOpenImportIssues().filter((issue) => issue.sourceFlow === 'fare_import').length;
  const message = `マッピング取込完了 / 成功数: ${validation.normalizedFareRows.length} / 警告数: 0 / 未解決問題数: ${unresolvedCount}`;
  setFareImportSummary(message);
  showToast(message);
}

function setFareMappingActiveField(field) {
  if (!fareMappingSelectionFields[field] || !fareMappingWizardState) return;
  fareMappingWizardState = { ...fareMappingWizardState, activeField: field, rule: normalizeFareImportMappingRule(mappingFormValues()) };
}

function setFareMappingFieldFromCell(rowIndex, colIndex) {
  if (!fareMappingWizardState) return;
  const activeField = fareMappingWizardState.activeField || 'carrierCell';
  const meta = fareMappingSelectionFields[activeField];
  if (!meta) return;
  const rule = normalizeFareImportMappingRule(mappingFormValues());
  const value = meta.kind === 'cell' ? `${columnName(colIndex)}${rowIndex + 1}` : (meta.kind === 'row' ? rowIndex + 1 : columnName(colIndex));
  fareMappingWizardState = { ...fareMappingWizardState, activeField, rule: normalizeFareImportMappingRule({ ...rule, [activeField]: value }) };
  renderFareMappingWizard();
}

function bindFareMappingWizard(search) {
  const container = fareMappingWizardContainer();
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';
  container.addEventListener('change', (event) => {
    if (!event.target.matches('[data-fare-mapping-rule-select]') || !fareMappingWizardState) return;
    const selected = getFareImportMappingRules().find((rule) => rule.name === event.target.value);
    if (!selected) return;
    fareMappingWizardState = { ...fareMappingWizardState, rule: selected, selectedRuleName: selected.name };
    renderFareMappingWizard();
  });
  container.addEventListener('focusin', (event) => {
    const field = event.target?.dataset?.mappingField;
    if (field) setFareMappingActiveField(field);
  });
  container.addEventListener('click', (event) => {
    if (!fareMappingWizardState) return;
    const previewCell = event.target.closest?.('[data-fare-preview-cell]');
    if (previewCell) {
      setFareMappingFieldFromCell(toNumber(previewCell.dataset.rowIndex), toNumber(previewCell.dataset.colIndex));
      return;
    }
    if (event.target.matches('[data-fare-mapping-close]')) {
      fareMappingWizardState = null;
      renderFareMappingWizard();
      return;
    }
    if (event.target.matches('[data-fare-mapping-preview]')) {
      fareMappingWizardState = { ...fareMappingWizardState, rule: normalizeFareImportMappingRule(mappingFormValues()) };
      renderFareMappingWizard();
      return;
    }
    if (event.target.matches('[data-fare-mapping-apply-rule]')) {
      const selected = getFareImportMappingRules().find((rule) => rule.name === mappingFormValues().savedRule);
      if (selected) {
        fareMappingWizardState = { ...fareMappingWizardState, rule: selected, selectedRuleName: selected.name };
        renderFareMappingWizard();
      }
      return;
    }
    if (event.target.matches('[data-fare-mapping-delete-rule]')) {
      const selectedName = mappingFormValues().savedRule;
      if (!selectedName) return showToast('削除する保存済みルールを選択してください。');
      if (!window.confirm(`${selectedName} を削除します。よろしいですか？`)) return;
      deleteFareImportMappingRule(selectedName);
      fareMappingWizardState = { ...fareMappingWizardState, rule: normalizeFareImportMappingRule(mappingFormValues()), selectedRuleName: '' };
      renderFareMappingWizard();
      showToast('保存済みルールを削除しました。');
      return;
    }
    if (event.target.matches('[data-fare-mapping-rename-rule]')) {
      const selectedName = mappingFormValues().savedRule;
      if (!selectedName) return showToast('名前変更する保存済みルールを選択してください。');
      const nextName = window.prompt('新しいルール名を入力してください。', selectedName);
      const renamed = renameFareImportMappingRule(selectedName, nextName);
      if (renamed) {
        fareMappingWizardState = { ...fareMappingWizardState, rule: renamed, selectedRuleName: renamed.name };
        renderFareMappingWizard();
        showToast('保存済みルール名を変更しました。');
      }
      return;
    }
    if (event.target.matches('[data-fare-mapping-apply]')) {
      applyFareMappingFromWizard(false, search?.value || '');
      return;
    }
    if (event.target.matches('[data-fare-mapping-save-apply]')) {
      applyFareMappingFromWizard(true, search?.value || '');
    }
  });
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

function getMatrixEditorState(tableIndex = 0) {
  const currentMatrix = getFareTableState().matrixView;
  if (!currentMatrix) return null;
  const currentTable = getMatrixTables(currentMatrix)[tableIndex] || currentMatrix;
  return normalizeMatrixView({
    ...currentTable,
    carrier: document.querySelector(`[data-matrix-carrier="${tableIndex}"]`)?.value || currentTable.carrier,
    carrierLabel: document.querySelector(`[data-matrix-carrier="${tableIndex}"]`)?.value || currentTable.carrierLabel || currentTable.carrier,
    service: document.querySelector(`[data-matrix-service="${tableIndex}"]`)?.value || currentTable.service,
    rows: currentTable.rows.map((row, rowIndex) => ({
      size: document.querySelector(`[data-matrix-size="${tableIndex}-${rowIndex}"]`)?.value || row.size,
      weight: document.querySelector(`[data-matrix-weight="${tableIndex}-${rowIndex}"]`)?.value || row.weight,
      fares: Object.fromEntries(currentTable.zoneHeaders.map((zone, zoneIndex) => [zone, document.querySelector(`[data-matrix-fare="${tableIndex}-${rowIndex}"][data-zone-index="${zoneIndex}"]`)?.value || ''])),
    })),
  });
}

function fareScopeKey(carrier, service) {
  return `${normalizeCarrier(carrier)}|${normalize(service)}`;
}

function mergeImportedFareTable(matrixView, importedRows) {
  const currentState = getFareTableState();
  const normalizedImportedRows = importedRows.map(normalizeFare).filter((fare) => fare.size && toNumber(fare.fare) > 0);
  const importedKeys = new Set(normalizedImportedRows.map((fare) => fareScopeKey(fare.carrier, fare.service)));
  const existingRows = currentState.normalizedFareRows.filter((fare) => !importedKeys.has(fareScopeKey(fare.carrier, fare.service)));
  const importedTables = getMatrixTables(matrixView);
  const existingTables = getMatrixTables(currentState.matrixView).filter((table) => !importedKeys.has(fareScopeKey(table.carrier, table.service)));
  const nextRows = [...existingRows, ...normalizedImportedRows];
  const nextMatrixView = makeMatrixViewState([...existingTables, ...importedTables]);
  setFareTableState(nextMatrixView, nextRows);
  setData('carriers', nextRows);
}

function saveMatrixEditorState(nextMatrix) {
  mergeImportedFareTable(nextMatrix, normalizeFareMatrix(nextMatrix));
}

function deleteFareTableByScope(carrier, service) {
  const removeKey = fareScopeKey(carrier, service);
  const currentState = getFareTableState();
  const nextRows = currentState.normalizedFareRows.filter((fare) => fareScopeKey(fare.carrier, fare.service) !== removeKey);
  const nextTables = getMatrixTables(currentState.matrixView).filter((table) => fareScopeKey(table.carrier, table.service) !== removeKey);
  const nextMatrixView = makeMatrixViewState(nextTables);
  setFareTableState(nextMatrixView, nextRows);
  setData('carriers', nextRows);
  return { matrixView: nextMatrixView, normalizedFareRows: nextRows };
}

function renderCarriers(filter = '') {
  const tbody = document.querySelector('#carriers-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const fareState = getFareTableState();
  const matrixTables = getMatrixTables(fareState.matrixView);
  if (matrixTables.length) {
    const matchingTables = matrixTables
      .map((matrix, tableIndex) => ({ matrix, tableIndex }))
      .filter(({ matrix }) => !keyword || `${matrix.carrier} ${matrix.carrierLabel} ${matrix.service} ${matrix.zoneHeaders.join(' ')} ${Object.values(matrix.zoneGroups || {}).flat().join(' ')}`.toLowerCase().includes(keyword));
    if (!matchingTables.length) {
      tbody.innerHTML = '<tr><td colspan="6">該当する運賃表がありません。</td></tr>';
      return;
    }
    tbody.innerHTML = matchingTables.map(({ matrix, tableIndex }) => {
      const zoneHeaderCells = matrix.zoneHeaders.map((zone) => `<th>${escapeHtml(zone)}</th>`).join('');
      const matrixColGroup = `<colgroup><col class="matrix-col-size" /><col class="matrix-col-weight" />${matrix.zoneHeaders.map(() => '<col class="matrix-col-zone" />').join('')}</colgroup>`;
      const prefectureRows = (matrix.prefectureRows?.length ? matrix.prefectureRows : []).map((prefectureRow) => `
        <tr>
          <th>${escapeHtml(prefectureRow.label || '')}</th>
          <th></th>
          ${matrix.zoneHeaders.map((zone) => `<th class="matrix-prefectures">${escapeHtml(prefectureRow.cells?.[zone] || '')}</th>`).join('')}
        </tr>
      `).join('');
      const emptyZoneCells = matrix.zoneHeaders.map(() => '<th></th>').join('');
      const matrixRows = matrix.rows.map((row, rowIndex) => `
        <tr>
          <td><input class="matrix-cell-input" data-matrix-size="${tableIndex}-${rowIndex}" value="${escapeHtml(row.size)}" /></td>
          <td><input class="matrix-cell-input" data-matrix-weight="${tableIndex}-${rowIndex}" value="${escapeHtml(row.weight)}" /></td>
          ${matrix.zoneHeaders.map((zone, zoneIndex) => `<td><input class="matrix-cell-input money-input" inputmode="numeric" data-matrix-fare="${tableIndex}-${rowIndex}" data-zone-index="${zoneIndex}" value="${escapeHtml(row.fares?.[zone] || '')}" /></td>`).join('')}
        </tr>
      `).join('');
      return `
      <tr>
        <td colspan="6">
          <div class="matrix-editor">
            <div class="matrix-editor-header">
              <strong class="matrix-editor-title">${escapeHtml(matrixDisplayCarrier(matrix.carrier, matrix.carrierLabel))} / ${escapeHtml(matrix.service)}</strong>
              <label class="input-group compact-input">配送会社<input data-matrix-carrier="${tableIndex}" value="${escapeHtml(matrixDisplayCarrier(matrix.carrier, matrix.carrierLabel))}" /></label>
              <label class="input-group compact-input">サービス<input data-matrix-service="${tableIndex}" value="${escapeHtml(matrix.service)}" /></label>
              <div class="row-actions matrix-editor-actions">
                <button class="small-button" type="button" data-add-fare-matrix-row="${tableIndex}">行を追加</button>
                <button class="small-button" type="button" data-add-fare-matrix-zone="${tableIndex}">地域列を追加</button>
                <button class="small-button" type="button" data-save-fare-matrix="${tableIndex}">保存</button>
                <button class="small-button danger" type="button" data-delete-fare-matrix="${tableIndex}">この運賃表を削除</button>
              </div>
            </div>
            <div class="responsive-table matrix-table-wrap">
            <table class="matrix-table">
              ${matrixColGroup}
              <thead>
                <tr class="matrix-zone-row"><th>着地</th><th></th>${zoneHeaderCells}</tr>
                ${prefectureRows}
                <tr class="matrix-size-row"><th>${escapeHtml(matrix.sizeLabel)}</th><th>${escapeHtml(matrix.weightLabel)}</th>${emptyZoneCells}</tr>
              </thead>
              <tbody>${matrixRows}</tbody>
            </table>
            </div>
          </div>
        </td>
      </tr>
    `;
    }).join('');
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
  bindFareMappingWizard(search);
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
    const currentMatrix = getFareTableState().matrixView;
    if (!currentMatrix) return;
    const addRowIndex = event.target.dataset?.addFareMatrixRow;
    if (addRowIndex !== undefined) {
      const tableIndex = toNumber(addRowIndex);
      const editorMatrix = getMatrixEditorState(tableIndex) || getMatrixTables(currentMatrix)[tableIndex] || currentMatrix;
      const lastSize = toNumber(editorMatrix.rows.at(-1)?.size);
      const nextSize = shippingSizes.find((size) => size > lastSize) || '';
      const nextMatrix = normalizeMatrixView({
        ...editorMatrix,
        rows: [...editorMatrix.rows, { size: nextSize, weight: '', fares: {} }],
      });
      saveMatrixEditorState(nextMatrix);
      renderCarriers(search?.value || '');
      showToast('マトリクス行を追加しました。');
      return;
    }
    const addZoneIndex = event.target.dataset?.addFareMatrixZone;
    if (addZoneIndex !== undefined) {
      const zoneName = window.prompt('追加する地域名を入力してください。');
      const normalizedZoneName = compactText(zoneName);
      if (!normalizedZoneName) return;
      const tableIndex = toNumber(addZoneIndex);
      const editorMatrix = getMatrixEditorState(tableIndex) || getMatrixTables(currentMatrix)[tableIndex] || currentMatrix;
      const nextMatrix = normalizeMatrixView({
        ...editorMatrix,
        zoneHeaders: [...editorMatrix.zoneHeaders, normalizedZoneName],
        zoneGroups: { ...(editorMatrix.zoneGroups || {}), [normalizedZoneName]: [] },
      });
      saveMatrixEditorState(nextMatrix);
      renderCarriers(search?.value || '');
      showToast('地域列を追加しました。');
      return;
    }
    const deleteMatrixIndex = event.target.dataset?.deleteFareMatrix;
    if (deleteMatrixIndex !== undefined) {
      const table = getMatrixTables(currentMatrix)[toNumber(deleteMatrixIndex)];
      if (!table) return;
      const title = `${matrixDisplayCarrier(table.carrier, table.carrierLabel)} / ${table.service}`;
      if (!window.confirm(`${title} の運賃表を削除します。よろしいですか？`)) return;
      deleteFareTableByScope(table.carrier, table.service);
      renderCarriers(search?.value || '');
      showToast('運賃表を削除しました。');
      return;
    }
    const saveMatrixIndex = event.target.dataset?.saveFareMatrix;
    if (saveMatrixIndex === undefined) return;
    const nextMatrix = getMatrixEditorState(toNumber(saveMatrixIndex));
    if (!nextMatrix) return;
    saveMatrixEditorState(nextMatrix);
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
      const sourceRows = fileResult.rawRows?.length ? fileResult.rawRows : rows;
      const headers = Array.isArray(sourceRows[0]) ? sourceRows[0] : Object.keys(rows[0] || {});
      const carrierName = normalizeCarrier(form?.elements?.name?.value || form?.elements?.carrier?.value || 'ヤマト');
      const serviceName = normalize(form?.elements?.service?.value || '宅急便');
      let imported = [];
      let matrixView = null;
      const fareDetection = detectFareTableFormatDetails(headers, sourceRows);
      const fareFormat = fareDetection.format;
      if (fareFormat === 'vertical') {
        imported = rows.map(normalizeFare).filter((fare) => supportedCarriers.includes(fare.carrier));
      } else if (fareFormat === 'matrix') {
        imported = normalizeFareMatrix(sourceRows, carrierName, serviceName);
        matrixView = createMatrixView(sourceRows, carrierName, serviceName);
        const confidence = getFareImportConfidence(fareFormat, matrixView, imported);
        confidence.confidence = Math.min(confidence.confidence, fareDetection.confidence || confidence.confidence);
        confidence.level = confidence.confidence >= 80 ? '高' : (confidence.confidence >= 50 ? '中' : '低');
        confidence.reasons = [...new Set([...(fareDetection.reasons || []), ...(confidence.reasons || [])])];
        if (confidence.confidence < 80) {
          const message = '自動判定した運賃表の構造を確認できませんでした。マッピングを設定してください。';
          showFareMappingWizard({ ...fileResult, confidence, fareFormat, matrixView, importedRows: imported }, sourceRows, file.name, carrierName, serviceName, message);
          setFareImportSummary(message);
          return showToast(message);
        }
      } else {
        const confidence = { ...getFareImportConfidence(fareFormat, matrixView, imported), confidence: fareDetection.confidence, reasons: fareDetection.reasons };
        confidence.level = confidence.confidence >= 80 ? '高' : (confidence.confidence >= 50 ? '中' : '低');
        const message = '自動判定できない運賃表です。マッピングを設定してください。';
        showFareMappingWizard({ ...fileResult, confidence, fareFormat, matrixView, importedRows: imported }, sourceRows, file.name, carrierName, serviceName, message);
        setFareImportSummary(message);
        return showToast(message);
      }
      const issues = recordFareImportIssues(rows, fareFormat, matrixView, imported, file.name);
      mergeImportedFareTable(matrixView, imported);
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

function buildShipmentExportRows(shipments) {
  return shipments.map((row) => ({
    '出荷グループ': row.shipmentGroupId,
    '出荷状態': getShipmentStatusLabel(row.shipmentStatus),
    '対象注文番号': row.orderNos,
    '顧客名': row.customer,
    '取込元プラットフォーム': row.sourcePlatform || '-',
    '郵便番号': row.postal,
    '配送先住所': row.address,
    'SKU明細': row.items,
    '推定サイズ': row.estimatedSize,
    '合計重量': row.totalWeight,
    '推奨配送会社': row.recommendedCarrier,
    '推奨サービス': row.recommendedService,
    '推定運賃': row.estimatedFare,
    '削減見込み額': row.savings,
  }));
}

function renderShipmentStatusSelect(row) {
  return `
    <select class="status-select" data-shipment-status="${escapeHtml(row.shipmentGroupId)}" aria-label="${escapeHtml(row.shipmentGroupId)} の出荷状態">
      ${shipmentStatusModel.map((status) => `<option value="${status}" ${row.shipmentStatus === status ? 'selected' : ''}>${shipmentStatusLabels[status]}</option>`).join('')}
    </select>
  `;
}

function renderShipmentActionButtons(row) {
  const actions = [
    ['pending', '確認待ち'],
    ['ready', '準備完了'],
    ['shipped', '出荷済み'],
    ['on_hold', '保留'],
    ['error', 'エラー'],
  ];
  return actions.map(([status, label]) => `<button class="small-button" type="button" data-set-shipment-status="${status}" data-shipment-id="${escapeHtml(row.shipmentGroupId)}">${label}</button>`).join('');
}

function renderCompactShipmentQueueRow(row) {
  const packageText = row.estimatedSize ? `${row.estimatedSize}サイズ` : row.status;
  const weightText = `${toNumber(row.totalWeight).toLocaleString('ja-JP')}g`;
  const fareText = row.estimatedFare === '' ? row.status : formatYen(row.estimatedFare);
  return `
    <tr>
      <td class="id-cell">
        <strong>${escapeHtml(row.shipmentGroupId)}</strong>
        <span class="badge ${getShipmentStatusClass(row.shipmentStatus)}">${escapeHtml(getShipmentStatusLabel(row.shipmentStatus))}</span>
      </td>
      <td class="result-info-cell">
        <strong>${escapeHtml(row.orderNos)}</strong>
        <span>${escapeHtml(row.customer)}</span>
        <span>${escapeHtml(row.sourcePlatform || '-')}</span>
      </td>
      <td class="wrap-cell address-cell">
        <strong>${escapeHtml(row.postal || '郵便番号未設定')}</strong>
        <span>${escapeHtml(row.address)}</span>
      </td>
      <td class="wrap-cell sku-cell">
        <strong>${escapeHtml(row.items)}</strong>
        <span>${escapeHtml(packageText)} / ${escapeHtml(weightText)}</span>
      </td>
      <td class="result-info-cell">
        <strong>${escapeHtml(row.recommendedCarrier || row.status)}</strong>
        <span>${escapeHtml(row.recommendedService || '-')}</span>
        <span class="money-inline">${escapeHtml(fareText)}</span>
      </td>
      <td>
        <div class="queue-actions shipment-status-actions">${renderShipmentActionButtons(row)}</div>
      </td>
    </tr>
  `;
}

function renderShipmentQueue() {
  const target = document.querySelector('#shipment-queue-view');
  if (!target) return;
  const shipments = getShipmentGroups();
  const exportableCount = shipments.filter((row) => !['error', 'on_hold'].includes(row.shipmentStatus)).length;
  const rows = shipments.length
    ? shipments.map(renderCompactShipmentQueueRow).join('')
    : '<tr><td colspan="6">出荷候補がありません。注文データを取り込んでください。</td></tr>';
  target.innerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>出荷候補</p><strong>${shipments.length}</strong></article>
      <article class="stat-card"><p>出荷CSV対象</p><strong>${exportableCount}</strong></article>
      <article class="stat-card"><p>出荷準備完了</p><strong>${shipments.filter((row) => row.shipmentStatus === 'ready').length}</strong></article>
      <article class="stat-card"><p>出荷済み</p><strong>${shipments.filter((row) => row.shipmentStatus === 'shipped').length}</strong></article>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar">
        <div><h2>出荷キュー</h2><p class="help-text">エラーと保留は出荷CSV出力から初期除外します。</p></div>
        <button class="button secondary" type="button" id="export-shipment-csv">出荷CSV出力</button>
      </div>
      <div class="responsive-table queue-table shipment-queue-table"><table><thead><tr><th>出荷グループ</th><th>注文 / 顧客</th><th>配送先</th><th>荷物</th><th>推奨</th><th>状態変更</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
  `;
  document.querySelector('#export-shipment-csv')?.addEventListener('click', () => {
    const exportRows = buildShipmentExportRows(getShipmentGroups().filter((row) => !['error', 'on_hold'].includes(row.shipmentStatus)));
    downloadCsv('shipnavi-shipment-queue.csv', exportRows);
    showToast('出荷CSVを出力しました。');
  });
}

function initShipmentQueue() {
  if (!document.querySelector('#shipment-queue-view')) return;
  renderShipmentQueue();
  document.addEventListener('change', (event) => {
    const shipmentGroupId = event.target?.dataset?.shipmentStatus;
    if (!shipmentGroupId) return;
    updateShipmentStatus(shipmentGroupId, event.target.value);
    renderShipmentQueue();
    showToast('出荷状態を更新しました。');
  });
  document.addEventListener('click', (event) => {
    const status = event.target?.dataset?.setShipmentStatus;
    const shipmentGroupId = event.target?.dataset?.shipmentId;
    if (!status || !shipmentGroupId) return;
    updateShipmentStatus(shipmentGroupId, status);
    renderShipmentQueue();
    showToast('出荷状態を更新しました。');
  });
}

function buildShipmentResultSummary(shipments) {
  return {
    carrierCounts: shipments.reduce((acc, row) => {
      const carrier = row.recommendedCarrier || '未割当';
      acc[carrier] = (acc[carrier] || 0) + 1;
      return acc;
    }, {}),
    statusCounts: shipments.reduce((acc, row) => {
      const label = getShipmentStatusLabel(row.shipmentStatus);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
    savings: {
      shipmentCount: shipments.length,
      saving: shipments.reduce((sum, row) => sum + toNumber(row.savings), 0),
      readyCount: shipments.filter((row) => row.shipmentStatus === 'ready').length,
      exportableCount: shipments.filter((row) => !['error', 'on_hold'].includes(row.shipmentStatus)).length,
    },
  };
}

function renderCountList(counts, emptyText) {
  const entries = Object.entries(counts);
  if (!entries.length) return `<li><span>${escapeHtml(emptyText)}</span><strong>0</strong></li>`;
  return entries.map(([label, count]) => `<li><span>${escapeHtml(label)}</span><strong>${count}</strong></li>`).join('');
}

function shipmentMatchesFilter(row, keyword) {
  if (!keyword) return true;
  return [
    row.shipmentGroupId,
    row.orderNos,
    row.customer,
    row.sourcePlatform,
    row.postal,
    row.address,
    row.items,
    row.recommendedCarrier,
    row.recommendedService,
    row.status,
  ].join(' ').toLowerCase().includes(keyword);
}

function renderCompactResultRow(row) {
  const packageText = row.estimatedSize ? `${row.estimatedSize}サイズ / ${toNumber(row.totalWeight).toLocaleString('ja-JP')}g` : row.status;
  const fareText = row.estimatedFare === '' ? row.status : formatYen(row.estimatedFare);
  const secondFareText = row.secondFare === '' ? '-' : formatYen(row.secondFare);
  return `
    <tr>
      <td class="id-cell"><strong>${escapeHtml(row.shipmentGroupId)}</strong><span>${escapeHtml(row.sourcePlatform || '-')}</span></td>
      <td class="result-info-cell"><strong>${escapeHtml(row.customer)}</strong><span>${escapeHtml(row.orderNos)}</span></td>
      <td class="wrap-cell address-cell"><strong>${escapeHtml(row.postal || '郵便番号未設定')}</strong><span>${escapeHtml(row.address)}</span></td>
      <td class="wrap-cell sku-cell"><strong>${escapeHtml(packageText)}</strong><span>${escapeHtml(row.items)}</span></td>
      <td class="result-info-cell"><strong>${escapeHtml(row.recommendedCarrier || row.status)}</strong><span>${escapeHtml(row.recommendedService || '-')}</span><span>第二候補: ${escapeHtml(row.secondCarrier || '-')}</span></td>
      <td class="money-cell"><strong>${escapeHtml(fareText)}</strong><span>${escapeHtml(secondFareText)}</span><span class="badge green">${formatYen(row.savings)}</span></td>
    </tr>
  `;
}

function renderResults(filter = '') {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const summary = getResultSummary();
  const shipments = getShipmentGroups();
  const keyword = normalize(filter).toLowerCase();
  const visibleShipments = shipments.filter((row) => shipmentMatchesFilter(row, keyword));
  const shipmentSummary = buildShipmentResultSummary(shipments);
  const health = getDataHealth();
  const alertPanel = summary.errors.length ? `
    <section class="panel full-width">
      <h2>エラー</h2>
      ${summary.errors.map((error) => `<p>${escapeHtml(error)}</p>`).join('')}
    </section>
  ` : '';
  const shipmentRows = visibleShipments.length
    ? visibleShipments.map(renderCompactResultRow).join('')
    : `<tr><td colspan="6">${shipments.length ? '検索条件に一致する結果がありません。' : (health.hasOrders ? '商品マスタと運賃表を取り込むと計算されます。' : '注文データがありません。')}</td></tr>`;
  target.classList.add('full-width');
  target.innerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推奨配送方法</p><strong>${escapeHtml(summary.topRecommendation ? `${summary.topRecommendation.recommendedCarrier} ${summary.topRecommendation.recommendedService}` : '-')}</strong></article>
      <article class="stat-card"><p>削減見込み額</p><strong>${formatYen(summary.saving)}</strong></article>
    </section>
    ${alertPanel}
    <section class="panel full-width">
      <div class="table-toolbar summary-toolbar"><h2>出荷結果サマリー</h2><a class="button secondary compact-button" href="shipment-queue.html">出荷キューを開く</a></div>
      <div class="result-grid">
        <article class="summary-panel">
          <h3>配送会社別件数</h3>
          <ul class="status-list">${renderCountList(shipmentSummary.carrierCounts, '配送会社なし')}</ul>
        </article>
        <article class="summary-panel">
          <h3>出荷状態別件数</h3>
          <ul class="status-list">${renderCountList(shipmentSummary.statusCounts, '出荷状態なし')}</ul>
        </article>
        <article class="summary-panel full-width">
          <h3>推定削減サマリー</h3>
          <ul class="status-list">
            <li><span>出荷候補</span><strong>${shipmentSummary.savings.shipmentCount}</strong></li>
            <li><span>CSV出力対象</span><strong>${shipmentSummary.savings.exportableCount}</strong></li>
            <li><span>出荷準備完了</span><strong>${shipmentSummary.savings.readyCount}</strong></li>
            <li><span>削減見込み額</span><strong>${formatYen(shipmentSummary.savings.saving)}</strong></li>
          </ul>
        </article>
      </div>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar results-filter-toolbar"><div><h2>運賃比較結果</h2><p class="help-text">${visibleShipments.length} / ${shipments.length}件を表示</p></div><input class="search-input" id="results-search" value="${escapeHtml(filter)}" placeholder="注文番号・顧客名・配送先・SKUで検索" /><button class="button secondary compact-button" type="button" id="export-results-csv">CSV出力</button></div>
      <div class="responsive-table results-table compact-results-table"><table><thead><tr><th>グループ</th><th>注文 / 顧客</th><th>配送先</th><th>荷物</th><th>推奨</th><th>運賃 / 削減</th></tr></thead>
      <tbody>${shipmentRows}</tbody></table></div>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>同梱結果</h2></div>
      <div class="responsive-table queue-table compact-results-table"><table><thead><tr><th>グループ</th><th>注文 / 顧客</th><th>配送先</th><th>荷物</th><th>推奨</th><th>運賃 / 削減</th></tr></thead><tbody>${visibleShipments.length ? visibleShipments.map(renderCompactResultRow).join('') : '<tr><td colspan="6">注文データがありません。</td></tr>'}</tbody></table></div>
    </section>
  `;
  document.querySelector('#results-search')?.addEventListener('input', (event) => renderResults(event.target.value));
  document.querySelector('#export-results-csv')?.addEventListener('click', () => {
    const rows = visibleShipments.map((row) => ({
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


function initTemplateDownloadActions() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-template-type][data-template-format]');
    if (!button) return;
    downloadImportTemplate(button.dataset.templateType, button.dataset.templateFormat);
  });
}

function initBackToTopButton() {
  if (document.querySelector('#back-to-top')) return;
  const button = document.createElement('button');
  button.id = 'back-to-top';
  button.className = 'back-to-top';
  button.type = 'button';
  button.textContent = '↑';
  button.setAttribute('aria-label', 'ページ上部へ戻る');
  document.body.appendChild(button);
  const syncVisibility = () => button.classList.toggle('is-visible', window.scrollY > 360);
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', syncVisibility, { passive: true });
  syncVisibility();
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
  initShipmentQueue();
  renderResults();
  renderSettings();
  initImportIssueActions();
  initTemplateDownloadActions();
  initBackToTopButton();
  renderGlobalImportIssues();
}
