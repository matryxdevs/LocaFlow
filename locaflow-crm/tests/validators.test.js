'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const V=require('../src/validators');
test('Datas ISO válidas e inválidas',()=>{
 assert.equal(V.date('2026-11-19'),'2026-11-19');
 assert.throws(()=>V.date('2026-02-30'));
 assert.throws(()=>V.date('19/11/2026'));
 assert.throws(()=>V.date('2026-13-12'));
});
test('Duração de locação usa fim exclusivo',()=>{
 assert.equal(V.daysBetween('2026-11-19','2026-11-20'),1);
 assert.equal(V.daysBetween('2026-11-19','2026-11-26'),7);
 assert.throws(()=>V.daysBetween('2026-11-19','2026-11-19'));
 assert.throws(()=>V.daysBetween('2026-11-20','2026-11-19'));
});
test('Validação monetária',()=>{
 assert.equal(V.money('450.50'),450.5);
 assert.equal(V.money('450,50'),450.5);
 assert.equal(V.money('0'),0);
 assert.throws(()=>V.money('-1'));
 assert.throws(()=>V.money('10.123'));
 assert.throws(()=>V.money('1 OR 1=1'));
});
test('Regras de senhas fortes',()=>{
 assert.equal(V.password('UmaSenha#123456'),'UmaSenha#123456');
 assert.throws(()=>V.password('123456'));
 assert.throws(()=>V.password('todasminusculas123'));
 assert.throws(()=>V.password('SomenteMaiusculas'));
});
test('IDs inteiros e enumerações',()=>{
 assert.equal(V.id('125'),125);
 assert.throws(()=>V.id('1;DELETE FROM users'));
 assert.throws(()=>V.id('-2'));
 assert.throws(()=>V.id('0'));
 assert.equal(V.pick('whatsapp',V.options.sources),'whatsapp');
 assert.throws(()=>V.pick('injetado',V.options.sources));
});
test('Comprimento e validação de e-mail',()=>{
 assert.equal(V.str('  Ana Maria  ',150,true),'Ana Maria');
 assert.equal(V.email(' Ana@Exemplo.com '),'ana@exemplo.com');
 assert.throws(()=>V.email('sem-arroba',true));
 assert.throws(()=>V.str(' ',10,true));
 assert.throws(()=>V.str('muito longo',5));
});
