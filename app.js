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
