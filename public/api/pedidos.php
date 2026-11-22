<?php


require_once __DIR__ . '/config.php';
require_once __DIR__ . '/asaas.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$action = $_GET['action'] ?? '';

try {

    if ($action === 'qrcode' && $method === 'GET') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) fail('ID inválido.');
        $p = db()->prepare("SELECT asaas_payment_id, asaas_pix_qrcode, asaas_pix_copypaste, observacoes FROM pedidos WHERE id=? LIMIT 1");
        $p->execute([$id]);
        $ped = $p->fetch();
        if (!$ped) fail('Pedido não encontrado.');


        if ($ped['asaas_pix_qrcode']) {
            ok(['pix_qrcode' => $ped['asaas_pix_qrcode'], 'pix_copypaste' => $ped['asaas_pix_copypaste']]);
        }

        if (!$ped['asaas_payment_id']) {
            $obs = $ped['observacoes'] ?? '';
            preg_match('/Erro Asaas: (.+)/i', $obs, $m);
            $detalhe = $m[1] ?? 'Cobrança não criada. Verifique a chave de API no config.php.';
            fail('QR indisponível: ' . $detalhe);
        }

        try {
            $qr = Asaas::obterQrCodePix($ped['asaas_payment_id']);
            if (!empty($qr['encodedImage'])) {
                db()->prepare("UPDATE pedidos SET asaas_pix_qrcode=?, asaas_pix_copypaste=? WHERE id=?")
                    ->execute([$qr['encodedImage'], $qr['payload'] ?? null, $id]);
                ok(['pix_qrcode' => $qr['encodedImage'], 'pix_copypaste' => $qr['payload'] ?? null]);
            }
        } catch (Throwable $qrErr) {
            fail('Erro Asaas ao buscar QR: ' . $qrErr->getMessage());
        }
        fail('QR Code ainda não disponível. Tente novamente.');
    }

    if ($action === 'verificar' && $method === 'GET') {
        if (!$id) fail('ID obrigatório.');
        $stmt = db()->prepare("SELECT * FROM pedidos WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $p = $stmt->fetch();
        if (!$p) fail('Pedido não encontrado.', 404);

        if (!$p['asaas_payment_id']) {
            ok(['status' => $p['status'], 'asaas_status' => null, 'pago' => false]);
        }

        $resp = Asaas::consultarCobranca($p['asaas_payment_id']);
        $novo_status_asaas = $resp['status'] ?? null;
        $foi_pago = in_array($novo_status_asaas, ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'], true);

        $novo_status_pedido = $p['status'];
        if ($foi_pago && $p['status'] === 'pendente') {
            $novo_status_pedido = 'confirmado';
            db()->prepare("UPDATE pedidos SET status = 'confirmado', asaas_status = ?, pago_em = NOW() WHERE id = ?")
                ->execute([$novo_status_asaas, $id]);

            if ($p['usuario_id']) creditar_pontos((int)$p['usuario_id'], (float)$p['total'], $id);
        } else {
            db()->prepare("UPDATE pedidos SET asaas_status = ? WHERE id = ?")
                ->execute([$novo_status_asaas, $id]);
        }

        ok([
            'status'         => $novo_status_pedido,
            'asaas_status'   => $novo_status_asaas,
            'pago'           => $foi_pago,
        ]);
    }

    switch ($method) {


        case 'GET': {
            $u = usuario_logado();
            $meus   = !empty($_GET['meus']);
            $status = $_GET['status'] ?? '';

            if ($id) {
                $stmt = db()->prepare(
                    "SELECT p.*, u.nome AS usuario_nome, u.matricula
                     FROM pedidos p
                     LEFT JOIN usuarios u ON u.id = p.usuario_id
                     WHERE p.id = ? LIMIT 1"
                );
                $stmt->execute([$id]);
                $ped = $stmt->fetch();
                if (!$ped) fail('Pedido não encontrado.', 404);

                if ($u && $u['tipo']==='aluno' && $ped['usuario_id'] != $u['id']) {
                    fail('Acesso negado.', 403);
                }
                $itens = db()->prepare("SELECT * FROM pedido_itens WHERE pedido_id = ?");
                $itens->execute([$id]);
                $ped['itens'] = $itens->fetchAll();
                $ped['total'] = (float)$ped['total'];
                ok($ped);
            }

            $sql = "SELECT p.*, u.nome AS usuario_nome, u.matricula
                    FROM pedidos p
                    LEFT JOIN usuarios u ON u.id = p.usuario_id
                    WHERE 1=1";
            $args = [];

            if ($u && $u['tipo']==='aluno') {
                $sql .= " AND p.usuario_id = ?";
                $args[] = $u['id'];
            } elseif ($meus && $u) {
                $sql .= " AND p.usuario_id = ?";
                $args[] = $u['id'];
            }

            if ($status) {
                $sql .= " AND p.status = ?";
                $args[] = $status;
            }

            $de_f  = $_GET['de']  ?? null;
            $ate_f = $_GET['ate'] ?? null;
            if ($de_f && $ate_f && (!$u || $u['tipo'] !== 'aluno')) {
                $sql .= " AND DATE(p.created_at) BETWEEN ? AND ?";
                $args[] = $de_f;
                $args[] = $ate_f;
            }
            $sql .= " ORDER BY p.created_at DESC LIMIT 500";
            $stmt = db()->prepare($sql);
            $stmt->execute($args);
            $list = $stmt->fetchAll();

            if ($list) {
                $ids = array_column($list, 'id');
                $place = implode(',', array_fill(0, count($ids), '?'));
                $iq = db()->prepare("SELECT * FROM pedido_itens WHERE pedido_id IN ($place) ORDER BY id");
                $iq->execute($ids);
                $itens_por_pedido = [];
                foreach ($iq->fetchAll() as $it) {
                    $itens_por_pedido[$it['pedido_id']][] = $it;
                }
                foreach ($list as &$p) {
                    $p['itens']  = $itens_por_pedido[$p['id']] ?? [];
                    $p['total']  = (float)$p['total'];
                }
            }

            $server_now = db()->query("SELECT NOW() AS t")->fetchColumn();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => true, 'dados' => $list, 'server_now' => $server_now, 'msg' => ''], JSON_UNESCAPED_UNICODE);
            exit;
            break;
        }

        case 'POST': {
            $in = input_json();

            $itens         = $in['itens'] ?? [];
            $forma         = $in['forma_pagamento'] ?? 'pix';
            $origem        = $in['origem'] ?? 'app';
            $cliente_nome_ = trim($in['cliente_nome'] ?? '');
            $observacoes   = trim($in['observacoes'] ?? '');

            if (!is_array($itens) || !$itens) fail('Pedido sem itens.');

            $u = usuario_logado();

            if (!$u && $origem !== 'totem') fail('Faça login para pedir.', 401);
            if ($origem === 'totem' && !$cliente_nome_) $cliente_nome_ = 'Autoatendimento';
            $cliente_nome = $u['nome'] ?? $cliente_nome_;

            db()->beginTransaction();

            $ids = array_map(fn($i) => (int)$i['produto_id'], $itens);
            $place = implode(',', array_fill(0, count($ids), '?'));
            $st = db()->prepare("SELECT id, nome, preco, emoji, estoque FROM produtos WHERE id IN ($place) AND ativo=1 FOR UPDATE");
            $st->execute($ids);
            $prods = [];
            foreach ($st->fetchAll() as $p) $prods[$p['id']] = $p;

            $total = 0;
            $linhas = [];
            foreach ($itens as $it) {
                $pid = (int)$it['produto_id'];
                $qty = max(1, (int)$it['quantidade']);
                if (!isset($prods[$pid])) {
                    db()->rollBack();
                    fail('Produto indisponível.');
                }
                $p = $prods[$pid];
                if ($p['estoque'] < $qty) {
                    db()->rollBack();
                    fail('Estoque insuficiente para "' . $p['nome'] . '".');
                }
                $sub = round((float)$p['preco'] * $qty, 2);
                $total += $sub;
                $linhas[] = [
                    'produto_id'     => $pid,
                    'produto_nome'   => $p['nome'],
                    'produto_emoji'  => $p['emoji'],
                    'quantidade'     => $qty,
                    'preco_unitario' => (float)$p['preco'],
                    'subtotal'       => $sub,
                ];
            }
            $total = round($total, 2);
            if ($total <= 0) { db()->rollBack(); fail('Valor inválido.'); }

            $desconto = 0.0;
            $cupom_codigo = trim($in['cupom_codigo'] ?? '');
            if ($cupom_codigo && $u) {
                $sc = db()->prepare(
                    "SELECT * FROM cupons
                     WHERE codigo=? AND usuario_id=? AND usado=0 AND expires_at>NOW() LIMIT 1"
                );
                $sc->execute([$cupom_codigo, $u['id']]);
                $cupom = $sc->fetch();
                if ($cupom) {
                    $desconto = $cupom['tipo'] === 'percentual'
                        ? round($total * (float)$cupom['valor'] / 100, 2)
                        : min((float)$cupom['valor'], $total);
                    $total = max(0, round($total - $desconto, 2));

                    db()->prepare("UPDATE cupons SET usado=1 WHERE id=?")
                        ->execute([$cupom['id']]);
                }
            }

            $codigo = gerar_codigo_pedido();
            $st = db()->prepare(
                "INSERT INTO pedidos
                 (codigo, usuario_id, origem, cliente_nome, total, desconto, status, forma_pagamento, observacoes)
                 VALUES (?,?,?,?,?,?, 'pendente', ?, ?)"
            );
            $st->execute([
                $codigo, $u['id'] ?? null, $origem, $cliente_nome,
                $total, $desconto, $forma, $observacoes
            ]);
            $ped_id = (int)db()->lastInsertId();

            $insItem = db()->prepare(
                "INSERT INTO pedido_itens
                 (pedido_id, produto_id, produto_nome, produto_emoji, quantidade, preco_unitario, subtotal)
                 VALUES (?,?,?,?,?,?,?)"
            );
            foreach ($linhas as $l) {
                $insItem->execute([
                    $ped_id, $l['produto_id'], $l['produto_nome'], $l['produto_emoji'],
                    $l['quantidade'], $l['preco_unitario'], $l['subtotal']
                ]);

                db()->prepare("UPDATE produtos SET estoque = estoque - ? WHERE id = ?")
                    ->execute([$l['quantidade'], $l['produto_id']]);
                db()->prepare(
                    "INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, motivo, pedido_id)
                     VALUES (?, 'saida', ?, ?, ?)"
                )->execute([$l['produto_id'], $l['quantidade'], 'Venda pedido #'.$codigo, $ped_id]);
            }

            db()->commit();


            $asaas_data = null;
            $gerar_asaas = ($forma === 'pix') && !in_array($forma, ['dinheiro','tap'], true);
            if ($gerar_asaas) {
                try {

                    if ($u && $origem !== 'totem') {

                        $customerId = Asaas::ensureCustomer($u);
                    } else {

                        $customerId = Asaas::ensureCustomerGenerico($cliente_nome ?: 'Autoatendimento', $codigo);
                    }
                    $tipo_asaas = match($forma) {
                        'pix'              => 'PIX',
                        'cartao_credito'   => 'CREDIT_CARD',
                        'cartao_debito'    => 'DEBIT_CARD',
                        default            => 'UNDEFINED',
                    };

                    $valor_cobranca = max((float)$total, 5.00);
                    $cobranca = Asaas::criarCobranca(
                        $customerId,
                        $valor_cobranca,
                        $tipo_asaas,
                        "Pedido Rango #$codigo",
                        $codigo
                    );

                    $asaas_id   = $cobranca['id'] ?? null;
                    $invoiceUrl = $cobranca['invoiceUrl'] ?? null;
                    $pix_qr = null; $pix_copia = null;

                    if ($tipo_asaas === 'PIX' && $asaas_id) {

                        try {
                            $qr = Asaas::obterQrCodePix($asaas_id);
                            if (!empty($qr['encodedImage'])) {
                                $pix_qr    = $qr['encodedImage'];
                                $pix_copia = $qr['payload'] ?? null;
                            }
                        } catch (Throwable $qrErr) {

                        }
                    }

                    db()->prepare(
                        "UPDATE pedidos
                         SET asaas_payment_id = ?, asaas_status = ?, asaas_invoice_url = ?,
                             asaas_pix_qrcode = ?, asaas_pix_copypaste = ?
                         WHERE id = ?"
                    )->execute([
                        $asaas_id,
                        $cobranca['status'] ?? 'PENDING',
                        $invoiceUrl,
                        $pix_qr,
                        $pix_copia,
                        $ped_id,
                    ]);

                    $asaas_data = [
                        'payment_id'   => $asaas_id,
                        'status'       => $cobranca['status'] ?? null,
                        'invoice_url'  => $invoiceUrl,
                        'pix_qrcode'   => $pix_qr,
                        'pix_copypaste'=> $pix_copia,
                    ];
                } catch (Throwable $e) {

                    try {
                        db()->prepare("UPDATE pedidos SET observacoes = CONCAT(IFNULL(observacoes,''), ?) WHERE id = ?")                            ->execute(['\nErro Asaas: '.$e->getMessage(), $ped_id]);
                    } catch(Throwable $_){}

                    $asaas_data = ['erro' => $e->getMessage()];
                }
            }

            $sel = db()->prepare(
                "SELECT * FROM pedidos WHERE id = ? LIMIT 1"
            );
            $sel->execute([$ped_id]);
            $pedido = $sel->fetch();
            $pedido['total'] = (float)$pedido['total'];
            $pedido['itens'] = $linhas;
            $pedido['pagamento'] = $asaas_data;

            ok($pedido, 'Pedido criado.');
            break;
        }


        case 'PUT': {
            exigir_login('admin'); 
            if (!$id) fail('ID obrigatório.');
            $in = input_json();
            $novo = $in['status'] ?? '';
            $aceitos = ['pendente','confirmado','preparando','pronto','entregue','cancelado'];
            if (!in_array($novo, $aceitos, true)) fail('Status inválido.');


            $stmt = db()->prepare("SELECT status FROM pedidos WHERE id = ?");
            $stmt->execute([$id]);
            $atual = $stmt->fetchColumn();
            if (!$atual) fail('Pedido não encontrado.', 404);

            $ped_stmt = db()->prepare("SELECT usuario_id, total, status, pago_em FROM pedidos WHERE id = ?");
            $ped_stmt->execute([$id]);
            $ped_atual = $ped_stmt->fetch();

            db()->beginTransaction();
            db()->prepare("UPDATE pedidos SET status = ? WHERE id = ?")->execute([$novo, $id]);

            if ($novo === 'cancelado' && $atual !== 'cancelado') {
                $itens = db()->prepare("SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ?");
                $itens->execute([$id]);
                foreach ($itens->fetchAll() as $it) {
                    db()->prepare("UPDATE produtos SET estoque = estoque + ? WHERE id = ?")
                        ->execute([$it['quantidade'], $it['produto_id']]);
                }
            }

            $deve_creditar = in_array($novo, ['confirmado', 'entregue'], true)
                          && !in_array($atual, ['confirmado', 'preparando', 'pronto', 'entregue'], true)
                          && !empty($ped_atual['usuario_id']);

            if ($deve_creditar) {
                db()->prepare("UPDATE pedidos SET pago_em = NOW() WHERE id = ? AND pago_em IS NULL")->execute([$id]);
                creditar_pontos((int)$ped_atual['usuario_id'], (float)$ped_atual['total'], $id);
            }

            db()->commit();
            ok([], 'Status atualizado.');
            break;
        }

        default:
            fail('Método inválido.', 405);
    }
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    fail('Erro: ' . $e->getMessage(), 500);
}

function creditar_pontos(int $uid, float $valor, int $pedido_id): void {
    $pts = round($valor * POINTS_PER_REAL, 2);
    db()->prepare(
        "UPDATE usuarios SET rango_points = rango_points + ?, pontos_ganhos = pontos_ganhos + ? WHERE id = ?"
    )->execute([$pts, $pts, $uid]);
    db()->prepare(
        "INSERT INTO pontos_historico (usuario_id, tipo, descricao, pontos, pedido_id)
         VALUES (?, 'ganho', 'Compra na cantina', ?, ?)"
    )->execute([$uid, $pts, $pedido_id]);
}
