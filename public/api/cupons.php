<?php

require_once __DIR__.'/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function catalogo(): array {
    return [
        ['id'=>'c1','nome'=>'5% de Desconto',   'emoji'=>'🏷️','tipo'=>'percentual','valor'=>5,  'custo'=>50,  'desc'=>'5% OFF no próximo pedido'],
        ['id'=>'c2','nome'=>'10% de Desconto',  'emoji'=>'🎫','tipo'=>'percentual','valor'=>10, 'custo'=>90,  'desc'=>'10% OFF no próximo pedido'],
        ['id'=>'c3','nome'=>'15% de Desconto',  'emoji'=>'✂️','tipo'=>'percentual','valor'=>15, 'custo'=>130, 'desc'=>'15% OFF no próximo pedido'],
        ['id'=>'c4','nome'=>'R$ 2,00 OFF',      'emoji'=>'💰','tipo'=>'fixo',      'valor'=>2,  'custo'=>60,  'desc'=>'R$ 2,00 de desconto'],
        ['id'=>'c5','nome'=>'R$ 5,00 OFF',      'emoji'=>'💸','tipo'=>'fixo',      'valor'=>5,  'custo'=>120, 'desc'=>'R$ 5,00 de desconto'],
        ['id'=>'c6','nome'=>'Frete Grátis',     'emoji'=>'🚀','tipo'=>'percentual','valor'=>0,  'custo'=>80,  'desc'=>'Retirada prioritária'],
        ['id'=>'c7','nome'=>'R$ 10,00 OFF',     'emoji'=>'🏆','tipo'=>'fixo',      'valor'=>10, 'custo'=>200, 'desc'=>'R$ 10,00 de desconto — prêmio máximo'],
    ];
}

try {

    if ($method === 'GET') {
        $u = exigir_login('aluno');
        $stmt = db()->prepare(
            "SELECT * FROM cupons WHERE usuario_id=? AND usado=0 AND expires_at>NOW() ORDER BY created_at DESC"
        );
        $stmt->execute([$u['id']]);
        $meus = $stmt->fetchAll();
        foreach ($meus as &$c) $c['valor'] = (float)$c['valor'];
        ok(['cupons'=>$meus,'catalogo'=>catalogo()]);
    }

    if ($method === 'POST') {


        if (in_array($action,['usar','validar'],true)) {
            $u = exigir_login();
            $in = input_json();
            $codigo = strtoupper(trim($in['codigo']??''));
            $total  = (float)($in['total']??0);
            if (!$codigo) fail('Informe o código do cupom.');
            $stmt = db()->prepare(
                "SELECT * FROM cupons WHERE codigo=? AND usuario_id=? AND usado=0 AND expires_at>NOW() LIMIT 1"
            );
            $stmt->execute([$codigo,$u['id']]);
            $cupom = $stmt->fetch();
            if (!$cupom) fail('Cupom inválido, expirado ou já utilizado.');
            $desconto = $cupom['tipo']==='percentual'
                ? round($total * $cupom['valor']/100, 2)
                : min((float)$cupom['valor'], $total);
            $total_final = max(0, round($total - $desconto, 2));
            if ($action==='usar') {
                db()->prepare("UPDATE cupons SET usado=1 WHERE id=?")->execute([$cupom['id']]);
            }
            ok(['desconto'=>$desconto,'total_final'=>$total_final,'cupom'=>$cupom]);
        }

        $u  = exigir_login('aluno');
        $in = input_json();
        $catalogo_id = $in['catalogo_id']??'';
        $cat = array_values(array_filter(catalogo(), fn($c)=>$c['id']===$catalogo_id));
        if (!$cat) fail('Cupom não encontrado no catálogo.');
        $item = $cat[0];

        db()->beginTransaction();
        $saldo_stmt = db()->prepare("SELECT rango_points FROM usuarios WHERE id=? FOR UPDATE");
        $saldo_stmt->execute([$u['id']]);
        $saldo = (float)$saldo_stmt->fetchColumn();
        if ($saldo < $item['custo']) { db()->rollBack(); fail('Pontos insuficientes.'); }


        db()->prepare("UPDATE usuarios SET rango_points = rango_points - ? WHERE id=?")
            ->execute([$item['custo'],$u['id']]);

        db()->prepare("INSERT INTO pontos_historico(usuario_id,tipo,descricao,pontos) VALUES(?,'resgate',?,?)")
            ->execute([$u['id'],"Cupom: {$item['nome']}",$item['custo']]);

        $codigo = 'RNG'.strtoupper(substr(bin2hex(random_bytes(3)),0,6));
        $expira = date('Y-m-d H:i:s', strtotime('+30 days'));
        db()->prepare(
            "INSERT INTO cupons(codigo,usuario_id,tipo,valor,descricao,pontos_custo,expires_at)
             VALUES(?,?,?,?,?,?,?)"
        )->execute([$codigo,$u['id'],$item['tipo'],$item['valor'],$item['nome'],$item['custo'],$expira]);
        db()->commit();

        ok([
            'codigo'   => $codigo,
            'descricao'=> $item['nome'],
            'valor'    => $item['valor'],
            'tipo'     => $item['tipo'],
            'expira'   => $expira,
            'pontos_restantes' => round($saldo - $item['custo'],2),
        ],'Cupom gerado!');
    }
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    fail('Erro: '.$e->getMessage(),500);
}
