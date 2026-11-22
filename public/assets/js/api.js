
const API=(()=>{
  const BASE='api';
  const getToken=()=>localStorage.getItem('rango-token')||'';
  const setToken=t=>localStorage.setItem('rango-token',t);
  const clearAuth=()=>{ localStorage.removeItem('rango-token'); sessionStorage.removeItem('rango-user'); };

  async function req(method,endpoint,body=null,noRedirect=false){
    const headers={'Content-Type':'application/json'};
    const tok=getToken(); if(tok) headers['X-Rango-Token']=tok;
    const opts={method,headers,credentials:'include'};
    if(body) opts.body=JSON.stringify(body);
    let r,data;
    try{ r=await fetch(`${BASE}/${endpoint}`,opts); data=await r.json(); }
    catch(e){ return{ok:false,erro:'Falha de comunicação.'}; }
    if(!data.ok&&r.status===401&&!noRedirect){
      const naLogin=window.location.pathname.toLowerCase().includes('rango-login');
      if(!naLogin){ clearAuth(); window.location.href='rango-login.html'; }
    }
    return data;
  }
  const get=(ep)=>req('GET',ep);
  const post=(ep,b)=>req('POST',ep,b);
  const put=(ep,b)=>req('PUT',ep,b);
  const del=(ep)=>req('DELETE',ep);

  const auth={
    login:(m,s,t)=>req('POST','auth.php?action=login',{matricula:m,senha:s,tipo:t},true),
    logout:()=>post('auth.php?action=logout',{}),
    check:()=>get('auth.php?action=check'),
    checkSilent:()=>req('GET','auth.php?action=check',null,true),
    registrar:d=>req('POST','auth.php?action=registrar',d,true),
    resetCheck:(m)   =>req('POST','auth.php?action=reset_check',{matricula:m},true),
    resetSenha:(m,s) =>req('POST','auth.php?action=reset_senha',{matricula:m,senha:s},true),
    getToken,setToken,clearAuth,
  };
  const categorias={
    listar:()=>get('categorias.php'), todos:()=>get('categorias.php?todos=1'),
    criar:d=>post('categorias.php',d), editar:(id,d)=>req('PUT',`categorias.php?id=${id}`,d),
    excluir:id=>del(`categorias.php?id=${id}`),
  };
  const produtos={
    listar:()=>get('produtos.php'), todos:()=>get('produtos.php?todos=1'),
    porCategoria:c=>get(`produtos.php?categoria_id=${c}`), buscar:q=>get(`produtos.php?busca=${encodeURIComponent(q)}`),
    obter:id=>get(`produtos.php?id=${id}`), criar:d=>post('produtos.php',d),
    editar:(id,d)=>req('PUT',`produtos.php?id=${id}`,d), excluir:id=>del(`produtos.php?id=${id}`),
    reporEstoque:(id,d)=>post(`produtos.php?action=estoque&id=${id}`,d),
  };
  const pedidos={
    listar:(de,ate)=>{ let q='pedidos.php?lista=1'; if(de) q+=`&de=${de}`; if(ate) q+=`&ate=${ate}`; return get(q); }, meus:()=>get('pedidos.php?meus=1'),
    porStatus:s=>get(`pedidos.php?status=${s}`), obter:id=>get(`pedidos.php?id=${id}`),
    criar:d=>post('pedidos.php',d), atualizarStatus:(id,s)=>req('PUT',`pedidos.php?id=${id}`,{status:s}),
    verificarPagto:id=>get(`pedidos.php?action=verificar&id=${id}`),
    qrcode:id=>get(`pedidos.php?action=qrcode&id=${id}`),
  };
  const financeiro={
    dashboard:(mes,de,ate)=>{
      let q='financeiro.php?action=dashboard';
      if(mes) q+=`&mes=${mes}`; else if(de&&ate) q+=`&de=${de}&ate=${ate}`;
      return get(q);
    },
    transacoes:(mes,de,ate)=>{
      let q='financeiro.php?action=transacoes';
      if(mes) q+=`&mes=${mes}`; else if(de&&ate) q+=`&de=${de}&ate=${ate}`;
      return get(q);
    },
    grafico:(d=14)=>get(`financeiro.php?action=grafico&dias=${d}`), ranking:()=>get('financeiro.php?action=ranking'),
    despesa:d=>post('financeiro.php?action=despesa',d), retirada:d=>post('financeiro.php?action=retirada',d),
    deletar:id=>post('financeiro.php?action=deletar',{id}),
    editar: d =>post('financeiro.php?action=editar', d),
  };
  const usuario={
    pontos:()=>get('usuario.php?action=pontos'),
    foto_perfil:(f)=>post('usuario.php?action=foto_perfil',{foto:f}),
    get_foto:()=>req('GET','usuario.php?action=foto_perfil',null,true), historico:()=>get('usuario.php?action=historico'),
    resgatar:d=>post('usuario.php?action=resgatar',d), lista:()=>get('usuario.php?action=lista'),
    perfil:d=>req('POST','usuario.php?action=perfil',d),
  };
  async function uploadImagem(file){
    const form=new FormData(); form.append('file',file);
    const h={}; const tok=getToken(); if(tok) h['X-Rango-Token']=tok;
    const r=await fetch(`${BASE}/upload.php`,{method:'POST',credentials:'include',headers:h,body:form});
    return r.json().catch(()=>({ok:false,erro:'Resposta inválida.'}));
  }
  const horarios = {
    listar:  ()                  => get('horarios.php'),
    check:   ()                  => get('horarios.php?check=1'),
    salvar:  (turnos, dias_semana) => post('horarios.php', { turnos, dias_semana: dias_semana ?? null }),
  };
  const cupons = {
    meus:     ()           => get ('cupons.php'),
    gerar:    catalogo_id  => post('cupons.php',{catalogo_id}),
    validar:  (codigo,total)=> post('cupons.php?action=validar',{codigo,total}),
    usar:     (codigo,total)=> post('cupons.php?action=usar',   {codigo,total}),
  };
  const configuracoes = {
    get:   ()  => get ('configuracoes.php'),
    salvar: d  => post('configuracoes.php', d),
  };
  return{auth,categorias,produtos,pedidos,financeiro,usuario,uploadImagem,horarios,cupons,configuracoes};
})();

const fmt={
  brl:v=>'R$ '+parseFloat(v||0).toFixed(2).replace('.',','),
  data:s=>s?new Date(s).toLocaleDateString('pt-BR'):'—',
  datah:s=>s?new Date(s).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—',
};
function showToastGlobal(msg,tipo='success'){
  let el=document.getElementById('__tg');
  if(!el){el=document.createElement('div');el.id='__tg';el.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:rgba(14,15,17,.97);backdrop-filter:blur(16px);color:#f5f7fa;padding:12px 26px;border:1px solid rgba(255,255,255,.08);border-left:3px solid #ff7a00;border-radius:30px;font-family:Syne,sans-serif;font-size:.78rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.5);white-space:nowrap;transition:opacity .3s,transform .3s;';document.body.appendChild(el);}
  el.textContent=msg;el.style.borderLeftColor=tipo==='error'?'#ff4d4d':'#ff7a00';
  el.style.opacity='1';el.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(el._t);el._t=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(8px)';},3200);
}
