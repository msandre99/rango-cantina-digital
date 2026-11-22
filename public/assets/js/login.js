
let theme = localStorage.getItem('rango-theme') || 'dark';
function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light-mode', t === 'light');
  const icon = document.getElementById('theme-icon');
  const lbl  = document.getElementById('theme-label');
  if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = t === 'dark' ? 'Claro' : 'Escuro';
  localStorage.setItem('rango-theme', t);
}
function toggleTheme() { applyTheme(theme === 'dark' ? 'light' : 'dark'); }
applyTheme(theme);


let currentRole = 'aluno';
const ROLE_LABELS   = { aluno: 'Sua matrícula SENAI', admin: 'Matrícula administrativa', totem: 'Matrícula do responsável' };
const ROLE_REDIRECTS= { aluno: 'rango-app-aluno.html', admin: 'rango-admin.html', totem: 'rango-totem.html' };

function setRole(r) {
  currentRole = r;
  ['aluno','admin','totem'].forEach(x => {
    document.getElementById('role-' + x)?.classList.toggle('active', x === r);
  });
  const plh = document.getElementById('login-matricula');
  if (plh) plh.placeholder = ROLE_LABELS[r] || 'Sua matrícula';
  const dica = document.getElementById('totem-dica');
  if (dica) dica.style.display = r === 'totem' ? 'block' : 'none';

  const regLink = document.querySelector('.register-link');
  if (regLink) regLink.style.display = r === 'aluno' ? '' : 'none';
}

function togglePass() {
  const i = document.getElementById('login-senha');
  if (i) i.type = i.type === 'password' ? 'text' : 'password';
}
function showError(msg) {
  const el  = document.getElementById('error-msg');
  const txt = document.getElementById('error-text');
  if (!el || !txt) return;
  txt.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}
function setLoading(on) {
  const btn = document.getElementById('login-btn');
  const txt = document.getElementById('btn-text');
  const arr = document.getElementById('btn-arrow');
  const sp  = document.getElementById('btn-spinner');
  if (!btn) return;
  btn.classList.toggle('loading', on);
  if (txt) txt.textContent = on ? 'VERIFICANDO...' : 'ENTRAR NO SISTEMA';
  if (arr) arr.style.display = on ? 'none' : '';
  if (sp)  sp.style.display  = on ? 'block' : 'none';
}

async function doLogin() {
  const m = document.getElementById('login-matricula')?.value.trim();
  const s = document.getElementById('login-senha')?.value;
  if (!m) { showError('Informe sua matrícula.'); return; }
  if (!s || s.length < 6) { showError('Senha muito curta (mín. 6 caracteres).'); return; }
  setLoading(true);
  try {
    const res = await API.auth.login(m, s, currentRole);
    if (!res.ok) { showError(res.erro || 'Credenciais inválidas.'); setLoading(false); return; }
    const u = res.dados?.usuario;
    if (u) sessionStorage.setItem('rango-user', JSON.stringify(u));
    if (res.dados?.token) API.auth.setToken(res.dados.token);
    window.location.href = ROLE_REDIRECTS[currentRole] || res.dados?.redirect || 'rango-app-aluno.html';
  } catch (e) { showError('Falha de comunicação. Tente novamente.'); setLoading(false); }
}

document.getElementById('login-senha')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });


function openRegister() {
  const m = document.getElementById('modal-cadastro');
  if (m) m.style.display = 'flex';

  ['reg-nome','reg-email','reg-matricula','reg-telefone','reg-senha','reg-senha2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('reg-error')?.style && (document.getElementById('reg-error').style.display = 'none');
  document.getElementById('reg-success')?.style && (document.getElementById('reg-success').style.display = 'none');
}
function closeRegister() {
  const m = document.getElementById('modal-cadastro');
  if (m) m.style.display = 'none';
}

document.getElementById('modal-cadastro')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modal-cadastro')) closeRegister();
});

function togglePassReg() {
  const i = document.getElementById('reg-senha');
  if (i) i.type = i.type === 'password' ? 'text' : 'password';
}

function showRegError(msg) {
  const el = document.getElementById('reg-error');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('reg-success').style.display = 'none';
}
function showRegSuccess(msg) {
  const el = document.getElementById('reg-success');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('reg-error').style.display = 'none';
}

function formatarCPF(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
  input.value = v;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g,'');
  if (cpf.length !== 11 || /^(\d){10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += parseInt(cpf[i]) * (t + 1 - i);
    const r = (10 * s) % 11;
    if (parseInt(cpf[t]) !== (r >= 10 ? 0 : r)) return false;
  }
  return true;
}

async function doRegister() {
  const nome      = document.getElementById('reg-nome')?.value.trim();
  const email     = document.getElementById('reg-email')?.value.trim();
  const matricula = document.getElementById('reg-matricula')?.value.trim();
  const telefone  = document.getElementById('reg-telefone')?.value.trim();
  const cpf       = document.getElementById('reg-cpf')?.value.trim();
  const senha     = document.getElementById('reg-senha')?.value;
  const senha2    = document.getElementById('reg-senha2')?.value;

  if (!nome)                            { showRegError('Informe seu nome completo.'); return; }
  if (!matricula || matricula.length !== 10) { showRegError('A matrícula deve ter exatamente 10 dígitos numéricos.'); return; }
  if (cpf && !validarCPF(cpf))          { showRegError('CPF inválido. Verifique os dígitos.'); return; }
  if (!senha || senha.length < 8)       { showRegError('A senha deve ter no mínimo 8 caracteres.'); return; }
  if (senha !== senha2)                 { showRegError('As senhas não coincidem.'); return; }
  if (!document.getElementById('reg-termos')?.checked) {
    showRegError('Você precisa aceitar os Termos de Uso para criar uma conta.');
    return;
  }

  const btn = document.getElementById('reg-btn');
  const txt = document.getElementById('reg-btn-text');
  if (btn) btn.disabled = true;
  if (txt) txt.textContent = 'CRIANDO CONTA...';

  try {
    const res = await API.auth.registrar({ nome, email, matricula, telefone, cpf: cpf.replace(/\D/g,''), senha });
    if (!res.ok) {
      showRegError(res.erro || 'Erro ao criar conta.');
    } else {
      showRegSuccess('Conta criada com sucesso! Agora faça login com sua matrícula e senha.');

      const mEl = document.getElementById('login-matricula');
      if (mEl) mEl.value = matricula;

      setTimeout(() => {
        closeRegister();
        document.getElementById('login-senha')?.focus();
      }, 2500);
    }
  } catch (e) {
    showRegError('Falha de comunicação. Tente novamente.');
  } finally {
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = 'CRIAR CONTA';
  }
}

(async () => {
  try {
    const res = await API.auth.checkSilent();
    if (res?.ok && res.dados?.usuario) {
      const u = res.dados.usuario;
      sessionStorage.setItem('rango-user', JSON.stringify(u));
      window.location.href = u.tipo === 'aluno' ? 'rango-app-aluno.html' : 'rango-admin.html';
    }
  } catch (_) {}
})();


let _resetMatricula = '';

function abrirResetSenha() {

  document.getElementById('reset-step-1').style.display = '';
  document.getElementById('reset-step-2').style.display = 'none';
  document.getElementById('reset-step-3').style.display = 'none';
  document.getElementById('reset-matricula').value = '';
  const e1 = document.getElementById('reset-erro-1');
  if (e1) e1.style.display = 'none';
  document.getElementById('modal-reset').style.display = 'flex';
}

function fecharResetSenha() {
  document.getElementById('modal-reset').style.display = 'none';
}

document.getElementById('modal-reset')?.addEventListener('click', function(e) {
  if (e.target === this) fecharResetSenha();
});

async function verificarMatricula() {
  const mat = document.getElementById('reset-matricula')?.value.trim();
  const err = document.getElementById('reset-erro-1');

  if (!mat || mat.length < 5) {
    err.textContent = 'Informe uma matrícula válida.';
    err.style.display = 'block';
    return;
  }

  const btn = event.currentTarget;
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  try {
    const res = await API.auth.resetCheck(mat);
    if (!res.ok) {
      err.textContent = res.erro || 'Matrícula não encontrada.';
      err.style.display = 'block';
    } else {
      err.style.display = 'none';
      _resetMatricula = mat;
      document.getElementById('reset-mat-display').textContent = mat;
      document.getElementById('reset-step-1').style.display = 'none';
      document.getElementById('reset-step-2').style.display = '';
      document.getElementById('reset-nova-senha').focus();
    }
  } catch(e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    err.style.display = 'block';
  } finally {
    btn.textContent = 'CONTINUAR →';
    btn.disabled = false;
  }
}

async function confirmarResetSenha() {
  const nova  = document.getElementById('reset-nova-senha')?.value;
  const conf  = document.getElementById('reset-conf-senha')?.value;
  const err   = document.getElementById('reset-erro-2');

  if (!nova || nova.length < 8) {
    err.textContent = 'A senha deve ter pelo menos 8 caracteres.';
    err.style.display = 'block';
    return;
  }
  if (nova !== conf) {
    err.textContent = 'As senhas não coincidem.';
    err.style.display = 'block';
    return;
  }

  const btn = event.currentTarget;
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  try {
    const res = await API.auth.resetSenha(_resetMatricula, nova);
    if (!res.ok) {
      err.textContent = res.erro || 'Erro ao alterar senha.';
      err.style.display = 'block';
    } else {
      document.getElementById('reset-step-2').style.display = 'none';
      document.getElementById('reset-step-3').style.display = '';

      const loginMat = document.getElementById('login-matricula');
      if (loginMat) loginMat.value = _resetMatricula;
    }
  } catch(e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    err.style.display = 'block';
  } finally {
    btn.textContent = 'SALVAR NOVA SENHA ✓';
    btn.disabled = false;
  }
}
