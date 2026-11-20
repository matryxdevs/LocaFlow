'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('node:fs');

const required = ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','SESSION_SECRET'];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes('SUBSTITUA')) {
    throw new Error(`Configuração inválida: ${key}. Consulte .env.example`);
  }
}
if (process.env.SESSION_SECRET.length < 48) throw new Error('SESSION_SECRET deve ter 48 caracteres ou mais.');
if (process.env.NODE_ENV === 'production' && (!process.env.APP_ORIGIN || !process.env.APP_ORIGIN.startsWith('https://'))) {
  throw new Error('APP_ORIGIN deve usar HTTPS em produção.');
}

const mysqlOptions = {
 host: process.env.DB_HOST,
 port: Number(process.env.DB_PORT || 3306),
 user: process.env.DB_USER,
 password: process.env.DB_PASSWORD,
 database: process.env.DB_NAME,
 charset: 'utf8mb4',
 waitForConnections: true,
 connectionLimit: 10,
 queueLimit: 50,
 decimalNumbers: true,
 dateStrings: true,
 timezone: 'Z'
};
if (process.env.DB_SSL === 'true') {
 if (!process.env.DB_SSL_CA_PATH) throw new Error('Defina DB_SSL_CA_PATH para conferir o certificado do MySQL.');
 mysqlOptions.ssl = { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8'), rejectUnauthorized: true };
}
const pool = mysql.createPool(mysqlOptions);
module.exports = { pool, mysqlOptions };
