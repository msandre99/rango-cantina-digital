# RANGO — Guia de Implantação

## Estrutura do Projeto

```
rango-cantina-digital/
├── LICENSE
├── README.md
├── .gitignore                  ← Arquivos ignorados pelo Git
│
├── public/                     ← Arquivos disponibilizados no servidor (htdocs)
│   ├── .htaccess
│   ├── index.html              ← Landing page
│   ├── rango-login.html        ← Login (aluno + admin)
│   ├── rango-app-aluno.html    ← Aplicativo do aluno
│   ├── rango-totem.html        ← Totem de autoatendimento
│   ├── rango-admin.html        ← Painel administrativo
│   │
│   ├── api/                    ← API REST (PHP)
│   │   ├── config.php          ← Configuração do banco de dados e Asaas
│   │   ├── auth.php            ← Login, logout e sessões
│   │   ├── categorias.php      ← Gerenciamento de categorias
│   │   ├── produtos.php        ← Gerenciamento de produtos e estoque
│   │   ├── pedidos.php         ← Criação e gerenciamento de pedidos
│   │   ├── financeiro.php      ← Informações financeiras e relatórios
│   │   ├── usuario.php         ← Perfil, pontos e gerenciamento de usuários
│   │   ├── asaas.php           ← Integração com a API Asaas
│   │   └── webhook_asaas.php   ← Recebimento de notificações de pagamento
│   │
│   └── assets/
│       ├── css/                ← Folhas de estilo
│       ├── img/                ← Imagens e elementos visuais
│       ├── js/                 ← Scripts JavaScript
│       │   ├── api.js          ← Comunicação com a API
│       │   ├── login.js        ← Lógica de autenticação
│       │   ├── app-aluno.js    ← Funcionalidades do aluno
│       │   ├── admin.js        ← Funcionalidades administrativas
│       │   ├── totem.js        ← Funcionamento do totem
│       │   └── index-script.js ← Interações da landing page
│       │
│       └── docs/               ← Documentos do sistema
│           ├── Termos_de_Uso.pdf
│           └── Política_de_Privacidade.pdf
│
├── database/                   ← Banco de dados
│   └── rango.sql               ← Estrutura e dados iniciais
│
└── docs/                       ← Documentação do projeto
    ├── LEIA-ME.md
    └── img/                    ← Capturas de tela para o README
```

---

## 1. Requisitos do Servidor

- **PHP** 8.0 ou superior (com extensões: `pdo_mysql`, `curl`, `json`, `mbstring`)
- **MySQL** 5.7+ ou **MariaDB** 10.4+
- **Apache** ou **Nginx** com `mod_rewrite` (ou equivalente)
- **phpMyAdmin** (para gerenciar o banco via interface web)

---

## 2. Banco de Dados

### Via phpMyAdmin:
1. Acesse o phpMyAdmin (`http://localhost/phpmyadmin`)
2. Clique em **"Importar"** na barra superior
3. Selecione o arquivo `sql/rango.sql`
4. Clique em **"Executar"**

### Via terminal MySQL:
```bash
mysql -u root -p < sql/rango.sql
```

Isso criará o banco `rango_db` com todas as tabelas e dados iniciais.

---

## 3. Configurar o Banco em `api/config.php`

```php
define('DB_HOST', '127.0.0.1');   
define('DB_NAME', 'rango_db');    
define('DB_USER', 'root');         
define('DB_PASS', '');             
```

---

## 4. Configurar a API Asaas (Pagamentos)

### Sandbox (testes):
1. Acesse https://sandbox.asaas.com e crie uma conta
2. Vá em **Integrações → API** e copie sua **API Key** (começa com `$aact_...`)
3. Em `api/config.php`, configure:

```php
define('ASAAS_AMBIENTE', 'sandbox');
define('ASAAS_API_KEY',  '$aact_SUA_KEY_AQUI');
```

### Produção:
```php
define('ASAAS_AMBIENTE', 'producao');
define('ASAAS_API_KEY',  '$aact_SUA_KEY_PRODUCAO');
```

### Webhook (notificações de pagamento):
1. No painel Asaas: **Configurações → Notificações → API (Webhook)**
2. URL: `https://SEU-DOMINIO/api/webhook_asaas.php?token=rango_webhook_secret_change_me`
3. Selecione os eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`
4. Altere o token padrão em `config.php`:

```php
define('ASAAS_WEBHOOK_TOKEN', 'seu_token_secreto_aqui');
```

---

## 5. Instalar no Servidor Local (XAMPP/WAMP/Laragon)

1. Copie a pasta `rango/` para dentro de `htdocs/` (XAMPP) ou `www/` (WAMP)
2. Inicie Apache e MySQL
3. Importe o banco (passo 2 acima)
4. Acesse: `http://localhost/rango/`

---

## 6. Contas Padrão (criadas pelo seed)

| Tipo      | Matrícula  | Senha        |
|-----------|------------|--------------|
| Admin     | ADMIN001   | senha12345   |
| Aluno     | 12345      | senha12345   |
| Aluno     | 67890      | senha12345   |
| Atendente | AT001      | senha12345   |

> **IMPORTANTE**: Altere as senhas em produção!
> No phpMyAdmin, use `UPDATE usuarios SET senha = '...' WHERE id = 1`
> com hash gerado por `password_hash('nova_senha', PASSWORD_BCRYPT)`.

---

## 7. Como os Sistemas se Comunicam

```
rango-login.html ──────► api/auth.php ──────► BD (usuarios)
                                │
                                ▼
         ┌──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
rango-app-aluno.html                        rango-admin.html
    │   └─► api/produtos.php (GET)               │   ├─► api/categorias.php (CRUD)
    │   └─► api/categorias.php (GET)             │   ├─► api/produtos.php (CRUD)
    │   └─► api/pedidos.php (POST/GET)           │   ├─► api/pedidos.php (GET/PUT)
    │   └─► api/usuario.php (pontos)             │   ├─► api/financeiro.php (KPIs)
    │                                            │   └─► api/estoque
    ▼                                            │
rango-totem.html                                 │
    └─► api/produtos.php (GET)                   │
    └─► api/categorias.php (GET)                 │
    └─► api/pedidos.php (POST)                   │
                                                 │
                           Asaas API ◄───────────┘
                           (PIX QR Code, cobranças)
                                │
                                ▼
                      api/webhook_asaas.php
                      (confirma pagamento → atualiza pedido → credita pontos)
```

---

## 8. Fluxo de Pagamento PIX

1. Aluno monta carrinho e clica "Finalizar"
2. `api/pedidos.php` cria o pedido no BD
3. `Asaas::criarCobranca()` gera cobrança PIX
4. `Asaas::obterQrCodePix()` retorna QR Code (base64)
5. Front exibe QR Code + código "copia e cola"
6. Aluno paga pelo app do banco
7. Asaas envia webhook → `api/webhook_asaas.php` atualiza status para `confirmado`
8. Front faz polling a cada 10s em `api/pedidos.php?action=verificar&id=X`
9. Ao confirmar pagamento → Rango Points são creditados automaticamente

---

## 9. Interligação Admin ↔ Totem ↔ App Aluno

**Categorias e Produtos criados pelo Admin aparecem automaticamente** no Totem e no App Aluno porque:

- O Admin faz `POST /api/categorias.php` → salva no BD
- O Totem e o App Aluno fazem `GET /api/categorias.php` + `GET /api/produtos.php` ao carregar
- Nenhum dado é hardcoded nos frontends — tudo vem do banco em tempo real

**Pedidos feitos pelo Totem ou App Aluno aparecem no KDS do Admin** porque:

- Ambos fazem `POST /api/pedidos.php`
- O KDS do Admin faz `GET /api/pedidos.php` e auto-atualiza a cada 30 segundos
- O Admin pode confirmar/cancelar/entregar direto do KDS

---

## 10. Variáveis de Ambiente (Produção)

Para não deixar credenciais no código, considere usar variáveis de ambiente via `.htaccess`:

```apache
# .htaccess na raiz
SetEnv DB_HOST "127.0.0.1"
SetEnv DB_PASS "senha_forte"
SetEnv ASAAS_KEY "$aact_..."
```

E em `config.php`:
```php
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('ASAAS_API_KEY', getenv('ASAAS_KEY') ?: '');
```

---

## 11. Segurança em Produção

- [ ] Ativar HTTPS (certificado SSL obrigatório para pagamentos)
- [ ] Alterar todas as senhas padrão
- [ ] Mudar `ASAAS_WEBHOOK_TOKEN` para algo aleatório (use `bin2hex(random_bytes(16))`)
- [ ] Remover `debug` dos erros do `config.php` (PDOException debug)
- [ ] Configurar `session.cookie_secure = true` no php.ini
- [ ] Criar usuário MySQL com permissões mínimas (não usar root)
- [ ] Adicionar rate limiting no `api/auth.php` (ex: fail2ban ou via PHP)

---

## Suporte / Manutenção

- Logs do webhook Asaas em: `api/_asaas_webhook.log`
- Para resetar o banco: importe `sql/rango.sql` novamente (DROP + CREATE)
- Para adicionar novo admin: `INSERT INTO usuarios (..., tipo) VALUES (..., 'admin')`
