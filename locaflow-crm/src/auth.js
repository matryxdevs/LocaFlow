'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function hashPassword(password) { return bcrypt.hash(password, 12); }
async function verifyPassword(password, hash) { return bcrypt.compare(password, hash); }
const validId = (value) => /^\d{1,16}$/.test(String(value)) && Number(value) > 0 && Number.isSafeInteger(Number(value));

function ensureCsrf(req, res, next) {
 if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
 res.locals.csrf = req.session.csrf;
 next();
}
function checkCsrf(req, res, next) {
 if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
 const sent = req.body?._csrf;
 const stored = req.session?.csrf;
 if (typeof sent !== 'string' || typeof stored !== 'string' || sent.length !== stored.length ||
   !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(stored))) {
   return res.status(403).render('error', { title:'Solicitação bloqueada', message:'Sessão ou formulário inválido. Atualize a página e tente novamente.' });
 }
 next();
}
async function attachUser(req, res, next) {
 res.locals.currentUser = null;
 if (!req.session?.userId) return next();
 try {
  const [rows] = await pool.execute(`SELECT u.id,u.company_id,u.full_name,u.email,u.role,u.is_active,u.auth_version,
    c.name AS company_name,c.status AS company_status
    FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=? LIMIT 1`, [req.session.userId]);
  const user = rows[0];
  if (!user || !user.is_active || req.session.authVersion !== user.auth_version || (user.role !== 'superadmin' && user.company_status !== 'active')) {
   req.session.destroy(() => {});
   return res.redirect('/login?expired=1');
  }
  req.user = user;
  res.locals.currentUser = user;
  next();
 } catch (err) { next(err); }
}
function requireAuth(req, res, next) {
 if (!req.user) return res.redirect('/login');
 next();
}
function requireRole(...roles) {
 return (req, res, next) => {
  if (!req.user) return res.redirect('/login');
  if (!roles.includes(req.user.role)) return res.status(403).render('error',{title:'Acesso não autorizado',message:'Você não tem permissão para esta operação.'});
  next();
 };
}
function sessionLogin(req, user) {
 return new Promise((resolve, reject) => req.session.regenerate((error) => {
  if (error) return reject(error);
  req.session.userId = user.id;
  req.session.authVersion = user.auth_version;
  req.session.csrf = crypto.randomBytes(32).toString('hex');
  req.session.save((err) => err ? reject(err) : resolve());
 }));
}
function audit(user, action, entity, entityId, db = pool) {
 return db.execute('INSERT INTO audit_logs (company_id,user_id,action,entity,entity_id) VALUES (?,?,?,?,?)',
  [user.company_id ?? null, user.id, action, entity, entityId ?? null]);
}
module.exports = {hashPassword,verifyPassword,validId,ensureCsrf,checkCsrf,attachUser,requireAuth,requireRole,sessionLogin,audit};
