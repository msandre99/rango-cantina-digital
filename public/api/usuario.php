<?php


require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'pontos';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {


        case 'pontos': {
            $u = exigir_login('aluno');

            $stmt = db()->prepare(
                "SELECT rango_points, pontos_ganhos FROM usuarios WHERE id = ?"
            );
            $stmt->execute([$u['id']]);
            $row = $stmt->fetch();

            $gasto_stmt = db()->prepare(
                "SELECT COALESCE(SUM(total),0) AS total_mes, COUNT(*) AS pedidos_mes
                  FROM pedidos
                  WHERE usuario_id = ?
                    AND status NOT IN ('cancelado')
                    AND YEAR(created_at)  = YEAR(NOW())
                    AND MONTH(created_at) = MONTH(NOW())"
            );
            $gasto_stmt->execute([$u['id']]);
            $gasto = $gasto_stmt->fetch();

            ok([
                'rango_points'  => (float)$row['rango_points'],
                'pontos_ganhos' => (float)$row['pontos_ganhos'],
                'total_gasto_mes' => (float)$gasto['total_mes'],
                'pedidos_mes'     => (int)$gasto['pedidos_mes'],
            ]);
            break;
        }

        case 'historico': {
            $u = exigir_login('aluno');
            $stmt = db()->prepare(
                "SELECT ph.*, ped.codigo AS pedido_codigo
                 FROM pontos_historico ph
                 LEFT JOIN pedidos ped ON ped.id = ph.pedido_id
                 WHERE ph.usuario_id = ?
                 ORDER BY ph.created_at DESC
                 LIMIT 50"
            );
            $stmt->execute([$u['id']]);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) $r['pontos'] = (float)$r['pontos'];
            ok($rows);
            break;
        }

        case 'resgatar': {
            $u    = exigir_login('aluno');
            if ($method !== 'POST') fail('Método inválido.', 405);
            $in   = input_json();
            $custo = (float)($in['custo'] ?? 0);
            $nome  = trim($in['nome'] ?? 'Prêmio');
            if ($custo <= 0) fail('Custo inválido.');

            $stmt = db()->prepare("SELECT rango_points FROM usuarios WHERE id = ? FOR UPDATE");
            db()->beginTransaction();
            $stmt->execute([$u['id']]);
            $saldo = (float)$stmt->fetchColumn();
            if ($saldo < $custo) {
                db()->rollBack();
                fail('Pontos insuficientes.');
            }
            db()->prepare("UPDATE usuarios SET rango_points = rango_points - ? WHERE id = ?")
                ->execute([$custo, $u['id']]);
            db()->prepare(
                "INSERT INTO pontos_historico (usuario_id, tipo, descricao, pontos)
                 VALUES (?, 'resgate', ?, ?)"
            )->execute([$u['id'], "Resgate: $nome", $custo]);
            db()->commit();
            ok(['rango_points' => round($saldo - $custo, 2)], "\"$nome\" resgatado!");
            break;
        }

        case 'lista': {
            exigir_login('admin');
            $stmt = db()->query(
                "SELECT id, nome, email, matricula, tipo, saldo, rango_points, ativo, created_at
                 FROM usuarios ORDER BY nome ASC"
            );
            ok($stmt->fetchAll());
            break;
        }

        case 'perfil': {
            $u = exigir_login();
            if ($method !== 'PUT' && $method !== 'POST') fail('Método inválido.', 405);
            $in = input_json();
            $campos = [];
            $vals   = [];

            if (!empty($in['nome'])) {
                $campos[] = 'nome = ?';
                $vals[]   = trim($in['nome']);
            }
            if (!empty($in['email'])) {
                $campos[] = 'email = ?';
                $vals[]   = trim($in['email']);
            }
            if (!empty($in['senha_nova']) && !empty($in['senha_atual'])) {

                $hash = db()->prepare("SELECT senha FROM usuarios WHERE id = ?");
                $hash->execute([$u['id']]);
                $h = $hash->fetchColumn();
                if (!password_verify($in['senha_atual'], $h)) fail('Senha atual incorreta.');
                if (strlen($in['senha_nova']) < 8) fail('Nova senha deve ter no mínimo 8 caracteres.');
                $campos[] = 'senha = ?';
                $vals[]   = password_hash($in['senha_nova'], PASSWORD_BCRYPT);
            }
            if (!$campos) fail('Nada para atualizar.');
            $vals[] = $u['id'];
            db()->prepare("UPDATE usuarios SET " . implode(',', $campos) . " WHERE id = ?")
                ->execute($vals);
            ok([], 'Perfil atualizado.');
            break;
        }

        case 'foto_perfil': {
            $u = exigir_login();
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $in   = input_json();
                $foto = $in['foto'] ?? '';
                if (!$foto) fail('Foto nao informada.');
                db()->prepare('UPDATE usuarios SET foto_perfil=? WHERE id=?')->execute([$foto,$u['id']]);
                ok(['foto' => $foto], 'Foto salva!');
            } else {
                $st = db()->prepare('SELECT foto_perfil FROM usuarios WHERE id=? LIMIT 1');
                $st->execute([$u['id']]);
                $row = $st->fetch();
                ok(['foto' => $row['foto_perfil'] ?? null]);
            }
            break;
        }

        default:
            fail('Ação desconhecida.', 404);
    }

} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    fail('Erro: ' . $e->getMessage(), 500);
}
