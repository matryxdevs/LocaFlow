-- Locaflow CRM - MySQL 8.0+; execute dentro do banco criado no seu painel.
-- Charset recomendado: utf8mb4; InnoDB obrigatório.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(150) NOT NULL,
 legal_name VARCHAR(180) NULL,
 document VARCHAR(20) NULL,
 email VARCHAR(190) NOT NULL,
 phone VARCHAR(30) NULL,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 plan ENUM('starter','business','enterprise') NOT NULL DEFAULT 'starter',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_company_document (document)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NULL,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(190) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('superadmin','company_admin','agent') NOT NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 auth_version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_user_email (email),
 KEY idx_users_company (company_id),
 CONSTRAINT fk_user_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT chk_user_role_company CHECK ((role='superadmin' AND company_id IS NULL) OR (role<>'superadmin' AND company_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 email VARCHAR(190) NULL,
 phone VARCHAR(30) NULL,
 document VARCHAR(25) NULL,
 city VARCHAR(100) NULL,
 notes TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_clients_tenant_id (id, company_id),
 KEY idx_clients_company (company_id, full_name),
 CONSTRAINT fk_clients_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vehicles (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 brand VARCHAR(70) NOT NULL,
 model VARCHAR(110) NOT NULL,
 plate VARCHAR(10) NOT NULL,
 year SMALLINT UNSIGNED NULL,
 category ENUM('economico','sedan','suv','picape','van','outro') NOT NULL DEFAULT 'economico',
 daily_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
 status ENUM('disponivel','manutencao','inativo') NOT NULL DEFAULT 'disponivel',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_vehicles_tenant_id (id, company_id),
 UNIQUE KEY uq_vehicles_company_plate (company_id, plate),
 KEY idx_vehicles_company_status (company_id,status),
 CONSTRAINT fk_vehicles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT chk_daily_rate CHECK (daily_rate >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(150) NOT NULL,
 phone VARCHAR(30) NULL,
 email VARCHAR(190) NULL,
 source ENUM('whatsapp','site','instagram','indicacao','telefone','outro') NOT NULL DEFAULT 'whatsapp',
 stage ENUM('novo','contato','proposta','negociacao','ganho','perdido') NOT NULL DEFAULT 'novo',
 estimated_value DECIMAL(12,2) NOT NULL DEFAULT 0,
 notes TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_leads_tenant_id (id, company_id),
 KEY idx_leads_company_stage (company_id,stage),
 CONSTRAINT fk_leads_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT chk_estimated_value CHECK (estimated_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rentals (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 client_id BIGINT UNSIGNED NOT NULL,
 vehicle_id BIGINT UNSIGNED NOT NULL,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 daily_rate DECIMAL(12,2) NOT NULL,
 total_value DECIMAL(12,2) NOT NULL,
 status ENUM('reservada','ativa','finalizada','cancelada') NOT NULL DEFAULT 'reservada',
 notes TEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_rentals_vehicle_period (company_id,vehicle_id,start_date,end_date,status),
 KEY idx_rentals_company_status (company_id,status),
 CONSTRAINT fk_rentals_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT fk_rentals_client_tenant FOREIGN KEY (client_id, company_id) REFERENCES clients(id,company_id) ON DELETE RESTRICT,
 CONSTRAINT fk_rentals_vehicle_tenant FOREIGN KEY (vehicle_id, company_id) REFERENCES vehicles(id,company_id) ON DELETE RESTRICT,
 CONSTRAINT chk_rental_dates CHECK (end_date > start_date),
 CONSTRAINT chk_rental_value CHECK (daily_rate >= 0 AND total_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NULL,
 user_id BIGINT UNSIGNED NULL,
 action VARCHAR(80) NOT NULL,
 entity VARCHAR(40) NOT NULL,
 entity_id BIGINT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_audit_company_created (company_id,created_at),
 CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
 CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessões persistentes (express-mysql-session). Criada previamente para reduzir
-- necessidade de permissões de DDL no usuário de execução da aplicação.
CREATE TABLE IF NOT EXISTS user_sessions (
 session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 expires INT UNSIGNED NOT NULL,
 data MEDIUMTEXT COLLATE utf8mb4_bin
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
