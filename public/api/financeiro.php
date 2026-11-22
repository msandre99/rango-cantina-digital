<?php

require_once __DIR__ . '/config.php';
exigir_login('admin');

$action = $_GET['action'] ?? 'dashboard';
$method = $_SERVER['REQUEST_METHOD'];
$in = input_json();

try {
    switch ($action) {

        case 'dashboard': {
            $db = db();

            $mes_param = $_GET['mes'] ?? null;  // formato: YYYY-MM
            $de_param  = $_GET['de']  ?? null;  // formato: YYYY-MM-DD
            $ate_param = $_GET['ate'] ?? null;  // formato: YYYY-MM-DD


            if ($mes_param) {
                $ano = explode('-', $mes_param)[0];
                $m   = explode('-', $mes_param)[1];
                $de_periodo  = "{$mes_param}-01";
                $ate_periodo = date('Y-m-t', strtotime($de_periodo));
            } elseif ($de_param && $ate_param) {
                $de_periodo  = $de_param;
                $ate_periodo = $ate_param;
            } else {

                $tz = new DateTimeZone('America/Sao_Paulo');
                $de_periodo  = (new DateTime('first day of this month', $tz))->format('Y-m-d');
                $ate_periodo = (new DateTime('today', $tz))->format('Y-m-d');
            }


            $r1 = $db->query("SELECT COALESCE(SUM(total),0) fat, COUNT(*) qtd FROM pedidos WHERE DATE(created_at)=CURDATE() AND status NOT IN ('cancelado')");
            $dia = $r1->fetch();


            $r2 = $db->prepare("SELECT COALESCE(SUM(total),0) fat, COUNT(*) qtd FROM pedidos WHERE DATE(created_at) BETWEEN ? AND ? AND status NOT IN ('cancelado')");
            $r2->execute([$de_periodo, $ate_periodo]); $mes = $r2->fetch();


            $r_cmv = $db->query(
                "SELECT COALESCE(SUM(pi.quantidade * p.custo), 0) AS cmv
                 FROM pedido_itens pi
                 JOIN pedidos ped ON ped.id = pi.pedido_id
                 LEFT JOIN produtos p ON p.id = pi.produto_id
                 WHERE DATE(ped.created_at) BETWEEN '{$de_periodo}' AND '{$ate_periodo}'
                   AND ped.status NOT IN ('cancelado')"
            );
            $cmv = (float)$r_cmv->fetchColumn();

            $r3 = $db->prepare("SELECT COALESCE(SUM(valor),0) desp FROM transacoes_financeiras WHERE tipo='saida' AND data BETWEEN '{$de_periodo}' AND '{$ate_periodo}'");
            $r3->execute(); $despesas = (float)$r3->fetchColumn();

            $fat_mes = (float)$mes['fat'];

            $lucro = $fat_mes - $cmv - $despesas;

            $pend   = (int)$db->query("SELECT COUNT(*) FROM pedidos WHERE status='pendente'")->fetchColumn();
            $alunos = (int)$db->query("SELECT COUNT(*) FROM usuarios WHERE tipo='aluno' AND ativo=1")->fetchColumn();
            $alertas= (int)$db->query("SELECT COUNT(*) FROM produtos WHERE estoque<=estoque_minimo AND ativo=1")->fetchColumn();

            ok([
                'faturamento_hoje' => (float)$dia['fat'],
                'pedidos_hoje'     => (int)$dia['qtd'],
                'faturamento_mes'  => $fat_mes,
                'pedidos_mes'      => (int)$mes['qtd'],
                'cmv_mes'          => $cmv,
                'despesas_mes'     => $despesas,
                'total_custos'     => $cmv + $despesas,
                'lucro_mes'        => $lucro,
                'pendentes'        => $pend,
                'alunos'           => $alunos,
                'alertas_estoque'  => $alertas,
            ]);
            break;
        }

        case 'transacoes': {
            $limit = min((int)($_GET['limit'] ?? 100), 500);
            $stmt = db()->prepare("SELECT * FROM transacoes_financeiras ORDER BY data DESC, id DESC LIMIT ?");
            $stmt->execute([$limit]);
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) $r['valor'] = (float)$r['valor'];
            ok($rows);
            break;
        }

        case 'grafico': {
            $dias = (int)($_GET['dias'] ?? 14);
            $stmt = db()->prepare(
                "SELECT DATE(created_at) dia, COALESCE(SUM(total),0) fat, COUNT(*) qtd
                 FROM pedidos WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status NOT IN ('cancelado')
                 GROUP BY DATE(created_at) ORDER BY dia ASC"
            );
            $stmt->execute([$dias]);
            $map = []; foreach ($stmt->fetchAll() as $r) $map[$r['dia']] = $r;
            $labels=$fat=$qtd=[];
            for ($i=$dias;$i>=0;$i--) {
                $d = date('Y-m-d', strtotime("-{$i} days"));
                $labels[] = date('d/m', strtotime($d));
                $fat[]    = (float)($map[$d]['fat'] ?? 0);
                $qtd[]    = (int)($map[$d]['qtd'] ?? 0);
            }
            ok(['labels'=>$labels,'faturamento'=>$fat,'pedidos'=>$qtd]);
            break;
        }

        case 'ranking': {
            $stmt = db()->query(
                "SELECT pi.produto_nome nome, SUM(pi.quantidade) vendas, SUM(pi.subtotal) receita,
                        COALESCE(SUM(pi.quantidade * p.custo),0) custo_total
                 FROM pedido_itens pi
                 JOIN pedidos ped ON ped.id=pi.pedido_id AND ped.status NOT IN ('cancelado')
                 LEFT JOIN produtos p ON p.id=pi.produto_id
                 GROUP BY pi.produto_nome ORDER BY vendas DESC LIMIT 10"
            );
            $rows = $stmt->fetchAll();
            $max = (int)($rows[0]['vendas'] ?? 1);
            foreach ($rows as &$r) {
                $r['vendas']  = (int)$r['vendas'];
                $r['receita'] = (float)$r['receita'];
                $r['lucro']   = (float)$r['receita'] - (float)$r['custo_total'];
                $r['pct']     = $max > 0 ? round($r['vendas'] / $max * 100) : 0;
            }
            ok($rows);
            break;
        }

        case 'despesa': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            $titulo  = trim($in['titulo'] ?? '');
            $cat     = trim($in['categoria'] ?? 'Outros');
            $val     = (float)($in['valor'] ?? 0);
            $data    = $in['data'] ?? date('Y-m-d');
            $obs     = trim($in['observacao'] ?? '');
            $icone   = trim($in['icone'] ?? '🧾');
            if (!$titulo || $val <= 0) fail('Preencha título e valor.');
            db()->prepare("INSERT INTO transacoes_financeiras (titulo,categoria,valor,tipo,icone,data,observacao) VALUES(?,?,?,'saida',?,?,?)")
                ->execute([$titulo,$cat,$val,$icone,$data,$obs]);
            ok([],'Despesa registrada.');
            break;
        }

        case 'retirada': {
            if ($method !== 'POST') fail('Método inválido.', 405);
            $val = (float)($in['valor'] ?? 0);
            $obs = trim($in['observacao'] ?? 'Retirada Admin');
            if ($val <= 0) fail('Valor inválido.');
            $hoje = (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
            db()->prepare("INSERT INTO transacoes_financeiras (titulo,categoria,valor,tipo,icone,data) VALUES(?,?,?,'saida','💸',?)")
                ->execute([$obs,'Saque',$val,$hoje]);
            ok([],'Retirada registrada.');
            break;
        }

        case 'deletar': {
            $id = (int)($in['id'] ?? $_GET['id'] ?? 0);
            if (!$id) fail('ID obrigatório.');
            $st = db()->prepare("SELECT id FROM transacoes_financeiras WHERE id=?");
            $st->execute([$id]);
            if (!$st->fetch()) fail('Transação não encontrada.',404);
            db()->prepare("DELETE FROM transacoes_financeiras WHERE id=?")->execute([$id]);
            ok([],'Removida.');
            break;
        }

        case 'editar': {
            $id = (int)($in['id'] ?? 0);
            if (!$id) fail('ID obrigatório.');
            $titulo = trim($in['titulo'] ?? '');
            $val    = (float)($in['valor'] ?? 0);
            $cat    = trim($in['categoria'] ?? 'Outros');
            $data   = $in['data'] ?? date('Y-m-d');
            $obs    = trim($in['observacao'] ?? '');
            if (!$titulo || $val <= 0) fail('Preencha título e valor.');
            db()->prepare("UPDATE transacoes_financeiras SET titulo=?,categoria=?,valor=?,data=?,observacao=? WHERE id=?")
                ->execute([$titulo,$cat,$val,$data,$obs,$id]);
            ok([],'Atualizado.');
            break;
        }


        case 'exportar': {
            $tipo = $_GET['tipo'] ?? 'balanco';


            $de  = $_GET['de']  ?? date('Y-m-d', strtotime('-12 months'));
            $ate = $_GET['ate'] ?? date('Y-m-d');

            if ($tipo === 'balanco') {
                $stmt = db()->prepare(
                    "SELECT titulo, categoria, tipo, valor, data, observacao
                     FROM transacoes_financeiras
                     WHERE data BETWEEN ? AND ?
                     ORDER BY data DESC"
                );
                $stmt->execute([$de, $ate]);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) $r['valor'] = (float)$r['valor'];
                unset($r);

                $stmt2 = db()->prepare(
                    "SELECT codigo AS titulo, 'Vendas' AS categoria, 'entrada' AS tipo,
                            total AS valor, DATE(created_at) AS data, forma_pagamento AS observacao
                     FROM pedidos WHERE DATE(created_at) BETWEEN ? AND ?
                     AND status NOT IN ('cancelado') ORDER BY created_at DESC LIMIT 500"
                );
                $stmt2->execute([$de, $ate]);
                $vendas = $stmt2->fetchAll();
                foreach ($vendas as &$v) $v['valor'] = (float)$v['valor'];
                unset($v);

                ok(['transacoes' => $rows, 'vendas' => $vendas, 'periodo' => ['de' => $de, 'ate' => $ate]]);

            } elseif ($tipo === 'pedidos') {
                $stmt = db()->prepare(
                    "SELECT p.id, p.codigo, p.cliente_nome, p.total, p.status,
                            p.forma_pagamento, p.origem, p.created_at,
                            GROUP_CONCAT(pi.produto_nome,'×',pi.quantidade SEPARATOR ', ') itens
                     FROM pedidos p
                     LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
                     WHERE p.status = 'entregue'
                     GROUP BY p.id ORDER BY p.created_at DESC LIMIT 1000"
                );
                $stmt->execute();
                $rows = $stmt->fetchAll();
                foreach ($rows as &$r) $r['total'] = (float)$r['total'];
                unset($r);
                ok(['pedidos' => $rows]);
            }
            break;
        }

        default: fail('Ação desconhecida.',404);
    }
} catch (Throwable $e) { fail('Erro: '.$e->getMessage(),500); }
