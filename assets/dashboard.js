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
    { id: 'p-1', sku: 'SNV-JKT-001', name: '軽量ジャケット', size: '60サイズ', weight: '450', memo: '折りたたみ梱包' },
    { id: 'p-2', sku: 'SNV-BAG-014', name: 'キャンバストート', size: '80サイズ', weight: '720', memo: '同梱推奨' },
    { id: 'p-3', sku: 'SNV-MUG-022', name: 'セラミックマグ', size: '60サイズ', weight: '390', memo: '割れ物注意' },
  ],
  carriers: [
    { id: 'c-1', name: 'ヤマト運輸', service: '宅急便', baseFare: '850', sizes: '60,80,100,120', memo: '関東翌日配送' },
    { id: 'c-2', name: '佐川急便', service: '飛脚宅配便', baseFare: '790', sizes: '60,80,100', memo: '大口割引確認中' },
    { id: 'c-3', name: '日本郵便', service: 'ゆうパック', baseFare: '820', sizes: '60,80,100,120', memo: '離島配送に強い' },
  ],
  orders: [
    { id: 'o-1', orderNo: 'ORD-20260607-001', customer: '田中商店', postal: '100-0001', items: 'SNV-JKT-001 x 2', total: '12960', carrier: 'ヤマト運輸', status: '同梱候補' },
    { id: 'o-2', orderNo: 'ORD-20260607-002', customer: '株式会社青空', postal: '530-0001', items: 'SNV-MUG-022 x 6', total: '8940', carrier: '日本郵便', status: '運賃比較済み' },
    { id: 'o-3', orderNo: 'ORD-20260607-003', customer: '佐藤 花子', postal: '060-0001', items: 'SNV-BAG-014 x 1', total: '3980', carrier: '佐川急便', status: '指示書待ち' },
  ],
  fareTables: [
    { id: 'f-1', carrier: 'ヤマト運輸', fileName: 'mock-yamato-fares.csv', importedAt: '2026-06-07 09:00', rows: 48 },
  ],
  templates: [
    { id: 't-1', name: 'ヤマト送り状CSV', fileName: 'yamato-template.csv', columns: ['お客様管理番号', '送り先氏名', '郵便番号', '住所', '品名'], status: '有効' },
    { id: 't-2', name: '佐川送り状CSV', fileName: 'sagawa-template.csv', columns: ['出荷日', '荷受人名称', '荷受人郵便番号', '荷受人住所', '個数'], status: '確認中' },
    { id: 't-3', name: '自社出荷指示書', fileName: 'instruction-template.csv', columns: ['注文番号', 'SKU', '数量', '棚番', '梱包メモ'], status: '有効' },
  ],
  templateMappings: [
    { id: 'm-1', templateId: 't-1', target: '注文番号', source: 'お客様管理番号' },
    { id: 'm-2', templateId: 't-1', target: '顧客名', source: '送り先氏名' },
    { id: 'm-3', templateId: 't-1', target: '郵便番号', source: '郵便番号' },
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

const requiredTemplateFields = ['注文番号', '顧客名', '郵便番号', '住所', '商品コード', '数量', '配送会社'];

function seedDashboardData() {
  Object.entries(keys).forEach(([name, key]) => {
    if (!localStorage.getItem(key)) {
      storage.write(key, mockData[name]);
    }
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

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((cell) => cell.trim()));
  const headers = rows.shift() || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function parseCsvHeaders(text) {
  const firstLine = text.trim().split(/\r?\n/).filter(Boolean)[0] || '';
  return firstLine.split(',').map((cell) => cell.trim()).filter(Boolean);
}

function readFileAsText(file, callback) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(String(reader.result || '')));
  reader.readAsText(file);
}

function formatYen(value) {
  return `¥${Number(value || 0).toLocaleString()}`;
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

function getBundleCandidates() {
  const orders = getData('orders');
  const groups = orders.reduce((acc, order) => {
    const key = order.postal || '郵便番号未設定';
    acc[key] = acc[key] || [];
    acc[key].push(order);
    return acc;
  }, {});
  const candidates = Object.entries(groups)
    .filter(([, groupedOrders]) => groupedOrders.length > 1)
    .map(([postal, groupedOrders]) => ({ postal, orders: groupedOrders, saving: (groupedOrders.length - 1) * 320 }));

  if (!candidates.length && orders.length > 1) {
    candidates.push({ postal: orders[0].postal || '100-0001', orders: orders.slice(0, 2), saving: 280 });
  }

  return candidates;
}

function getFareComparisons() {
  const orders = getData('orders');
  const carriers = getData('carriers');
  const fallbackCarrier = { name: '未設定', baseFare: 0 };
  const cheapestCarrier = carriers.reduce((cheapest, carrier) => Number(carrier.baseFare || 0) < Number(cheapest.baseFare || 0) ? carrier : cheapest, carriers[0] || fallbackCarrier);

  return orders.map((order, index) => {
    const current = carriers.find((carrier) => carrier.name === order.carrier) || carriers[index % Math.max(carriers.length, 1)] || fallbackCarrier;
    const currentFare = Number(current.baseFare || 0) + (index * 40);
    const suggestedFare = Math.max(0, Number(cheapestCarrier.baseFare || 0) + (index * 20));
    return { order, currentCarrier: current.name, suggestedCarrier: cheapestCarrier.name, currentFare, suggestedFare, saving: Math.max(0, currentFare - suggestedFare) };
  });
}

function getEstimatedSavings() {
  const fareSaving = getFareComparisons().reduce((sum, item) => sum + item.saving, 0);
  const bundleSaving = getBundleCandidates().reduce((sum, item) => sum + item.saving, 0);
  return fareSaving + bundleSaving;
}

function renderDashboard() {
  const target = document.querySelector('#dashboard-view');
  if (!target) return;
  const orders = getData('orders');
  const fareTables = getData('fareTables');
  const bundleCandidates = getBundleCandidates();
  const pending = orders.filter((order) => order.status !== '運賃比較済み').length;
  const estimatedSavings = getEstimatedSavings();
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>今日の注文</p><strong>${orders.length}</strong></article>
      <article class="stat-card"><p>同梱候補</p><strong>${bundleCandidates.length}</strong></article>
      <article class="stat-card"><p>推定節約額</p><strong>${formatYen(estimatedSavings)}</strong></article>
      <article class="stat-card"><p>未処理候補</p><strong>${pending}</strong></article>
    </section>
    <section class="panel"><h2>今日の確認事項</h2><ul class="status-list"><li><span>注文プレビュー</span><b>${orders.length}件</b></li><li><span>運賃表</span><b>${fareTables.length}件</b></li><li><span>同梱候補</span><b>${bundleCandidates.length}件</b></li></ul></section>
    <section class="panel"><h2>クイック操作</h2><div class="action-grid"><a class="action-card" href="products.html"><b>商品を追加</b><span>SKU・サイズ・重量を登録</span></a><a class="action-card" href="orders.html"><b>注文を取り込む</b><span>CSV / ExcelのMock取込</span></a><a class="action-card" href="results.html"><b>結果を確認</b><span>運賃比較と同梱候補</span></a></div></section>
  `;
}

function renderProducts(filter = '') {
  const tbody = document.querySelector('#products-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const products = getData('products').filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(keyword));
  tbody.innerHTML = products.map((product) => `
    <tr><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.name)}</td><td><span class="badge">${escapeHtml(product.size)}</span></td><td>${escapeHtml(product.weight)}g</td><td>${escapeHtml(product.memo)}</td><td><div class="row-actions"><button class="small-button" data-edit-product="${product.id}">編集</button><button class="small-button danger" data-delete-product="${product.id}">削除</button></div></td></tr>
  `).join('') || '<tr><td colspan="6">商品がありません。</td></tr>';
}

function initProducts() {
  const form = document.querySelector('#product-form');
  if (!form) return;
  const search = document.querySelector('#product-search');
  renderProducts();
  search?.addEventListener('input', () => renderProducts(search.value));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const products = getData('products');
    if (data.id) {
      setData('products', products.map((product) => product.id === data.id ? data : product));
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
    if (!file) return showToast('CSVファイルを選択してください。');
    readFileAsText(file, (text) => {
      const imported = parseCsv(text).map((row) => ({ id: makeId('p'), sku: row.sku || row.SKU || 'SKU未設定', name: row.name || row['商品名'] || '商品名未設定', size: row.size || row['サイズ'] || '60サイズ', weight: row.weight || row['重量'] || '0', memo: row.memo || row['メモ'] || '' }));
      setData('products', [...imported, ...getData('products')]);
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
    <tr><td>${escapeHtml(carrier.name)}</td><td>${escapeHtml(carrier.service)}</td><td>${formatYen(carrier.baseFare)}</td><td>${escapeHtml(carrier.sizes)}</td><td>${escapeHtml(carrier.memo)}</td><td><div class="row-actions"><button class="small-button" data-edit-carrier="${carrier.id}">編集</button><button class="small-button danger" data-delete-carrier="${carrier.id}">削除</button></div></td></tr>
  `).join('') || '<tr><td colspan="6">配送会社がありません。</td></tr>';
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
      const rows = parseCsv(text);
      const fareTables = getData('fareTables');
      setData('fareTables', [{ id: makeId('f'), carrier: rows[0]?.carrier || rows[0]?.['配送会社'] || '未設定', fileName: file.name, importedAt: new Date().toLocaleString('ja-JP'), rows: rows.length }, ...fareTables]);
      showToast(`${rows.length}行の運賃表を取り込みました。`);
    });
  });
}

function renderOrders(filter = '') {
  const tbody = document.querySelector('#orders-table');
  if (!tbody) return;
  const keyword = filter.toLowerCase();
  const orders = getData('orders').filter((order) => `${order.orderNo} ${order.customer}`.toLowerCase().includes(keyword));
  tbody.innerHTML = orders.map((order) => `
    <tr><td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.postal)}</td><td>${escapeHtml(order.items)}</td><td>${formatYen(order.total)}</td><td>${escapeHtml(order.carrier)}</td><td><span class="badge ${order.status === '運賃比較済み' ? 'green' : 'orange'}">${escapeHtml(order.status)}</span></td></tr>
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
      const imported = parseCsv(text).map((row) => ({ id: makeId('o'), orderNo: row.orderNo || row['注文番号'] || makeId('ORD'), customer: row.customer || row['顧客名'] || '顧客未設定', postal: row.postal || row['郵便番号'] || '', items: row.items || row['商品'] || '', total: row.total || row['合計'] || '0', carrier: row.carrier || row['配送会社'] || '未設定', status: row.status || '取込済み' }));
      setData('orders', [...imported, ...getData('orders')]);
      renderOrders(search?.value || '');
      showToast(`${imported.length}件の注文CSVを取り込みました。`);
    });
  });
  document.querySelector('#order-excel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files[0];
    if (!file) return showToast('Excelファイルを選択してください。');
    const mockOrder = { id: makeId('o'), orderNo: `XLS-${Date.now()}`, customer: 'Excel取込サンプル', postal: '150-0001', items: file.name, total: '5600', carrier: 'ヤマト運輸', status: 'Excel取込済み' };
    setData('orders', [mockOrder, ...getData('orders')]);
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
  const options = (activeTemplate?.columns || []).map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`).join('');
  target.outerHTML = `
    <section class="upload-card full-width"><h2>顧客CSVテンプレートをアップロード</h2><form id="template-upload-form"><label class="file-drop"><span>顧客別の送り状CSVテンプレートを選択してください</span><input type="file" accept=".csv,text/csv" name="file" /></label><button class="button primary" type="submit">テンプレートを保存</button></form></section>
    <section class="form-card full-width"><h2>字段マッピング</h2><p class="help-text">ShipNavi標準項目に対して、顧客CSVテンプレートの列を割り当てます。</p>${activeTemplate ? `<form id="template-mapping-form" data-template-id="${activeTemplate.id}"><div class="mapping-list">${requiredTemplateFields.map((field) => { const saved = mappings.find((mapping) => mapping.templateId === activeTemplate.id && mapping.target === field); return `<label class="mapping-row"><span>${escapeHtml(field)}</span><select name="${escapeHtml(field)}"><option value="">未設定</option>${(activeTemplate.columns || []).map((column) => `<option value="${escapeHtml(column)}" ${saved?.source === column ? 'selected' : ''}>${escapeHtml(column)}</option>`).join('')}</select></label>`; }).join('')}</div><button class="button secondary" type="submit">マッピングを保存</button></form>` : '<p>テンプレートをアップロードしてください。</p>'}</section>
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
    showToast('字段マッピングを保存しました。');
  });
}

function renderResults() {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const fareComparisons = getFareComparisons();
  const bundleCandidates = getBundleCandidates();
  const snapshots = getData('resultSnapshots');
  target.outerHTML = `
    <section class="stat-grid full-width"><article class="stat-card"><p>Mock運賃比較</p><strong>${fareComparisons.length}</strong></article><article class="stat-card"><p>Mock同梱候補</p><strong>${bundleCandidates.length}</strong></article><article class="stat-card"><p>推定節約額</p><strong>${formatYen(getEstimatedSavings())}</strong></article><article class="stat-card"><p>保存済み結果</p><strong>${snapshots.length}</strong></article></section>
    <section class="table-card full-width"><div class="table-toolbar"><h2>Mock 運賃比較結果</h2></div><div class="responsive-table"><table><thead><tr><th>注文番号</th><th>現在</th><th>推奨</th><th>現在運賃</th><th>推奨運賃</th><th>節約見込み</th></tr></thead><tbody>${fareComparisons.map((item) => `<tr><td>${escapeHtml(item.order.orderNo)}</td><td>${escapeHtml(item.currentCarrier)}</td><td>${escapeHtml(item.suggestedCarrier)}</td><td>${formatYen(item.currentFare)}</td><td>${formatYen(item.suggestedFare)}</td><td><span class="badge green">${formatYen(item.saving)}</span></td></tr>`).join('')}</tbody></table></div></section>
    <section class="table-card full-width"><div class="table-toolbar"><h2>Mock 同梱結果</h2></div><div class="responsive-table"><table><thead><tr><th>配送先</th><th>対象注文</th><th>件数</th><th>節約見込み</th><th>状態</th></tr></thead><tbody>${bundleCandidates.map((candidate) => `<tr><td>${escapeHtml(candidate.postal)}</td><td>${candidate.orders.map((order) => escapeHtml(order.orderNo)).join('<br>')}</td><td>${candidate.orders.length}件</td><td>${formatYen(candidate.saving)}</td><td><span class="badge orange">確認待ち</span></td></tr>`).join('') || '<tr><td colspan="5">同梱候補がありません。</td></tr>'}</tbody></table></div></section>
    <section class="panel full-width"><h2>出荷指示書生成</h2><p>Mock Dataからピッキング・梱包指示の生成結果を表示します。現在はPDFやDB連携を行わず、LocalStorageに結果スナップショットを保存します。</p><button class="button primary" type="button" id="mock-generate-result">Mock結果を保存</button></section>
  `;
  document.querySelector('#mock-generate-result')?.addEventListener('click', () => {
    const snapshot = { id: makeId('r'), savedAt: new Date().toLocaleString('ja-JP'), fareCount: fareComparisons.length, bundleCount: bundleCandidates.length, estimatedSavings: getEstimatedSavings() };
    setData('resultSnapshots', [snapshot, ...getData('resultSnapshots')]);
    showToast('Mock結果をLocalStorageに保存しました。');
    renderResults();
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
