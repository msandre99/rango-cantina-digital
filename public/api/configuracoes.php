<?php

require_once __DIR__.'/config.php';

try {

    db()->exec(
        "CREATE TABLE IF NOT EXISTS configuracoes_cantina (
            id             INT          NOT NULL DEFAULT 1,
            nome_cantina   VARCHAR(120) NOT NULL DEFAULT '',
            telefone       VARCHAR(30)  NOT NULL DEFAULT '',
            endereco       VARCHAR(200) NOT NULL DEFAULT '',
            email          VARCHAR(120) NOT NULL DEFAULT '',
            site           VARCHAR(200) NOT NULL DEFAULT '',
            cor_principal  VARCHAR(20)  NOT NULL DEFAULT '#ff7a00',
            aceitar_promo  TINYINT(1)   NOT NULL DEFAULT 1,
            pedidos_online TINYINT(1)   NOT NULL DEFAULT 1,
            notif_estoque  TINYINT(1)   NOT NULL DEFAULT 1,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );


    try {
        db()->exec("ALTER TABLE configuracoes_cantina ADD COLUMN logo LONGTEXT");
    } catch (Throwable $ignored) {  }


    db()->exec("INSERT IGNORE INTO configuracoes_cantina (id) VALUES (1)");


    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $row = db()->query("SELECT * FROM configuracoes_cantina WHERE id=1 LIMIT 1")->fetch();
        ok($row ?: []);
    }


    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        exigir_login('admin');
        $in = input_json();

        $bools   = ['aceitar_promo','pedidos_online','notif_estoque'];
        $allowed = ['nome_cantina','telefone','endereco','email','site',
                    'cor_principal','aceitar_promo','pedidos_online','notif_estoque'];

        $cols = db()->query("SHOW COLUMNS FROM configuracoes_cantina LIKE 'logo'")->fetchAll();
        if ($cols) $allowed[] = 'logo';

        $campos = [];
        $vals   = [];
        foreach ($allowed as $col) {
            if (!array_key_exists($col, $in)) continue;
            $val = $in[$col];
            if (in_array($col, $bools)) {
                $val = $val ? 1 : 0;
            } elseif (is_string($val) && $col !== 'logo') {
                $val = mb_substr(trim($val), 0, 500);
            }
            $campos[] = "$col = ?";
            $vals[]   = $val;
        }

        if (empty($campos)) fail('Nenhum campo enviado.');

        db()->prepare(
            "UPDATE configuracoes_cantina SET " . implode(', ', $campos) . " WHERE id = 1"
        )->execute($vals);

        ok([], 'Configurações salvas.');
    }

    ok([]);

} catch (Throwable $e) {
    fail('Erro: ' . $e->getMessage() . ' | Linha: ' . $e->getLine() . ' | Arquivo: ' . basename($e->getFile()), 500);
}
