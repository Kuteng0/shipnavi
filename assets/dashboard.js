const storage = {
  read(key, fallback) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  },
  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const mockData = {
  products: [
    { id: 'p-1', sku: 'SNV-JKT-001', name: '軽量ジャケット', size: '60', weight: '450', length: '30', width: '20', height: '8', bundleable: '可' },
    { id: 'p-2', sku: 'SNV-BAG-014', name: 'キャンバストート', size: '80', weight: '720', length: '36', width: '28', height: '6', bundleable: '可' },
    { id: 'p-3', sku: 'SNV-MUG-022', name: 'セラミックマグ', size: '60', weight: '390', length: '12', width: '12', height: '10', bundleable: '不可' },
  ],
  carriers: [
    { id: 'c-1', name: 'ヤマト運輸', service: '宅急便', memo: '関東翌日配送' },
    { id: 'c-2', name: '佐川急便', service: '飛脚宅配便', memo: '大口割引確認中' },
    { id: 'c-3', name: '日本郵便', service: 'ゆうパック', memo: '離島配送に強い' },
  ],
  orders: [
    { id: 'o-1', orderNo: 'ORD-20260607-001', recipient: '田中商店', postal: '100-0001', address: '東京都千代田区1-1-1', sku: 'SNV-JKT-001', quantity: '2', status: '同梱候補' },
    { id: 'o-2', orderNo: 'ORD-20260607-002', recipient: '株式会社青空', postal: '530-0001', address: '大阪府大阪市北区1-2-3', sku: 'SNV-MUG-022', quantity: '6', status: '運賃比較済み' },
    { id: 'o-3', orderNo: 'ORD-20260607-003', recipient: '佐藤 花子', postal: '100-0001', address: '東京都千代田区1-1-1', sku: 'SNV-BAG-014', quantity: '1', status: '指示書待ち' },
  ],
  fareTables: [
    { id: 'f-1', carrier: 'ヤマト運輸', service: '宅急便', size: '60', zone: '関東', weight: '2kgまで', fare: '850', fileName: 'mock-fares.csv' },
    { id: 'f-2', carrier: '佐川急便', service: '飛脚宅配便', size: '60', zone: '関東', weight: '2kgまで', fare: '790', fileName: 'mock-fares.csv' },
    { id: 'f-3', carrier: '日本郵便', service: 'ゆうパック', size: '60', zone: '関東', weight: '2kgまで', fare: '820', fileName: 'mock-fares.csv' },
    { id: 'f-4', carrier: 'ヤマト運輸', service: '宅急便', size: '80', zone: '関西', weight: '5kgまで', fare: '1180', fileName: 'mock-fares.csv' },
    { id: 'f-5', carrier: '佐川急便', service: '飛脚宅配便', size: '80', zone: '関西', weight: '5kgまで', fare: '1090', fileName: 'mock-fares.csv' },
    { id: 'f-6', carrier: '日本郵便', service: 'ゆうパック', size: '80', zone: '関西', weight: '5kgまで', fare: '1130', fileName: 'mock-fares.csv' },
  ],
  templates: [
    { id: 't-1', name: '顧客標準CSV', fileName: 'customer-template.csv', columns: ['注文番号', '届け先名', '郵便番号', '住所', '商品SKU', '数量'], status: '有効' },
  ],
  templateMappings: [
    { id: 'm-1', templateId: 't-1', target: '注文番号', source: '注文番号' },
    { id: 'm-2', templateId: 't-1', target: '受取人', source: '届け先名' },
    { id: 'm-3', templateId: 't-1', target: 'SKU', source: '商品SKU' },
  ],
  resultSnapshots: [],
  settings: { company: '株式会社サンプルEC', email: 'shipping@example.jp', defaultCarrier: 'ヤマト運輸', cutoffTime: '15:00' },
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

const requiredTemplateFields = ['注文番号', '受取人', '郵便番号', '住所', 'SKU', '数量'];

function seedDashboardData() {
  Object.entries(keys).forEach(([name, key]) => {
    if (!localStorage.getItem(key)) storage.write(key, mockData[name]);
  });
}

function getData(name) {
  return storage.read(keys[name], mockData[name]);
}

function setData(name, value) {
  storage.write(keys[name], value);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const headers = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function parseCsvHeaders(text) {
  const firstLine = text.trim().split(/\r?\n/).filter(Boolean)[0] || '';
  return parseCsvLine(firstLine).filter(Boolean);
}

function toCsv(rows, columns) {
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns.map(escapeCell).join(','), ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(','))].join('\n');
}

function downloadCsv(fileName, rows, columns) {
  const blob = new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readFileAsText(file, callback) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(String(reader.result || '')));
  reader.readAsText(file);
}

function formatYen(value) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

function firstPresent(record, keysToTry, fallback = '') {
  const foundKey = keysToTry.find((key) => record[key] !== undefined && record[key] !== '');
  return foundKey ? record[foundKey] : fallback;
}

function normalizeBundleable(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['不可', 'no', 'false', '0', 'ng', 'not allowed'].includes(normalized)) return '不可';
  return '可';
}

function normalizeProduct(product) {
  return {
    id: product.id || makeId('p'),
    sku: firstPresent(product, ['sku', 'SKU', '商品SKU', '商品コード', '商品编号']),
    name: firstPresent(product, ['name', 'productName', '商品名', '品名']),
    size: firstPresent(product, ['size', 'サイズ', '寸法区分'], '60'),
    weight: firstPresent(product, ['weight', '重量', '重さ'], '0'),
    length: firstPresent(product, ['length', 'long', '長', '長さ'], '0'),
    width: firstPresent(product, ['width', '幅'], '0'),
    height: firstPresent(product, ['height', '高', '高さ'], '0'),
    bundleable: normalizeBundleable(firstPresent(product, ['bundleable', 'canBundle', '同梱可否', '同梱', '可否同梱'], '可')),
  };
}

function normalizeOrder(order) {
  return {
    id: order.id || makeId('o'),
    orderNo: firstPresent(order, ['orderNo', 'orderNumber', '注文番号', '受注番号', '订单号']),
    recipient: firstPresent(order, ['recipient', 'customer', 'customerName', '受取人', '届け先名', '顧客名', '收件人']),
    postal: firstPresent(order, ['postal', 'zip', 'zipcode', '郵便番号', '邮编']),
    address: firstPresent(order, ['address', '住所', '届け先住所', '地址']),
    sku: firstPresent(order, ['sku', 'SKU', '商品SKU', '商品コード']),
    quantity: firstPresent(order, ['quantity', 'qty', '数量', '個数'], '1'),
    status: order.status || '取込済み',
  };
}

function normalizeFare(row, index = 0) {
  const carriers = getData('carriers');
  const carrier = firstPresent(row, ['carrier', '配送会社', '運送会社', '运输商'], carriers[index % Math.max(carriers.length, 1)]?.name || '未設定');
  const carrierRecord = carriers.find((item) => item.name === carrier);
  return {
    id: row.id || makeId('f'),
    carrier,
    service: firstPresent(row, ['service', 'サービス', '配送サービス'], carrierRecord?.service || ''),
    zone: firstPresent(row, ['zone', '地区', '地域', 'region'], '全国'),
    region: firstPresent(row, ['region', '地区', '地域', 'zone'], '全国'),
    size: String(firstPresent(row, ['size', 'サイズ', '尺寸'], '60')).replace(/サイズ/g, ''),
    weight: firstPresent(row, ['weight', '重量', '重さ'], '2kgまで'),
    fare: Number(firstPresent(row, ['fare', 'price', '価格', '运费', '送料'], '0')),
    price: Number(firstPresent(row, ['price', 'fare', '価格', '运费', '送料'], '0')),
    fileName: row.fileName || 'manual.csv',
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

function getOrderProduct(order, products = getData('products').map(normalizeProduct)) {
  return products.find((product) => product.sku === order.sku) || normalizeProduct({ sku: order.sku, name: order.sku, size: '60', weight: '0', bundleable: '可' });
}

function getOrderZone(order) {
  const postal = String(order.postal || '');
  if (/^(5|6)/.test(postal)) return '関西';
  if (/^(0|9)/.test(postal)) return '北海道';
  if (/^(8)/.test(postal)) return '九州';
  return '関東';
}

function getOrderSize(order, product = getOrderProduct(order)) {
  const explicitSize = Number(product.size || 0);
  if (explicitSize) return explicitSize;
  const dimensionTotal = Number(product.length || 0) + Number(product.width || 0) + Number(product.height || 0);
  if (dimensionTotal <= 60) return 60;
  if (dimensionTotal <= 80) return 80;
  if (dimensionTotal <= 100) return 100;
  if (dimensionTotal <= 120) return 120;
  return 140;
}

function getBundleCandidates() {
  const orders = getData('orders').map(normalizeOrder);
  const products = getData('products').map(normalizeProduct);
  const groups = orders.reduce((acc, order) => {
    const product = getOrderProduct(order, products);
    if (product.bundleable === '不可') return acc;
    const key = [order.recipient, order.postal, order.address].map((value) => String(value || '').trim()).join('|');
    acc[key] = acc[key] || [];
    acc[key].push(order);
    return acc;
  }, {});
  return Object.entries(groups)
    .filter(([, groupedOrders]) => groupedOrders.length > 1)
    .map(([destination, groupedOrders]) => ({ destination, orders: groupedOrders, saving: (groupedOrders.length - 1) * 320 }));
}

function matchesFareRow(row, order, product) {
  const orderSize = getOrderSize(order, product);
  const orderZone = getOrderZone(order);
  const rowSize = Number(String(row.size || '0').replace(/[^0-9]/g, '')) || 0;
  const rowZone = row.zone || row.region || '全国';
  return (!rowSize || rowSize >= orderSize) && (rowZone === '全国' || rowZone === orderZone);
}

function compareFaresForOrder(order) {
  const product = getOrderProduct(order);
  const fareRows = getData('fareTables').map(normalizeFare).filter((row) => ['ヤマト運輸', 'ヤマト', '佐川急便', '佐川', '日本郵便'].some((name) => row.carrier.includes(name)));
  const carrierFallbacks = getData('carriers').map((carrier, index) => normalizeFare({ carrier: carrier.name, service: carrier.service, zone: '全国', size: getOrderSize(order, product), fare: 850 + (index * 80), fileName: 'fallback' }, index));
  const candidates = (fareRows.length ? fareRows : carrierFallbacks)
    .filter((row) => matchesFareRow(row, order, product))
    .map((row) => ({ ...row, priceNumber: Number(row.fare || row.price || 0) }))
    .filter((row) => row.priceNumber > 0)
    .sort((a, b) => a.priceNumber - b.priceNumber);
  const ranked = candidates.length ? candidates : carrierFallbacks.map((row) => ({ ...row, priceNumber: Number(row.fare || row.price || 0) })).sort((a, b) => a.priceNumber - b.priceNumber);
  const lowest = ranked[0] || normalizeFare({ carrier: '未設定', service: '', fare: 0 });
  const second = ranked[1] || lowest;
  return {
    order,
    product,
    recommendedCarrier: lowest.carrier,
    recommendedService: lowest.service || '',
    estimatedFare: Number(lowest.priceNumber || lowest.fare || lowest.price || 0),
    lowestPrice: Number(lowest.priceNumber || lowest.fare || lowest.price || 0),
    secondLowestPrice: Number(second.priceNumber || second.fare || second.price || 0),
    saving: Math.max(0, Number(second.priceNumber || second.fare || second.price || 0) - Number(lowest.priceNumber || lowest.fare || lowest.price || 0)),
  };
}

function getFareComparisons() {
  return getData('orders').map(normalizeOrder).map(compareFaresForOrder);
}

function getShipmentInstructions() {
  const bundleLookup = new Map();
  getBundleCandidates().forEach((candidate, index) => {
    candidate.orders.forEach((order) => bundleLookup.set(order.id, `BUNDLE-${index + 1}`));
  });
  return getFareComparisons().map((comparison) => ({
    orderNo: comparison.order.orderNo,
    recipient: comparison.order.recipient,
    postal: comparison.order.postal,
    address: comparison.order.address,
    sku: comparison.order.sku,
    quantity: comparison.order.quantity,
    recommendedCarrier: comparison.recommendedCarrier,
    recommendedService: comparison.recommendedService,
    estimatedFare: comparison.estimatedFare,
    bundleGroup: bundleLookup.get(comparison.order.id) || '',
  }));
}

function getEstimatedSavings() {
  const fareSaving = getFareComparisons().reduce((sum, item) => sum + item.saving, 0);
  const bundleSaving = getBundleCandidates().reduce((sum, item) => sum + item.saving, 0);
  return fareSaving + bundleSaving;
}

function renderDashboard() {
  const target = document.querySelector('#dashboard-view');
  if (!target) return;
  const orders = getData('orders').map(normalizeOrder);
  const bundleCandidates = getBundleCandidates();
  const pending = orders.filter((order) => order.status !== '運賃比較済み').length;
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>今日の注文</p><strong>${orders.length}</strong></article>
      <article class="stat-card"><p>同梱候補</p><strong>${bundleCandidates.length}</strong></article>
      <article class="stat-card"><p>推定節約額</p><strong>${formatYen(getEstimatedSavings())}</strong></article>
      <article class="stat-card"><p>未処理候補</p><strong>${pending}</strong></article>
    </section>
    <section class="panel"><h2>今日の確認事項</h2><ul class="status-list"><li><span>注文プレビュー</span><b>${orders.length}件</b></li><li><span>同梱候補</span><b>${bundleCandidates.length}件</b></li><li><span>運賃比較</span><b>${getFareComparisons().length}件</b></li></ul></section>
    <section class="panel"><h2>クイック操作</h2><div class="action-grid"><a class="action-card" href="products.html"><b>商品を追加</b><span>寸法・重量・同梱可否を登録</span></a><a class="action-card" href="orders.html"><b>注文を取り込む</b><span>CSV / ExcelのMock取込</span></a><a class="action-card" href="results.html"><b>結果を生成</b><span>推薦配送会社と節約額</span></a></div></section>
  `;
}

function renderProducts(filter = '') {
  const tbody = document.querySelector('#products-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const products = getData('products').map(normalizeProduct).filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(keyword));
  tbody.innerHTML = products.map((product) => `
    <tr><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.weight)}g</td><td>${escapeHtml(product.length)}cm</td><td>${escapeHtml(product.width)}cm</td><td>${escapeHtml(product.height)}cm</td><td><span class="badge ${product.bundleable === '可' ? 'green' : 'orange'}">${escapeHtml(product.bundleable)}</span></td><td><div class="row-actions"><button class="small-button" data-edit-product="${product.id}">編集</button><button class="small-button danger" data-delete-product="${product.id}">削除</button></div></td></tr>
  `).join('') || '<tr><td colspan="8">商品がありません。</td></tr>';
}

function initProducts() {
  const form = document.querySelector('#product-form');
  if (!form) return;
  const search = document.querySelector('#product-search');
  renderProducts();
  search?.addEventListener('input', () => renderProducts(search.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawData = Object.fromEntries(new FormData(form).entries());
    const data = normalizeProduct(rawData);
    const products = getData('products').map(normalizeProduct);
    if (rawData.id) {
      setData('products', products.map((product) => product.id === rawData.id ? data : product));
      showToast('商品を更新しました。');
    } else {
      setData('products', [{ ...data, id: makeId('p') }, ...products]);
      showToast('商品を追加しました。');
    }
    form.reset();
    renderProducts(search?.value || '');
  });
  document.addEventListener('click', (event) => {
    const editId = event.target.dataset?.editProduct;
    const deleteId = event.target.dataset?.deleteProduct;
    if (editId) {
      const product = getData('products').map(normalizeProduct).find((item) => item.id === editId);
      if (product) Object.entries(product).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    }
    if (deleteId) {
      setData('products', getData('products').map(normalizeProduct).filter((product) => product.id !== deleteId));
      renderProducts(search?.value || '');
      showToast('商品を削除しました。');
    }
  });
  document.querySelector('#product-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('CSVファイルを選択してください。');
    readFileAsText(file, (text) => {
      const imported = parseCsv(text).map((row) => normalizeProduct({ ...row, id: makeId('p') }));
      setData('products', [...imported, ...getData('products').map(normalizeProduct)]);
      renderProducts(search?.value || '');
      showToast(`${imported.length}件の商品CSVを取り込みました。`);
    });
  });
}

function renderCarriers(filter = '') {
  const tbody = document.querySelector('#carriers-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const carriers = getData('carriers').filter((carrier) => `${carrier.name} ${carrier.service}`.toLowerCase().includes(keyword));
  tbody.innerHTML = carriers.map((carrier) => `
    <tr><td>${escapeHtml(carrier.name)}</td><td>${escapeHtml(carrier.service)}</td><td>${escapeHtml(carrier.memo)}</td><td><div class="row-actions"><button class="small-button" data-edit-carrier="${carrier.id}">編集</button><button class="small-button danger" data-delete-carrier="${carrier.id}">削除</button></div></td></tr>
  `).join('') || '<tr><td colspan="4">配送会社がありません。</td></tr>';
}

function renderFareTables() {
  const tbody = document.querySelector('#fares-table');
  if (!tbody) return;
  const fares = getData('fareTables').map(normalizeFare);
  tbody.innerHTML = fares.map((fare) => `<tr><td>${escapeHtml(fare.carrier)}</td><td>${escapeHtml(fare.region)}</td><td>${escapeHtml(fare.size)}</td><td>${escapeHtml(fare.weight)}</td><td>${formatYen(fare.price)}</td><td>${escapeHtml(fare.fileName)}</td></tr>`).join('') || '<tr><td colspan="6">運賃表がありません。</td></tr>';
  const summary = document.querySelector('#fare-preview-summary');
  if (summary) summary.textContent = `${fares.length}件の運賃行をLocalStorageに保存しています。`;
}

function initCarriers() {
  const form = document.querySelector('#carrier-form');
  if (!form) return;
  const search = document.querySelector('#carrier-search');
  renderCarriers();
  renderFareTables();
  search?.addEventListener('input', () => renderCarriers(search.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const carriers = getData('carriers');
    if (data.id) {
      setData('carriers', carriers.map((carrier) => carrier.id === data.id ? data : carrier));
      showToast('配送会社を更新しました。');
    } else {
      setData('carriers', [{ ...data, id: makeId('c') }, ...carriers]);
      showToast('配送会社を追加しました。');
    }
    form.reset();
    renderCarriers(search?.value || '');
  });
  document.addEventListener('click', (event) => {
    const editId = event.target.dataset?.editCarrier;
    const deleteId = event.target.dataset?.deleteCarrier;
    if (editId) {
      const carrier = getData('carriers').find((item) => item.id === editId);
      if (carrier) Object.entries(carrier).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value; });
    }
    if (deleteId) {
      setData('carriers', getData('carriers').filter((carrier) => carrier.id !== deleteId));
      renderCarriers(search?.value || '');
      showToast('配送会社を削除しました。');
    }
  });
  document.querySelector('#fare-import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('運賃表CSVを選択してください。');
    readFileAsText(file, (text) => {
      const imported = parseCsv(text).map((row, index) => normalizeFare({ ...row, id: makeId('f'), fileName: file.name }, index));
      setData('fareTables', [...imported, ...getData('fareTables').map(normalizeFare)]);
      renderFareTables();
      showToast(`${imported.length}行の運賃表を取り込みました。`);
    });
  });
}

function renderOrders(filter = '') {
  const tbody = document.querySelector('#orders-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const orders = getData('orders').map(normalizeOrder).filter((order) => `${order.orderNo} ${order.recipient}`.toLowerCase().includes(keyword));
  tbody.innerHTML = orders.map((order) => `
    <tr><td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.recipient)}</td><td>${escapeHtml(order.postal)}</td><td>${escapeHtml(order.address)}</td><td>${escapeHtml(order.sku)}</td><td>${escapeHtml(order.quantity)}</td><td><span class="badge ${order.status === '運賃比較済み' ? 'green' : 'orange'}">${escapeHtml(order.status)}</span></td></tr>
  `).join('') || '<tr><td colspan="7">注文がありません。</td></tr>';
  const summary = document.querySelector('#order-preview-summary');
  if (summary) summary.textContent = `${orders.length}件の注文を表プレビューに表示しています。`;
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
      const imported = parseCsv(text).map((row) => normalizeOrder({ ...row, id: makeId('o') }));
      setData('orders', [...imported, ...getData('orders').map(normalizeOrder)]);
      renderOrders(search?.value || '');
      showToast(`${imported.length}件の注文CSVを取り込みました。`);
    });
  });
  document.querySelector('#order-excel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('Excelファイルを選択してください。');
    const mockOrder = { id: makeId('o'), orderNo: `XLS-${Date.now()}`, recipient: 'Excel取込サンプル', postal: '150-0001', address: '東京都渋谷区1-1-1', sku: 'SNV-JKT-001', quantity: '1', status: 'Excel取込済み' };
    setData('orders', [mockOrder, ...getData('orders').map(normalizeOrder)]);
    renderOrders(search?.value || '');
    showToast('ExcelファイルをMock注文として保存しました。');
  });
}

function renderTemplates() {
  const target = document.querySelector('#templates-view');
  if (!target) return;
  const templates = getData('templates');
  const mappings = getData('templateMappings');
  const activeTemplate = templates[0];
  target.outerHTML = `
    <section class="upload-card full-width"><h2>顧客CSVテンプレートをアップロード</h2><form id="template-upload-form"><label class="file-drop"><span>顧客CSVテンプレートを選択してください</span><input type="file" accept=".csv,text/csv" name="file" /></label><button class="button primary" type="submit">テンプレートを保存</button></form></section>
    <section class="form-card full-width"><h2>フィールドマッピング</h2><p class="help-text">ShipNavi標準項目に対して、顧客CSVテンプレートの列を割り当てます。</p>${activeTemplate ? `<form id="template-mapping-form" data-template-id="${activeTemplate.id}"><div class="mapping-list">${requiredTemplateFields.map((field) => { const saved = mappings.find((mapping) => mapping.templateId === activeTemplate.id && mapping.target === field); return `<label class="mapping-row"><span>${escapeHtml(field)}</span><select name="${escapeHtml(field)}"><option value="">未設定</option>${(activeTemplate.columns || []).map((column) => `<option value="${escapeHtml(column)}" ${saved?.source === column ? 'selected' : ''}>${escapeHtml(column)}</option>`).join('')}</select></label>`; }).join('')}</div><button class="button secondary" type="submit">マッピングを保存</button></form>` : '<p>テンプレートをアップロードしてください。</p>'}</section>
    <section class="template-grid full-width">${templates.map((template) => `<article class="panel"><span class="badge ${template.status === '有効' ? 'green' : 'orange'}">${escapeHtml(template.status)}</span><h2>${escapeHtml(template.name)}</h2><p>${escapeHtml(template.fileName || 'CSVテンプレート')}</p><ul>${template.columns.map((column) => `<li>${escapeHtml(column)}</li>`).join('')}</ul></article>`).join('')}</section>
  `;
  document.querySelector('#template-upload-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('顧客CSVテンプレートを選択してください。');
    readFileAsText(file, (text) => {
      const columns = parseCsvHeaders(text);
      const template = { id: makeId('t'), name: file.name.replace(/\.csv$/i, '') || '顧客CSVテンプレート', fileName: file.name, columns, status: '確認中' };
      setData('templates', [template, ...getData('templates')]);
      showToast(`${columns.length}列のテンプレートを保存しました。`);
      renderTemplates();
    });
  });
  document.querySelector('#template-mapping-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const templateId = event.currentTarget.dataset.templateId;
    const formData = new FormData(event.currentTarget);
    const others = getData('templateMappings').filter((mapping) => mapping.templateId !== templateId);
    const nextMappings = requiredTemplateFields.map((field) => ({ id: makeId('m'), templateId, target: field, source: formData.get(field) || '' })).filter((mapping) => mapping.source);
    setData('templateMappings', [...nextMappings, ...others]);
    showToast('フィールドマッピングを保存しました。');
  });
}

function renderResults() {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const fareComparisons = getFareComparisons();
  const bundleCandidates = getBundleCandidates();
  const instructions = getShipmentInstructions();
  const snapshots = getData('resultSnapshots');
  target.outerHTML = `
    <section class="stat-grid full-width"><article class="stat-card"><p>注文数</p><strong>${fareComparisons.length}</strong></article><article class="stat-card"><p>同梱数</p><strong>${bundleCandidates.length}</strong></article><article class="stat-card"><p>節約額</p><strong>${formatYen(getEstimatedSavings())}</strong></article><article class="stat-card"><p>保存済み結果</p><strong>${snapshots.length}</strong></article></section>
    <section class="table-card full-width"><div class="table-toolbar"><h2>Mock 運賃比較結果</h2></div><div class="responsive-table"><table><thead><tr><th>注文番号</th><th>推薦配送会社</th><th>推薦サービス</th><th>最低価格</th><th>第二低価格</th><th>節約額</th></tr></thead><tbody>${fareComparisons.map((item) => `<tr><td>${escapeHtml(item.order.orderNo)}</td><td>${escapeHtml(item.recommendedCarrier)}</td><td>${escapeHtml(item.recommendedService)}</td><td>${formatYen(item.lowestPrice)}</td><td>${formatYen(item.secondLowestPrice)}</td><td><span class="badge green">${formatYen(item.saving)}</span></td></tr>`).join('') || '<tr><td colspan="6">比較対象の注文がありません。</td></tr>'}</tbody></table></div></section>
    <section class="table-card full-width"><div class="table-toolbar"><h2>出荷指示書プレビュー</h2></div><div class="responsive-table"><table><thead><tr><th>注文番号</th><th>受取人</th><th>SKU</th><th>数量</th><th>推薦配送</th><th>同梱</th></tr></thead><tbody>${instructions.map((item) => `<tr><td>${escapeHtml(item.orderNo)}</td><td>${escapeHtml(item.recipient)}</td><td>${escapeHtml(item.sku)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.recommendedCarrier)} ${escapeHtml(item.recommendedService)}</td><td>${escapeHtml(item.bundleGroup)}</td></tr>`).join('') || '<tr><td colspan="6">出荷指示がありません。</td></tr>'}</tbody></table></div></section>
    <section class="table-card full-width"><div class="table-toolbar"><h2>Mock 同梱結果</h2></div><div class="responsive-table"><table><thead><tr><th>配送先</th><th>対象注文</th><th>件数</th><th>節約見込み</th><th>状態</th></tr></thead><tbody>${bundleCandidates.map((candidate) => `<tr><td>${escapeHtml(candidate.destination)}</td><td>${candidate.orders.map((order) => escapeHtml(order.orderNo)).join('<br>')}</td><td>${candidate.orders.length}件</td><td>${formatYen(candidate.saving)}</td><td><span class="badge orange">確認待ち</span></td></tr>`).join('') || '<tr><td colspan="5">同梱候補がありません。</td></tr>'}</tbody></table></div></section>
    <section class="panel full-width"><h2>比較結果を生成</h2><p>注文CSV・商品マスタ・運賃表から推薦配送会社、推薦サービス、推定運賃、節約額、出荷指示を生成します。</p><button class="button primary" type="button" id="mock-generate-result">結果を保存</button> <button class="button secondary" type="button" id="export-instructions-csv">出荷指示CSVを出力</button></section>
  `;
  document.querySelector('#mock-generate-result')?.addEventListener('click', () => {
    const snapshot = { id: makeId('r'), savedAt: new Date().toLocaleString('ja-JP'), orderCount: fareComparisons.length, bundleCount: bundleCandidates.length, estimatedSavings: getEstimatedSavings(), instructions };
    setData('resultSnapshots', [snapshot, ...getData('resultSnapshots')]);
    showToast('運賃比較結果と出荷指示をLocalStorageに保存しました。');
    renderResults();
  });
  document.querySelector('#export-instructions-csv')?.addEventListener('click', () => {
    downloadCsv('shipnavi-shipment-instructions.csv', instructions, ['orderNo', 'recipient', 'postal', 'address', 'sku', 'quantity', 'recommendedCarrier', 'recommendedService', 'estimatedFare', 'bundleGroup']);
  });
}

function renderSettings() {
  const target = document.querySelector('#settings-view');
  if (!target) return;
  const settings = getData('settings');
  target.outerHTML = `<section class="form-card full-width"><h2>会社設定</h2><form id="settings-form"><div class="form-grid"><label class="input-group">会社名<input name="company" value="${escapeHtml(settings.company)}" required /></label><label class="input-group">通知メール<input name="email" type="email" value="${escapeHtml(settings.email)}" required /></label><label class="input-group">標準配送会社<input name="defaultCarrier" value="${escapeHtml(settings.defaultCarrier)}" /></label><label class="input-group">出荷締め時刻<input name="cutoffTime" value="${escapeHtml(settings.cutoffTime)}" /></label></div><button class="button primary" type="submit">設定を保存</button></form></section><section class="panel full-width"><h2>LocalStorage管理</h2><p>このDashboardプロトタイプは全データをブラウザのLocalStorageに保存しています。データベースには接続していません。</p><button class="button secondary" type="button" id="reset-dashboard-data">Mock Dataに戻す</button></section>`;
  document.querySelector('#settings-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    setData('settings', Object.fromEntries(new FormData(event.currentTarget).entries()));
    showToast('設定を保存しました。');
  });
  document.querySelector('#reset-dashboard-data')?.addEventListener('click', () => {
    Object.entries(keys).forEach(([name, key]) => storage.write(key, mockData[name]));
    showToast('Mock Dataにリセットしました。');
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
