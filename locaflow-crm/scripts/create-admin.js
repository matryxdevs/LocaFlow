'use strict';
require('dotenv').config();
const {pool} = require('../src/db');
const {hashPassword} = require('../src/auth');
const V=require('../src/validators');
(async()=>{
 try{
  const email=V.email(process.env.ADMIN_EMAIL,true),name=V.str(process.env.ADMIN_NAME||'Administrador',120,true),password=V.password(process.env.ADMIN_PASSWORD);
  const [rows]=await pool.execute("SELECT COUNT(*) AS total FROM users WHERE role='superadmin'");
  if(rows[0].total>0)throw new Error('Já existe um superadministrador. A criação inicial só é permitida uma vez.');
  const [result]=await pool.execute('INSERT INTO users(company_id,full_name,email,password_hash,role) VALUES (NULL,?,?,?,?)',
  [name,email,await hashPassword(password),'superadmin']);
  console.log(`Superadministrador criado (ID: ${result.insertId}; e-mail: ${email}). Remova ADMIN_PASSWORD do ambiente.`);
 }catch(err){console.error('Erro ao criar o administrador:',err.code==='ER_DUP_ENTRY'?'E-mail já cadastrado.':err.message);process.exitCode=1;}
 finally{await pool.end();}
})();
