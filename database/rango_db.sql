-- ============================================
-- RANGO — Sistema de Cantina Digital
-- Banco de dados MySQL para phpMyAdmin
-- ============================================
-- Para usar: importe este arquivo no phpMyAdmin
-- ou execute via terminal:
--    mysql -u root -p < rango.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS rango_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE rango_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS pedido_itens;
DROP TABLE IF EXISTS pagamentos;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS pontos_historico;
DROP TABLE IF EXISTS estoque_movimentos;
DROP TABLE IF EXISTS transacoes_financeiras;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS sessoes;
DROP TABLE IF EXISTS usuarios;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- USUÁRIOS
-- ============================================
CREATE TABLE usuarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(150) NOT NULL,
  email           VARCHAR(150) UNIQUE,
  matricula       VARCHAR(50) UNIQUE,
  cpf             VARCHAR(14) UNIQUE,
  telefone        VARCHAR(20),
  senha           VARCHAR(255) NOT NULL,
  tipo            ENUM('aluno','admin','atendente') NOT NULL DEFAULT 'aluno',
  saldo           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  rango_points    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pontos_ganhos   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  asaas_customer_id VARCHAR(100),
  ativo           TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_matricula (matricula),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB;

-- ============================================
-- CATEGORIAS
-- (criadas pelo admin → aparecem no totem e app aluno)
-- ============================================
CREATE TABLE categorias (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  icone       VARCHAR(20) DEFAULT '🍽️',
  ordem       INT NOT NULL DEFAULT 0,
  ativo       TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB;

-- ============================================
-- PRODUTOS
-- ============================================
CREATE TABLE produtos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id    INT,
  nome            VARCHAR(150) NOT NULL,
  descricao       TEXT,
  preco           DECIMAL(10,2) NOT NULL,
  custo           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estoque         INT NOT NULL DEFAULT 0,
  estoque_minimo  INT NOT NULL DEFAULT 10,
  emoji           VARCHAR(20) DEFAULT '🍽️',
  imagem          VARCHAR(500),
  ativo           TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  INDEX idx_categoria (categoria_id),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB;

-- ============================================
-- PEDIDOS
-- ============================================
CREATE TABLE pedidos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  codigo            VARCHAR(20) NOT NULL UNIQUE,
  usuario_id        INT,
  origem            ENUM('app','totem','balcao') NOT NULL DEFAULT 'app',
  cliente_nome      VARCHAR(150) NOT NULL,
  total             DECIMAL(10,2) NOT NULL,
  desconto          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status            ENUM('pendente','confirmado','preparando','pronto','entregue','cancelado')
                      NOT NULL DEFAULT 'pendente',
  forma_pagamento   ENUM('pix','cartao_credito','cartao_debito','dinheiro','saldo','tap') DEFAULT 'pix',
  asaas_payment_id  VARCHAR(100),
  asaas_status      VARCHAR(50),
  asaas_invoice_url VARCHAR(500),
  asaas_pix_qrcode  TEXT,
  asaas_pix_copypaste TEXT,
  observacoes       TEXT,
  pago_em           TIMESTAMP NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_usuario (usuario_id),
  INDEX idx_codigo (codigo),
  INDEX idx_asaas (asaas_payment_id)
) ENGINE=InnoDB;

-- ============================================
-- ITENS DO PEDIDO
-- ============================================
CREATE TABLE pedido_itens (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT NOT NULL,
  produto_id      INT,
  produto_nome    VARCHAR(150) NOT NULL,
  produto_emoji   VARCHAR(20),
  quantidade      INT NOT NULL,
  preco_unitario  DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL,
  INDEX idx_pedido (pedido_id)
) ENGINE=InnoDB;

-- ============================================
-- TRANSAÇÕES FINANCEIRAS (despesas, retiradas)
-- ============================================
CREATE TABLE transacoes_financeiras (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(200) NOT NULL,
  categoria   VARCHAR(80) NOT NULL,
  valor       DECIMAL(10,2) NOT NULL,
  tipo        ENUM('entrada','saida') NOT NULL,
  icone       VARCHAR(10) DEFAULT '💸',
  data        DATE NOT NULL,
  observacao  TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_data (data),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB;

-- ============================================
-- HISTÓRICO DE PONTOS (Rango Points)
-- ============================================
CREATE TABLE pontos_historico (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  tipo        ENUM('ganho','resgate') NOT NULL,
  descricao   VARCHAR(200) NOT NULL,
  pontos      DECIMAL(10,2) NOT NULL,
  pedido_id   INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE SET NULL,
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB;

-- ============================================
-- MOVIMENTOS DE ESTOQUE
-- ============================================
CREATE TABLE estoque_movimentos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  produto_id  INT NOT NULL,
  tipo        ENUM('entrada','saida','ajuste') NOT NULL,
  quantidade  INT NOT NULL,
  motivo      VARCHAR(200),
  pedido_id   INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE SET NULL,
  INDEX idx_produto (produto_id)
) ENGINE=InnoDB;

-- ============================================
-- SESSÕES (controle de login)
-- ============================================
CREATE TABLE sessoes (
  id          VARCHAR(128) PRIMARY KEY,
  usuario_id  INT NOT NULL,
  ip          VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================
-- DADOS DE EXEMPLO (SEED)
-- ============================================

-- Usuários — senhas são 'senha12345' (hash bcrypt válido)
-- Hash gerado com password_hash('senha12345', PASSWORD_BCRYPT)
INSERT INTO usuarios (nome, email, matricula, cpf, telefone, senha, tipo, saldo) VALUES
('Administrador',  'admin@rango.com',     'ADMIN001', '111.111.111-11', '(31) 99999-0000',
 '$2y$10$4DnfEmvjtDY0t7Y/.YrAEuingw7ccubWyr3OeZ6b.hMLYdzL3Ts9O', 'admin', 0.00),
('João da Silva',  'joao@aluno.senai.br', '12345',    '222.222.222-22', '(31) 98888-0000',
 '$2y$10$4DnfEmvjtDY0t7Y/.YrAEuingw7ccubWyr3OeZ6b.hMLYdzL3Ts9O', 'aluno', 50.00),
('Maria Souza',    'maria@aluno.senai.br','67890',    '333.333.333-33', '(31) 97777-0000',
 '$2y$10$4DnfEmvjtDY0t7Y/.YrAEuingw7ccubWyr3OeZ6b.hMLYdzL3Ts9O', 'aluno', 100.00),
('Atendente Lúcia','lucia@rango.com',     'AT001',    '444.444.444-44', '(31) 96666-0000',
 '$2y$10$4DnfEmvjtDY0t7Y/.YrAEuingw7ccubWyr3OeZ6b.hMLYdzL3Ts9O', 'atendente', 0.00);

-- Categorias iniciais
INSERT INTO categorias (nome, icone, ordem) VALUES
('Lanches',  '🍔', 1),
('Bebidas',  '🥤', 2),
('Doces',    '🍫', 3),
('Salgados', '🥐', 4),
('Combos',   '🍟', 5);

-- Produtos iniciais
INSERT INTO produtos (categoria_id, nome, descricao, preco, custo, estoque, estoque_minimo, emoji) VALUES
(1, 'X-Burguer',         'Pão, hambúrguer, queijo e alface', 12.50, 5.00, 50, 10, '🍔'),
(1, 'Hot Dog',           'Salsicha, catchup e mostarda',      8.00, 3.00, 40, 10, '🌭'),
(1, 'X-Bacon',           'Pão, hambúrguer, bacon, queijo',   14.50, 6.00, 30, 10, '🥓'),
(4, 'Coxinha de Frango', 'Frango com requeijão',              5.00, 2.00, 60, 15, '🍗'),
(4, 'Pão de Queijo',     'Quentinho e fresquinho',            3.50, 1.00, 80, 20, '🧀'),
(2, 'Suco de Laranja',   'Natural, 300ml',                    6.00, 2.00, 50, 15, '🍊'),
(2, 'Refrigerante Lata', 'Coca-Cola 350ml',                   5.50, 2.50, 60, 15, '🥤'),
(2, 'Água Mineral',      '500ml gelada',                      3.00, 1.00, 100,20, '💧'),
(3, 'Brownie',           'Chocolate belga',                   7.00, 2.50, 30, 10, '🍫'),
(3, 'Brigadeiro Gourmet','Caseiro, com granulado',            3.00, 1.00, 60, 15, '🍬'),
(5, 'Combo Especial',    'X-Burguer + Refri + Brownie',      20.00, 8.00, 25, 5,  '🎁'),
(5, 'Combo Duplo',       'Dois X-Burguer + 2 refris',        25.00,12.00, 20, 5,  '🍟');

-- Transações iniciais
INSERT INTO transacoes_financeiras (titulo, categoria, valor, tipo, icone, data) VALUES
('Compra de Insumos','Insumos',     380.00,'saida','🛒','2025-05-11'),
('Energia Elétrica', 'Energia/Água',210.50,'saida','⚡','2025-05-10'),
('Retirada Admin',   'Saque',       500.00,'saida','💸','2025-05-09'),
('Taxas de Cartão',  'Taxas',       155.10,'saida','🧾','2025-05-08');

-- ============================================
-- FIM
-- ============================================

-- ============================================
-- HORÁRIOS DE FUNCIONAMENTO
-- ============================================
CREATE TABLE IF NOT EXISTS horarios_funcionamento (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  turno     ENUM('manha','tarde','noite') NOT NULL UNIQUE,
  abertura  TIME NOT NULL DEFAULT '07:00:00',
  fechamento TIME NOT NULL DEFAULT '18:00:00',
  ativo     TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO horarios_funcionamento (turno, abertura, fechamento, ativo) VALUES
('manha','07:00:00','12:00:00',1),
('tarde','13:00:00','18:00:00',1),
('noite','19:00:00','22:00:00',1)
ON DUPLICATE KEY UPDATE turno=turno;

-- ============================================
-- CUPONS DE DESCONTO (Rango Points)
-- ============================================
CREATE TABLE IF NOT EXISTS cupons (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(20) NOT NULL UNIQUE,
  usuario_id  INT NOT NULL,
  tipo        ENUM('percentual','fixo') NOT NULL DEFAULT 'percentual',
  valor       DECIMAL(5,2) NOT NULL,
  descricao   VARCHAR(200) NOT NULL,
  pontos_custo INT NOT NULL,
  usado       TINYINT(1) NOT NULL DEFAULT 0,
  pedido_id   INT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE SET NULL,
  INDEX idx_usuario (usuario_id),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB;
