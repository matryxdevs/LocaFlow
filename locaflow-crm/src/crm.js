'use strict';
const express = require('express');
const { pool } = require('./db');
const { requireAuth, requireRole, audit } = require('./auth');
const V = require('./validators');
const router = express.Router();
router.use(requireAuth);

const fieldConfigs = {
 clients: {
  title:'Clientes', singular:'Cliente', subtitle:'Relacionamentos centralizados e protegidos por empresa.', icon:'users',
  columns:[['full_name','Cliente'],['email','E-mail'],['phone','Telefone'],['city','Cidade'],['created_at','Cadastro']],
  fields:[
   {name:'full_name',label:'Nome completo / Razão social',required:true,wide:true},
   {name:'email',label:'E-mail',type:'email'},
   {name:'phone',label:'Telefone / WhatsApp',type:'tel'},
   {name:'document',label:'CPF / CNPJ'},
   {name:'city',label:'Cidade'},
   {name:'notes',label:'Observações',type:'textarea',wide:true}
  ]
 },
 vehicles: {
  title:'Frota',singular:'Veículo',subtitle:'Disponibilidade, tarifas e controle dos ativos da locadora.',icon:'car',
  columns:[['vehicle_name','Veículo'],['plate','Placa'],['category','Categoria'],['daily_rate','Diária'],['status','Situação']],
  fields:[
   {name:'brand',label:'Marca',required:true},
   {name:'model',label:'Modelo',required:true},
   {name:'plate',label:'Placa',required:true},
   {name:'year',label:'Ano',type:'number',min:1980,max:2100},
   {name:'category',label:'Categoria',type:'select',choices:[['economico','Econômico'],['sedan','Sedan'],['suv','SUV'],['picape','Picape'],['van','Van'],['outro','Outro']]},
   {name:'daily_rate',label:'Valor da diária (R$)',type:'number',step:'0.01',min:0,required:true},
   {name:'status',label:'Disponibilidade',type:'select',choices:[['disponivel','Disponível'],['manutencao','Manutenção'],['inativo','Inativo']]}
  ]
 },
 leads: {
  title:'Oportunidades',singular:'Oportunidade',subtitle:'Pipeline comercial para fechar mais contratos de locação.',icon:'target',
  columns:[['name','Contato'],['phone','WhatsApp'],['source','Origem'],['stage','Etapa'],['estimated_value','Potencial'],['created_at','Entrada']],
  fields:[
   {name:'name',label:'Nome do lead',required:true,wide:true},
   {name:'phone',label:'Telefone / WhatsApp',type:'tel'},
   {name:'email',label:'E-mail',type:'email'},
   {name:'source',label:'Origem',type:'select',choices:[['whatsapp','WhatsApp'],['site','Site'],['instagram','Instagram'],['indicacao','Indicação'],['telefone','Telefone'],['outro','Outro']]},
   {name:'stage',label:'Etapa da negociação',type:'select',choices:[['novo','Novo'],['contato','Contato'],['proposta','Proposta'],['negociacao','Negociação'],['ganho','Ganho'],['perdido','Perdido']]},
   {name:'estimated_value',label:'Valor potencial (R$)',type:'number',step:'0.01',min:0},
   {name:'notes',label:'Observações',type:'textarea',wide:true}
  ]
 }
};
function nice(str){return ({novo:'Novo',contato:'Contato',proposta:'Proposta',negociacao:'Negociação',ganho:'Ganho',perdido:'Perdido',reservada:'Reservada',ativa:'Ativa',finalizada:'Finalizada',cancelada:'Cancelada',disponivel:'Disponível',manutencao:'Manutenção',inativo:'Inativo',economico:'Econômico',picape:'Picape',indicacao:'Indicação'})[str] || str || '—';}
function brl(value) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value || 0)); }
function fmtDate(value) {
 if (!value) return '—';
 const date = String(value).slice(0,10);
 const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}
function display(row, key) {
 if (row[key] === null || row[key] === undefined || row[key] === '') return '—';
 if (['daily_rate','estimated_value','total_value'].includes(key)) return brl(row[key]);
 if (['created_at','start_date','end_date'].includes(key)) return fmtDate(row[key]);
 if (['status','stage','source','category'].includes(key)) return nice(row[key]);
 return String(row[key]);
}
function isPill(field) { return ['status','stage'].includes(field); }
function errorPage(res, err) { return res.status(400).render('error',{title:'Não foi possível concluir',message:err.code ? 'Não foi possível salvar os dados. Verifique os campos e tente novamente.' : (err.message || 'Verifique os dados preenchidos.')}); }
function parseEntity(kind, body) {
 if (kind==='clients') return {
  full_name:V.str(body.full_name,150,true),email:V.email(body.email),phone:V.str(body.phone,30),document:V.str(body.document,25),city:V.str(body.city,100),notes:V.str(body.notes,3000)
 };
 if (kind==='vehicles') {
  let year=null;
  if (body.year !== '' && body.year != null) {
   year=Number(body.year);
   if(!Number.isInteger(year) || year<1980 || year>2100)throw new Error('Ano do veículo inválido.');
  }
  const plate=V.str(body.plate,10,true).toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))throw new Error('Placa inválida. Use ABC1234 ou ABC1D23.');
  return {brand:V.str(body.brand,70,true),model:V.str(body.model,110,true),plate,year,
   category:V.pick(body.category||'economico',V.options.categories,'Categoria'),daily_rate:V.money(body.daily_rate),
   status:V.pick(body.status||'disponivel',V.options.vehicleStatuses,'Situação')};
 }
 if (kind==='leads') return {
  name:V.str(body.name,150,true),phone:V.str(body.phone,30),email:V.email(body.email),
  source:V.pick(body.source||'whatsapp',V.options.sources,'Origem'),stage:V.pick(body.stage||'novo',V.options.stages,'Etapa'),
  estimated_value:V.money(body.estimated_value||'0'),notes:V.str(body.notes,3000)
 };
 throw new Error('Entidade não reconhecida.');
}
function ensureTenant(req,res,next){if(req.user.role==='superadmin')return res.redirect('/empresas');next();}
router.use(ensureTenant);
router.get('/dashboard',async(req,res)=>{
 const c=req.user.company_id;
 const [counts]=await pool.execute(`SELECT
  (SELECT COUNT(*) FROM clients WHERE company_id=?) clients,
  (SELECT COUNT(*) FROM vehicles WHERE company_id=? AND status='disponivel') available_vehicles,
  (SELECT COUNT(*) FROM vehicles WHERE company_id=?) total_vehicles,
  (SELECT COUNT(*) FROM leads WHERE company_id=? AND stage NOT IN ('ganho','perdido')) open_leads,
  (SELECT COUNT(*) FROM rentals WHERE company_id=? AND status='ativa') active_rentals,
  (SELECT COALESCE(SUM(total_value),0) FROM rentals WHERE company_id=? AND status IN ('reservada','ativa','finalizada') AND start_date >= DATE_FORMAT(CURRENT_DATE(),'%Y-%m-01') AND start_date < DATE_FORMAT(CURRENT_DATE() + INTERVAL 1 MONTH,'%Y-%m-01')) monthly_revenue`,[c,c,c,c,c,c]);
 const [recent]=await pool.execute(`SELECT r.id,r.start_date,r.end_date,r.total_value,r.status,cl.full_name AS client_name,CONCAT(v.brand,' ',v.model) AS vehicle_name,v.plate
 FROM rentals r JOIN clients cl ON cl.id=r.client_id AND cl.company_id=r.company_id JOIN vehicles v ON v.id=r.vehicle_id AND v.company_id=r.company_id
 WHERE r.company_id=? ORDER BY r.created_at DESC LIMIT 6`,[c]);
 const [stages]=await pool.execute(`SELECT stage,COUNT(*) total FROM leads WHERE company_id=? GROUP BY stage`,[c]);
 const [months]=await pool.execute(`SELECT DATE_FORMAT(start_date,'%Y-%m') AS month,COUNT(*) total FROM rentals WHERE company_id=? AND start_date >= DATE_FORMAT(CURRENT_DATE() - INTERVAL 5 MONTH,'%Y-%m-01') AND status<>'cancelada' GROUP BY DATE_FORMAT(start_date,'%Y-%m') ORDER BY month ASC`,[c]);
 const chart=[];
 for(let i=5;i>=0;i--){const now=new Date();const d=new Date(Date.UTC(now.getFullYear(),now.getMonth()-i,1)); const k=d.toISOString().slice(0,7); const mon=new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(d).replace('.',''); chart.push({label:mon,total:Number(months.find(x=>x.month===k)?.total||0)});}
 res.render('dashboard',{title:'Visão geral',nav:'dashboard',counts:counts[0],recent,stages,chart,brl,fmtDate,nice});
});

for(const kind of Object.keys(fieldConfigs)) {
 const def=fieldConfigs[kind];
 const path='/'+kind;
 router.get(path,async(req,res)=>{
  const term=typeof req.query.q==='string'?req.query.q.trim().slice(0,80):'';
  const col=kind==='clients'?'full_name':kind==='vehicles'?'plate':'name';
  const sql=`SELECT *${kind==='vehicles'?", CONCAT(brand,' ',model) AS vehicle_name":''} FROM ${kind} WHERE company_id=? ${term?`AND ${col} LIKE ?`:''} ORDER BY created_at DESC LIMIT 100`;
  const [rows]=await pool.execute(sql,term?[req.user.company_id,`%${term.replace(/[\\%_]/g,'\\$&')}%`]:[req.user.company_id]);
  res.render('entity-list',{title:def.title,nav:kind,kind,def,rows,term,display,isPill,nice});
 });
 router.get(path+'/novo',(req,res)=>res.render('entity-form',{title:'Novo '+def.singular.toLowerCase(),nav:kind,kind,def,item:{},edit:false}));
 router.post(path,async(req,res)=>{
  try{
   const data=parseEntity(kind,req.body);
   const cols=Object.keys(data);
   const [result]=await pool.execute(`INSERT INTO ${kind} (company_id,${cols.join(',')}) VALUES (?,${cols.map(()=>'?').join(',')})`,[req.user.company_id,...Object.values(data)]);
   await audit(req.user,'create',kind,result.insertId);
   return res.redirect(path+'?created=1');
  }catch(err){if(err.code==='ER_DUP_ENTRY')return errorPage(res,new Error('Registro duplicado nesta empresa.'));return errorPage(res,err);}
 });
 router.get(path+'/:id/editar',async(req,res)=>{
  let entityId;
  try{entityId=V.id(req.params.id);}catch{return res.status(404).render('error',{title:'Não encontrado',message:'Registro inválido.'});}
  const [rows]=await pool.execute(`SELECT * FROM ${kind} WHERE company_id=? AND id=? LIMIT 1`,[req.user.company_id,entityId]);
  if(!rows.length)return res.status(404).render('error',{title:'Não encontrado',message:'Registro não localizado nesta empresa.'});
  res.render('entity-form',{title:'Editar '+def.singular.toLowerCase(),nav:kind,kind,def,item:rows[0],edit:true});
 });
 router.post(path+'/:id/editar',async(req,res)=>{
  try{
   const entityId=V.id(req.params.id),data=parseEntity(kind,req.body),cols=Object.keys(data);
   const [result]=await pool.execute(`UPDATE ${kind} SET ${cols.map(c=>c+'=?').join(',')} WHERE id=? AND company_id=?`,[...Object.values(data),entityId,req.user.company_id]);
   if(!result.affectedRows)return res.status(404).render('error',{title:'Não encontrado',message:'Registro não localizado.'});
   await audit(req.user,'update',kind,entityId);
   return res.redirect(path+'?updated=1');
  }catch(err){if(err.code==='ER_DUP_ENTRY')return errorPage(res,new Error('Registro duplicado nesta empresa.'));return errorPage(res,err);}
 });
 router.post(path+'/:id/excluir',async(req,res)=>{
  try{
   const entityId=V.id(req.params.id);
   const [result]=await pool.execute(`DELETE FROM ${kind} WHERE company_id=? AND id=?`,[req.user.company_id,entityId]);
   if(!result.affectedRows)return res.status(404).render('error',{title:'Não encontrado',message:'Registro não localizado.'});
   await audit(req.user,'delete',kind,entityId);
   return res.redirect(path+'?deleted=1');
  }catch(err){if(err.code==='ER_ROW_IS_REFERENCED_2')return errorPage(res,new Error('Este registro possui locações relacionadas e não pode ser excluído.'));return errorPage(res,err);}
 });
}

router.get('/locacoes',async(req,res)=>{
 const [rows]=await pool.execute(`SELECT r.*,c.full_name AS client_name,CONCAT(v.brand,' ',v.model) AS vehicle_name,v.plate FROM rentals r
 JOIN clients c ON c.id=r.client_id AND c.company_id=r.company_id
 JOIN vehicles v ON v.id=r.vehicle_id AND v.company_id=r.company_id
 WHERE r.company_id=? ORDER BY r.created_at DESC LIMIT 100`,[req.user.company_id]);
 res.render('rentals',{title:'Locações',nav:'rentals',rows,brl,fmtDate,nice});
});
router.get('/locacoes/nova',async(req,res)=>{
 const [clients]=await pool.execute('SELECT id,full_name FROM clients WHERE company_id=? ORDER BY full_name LIMIT 500',[req.user.company_id]);
 const [vehicles]=await pool.execute('SELECT id,brand,model,plate,daily_rate FROM vehicles WHERE company_id=? AND status=? ORDER BY brand,model LIMIT 500',[req.user.company_id,'disponivel']);
 res.render('rental-form',{title:'Nova locação',nav:'rentals',clients,vehicles});
});
router.post('/locacoes',async(req,res)=>{
 let conn;
 try {
  const companyId=req.user.company_id;
  const clientId=V.id(req.body.client_id),vehicleId=V.id(req.body.vehicle_id);
  const start=V.date(req.body.start_date),end=V.date(req.body.end_date),days=V.daysBetween(start,end);
  const rate=V.money(req.body.daily_rate);
  const total=Math.round(rate*days*100)/100;
  const notes=V.str(req.body.notes,3000);
  conn=await pool.getConnection();await conn.beginTransaction();
  const [v]=await conn.execute('SELECT id,status FROM vehicles WHERE id=? AND company_id=? FOR UPDATE',[vehicleId,companyId]);
  if(!v.length || v[0].status!=='disponivel')throw new Error('Veículo indisponível ou não pertence a esta empresa.');
  const [client]=await conn.execute('SELECT id FROM clients WHERE id=? AND company_id=?',[clientId,companyId]);
  if(!client.length)throw new Error('Cliente inválido para esta empresa.');
  const [overlap]=await conn.execute(`SELECT id FROM rentals WHERE company_id=? AND vehicle_id=? AND status IN ('reservada','ativa') AND start_date<? AND end_date>? LIMIT 1`,[companyId,vehicleId,end,start]);
  if(overlap.length)throw new Error('Conflito de datas: o veículo já possui locação reservada ou ativa nesse período.');
  const [result]=await conn.execute(`INSERT INTO rentals (company_id,client_id,vehicle_id,start_date,end_date,daily_rate,total_value,notes) VALUES (?,?,?,?,?,?,?,?)`,[companyId,clientId,vehicleId,start,end,rate,total,notes]);
  await audit(req.user,'create','rentals',result.insertId,conn);
  await conn.commit();return res.redirect('/locacoes?created=1');
 } catch(err){if(conn)await conn.rollback();return errorPage(res,err);}finally{if(conn)conn.release();}
});
router.post('/locacoes/:id/status',async(req,res)=>{
 let conn;
 try{
  const id=V.id(req.params.id),status=V.pick(req.body.status,V.options.rentalStatuses,'Situação');
  const companyId=req.user.company_id;
  conn=await pool.getConnection();await conn.beginTransaction();
  // Primeiro trava a locação, depois o veículo; criação bloqueia veículo antes de consultar sobreposições.
  // Em cenário concorrente, deadlocks são tratados como erro e a operação deve ser repetida.
  const [items]=await conn.execute('SELECT * FROM rentals WHERE id=? AND company_id=? FOR UPDATE',[id,companyId]);
  if(!items.length)throw new Error('Locação não encontrada.');
  const rental=items[0];
  const valid={reservada:['ativa','cancelada'],ativa:['finalizada','cancelada'],finalizada:[],cancelada:[]};
  if(!valid[rental.status].includes(status))throw new Error('Mudança de situação não permitida.');
  if(status==='ativa') {
   const [v]=await conn.execute('SELECT status FROM vehicles WHERE id=? AND company_id=? FOR UPDATE',[rental.vehicle_id,companyId]);
   if(!v.length || v[0].status!=='disponivel')throw new Error('Veículo não disponível.');
  }
  await conn.execute('UPDATE rentals SET status=? WHERE company_id=? AND id=?',[status,companyId,id]);
  await audit(req.user,'status:'+status,'rentals',id,conn);
  await conn.commit();return res.redirect('/locacoes?updated=1');
 }catch(err){if(conn)await conn.rollback();return errorPage(res,err);}finally{if(conn)conn.release();}
});
router.get('/equipe',requireRole('company_admin'),async(req,res)=>{
 const [users]=await pool.execute('SELECT id,full_name,email,role,is_active,created_at FROM users WHERE company_id=? ORDER BY created_at DESC',[req.user.company_id]);
 res.render('team',{title:'Equipe',nav:'team',users});
});
router.post('/equipe',requireRole('company_admin'),async(req,res)=>{
 try{
  const name=V.str(req.body.full_name,120,true),mail=V.email(req.body.email,true),pass=V.password(req.body.password);
  const role=V.pick(req.body.role,['company_admin','agent'],'Perfil');
  const {hashPassword}=require('./auth');
  const [result]=await pool.execute('INSERT INTO users(company_id,full_name,email,password_hash,role) VALUES (?,?,?,?,?)',
   [req.user.company_id,name,mail,await hashPassword(pass),role]);
  await audit(req.user,'create','users',result.insertId);return res.redirect('/equipe?created=1');
 }catch(err){return errorPage(res,err.code==='ER_DUP_ENTRY'?new Error('Este e-mail já está cadastrado na plataforma.'):err);}
});
router.post('/equipe/:id/reset',requireRole('company_admin'),async(req,res)=>{
 try{
  const id=V.id(req.params.id),pass=V.password(req.body.new_password);
  if(id===req.user.id)throw new Error('Use Minha conta para alterar sua própria senha.');
  const {hashPassword}=require('./auth');
  const [result]=await pool.execute('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=? AND company_id=?',
   [await hashPassword(pass),id,req.user.company_id]);
  if(!result.affectedRows)throw new Error('Usuário não encontrado.');
  await audit(req.user,'password_reset','users',id);
  return res.redirect('/equipe?updated=1');
 }catch(err){return errorPage(res,err);}
});
router.post('/equipe/:id/status',requireRole('company_admin'),async(req,res)=>{
 try{
  const id=V.id(req.params.id);
  if(id===req.user.id)throw new Error('Você não pode desativar a própria conta.');
  const [result]=await pool.execute(`UPDATE users SET is_active=IF(is_active=1,0,1) WHERE id=? AND company_id=?`,[id,req.user.company_id]);
  if(!result.affectedRows)throw new Error('Colaborador não encontrado.');
  await audit(req.user,'toggle','users',id);
  return res.redirect('/equipe?updated=1');
 }catch(err){return errorPage(res,err);}
});
module.exports = router;
