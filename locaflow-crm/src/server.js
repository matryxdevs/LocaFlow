'use strict';
require('dotenv').config();
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { pool, mysqlOptions } = require('./db');
const V = require('./validators');
const { hashPassword,verifyPassword,ensureCsrf,checkCsrf,attachUser,requireAuth,requireRole,sessionLogin,audit } = require('./auth');
const crm = require('./crm');
const { allowedOrigin } = require('./origin');
const app=express();
const production=process.env.NODE_ENV==='production';
const hostOrigin=process.env.APP_ORIGIN || 'http://localhost:3000';
const trustedProxy=process.env.TRUST_PROXY === '1';
const extraOrigins=(process.env.APP_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.disable('x-powered-by');
app.set('trust proxy',trustedProxy ? 1 : false);
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'..','views'));
app.use(helmet({
 contentSecurityPolicy:{directives:{
  defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],
  fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],
  formAction:["'self'"],baseUri:["'self'"],upgradeInsecureRequests:production?[]:null
 }},
 crossOriginEmbedderPolicy:false
}));
app.use('/static',express.static(path.join(__dirname,'..','public'),{index:false, dotfiles:'deny', maxAge:'7d'}));
app.use(express.urlencoded({extended:false,limit:'32kb',parameterLimit:35}));
const sessionStore = new MySQLStore({
 host:mysqlOptions.host,port:mysqlOptions.port,user:mysqlOptions.user,password:mysqlOptions.password,
 database:mysqlOptions.database,charset:'utf8mb4',ssl:mysqlOptions.ssl,
 createDatabaseTable:false,expiration:1000*60*60*8,checkExpirationInterval:1000*60*15,
 schema:{tableName:'user_sessions',columnNames:{session_id:'session_id',expires:'expires',data:'data'}}
});
app.use(session({
 name:'lf.sid',secret:process.env.SESSION_SECRET,store:sessionStore,
 resave:false,saveUninitialized:false,rolling:true,
 cookie:{httpOnly:true,secure:production,sameSite:'lax',maxAge:1000*60*60*8,path:'/' }
}));
app.use((req,res,next)=>{res.setHeader('Cache-Control','private, no-store');res.locals.nav='';res.locals.query=req.query;next();});
app.use(ensureCsrf);
app.use((req,res,next)=>{
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
 const valid=allowedOrigin({
  origin:req.get('origin'),host:req.get('host'),
  forwardedHost:req.get('x-forwarded-host'),
  appOrigin:hostOrigin,extraOrigins,production,trustProxy:trustedProxy
 });
 if(valid)return next();
 // Os campos abaixo são nomes de domínio, nunca credenciais ou cookies.
 console.warn('Requisição bloqueada por origem divergente:',{
  path:req.path,origin:req.get('origin')||'(ausente)',host:req.get('host')||'(ausente)'
 });
 return res.status(403).render('error',{
  title:'Origem inválida',
  message:'A requisição veio de um endereço diferente do site. Abra o login pelo domínio principal, atualize a página e tente novamente.'
 });
});
app.use(checkCsrf);
app.use(attachUser);
app.get('/health',async(req,res)=>{
 try{await pool.query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({status:'unavailable'});}
});
app.get('/',(req,res)=>res.redirect(!req.user?'/login':req.user.role==='superadmin'?'/empresas':'/dashboard'));
app.get('/login',(req,res)=>{
 if(req.user)return res.redirect('/');
 res.render('login',{title:'Entrar',invalid:false,expired:req.query.expired==='1'});
});
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,
 message:'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.'});
app.post('/login',loginLimiter,async(req,res)=>{
 const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase().slice(0,190):'';
 const password=typeof req.body.password==='string'?req.body.password:'';
 try {
  const [rows]=await pool.execute(`SELECT u.id,u.password_hash,u.is_active,u.auth_version,u.role,c.status AS company_status FROM users u
   LEFT JOIN companies c ON c.id=u.company_id WHERE u.email=? LIMIT 1`,[email]);
  const user=rows[0];
  const valid=Boolean(user && user.is_active && (user.role==='superadmin'||user.company_status==='active') && await verifyPassword(password,user.password_hash));
  if(!valid)return res.status(401).render('login',{title:'Entrar',invalid:true,expired:false});
  await sessionLogin(req,user);
  return res.redirect(user.role==='superadmin'?'/empresas':'/dashboard');
 }catch(err){return nextError(err,req,res);}
});
function nextError(err,req,res){console.error('Erro interno de autenticação:',err.code||err.name);return res.status(500).render('error',{title:'Serviço temporariamente indisponível',message:'Não foi possível concluir a operação.'});}
app.post('/logout',requireAuth,(req,res)=>req.session.destroy(err=>{
 if(err)return nextError(err,req,res);
 res.clearCookie('lf.sid',{path:'/'});res.redirect('/login');
}));

app.get('/empresas',requireRole('superadmin'),async(req,res)=>{
 const [companies]=await pool.execute(`SELECT c.id,c.name,c.legal_name,c.document,c.email,c.phone,c.plan,c.status,c.created_at,
  (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id) AS users_count,
  (SELECT COUNT(*) FROM vehicles v WHERE v.company_id=c.id) AS vehicles_count
 FROM companies c ORDER BY c.created_at DESC LIMIT 200`);
 res.render('companies',{title:'Empresas',nav:'companies',companies});
});
app.post('/empresas',requireRole('superadmin'),async(req,res)=>{
 let conn;
 try{
  const name=V.str(req.body.name,150,true),legal=V.str(req.body.legal_name,180),mail=V.email(req.body.email,true),phone=V.str(req.body.phone,30);
  const document=V.str(req.body.document,20)?.replace(/\D/g,'') || null;
  if(document && document.length!==14)throw new Error('Informe um CNPJ com 14 dígitos ou deixe em branco.');
  const plan=V.pick(req.body.plan||'starter',V.options.plans,'Plano');
  const ownerName=V.str(req.body.owner_name,120,true),ownerMail=V.email(req.body.owner_email,true),pass=V.password(req.body.owner_password);
  const hashed=await hashPassword(pass);
  conn=await pool.getConnection();await conn.beginTransaction();
  const [company]=await conn.execute('INSERT INTO companies(name,legal_name,document,email,phone,plan) VALUES (?,?,?,?,?,?)',[name,legal,document,mail,phone,plan]);
  const [user]=await conn.execute('INSERT INTO users(company_id,full_name,email,password_hash,role) VALUES (?,?,?,?,?)',[company.insertId,ownerName,ownerMail,hashed,'company_admin']);
  await audit(req.user,'create','companies',company.insertId,conn);
  await audit(req.user,'create','users',user.insertId,conn);
  await conn.commit();return res.redirect('/empresas?created=1');
 }catch(err){if(conn)await conn.rollback();return res.status(400).render('error',{title:'Empresa não cadastrada',message:err.code?(err.code==='ER_DUP_ENTRY'?'CNPJ ou e-mail já cadastrado na plataforma.':'Erro ao salvar os dados.'):err.message});}
 finally{if(conn)conn.release();}
});
app.post('/empresas/:id/status',requireRole('superadmin'),async(req,res)=>{
 try{
  const id=V.id(req.params.id);
  const [result]=await pool.execute(`UPDATE companies SET status=IF(status='active','inactive','active') WHERE id=?`,[id]);
  if(!result.affectedRows)throw new Error('Empresa não encontrada.');
  await audit(req.user,'toggle','companies',id);
  return res.redirect('/empresas?updated=1');
 }catch(err){return res.status(400).render('error',{title:'Operação não realizada',message:err.code?'Erro ao salvar os dados.':err.message});}
});
app.get('/conta',requireAuth,(req,res)=>res.render('account',{title:'Minha conta',nav:'account'}));
app.post('/conta/senha',requireAuth,async(req,res)=>{
 try{
  const current=typeof req.body.current_password==='string'?req.body.current_password:'';
  const next=V.password(req.body.new_password);
  if(current===next)throw new Error('A nova senha deve ser diferente da anterior.');
  const [rows]=await pool.execute('SELECT password_hash FROM users WHERE id=? LIMIT 1',[req.user.id]);
  if(!rows.length || !(await verifyPassword(current,rows[0].password_hash)))throw new Error('Senha atual incorreta.');
  await pool.execute('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?',[await hashPassword(next),req.user.id]);
  await audit(req.user,'password_change','users',req.user.id);
  req.session.authVersion+=1;
  return req.session.save(err=>err?nextError(err,req,res):res.redirect('/conta?updated=1'));
 }catch(err){return res.status(400).render('error',{title:'Senha não alterada',message:err.code?'Erro ao salvar a senha.':err.message});}
});
app.use(crm);
app.use((req,res)=>res.status(404).render('error',{title:'Página não encontrada',message:'A página solicitada não existe.'}));
app.use((err,req,res,next)=>{
 console.error('Erro não tratado:',err.code||err.name);
 if(res.headersSent)return next(err);
 res.status(500).render('error',{title:'Erro interno',message:'O sistema não conseguiu processar esta solicitação.'});
});
const port=Number(process.env.PORT||3000);
async function start(){
 try {await pool.query('SELECT 1');app.listen(port,'0.0.0.0',()=>console.log(`LocaFlow CRM iniciado na porta ${port}`));}
 catch(err){console.error('Falha de conexão com o MySQL:',err.code||err.message);process.exit(1);}
}
if(require.main===module)start();
module.exports=app;
