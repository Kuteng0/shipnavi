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

const seedData = {
  products: [
    { id: 'p-demo-1', sku: 'SKU-60-A', name: 'サンプル小物', size: '60', weight: '450', length: '20', width: '15', height: '10', bundleable: true },
    { id: 'p-demo-2', sku: 'SKU-80-B', name: 'サンプルバッグ', size: '80', weight: '900', length: '34', width: '24', height: '14', bundleable: true },
    { id: 'p-demo-3', sku: 'SKU-100-C', name: '割れ物セット', size: '100', weight: '1600', length: '45', width: '30', height: '20', bundleable: false },
  ],
  carriers: [
    { id: 'rate-1', carrier: 'ヤマト', service: '宅急便', size: '60', zone: 'default', fare: '930' },
    { id: 'rate-2', carrier: 'ヤマト', service: '宅急便', size: '80', zone: 'default', fare: '1150' },
    { id: 'rate-3', carrier: 'ヤマト', service: '宅急便', size: '100', zone: 'default', fare: '1390' },
    { id: 'rate-4', carrier: '佐川', service: '飛脚宅配便', size: '60', zone: 'default', fare: '880' },
    { id: 'rate-5', carrier: '佐川', service: '飛脚宅配便', size: '80', zone: 'default', fare: '1080' },
    { id: 'rate-6', carrier: '佐川', service: '飛脚宅配便', size: '100', zone: 'default', fare: '1320' },
    { id: 'rate-7', carrier: '日本郵便', service: 'ゆうパック', size: '60', zone: 'default', fare: '910' },
    { id: 'rate-8', carrier: '日本郵便', service: 'ゆうパック', size: '80', zone: 'default', fare: '1120' },
    { id: 'rate-9', carrier: '日本郵便', service: 'ゆうパック', size: '100', zone: 'default', fare: '1360' },
  ],
  orders: [
    { id: 'o-demo-1', orderNo: 'ORD-001', customer: '田中商店', postal: '100-0001', address: '東京都千代田区1-1', sku: 'SKU-60-A', quantity: '1' },
    { id: 'o-demo-2', orderNo: 'ORD-002', customer: '田中商店', postal: '100-0001', address: '東京都千代田区1-1', sku: 'SKU-80-B', quantity: '1' },
    { id: 'o-demo-3', orderNo: 'ORD-003', customer: '青空株式会社', postal: '530-0001', address: '大阪府大阪市1-2', sku: 'SKU-100-C', quantity: '1' },
  ],
  fareTables: [],
  templates: [],
  templateMappings: [],
  resultSnapshots: [],
  settings: { company: 'ShipNavi', email: 'shipping@example.jp', defaultCarrier: 'ヤマト', cutoffTime: '15:00' },
};

function seedDashboardData() {
  Object.entries(keys).forEach(([name, key]) => {
    if (!localStorage.getItem(key)) storage.write(key, seedData[name]);
  });
  if (!getData('fareTables').length) setData('fareTables', getData('carriers'));
}

function getData(name) {
  return storage.read(keys[name], seedData[name] || []);
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
  return match ? match[0] : '60';
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
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

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

  const headers = (rows.shift() || []).map((header) => header.trim());
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
  reader.addEventListener('load', () => callback(String(reader.result || '')));
  reader.readAsText(file);
}

function requireColumns(rows, columns) {
  const headers = Object.keys(rows[0] || {});
  return columns.filter((column) => !headers.includes(column));
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
    postal: normalize(row.postal),
    address: normalize(row.address),
    sku: normalize(row.sku),
    quantity: String(Math.max(1, toNumber(row.quantity) || 1)),
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

function getProductsBySku() {
  return Object.fromEntries(getData('products').map((product) => [product.sku, product]));
}

function getFareRows() {
  return getData('fareTables').length ? getData('fareTables') : getData('carriers');
}

function getOrderSize(order, productsBySku = getProductsBySku()) {
  const product = productsBySku[order.sku];
  return product ? normalizeSize(product.size) : '60';
}

function isOrderBundleable(order, productsBySku = getProductsBySku()) {
  const product = productsBySku[order.sku];
  return product ? product.bundleable !== false : true;
}

function getBundleKey(order) {
  return [order.customer, order.postal, order.address].map((value) => normalize(value).toLowerCase()).join('|');
}

function getBundleCandidates() {
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

function findBestFare(size, zone = 'default') {
  const requestedSize = toNumber(size);
  const fareRows = getFareRows()
    .map(normalizeFare)
    .filter((fare) => supportedCarriers.includes(fare.carrier) && toNumber(fare.fare) > 0)
    .filter((fare) => !zone || fare.zone === zone || fare.zone === 'default')
    .filter((fare) => toNumber(fare.size) >= requestedSize)
    .sort((a, b) => toNumber(a.fare) - toNumber(b.fare));
  return fareRows[0] || null;
}

function getRecommendationRows() {
  const productsBySku = getProductsBySku();
  const orders = getData('orders');
  const bundleKeys = new Set(getBundleCandidates().flatMap((group) => group.orders.map((order) => order.id)));

  return orders.map((order) => {
    const size = getOrderSize(order, productsBySku);
    const best = findBestFare(size);
    const currentFare = Math.max(...getFareRows().map((fare) => toNumber(fare.fare)).filter(Boolean), best ? toNumber(best.fare) : 0);
    const estimatedFare = best ? toNumber(best.fare) : 0;
    return {
      orderNo: order.orderNo,
      customer: order.customer,
      postal: order.postal,
      address: order.address,
      sku: order.sku,
      quantity: order.quantity,
      bundleable: bundleKeys.has(order.id) ? '同梱候補' : '単独',
      recommendedCarrier: best?.carrier || '',
      recommendedService: best?.service || '',
      estimatedFare,
      saving: Math.max(0, currentFare - estimatedFare),
    };
  });
}

function getResultSummary() {
  const recommendations = getRecommendationRows();
  return {
    orderCount: getData('orders').length,
    bundleCount: getBundleCandidates().length,
    saving: recommendations.reduce((sum, row) => sum + row.saving, 0),
    topRecommendation: recommendations[0] || null,
  };
}

function renderDashboard() {
  const target = document.querySelector('#dashboard-view');
  if (!target) return;
  const summary = getResultSummary();
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推定節省額</p><strong>${formatYen(summary.saving)}</strong></article>
      <article class="stat-card"><p>最低運賃</p><strong>${formatYen(summary.topRecommendation?.estimatedFare || 0)}</strong></article>
    </section>
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
      const missing = requireColumns(rows, ['carrier', 'service', 'size', 'zone', 'fare']);
      if (missing.length) return showToast(`不足字段: ${missing.join(', ')}`);
      const imported = rows.map(normalizeFare).filter((fare) => supportedCarriers.includes(fare.carrier));
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
      <td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.postal)}</td>
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
      const missing = requireColumns(rows, ['orderNo', 'customer', 'postal', 'address', 'sku', 'quantity']);
      if (missing.length) return showToast(`不足字段: ${missing.join(', ')}`);
      const imported = rows.map(normalizeOrder).filter((order) => order.orderNo && order.sku);
      setData('orders', imported);
      renderOrders(search?.value || '');
      showToast(`${imported.length}件の注文CSVを保存しました。`);
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
  const recommendations = getRecommendationRows();
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>注文数</p><strong>${summary.orderCount}</strong></article>
      <article class="stat-card"><p>同梱数</p><strong>${summary.bundleCount}</strong></article>
      <article class="stat-card"><p>推薦配送方式</p><strong>${escapeHtml(summary.topRecommendation?.recommendedCarrier || '-')}</strong></article>
      <article class="stat-card"><p>節省金額</p><strong>${formatYen(summary.saving)}</strong></article>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>結果中心</h2><button class="button secondary" type="button" id="export-results-csv">CSV导出</button></div>
      <div class="responsive-table"><table><thead><tr><th>注文番号</th><th>同梱</th><th>推薦会社</th><th>推薦サービス</th><th>預估運費</th><th>節省金額</th></tr></thead>
      <tbody>${recommendations.map((row) => `<tr><td>${escapeHtml(row.orderNo)}</td><td>${escapeHtml(row.bundleable)}</td><td>${escapeHtml(row.recommendedCarrier)}</td><td>${escapeHtml(row.recommendedService)}</td><td>${formatYen(row.estimatedFare)}</td><td><span class="badge green">${formatYen(row.saving)}</span></td></tr>`).join('') || '<tr><td colspan="6">結果データがありません。</td></tr>'}</tbody></table></div>
    </section>
    <section class="table-card full-width">
      <div class="table-toolbar"><h2>同梱候補</h2></div>
      <div class="responsive-table"><table><thead><tr><th>配送先</th><th>対象注文</th><th>件数</th></tr></thead><tbody>${getBundleCandidates().map((group) => `<tr><td>${escapeHtml(group.orders[0].customer)} / ${escapeHtml(group.orders[0].postal)} / ${escapeHtml(group.orders[0].address)}</td><td>${group.orders.map((order) => escapeHtml(order.orderNo)).join('<br>')}</td><td>${group.orders.length}</td></tr>`).join('') || '<tr><td colspan="3">同梱候補はありません。</td></tr>'}</tbody></table></div>
    </section>
  `;
  document.querySelector('#export-results-csv')?.addEventListener('click', () => {
    const rows = recommendations.map((row) => ({
      orderNo: row.orderNo,
      bundle: row.bundleable,
      recommendedCarrier: row.recommendedCarrier,
      recommendedService: row.recommendedService,
      estimatedFare: row.estimatedFare,
      saving: row.saving,
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
    Object.entries(keys).forEach(([name, key]) => storage.write(key, seedData[name]));
    setData('fareTables', seedData.carriers);
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
