<?php

require_once __DIR__ . '/config.php';

class Asaas {


    private static function request(string $method, string $path, array $body = []): array {
        $url = ASAAS_BASE_URL . $path;
        $ch  = curl_init($url);

        $headers = [
            'Content-Type: application/json',
            'access_token: ' . ASAAS_API_KEY,
            'User-Agent: RangoApp/1.0 (PHP/' . PHP_VERSION . '; Cantina Digital SENAI)',
            'Accept: application/json',
        ];

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 25,

            CURLOPT_SSL_VERIFYPEER => (ASAAS_AMBIENTE === 'producao'),
        ]);
        if (in_array($method, ['POST','PUT','PATCH'], true) && $body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
        }

        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            throw new RuntimeException("Falha de comunicação com Asaas: $err");
        }
        $data = json_decode($resp, true);
        if ($code >= 400) {
            $msg = is_array($data['errors'] ?? null)
                ? ($data['errors'][0]['description'] ?? json_encode($data))
                : "Erro Asaas HTTP $code";
            throw new RuntimeException($msg);
        }
        return is_array($data) ? $data : [];
    }

    public static function ensureCustomer(array $usuario): string {

        if (!empty($usuario['asaas_customer_id'])) {
            try {
                $check = self::request('GET', '/customers/' . $usuario['asaas_customer_id']);
                if (!empty($check['id'])) return $usuario['asaas_customer_id'];
            } catch (Throwable $_) {

                db()->prepare("UPDATE usuarios SET asaas_customer_id = NULL WHERE id = ?")
                    ->execute([$usuario['id']]);
            }
        }

        $cpf = preg_replace('/\D/', '', $usuario['cpf'] ?? '');
        $tel = preg_replace('/\D/', '', $usuario['telefone'] ?? '');

        $cpf_valido = (strlen($cpf) === 11 && self::validarCPF($cpf))
                   || (strlen($cpf) === 14 && self::validarCNPJ($cpf));

        if (!$cpf_valido) {
            if (ASAAS_AMBIENTE === 'sandbox') {
                $cpf = '24971563792';
                $cpf_valido = true;
            } else {
                throw new RuntimeException(
                    'Para pagar com PIX, cadastre seu CPF no perfil do aplicativo.'
                );
            }
        }

        $extRef = 'rango-user-' . $usuario['id'];
        $existing = self::request('GET', '/customers?externalReference=' . $extRef);
        if (!empty($existing['data'][0]['id'])) {
            $id = $existing['data'][0]['id'];
            db()->prepare("UPDATE usuarios SET asaas_customer_id = ? WHERE id = ?")
                ->execute([$id, $usuario['id']]);
            return $id;
        }

        $payload = [
            'name'              => $usuario['nome'],
            'cpfCnpj'           => $cpf,
            'email'             => $usuario['email'] ?: null,
            'externalReference' => $extRef,
        ];
        if ($tel) $payload['mobilePhone'] = $tel;

        $resp = self::request('POST', '/customers', $payload);
        $id = $resp['id'] ?? null;
        if (!$id) throw new RuntimeException('Asaas não retornou customer id.');

        db()->prepare("UPDATE usuarios SET asaas_customer_id = ? WHERE id = ?")
            ->execute([$id, $usuario['id']]);
        return $id;
    }

    public static function criarCobranca(
        string $customerId,
        float  $valor,
        string $tipo = 'PIX',
        string $descricao = 'Pedido Rango',
        string $externalRef = ''
    ): array {
        $payload = [
            'customer'          => $customerId,
            'billingType'       => $tipo,
            'value'             => round($valor, 2),
            'dueDate'           => date('Y-m-d'),
            'description'       => mb_substr($descricao, 0, 120),
            'externalReference' => $externalRef,
        ];
        return self::request('POST', '/payments', $payload);
    }

    public static function obterQrCodePix(string $paymentId): array {
        return self::request('GET', "/payments/$paymentId/pixQrCode");
    }

    public static function consultarCobranca(string $paymentId): array {
        return self::request('GET', "/payments/$paymentId");
    }

    public static function cancelarCobranca(string $paymentId): array {
        return self::request('DELETE', "/payments/$paymentId");
    }

    private static function validarCPF(string $cpf): bool {
        if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) return false;
        for ($t = 9; $t < 11; $t++) {
            $s = 0;
            for ($i = 0; $i < $t; $i++) $s += (int)$cpf[$i] * ($t + 1 - $i);
            $r = (10 * $s) % 11;
            if ((int)$cpf[$t] !== ($r >= 10 ? 0 : $r)) return false;
        }
        return true;
    }
    private static function validarCNPJ(string $cnpj): bool {
        if (strlen($cnpj) !== 14 || preg_match('/^(\d)\1{13}$/', $cnpj)) return false;
        $calc = function($cnpj, $len) {
            $s = 0; $pos = $len - 7;
            for ($i = $len; $i >= 1; $i--) {
                $s += (int)$cnpj[$len - $i] * $pos--;
                if ($pos < 2) $pos = 9;
            }
            $r = $s % 11;
            return $r < 2 ? 0 : 11 - $r;
        };
        return (int)$cnpj[12] === $calc($cnpj, 12) && (int)$cnpj[13] === $calc($cnpj, 13);
    }

    public static function ensureCustomerGenerico(string $nome, string $ref): string {
 
        $extRef = 'totem-autoatendimento';
        $resp = self::request('GET', '/customers?externalReference=' . $extRef);
        if (!empty($resp['data'][0]['id'])) return $resp['data'][0]['id'];

        $payload = [
            'name'              => 'Cantina Autoatendimento',
            'cpfCnpj'           => '11222333000181',
            'email'             => 'totem@rango.local',
            'externalReference' => $extRef,
        ];
        $resp = self::request('POST', '/customers', $payload);
        $id = $resp['id'] ?? null;
        if (!$id) throw new RuntimeException('Asaas não retornou customer id (totem): ' . json_encode($resp));
        return $id;
    }
}
