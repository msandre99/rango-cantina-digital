<?php


require_once __DIR__ . '/config.php';
require_once __DIR__ . '/asaas.php';


$token = $_GET['token'] ?? '';
if ($token !== ASAAS_WEBHOOK_TOKEN) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'erro' => 'Token inválido.']);
    exit;
}

$raw  = file_get_contents('php://input');
$evt  = json_decode($raw, true) ?: [];

@file_put_contents(__DIR__ . '/_asaas_webhook.log',
    date('c') . " | " . substr($raw, 0, 2000) . "\n\n", FILE_APPEND);

$tipo    = $evt['event'] ?? '';
$payment = $evt['payment'] ?? [];
$pid     = $payment['id'] ?? '';
$status  = $payment['status'] ?? '';

if (!$pid) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'erro' => 'Sem payment id.']);
    exit;
}

try {
    $stmt = db()->prepare("SELECT id, usuario_id, total, status FROM pedidos WHERE asaas_payment_id = ? LIMIT 1");
    $stmt->execute([$pid]);
    $ped = $stmt->fetch();
    if (!$ped) { echo json_encode(['ok'=>true,'msg'=>'pedido não encontrado, ignorando']); exit; }


    db()->prepare("UPDATE pedidos SET asaas_status = ? WHERE id = ?")
        ->execute([$status, $ped['id']]);

    if (in_array($tipo, ['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_RECEIVED_IN_CASH'], true)
        && $ped['status'] === 'pendente') {

        db()->prepare("UPDATE pedidos SET status = 'confirmado', pago_em = NOW() WHERE id = ?")
            ->execute([$ped['id']]);

        if ($ped['usuario_id']) {
            $pts = round((float)$ped['total'] * POINTS_PER_REAL, 2);
            db()->prepare("UPDATE usuarios SET rango_points = rango_points + ?, pontos_ganhos = pontos_ganhos + ? WHERE id = ?")
                ->execute([$pts, $pts, $ped['usuario_id']]);
            db()->prepare(
                "INSERT INTO pontos_historico (usuario_id, tipo, descricao, pontos, pedido_id)
                 VALUES (?, 'ganho', 'Compra na cantina (pago)', ?, ?)"
            )->execute([$ped['usuario_id'], $pts, $ped['id']]);
        }
    }

    if (in_array($tipo, ['PAYMENT_REFUNDED','PAYMENT_DELETED','PAYMENT_REFUND_DENIED'], true)) {
        db()->prepare("UPDATE pedidos SET status = 'cancelado' WHERE id = ? AND status != 'entregue'")
            ->execute([$ped['id']]);
    }

    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'erro' => $e->getMessage()]);
}
