<?php

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;

try {
    switch ($method) {

        case 'GET': {
            if ($id) {
                $stmt = db()->prepare("SELECT * FROM categorias WHERE id = ? LIMIT 1");
                $stmt->execute([$id]);
                $cat = $stmt->fetch();
                if (!$cat) fail('Categoria não encontrada.', 404);
                ok($cat);
            } else {
                $somente_ativos = !isset($_GET['todos']);
                $sql = "SELECT c.*,
                         (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id AND p.ativo = 1) AS total_produtos
                        FROM categorias c";
                if ($somente_ativos) $sql .= " WHERE c.ativo = 1";
                $sql .= " ORDER BY c.ordem ASC, c.nome ASC";
                $list = db()->query($sql)->fetchAll();
                ok($list);
            }
            break;
        }

        case 'POST': {
            exigir_login('admin');
            $in   = input_json();
            $nome  = trim($in['nome'] ?? '');
            $icone = trim($in['icone'] ?? '🍽️');
            $ordem = (int)($in['ordem'] ?? 0);
            if (!$nome) fail('Informe o nome da categoria.');

            $stmt = db()->prepare(
                "INSERT INTO categorias (nome, icone, ordem) VALUES (?, ?, ?)"
            );
            $stmt->execute([$nome, $icone, $ordem]);
            $newId = (int)db()->lastInsertId();

            $cat = db()->query("SELECT * FROM categorias WHERE id = $newId")->fetch();
            ok($cat, 'Categoria criada.');
            break;
        }

        case 'PUT': {
            exigir_login('admin');
            if (!$id) fail('ID obrigatório.');
            $in = input_json();

            $fields = [];
            $vals   = [];
            foreach (['nome','icone','ordem','ativo'] as $k) {
                if (array_key_exists($k, $in)) {
                    $fields[] = "$k = ?";
                    $vals[]   = $in[$k];
                }
            }
            if (!$fields) fail('Nada para atualizar.');

            $vals[] = $id;
            $sql = "UPDATE categorias SET " . implode(', ', $fields) . " WHERE id = ?";
            db()->prepare($sql)->execute($vals);

            $cat = db()->prepare("SELECT * FROM categorias WHERE id = ?");
            $cat->execute([$id]);
            ok($cat->fetch(), 'Categoria atualizada.');
            break;
        }

        case 'DELETE': {
            exigir_login('admin');
            if (!$id) fail('ID obrigatório.');
            $hard = !empty($_GET['hard']);
            if ($hard) {
                db()->prepare("DELETE FROM categorias WHERE id = ?")->execute([$id]);
            } else {
                db()->prepare("UPDATE categorias SET ativo = 0 WHERE id = ?")->execute([$id]);
            }
            ok([], 'Categoria removida.');
            break;
        }

        default:
            fail('Método inválido.', 405);
    }
} catch (Throwable $e) {
    fail('Erro: ' . $e->getMessage(), 500);
}
