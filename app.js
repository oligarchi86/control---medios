"use strict";
const KEY="control_medios_pwa_v4";
const OLD_KEY="control_medios_pwa_v3";
let db;
try{db=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){db=null}
if(!db){
  try{db=JSON.parse(localStorage.getItem(OLD_KEY)||"null")}catch(e){db=null}
}
if(!db) db={equipment:[],movements:[],users:[{u:"admin",p:"admin123"}]};
if(!Array.isArray(db.users)||!db.users.length) db.users=[{u:"admin",p:"admin123"}];

const $=id=>document.getElementById(id);
const saveDB=()=>localStorage.setItem(KEY,JSON.stringify(db));
const logged=()=>sessionStorage.getItem("cm_login")==="1";
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function render(){
  const q=($("search").value||"").toLowerCase();
  const a=db.equipment.filter(e=>Object.values(e).join(" ").toLowerCase().includes(q));
  $("countTotal").textContent=db.equipment.length;
  $("countAvailable").textContent=db.equipment.filter(e=>e.status==="Disponible").length;
  $("countLoaned").textContent=db.equipment.filter(e=>e.status==="Prestado").length;
  $("list").innerHTML=a.length?a.map(card).join(""):'<div class="empty">No hay equipos registrados.</div>';
}
function card(e){
 return `<article class="item"><div class="thumb"></div><div><h3>${esc(e.name)} <span class="badge">${esc(e.status)}</span></h3><div class="meta">${esc(e.brand)} ${esc(e.model)}<br>Serie: ${esc(e.serial)}<br>Inventario: ${esc(e.inventory)}<br>Ubicación: ${esc(e.location)}</div><div class="actions"><button onclick="openEquipment('${e.id}')">Editar</button><button class="secondary" onclick="openMove('${e.id}')">Mover</button><button class="secondary" onclick="showQR('${e.id}')">QR</button></div></div></article>`;
}
function updateView(){
  const isLogged=logged();
  $("loginView").classList.toggle("hidden",isLogged);
  $("appView").classList.toggle("hidden",!isLogged);
  if(isLogged) render();
}
$("loginBtn").addEventListener("click",()=>{
 const u=$("loginUser").value.trim(),p=$("loginPass").value;
 if(db.users.some(x=>x.u===u&&x.p===p)){
   sessionStorage.setItem("cm_login","1");
   sessionStorage.setItem("cm_user",u);
   updateView();
 } else alert("Usuario o contraseña incorrectos");
});
$("logoutBtn").addEventListener("click",()=>{
 sessionStorage.removeItem("cm_login");
 sessionStorage.removeItem("cm_user");
 updateView();
});
$("search").addEventListener("input",render);
$("newBtn").addEventListener("click",()=>openEquipment());
$("cancelEquipment").addEventListener("click",()=>$("equipmentDialog").close());
$("exportBtn").addEventListener("click",()=>{
 const rows=[["Nombre","Categoría","Modelo","Marca","Serie","Inventario","Ubicación","Estado"],...db.equipment.map(e=>[e.name,e.category,e.model,e.brand,e.serial,e.inventory,e.location,e.status])];
 download("inventario_medios.csv",rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n"),"text/csv");
});
$("backupBtn").addEventListener("click",()=>download("control_medios_backup.json",JSON.stringify(db,null,2),"application/json"));
function openEquipment(id){
 $("equipmentForm").reset();
 $("equipmentId").value=id||"";
 $("location").value="Almacén";
 $("status").value="Disponible";
 $("dialogTitle").textContent=id?"Editar equipo":"Nuevo equipo";
 if(id){
   const e=db.equipment.find(x=>x.id===id);
   ["name","category","model","brand","serial","inventory","location","status"].forEach(k=>$(k).value=e[k]||"");
 }
 $("equipmentDialog").showModal();
}
$("equipmentForm").addEventListener("submit",e=>{
 e.preventDefault();
 const id=$("equipmentId").value||Date.now().toString();
 const obj={id,name:$("name").value.trim(),category:$("category").value.trim(),model:$("model").value.trim(),brand:$("brand").value.trim(),serial:$("serial").value.trim(),inventory:$("inventory").value.trim(),location:$("location").value.trim(),status:$("status").value,updated:new Date().toISOString()};
 const i=db.equipment.findIndex(x=>x.id===id);
 if(i>=0)db.equipment[i]=obj;else{db.equipment.push(obj);db.movements.push({equipment:id,type:"ALTA",date:new Date().toISOString()});}
 saveDB();$("equipmentDialog").close();render();
});
function download(name,data,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();}

function openMove(id){const e=db.equipment.find(x=>x.id===id);$("moveId").value=id;$("moveInfo").textContent="Ubicación actual: "+e.location;$("newLocation").value="";$("movePerson").value="";$("moveNote").value="";$("moveDialog").showModal()}
$("cancelMove").onclick=()=>$("moveDialog").close();
$("moveForm").onsubmit=e=>{e.preventDefault();const id=$("moveId").value,x=db.equipment.find(x=>x.id===id),from=x.location,to=$("newLocation").value.trim();if(!to)return;x.location=to;db.movements.push({equipment:id,type:"MOVIMIENTO",from,to,person:$("movePerson").value.trim(),detail:$("moveNote").value.trim(),date:new Date().toISOString()});saveDB();$("moveDialog").close();render()};
function showQR(id){const e=db.equipment.find(x=>x.id===id);$("qrTitle").textContent="QR — "+e.name;$("qrText").textContent="Inventario: "+e.inventory+" | Serie: "+e.serial;if(window.QRCode){QRCode.toCanvas($("qrCanvas"),"CONTROL-MEDIOS|ID:"+e.id+"|INV:"+e.inventory+"|SERIE:"+e.serial,{width:260,margin:2},()=>{});$("qrDialog").showModal()}else alert("No se pudo cargar el generador QR. Comprueba la conexión a Internet.")}
$("closeQR").onclick=()=>$("qrDialog").close();
$("downloadQR").onclick=()=>{const a=document.createElement("a");a.href=$("qrCanvas").toDataURL("image/png");a.download="QR_"+Date.now()+".png";a.click()};
function openPasswordDialog(){
  $("currentPassword").value="";
  $("newPassword").value="";
  $("repeatPassword").value="";
  $("passwordDialog").showModal();
}
$("passwordBtn").onclick=openPasswordDialog;
$("cancelPassword").onclick=()=>$("passwordDialog").close();
$("passwordForm").onsubmit=e=>{
  e.preventDefault();
  const cur=$("currentPassword").value;
  const np=$("newPassword").value;
  const rp=$("repeatPassword").value;
  const user=sessionStorage.getItem("cm_user")||"admin";
  const account=db.users.find(x=>x.u===user);
  if(!account || account.p!==cur){alert("La contraseña actual no es correcta.");return;}
  if(np.length<6){alert("La nueva contraseña debe tener al menos 6 caracteres.");return;}
  if(np!==rp){alert("Las nuevas contraseñas no coinciden.");return;}
  account.p=np;
  saveDB();
  $("passwordDialog").close();
  alert("Contraseña cambiada correctamente.");
};

updateView();
