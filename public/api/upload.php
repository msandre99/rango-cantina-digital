<?php


require_once __DIR__ . '/config.php';
exigir_login('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Método inválido.', 405);
}

$file = $_FILES['file'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    $erros = [
        UPLOAD_ERR_INI_SIZE   => 'Arquivo maior que o permitido pelo servidor.',
        UPLOAD_ERR_FORM_SIZE  => 'Arquivo maior que o permitido pelo formulário.',
        UPLOAD_ERR_PARTIAL    => 'Upload incompleto.',
        UPLOAD_ERR_NO_FILE    => 'Nenhum arquivo enviado.',
        UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária indisponível.',
        UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar no disco.',
    ];
    $codigo = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    fail($erros[$codigo] ?? 'Erro desconhecido no upload.', 400);
}


$limite = 4 * 1024 * 1024; 
if ($file['size'] > $limite) {
    fail('Imagem muito grande. Máximo: 4 MB.');
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$aceitos = [
    'image/jpeg' => 'jpg',
    'image/jpg'  => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];
if (!isset($aceitos[$mime])) {
    fail('Formato não suportado. Use JPG, PNG, GIF ou WEBP.');
}

$uploadDir = dirname(__DIR__) . '/assets/img/produtos/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext      = $aceitos[$mime];
$nome     = bin2hex(random_bytes(12)) . '.' . $ext;
$destino  = $uploadDir . $nome;

if (!move_uploaded_file($file['tmp_name'], $destino)) {
    fail('Não foi possível salvar o arquivo. Verifique permissões da pasta assets/img/produtos/.');
}

$url = 'assets/img/produtos/' . $nome;

ok(['url' => $url], 'Upload realizado.');
