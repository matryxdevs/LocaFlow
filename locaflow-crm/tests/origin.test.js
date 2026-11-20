'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { allowedOrigin } = require('../src/origin');
const base = {
  origin:'https://just-aquamarine-dunlin-37.hostingersite.com',
  host:'just-aquamarine-dunlin-37.hostingersite.com',
  appOrigin:'https://crm.outrodominio.com.br',
  extraOrigins:[],production:true,trustProxy:false
};
const check = (changes) => allowedOrigin({...base,...changes});

test('mesmo domínio público é aceito mesmo se APP_ORIGIN estiver desatualizado',()=>{
  assert.equal(check({}),true);
});
test('origem externa não pode postar no login da locadora',()=>{
  assert.equal(check({origin:'https://ataque.example'}),false);
});
test('origem expressamente configurada funciona quando Host do proxy é interno',()=>{
  assert.equal(check({origin:'https://crm.outrodominio.com.br',host:'localhost:3000'}),true);
});
test('proxy confiável permite comparar X-Forwarded-Host',()=>{
  assert.equal(check({host:'localhost:3000',forwardedHost:base.host,trustProxy:true}),true);
});
test('X-Forwarded-Host não confiável é ignorado',()=>{
  assert.equal(check({host:'localhost:3000',forwardedHost:base.host,trustProxy:false}),false);
});
test('não permite HTTP em produção',()=>{
  assert.equal(check({origin:'http://just-aquamarine-dunlin-37.hostingersite.com'}),false);
});
test('ambiente local aceita origem HTTP correspondente ao Host',()=>{
  assert.equal(check({origin:'http://localhost:3000',host:'localhost:3000',production:false}),true);
});
test('origens opacas e malformadas são recusadas',()=>{
  assert.equal(check({origin:'null'}),false);
  assert.equal(check({origin:'https://ataque.example/path'}),false);
  assert.equal(check({origin:'https://example.com@ataque.example'}),false);
  assert.equal(check({origin:'https://example.com\nX:1'}),false);
});
test('domínios extras explícitos funcionam sem abrir wildcard',()=>{
  assert.equal(check({origin:'https://crm.dominio-alternativo.com.br',host:'localhost:3000',extraOrigins:['https://crm.dominio-alternativo.com.br/']}),true);
  assert.equal(check({origin:'https://nao-permitido.com.br',host:'localhost:3000',extraOrigins:['https://crm.dominio-alternativo.com.br/']}),false);
});
test('sem header Origin passa somente para posterior verificação do token CSRF',()=>{
  assert.equal(check({origin:undefined}),true);
});
test('porta padrão é normalizada corretamente',()=>{
  assert.equal(check({origin:'https://just-aquamarine-dunlin-37.hostingersite.com:443'}),true);
});
