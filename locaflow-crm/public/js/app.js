'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const menu=document.getElementById('menu-button');
 const sidebar=document.getElementById('sidebar');
 const overlay=document.getElementById('mobile-overlay');
 const closeMenu=()=>{sidebar?.classList.remove('open');overlay?.classList.remove('show');menu?.setAttribute('aria-expanded','false')};
 menu?.addEventListener('click',()=>{const open=!sidebar.classList.contains('open');sidebar.classList.toggle('open',open);overlay.classList.toggle('show',open);menu.setAttribute('aria-expanded',String(open))});
 overlay?.addEventListener('click',closeMenu);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
 document.querySelectorAll('form[data-confirm]').forEach(form=>form.addEventListener('submit',event=>{
  if(!window.confirm(form.dataset.confirm||'Confirmar operação?'))event.preventDefault();
 }));
 const vehicle=document.getElementById('vehicle_id');
 const rate=document.getElementById('daily_rate');
 const start=document.getElementById('start_date');
 const end=document.getElementById('end_date');
 const target=document.getElementById('estimated-total');
 if(vehicle && rate && start && end && target){
  const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const calc=()=>{
   const n=Number(rate.value);
   const d1=new Date(start.value+'T00:00:00Z').getTime();
   const d2=new Date(end.value+'T00:00:00Z').getTime();
   const days=Math.round((d2-d1)/86400000);
   const total=Number.isFinite(n)&&Number.isFinite(days)&&days>0?n*days:0;
   target.textContent=formatter.format(total);
   const span=document.createElement('span');span.textContent=days>0?`${days} diária(s)`:'valor calculado';target.appendChild(span);
  };
  vehicle.addEventListener('change',()=>{rate.value=vehicle.selectedOptions[0]?.dataset.rate||'';calc()});
  [rate,start,end].forEach(el=>el.addEventListener('input',calc));
 }
});
// Atualiza o destino da redefinição de senha conforme o usuário selecionado.
document.addEventListener('DOMContentLoaded',()=>{
 const select=document.getElementById('reset-user'),form=document.getElementById('reset-team-form');
 if(select&&form)select.addEventListener('change',()=>{
  if(/^\d+$/.test(select.value))form.action='/equipe/'+select.value+'/reset';
 });
});
