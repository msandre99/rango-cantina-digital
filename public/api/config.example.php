<?php

define('DB_HOST','localhost'); define('DB_NAME','seu_banco');
define('DB_USER','seu_user');      define('DB_PASS','sua_senha');
define('DB_CHARSET','utf8mb4');
define('ASAAS_AMBIENTE','sandbox');
define('ASAAS_API_KEY','COLE_SUA_CHAVE_ASAAS_AQUI');
define('ASAAS_BASE_URL', ASAAS_AMBIENTE==='producao'
    ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3');
define('ASAAS_WEBHOOK_TOKEN','rango_webhook_secret_change_me');
define('POINTS_PER_REAL',0.5);


if(session_status()===PHP_SESSION_NONE){
    ini_set('session.use_strict_mode','1');
    session_set_cookie_params(['lifetime'=>28800,'path'=>'/','secure'=>false,'httponly'=>true,'samesite'=>'Lax']);
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
$origin=$_SERVER['HTTP_ORIGIN']??'';
if($origin){ header('Access-Control-Allow-Origin: '.$origin); header('Access-Control-Allow-Credentials: true'); }
else        { header('Access-Control-Allow-Origin: *'); }
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Rango-Token, X-Requested-With');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){ http_response_code(204); exit; }

function db():PDO{
    static $p=null;
    if($p) return $p;
    try{ $p=new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=".DB_CHARSET,DB_USER,DB_PASS,
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    }catch(PDOException $e){ http_response_code(500); echo json_encode(['ok'=>false,'erro'=>'Falha no banco.','debug'=>$e->getMessage()]); exit; }
    return $p;
}

function input_json():array{ $r=file_get_contents('php://input'); if(!$r) return []; $d=json_decode($r,true); return is_array($d)?$d:[]; }
function send(array $d,int $c=200):void{ http_response_code($c); echo json_encode($d,JSON_UNESCAPED_UNICODE); exit; }
function ok($d=[],string $m=''):void  { send(['ok'=>true,'dados'=>$d,'mensagem'=>$m]); }
function fail(string $m,int $c=400):void{ send(['ok'=>false,'erro'=>$m],$c); }

function usuario_logado():?array{

    $token = $_SERVER['HTTP_X_RANGO_TOKEN']
           ?? (str_starts_with($_SERVER['HTTP_AUTHORIZATION']??'','Bearer ')
               ? substr($_SERVER['HTTP_AUTHORIZATION'],7) : null);
    if($token){
        $st=db()->prepare(
            "SELECT u.id,u.nome,u.email,u.matricula,u.cpf,u.telefone,u.tipo,
                    u.saldo,u.rango_points,u.pontos_ganhos,u.asaas_customer_id
             FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id
             WHERE s.id=? AND s.expires_at>NOW() AND u.ativo=1 LIMIT 1");
        $st->execute([$token]);
        $u=$st->fetch();
        if($u){ $_SESSION['usuario']=$u; return $u; }
    }

    return $_SESSION['usuario']??null;
}
function exigir_login(?string $tipo=null):array{
    $u=usuario_logado();
    if(!$u) fail('Sessão expirada. Faça login novamente.',401);
    if($tipo===null) return $u;
    if($tipo==='admin'&&in_array($u['tipo'],['admin','atendente'],true)) return $u;
    if($u['tipo']===$tipo||$u['tipo']==='admin') return $u;
    fail('Acesso negado.',403);
}
function gerar_codigo_pedido():string{ return strtoupper(substr(bin2hex(random_bytes(3)),0,5)); }
