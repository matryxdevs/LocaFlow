'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const canvas=document.getElementById('rental-chart');if(!canvas)return;
 const labels=JSON.parse(canvas.dataset.labels||'[]'),values=JSON.parse(canvas.dataset.values||'[]');
 const draw=()=>{
  const rect=canvas.getBoundingClientRect();
  if(rect.width<30||rect.height<30)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const width=rect.width,height=rect.height;
  const pad={left:27,right:8,top:13,bottom:36};const ph=height-pad.top-pad.bottom,pw=width-pad.left-pad.right;
  const top=Math.max(4,...values)*1.12;
  ctx.font='11px system-ui,sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){
   const y=pad.top+ph*i/4;ctx.strokeStyle='#edf1ef';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();ctx.fillStyle='#a5b2b0';ctx.fillText(String(Math.round(top*(4-i)/4)),pad.left-9,y);
  }
  const step=pw/Math.max(1,values.length);const bar=Math.min(43,step*.52);
  values.forEach((v,i)=>{
   const x=pad.left+step*i+step/2;
   const h=Math.max(v===0?2:5,v/top*ph);
   const y=pad.top+ph-h;
   const grad=ctx.createLinearGradient(0,y,0,pad.top+ph);grad.addColorStop(0,'#3aaf82');grad.addColorStop(1,'#b2e6cf');
   ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x-bar/2,y,bar,h,[6,6,2,2]);ctx.fill();
   ctx.fillStyle='#899f9d';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(labels[i]||'',x,height-11);
   if(v){ctx.fillStyle='#2d6757';ctx.font='bold 10px system-ui,sans-serif';ctx.fillText(String(v),x,Math.max(10,y-7));ctx.font='11px system-ui,sans-serif';}
  });
 };
 draw();const observer=new ResizeObserver(draw);observer.observe(canvas);
});
