'use strict';
const options = Object.freeze({
 categories:['economico','sedan','suv','picape','van','outro'],
 vehicleStatuses:['disponivel','manutencao','inativo'],
 stages:['novo','contato','proposta','negociacao','ganho','perdido'],
 sources:['whatsapp','site','instagram','indicacao','telefone','outro'],
 rentalStatuses:['reservada','ativa','finalizada','cancelada'],
 plans:['starter','business','enterprise']
});
function str(value, max = 150, required = false) {
 const s = typeof value === 'string' ? value.trim() : '';
 if (s.length > max || (required && !s)) throw new Error(`Informe um texto válido de até ${max} caracteres.`);
 return s || null;
}
function email(value, required=false) {
 const s = str(value,190,required)?.toLowerCase() || null;
 if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('Informe um e-mail válido.');
 return s;
}
function money(value) {
 const s = String(value ?? '0').trim().replace(',','.');
 if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new Error('Informe um valor monetário válido e não negativo.');
 return Number(s);
}
function pick(value, allowed, title='Opção') {
 if (!allowed.includes(value)) throw new Error(`${title} inválida.`);
 return value;
}
function id(value) {
 if (!/^\d{1,16}$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('Seleção inválida.');
 return Number(value);
}
function date(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida.');
 const d = new Date(value+'T00:00:00Z');
 if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error('Data inválida.');
 return value;
}
function daysBetween(start, end) {
 const days = (Date.parse(end+'T00:00:00Z') - Date.parse(start+'T00:00:00Z')) / 86400000;
 if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('A devolução deve ocorrer após a retirada (prazo máximo de 10 anos).');
 return days;
}
function password(value) {
 if (typeof value !== 'string' || value.length < 12 || value.length > 128 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^a-zA-Z\d]/.test(value)) {
  throw new Error('A senha precisa de 12 a 128 caracteres, incluindo maiúscula, minúscula, número e símbolo.');
 }
 return value;
}
module.exports = {options,str,email,money,pick,id,date,daysBetween,password};
