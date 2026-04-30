-- ============================================================================
--  GYMBROS — SCHEMA OFICIAL DO BANCO DE DADOS
--  Versão: 1.2.0
-- ============================================================================
-- SEÇÃO 01 — SETUP DO BANCO
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET time_zone = '-03:00';

USE b8lmugnwnoh7lvlufru1;


-- ============================================================================
-- SEÇÃO 02 — ADMINISTRAÇÃO E AUDITORIA
-- ============================================================================

-- ─── admin_user ─────────────────────────────────────────────────────────────
CREATE TABLE admin_user (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(120) NOT NULL,
  email           VARCHAR(120) NOT NULL UNIQUE,
  senha_hash      VARCHAR(255) NOT NULL,
  role            ENUM('owner','financeiro','suporte','operacional') NOT NULL DEFAULT 'suporte',
  ativo           TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_login    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_user_email (email)
) ENGINE=InnoDB COMMENT='Funcionários da GymBros com acesso ao painel admin';


-- ─── admin_log ──────────────────────────────────────────────────────────────
CREATE TABLE admin_log (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id        INT UNSIGNED NOT NULL,
  acao            VARCHAR(60)  NOT NULL,
  entidade        VARCHAR(40)  NOT NULL,
  entidade_id     INT UNSIGNED NULL,
  detalhes        JSON NULL,
  ip              VARCHAR(45) NULL,
  user_agent      VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_log_admin (admin_id),
  INDEX idx_admin_log_entidade (entidade, entidade_id),
  INDEX idx_admin_log_created (created_at),
  CONSTRAINT fk_admin_log_admin FOREIGN KEY (admin_id) REFERENCES admin_user(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Auditoria de ações de admins';


-- ─── app_config ─────────────────────────────────────────────────────────────
CREATE TABLE app_config (
  chave           VARCHAR(60) NOT NULL,
  valor           TEXT NOT NULL,
  descricao       VARCHAR(255) NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB COMMENT='Configurações editáveis sem redeploy';


-- ============================================================================
-- SEÇÃO 03 — USUÁRIOS E SEGURANÇA
-- ============================================================================

-- ─── user ───────────────────────────────────────────────────────────────────
-- CORREÇÕES v1.2.0:
--   + logradouro, numero, complemento, bairro  (campos ViaCEP separados)
--   + notification_interval_days               (intervalo do lembrete do aluno)
--   + last_imc_update                          (última vez que salvou o perfil IMC)
--   + last_avaliacao_update                    (última avaliação corporal por IA)
--   objetivo: VARCHAR(60) — o /imc-form envia strings livres como
--             'perder gordura', 'ganhar massa', etc. ENUM quebraria.
CREATE TABLE user (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome                      VARCHAR(120) NOT NULL,
  cpf                       CHAR(11) NOT NULL,
  email                     VARCHAR(120) NOT NULL,
  senha_hash                VARCHAR(255) NOT NULL,
  telefone                  VARCHAR(20) NULL,
  data_nascimento           DATE NULL,
  genero                    ENUM('masculino','feminino','outro','prefere_nao_dizer') NULL,

  -- Endereço (ViaCEP preenche tudo exceto numero e complemento)
  cep                       CHAR(8) NULL,
  logradouro                VARCHAR(255) NULL,
  numero                    VARCHAR(20) NULL,
  complemento               VARCHAR(100) NULL,
  bairro                    VARCHAR(80) NULL,
  cidade                    VARCHAR(80) NULL,
  estado                    CHAR(2) NULL,

  profile_photo             VARCHAR(500) NULL,

  -- Medidas básicas (espelho do último imc_profile — facilita queries)
  peso                      DECIMAL(5,2) NULL,
  altura                    DECIMAL(4,2) NULL,       -- metros, ex: 1.78
  imc                       DECIMAL(5,2) NULL,
  objetivo                  VARCHAR(60) NULL,        -- string livre do formulário

  gym_id                    INT UNSIGNED NULL,
  status                    ENUM('ativo','inativo','suspenso','deletado') NOT NULL DEFAULT 'ativo',
  email_verificado          TINYINT(1) NOT NULL DEFAULT 0,
  last_seen                 DATETIME NULL,

  -- Configuração de notificação de lembrete (feature PWA)
  notification_interval_days TINYINT UNSIGNED NOT NULL DEFAULT 7,
  last_imc_update           DATETIME NULL,
  last_avaliacao_update     DATETIME NULL,

  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_cpf (cpf),
  UNIQUE KEY uq_user_email (email),
  INDEX idx_user_status (status),
  INDEX idx_user_last_seen (last_seen)
) ENGINE=InnoDB COMMENT='Alunos da plataforma';


-- ─── password_reset ─────────────────────────────────────────────────────────
CREATE TABLE password_reset (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  expira_em       DATETIME NOT NULL,
  usado           TINYINT(1) NOT NULL DEFAULT 0,
  ip_solicitacao  VARCHAR(45) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_token (token_hash),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens de recuperação de senha';


-- ─── email_verification ─────────────────────────────────────────────────────
CREATE TABLE email_verification (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  expira_em       DATETIME NOT NULL,
  verificado_em   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email_verification_user (user_id),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens de verificação de email';


-- ─── login_attempt ──────────────────────────────────────────────────────────
CREATE TABLE login_attempt (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  identificador   VARCHAR(120) NOT NULL,
  ip              VARCHAR(45) NOT NULL,
  sucesso         TINYINT(1) NOT NULL,
  user_agent      VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_login_attempt_ip_time (ip, created_at),
  INDEX idx_login_attempt_id_time (identificador, created_at)
) ENGINE=InnoDB COMMENT='Histórico de tentativas de login (anti brute force)';


-- ============================================================================
-- SEÇÃO 04 — LGPD
-- ============================================================================

-- ─── lgpd_consent ───────────────────────────────────────────────────────────
CREATE TABLE lgpd_consent (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  finalidade      ENUM('termos_uso','marketing','foto_corporal','ia_treinador','compartilhamento_academia') NOT NULL,
  aceito          TINYINT(1) NOT NULL,
  versao_termo    VARCHAR(20) NOT NULL,
  ip              VARCHAR(45) NULL,
  user_agent      VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_lgpd_consent_user (user_id),
  INDEX idx_lgpd_consent_finalidade (user_id, finalidade),
  CONSTRAINT fk_lgpd_consent_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Consentimento LGPD granular por finalidade';


-- ─── data_export_request ────────────────────────────────────────────────────
CREATE TABLE data_export_request (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  status          ENUM('pendente','processando','pronto','enviado','erro') NOT NULL DEFAULT 'pendente',
  arquivo_path    VARCHAR(500) NULL,
  expira_em       DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em   DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_data_export_user (user_id),
  CONSTRAINT fk_data_export_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Pedidos de exportação de dados (LGPD Art. 18)';


-- ─── audit_log ──────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ator_tipo       ENUM('user','admin','sistema') NOT NULL,
  ator_id         INT UNSIGNED NULL,
  acao            VARCHAR(60) NOT NULL,
  entidade        VARCHAR(40) NOT NULL,
  entidade_id     INT UNSIGNED NULL,
  dados_antes     JSON NULL,
  dados_depois    JSON NULL,
  ip              VARCHAR(45) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_log_ator (ator_tipo, ator_id),
  INDEX idx_audit_log_entidade (entidade, entidade_id),
  INDEX idx_audit_log_created (created_at)
) ENGINE=InnoDB COMMENT='Auditoria geral de mudanças sensíveis';


-- ============================================================================
-- SEÇÃO 05 — ACADEMIAS
-- ============================================================================

-- ─── gym ────────────────────────────────────────────────────────────────────
CREATE TABLE gym (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(120) NOT NULL,
  cnpj            CHAR(14) NULL UNIQUE,
  descricao       TEXT NULL,
  endereco        VARCHAR(255) NOT NULL,
  numero          VARCHAR(20) NULL,
  bairro          VARCHAR(80) NULL,
  cidade          VARCHAR(80) NOT NULL,
  estado          CHAR(2) NOT NULL,
  cep             CHAR(9) NOT NULL,
  telefone        VARCHAR(20) NULL,
  email           VARCHAR(120) NULL,
  whatsapp        VARCHAR(20) NULL,
  latitude        DECIMAL(10,7) NULL,
  longitude       DECIMAL(10,7) NULL,
  foto_capa       VARCHAR(500) NULL,
  rating          DECIMAL(3,2) NULL,
  total_avaliacoes INT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('ativa','inativa','pendente') NOT NULL DEFAULT 'ativa',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_gym_cidade (cidade),
  INDEX idx_gym_status (status),
  INDEX idx_gym_geo (latitude, longitude)
) ENGINE=InnoDB COMMENT='Academias parceiras';

ALTER TABLE user
  ADD CONSTRAINT fk_user_gym FOREIGN KEY (gym_id) REFERENCES gym(id) ON DELETE SET NULL;


-- ─── amenity ────────────────────────────────────────────────────────────────
CREATE TABLE amenity (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(40) NOT NULL UNIQUE,
  nome            VARCHAR(80) NOT NULL,
  icone           VARCHAR(60) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB COMMENT='Catálogo de comodidades disponíveis';


-- ─── gym_amenity ────────────────────────────────────────────────────────────
CREATE TABLE gym_amenity (
  gym_id          INT UNSIGNED NOT NULL,
  amenity_id      INT UNSIGNED NOT NULL,
  PRIMARY KEY (gym_id, amenity_id),
  CONSTRAINT fk_gym_amenity_gym FOREIGN KEY (gym_id) REFERENCES gym(id) ON DELETE CASCADE,
  CONSTRAINT fk_gym_amenity_amenity FOREIGN KEY (amenity_id) REFERENCES amenity(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Comodidades de cada academia';


-- ─── gym_hour ───────────────────────────────────────────────────────────────
CREATE TABLE gym_hour (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  gym_id          INT UNSIGNED NOT NULL,
  dia_semana      TINYINT NOT NULL,
  abre            TIME NOT NULL,
  fecha           TIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gym_hour (gym_id, dia_semana),
  CONSTRAINT fk_gym_hour_gym FOREIGN KEY (gym_id) REFERENCES gym(id) ON DELETE CASCADE,
  CONSTRAINT chk_gym_hour_dia CHECK (dia_semana BETWEEN 0 AND 6)
) ENGINE=InnoDB COMMENT='Horário de funcionamento por dia da semana';


-- ─── gym_photo ──────────────────────────────────────────────────────────────
CREATE TABLE gym_photo (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  gym_id          INT UNSIGNED NOT NULL,
  url             VARCHAR(500) NOT NULL,
  legenda         VARCHAR(255) NULL,
  ordem           SMALLINT NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_gym_photo_gym (gym_id, ordem),
  CONSTRAINT fk_gym_photo_gym FOREIGN KEY (gym_id) REFERENCES gym(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Galeria de fotos da academia';


-- ─── favorite_gym ───────────────────────────────────────────────────────────
CREATE TABLE favorite_gym (
  user_id         INT UNSIGNED NOT NULL,
  gym_id          INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, gym_id),
  CONSTRAINT fk_favorite_gym_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorite_gym_gym  FOREIGN KEY (gym_id)  REFERENCES gym(id)  ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Academias favoritas do usuário';


-- ============================================================================
-- SEÇÃO 06 — PLANOS E CUPONS
-- ============================================================================

-- ─── plan ───────────────────────────────────────────────────────────────────
-- ATENÇÃO: os IDs gerados serão 1, 2, 3 (auto_increment).
-- O código requirePlanLevel.js usa 'pl001','pl002','pl003' — precisará ser
-- atualizado para comparar planoSlug ('starter','gymbro','black') em vez de planoId.
CREATE TABLE plan (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(40) NOT NULL UNIQUE,    -- chave de negócio usada no código
  nome            VARCHAR(80) NOT NULL,
  descricao       TEXT NULL,
  preco           DECIMAL(8,2) NOT NULL,
  duracao_dias    SMALLINT NOT NULL DEFAULT 30,
  beneficios      JSON NULL,
  permite_ia      TINYINT(1) NOT NULL DEFAULT 0,
  permite_avaliacao_corporal TINYINT(1) NOT NULL DEFAULT 0,
  ordem           SMALLINT NOT NULL DEFAULT 0,
  status          ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB COMMENT='Planos de assinatura';


-- ─── coupon ─────────────────────────────────────────────────────────────────
CREATE TABLE coupon (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(40) NOT NULL UNIQUE,
  descricao       VARCHAR(255) NULL,
  tipo_desconto   ENUM('percentual','fixo') NOT NULL,
  valor_desconto  DECIMAL(8,2) NOT NULL,
  plan_id         INT UNSIGNED NULL,
  uso_maximo      INT UNSIGNED NULL,
  uso_atual       INT UNSIGNED NOT NULL DEFAULT 0,
  valido_de       DATETIME NULL,
  valido_ate      DATETIME NULL,
  status          ENUM('ativo','inativo','expirado') NOT NULL DEFAULT 'ativo',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_coupon_codigo (codigo),
  CONSTRAINT fk_coupon_plan FOREIGN KEY (plan_id) REFERENCES plan(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Cupons de desconto';


-- ─── coupon_use ─────────────────────────────────────────────────────────────
CREATE TABLE coupon_use (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  coupon_id       INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  payment_id      INT UNSIGNED NULL,
  desconto_aplicado DECIMAL(8,2) NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupon_use (coupon_id, user_id),
  CONSTRAINT fk_coupon_use_coupon FOREIGN KEY (coupon_id) REFERENCES coupon(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_use_user   FOREIGN KEY (user_id)   REFERENCES user(id)   ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Histórico de uso de cupons';


-- ============================================================================
-- SEÇÃO 07 — ASSINATURAS E PAGAMENTOS
-- ============================================================================

-- ─── user_plan ──────────────────────────────────────────────────────────────
CREATE TABLE user_plan (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  plan_id         INT UNSIGNED NOT NULL,
  status          ENUM('ativo','pendente','expirado','cancelado') NOT NULL DEFAULT 'pendente',
  data_inicio     DATE NULL,
  data_fim        DATE NULL,
  renovacao_auto  TINYINT(1) NOT NULL DEFAULT 0,
  cancelado_em    DATETIME NULL,
  motivo_cancelamento TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_plan_user (user_id, status),
  INDEX idx_user_plan_data_fim (data_fim),
  CONSTRAINT fk_user_plan_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_plan_plan FOREIGN KEY (plan_id) REFERENCES plan(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Assinaturas dos usuários (histórico completo)';


-- ─── payment_method ─────────────────────────────────────────────────────────
CREATE TABLE payment_method (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  tipo            ENUM('cartao','pix','boleto') NOT NULL,
  apelido         VARCHAR(60) NULL,
  cartao_final    CHAR(4) NULL,
  cartao_bandeira VARCHAR(20) NULL,
  cartao_validade VARCHAR(7) NULL,
  gateway_token   VARCHAR(255) NULL,
  padrao          TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_payment_method_user (user_id),
  CONSTRAINT fk_payment_method_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Métodos de pagamento salvos (tokenizados)';


-- ─── payment ────────────────────────────────────────────────────────────────
CREATE TABLE payment (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  user_plan_id      INT UNSIGNED NULL,
  plan_id           INT UNSIGNED NOT NULL,
  payment_method_id INT UNSIGNED NULL,
  coupon_id         INT UNSIGNED NULL,
  valor_bruto       DECIMAL(8,2) NOT NULL,
  desconto          DECIMAL(8,2) NOT NULL DEFAULT 0,
  valor_final       DECIMAL(8,2) NOT NULL,
  metodo            ENUM('cartao','pix','boleto') NOT NULL,
  parcelas          TINYINT NOT NULL DEFAULT 1,
  status            ENUM('pago','pendente','cancelado','estornado','falhou') NOT NULL DEFAULT 'pendente',
  dias_atraso       SMALLINT NOT NULL DEFAULT 0,
  cartao_final      CHAR(4) NULL,
  cartao_bandeira   VARCHAR(20) NULL,
  pix_txid          VARCHAR(100) NULL,
  pix_qr_code       TEXT NULL,
  boleto_codigo     VARCHAR(60) NULL,
  boleto_pdf_path   VARCHAR(500) NULL,
  boleto_vencimento DATE NULL,
  gateway_id        VARCHAR(120) NULL,
  data_pagamento    DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_payment_user (user_id),
  INDEX idx_payment_status (status),
  INDEX idx_payment_data_pag (data_pagamento),
  CONSTRAINT fk_payment_user     FOREIGN KEY (user_id)           REFERENCES user(id)           ON DELETE RESTRICT,
  CONSTRAINT fk_payment_plan     FOREIGN KEY (plan_id)           REFERENCES plan(id)           ON DELETE RESTRICT,
  CONSTRAINT fk_payment_user_plan FOREIGN KEY (user_plan_id)     REFERENCES user_plan(id)      ON DELETE SET NULL,
  CONSTRAINT fk_payment_pm       FOREIGN KEY (payment_method_id) REFERENCES payment_method(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_coupon   FOREIGN KEY (coupon_id)         REFERENCES coupon(id)         ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Pagamentos (transaction é palavra reservada MySQL)';


-- ─── refund ─────────────────────────────────────────────────────────────────
CREATE TABLE refund (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id      INT UNSIGNED NOT NULL,
  admin_id        INT UNSIGNED NOT NULL,
  valor           DECIMAL(8,2) NOT NULL,
  motivo          TEXT NOT NULL,
  status          ENUM('solicitado','processando','concluido','recusado') NOT NULL DEFAULT 'solicitado',
  gateway_id      VARCHAR(120) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluido_em    DATETIME NULL,
  PRIMARY KEY (id),
  INDEX idx_refund_payment (payment_id),
  CONSTRAINT fk_refund_payment FOREIGN KEY (payment_id) REFERENCES payment(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_refund_admin   FOREIGN KEY (admin_id)   REFERENCES admin_user(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Estornos de transações';


-- ============================================================================
-- SEÇÃO 08 — CHECK-INS
-- ============================================================================

-- ─── checkin ────────────────────────────────────────────────────────────────
CREATE TABLE checkin (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  gym_id          INT UNSIGNED NOT NULL,
  data            DATE NOT NULL,
  hora            TIME NOT NULL,
  dia_semana      TINYINT NOT NULL,
  duracao_minutos SMALLINT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkin_dia (user_id, gym_id, data),
  INDEX idx_checkin_user_data (user_id, data),
  INDEX idx_checkin_gym_data  (gym_id, data),
  CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_gym  FOREIGN KEY (gym_id)  REFERENCES gym(id)  ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Check-ins dos alunos nas academias';


-- ============================================================================
-- SEÇÃO 09 — TREINOS
-- ============================================================================

-- ─── exercise ───────────────────────────────────────────────────────────────
CREATE TABLE exercise (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome            VARCHAR(120) NOT NULL,
  grupo_muscular  VARCHAR(60) NOT NULL,
  equipamento     VARCHAR(80) NULL,
  descricao       TEXT NULL,
  video_url       VARCHAR(500) NULL,
  imagem_url      VARCHAR(500) NULL,
  dificuldade     ENUM('iniciante','intermediario','avancado') NOT NULL DEFAULT 'intermediario',
  PRIMARY KEY (id),
  INDEX idx_exercise_grupo (grupo_muscular)
) ENGINE=InnoDB COMMENT='Catálogo global de exercícios';


-- ─── workout ────────────────────────────────────────────────────────────────
CREATE TABLE workout (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  nome            VARCHAR(120) NOT NULL,
  descricao       TEXT NULL,
  tipo            ENUM('A','B','C','D','E','F','personalizado') NOT NULL DEFAULT 'personalizado',
  dia_semana      TINYINT NULL,
  ativo           TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_workout_user (user_id, ativo),
  CONSTRAINT fk_workout_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Treinos personalizados dos usuários';


-- ─── workout_exercise ───────────────────────────────────────────────────────
CREATE TABLE workout_exercise (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_id      INT UNSIGNED NOT NULL,
  exercise_id     INT UNSIGNED NOT NULL,
  ordem           TINYINT NOT NULL DEFAULT 1,
  series          TINYINT NOT NULL DEFAULT 3,
  repeticoes      VARCHAR(20) NOT NULL DEFAULT '10',
  carga_kg        DECIMAL(5,2) NULL,
  descanso_seg    SMALLINT NOT NULL DEFAULT 60,
  observacao      VARCHAR(255) NULL,
  PRIMARY KEY (id),
  INDEX idx_workout_exercise_workout (workout_id, ordem),
  CONSTRAINT fk_workout_exercise_workout  FOREIGN KEY (workout_id)  REFERENCES workout(id)  ON DELETE CASCADE,
  CONSTRAINT fk_workout_exercise_exercise FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Exercícios que compõem um treino';


-- ─── workout_log ────────────────────────────────────────────────────────────
CREATE TABLE workout_log (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  workout_id      INT UNSIGNED NULL,
  data            DATE NOT NULL,
  duracao_minutos SMALLINT NULL,
  calorias        SMALLINT NULL,
  observacao      TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_workout_log_user_data (user_id, data),
  CONSTRAINT fk_workout_log_user    FOREIGN KEY (user_id)   REFERENCES user(id)    ON DELETE CASCADE,
  CONSTRAINT fk_workout_log_workout FOREIGN KEY (workout_id) REFERENCES workout(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Sessões de treino executadas';


-- ─── workout_log_exercise ───────────────────────────────────────────────────
CREATE TABLE workout_log_exercise (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_log_id    INT UNSIGNED NOT NULL,
  exercise_id       INT UNSIGNED NOT NULL,
  series_feitas     TINYINT NOT NULL,
  repeticoes_feitas VARCHAR(40) NOT NULL,
  carga_kg          DECIMAL(5,2) NULL,
  PRIMARY KEY (id),
  INDEX idx_workout_log_exercise_log (workout_log_id),
  CONSTRAINT fk_wle_log      FOREIGN KEY (workout_log_id) REFERENCES workout_log(id) ON DELETE CASCADE,
  CONSTRAINT fk_wle_exercise FOREIGN KEY (exercise_id)    REFERENCES exercise(id)    ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Exercícios feitos em cada sessão';


-- ─── measurement ────────────────────────────────────────────────────────────
CREATE TABLE measurement (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  data            DATE NOT NULL,
  peso            DECIMAL(5,2) NULL,
  altura          DECIMAL(4,2) NULL,
  imc             DECIMAL(5,2) NULL,
  cintura_cm      DECIMAL(5,2) NULL,
  quadril_cm      DECIMAL(5,2) NULL,
  braco_cm        DECIMAL(5,2) NULL,
  coxa_cm         DECIMAL(5,2) NULL,
  peito_cm        DECIMAL(5,2) NULL,
  gordura_pct     DECIMAL(5,2) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_measurement_user_data (user_id, data),
  CONSTRAINT fk_measurement_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Histórico de medidas corporais';


-- ─── imc_profile ────────────────────────────────────────────────────────────
-- NOVA TABELA v1.2.0
-- Persiste o questionário completo do /imc-form.
-- O formulário coleta ~15 campos que não cabem em user nem em measurement.
-- Sempre INSERIR (nunca UPDATE) pra manter histórico — igual ao measurement.
-- A aplicação carrega sempre o mais recente (ORDER BY id DESC LIMIT 1).
CREATE TABLE imc_profile (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                 INT UNSIGNED NOT NULL,

  -- Dados físicos
  peso                    DECIMAL(5,2) NULL,          -- kg
  altura                  DECIMAL(5,2) NULL,           -- cm (formulário usa cm, não metros)
  imc_valor               DECIMAL(5,2) NULL,           -- calculado pela aplicação
  idade                   TINYINT UNSIGNED NULL,
  sexo                    ENUM('masculino','feminino') NULL,
  objetivo                VARCHAR(60) NULL,            -- 'perder gordura', 'ganhar massa', etc.

  -- Treino
  experiencia             VARCHAR(40) NULL,            -- 'iniciante', 'intermediário', 'avançado'
  dias_semana             TINYINT UNSIGNED NULL,       -- 1..7
  tempo_por_sessao        SMALLINT UNSIGNED NULL,      -- minutos: 30, 45, 60, 90, 120
  local_treino            VARCHAR(40) NULL,            -- 'academia', 'casa', 'ambos'

  -- Saúde
  lesoes                  JSON NULL,                   -- array: ['joelho','coluna',...]
  lesoes_outros           VARCHAR(255) NULL,           -- texto livre se marcou 'outros'
  acompanhamento_medico   ENUM('sim','nao') NULL,

  -- Alimentação
  restricoes_alimentares  JSON NULL,                   -- array: ['vegetariano','sem glúten',...]
  grupos_alimentares      JSON NULL,                   -- array (se existir no form)
  suplementacao           JSON NULL,                   -- array
  hidratacao              VARCHAR(40) NULL,
  seletividade            ENUM('sim','nao') NULL,
  alimentos_seletividade  VARCHAR(255) NULL,           -- texto livre

  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_imc_profile_user (user_id, id),           -- user + recente
  CONSTRAINT fk_imc_profile_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Perfil IMC detalhado do aluno — questionário do /imc-form';


-- ============================================================================
-- SEÇÃO 10 — IA E AVALIAÇÃO CORPORAL
-- ============================================================================

-- ─── body_photo ─────────────────────────────────────────────────────────────
-- CORREÇÕES v1.2.0: adicionadas colunas do resultado JSON da IA
-- (antes só tinha % de gordura por região; agora persiste tudo que o Groq retorna)
CREATE TABLE body_photo (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                 INT UNSIGNED NOT NULL,
  foto_path               VARCHAR(500) NOT NULL,
  consent_given           TINYINT(1) NOT NULL DEFAULT 0,
  consent_at              DATETIME NULL,

  -- Gordura por região (extraída do JSON para facilitar queries/relatórios)
  gordura_total           DECIMAL(5,2) NULL,
  gordura_tronco          DECIMAL(5,2) NULL,
  gordura_braco           DECIMAL(5,2) NULL,
  gordura_perna           DECIMAL(5,2) NULL,
  margem_erro             DECIMAL(4,2) NULL,

  -- Campos do resultado IA (novos v1.2.0)
  classificacao_imc_visual VARCHAR(100) NULL,          -- ex: 'Peso normal com gordura localizada'
  massa_muscular_aparente  ENUM('baixa','moderada','alta') NULL,
  regiao_predominante      VARCHAR(40) NULL,           -- 'abdominal','membros','uniforme'
  pontos_positivos         JSON NULL,                  -- array de strings
  areas_melhoria           JSON NULL,                  -- array de strings
  recomendacoes            JSON NULL,                  -- { treino: '...', nutricao: '...' }

  analise_raw              TEXT NULL,                  -- resposta crua completa do modelo
  modelo_ia                VARCHAR(60) NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_body_photo_user (user_id),
  CONSTRAINT fk_body_photo_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Fotos para avaliação corporal por IA (LGPD)';


-- ─── ai_session ─────────────────────────────────────────────────────────────
CREATE TABLE ai_session (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  context_snapshot  JSON NOT NULL,
  total_mensagens   SMALLINT NOT NULL DEFAULT 0,
  total_tokens      INT UNSIGNED NOT NULL DEFAULT 0,
  ativa             TINYINT(1) NOT NULL DEFAULT 1,
  modelo            VARCHAR(60) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ai_session_user (user_id, ativa),
  CONSTRAINT fk_ai_session_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Sessões de chat com IA treinadora';


-- ─── ai_message ─────────────────────────────────────────────────────────────
CREATE TABLE ai_message (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id      INT UNSIGNED NOT NULL,
  role            ENUM('user','assistant','system') NOT NULL,
  content         TEXT NOT NULL,
  tokens          SMALLINT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ai_message_session (session_id),
  CONSTRAINT fk_ai_message_session FOREIGN KEY (session_id) REFERENCES ai_session(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Mensagens individuais das sessões de IA';


-- ============================================================================
-- SEÇÃO 11 — SUPORTE
-- ============================================================================

-- ─── support_ticket ─────────────────────────────────────────────────────────
-- CORREÇÃO v1.2.0: 'normal' adicionado ao ENUM prioridade
-- (suporte.js usa prioridade: 'normal' como default)
CREATE TABLE support_ticket (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  admin_id        INT UNSIGNED NULL,
  assunto         VARCHAR(200) NOT NULL,
  tipo            VARCHAR(60) NOT NULL,
  status          ENUM('aberto','em_atendimento','resolvido','fechado') NOT NULL DEFAULT 'aberto',
  prioridade      ENUM('baixa','normal','media','alta','urgente') NOT NULL DEFAULT 'normal',
  resolvido_em    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_support_ticket_user (user_id),
  INDEX idx_support_ticket_status (status, prioridade),
  CONSTRAINT fk_support_ticket_user  FOREIGN KEY (user_id)  REFERENCES user(id)       ON DELETE CASCADE,
  CONSTRAINT fk_support_ticket_admin FOREIGN KEY (admin_id) REFERENCES admin_user(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Tickets de suporte';


-- ─── support_message ────────────────────────────────────────────────────────
CREATE TABLE support_message (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id       INT UNSIGNED NOT NULL,
  remetente       ENUM('usuario','admin','sistema') NOT NULL,
  admin_id        INT UNSIGNED NULL,
  texto           TEXT NOT NULL,
  anexo_url       VARCHAR(500) NULL,
  lida            TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_support_message_ticket (ticket_id),
  CONSTRAINT fk_support_message_ticket FOREIGN KEY (ticket_id) REFERENCES support_ticket(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_message_admin  FOREIGN KEY (admin_id)  REFERENCES admin_user(id)     ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Mensagens dentro de tickets de suporte';


-- ============================================================================
-- SEÇÃO 12 — NOTIFICAÇÕES E PUSH
-- ============================================================================

-- ─── notification ───────────────────────────────────────────────────────────
CREATE TABLE notification (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo          VARCHAR(200) NOT NULL,
  mensagem        TEXT NOT NULL,
  tipo            ENUM('informativo','promocao','alerta','compra','sistema') NOT NULL DEFAULT 'informativo',
  destinatarios   VARCHAR(20) NOT NULL DEFAULT 'todos',
  link            VARCHAR(500) NULL,
  enviada_por     INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_notification_created (created_at),
  CONSTRAINT fk_notification_admin FOREIGN KEY (enviada_por) REFERENCES admin_user(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Notificações enviadas pelo admin';


-- ─── notification_read ──────────────────────────────────────────────────────
CREATE TABLE notification_read (
  notification_id INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  lida_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_notification_read_n FOREIGN KEY (notification_id) REFERENCES notification(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_read_u FOREIGN KEY (user_id)         REFERENCES user(id)         ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Marcações de leitura de notificação';


-- ─── device_token ───────────────────────────────────────────────────────────
CREATE TABLE device_token (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  token           VARCHAR(500) NOT NULL,
  plataforma      ENUM('web','ios','android') NOT NULL,
  ativo           TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_uso      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_device_token (token),
  INDEX idx_device_token_user (user_id, ativo),
  CONSTRAINT fk_device_token_user FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens de dispositivo para push notification';


-- ============================================================================
-- SEÇÃO 13 — VIEWS
-- ============================================================================

-- Usuários com plano ativo
CREATE OR REPLACE VIEW vw_usuarios_plano_ativo AS
SELECT
  u.id, u.nome, u.email, u.cpf, u.status, u.last_seen,
  p.nome  AS plano_nome,
  p.slug  AS plano_slug,
  p.preco AS plano_preco,
  up.data_inicio, up.data_fim,
  up.status AS assinatura_status,
  g.nome  AS academia_nome
FROM user u
LEFT JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
LEFT JOIN plan p ON p.id = up.plan_id
LEFT JOIN gym  g ON g.id = u.gym_id;


-- Receita mensal
CREATE OR REPLACE VIEW vw_receita_mensal AS
SELECT
  DATE_FORMAT(data_pagamento, '%Y-%m') AS mes,
  COUNT(*) AS total_transacoes,
  SUM(valor_final) AS receita_total,
  SUM(CASE WHEN metodo='cartao' THEN valor_final ELSE 0 END) AS receita_cartao,
  SUM(CASE WHEN metodo='pix'    THEN valor_final ELSE 0 END) AS receita_pix,
  SUM(CASE WHEN metodo='boleto' THEN valor_final ELSE 0 END) AS receita_boleto
FROM payment
WHERE status = 'pago'
GROUP BY DATE_FORMAT(data_pagamento, '%Y-%m')
ORDER BY mes DESC;


-- Inadimplentes
CREATE OR REPLACE VIEW vw_inadimplentes AS
SELECT
  u.id, u.nome, u.email, u.telefone,
  t.valor_final, t.dias_atraso, t.metodo,
  t.created_at AS data_vencimento
FROM payment t
JOIN user u ON u.id = t.user_id
WHERE t.status = 'pendente' AND t.dias_atraso > 0
ORDER BY t.dias_atraso DESC;


-- Tickets abertos com não-lidas
CREATE OR REPLACE VIEW vw_tickets_abertos AS
SELECT
  st.id, st.assunto, st.tipo, st.status, st.prioridade, st.created_at,
  u.nome  AS usuario_nome,
  u.email AS usuario_email,
  p.nome  AS usuario_plano,
  (
    SELECT COUNT(*) FROM support_message sm
    WHERE sm.ticket_id = st.id AND sm.lida = 0 AND sm.remetente = 'usuario'
  ) AS mensagens_nao_lidas
FROM support_ticket st
JOIN user u ON u.id = st.user_id
LEFT JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
LEFT JOIN plan p ON p.id = up.plan_id
WHERE st.status NOT IN ('resolvido','fechado')
ORDER BY FIELD(st.prioridade,'urgente','alta','media','normal','baixa'), st.created_at ASC;


-- Frequência últimos 30 dias
CREATE OR REPLACE VIEW vw_frequencia_30d AS
SELECT
  u.id AS user_id, u.nome,
  COUNT(c.id) AS total_checkins,
  MAX(c.data) AS ultimo_checkin,
  ROUND(COUNT(c.id) / 30.0 * 7, 1) AS media_semanal
FROM user u
LEFT JOIN checkin c ON c.user_id = u.id AND c.data >= CURDATE() - INTERVAL 30 DAY
WHERE u.status = 'ativo'
GROUP BY u.id, u.nome;


-- ============================================================================
-- SEÇÃO 14 — STORED PROCEDURES
-- ============================================================================

DELIMITER $$

-- Ativa plano após pagamento confirmado
CREATE PROCEDURE sp_ativar_plano(
  IN p_user_id    INT UNSIGNED,
  IN p_plan_id    INT UNSIGNED,
  IN p_payment_id INT UNSIGNED
)
BEGIN
  DECLARE v_duracao INT;
  DECLARE v_up_id   INT UNSIGNED;

  SELECT duracao_dias INTO v_duracao FROM plan WHERE id = p_plan_id;

  UPDATE user_plan
    SET status = 'expirado'
    WHERE user_id = p_user_id AND status = 'ativo';

  INSERT INTO user_plan (user_id, plan_id, status, data_inicio, data_fim)
  VALUES (p_user_id, p_plan_id, 'ativo', CURDATE(), CURDATE() + INTERVAL v_duracao DAY);

  SET v_up_id = LAST_INSERT_ID();

  UPDATE payment
    SET user_plan_id = v_up_id, status = 'pago', data_pagamento = NOW()
    WHERE id = p_payment_id;

  SELECT v_up_id AS user_plan_id;
END$$


-- Contexto IA do usuário (usado antes de chamar o Groq)
CREATE PROCEDURE sp_contexto_ia(IN p_user_id INT UNSIGNED)
BEGIN
  SELECT
    u.nome, u.peso, u.altura, u.imc, u.objetivo, u.data_nascimento,
    p.nome AS plano, p.slug AS plano_slug,
    g.nome AS academia,
    (SELECT COUNT(*) FROM checkin ci
     WHERE ci.user_id = u.id AND ci.data >= CURDATE() - INTERVAL 30 DAY
    ) AS checkins_mes,
    (SELECT MAX(data) FROM checkin ci WHERE ci.user_id = u.id) AS ultimo_checkin,
    (SELECT COUNT(*) FROM workout_log wl
     WHERE wl.user_id = u.id AND wl.data >= CURDATE() - INTERVAL 30 DAY
    ) AS treinos_mes
  FROM user u
  LEFT JOIN user_plan up ON up.user_id = u.id AND up.status = 'ativo'
  LEFT JOIN plan p ON p.id = up.plan_id
  LEFT JOIN gym  g ON g.id = u.gym_id
  WHERE u.id = p_user_id;
END$$


-- Atualiza dias de atraso (rodar como cron diário)
CREATE PROCEDURE sp_atualizar_inadimplencia()
BEGIN
  UPDATE payment
    SET dias_atraso = DATEDIFF(CURDATE(), DATE(created_at))
    WHERE status = 'pendente' AND DATEDIFF(CURDATE(), DATE(created_at)) > 0;
END$$


-- Academias próximas — Haversine
CREATE PROCEDURE sp_academias_proximas(
  IN p_lat     DECIMAL(10,7),
  IN p_lng     DECIMAL(10,7),
  IN p_raio_km DECIMAL(6,2)
)
BEGIN
  SELECT
    g.*,
    (6371 * ACOS(
      COS(RADIANS(p_lat)) * COS(RADIANS(g.latitude)) *
      COS(RADIANS(g.longitude) - RADIANS(p_lng)) +
      SIN(RADIANS(p_lat)) * SIN(RADIANS(g.latitude))
    )) AS distancia_km
  FROM gym g
  WHERE g.status = 'ativa'
    AND g.latitude  IS NOT NULL
    AND g.longitude IS NOT NULL
  HAVING distancia_km <= p_raio_km
  ORDER BY distancia_km ASC;
END$$

DELIMITER ;


-- ============================================================================
-- SEÇÃO 15 — SEEDS
-- ============================================================================

-- Configurações
INSERT INTO app_config (chave, valor, descricao) VALUES
  ('site_nome',        'GymBros',                    'Nome exibido no site'),
  ('site_versao',      '1.0.0',                      'Versão atual'),
  ('manutencao',       '0',                          '1 = site em manutenção'),
  ('email_suporte',    'suporte@gymbros.app.br',     'Email exibido no rodapé'),
  ('whatsapp_suporte', '5511999999999',               'WhatsApp do suporte');


-- Admin (senha: admin123 — TROCAR antes de ir a produção)
-- Hash bcrypt cost 10 de "admin123":
INSERT INTO admin_user (nome, email, senha_hash, role) VALUES
  ('Davi (Owner)', 'admin@gymbros.app.br', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'owner');


-- Planos
-- CORREÇÃO v1.2.0: 'free' renomeado para 'starter' (slug usado no código).
-- Preços alinhados com PLANOS_PAGAMENTO em router.js.
-- IDs gerados: starter=1, gymbro=2, black=3.
-- ATENÇÃO: requirePlanLevel.js deve ser atualizado para checar planoSlug
--          em vez de planoId ('pl002'/'pl003' → 'gymbro'/'black').
INSERT INTO plan (slug, nome, descricao, preco, duracao_dias, beneficios, permite_ia, permite_avaliacao_corporal, ordem) VALUES
  ('starter', 'Starter', 'Acesso básico à plataforma',
   64.90, 30,
   JSON_ARRAY('2300+ academias e estúdios','Treinos online e presenciais','App GymBros','Suporte 24h'),
   0, 0, 1),
  ('gymbro', 'GymBro', 'Plano intermediário com IA treinadora',
   85.60, 30,
   JSON_ARRAY('3560+ academias e estúdios','Treinos online ao vivo','Leve 4 amigos por mês','Personal trainer IA'),
   1, 0, 2),
  ('black', 'Black', 'Plano completo com avaliação corporal por IA',
   145.90, 30,
   JSON_ARRAY('5000+ academias e estúdios','Treinos online ao vivo','Leve amigos ilimitado','Personal trainer exclusivo','Avaliação corporal IA','Área VIP'),
   1, 1, 3);


-- Comodidades
INSERT INTO amenity (slug, nome, icone) VALUES
  ('estacionamento',  'Estacionamento',  'car'),
  ('vestiario',       'Vestiário',       'shirt'),
  ('chuveiro',        'Chuveiros',       'droplets'),
  ('ar_condicionado', 'Ar-condicionado', 'wind'),
  ('piscina',         'Piscina',         'waves'),
  ('sauna',           'Sauna',           'thermometer'),
  ('musculacao',      'Musculação',      'dumbbell'),
  ('crossfit',        'CrossFit',        'flame'),
  ('cardio',          'Cardio',          'heart-pulse'),
  ('lutas',           'Artes Marciais',  'swords'),
  ('yoga',            'Yoga / Pilates',  'flower'),
  ('wifi',            'Wi-Fi grátis',    'wifi');


-- Academias (Barueri/SP)
INSERT INTO gym (nome, endereco, numero, bairro, cidade, estado, cep, telefone, latitude, longitude, status) VALUES
  ('Smart Fit Barueri Centro', 'Av. Henrique Gianetti',  '100',  'Centro',        'Barueri', 'SP', '06401-000', '1144441111', -23.5106, -46.8762, 'ativa'),
  ('Bio Ritmo Alphaville',     'Al. Rio Negro',          '585',  'Alphaville',    'Barueri', 'SP', '06454-000', '1144442222', -23.5085, -46.8536, 'ativa'),
  ('Bluefit Tamboré',          'Av. Piracema',           '350',  'Tamboré',       'Barueri', 'SP', '06460-030', '1144443333', -23.5028, -46.8401, 'ativa'),
  ('Academia Corpo & Mente',   'R. Campos Sales',        '220',  'Jardim Belval', 'Barueri', 'SP', '06402-020', '1144444444', -23.5167, -46.8825, 'ativa'),
  ('Iron Box Crossfit',        'Av. Andrômeda',          '1500', 'Alphaville',    'Barueri', 'SP', '06473-000', '1144445555', -23.4998, -46.8489, 'ativa');


-- Horários das academias (seg-sex 6h-22h, sáb 8h-18h, dom 8h-14h)
INSERT INTO gym_hour (gym_id, dia_semana, abre, fecha)
SELECT g.id, d.dia, d.abre, d.fecha
FROM gym g
CROSS JOIN (
  SELECT 1 AS dia, '06:00' AS abre, '22:00' AS fecha UNION ALL
  SELECT 2, '06:00', '22:00' UNION ALL
  SELECT 3, '06:00', '22:00' UNION ALL
  SELECT 4, '06:00', '22:00' UNION ALL
  SELECT 5, '06:00', '22:00' UNION ALL
  SELECT 6, '08:00', '18:00' UNION ALL
  SELECT 0, '08:00', '14:00'
) d;


-- Comodidades básicas em todas as academias
INSERT INTO gym_amenity (gym_id, amenity_id)
SELECT g.id, a.id
FROM gym g
CROSS JOIN amenity a
WHERE a.slug IN ('estacionamento','vestiario','chuveiro','ar_condicionado','musculacao','cardio','wifi');


-- Exercícios base
INSERT INTO exercise (nome, grupo_muscular, equipamento, dificuldade) VALUES
  ('Supino reto com barra',         'Peito',   'Barra',         'intermediario'),
  ('Supino inclinado com halteres', 'Peito',   'Halteres',      'intermediario'),
  ('Crucifixo',                     'Peito',   'Halteres',      'iniciante'),
  ('Puxada frente',                 'Costas',  'Polia',         'iniciante'),
  ('Remada curvada',                'Costas',  'Barra',         'intermediario'),
  ('Levantamento terra',            'Costas',  'Barra',         'avancado'),
  ('Agachamento livre',             'Pernas',  'Barra',         'avancado'),
  ('Leg press 45°',                 'Pernas',  'Máquina',       'iniciante'),
  ('Cadeira extensora',             'Pernas',  'Máquina',       'iniciante'),
  ('Mesa flexora',                  'Pernas',  'Máquina',       'iniciante'),
  ('Desenvolvimento militar',       'Ombros',  'Barra',         'intermediario'),
  ('Elevação lateral',              'Ombros',  'Halteres',      'iniciante'),
  ('Rosca direta',                  'Bíceps',  'Barra',         'iniciante'),
  ('Tríceps testa',                 'Tríceps', 'Barra W',       'intermediario'),
  ('Abdominal supra',               'Abdômen', 'Peso corporal', 'iniciante');


-- Notificação de boas-vindas
INSERT INTO notification (titulo, mensagem, tipo, destinatarios) VALUES
  ('Bem-vindo à GymBros!',
   'Sua jornada fitness começa agora. Explore os planos e encontre sua academia ideal.',
   'informativo', 'todos');


-- ============================================================================
-- FIM
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;
