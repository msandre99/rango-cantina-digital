<?php

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$action = $_GET['action'] ?? '';

try {

    if ($action === 'estoque' && $method === 'POST') {
        exigir_login('admin');
        if (!$id) fail('ID do produto obrigatório.');
        $in    = input_json();
        $qty   = (int)($in['quantidade'] ?? 0);
        $motivo= trim($in['motivo'] ?? 'Reposição manual');

        if ($qty === 0) fail('Quantidade inválida.');

        db()->beginTransaction();
        db()->prepare("UPDATE produtos SET estoque = estoque + ? WHERE id = ?")
            ->execute([$qty, $id]);
        db()->prepare(
            "INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, motivo)
             VALUES (?, ?, ?, ?)"
        )->execute([$id, $qty > 0 ? 'entrada' : 'saida', abs($qty), $motivo]);
        db()->commit();

        $p = db()->prepare("SELECT * FROM produtos WHERE id = ?");
        $p->execute([$id]);
        ok($p->fetch(), 'Estoque atualizado.');
    }

    switch ($method) {

        case 'GET': {
            if ($id) {
                $stmt = db()->prepare(
                    "SELECT p.*, c.nome AS categoria_nome
                     FROM produtos p
                     LEFT JOIN categorias c ON c.id = p.categoria_id
                     WHERE p.id = ? LIMIT 1"
                );
                $stmt->execute([$id]);
                $p = $stmt->fetch();
                if (!$p) fail('Produto não encontrado.', 404);
                ok($p);
            }
            $cat_id        = isset($_GET['categoria_id']) ? (int)$_GET['categoria_id'] : 0;
            $busca         = trim($_GET['busca'] ?? '');
            $somente_ativos= !isset($_GET['todos']);

            $sql = "SELECT p.*, c.nome AS categoria_nome
                    FROM produtos p
                    LEFT JOIN categorias c ON c.id = p.categoria_id
                    WHERE 1=1";
            $args = [];
            if ($somente_ativos) $sql .= " AND p.ativo = 1";
            if ($cat_id)         { $sql .= " AND p.categoria_id = ?"; $args[] = $cat_id; }
            if ($busca)          { $sql .= " AND p.nome LIKE ?";       $args[] = "%$busca%"; }
            $sql .= " ORDER BY p.nome ASC";

            $stmt = db()->prepare($sql);
            $stmt->execute($args);
            $rows = $stmt->fetchAll();

            foreach ($rows as &$r) {
                $r['preco']          = (float)$r['preco'];
                $r['custo']          = (float)$r['custo'];
                $r['estoque']        = (int)$r['estoque'];
                $r['estoque_minimo'] = (int)$r['estoque_minimo'];
                $r['categoria_id']   = $r['categoria_id'] !== null ? (int)$r['categoria_id'] : null;
                $r['em_estoque']     = $r['estoque'] > 0;
            }
            ok($rows);
            break;
        }

        case 'POST': {
            exigir_login('admin');
            $in = input_json();

            $nome           = trim($in['nome'] ?? '');
            $categoria_id   = (int)($in['categoria_id'] ?? 0) ?: null;
            $descricao      = trim($in['descricao'] ?? '');
            $preco          = (float)($in['preco'] ?? 0);
            $custo          = (float)($in['custo'] ?? 0);
            $estoque        = (int)($in['estoque'] ?? 0);
            $estoque_minimo = (int)($in['estoque_minimo'] ?? 10);
            $emoji          = trim($in['emoji'] ?? '🍽️');
            $imagem         = trim($in['imagem'] ?? '');

            if (!$nome)         fail('Nome obrigatório.');
            if ($preco <= 0)    fail('Preço inválido.');

            $stmt = db()->prepare(
                "INSERT INTO produtos (categoria_id, nome, descricao, preco, custo, estoque, estoque_minimo, emoji, imagem)
                 VALUES (?,?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([$categoria_id, $nome, $descricao, $preco, $custo, $estoque, $estoque_minimo, $emoji, $imagem]);
            $newId = (int)db()->lastInsertId();
            $p = db()->query("SELECT * FROM produtos WHERE id = $newId")->fetch();
            ok($p, 'Produto criado.');
            break;
        }

        case 'PUT': {
            exigir_login('admin');
            if (!$id) fail('ID obrigatório.');
            $in = input_json();

            $map = [
                'nome'           => 'string',
                'descricao'      => 'string',
                'preco'          => 'float',
                'custo'          => 'float',
                'estoque'        => 'int',
                'estoque_minimo' => 'int',
                'emoji'          => 'string',
                'imagem'         => 'string',
                'categoria_id'   => 'int',
                'ativo'          => 'int',
            ];
            $sets = []; $vals = [];
            foreach ($map as $k => $type) {
                if (!array_key_exists($k, $in)) continue;
                $v = $in[$k];
                if ($type === 'int'   ) $v = $v === '' ? null : (int)$v;
                if ($type === 'float' ) $v = (float)$v;
                $sets[] = "$k = ?";
                $vals[] = $v;
            }
            if (!$sets) fail('Nada para atualizar.');
            $vals[] = $id;
            db()->prepare("UPDATE produtos SET " . implode(',', $sets) . " WHERE id = ?")->execute($vals);

            $p = db()->prepare("SELECT * FROM produtos WHERE id = ?");
            $p->execute([$id]);
            ok($p->fetch(), 'Produto atualizado.');
            break;
        }

        case 'DELETE': {
            exigir_login('admin');
            if (!$id) fail('ID obrigatório.');

            $hard = !empty($_GET['hard']);
            if ($hard) {
                db()->prepare("DELETE FROM produtos WHERE id = ?")->execute([$id]);
            } else {
                db()->prepare("UPDATE produtos SET ativo = 0 WHERE id = ?")->execute([$id]);
            }
            ok([], 'Produto removido.');
            break;
        }

        default:
            fail('Método inválido.', 405);
    }
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    fail('Erro: ' . $e->getMessage(), 500);
}
