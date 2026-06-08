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
  fareTables: [],
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
  return String(value ?? '').replace(/^\uFEFF/, '').replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
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

function requireColumns(rows, columns) {
  const headers = Object.keys(rows[0] || {});
  return columns.filter((column) => !headers.includes(column));
}

function hasHeaders(headers, requiredHeaders) {
  return requiredHeaders.every((header) => headers.includes(header));
}

function hasAnyHeader(headers, candidateHeaders) {
  return candidateHeaders.some((header) => headers.includes(header));
}

function detectOrderCsvFormat(headers) {
  return Object.keys(platformFieldMappings).find((platform) => hasHeaders(headers, platformFieldMappings[platform].detectHeaders || [])) || '';
}
const platformFieldMappings = {
  '\u697d\u5929': {
    detectHeaders: ['\u6ce8\u6587\u756a\u53f7'],
    orderNo: ['\u6ce8\u6587\u756a\u53f7'],
    customerLast: ['\u6ce8\u6587\u8005\u540d\u5b57'],
    customerFirst: ['\u6ce8\u6587\u8005\u540d\u524d'],
    customer: ['\u9001\u4ed8\u5148\u6c0f\u540d'],
    postal: ['\u9001\u4ed8\u5148\u90f5\u4fbf\u756a\u53f7'],
    addressPref: ['\u9001\u4ed8\u5148\u4f4f\u6240\uff1a\u90fd\u9053\u5e9c\u770c'],
    addressCity: ['\u9001\u4ed8\u5148\u4f4f\u6240\uff1a\u90fd\u5e02\u533a'],
    addressStreet: ['\u9001\u4ed8\u5148\u4f4f\u6240\uff1a\u753a\u4ee5\u964d'],
    address: ['\u9001\u4ed8\u5148\u4f4f\u6240'],
    sku: ['\u5546\u54c1\u756a\u53f7', '\u5546\u54c1\u7ba1\u7406\u756a\u53f7', '\u5546\u54c1\u540d'],
    quantity: ['\u500b\u6570'],
  },
  Amazon: {
    detectHeaders: ['order-id', 'quantity-purchased'],
    orderNo: ['order-id'],
    customer: ['buyer-email', 'recipient-name'],
    postal: ['ship-postal-code'],
    addressPref: ['ship-state'],
    addressCity: ['ship-city'],
    addressStreet: ['ship-address-1'],
    sku: ['sku'],
    quantity: ['quantity-purchased'],
  },
  'Yahoo\u30b7\u30e7\u30c3\u30d4\u30f3\u30b0': {
    detectHeaders: ['\u6ce8\u6587ID', '\u304a\u5c4a\u3051\u5148\u6c0f\u540d'],
    orderNo: ['\u6ce8\u6587ID'],
    customer: ['\u304a\u5c4a\u3051\u5148\u6c0f\u540d'],
    postal: ['\u90f5\u4fbf\u756a\u53f7'],
    address: ['\u4f4f\u6240'],
    sku: ['\u5546\u54c1\u30b3\u30fc\u30c9'],
    quantity: ['\u6570\u91cf'],
  },
  Shopify: {
    detectHeaders: ['Name', 'Shipping Name'],
    orderNo: ['Name'],
    customer: ['Shipping Name'],
    postal: ['Shipping Zip'],
    address: ['Shipping Address1'],
    sku: ['Lineitem sku'],
    quantity: ['Lineitem quantity'],
  },
  BASE: {
    detectHeaders: ['\u6ce8\u6587ID', '\u8cfc\u5165\u8005\u540d'],
    orderNo: ['\u6ce8\u6587ID'],
    customer: ['\u8cfc\u5165\u8005\u540d'],
    postal: ['\u90f5\u4fbf\u756a\u53f7'],
    address: ['\u4f4f\u6240'],
    sku: ['\u5546\u54c1\u30b3\u30fc\u30c9'],
    quantity: ['\u6570\u91cf'],
  },
  MakeShop: {
    detectHeaders: ['\u6ce8\u6587\u756a\u53f7', '\u5546\u54c1\u30b3\u30fc\u30c9'],
    orderNo: ['\u6ce8\u6587\u756a\u53f7'],
    customer: ['\u9001\u4ed8\u5148\u540d'],
    postal: ['\u9001\u4ed8\u5148\u90f5\u4fbf\u756a\u53f7'],
    address: ['\u9001\u4ed8\u5148\u4f4f\u6240'],
    sku: ['\u5546\u54c1\u30b3\u30fc\u30c9'],
    quantity: ['\u6570\u91cf'],
  },
  '\u30ab\u30e9\u30fc\u30df\u30fc': {
    detectHeaders: ['\u53d7\u6ce8\u756a\u53f7', '\u304a\u540d\u524d'],
    orderNo: ['\u53d7\u6ce8\u756a\u53f7'],
    customer: ['\u304a\u540d\u524d'],
    postal: ['\u90f5\u4fbf\u756a\u53f7'],
    address: ['\u4f4f\u6240'],
    sku: ['\u5546\u54c1\u578b\u756a'],
    quantity: ['\u6570\u91cf'],
  },
};
function getPlatformMissingHeaders(headers, platform) {
  const mapping = platformFieldMappings[platform];
  if (!mapping) return [];
  if (platform === '\u697d\u5929') {
    const missing = [];
    if (!hasAnyHeader(headers, mapping.orderNo || [])) missing.push(...(mapping.orderNo || []));
    if ((!hasHeaders(headers, mapping.customerLast || []) || !hasHeaders(headers, mapping.customerFirst || [])) && !hasHeaders(headers, mapping.customer || [])) {
      missing.push(...(mapping.customerLast || []), ...(mapping.customerFirst || []));
    }
    if (!hasHeaders(headers, mapping.address || []) && !hasHeaders(headers, [...(mapping.addressPref || []), ...(mapping.addressCity || []), ...(mapping.addressStreet || [])])) {
      missing.push(...(mapping.addressPref || []), ...(mapping.addressCity || []), ...(mapping.addressStreet || []));
    }
    if (!hasAnyHeader(headers, mapping.sku || [])) missing.push(...(mapping.sku || []));
    if (!hasAnyHeader(headers, mapping.quantity || [])) missing.push(...(mapping.quantity || []));
    return [...new Set(missing.filter((header) => !headers.includes(header)))];
  }
  if (platform === 'Amazon') {
    const missing = [];
    if (!hasAnyHeader(headers, mapping.orderNo || [])) missing.push(...(mapping.orderNo || []));
    if (!hasAnyHeader(headers, mapping.customer || [])) missing.push(...(mapping.customer || []));
    if (!hasHeaders(headers, [...(mapping.addressPref || []), ...(mapping.addressCity || [])])) {
      missing.push(...(mapping.addressPref || []), ...(mapping.addressCity || []));
    }
    if (!hasAnyHeader(headers, mapping.sku || [])) missing.push(...(mapping.sku || []));
    if (!hasAnyHeader(headers, mapping.quantity || [])) missing.push(...(mapping.quantity || []));
    return [...new Set(missing.filter((header) => !headers.includes(header)))];
  }
  return ['orderNo', 'customer', 'address', 'sku', 'quantity']
    .flatMap((field) => hasAnyHeader(headers, mapping[field] || []) ? [] : (mapping[field] || []))
    .filter((header) => !headers.includes(header));
}
function firstValue(row, fields) {
  return fields.map((field) => normalize(row[field])).find(Boolean) || '';
}

function joinedValue(row, fields) {
  return fields.map((field) => normalize(row[field])).filter(Boolean).join(' ');
}

function normalizePlatformOrderRow(row, platform) {
  const mapping = platformFieldMappings[platform];
  const customer = platform === '\u697d\u5929'
    ? compactText(`${firstValue(row, mapping?.customerLast || [])}${firstValue(row, mapping?.customerFirst || [])}`) || firstValue(row, mapping?.customer || [])
    : firstValue(row, mapping?.customer || []);
  const address = platform === 'Amazon'
    ? normalizeJapaneseAddress([
      firstValue(row, mapping?.addressPref || []),
      firstValue(row, mapping?.addressCity || []),
      firstValue(row, mapping?.addressStreet || []),
    ])
    : normalizeJapaneseAddress([
      firstValue(row, mapping?.addressPref || []),
      firstValue(row, mapping?.addressCity || []),
      firstValue(row, mapping?.addressStreet || []),
    ]) || joinedValue(row, mapping?.address || []);
  const rawSku = firstValue(row, mapping?.sku || []);
  const postal = normalizePostal(firstValue(row, mapping?.postal || []));
  const warnings = [];
  if (!postal) warnings.push('\u90f5\u4fbf\u756a\u53f7\u672a\u8a2d\u5b9a');
  if (platform === '\u697d\u5929' && rawSku === firstValue(row, ['\u5546\u54c1\u540d']) && rawSku) {
    warnings.push('\u5546\u54c1SKU\u304c\u5546\u54c1\u540d\u304b\u3089\u4ee3\u7528\u3055\u308c\u3066\u3044\u307e\u3059');
  }
  return {
    id: makeId('o'),
    orderNo: firstValue(row, mapping?.orderNo || []),
    customer,
    postal,
    address,
    sku: rawSku,
    quantity: String(Math.max(1, toNumber(firstValue(row, mapping?.quantity || [])) || 1)),
    sourcePlatform: platform,
    warnings,
  };
}
function hasStandardOrderFields(order) {
  return ['orderNo', 'customer', 'address', 'sku', 'quantity'].every((field) => normalize(order[field]));
}
function importOrderCsvRows(rows) {
  const headers = Object.keys(rows[0] || {});
  const platform = detectOrderCsvFormat(headers);
  if (!platform) return { platform: '', orders: [], successCount: 0, failureCount: rows.length, missingHeaders: [], warningCount: 0 };
  const missingHeaders = getPlatformMissingHeaders(headers, platform);
  if (missingHeaders.length) return { platform, orders: [], successCount: 0, failureCount: rows.length, missingHeaders, warningCount: 0 };
  const orders = rows.map((row) => normalizePlatformOrderRow(row, platform));
  const validOrders = orders.filter(hasStandardOrderFields);
  const warningCount = validOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0);
  return {
    platform,
    orders: validOrders,
    successCount: validOrders.length,
    failureCount: orders.length - validOrders.length,
    missingHeaders: [],
    warningCount,
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
    zone: normalize(row.zone) || 'default',
    fare: String(toNumber(row.fare)),
  };
}

function isMatrixFareTable(headers) {
  const firstHeader = normalizeHeader(headers[0]);
  return ['size', 'サイズ', '総長'].includes(firstHeader);
}

function convertMatrixFareRows(rows, carrierName = 'ヤマト', serviceName = '宅急便') {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0] || {}).map((header) => normalizeHeader(header));
  const sizeHeader = headers[0];
  const weightHeader = headers.find((header) => ['weight', '重量'].includes(header));
  const zoneHeaders = headers.filter((header) => header !== sizeHeader && header !== weightHeader);
  return rows.flatMap((row) => zoneHeaders.map((zone) => normalizeFare({
    carrier: carrierName,
    service: serviceName,
    size: row[sizeHeader],
    zone,
    fare: row[zone],
  }))).filter((fare) => fare.size && fare.zone && toNumber(fare.fare) > 0);
}

function getProductsBySku() {
  return Object.fromEntries(getData('products').map((product) => [product.sku, product]));
}

function getFareRows() {
  return getData('fareTables');
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
  const normalizedAddress = compactText(address);
  if (normalizedAddress.includes('東京都')) return '東京';
  if (['神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県', '山梨県'].some((name) => normalizedAddress.includes(name))) return '関東';
  if (['大阪府', '京都府', '兵庫県', '奈良県', '滋賀県', '和歌山県'].some((name) => normalizedAddress.includes(name))) return '関西';
  if (normalizedAddress.includes('北海道')) return '北海道';
  if (normalizedAddress.includes('沖縄県')) return '沖縄';
  return 'default';
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
  return product ? product.bundleable !== false : true;
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

function getFareOptions(size, zone = 'default') {
  if (!getFareRows().length || !size) return [];
  return getFareRows()
    .map(normalizeFare)
    .filter((fare) => supportedCarriers.includes(fare.carrier) && toNumber(fare.fare) > 0)
    .filter((fare) => fare.zone === zone || fare.zone === 'default')
    .filter((fare) => toNumber(fare.size) === toNumber(size))
    .sort((a, b) => toNumber(a.fare) - toNumber(b.fare));
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
  const fareOptions = missingProduct ? [] : getFareOptions(estimatedSize, zone);
  const best = fareOptions[0] || null;
  const second = fareOptions[1] || null;
  const warningTexts = [...new Set(orders.flatMap((order) => order.warnings || []))];
  const status = missingProduct ? '商品未登録' : (best ? warningTexts.join(' / ') : '対応運賃なし');

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
  const fares = getFareRows().filter((fare) => `${fare.carrier} ${fare.service} ${fare.size} ${fare.zone}`.toLowerCase().includes(keyword));
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
    setData('fareTables', [{ ...fare, id: data.id || makeId('rate') }, ...getFareRows()]);
    form.reset();
    renderCarriers(search?.value || '');
    showToast('運賃表を保存しました。');
  });
  document.addEventListener('click', (event) => {
    const deleteId = event.target.dataset?.deleteFare;
    if (!deleteId) return;
    setData('fareTables', getFareRows().filter((fare) => fare.id !== deleteId));
    renderCarriers(search?.value || '');
    showToast('運賃行を削除しました。');
  });
  document.querySelector('#fare-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('運賃表CSVを選択してください。');
    readFileAsText(file, (text) => {
      const rows = parseCsv(text);
      const headers = Object.keys(rows[0] || {});
      const carrierName = normalizeCarrier(form?.elements?.name?.value || form?.elements?.carrier?.value || 'ヤマト');
      const serviceName = normalize(form?.elements?.service?.value || '宅急便');
      let imported = [];
      if (hasHeaders(headers, ['carrier', 'service', 'size', 'zone', 'fare'])) {
        imported = rows.map(normalizeFare).filter((fare) => supportedCarriers.includes(fare.carrier));
      } else if (isMatrixFareTable(headers)) {
        imported = convertMatrixFareRows(rows, carrierName, serviceName);
      } else {
        const missing = requireColumns(rows, ['carrier', 'service', 'size', 'zone', 'fare']);
        return showToast(`不足字段: ${missing.join(', ')}`);
      }
      setData('fareTables', imported);
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
    if (!file) return showToast('注文CSVを選択してください。');
    readFileAsText(file, (text) => {
      const rows = parseCsv(text);
      const headers = Object.keys(rows[0] || {});
      const platform = detectOrderCsvFormat(headers);
      let importResult;
      if (platform) {
        importResult = importOrderCsvRows(rows);
        if (importResult.missingHeaders.length) {
          return showToast(`${platform} 不足字段: ${importResult.missingHeaders.join(', ')}`);
        }
      } else if (hasHeaders(headers, ['orderNo', 'customer', 'postal', 'address', 'sku', 'quantity'])) {
        const orders = rows.map((row) => normalizeOrder({ ...row, sourcePlatform: 'ShipNavi' }));
        const validOrders = orders.filter(hasStandardOrderFields);
        importResult = {
          platform: 'ShipNavi',
          orders: validOrders,
          successCount: validOrders.length,
          failureCount: orders.length - validOrders.length,
          missingHeaders: [],
          warningCount: validOrders.reduce((sum, order) => sum + (order.warnings?.length || 0), 0),
        };
      }
      if (!importResult) return showToast('未対応CSV形式');
      const imported = importResult.orders;
      setData('orders', imported);
      renderOrders(search?.value || '');
      const summary = document.querySelector('#order-preview-summary');
      const message = `${importResult.platform} CSVを取り込みました / 注文数: ${rows.length} / 成功数: ${importResult.successCount} / 失敗数: ${importResult.failureCount} / 警告数: ${importResult.warningCount || 0}`;
      if (summary) summary.textContent = message;
      showToast(message);
    });
  });
  document.querySelector('#order-excel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Phase 2 MVPはCSVのみ対応です。');
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
