
let PRODUCTS    = [];
let CATS        = [];
let CAT_ICONS   = {};
let cart        = [];
let activeCat   = 'todos';
let screen      = 'welcome';
let selectedPay = null;
let orderNum    = null;    
let orderDbId   = null;   
let showConfirmExit = false;
let pollingTimer= null;
let pixData     = null;    

const _fmt = n => 'R$ ' + parseFloat(n).toFixed(2).replace('.', ',');
const total= () => cart.reduce((s, i) => s + parseFloat(i.preco) * i.qty, 0);


async function carregarCardapio() {
  try {
    const [catRes, prodRes] = await Promise.all([
      API.categorias.listar(),
      API.produtos.listar(),
    ]);
    if (catRes.ok) {
      CATS = ['todos', ...catRes.dados.map(c => c.id.toString())];
      CAT_ICONS = { todos: '🍽️' };
      catRes.dados.forEach(c => { CAT_ICONS[c.id.toString()] = c.icone || '🍽️'; });
  
      window._catMap = {};
      catRes.dados.forEach(c => { window._catMap[c.id.toString()] = c; });
    }
    if (prodRes.ok) PRODUCTS = prodRes.dados;
  } catch (e) {
    console.error('Erro ao carregar cardápio:', e);
  }
  render();
}


function render() {
  const area = document.getElementById('main-area');
  if (!area) return;
  let html = '';
  if (screen === 'welcome')  html = renderWelcome();
  else if (screen === 'catalog')  html = renderCatalog();
  else if (screen === 'payment')  html = renderPayment();
  else if (screen === 'success')  html = renderSuccess();
  if (showConfirmExit) html += renderConfirm();
  area.innerHTML = html;
}


function renderWelcome() {
  return `<div class="welcome-screen" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <button class="btn-exit-welcome" onclick="sairParaLogin()">✕ &nbsp;Sair</button>
    <div class="welcome-eyebrow">Autoatendimento</div>
    <div class="welcome-logo">RANGO</div>
    <div class="welcome-tag">Peça rápido · Coma bem</div>
    <button class="btn-start" onclick="go('catalog')">Iniciar Pedido</button>

  </div>`;
}


function renderCatalog() {
  const catMap = window._catMap || {};
  const filtrados = activeCat === 'todos'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.categoria_id?.toString() === activeCat);

  const cats = CATS.map(c => {
    const label = c === 'todos' ? 'Todos' : (catMap[c]?.nome || c);
    return `<button class="cat-item${activeCat === c ? ' active' : ''}" onclick="setcat('${c}')">
      <span class="cat-item-icon">${CAT_ICONS[c] || '🍽️'}</span>${label}
    </button>`;
  }).join('');

  const prods = filtrados.map(p => {
    const inStock = parseInt(p.estoque) > 0 && p.ativo;
    return `<div class="product-card" ${inStock ? '' : 'style="opacity:.5;pointer-events:none"'}>
      ${!inStock ? '<div style="position:absolute;top:8px;right:8px;background:var(--red);color:#fff;font-size:.65rem;font-family:\'Syne\',sans-serif;font-weight:700;padding:3px 8px;border-radius:8px;letter-spacing:1px;text-transform:uppercase;z-index:2">Esgotado</div>' : ''}
      <div class="prod-img" style="${p.imagem ? 'padding:0;overflow:hidden' : ''}">
        ${p.imagem
          ? `<img src="${p.imagem}" alt="${p.name}"
               style="width:100%;height:100%;object-fit:cover;display:block"
               onerror="this.parentElement.innerHTML='${p.emoji}';">`
          : p.emoji}
      </div>
      <div class="prod-body">
        <div class="prod-name">${p.nome}</div>
        <div class="prod-price">${_fmt(p.preco)}</div>
        ${inStock ? `<button class="btn-add" onclick="addToCart(${p.id})">+ Adicionar</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const cartContent = cart.length === 0
    ? `<div class="cs-empty"><div class="cs-empty-icon">🛒</div><div class="cs-empty-label">Escolha seu rango</div></div>`
    : `<div class="cs-items">${cart.map(i => `
        <div class="cs-item">
          <div class="cs-emoji" style="${i.imagem ? 'padding:0;overflow:hidden;border-radius:10px' : ''}">
          ${i.imagem
            ? `<img src="${i.imagem}" alt="${i.nome||i.name||'item'}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;display:block"
                 onerror="this.parentElement.innerHTML='${i.emoji}';">`
            : (i.imagem===undefined ? i.emoji||'🍽️' : i.emoji||'🍽️')}
        </div>
          <div class="cs-info">
            <div class="cs-name">${i.nome}</div>
            <div class="cs-subtotal">${_fmt(parseFloat(i.preco) * i.qty)}</div>
            <div class="cs-qty-row">
              <button class="cs-qty-btn" onclick="changeQty(${i.id},-1)">−</button>
              <span class="cs-qty-val">${i.qty}</span>
              <button class="cs-qty-btn" onclick="changeQty(${i.id},1)">+</button>
            </div>
          </div>
          <button class="cs-remove" onclick="removeItem(${i.id})">✕</button>
        </div>`).join('')}
      </div>`;

  return `<div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
    <div class="catalog-header">
      <div class="header-logo">RANGO</div>
      <div class="header-divider"></div>
      <div class="pulse-dot"></div>
      <div class="header-greeting">Cardápio</div>
      <button class="btn-header-exit" onclick="askExit()">✕ &nbsp;Sair</button>
    </div>
    <div class="catalog-layout">
      <div class="cats-sidebar">${cats}</div>
      <div class="products-area"><div class="products-grid">${prods || '<div style="color:var(--muted);padding:32px;text-align:center">Nenhum produto disponível.</div>'}</div></div>
      <div class="cart-sidebar">
        <div class="cs-header">
          <div class="cs-eyebrow">Pedido atual</div>
          <div class="cs-title">MEU PEDIDO</div>
        </div>
        ${cartContent}
        <div class="cs-footer">
          <div class="cs-total-row">
            <span class="cs-total-label">Total</span>
            <span class="cs-total-val">${_fmt(total())}</span>
          </div>
          <button class="btn-checkout" onclick="go('payment')" ${cart.length === 0 ? 'disabled' : ''}>
            ${cart.length === 0 ? 'Adicione itens' : 'Finalizar Pedido →'}
          </button>
        </div>
      </div>
    </div>
  </div>`;
}


function renderPayment() {
  const ms = [
    { id:'pix',    icon:'📱', label:'PIX' },
    { id:'cartao', icon:'💳', label:'Cartão' },
    { id:'dinheiro',icon:'💵',label:'Dinheiro' },
    { id:'tap',    icon:'📲', label:'Tap to Pay' },
  ];
  const mh = ms.map(m => `
    <div class="pay-method${selectedPay === m.id ? ' selected' : ''}" onclick="selectedPay='${m.id}';render()">
      <div class="pm-icon">${m.icon}</div>
      <div class="pm-label">${m.label}</div>
    </div>`).join('');

  return `<div class="payment-screen"><div class="pay-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;position:relative;z-index:1">
      <button class="btn-back" onclick="go('catalog')">← Voltar</button>
      <button class="btn-header-exit" onclick="askExit()">✕ Sair</button>
    </div>
    <div class="pay-eyebrow">Finalização</div>
    <div class="pay-title">PAGAMENTO</div>
    <div class="pay-sub" style="position:relative;z-index:1">Escolha a forma de pagamento</div>
    <div class="pay-total">${_fmt(total())}</div>
    <div class="pay-methods">${mh}</div>

    ${pixData ? `
      <div style="margin:16px 0;text-align:center;position:relative;z-index:1">
        <img src="data:image/png;base64,${pixData.pix_qrcode}"
             style="width:200px;height:200px;border-radius:12px;border:1px solid rgba(255,255,255,.1)">
        <div style="font-size:.7rem;color:var(--muted);margin-top:8px">Escaneie ou copie o código</div>
        <button onclick="copiarPix()" style="margin-top:8px;background:rgba(255,122,0,.15);color:var(--orange);border:1px solid rgba(255,122,0,.3);border-radius:10px;padding:8px 20px;font-family:'Syne',sans-serif;font-size:.72rem;font-weight:700;letter-spacing:2px;cursor:pointer;text-transform:uppercase">
          📋 Copiar PIX
        </button>
        <div id="pix-status" style="margin-top:8px;font-size:.8rem;color:var(--muted)">Aguardando pagamento...</div>
      </div>`
    : orderDbId && selectedPay === 'pix' ? `
      <div style="margin:16px 0;text-align:center;position:relative;z-index:1">
        <div style="width:200px;height:200px;margin:0 auto;border-radius:12px;border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.04)">
          <div style="font-size:2rem;animation:spin 1.5s linear infinite">⏳</div>
          <div style="font-size:.72rem;color:var(--muted);font-family:'Syne',sans-serif;letter-spacing:1px">Gerando QR Code...</div>
        </div>
        <div id="pix-status" style="margin-top:10px;font-size:.8rem;color:var(--muted)">Aguarde, isso pode levar alguns segundos</div>
      </div>` : ''}

    <button class="btn-pay" onclick="confirmarPagamento()" ${!selectedPay ? 'disabled' : ''}>
      ${selectedPay === 'pix' && pixData ? 'Já paguei!' : selectedPay ? 'Confirmar Pagamento' : 'Selecione uma forma'}
    </button>
  </div></div>`;
}


function renderSuccess() {
  return `<div class="success-screen" style="flex:1">
    <div class="success-icon">✅</div>
    <div class="success-eyebrow">Confirmado</div>
    <div class="order-num">Número do Pedido</div>
    <div class="order-big">${orderNum || '—'}</div>
    <div class="success-msg">Pedido confirmado!</div>
    <div class="success-sub">Aguarde ser chamado no balcão 🎉</div>
    <button class="btn-new" onclick="newOrder()">Novo Pedido</button>
  </div>`;
}


function renderConfirm() {
  return `<div class="confirm-overlay" onclick="if(event.target===this){showConfirmExit=false;render()}">
    <div class="confirm-box">
      <div class="confirm-icon">🚪</div>
      <div class="confirm-title">SAIR?</div>
      <div class="confirm-sub">Seu carrinho será descartado.<br>Tem certeza?</div>
      <div class="confirm-btns">
        <button class="btn-cancel-confirm" onclick="showConfirmExit=false;render()">Cancelar</button>
        <button class="btn-confirm-exit" onclick="doExit()">Sair</button>
      </div>
    </div>
  </div>`;
}


async function go(s) {
  if (s === 'payment' && cart.length === 0) { showToast('Adicione itens primeiro'); return; }

  if (s === 'catalog') {
    try {
      const tok = localStorage.getItem('rango-totem-token');
      const h = {'Content-Type':'application/json'}; if (tok) h['X-Rango-Token'] = tok;
      const res = await fetch('api/horarios.php?check=1', {headers:h, credentials:'include'}).then(r=>r.json());
      if (res?.ok && res.dados?.aberto === false) {
        const prox = res.dados.proximo_turno;
        window._cantinaFechada = prox ? `Cantina fechada. Abre às ${prox.abre_em}.` : 'Cantina fechada no momento.';
        screen = 'welcome'; render(); return;
      }
    } catch(e) {}
  }
  window._cantinaFechada = null;
  screen = s; selectedPay = null; pixData = null;
  render();
}
function setcat(c) { activeCat = c; render(); }


function addToCart(id) {
  const p = PRODUCTS.find(x => x.id == id);
  if (!p) return;
  const ex = cart.find(x => x.id == id);
  if (ex) ex.qty++;
  else cart.push({ ...p, qty: 1 });
  showToast(`${p.emoji || ''} ${p.nome} adicionado`);
  render();
}
function changeQty(id, d) {
  const i = cart.findIndex(x => x.id == id);
  if (i < 0) return;
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  render();
}
function removeItem(id) { cart = cart.filter(x => x.id != id); render(); }


async function confirmarPagamento() {
  if (!selectedPay) return;


  if (selectedPay === 'pix' && !pixData) {
    showToast('Gerando QR Code PIX...');
    const forma_map = { pix:'pix', cartao:'cartao_credito', dinheiro:'dinheiro', tap:'cartao_debito' };
    const itens = cart.map(i => ({ produto_id: i.id, quantidade: i.qty }));
    try {
      const res = await API.pedidos.criar({
        itens,
        forma_pagamento: forma_map[selectedPay] || 'pix',
        origem: 'totem',
        cliente_nome: 'Autoatendimento',
      });
      if (!res.ok) { showToast(res.erro || 'Erro ao criar pedido.'); return; }
      const p = res.dados;
      orderNum  = p.codigo;
      orderDbId = p.id;
      if (p.pagamento?.pix_qrcode) {
        pixData = { pix_qrcode: p.pagamento.pix_qrcode, pix_copypaste: p.pagamento.pix_copypaste };
        render();
        iniciarPolling(p.id);
      } else {
  
        render(); 
        iniciarPollingQR(p.id);
        iniciarPolling(p.id);
      }
    } catch (e) { showToast('Erro de conexão.'); }
    return;
  }


  if (!orderDbId) {
    const forma_map = { pix:'pix', cartao:'cartao_credito', dinheiro:'dinheiro', tap:'cartao_debito' };
    const itens = cart.map(i => ({ produto_id: i.id, quantidade: i.qty }));
    try {
      const res = await API.pedidos.criar({
        itens,
        forma_pagamento: forma_map[selectedPay] || 'dinheiro',
        origem: 'totem',
        cliente_nome: 'Autoatendimento',
      });
      if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
      orderNum  = res.dados.codigo;
      orderDbId = res.dados.id;
    } catch (e) { showToast('Erro de conexão.'); return; }
  }
  screen = 'success';
  render();
}

function copiarPix() {
  if (!pixData?.pix_copypaste) return;
  navigator.clipboard.writeText(pixData.pix_copypaste)
    .then(() => showToast('PIX copiado! 📋'));
}

function iniciarPolling(dbId) {
  clearInterval(pollingTimer);
  let tries = 0;
  pollingTimer = setInterval(async () => {
    if (tries++ > 36) { clearInterval(pollingTimer); return; } // 6 min
    try {
      const res = await API.pedidos.verificarPagto(dbId);
      if (res?.ok && res.dados?.pago) {
        clearInterval(pollingTimer);
        const statusEl = document.getElementById('pix-status');
        if (statusEl) statusEl.textContent = '✅ Pagamento confirmado!';
        setTimeout(() => { screen = 'success'; render(); }, 1500);
      }
    } catch(e) {}
  }, 10000);
}

function iniciarPollingQR(dbId) {
  let tentativas = 0;
  const maxTentativas = 8; 
  const timer = setInterval(async () => {
    tentativas++;
    try {
      const res = await API.pedidos.qrcode(dbId);
      if (res?.ok && res.dados?.pix_qrcode) {
        clearInterval(timer);
        pixData = { pix_qrcode: res.dados.pix_qrcode, pix_copypaste: res.dados.pix_copypaste };
        render();
        return;
      }
  
      if (!res?.ok && res?.erro && !res.erro.includes('não disponível') && !res.erro.includes('Tente novamente')) {
        clearInterval(timer);
        const statusEl = document.getElementById('pix-status');
        if (statusEl) statusEl.textContent = '⚠️ ' + res.erro;
        return;
      }
    } catch(e) {}
    if (tentativas >= maxTentativas) {
      clearInterval(timer);
      const statusEl = document.getElementById('pix-status');
      if (statusEl) statusEl.textContent = '⚠️ QR Code não gerado. Tente outro método.';
    }
  }, 3000);
}

function newOrder()  { clearInterval(pollingTimer); cart=[]; screen='welcome'; selectedPay=null; pixData=null; orderNum=null; orderDbId=null; render(); }
function askExit()   { if(screen==='welcome'){doExit();return;} showConfirmExit=true; render(); }
function doExit()    { clearInterval(pollingTimer); cart=[]; screen='welcome'; selectedPay=null; pixData=null; orderNum=null; orderDbId=null; showConfirmExit=false; render(); }


function showToast(msg) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}


carregarCardapio();
