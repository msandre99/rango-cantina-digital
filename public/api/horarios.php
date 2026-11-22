<?php

require_once __DIR__.'/config.php';
$method = $_SERVER['REQUEST_METHOD'];

try {
    if (isset($_GET['check'])) {


        $agora = new DateTime('now', new DateTimeZone('America/Sao_Paulo'));
        $hora_brasilia = $agora->format('H:i:s');
        $dia_semana    = (int)$agora->format('w'); 

        $stmt  = db()->query("SELECT turno, abertura, fechamento, ativo, dias_semana FROM horarios_funcionamento WHERE ativo=1");
        $turnos = $stmt->fetchAll();


        $dias_str = '';
        foreach ($turnos as $t) {
            if (!empty($t['dias_semana'])) { $dias_str = $t['dias_semana']; break; }
        }
        $dias_ativos = array_map('intval', array_filter(explode(',', $dias_str), 'strlen'));


        if ($dias_ativos && !in_array($dia_semana, $dias_ativos, true)) {
            $nomes_dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

            $proximo_dia = null;
            for ($i = 1; $i <= 7; $i++) {
                $d = ($dia_semana + $i) % 7;
                if (in_array($d, $dias_ativos, true)) {
                    $proximo_dia = $nomes_dias[$d];
                    break;
                }
            }
            ok([
                'aberto'        => false,
                'hora_brasilia' => $hora_brasilia,
                'proximo_turno' => $proximo_dia ? ['turno' => 'fechado', 'abre_em' => $proximo_dia] : null,
                'motivo'        => 'dia',
            ]);
        }

        $aberto  = false;
        $proximo = null;

        foreach ($turnos as $t) {
            if ($hora_brasilia >= $t['abertura'] && $hora_brasilia <= $t['fechamento']) {
                $aberto = true;
                break;
            }
            if ($t['abertura'] > $hora_brasilia) {
                if (!$proximo || $t['abertura'] < $proximo['abertura']) {
                    $proximo = $t;
                }
            }
        }

        ok([
            'aberto'        => $aberto,
            'hora_brasilia' => $hora_brasilia,
            'proximo_turno' => $proximo ? ['turno' => $proximo['turno'], 'abre_em' => substr($proximo['abertura'],0,5)] : null,
        ]);
    }

    if ($method === 'GET') {
        $stmt = db()->query("SELECT * FROM horarios_funcionamento ORDER BY FIELD(turno,'manha','tarde','noite')");
        ok($stmt->fetchAll());
    }

    if ($method === 'POST') {
        exigir_login('admin');
        $in          = input_json();
        $turnos      = $in['turnos']      ?? [];
        $dias_semana = $in['dias_semana'] ?? null;

        if (!$turnos) fail('Nenhum turno enviado.');


        $stmtTurno = db()->prepare(
            "UPDATE horarios_funcionamento SET abertura=?, fechamento=?, ativo=? WHERE turno=?"
        );
        foreach ($turnos as $t) {
            $turno      = $t['turno']      ?? '';
            $abertura   = $t['abertura']   ?? '07:00';
            $fechamento = $t['fechamento'] ?? '18:00';
            $ativo      = isset($t['ativo']) ? (int)$t['ativo'] : 1;
            if (!in_array($turno, ['manha','tarde','noite'], true)) continue;
            if (strlen($abertura)   === 5) $abertura   .= ':00';
            if (strlen($fechamento) === 5) $fechamento .= ':00';
            $stmtTurno->execute([$abertura, $fechamento, $ativo, $turno]);
        }


        if ($dias_semana !== null) {
            $nums = array_map('intval', explode(',', (string)$dias_semana));
            $nums = array_unique(array_filter($nums, fn($n) => $n >= 0 && $n <= 6));
            sort($nums);
            $dias_val = implode(',', $nums) ?: '1,2,3,4,5';

            db()->prepare(
                "UPDATE horarios_funcionamento SET dias_semana = ?"
            )->execute([$dias_val]);
        }

        ok([], 'Horários salvos.');
    }
} catch (Throwable $e) { fail('Erro: '.$e->getMessage(), 500); }
