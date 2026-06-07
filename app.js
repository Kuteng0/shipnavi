const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navToggle.classList.toggle('is-open', !isOpen);
    navLinks.classList.toggle('is-open', !isOpen);
  });

  navLinks.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.classList.remove('is-open');
      navLinks.classList.remove('is-open');
    }
  });
}

const betaForm = document.querySelector('#beta-form');
const formNote = document.querySelector('#form-note');

if (betaForm) {
  const saved = localStorage.getItem('shipnaviBetaApplication');

  if (saved) {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([key, value]) => {
      const field = betaForm.elements[key];
      if (field) field.value = value;
    });
  }

  betaForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(betaForm);
    const data = Object.fromEntries(formData.entries());
    localStorage.setItem('shipnaviBetaApplication', JSON.stringify(data));

    const subject = encodeURIComponent('ShipNavi 無料ベータ版申込');
    const body = encodeURIComponent([
      'ShipNavi 無料ベータ版に申し込みます。',
      '',
      `会社名: ${data.company}`,
      `メールアドレス: ${data.email}`,
      `月間出荷件数: ${data.shipments}`,
      `利用中の配送会社: ${data.carriers}`,
      '困っていること:',
      data.pain,
    ].join('\n'));

    if (formNote) {
      formNote.textContent = '入力内容を端末内に保存しました。メール作成画面を開きます。';
      formNote.classList.add('success');
    }

    window.location.href = `mailto:contact@shipnavi.jp?subject=${subject}&body=${body}`;
  });
}

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
    { id: 't-1', name: 'ヤマト送り状CSV', columns: ['お客様管理番号', '送り先氏名', '郵便番号', '住所', '品名'], status: '有効' },
    { id: 't-2', name: '佐川送り状CSV', columns: ['出荷日', '荷受人名称', '荷受人郵便番号', '荷受人住所', '個数'], status: '確認中' },
    { id: 't-3', name: '自社出荷指示書', columns: ['注文番号', 'SKU', '数量', '棚番', '梱包メモ'], status: '有効' },
  ],
  settings: { company: '株式会社サンプルEC', email: 'shipping@example.jp', defaultCarrier: 'ヤマト運輸', cutoffTime: '15:00' },
};

const keys = {
  products: 'shipnaviDashboardProducts',
  carriers: 'shipnaviDashboardCarriers',
  orders: 'shipnaviDashboardOrders',
  fareTables: 'shipnaviDashboardFareTables',
  templates: 'shipnaviDashboardTemplates',
  settings: 'shipnaviDashboardSettings',
};

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

function readFileAsText(file, callback) {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(String(reader.result || '')));
  reader.readAsText(file);
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

function renderDashboard() {
  const target = document.querySelector('#dashboard-view');
  if (!target) return;
  const products = getData('products');
  const carriers = getData('carriers');
  const orders = getData('orders');
  const fareTables = getData('fareTables');
  const pending = orders.filter((order) => order.status !== '運賃比較済み').length;
  target.outerHTML = `
    <section class="stat-grid full-width">
      <article class="stat-card"><p>登録商品</p><strong>${products.length}</strong></article>
      <article class="stat-card"><p>配送会社</p><strong>${carriers.length}</strong></article>
      <article class="stat-card"><p>取込注文</p><strong>${orders.length}</strong></article>
      <article class="stat-card"><p>未処理候補</p><strong>${pending}</strong></article>
    </section>
    <section class="panel"><h2>今日の確認事項</h2><ul class="status-list"><li><span>同梱候補</span><b>${orders.filter((order) => order.status === '同梱候補').length}件</b></li><li><span>運賃表</span><b>${fareTables.length}件</b></li><li><span>出荷指示書</span><b>生成待ち</b></li></ul></section>
    <section class="panel"><h2>クイック操作</h2><div class="action-grid"><a class="action-card" href="products.html"><b>商品を追加</b><span>SKU・サイズ・重量を登録</span></a><a class="action-card" href="orders.html"><b>注文を取り込む</b><span>CSV / ExcelのMock取込</span></a><a class="action-card" href="results.html"><b>結果を確認</b><span>最安運賃と指示書候補</span></a></div></section>
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
    <tr><td>${escapeHtml(carrier.name)}</td><td>${escapeHtml(carrier.service)}</td><td>¥${Number(carrier.baseFare || 0).toLocaleString()}</td><td>${escapeHtml(carrier.sizes)}</td><td>${escapeHtml(carrier.memo)}</td><td><div class="row-actions"><button class="small-button" data-edit-carrier="${carrier.id}">編集</button><button class="small-button danger" data-delete-carrier="${carrier.id}">削除</button></div></td></tr>
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
      setData('fareTables', [{ id: makeId('f'), carrier: rows[0]?.carrier || '未設定', fileName: file.name, importedAt: new Date().toLocaleString('ja-JP'), rows: rows.length }, ...fareTables]);
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
    <tr><td>${escapeHtml(order.orderNo)}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.postal)}</td><td>${escapeHtml(order.items)}</td><td>¥${Number(order.total || 0).toLocaleString()}</td><td>${escapeHtml(order.carrier)}</td><td><span class="badge ${order.status === '運賃比較済み' ? 'green' : 'orange'}">${escapeHtml(order.status)}</span></td></tr>
  `).join('') || '<tr><td colspan="7">注文がありません。</td></tr>';
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
  target.outerHTML = `<section class="template-grid full-width">${templates.map((template) => `<article class="panel"><span class="badge ${template.status === '有効' ? 'green' : 'orange'}">${template.status}</span><h2>${escapeHtml(template.name)}</h2><p>出力項目</p><ul>${template.columns.map((column) => `<li>${escapeHtml(column)}</li>`).join('')}</ul></article>`).join('')}</section>`;
}

function renderResults() {
  const target = document.querySelector('#results-view');
  if (!target) return;
  const orders = getData('orders');
  target.outerHTML = `<section class="result-grid full-width"><article class="panel"><h2>自動同梱判定</h2><ul class="status-list"><li><span>同一郵便番号候補</span><b>${Math.max(1, Math.floor(orders.length / 2))}件</b></li><li><span>確認待ち</span><b>${orders.filter((order) => order.status === '同梱候補').length}件</b></li></ul></article><article class="panel"><h2>推定最安運賃比較</h2><ul class="status-list"><li><span>平均削減見込み</span><b>¥142 / 件</b></li><li><span>比較済み</span><b>${orders.filter((order) => order.status === '運賃比較済み').length}件</b></li></ul></article><article class="panel full-width"><h2>出荷指示書生成</h2><p>Mock Dataからピッキング・梱包指示の生成結果を表示します。現在はPDFやDB連携を行わず、画面上のプロトタイプとして保存します。</p><button class="button primary" type="button" id="mock-generate-result">Mock出荷指示書を生成</button></article></section>`;
  document.querySelector('#mock-generate-result')?.addEventListener('click', () => showToast('Mock出荷指示書を生成しました。'));
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
