
let store = {
  categorias:   [],
  produtos:     [],
  pedidos:      [],
  transacoes:   [],
  dashboard:    {},
};
let currentPage        = 'dashboard';
let currentOrderFilter = 'todos';
let chartVendas        = null;
let chartFin           = null;

const _fmt = v => 'R$ ' + parseFloat(v).toFixed(2).replace('.', ',');


function navigate(page) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  const navMap = { dashboard:'Dashboard', estabelecimento:'Establishment', pedidos:'Pedidos',
                   kds:'KDS', estoque:'Estoque', financeiro:'Financeiro', ajustes:'Ajustes' };
  document.getElementById('page-' + page)?.classList.add('active');
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = navMap[page] || page;
  currentPage = page;


  if (page === 'kds')       renderKDS();
  if (page === 'estoque')   renderStock();
  if (page === 'financeiro') { initDatasFin(); carregarFinanceiro(); }
  if (page === 'pedidos')   { initDatasPed(); carregarPedidos(); }
  if (page === 'dashboard') { initDatasDash(); carregarDashboard(); }
  if (page === 'estabelecimento') carregarHorarios();
}

function switchTab(section, tab, btn) {
  const prefix = section + '-tab-';
  document.querySelectorAll('[id^="' + prefix + '"]').forEach(t => t.classList.remove('active'));
  document.getElementById(prefix + tab)?.classList.add('active');
  btn.closest('.tab-nav')?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}


function openModal(id) {
  if (id === 'modal-product' || id === 'modal-cat') populateCatSelects();
  if (id === 'modal-product') {
    const prev = document.getElementById('prod-img-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    const fileInput = document.getElementById('prod-img-file');
    if (fileInput) fileInput.value = '';
  }

  if (id === 'modal-despesa' || id === 'modal-retirar') {
    const today = new Date().toISOString().slice(0, 10);
    const dtEl = document.getElementById('expense-date');
    if (dtEl && !dtEl.value) dtEl.value = today;
    if (dtEl && dtEl.value && dtEl.value < '2026-01-01') dtEl.value = today;
  }
  if (id === 'modal-retirar') {
    const saldoEl = document.getElementById('modal-saldo-disponivel');
    if (saldoEl) {
  
      API.financeiro.dashboard().then(res => {
        if (res.ok) {
          const lucro = parseFloat(res.dados.lucro_mes) || 0;
          saldoEl.textContent = _fmt(lucro);
          saldoEl.style.color = lucro >= 0 ? 'var(--green)' : 'var(--red)';

          const amountEl = document.getElementById('withdrawal-amount');
          if (amountEl && !amountEl.value) amountEl.max = lucro.toFixed(2);
        }
      }).catch(() => { saldoEl.textContent = 'Carregando...'; });
    }
  }
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

function showToast(msg) {
  const area = document.getElementById('toast-area');
  if (!area) { showToastGlobal(msg); return; }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>✓</span> ${msg}`;
  area.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all .3s';
    setTimeout(() => t.remove(), 300); }, 3000);
}


async function carregarCategorias() {
  const res = await API.categorias.todos();
  if (res.ok) store.categorias = res.dados;
  renderCategories();
  populateCatSelects();
}

function populateCatSelects() {
  const selects = ['prod-cat','edit-prod-cat','product-cat-filter','stock-cat-sel'];
  selects.forEach(sid => {
    const s = document.getElementById(sid);
    if (!s) return;
    const base = sid === 'product-cat-filter' ? '<option value="">Todas Categorias</option>' :
                 sid === 'stock-cat-sel'       ? '<option value="">Selecione...</option>' : '';
    s.innerHTML = base + store.categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  });
}

function renderCategories() {
  const list = document.getElementById('cat-list');
  if (!list) return;
  if (!store.categorias.length) { list.innerHTML = '<div class="empty-state"><div class="emoji">📂</div>Nenhuma categoria.</div>'; return; }
  list.innerHTML = store.categorias.map(c => {
    const count = store.produtos.filter(p => parseInt(p.categoria_id) === parseInt(c.id)).length;
    return `<div class="cat-item" onclick="filterByCatId('${c.id}')">
      <div class="cat-dot"></div>
      <span class="cat-name">${renderCatIcone(c.icone, "18px")}${c.nome}</span>
      <span class="cat-count">${count} produto${count !== 1 ? 's' : ''}</span>
      <div class="cat-actions">
        <button class="cat-action-btn" onclick="event.stopPropagation();editCategory('${c.id}')">✏️</button>
        <button class="cat-action-btn" onclick="event.stopPropagation();deleteCategory('${c.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function previewCatIcon(input, previewId, hiddenId) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 200 * 1024) {
    showToast('Imagem muito grande. Use até 200KB.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const b64 = e.target.result;
    const prev = document.getElementById(previewId);
    if (prev) prev.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:contain;border-radius:10px">`;
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = b64;
  };
  reader.readAsDataURL(file);
}

function renderCatIcone(icone, size) {
  if (!icone) return '';
  size = size || '18px';
  if (icone.startsWith('data:') || icone.startsWith('http')) {
    return `<img src="${icone}" style="width:${size};height:${size};object-fit:contain;vertical-align:middle;border-radius:3px;margin-right:4px">`;
  }
  return icone + ' ';
}

async function saveCategory() {
  const nome  = document.getElementById('new-cat-name')?.value.trim();
  const icone = document.getElementById('new-cat-icone')?.value.trim() || '🍽️';
  if (!nome) { showToast('Digite um nome!'); return; }
  const res = await API.categorias.criar({ nome, icone });
  if (!res.ok) { showToast(res.erro || 'Erro ao criar.'); return; }

  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-icone').value = '🍽️';
  const prev = document.getElementById('new-cat-icon-preview');
  if (prev) prev.innerHTML = '🍽️';
  closeModal('modal-cat');
  await carregarCategorias();
  await carregarProdutos();
  showToast(`Categoria "${nome}" criada! ✅`);
}

async function editCategory(id) {
  const cat = store.categorias.find(c => c.id == id);
  if (!cat) return;
  document.getElementById('edit-cat-name').value = cat.nome;
  document.getElementById('edit-cat-id').value   = id;
  document.getElementById('edit-cat-icone').value = cat.icone || '🍽️';

  const prev = document.getElementById('edit-cat-icon-preview');
  if (prev) {
    if (cat.icone && (cat.icone.startsWith('data:') || cat.icone.startsWith('http'))) {
      prev.innerHTML = `<img src="${cat.icone}" style="width:100%;height:100%;object-fit:contain;border-radius:10px">`;
    } else {
      prev.innerHTML = cat.icone || '🍽️';
    }
  }
  openModal('modal-edit-cat');
}

async function updateCategory() {
  const id    = document.getElementById('edit-cat-id')?.value;
  const nome  = document.getElementById('edit-cat-name')?.value.trim();
  const icone = document.getElementById('edit-cat-icone')?.value.trim() || '🍽️';
  if (!nome) return;
  const res = await API.categorias.editar(id, { nome, icone });
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  closeModal('modal-edit-cat');
  await carregarCategorias();
  await carregarProdutos();
  showToast('Categoria atualizada! ✅');
}
async function deleteCategory(id) {
  if (!confirm('Excluir esta categoria?')) return;
  const res = await API.categorias.excluir(id);
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  await carregarCategorias();
  await carregarProdutos();
  showToast('Categoria removida.');
}
function filterByCatId(catId) {
  document.querySelectorAll('#cat-list .cat-item').forEach(el => el.classList.remove('active'));
  renderProducts(catId);
}

async function carregarProdutos() {
  const res = await API.produtos.todos();
  if (res.ok) store.produtos = res.dados;
  renderProducts();
  renderCategories();
}

function renderProducts(filterCat = '', filterText = '') {
  const list = document.getElementById('products-list');
  if (!list) return;
  let prods = store.produtos;
  if (filterCat)  prods = prods.filter(p => p.categoria_id == filterCat);
  if (filterText) prods = prods.filter(p => p.nome.toLowerCase().includes(filterText.toLowerCase()));
  if (!prods.length) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">📦</div>Nenhum produto encontrado.</div>';
    return;
  }
  list.innerHTML = prods.map(p => {
    const cat       = store.categorias.find(c => c.id == p.categoria_id);
    const stockClass= parseInt(p.estoque) <= parseInt(p.estoque_minimo) ?
                      (parseInt(p.estoque) <= 5 ? 'low' : 'warn') : '';
    const ativoTag  = !p.ativo ? '<span style="color:var(--red);font-size:.7rem;font-weight:700">INATIVO</span>' : '';
    return `<div class="product-row">
      <div class="product-img" style="${p.imagem ? 'background-image:url('+p.imagem+');background-size:cover' : ''}">
        ${p.imagem ? '' : (p.emoji || '🍽️')}
      </div>
      <div class="product-info">
        <div class="name">${p.nome} ${ativoTag}</div>
        <div class="id">ID: ${p.id}</div>
      </div>
      <div><span class="status" style="background:var(--orange-soft);color:var(--orange);text-transform:uppercase;font-size:.7rem">
        ${cat ? renderCatIcone(cat.icone, "16px") + cat.nome : '—'}
      </span></div>
      <div>
        <div class="product-price">${_fmt(p.preco)}</div>
        <div class="product-cost" style="color:var(--muted)">Custo: ${_fmt(p.custo)}</div>
      </div>
      <div class="stock-num ${stockClass}">${p.estoque}</div>
      <div style="display:flex;gap:6px">
        <button class="cat-action-btn" onclick="editProduct(${p.id})">✏️</button>
        ${!p.ativo
          ? `<button class="cat-action-btn" title="Reativar produto"
               style="background:rgba(88,214,141,.15);border-color:rgba(88,214,141,.3);color:#58d68d"
               onclick="reativarProduto(${p.id})">✅</button>`
          : `<button class="cat-action-btn" onclick="deleteProduct(${p.id})">🗑</button>`
        }
      </div>
    </div>`;
  }).join('');
}

function filterProductsAdmin(text) { renderProducts('', text); }
function filterByCat(catId) { renderProducts(catId); }

async function saveProduct() {
  const nome = document.getElementById('prod-name')?.value.trim();
  if (!nome) { showToast('Digite o nome do produto!'); return; }
  const dados = {
    nome,
    categoria_id:   document.getElementById('prod-cat')?.value || null,
    preco:          parseFloat(document.getElementById('prod-price')?.value) || 0,
    custo:          parseFloat(document.getElementById('prod-cost')?.value)  || 0,
    estoque:        parseInt(document.getElementById('prod-stock')?.value)   || 0,
    estoque_minimo: parseInt(document.getElementById('prod-min-stock')?.value)||10,
    imagem:         document.getElementById('prod-img')?.value               || '',
    descricao:      document.getElementById('prod-desc')?.value              || '',
    emoji:          document.getElementById('prod-emoji')?.value             || '🍽️',
  };
  const res = await API.produtos.criar(dados);
  if (!res.ok) { showToast(res.erro || 'Erro ao criar.'); return; }
  closeModal('modal-product');
  ['prod-name','prod-cost','prod-price','prod-desc','prod-img','prod-emoji'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['prod-stock','prod-min-stock'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '0';
  });
  await carregarProdutos();
  showToast(`Produto "${nome}" adicionado! ✅`);
}

async function editProduct(id) {
  const p = store.produtos.find(x => x.id == id);
  if (!p) return;
  const set = (el, v) => { const e = document.getElementById(el); if (e) e.value = v ?? ''; };
  set('edit-prod-id',    p.id);
  set('edit-prod-name',  p.nome);
  set('edit-prod-cost',  p.custo);
  set('edit-prod-price', p.preco);
  set('edit-prod-stock', p.estoque);
  set('edit-prod-min',   p.estoque_minimo);
  set('edit-prod-desc',  p.descricao);
  set('edit-prod-img',   p.imagem);
  set('edit-prod-emoji', p.emoji);

  const prev = document.getElementById('edit-prod-img-preview');
  if (prev && p.imagem) {
    prev.src = p.imagem;
    prev.style.display = 'block';
  } else if (prev) {
    prev.src = ''; prev.style.display = 'none';
  }

  const fi = document.getElementById('edit-prod-img-file');
  if (fi) fi.value = '';
  populateCatSelects();
  const sel = document.getElementById('edit-prod-cat');
  if (sel) sel.value = p.categoria_id || '';
  openModal('modal-edit-product');
}
async function updateProduct() {
  const id = document.getElementById('edit-prod-id')?.value;
  const dados = {
    nome:           document.getElementById('edit-prod-name')?.value,
    custo:          parseFloat(document.getElementById('edit-prod-cost')?.value)  || 0,
    preco:          parseFloat(document.getElementById('edit-prod-price')?.value) || 0,
    estoque:        parseInt(document.getElementById('edit-prod-stock')?.value)   || 0,
    estoque_minimo: parseInt(document.getElementById('edit-prod-min')?.value)     || 10,
    descricao:      document.getElementById('edit-prod-desc')?.value              || '',
    imagem:         document.getElementById('edit-prod-img')?.value               || '',
    emoji:          document.getElementById('edit-prod-emoji')?.value             || '🍽️',
    categoria_id:   document.getElementById('edit-prod-cat')?.value               || null,
  };
  const res = await API.produtos.editar(id, dados);
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  closeModal('modal-edit-product');
  await carregarProdutos();
  renderStock();
  showToast('Produto atualizado! ✅');
}
async function deleteProduct(id) {
  const p = store.produtos.find(x => x.id == id);
  if (!confirm(`Desativar "${p ? p.nome : 'este produto'}"? Ele ficará oculto mas pode ser reativado depois.`)) return;

  const res = await API.produtos.editar(id, { ativo: 0 });
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  await carregarProdutos();
  renderStock();
  showToast('Produto desativado. Use ✅ para reativar.');
}

async function reativarProduto(id) {
  const p = store.produtos.find(x => x.id == id);
  if (!confirm(`Reativar "${p ? p.nome : 'este produto'}"?`)) return;
  const res = await API.produtos.editar(id, { ativo: 1 });
  if (!res.ok) { showToast(res.erro || 'Erro ao reativar.'); return; }
  await carregarProdutos();
  renderStock();
  showToast(`${p ? p.nome : 'Produto'} reativado! ✅`);
}


function _hoje()     { return new Date().toISOString().slice(0,10); }
function _inicioMes(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10); }
function _mesAtual() { return new Date().toISOString().slice(0,7); }

function initDatasDash() {
  const f = document.getElementById('dash-date-from');
  const t = document.getElementById('dash-date-to');
  if (f && !f.value) f.value = _inicioMes();
  if (t && !t.value) t.value = _hoje();
}
function initDatasPed() {
  const f = document.getElementById('ped-date-from');
  const t = document.getElementById('ped-date-to');
  if (f && !f.value) f.value = _inicioMes();
  if (t && !t.value) t.value = _hoje();
}
function initDatasFin() {
  const m = document.getElementById('fin-mes');
  if (m && !m.value) m.value = _mesAtual();
}

async function carregarPedidos() {
  const de  = document.getElementById('ped-date-from')?.value || _inicioMes();
  const ate = document.getElementById('ped-date-to')?.value   || _hoje();
  const res = await API.pedidos.listar(de, ate);
  if (res.ok) store.pedidos = res.dados;
  renderOrders(currentOrderFilter);
  renderKDS();
  updatePendingBadge();
  renderDashPending();
  renderDashHistory();
}

function renderOrders(filter = 'todos', search = '') {
  const grid = document.getElementById('orders-grid');
  if (!grid) return;
  let orders = store.pedidos;
  if (filter !== 'todos') {

    const statusMap = {
      pendente:   ['pendente'],   pending:   ['pendente'],
      confirmado: ['confirmado','preparando','pronto'],
      confirmed:  ['confirmado','preparando','pronto'],
      concluido:  ['entregue'],   completed: ['entregue'],
      cancelado:  ['cancelado'],  cancelled: ['cancelado'],
    };
    const allowed = statusMap[filter];
    if (allowed) orders = orders.filter(o => allowed.includes(o.status));
  }
  if (search) orders = orders.filter(o =>
    o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    o.codigo?.includes(search) || o.id?.toString().includes(search)
  );
  if (!orders.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="emoji">📋</div>Nenhum pedido encontrado.</div>';
    return;
  }
  const statusLabel = { pendente:'PENDING',confirmado:'CONFIRMED',preparando:'PREPARING',pronto:'READY',entregue:'COMPLETED',cancelado:'CANCELLED' };
  const statusClass = { pendente:'status-pending',confirmado:'status-confirmed',preparando:'status-confirmed',pronto:'status-confirmed',entregue:'status-completed',cancelado:'status-cancelled' };

  grid.innerHTML = orders.map(o => {
    const actions = o.status === 'pendente' ?
      `<button class="btn btn-blue btn-sm" onclick="confirmOrder(${o.id})">✓ Confirmar</button>
       <button class="btn btn-ghost btn-sm" onclick="cancelOrder(${o.id})">✕</button>` :
      o.status === 'confirmado' || o.status === 'preparando' ?
      `<button class="btn btn-green btn-sm" onclick="completeOrder(${o.id})">🏠 Pronto</button>
       <button class="btn btn-ghost btn-sm" onclick="cancelOrder(${o.id})">✕</button>` :
      o.status === 'pronto' ?
      `<button class="btn btn-green btn-sm" onclick="deliverOrder(${o.id})">✅ Entregar</button>` :
      o.status === 'entregue' ? `<span style="color:var(--green);font-size:.8rem;font-weight:700">✓ Entregue</span>` :
      `<span style="color:var(--muted);font-size:.8rem">—</span>`;
    return `<div class="order-card">
      <div class="order-card-header">
        <span style="color:var(--orange);font-size:1.1rem">🏷</span>
        <div class="order-meta">
          <div class="order-num">#${String(o.id).padStart(4,'0')}</div>
          <div class="order-date">${o.created_at ? new Date(o.created_at).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}</div>
        </div>
        <span class="status ${statusClass[o.status] || 'status-pending'}">${statusLabel[o.status] || o.status}</span>
      </div>
      <div class="order-body">
        <div class="order-client">👤 <span>${o.cliente_nome || '—'}</span>
          ${o.origem === 'totem' ? '<span style="font-size:.7rem;background:rgba(255,122,0,.15);color:var(--orange);padding:2px 8px;border-radius:10px;margin-left:6px">TOTEM</span>' : ''}
          ${o.forma_pagamento ? `<span style="font-size:.7rem;background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px;margin-left:4px">${{'pix':'📱 PIX','cartao_credito':'💳 Cartão Crédito','cartao_debito':'💳 Cartão Débito','dinheiro':'💵 Dinheiro','tap':'📲 Tap to Pay'}[o.forma_pagamento] || o.forma_pagamento}</span>` : ''}
        </div>
        <div style="font-family:var(--font-label);font-size:.7rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Itens</div>
        <div class="order-items">
          ${(o.itens || []).map(it => `<div class="order-item-row"><span><span class="qty">${it.quantidade}x</span> ${it.produto_nome}</span><span>${_fmt(it.subtotal)}</span></div>`).join('')}
        </div>
        <div class="order-total"><span class="label">Total</span><span class="value">${_fmt(o.total)}</span></div>
      </div>
      <div class="order-card-footer">${actions}</div>
    </div>`;
  }).join('');
}

function filterOrders(filter, btn) {
  currentOrderFilter = filter;
  document.querySelectorAll('#orders-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders(filter);
}
function searchOrders(text) { renderOrders(currentOrderFilter, text); }

async function updateOrderStatus(id, status) {
  const res = await API.pedidos.atualizarStatus(id, status);
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  await carregarPedidos();
}
const confirmOrder   = id => { updateOrderStatus(id,'confirmado').then(()=>showToast(`Pedido #${id} confirmado! ✅`)); };
const markPreparando = id => { updateOrderStatus(id,'preparando').then(()=>showToast(`Pedido #${id} em preparação! 🍳`)); };
const completeOrder  = id => { updateOrderStatus(id,'pronto').then(()=>showToast(`Pedido #${id} pronto! 🎉`)); };
const deliverOrder   = id => { updateOrderStatus(id,'entregue').then(()=>showToast(`Pedido #${id} entregue! ✅`)); };
const cancelOrder    = id => { updateOrderStatus(id,'cancelado').then(()=>showToast(`Pedido #${id} cancelado.`)); };

function updatePendingBadge() {
  const n = store.pedidos.filter(o => o.status === 'pendente').length;
  const el = document.getElementById('pending-badge');
  if (el) el.textContent = n + ' pendente' + (n !== 1 ? 's' : '');
}


function renderKDS() {
  const grid = document.getElementById('kds-grid');
  if (!grid) return;
  const pending = store.pedidos.filter(o => ['pendente','confirmado','preparando'].includes(o.status));
  const count = document.getElementById('kds-count');
  if (count) count.textContent = `Pedidos ativos: ${pending.length}`;
  if (!pending.length) {
    grid.innerHTML = '<div style="color:rgba(255,255,255,.3);font-size:.9rem;padding:40px;text-align:center">Nenhum pedido ativo. ✓</div>';
    return;
  }
  grid.innerHTML = pending.map(o => {
    const mins = o.created_at ? Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) : 0;
    const cls  = mins >= 15 ? 'urgent' : mins >= 8 ? 'warning' : '';
    const tempo = mins < 60 ? `${mins}min` : `${Math.floor(mins/60)}h${mins%60}m`;
    return `<div class="kds-card ${cls}">
      <div class="kds-card-bar"></div>
      <div class="kds-card-header">
        <div><div class="kds-label">PEDIDO</div><div class="kds-order-num">#${String(o.id).padStart(4,'0')}</div></div>
        <div style="text-align:right">
          <div style="font-size:.65rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:20px;margin-bottom:4px;${
            o.status==='pendente'   ? 'background:rgba(255,122,0,.15);color:#ff7a00' :
            o.status==='confirmado' ? 'background:rgba(255,165,0,.15);color:#ffb347' :
            'background:rgba(88,214,141,.15);color:#58d68d'
          }">${o.status.toUpperCase()}</div>
          <div class="kds-time">⏱ ${tempo} atrás</div>
        </div>
      </div>
      <div class="kds-client"><div class="kds-label">CLIENTE</div>
        <div style="color:rgba(255,255,255,.85);font-weight:600">${o.cliente_nome || '—'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
        ${o.forma_pagamento ? `<span style="background:rgba(255,122,0,.12);border:1px solid rgba(255,122,0,.25);border-radius:20px;padding:3px 10px;font-size:.68rem;font-weight:700;font-family:var(--font-label);color:var(--orange);letter-spacing:.5px">${{'pix':'📱 PIX','cartao_credito':'💳 Cartão Crédito','cartao_debito':'💳 Cartão Débito','dinheiro':'💵 Dinheiro','tap':'📲 Tap to Pay'}[o.forma_pagamento] || o.forma_pagamento}</span>` : ''}
        ${o.origem === 'totem' ? '<span style="background:rgba(88,214,141,.1);border:1px solid rgba(88,214,141,.2);border-radius:20px;padding:3px 10px;font-size:.68rem;font-weight:700;color:#58d68d">TOTEM</span>' : ''}
      </div>
      <div class="kds-items">
        ${(o.itens || []).map(it => `<div class="kds-item"><span class="kds-qty">${it.quantidade}x</span><span class="kds-item-name">${it.produto_nome}</span></div>`).join('')}
      </div>
      <div class="kds-card-actions">
        ${o.status === 'pendente'
          ? `<button class="kds-confirm" onclick="confirmOrder(${o.id})">✓ CONFIRMAR</button>`
          : o.status === 'confirmado'
          ? `<button class="kds-confirm" style="background:rgba(255,165,0,.2);border-color:rgba(255,165,0,.4);color:#ffb347" onclick="markPreparando(${o.id})">🍳 PREPARANDO</button>`
          : `<button class="kds-confirm" style="background:rgba(88,214,141,.15);border-color:rgba(88,214,141,.3);color:#58d68d" onclick="completeOrder(${o.id})">✅ PRONTO</button>`
        }
        <button class="kds-cancel" onclick="cancelOrder(${o.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderStock() {
  renderStockAlerts();
  const tbody = document.getElementById('stock-table-body');
  if (!tbody) return;
  tbody.innerHTML = store.produtos.map(p => {
    const cat    = store.categorias.find(c => c.id == p.categoria_id);
    const status = parseInt(p.estoque) <= 5 ? '<span class="chip chip-low">Crítico</span>' :
                   parseInt(p.estoque) <= parseInt(p.estoque_minimo) ? '<span class="chip chip-warn">Baixo</span>' :
                   '<span class="chip chip-ok">Normal</span>';
    return `<tr>
      <td><div style="font-weight:600">${p.emoji || ''} ${p.nome}</div></td>
      <td>${cat ? cat.nome : '—'}</td>
      <td><span style="font-family:var(--font-title);font-size:1.2rem;color:${parseInt(p.estoque)<=5?'var(--red)':parseInt(p.estoque)<=parseInt(p.estoque_minimo)?'#f59e0b':'var(--green)'}">${p.estoque}</span></td>
      <td style="color:var(--muted)">${p.estoque_minimo}</td>
      <td>${status}</td>
      <td style="color:var(--muted);font-size:.8rem">${p.updated_at ? new Date(p.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td><button class="btn btn-sm btn-outline" onclick="quickAddStock(${p.id})">+ Repor</button></td>
    </tr>`;
  }).join('');
  populateCatSelects();
}
function renderStockAlerts() {
  const wrap = document.getElementById('stock-alerts');
  if (!wrap) return;
  const critical = store.produtos.filter(p => parseInt(p.estoque) <= 5 && p.ativo);
  const low      = store.produtos.filter(p => parseInt(p.estoque) > 5 && parseInt(p.estoque) <= parseInt(p.estoque_minimo) && p.ativo);
  let html = '';
  if (!critical.length && !low.length) html = '<div class="alert alert-ok"><span class="alert-icon">✅</span><div class="alert-body"><div class="title">Tudo em ordem</div><div class="desc">Estoque em níveis normais.</div></div></div>';
  critical.forEach(p => { html += `<div class="alert alert-danger"><span class="alert-icon">🔴</span><div class="alert-body"><div class="title">${p.nome}</div><div class="desc">Estoque CRÍTICO: apenas ${p.estoque} unidades</div></div></div>`; });
  low.forEach(p => { html += `<div class="alert alert-warn"><span class="alert-icon">🟡</span><div class="alert-body"><div class="title">${p.nome}</div><div class="desc">Estoque baixo: ${p.estoque} unidades (mínimo: ${p.estoque_minimo})</div></div></div>`; });
  wrap.innerHTML = html;
}
function loadStockProducts() {
  const catId = document.getElementById('stock-cat-sel')?.value;
  const sel   = document.getElementById('stock-prod-sel');
  if (!sel) return;
  const prods = catId ? store.produtos.filter(p => p.categoria_id == catId) : store.produtos;
  sel.innerHTML = '<option value="">Selecione...</option>' + prods.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}
async function addStock() {
  const prodId = document.getElementById('stock-prod-sel')?.value;
  const qty    = parseInt(document.getElementById('stock-qty')?.value);
  if (!prodId || !qty || qty < 1) { showToast('Selecione produto e quantidade!'); return; }
  const res = await API.produtos.reporEstoque(prodId, { quantidade: qty, motivo: 'Reposição manual admin' });
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  const p = store.produtos.find(x => x.id == prodId);
  if (p) p.estoque = res.dados.estoque;
  renderStock();
  showToast(`+${qty} unidades adicionadas! ✅`);
}
async function quickAddStock(id) {
  const qty = parseInt(prompt('Quantas unidades adicionar?', '20')) || 0;
  if (qty <= 0) return;
  const res = await API.produtos.reporEstoque(id, { quantidade: qty, motivo: 'Reposição rápida' });
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  const p = store.produtos.find(x => x.id == id);
  if (p) p.estoque = res.dados.estoque;
  renderStock();
  showToast(`+${qty} unidades adicionadas! ✅`);
}
function searchStock(text) {
  document.querySelectorAll('#stock-table-body tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(text.toLowerCase()) ? '' : 'none';
  });
}


async function carregarDashboard() {
  const de  = document.getElementById('dash-date-from')?.value || _inicioMes();
  const ate = document.getElementById('dash-date-to')?.value   || _hoje();
  const [dash, rankRes, grafRes] = await Promise.all([
    API.financeiro.dashboard(null, de, ate),
    API.financeiro.ranking(de, ate),
    API.financeiro.grafico(7),
  ]);

  if (dash.ok) {
    store.dashboard = dash.dados;
    const d = dash.dados;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('dash-fat-hoje',  _fmt(d.faturamento_hoje)); set('dash-pedidos-hoje', d.pedidos_hoje); set('dash-pendentes', d.pendentes); set('dash-alunos', d.alunos);
    set('dash-fat-mes',   _fmt(d.faturamento_mes));
    set('dash-lucro',     _fmt(d.lucro_mes));

    renderDashStockAlerts();
    if (d.alertas_estoque > 0) showToast(`⚠️ ${d.alertas_estoque} produto(s) com estoque baixo!`);
  }

  if (rankRes.ok) renderDashRanking(rankRes.dados);
  if (grafRes.ok) renderChartVendas(grafRes.dados);

  renderDashPending();
  renderDashHistory();
}

function renderDashPending() {
  const list = document.getElementById('dash-pending-list');
  if (!list) return;
  const pending = store.pedidos.filter(o => o.status === 'pendente').slice(0, 4);
  if (!pending.length) { list.innerHTML = '<div class="empty-state">Nenhum pedido pendente 🎉</div>'; return; }
  list.innerHTML = pending.map(o => `
    <div class="pending-item">
      <span class="pending-num">#${String(o.id).padStart(4,'0')}</span>
      <div class="pending-info">
        <div class="pending-client">${o.cliente_nome}</div>
        <div class="pending-items-text">${(o.itens||[]).map(i=>i.produto_nome).join(', ')}</div>
      </div>
      <div class="pending-total">${_fmt(o.total)}</div>
      <div class="pending-actions">
        <button class="btn btn-sm btn-blue" onclick="confirmOrder(${o.id});renderDashPending()">✓</button>
      </div>
    </div>`).join('');
}

function renderDashStockAlerts() {
  const wrap = document.getElementById('dash-stock-alerts');
  if (!wrap) return;
  const critical = store.produtos.filter(p => parseInt(p.estoque) <= 5 && p.ativo);
  const low      = store.produtos.filter(p => parseInt(p.estoque) > 5 && parseInt(p.estoque) <= parseInt(p.estoque_minimo) && p.ativo);
  if (!critical.length && !low.length) {
    wrap.innerHTML = '<div class="alert alert-ok"><span class="alert-icon">🟢</span><div class="alert-body"><div class="title">Todos os produtos OK</div><div class="desc">Estoque dentro dos níveis mínimos</div></div></div>';
    return;
  }
  wrap.innerHTML =
    critical.map(p => `<div class="alert alert-danger"><span class="alert-icon">🔴</span><div class="alert-body"><div class="title">${p.nome}</div><div class="desc">Estoque crítico: ${p.estoque} un (mín. ${p.estoque_minimo})</div></div></div>`).join('') +
    low.map(p     => `<div class="alert alert-warn"><span class="alert-icon">🟡</span><div class="alert-body"><div class="title">${p.nome}</div><div class="desc">Estoque baixo: ${p.estoque} un (mín. ${p.estoque_minimo})</div></div></div>`).join('');
}

function renderDashRanking(data) {
  const list = document.getElementById('dash-ranking');
  if (!list) return;
  const medals = ['gold','silver','bronze','',''];
  list.innerHTML = (data || []).slice(0, 5).map((r, i) => `
    <div class="ranking-item">
      <span class="rank-pos ${medals[i] || ''}">${i + 1}</span>
      <div class="rank-info">
        <div class="rank-name">${r.nome}</div>
        <div class="rank-cat">${_fmt(r.receita)}</div>
      </div>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${r.pct}%"></div></div>
      <span class="rank-value">${r.vendas} vendas</span>
    </div>`).join('');
}

function renderDashHistory() {
  const tbody = document.getElementById('dash-history-body');
  if (!tbody) return;
  const completed = store.pedidos.filter(o => o.status === 'entregue').slice(0, 20);
  if (!completed.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Nenhum pedido entregue ainda.</td></tr>'; return; }
  tbody.innerHTML = completed.map(o => `
    <tr>
      <td style="font-family:var(--font-title);color:var(--orange)">#${String(o.id).padStart(4,'0')}</td>
      <td>${o.cliente_nome}</td>
      <td style="color:var(--muted);font-size:.82rem">${(o.itens||[]).map(i=>i.quantidade+'x '+i.produto_nome).join(', ')}</td>
      <td style="font-family:var(--font-title);color:var(--green)">${_fmt(o.total)}</td>
      <td style="color:var(--muted);font-size:.82rem">${o.created_at ? new Date(o.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
      <td><span class="status status-completed">ENTREGUE</span></td>
    </tr>`).join('');
}


async function carregarFinanceiro() {
  const mes = document.getElementById('fin-mes')?.value || _mesAtual();
  const [dashRes, txRes, grafRes] = await Promise.all([
    API.financeiro.dashboard(mes),
    API.financeiro.transacoes(mes),
    API.financeiro.grafico(14),
  ]);

  if (dashRes.ok) {
    const d = dashRes.dados;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const fat   = parseFloat(d.faturamento_mes) || 0;
    const cmv   = parseFloat(d.cmv_mes)         || 0;   
    const desp  = parseFloat(d.despesas_mes)    || 0;  
    const lucro = parseFloat(d.lucro_mes)       || 0;   

    set('fin-faturamento',  _fmt(fat));
    set('fin-despesas',     _fmt(desp));
    set('fin-lucro',        _fmt(lucro));
    set('fin-cmv',          _fmt(cmv));
    set('fin-pedidos-mes',  d.pedidos_mes);
    set('fin-saldo',        _fmt(lucro));   

    const margem = fat > 0 ? Math.round((lucro / fat) * 100) : 0;
    set('fin-margem-pct', margem + '%');
    const barEl = document.getElementById('fin-margem-bar');
    if (barEl) barEl.style.width = Math.min(Math.max(margem,0), 100) + '%';

    set('fin-faturamento-sub', d.pedidos_mes + ' pedidos no mês');
    set('fin-despesas-sub',    desp > 0 ? 'Lançadas no período' : 'Sem despesas lançadas');
    set('fin-lucro-sub',       `Margem ${margem}% · CMV ${_fmt(cmv)}`);
  }
  if (txRes.ok) {
    store.transacoes = txRes.dados;
    renderTransactions();
  }
  if (grafRes.ok) renderChartFinanceiro(grafRes.dados);
}

function renderTransactions() {
  const list = document.getElementById('transactions-list');
  if (!list) return;
  if (!store.transacoes.length) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">💰</div>Nenhuma transação.</div>'; return;
  }
  list.innerHTML = store.transacoes.map(t => {
    const sai = t.tipo === 'saida';
    const dt  = t.data ? new Date(t.data+'T00:00:00').toLocaleDateString('pt-BR') : '—';
    return `
    <div class="transaction-item" style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;background:${sai?'rgba(239,68,68,.1)':'rgba(34,197,94,.1)'}">${t.icone||(sai?'💸':'💚')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.titulo}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${t.categoria} · ${dt}</div>
      </div>
      <div style="font-family:var(--font-title);font-size:.95rem;color:${sai?'var(--red)':'var(--green)'};flex-shrink:0;min-width:80px;text-align:right">${sai?'−':'+'}${_fmt(t.valor)}</div>
      ${sai?`
      <button onclick="editarDespesa(${t.id})" title="Editar"
        style="background:none;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 7px;cursor:pointer;color:var(--muted);font-size:.75rem;flex-shrink:0"
        onmouseenter="this.style.borderColor='rgba(255,122,0,.4)';this.style.color='var(--orange)'"
        onmouseleave="this.style.borderColor='rgba(255,255,255,.1)';this.style.color='var(--muted)'">✏️</button>
      <button onclick="deletarDespesa(${t.id})" title="Excluir"
        style="background:none;border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:5px 7px;cursor:pointer;color:var(--muted);font-size:.75rem;flex-shrink:0"
        onmouseenter="this.style.background='rgba(239,68,68,.12)';this.style.color='var(--red)'"
        onmouseleave="this.style.background='none';this.style.color='var(--muted)'">🗑</button>`:''}
    </div>`;
  }).join('');
}

async function saveExpense() {
  const dados = {
    titulo:    document.getElementById('expense-desc')?.value.trim(),
    valor:     parseFloat(document.getElementById('expense-value')?.value) || 0,
    categoria: document.getElementById('expense-cat')?.value || 'Outros',
    data:      document.getElementById('expense-date')?.value || new Date().toISOString().slice(0,10),
  };
  if (!dados.titulo || dados.valor <= 0) { showToast('Preencha todos os campos!'); return; }
  const res = await API.financeiro.despesa(dados);
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  closeModal('modal-despesa');
  ['expense-desc','expense-value'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  await Promise.all([carregarFinanceiro(), carregarDashboard()]);
  showToast('Despesa registrada! ✅');
}
async function processWithdrawal() {
  const val = parseFloat(document.getElementById('withdrawal-amount')?.value);
  const obs = document.getElementById('withdrawal-note')?.value || 'Retirada Admin';
  if (!val || val <= 0) { showToast('Digite um valor válido!'); return; }
  const res = await API.financeiro.retirada({ valor: val, observacao: obs });
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  closeModal('modal-retirar');
  await Promise.all([carregarFinanceiro(), carregarDashboard()]);
  showToast(`Retirada de ${_fmt(val)} realizada! ✅`);
}
async function deletarDespesa(id) {
  if (!confirm('Excluir esta despesa?')) return;
  const res = await API.financeiro.deletar(id);
  if (!res.ok) { showToast(res.erro || 'Erro ao excluir.'); return; }
  await Promise.all([carregarFinanceiro(), carregarDashboard()]);
  showToast('Transação removida. ✅');
}


let _editDespId = null;
function editarDespesa(id) {
  const t = store.transacoes.find(x => x.id == id);
  if (!t) return;
  _editDespId = id;
  const set = (sel, v) => { const e = document.querySelector(sel); if (e) e.value = v ?? ''; };
  set('#edit-desp-titulo', t.titulo);
  set('#edit-desp-valor',  t.valor);
  set('#edit-desp-cat',    t.categoria);
  set('#edit-desp-data',   t.data);
  openModal('modal-edit-despesa');
}
async function salvarEdicaoDespesa() {
  if (!_editDespId) return;
  const dados = {
    id:        _editDespId,
    titulo:    document.getElementById('edit-desp-titulo')?.value.trim(),
    valor:     parseFloat(document.getElementById('edit-desp-valor')?.value) || 0,
    categoria: document.getElementById('edit-desp-cat')?.value || 'Outros',
    data:      document.getElementById('edit-desp-data')?.value || new Date().toISOString().slice(0,10),
  };
  if (!dados.titulo || dados.valor <= 0) { showToast('Preencha título e valor!'); return; }
  const res = await API.financeiro.editar(dados);
  if (!res.ok) { showToast(res.erro || 'Erro.'); return; }
  closeModal('modal-edit-despesa');
  _editDespId = null;
  await Promise.all([carregarFinanceiro(), carregarDashboard()]);
  showToast('Lançamento atualizado! ✅');
}

async function exportExcel(section) {
  showToast('Gerando arquivo... \u{1F4CA}');
  try {
    const tipo = section === 'pedidos' ? 'pedidos' : 'balanco';
    const tok = localStorage.getItem('rango-token') || '';
    const res = await fetch('api/financeiro.php?action=exportar&tipo=' + tipo, {
      headers: { 'Content-Type': 'application/json', 'X-Rango-Token': tok },
      credentials: 'include',
    }).then(function(r){ return r.json(); });
    if (!res.ok) { showToast('Erro ao exportar.'); return; }

    var rows = [];
    if (tipo === 'balanco') {
      rows.push(['Tipo','Titulo','Categoria','Valor','Data','Obs']);
      (res.dados.vendas || []).forEach(function(r){ rows.push(['Entrada',r.titulo,r.categoria,r.valor,r.data,r.observacao||'']); });
      (res.dados.transacoes || []).forEach(function(r){ rows.push([r.tipo==='saida'?'Saida':'Entrada',r.titulo,r.categoria,r.valor,r.data,r.observacao||'']); });
    } else {
      rows.push(['Codigo','Cliente','Itens','Total','Status','Pagamento','Origem','Data']);
      (res.dados.pedidos || []).forEach(function(r){ rows.push([r.codigo,r.cliente_nome,r.itens,r.total,r.status,r.forma_pagamento,r.origem,r.created_at]); });
    }

    function escapeCSV(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
    var csv = rows.map(function(r){ return r.map(escapeCSV).join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = 'rango-' + tipo + '-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo gerado! OK');
  } catch(e) { showToast('Erro: ' + e.message); }
}

function renderChartVendas(dados) {
  const ctx = document.getElementById('chart-vendas');
  if (!ctx) return;
  if (chartVendas) { chartVendas.destroy(); chartVendas = null; }
  chartVendas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dados.labels,
      datasets: [{
        label: 'Faturamento',
        data: dados.faturamento,
        backgroundColor: 'rgba(255,107,26,.75)',
        borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{
        x:{ grid:{display:false}, ticks:{color:'#7a7668',font:{family:'Syne',size:11}} },
        y:{ grid:{color:'rgba(0,0,0,.05)'}, ticks:{color:'#7a7668',font:{family:'Syne',size:11},callback:v=>'R$'+v} },
      }
    }
  });
}
function renderChartFinanceiro(dados) {
  const ctx = document.getElementById('chart-financeiro');
  if (!ctx) return;
  if (chartFin) { chartFin.destroy(); chartFin = null; }
  chartFin = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dados.labels,
      datasets: [{
        label:'Faturamento', data: dados.faturamento,
        borderColor:'rgba(255,107,26,.8)', backgroundColor:'rgba(255,107,26,.08)',
        fill:true, tension:0.4, borderWidth:2, pointRadius:0,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:'#7a7668',font:{family:'Syne',size:11}}} },
      scales:{
        x:{grid:{display:false},ticks:{color:'#7a7668',font:{family:'Syne',size:11}}},
        y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#7a7668',font:{family:'Syne',size:11},callback:v=>'R$'+v}},
      }
    }
  });
}


function toggleChanged(el, name) { showToast(`${name}: ${el.checked ? 'ativado' : 'desativado'} ✅`); }
async function saveEstab() {
  const turnos = [
    { turno:'manha',  abertura: document.getElementById('h-manha-ab')?.value,  fechamento: document.getElementById('h-manha-fe')?.value,  ativo: document.getElementById('h-manha-on')?.checked?1:0 },
    { turno:'tarde',  abertura: document.getElementById('h-tarde-ab')?.value,  fechamento: document.getElementById('h-tarde-fe')?.value,  ativo: document.getElementById('h-tarde-on')?.checked?1:0 },
    { turno:'noite',  abertura: document.getElementById('h-noite-ab')?.value,  fechamento: document.getElementById('h-noite-fe')?.value,  ativo: document.getElementById('h-noite-on')?.checked?1:0 },
  ].filter(t => t.abertura && t.fechamento);
  if (turnos.length) {
    const res = await API.horarios.salvar(turnos);
    if (!res.ok) { showToast('Erro ao salvar horários: ' + (res.erro||'desconhecido')); return; }
  }
  showToast('Horários salvos com sucesso! ✅');
}
async function carregarHorarios() {
  const res = await API.horarios.listar();
  if (!res.ok) return;
  const map = {};
  res.dados.forEach(t => { map[t.turno] = t; });
  ['manha','tarde','noite'].forEach(t => {
    if (!map[t]) return;
    const ab = document.getElementById(`h-${t}-ab`);
    const fe = document.getElementById(`h-${t}-fe`);
    const on = document.getElementById(`h-${t}-on`);
    if (ab) ab.value = map[t].abertura?.slice(0,5) || '';
    if (fe) fe.value = map[t].fechamento?.slice(0,5) || '';
    if (on) on.checked = !!parseInt(map[t].ativo);
  });
}

async function alterarSenhaAdmin() {
  const atual = document.getElementById('admin-senha-atual')?.value;
  const nova  = document.getElementById('admin-senha-nova')?.value;
  const conf  = document.getElementById('admin-senha-conf')?.value;
  if (!atual || !nova) { showToast('Preencha todos os campos!'); return; }
  if (nova.length < 8) { showToast('Nova senha deve ter mín. 8 caracteres!'); return; }
  if (nova !== conf)   { showToast('As senhas não coincidem!'); return; }
  const res = await API.usuario.perfil({ senha_atual: atual, senha_nova: nova });
  if (!res.ok) { showToast(res.erro || 'Erro ao alterar senha.'); return; }
  ['admin-senha-atual','admin-senha-nova','admin-senha-conf'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showToast('Senha alterada com sucesso! ✅');
}
function triggerUpload(id) { document.getElementById(id)?.click(); }


function previewProdImg(input, urlFieldId, previewId) {
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(previewId);
    if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
  };
  reader.readAsDataURL(file);

  uploadProdImg(file, urlFieldId, previewId);
}

async function uploadProdImg(file, urlFieldId, previewId) {
  showToast('Enviando imagem…');
  const res = await API.uploadImagem(file);
  if (!res.ok) {
    showToast(res.erro || 'Erro no upload.', 'error');
    return;
  }

  const urlField = document.getElementById(urlFieldId);
  if (urlField) urlField.value = res.dados.url;

  const preview = document.getElementById(previewId);
  if (preview) { preview.src = res.dados.url; preview.style.display = 'block'; }
  showToast('Imagem enviada e salva! ✅');
}

function previewLogo(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const drop = document.getElementById('logo-drop');
    if (drop) drop.innerHTML = `<img class="photo-preview" src="${e.target.result}" alt="Logo"><div class="hint">Clique para alterar</div>`;
    drop?.classList.add('has-img');
  };
  reader.readAsDataURL(input.files[0]);
  showToast('Logotipo atualizado! ✅');
}
function updateBrandColor(val) { document.documentElement.style.setProperty('--orange', val); }
function syncColorInput(el)    { try { document.documentElement.style.setProperty('--orange', el.value); } catch(e){} }
async function doLogout() { await API.auth.logout().catch(()=>{}); API.auth.clearAuth(); window.location.href='rango-login.html'; }

async function signOut() {
  closeModal('modal-sair');
  showToast('Encerrando sessão... 👋');
  await API.auth.logout().catch(() => {});
  sessionStorage.removeItem('rango-user');
  setTimeout(() => {
    document.body.style.transition = 'opacity .4s';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = 'rango-login.html'; }, 400);
  }, 900);
}

setInterval(() => {
  if (currentPage === 'kds') carregarPedidos();
}, 30000);


async function init() {

  try {
    const authRes = await API.auth.check();
    if (!authRes?.ok || !['admin','atendente'].includes(authRes.dados?.usuario?.tipo)) {
      window.location.replace('rango-login.html');
      return;
    }

    const u = authRes.dados.usuario;
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = u.nome;
    if (roleEl) roleEl.textContent = u.tipo === 'admin' ? 'Administrador' : 'Atendente';
    if (avatEl) avatEl.textContent = u.nome.split(' ').map(w=>w[0]).slice(0,2).join('');
  } catch(e) {
    window.location.replace('rango-login.html');
    return;
  }
  await Promise.all([carregarCategorias(), carregarProdutos()]);
  await carregarPedidos();
  carregarDashboard();
}
document.addEventListener('DOMContentLoaded', init);
