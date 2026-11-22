<?php
require_once __DIR__.'/config.php';
$action=$_GET['action']??'check';
try{
  switch($action){
    case 'login':{
      if($_SERVER['REQUEST_METHOD']!=='POST') fail('Método inválido.',405);
      $in=input_json(); $mat=trim($in['matricula']??''); $sen=$in['senha']??''; $tipo=$in['tipo']??'aluno';
      if(!$mat) fail('Informe sua matrícula.');
      if(strlen($sen)<6) fail('Senha muito curta.');
      $st=db()->prepare("SELECT id,nome,email,matricula,cpf,telefone,tipo,senha,saldo,rango_points,pontos_ganhos,asaas_customer_id,ativo FROM usuarios WHERE matricula=? LIMIT 1");
      $st->execute([$mat]); $u=$st->fetch();
      if(!$u||!$u['ativo']) fail('Matrícula ou senha incorretos.',401);
      if(!password_verify($sen,$u['senha'])) fail('Matrícula ou senha incorretos.',401);
      if($tipo==='admin'&&!in_array($u['tipo'],['admin','atendente'],true)) fail('Sem acesso administrativo.',403);
      if($tipo==='aluno'&&$u['tipo']!=='aluno') fail('Use o login administrativo.',403);
      if($tipo==='totem'&&!in_array($u['tipo'],['admin','atendente'],true)) fail('Sem acesso ao totem.',403);
      unset($u['senha'],$u['ativo']);
      $_SESSION['usuario']=$u;
      $token=bin2hex(random_bytes(32));
      $exp=date('Y-m-d H:i:s',time()+28800);
      db()->prepare("INSERT INTO sessoes(id,usuario_id,ip,user_agent,expires_at) VALUES(?,?,?,?,?)")
          ->execute([$token,$u['id'],$_SERVER['REMOTE_ADDR']??'',$_SERVER['HTTP_USER_AGENT']??'',$exp]);
      db()->prepare("DELETE FROM sessoes WHERE usuario_id=? AND expires_at<NOW()")->execute([$u['id']]);
      $redir=$u['tipo']==='aluno'?'rango-app-aluno.html':'rango-admin.html';
      ok(['token'=>$token,'usuario'=>$u,'redirect'=>$redir],'Login realizado.');
      break;
    }
    case 'reset_check':{
        $in = input_json();
        $mat = trim($in['matricula'] ?? '');
        if(!$mat) fail('Informe a matricula.');
        $st=db()->prepare('SELECT id,nome FROM usuarios WHERE matricula=? AND ativo=1 LIMIT 1');
        $st->execute([$mat]);
        $u2=$st->fetch();
        if(!$u2) fail('Matricula nao encontrada. Verifique e tente novamente.');
        ok(['nome'=>$u2['nome']],'Matricula encontrada.');
        break;
    }
    case 'reset_senha':{
        $in    = input_json();
        $mat   = trim($in['matricula'] ?? '');
        $senha = $in['senha'] ?? '';
        if(!$mat)              fail('Matricula invalida.');
        if(strlen($senha) < 8) fail('A senha deve ter pelo menos 8 caracteres.');
        $st=db()->prepare('SELECT id FROM usuarios WHERE matricula=? AND ativo=1 LIMIT 1');
        $st->execute([$mat]);
        $u2=$st->fetch();
        if(!$u2) fail('Matricula nao encontrada.');
        $hash=password_hash($senha,PASSWORD_BCRYPT);
        db()->prepare('UPDATE usuarios SET senha=? WHERE id=?')->execute([$hash,$u2['id']]);
        ok([],'Senha alterada com sucesso!');
        break;
    }
    case 'logout':{
      $u=usuario_logado();
      if($u){
        $tok=$_SERVER['HTTP_X_RANGO_TOKEN']??null;
        if($tok) db()->prepare("DELETE FROM sessoes WHERE id=?")->execute([$tok]);
        else     db()->prepare("DELETE FROM sessoes WHERE usuario_id=?")->execute([$u['id']]);
      }
      $_SESSION=[];
      session_destroy();
      ok([],'Logout realizado.');
      break;
    }
    case 'check':{
      $u=usuario_logado();
      if(!$u) fail('Não autenticado.',401);
      $st=db()->prepare("SELECT id,nome,email,matricula,tipo,saldo,rango_points,pontos_ganhos,asaas_customer_id FROM usuarios WHERE id=? LIMIT 1");
      $st->execute([$u['id']]); $atual=$st->fetch();
      if(!$atual){ session_destroy(); fail('Sessão inválida.',401); }
      $_SESSION['usuario']=$atual;
      ok(['usuario'=>$atual]);
      break;
    }
    case 'registrar':{
      if($_SERVER['REQUEST_METHOD']!=='POST') fail('Método inválido.',405);
      $in=input_json();

      $nome     = trim($in['nome']     ?? '');
      $email    = trim($in['email']    ?? '');
      $mat      = trim($in['matricula']?? '');
      $telefone = trim($in['telefone'] ?? '');
      $cpf      = preg_replace('/\D/', '', $in['cpf'] ?? '');
      $cpf      = preg_replace('/\D/', '', $in['cpf'] ?? '');
      $sen      = $in['senha']         ?? '';

      if(!$nome)             fail('Informe seu nome completo.');
      if(!$mat)              fail('Informe sua matrícula.');
      if(!ctype_digit($mat)) fail('A matrícula deve conter apenas números.');
      if(strlen($mat)!==10)  fail('A matrícula deve ter exatamente 10 dígitos.');
      if(strlen($sen)<8)     fail('A senha deve ter no mínimo 8 caracteres.');

      $c=db()->prepare("SELECT id FROM usuarios WHERE matricula=? LIMIT 1");
      $c->execute([$mat]);
      if($c->fetch()) fail('Matrícula já cadastrada. Faça login.',409);

      if($email){
        $ce=db()->prepare("SELECT id FROM usuarios WHERE email=? LIMIT 1");
        $ce->execute([$email]);
        if($ce->fetch()) fail('E-mail já cadastrado.',409);
      }

      $hash = password_hash($sen, PASSWORD_BCRYPT, ['cost'=>10]);
      if(!$hash) fail('Erro ao processar senha. Contate o suporte.');

      $ins=db()->prepare(
        "INSERT INTO usuarios (nome, email, matricula, telefone, cpf, senha, tipo)
         VALUES (?, ?, ?, ?, ?, ?, 'aluno')"
      );
      $ins->execute([
        $nome,
        $email    ?: null,
        $mat,
        $telefone ?: null,
        $cpf      ?: null,
        $hash,
      ]);

      ok([],'Conta criada com sucesso! Faça login.');
      break;
    }
    default: fail('Ação desconhecida.',404);
  }
}catch(Throwable $e){

  fail('Erro interno: '.$e->getMessage(),500);
}
