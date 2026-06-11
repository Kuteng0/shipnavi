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

function readFileAsText(file, callback) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(String(reader.result || '').replace(/^\uFEFF/, '')));
  reader.readAsText(file);
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
      weight: normalize(row?.weight) ? String(toNumber(row?.weight)) : '',
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
    optionalSignals: ['postal', 'sourceplatform'],
    fieldCandidates: {
      orderNo: ['orderNo'],
      customer: ['customer'],
      postal: ['postal'],
      address: ['address'],
      sku: ['sku'],
      quantity: ['quantity'],
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
  const warnings = [];

  if (!postal) warnings.push('郵便番号未設定');
  if (!sku && productName) {
    sku = productName;
    warnings.push('商品名をSKUとして使用');
  }

  return {
    id: makeId('o'),
    orderNo,
    customer,
    postal,
    address,
    sku,
    quantity: String(Math.max(1, toNumber(resolveField(row, mapping?.fieldCandidates?.quantity || [])) || 1)),
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
    };
  }
  const normalizedOrders = rows.map((row) => normalizePlatformOrderRow(row, platform));
  const validOrders = normalizedOrders.filter(hasStandardOrderFields);
  const warningDetails = [...new Set(validOrders.flatMap((order) => order.warnings || []))];
  return {
    platform,
    orders: validOrders,
    successCount: validOrders.length,
    failureCount: normalizedOrders.length - validOrders.length,
    warningCount: validOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0),
    warningDetails,
    missingHeaders: [],
    detectedHeaders: headers,
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
    weightLimit: String(toNumber(row.weightLimit || row.weight)),
    zone: normalize(row.zone) || 'default',
    fare: String(toNumber(row.fare)),
  };
}

function createMatrixView(rows, carrierName = 'ヤマト', serviceName = '宅急便') {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0] || {}).map((header) => normalizeHeader(header));
  const sizeHeader = headers[0];
  const weightHeader = headers.find((header) => ['weight', '重量', '重量(kg)'].includes(header));
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
  if (hasHeaders(normalizedHeaders, ['carrier', 'service', 'size', 'zone', 'fare'])) return 'vertical';
  const firstHeader = normalizedHeaders[0];
  const zoneSignals = ['北海道', '関東', '東京', '関西', '沖縄', '九州'];
  if (['size', 'サイズ', '総長', 'サイズ(cm)'].includes(firstHeader) && normalizedHeaders.some((header) => zoneSignals.includes(header))) return 'matrix';
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
      products.length ? '' : '商品主档がありません。商品CSVを先に取り込んでください。',
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
    items: Object.entries(itemMap).map(([sku, quantity]) => `${sku} x ${quantity}`).join(', '),
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
      <h2>Phase 2 MVP</h2>
      <p>注文CSV、商品主档、運賃表をLocalStorageに保存し、同梱候補と最低運賃を自動計算します。</p>
      <div class="action-grid">
        <a class="action-card" href="orders.html"><b>注文CSV</b><span>orderNo, customer, postal, address, sku, quantity</span></a>
        <a class="action-card" href="products.html"><b>商品主档</b><span>sku, name, size, weight, length, width, height, bundleable</span></a>
        <a class="action-card" href="carriers.html"><b>運賃表</b><span>carrier, service, size, zone, fare</span></a>
        <a class="action-card" href="results.html"><b>結果中心</b><span>推薦配送方式とCSV出力</span></a>
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
      <td>${escapeHtml(product.weight)}g</td><td>${product.bundleable ? '可同梱' : '不可同梱'} / ${escapeHtml(product.length)}x${escapeHtml(product.width)}x${escapeHtml(product.height)}cm</td>
      <td><div class="row-actions"><button class="small-button" data-edit-product="${product.id}">編集</button><button class="small-button danger" data-delete-product="${product.id}">削除</button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="6">商品データがありません。</td></tr>';
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
    showToast('商品主档を保存しました。');
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
    if (!file) return showToast('商品CSVを選択してください。');
    readFileAsText(file, (text) => {
      const rows = parseCsv(text);
      const missing = requireColumns(rows, ['sku', 'name', 'size', 'weight', 'length', 'width', 'height', 'bundleable']);
      if (missing.length) return showToast(`不足字段: ${missing.join(', ')}`);
      const imported = rows.map(normalizeProduct).filter((product) => product.sku);
      setData('products', [...imported, ...getData('products')]);
      renderProducts(search?.value || '');
      showToast(`${imported.length}件の商品主档を保存しました。`);
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
    showToast('矩陣運賃表を保存しました。');
  });
  document.querySelector('#fare-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('運賃表CSVを選択してください。');
    if (isImageFile(file)) return showToast('画像OCRには対応していません。CSVまたはExcelをアップロードしてください。');
    readFileAsText(file, (text) => {
      const rows = parseCsv(text);
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
        return showToast(`不足字段: ${missing.join(', ')}`);
      }
      setFareTableState(matrixView, imported);
      setData('carriers', imported);
      renderCarriers(search?.value || '');
      showToast(`${imported.length}行の運賃表を保存しました。`);
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
      <td>${escapeHtml(order.sku)} x ${escapeHtml(order.quantity)}</td><td>${escapeHtml(order.address)}</td><td>${bundleIds.has(order.id) ? '同梱候補' : '単独'}</td>
      <td><span class="badge ${bundleIds.has(order.id) ? 'green' : 'orange'}">${bundleIds.has(order.id) ? '可同梱' : '確認済'}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="7">注文データがありません。</td></tr>';
  const summary = document.querySelector('#order-preview-summary');
  if (summary) summary.textContent = `${orders.length}件の注文をLocalStorageから表示しています。`;
}

function initOrders() {
  if (!document.querySelector('#orders-table')) return;
  const search = document.querySelector('#order-search');
  renderOrders();
  search?.addEventListener('input', () => renderOrders(search.value));
  document.querySelector('#order-csv-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('\u6ce8\u6587CSV\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
    if (isImageFile(file)) return showToast('画像OCRには対応していません。CSVまたはExcelをアップロードしてください。');
    readFileAsText(file, (text) => {
      const rows = parseCsv(text);
      const headers = Object.keys(rows[0] || {});
      let importResult;
      const platform = detectOrderCsvFormat(headers);
      if (platform !== 'unknown') {
        importResult = importOrderCsvRows(rows);
        if (importResult.missingHeaders.length) {
          return showToast(`${platform} 不足字段: ${importResult.missingHeaders.join(', ')}`);
        }
      } else if (hasHeaders(headers, ['orderNo', 'customer', 'address', 'sku', 'quantity'])) {
        const orders = rows.map((row) => normalizeOrder({ ...row, sourcePlatform: 'ShipNavi' }));
        const validOrders = orders.filter(hasStandardOrderFields);
        importResult = {
          platform: 'ShipNavi',
          orders: validOrders,
          successCount: validOrders.length,
          failureCount: orders.length - validOrders.length,
          missingHeaders: [],
          warningCount: validOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0),
          warningDetails: [...new Set(validOrders.flatMap((order) => order.warnings || []))],
          detectedHeaders: headers,
        };
      }
      if (!importResult || importResult.platform === 'unknown') {
        const detectedHeaderText = headers.length ? headers.join(', ') : 'なし';
        const message = `未対応CSV形式 / headers: ${detectedHeaderText} / 後続で手動マッピング対応予定`;
        const summary = document.querySelector('#order-preview-summary');
        if (summary) summary.textContent = message;
        return showToast(message);
      }
      const imported = importResult.orders;
      setData('orders', imported);
      renderOrders(search?.value || '');
      const summary = document.querySelector('#order-preview-summary');
      const warningText = (importResult.warningDetails || []).join('、') || 'なし';
      const message = `${importResult.platform} CSVを取り込みました / 注文数: ${rows.length} / 成功数: ${importResult.successCount} / 失敗数: ${importResult.failureCount} / 警告数: ${importResult.warningCount || 0} / 警告内容: ${warningText}`;
      if (summary) summary.textContent = message;
      showToast(message);
    });
  });
  document.querySelector('#order-excel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file?.files?.[0];
    if (isImageFile(file)) return showToast('画像OCRには対応していません。CSVまたはExcelをアップロードしてください。');
    showToast('Excel取り込みは次段階対応です。現時点ではCSVをご利用ください。');
  });
}

function renderTemplates() {
  const target = document.querySelector('#templates-view');
  if (!target) return;
  target.outerHTML = `
    <section class="panel full-width">
      <h2>CSV字段</h2>
      <p>注文CSV: orderNo, customer, postal, address, sku, quantity</p>
      <p>商品主档: sku, name, size, weight, length, width, height, bundleable</p>
      <p>運賃表: carrier, service, size, zone, fare</p>
    </section>
  `;
}

function renderResults() {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const summary = getResultSummary();
  const shipments = getShipmentGroups();
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
        <td>${escapeHtml(row.postal || '郵便番号未設定')}</td>
        <td>${escapeHtml(row.address)}</td>
        <td>${escapeHtml(row.items)}</td>
        <td>${row.estimatedSize ? `${escapeHtml(row.estimatedSize)}サイズ` : escapeHtml(row.status)}</td>
        <td>${toNumber(row.totalWeight).toLocaleString('ja-JP')}g</td>
        <td>${escapeHtml(row.recommendedCarrier || row.status)}</td>
        <td>${escapeHtml(row.recommendedService)}</td>
        <td>${row.estimatedFare === '' ? escapeHtml(row.status) : formatYen(row.estimatedFare)}</td>
        <td>${escapeHtml(row.secondCarrier || '-')}</td>
        <td>${row.secondFare === '' ? '-' : formatYen(row.secondFare)}</td>
        <td><span class="badge green">${formatYen(row.savings)}</span></td>
      </tr>
    `).join('')
    : `<tr><td colspan="15">${health.hasOrders ? '商品主档と運賃表を取り込むと計算されます。' : '注文データがありません。'}</td></tr>`;
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推薦配送方式</p><strong>${escapeHtml(summary.topRecommendation ? `${summary.topRecommendation.recommendedCarrier} ${summary.topRecommendation.recommendedService}` : '-')}</strong></article>
      <article class="stat-card"><p>節省金額</p><strong>${formatYen(summary.saving)}</strong></article>
    </section>
    ${alertPanel}
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>運賃比較結果</h2><button class="button secondary" type="button" id="export-results-csv">CSV导出</button></div>
      <div class="responsive-table"><table><thead><tr><th>shipmentGroupId</th><th>対象注文番号</th><th>customer</th><th>導入来源平台</th><th>postal</th><th>address</th><th>sku明細</th><th>推定サイズ</th><th>合計重量</th><th>推奨配送会社</th><th>推奨サービス</th><th>推定運賃</th><th>第二候補</th><th>第二候補運賃</th><th>節約金額</th></tr></thead>
      <tbody>${shipmentRows}</tbody></table></div>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>同梱結果</h2></div>
      <div class="responsive-table"><table><thead><tr><th>shipmentGroupId</th><th>対象注文番号</th><th>customer</th><th>導入来源平台</th><th>postal</th><th>address</th><th>sku明細</th><th>推定サイズ</th><th>合計重量</th><th>推奨配送会社</th><th>推定運賃</th></tr></thead><tbody>${shipments.length ? shipments.map((row) => `<tr><td>${escapeHtml(row.shipmentGroupId)}</td><td>${escapeHtml(row.orderNos)}</td><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.sourcePlatform || '-')}</td><td>${escapeHtml(row.postal || '郵便番号未設定')}</td><td>${escapeHtml(row.address)}</td><td>${escapeHtml(row.items)}</td><td>${row.estimatedSize ? `${escapeHtml(row.estimatedSize)}サイズ` : escapeHtml(row.status)}</td><td>${toNumber(row.totalWeight).toLocaleString('ja-JP')}g</td><td>${escapeHtml(row.recommendedCarrier || row.status)}</td><td>${row.estimatedFare === '' ? escapeHtml(row.status) : formatYen(row.estimatedFare)}</td></tr>`).join('') : '<tr><td colspan="11">注文データがありません。</td></tr>'}</tbody></table></div>
    </section>
  `;
  document.querySelector('#export-results-csv')?.addEventListener('click', () => {
    const rows = shipments.map((row) => ({
      shipmentGroupId: row.shipmentGroupId,
      orderNos: row.orderNos,
      customer: row.customer,
      postal: row.postal,
      address: row.address,
      items: row.items,
      estimatedSize: row.estimatedSize,
      totalWeight: row.totalWeight,
      recommendedCarrier: row.recommendedCarrier,
      recommendedService: row.recommendedService,
      estimatedFare: row.estimatedFare,
      secondCarrier: row.secondCarrier,
      secondFare: row.secondFare,
      savings: row.savings,
    }));
    downloadCsv('shipnavi-results.csv', rows);
    showToast('結果中心CSVを出力しました。');
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
    <section class="panel full-width"><h2>LocalStorage</h2><p>Phase 2 MVPデータを初期状態へ戻します。</p><button class="button secondary" type="button" id="reset-dashboard-data">リセット</button></section>
  `;
  document.querySelector('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    setData('settings', Object.fromEntries(new FormData(event.currentTarget).entries()));
    showToast('設定を保存しました。');
  });
  document.querySelector('#reset-dashboard-data')?.addEventListener('click', () => {
    Object.entries(keys).forEach(([name, key]) => storage.write(key, emptyData[name]));
    showToast('LocalStorageをリセットしました。');
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
  renderSettings();
}
