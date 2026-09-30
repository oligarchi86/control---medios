const KEY="control_medios_pwa_v1";
let db=JSON.parse(localStorage.getItem(KEY)||'{"equipment":[],"movements":[],"users":[{"u":"admin","p":"admin123"}]}');
let photoData="";
const $=id=>document.getElementById(id);
const saveDB=()=>localStorage.setItem(KEY,JSON.stringify(db));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function logged(){return sessionStorage.getItem("cm_login")==="1"}
function showApp(){ $("loginView").hidden=true;$("appView").hidden=!logged(); if(logged()) render();}
$("loginBtn").onclick=()=>{let u=$("loginUser").value.trim(),p=$("loginPass").value;if(db.users.some(x=>x.u===u&&x.p===p)){sessionStorage.setItem("cm_login","1");showApp()}else alert("Usuario o contraseña incorrectos")};
$("logoutBtn").onclick=()=>{sessionStorage.clear();showApp()};
$("newBtn").onclick=()=>openEquipment();
$("search").oninput=render;
$("exportBtn").onclick=exportCSV;
$("backupBtn").onclick=()=>download("control_medios_backup.json",JSON.stringify(db,null,2),"application/json");

function openEquipment(id){
  photoData="";
  $("equipmentForm").reset(); $("location").value="Almacén"; $("status").value="Disponible";
  $("equipmentId").value=id||"";
  if(id){let e=db.equipment.find(x=>x.id===id);$("dialogTitle").textContent="Editar equipo";for(const k of ["name","category","model","brand","serial","inventory","location","status"])$(k).value=e[k]||"";photoData=e.photo||"";showPhoto()}
  else {$("dialogTitle").textContent="Nuevo equipo";$("photoPreview").innerHTML=""}
  $("equipmentDialog").showModal();
}
$("photo").onchange=async e=>{let f=e.target.files[0];if(!f)return;photoData=await resizeImage(f);showPhoto()};
function showPhoto(){$("photoPreview").innerHTML=photoData?`<img src="${photoData}" style="max-width:100%;max-height:180px;border-radius:10px">`:""}
function resizeImage(file){return new Promise(r=>{let img=new Image(),c=document.createElement("canvas");img.onload=()=>{let max=900,s=Math.min(1,max/img.width,max/img.height);c.width=img.width*s;c.height=img.height*s;c.getContext("2d").drawImage(img,0,0,c.width,c.height);r(c.toDataURL("image/jpeg",.72))};img.src=URL.createObjectURL(file)})}
$("equipmentForm").onsubmit=e=>{e.preventDefault();let id=$("equipmentId").value||crypto.randomUUID();let obj={id,name:$("name").value.trim(),category:$("category").value.trim(),model:$("model").value.trim(),brand:$("brand").value.trim(),serial:$("serial").value.trim(),inventory:$("inventory").value.trim(),location:$("location").value.trim(),status:$("status").value,photo:photoData,updated:new Date().toISOString()};let old=db.equipment.findIndex(x=>x.id===id);if(old>=0)db.equipment[old]=obj;else{db.equipment.push(obj);db.movements.push({id:crypto.randomUUID(),equipment:id,type:"ALTA",date:new Date().toISOString(),detail:"Equipo registrado"})}saveDB();$("equipmentDialog").close();render()};

function render(){let q=$("search").value.toLowerCase();let a=db.equipment.filter(e=>Object.values(e).join(" ").toLowerCase().includes(q));$("countTotal").textContent=db.equipment.length;$("countAvailable").textContent=db.equipment.filter(e=>e.status==="Disponible").length;$("countLoaned").textContent=db.equipment.filter(e=>e.status==="Prestado").length;$("list").innerHTML=a.length?a.map(card).join(""):`<div class="empty">No hay equipos registrados.</div>`}
function card(e){return `<article class="item"><img class="thumb" src="${e.photo||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2276%22 height=%2276%22%3E%3Crect width=%2276%22 height=%2276%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%2238%22 y=%2242%22 text-anchor=%22middle%22 font-size=%2210%22 fill=%22%236b7280%22%3ESIN FOTO%3C/text%3E%3C/svg%3E'}"><div><h3>${esc(e.name)} <span class="badge">${esc(e.status)}</span></h3><div class="meta">${esc(e.brand)} ${esc(e.model)}<br>Serie: ${esc(e.serial)}<br>Inventario: ${esc(e.inventory)}<br>Ubicación: ${esc(e.location)}</div><div class="actions"><button onclick="openEquipment('${e.id}')">Editar</button>${e.status==="Prestado"?`<button class="secondary" onclick="returnEquipment('${e.id}')">Devolver</button>`:`<button class="secondary" onclick="openLoan('${e.id}')">Prestar</button>`}<button class="secondary" onclick="showHistory('${e.id}')">Historial</button></div></div></article>`}
function openLoan(id){$("loanForm").reset();$("loanId").value=id;$("loanDialog").showModal()}
$("loanForm").onsubmit=e=>{e.preventDefault();let id=$("loanId").value,x=db.equipment.find(x=>x.id===id);x.status="Prestado";db.movements.push({id:crypto.randomUUID(),equipment:id,type:"PRESTAMO",person:$("loanPerson").value,destination:$("loanDestination").value,due:$("loanDue").value,date:new Date().toISOString()});saveDB();$("loanDialog").close();render()}
function returnEquipment(id){let x=db.equipment.find(x=>x.id===id);x.status="Disponible";db.movements.push({id:crypto.randomUUID(),equipment:id,type:"DEVOLUCION",date:new Date().toISOString()});saveDB();render()}
function showHistory(id){let e=db.equipment.find(x=>x.id===id),m=db.movements.filter(x=>x.equipment===id).sort((a,b)=>b.date.localeCompare(a.date));alert(`HISTORIAL: ${e.name}\n\n`+m.map(x=>`${new Date(x.date).toLocaleString()} — ${x.type}${x.person?" — "+x.person:""}${x.destination?" — "+x.destination:""}`).join("\n"))}
function exportCSV(){let rows=[["Nombre","Categoría","Modelo","Marca","Serie","Inventario","Ubicación","Estado"],...db.equipment.map(e=>[e.name,e.category,e.model,e.brand,e.serial,e.inventory,e.location,e.status])];download("inventario_medios.csv",rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv")}
function download(name,data,type){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
let stream=null,scanTimer=null;
$("scanBtn").onclick=async()=>{if(!("BarcodeDetector" in window)){alert("Este navegador no ofrece BarcodeDetector. Puedes usar el campo Inventario manualmente o una versión con biblioteca de escaneo.");return}try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});$("video").srcObject=stream;$("scanner").hidden=false;let detector=new BarcodeDetector({formats:["qr_code","code_128","ean_13","ean_8"]});scanTimer=setInterval(async()=>{try{let codes=await detector.detect($("video"));if(codes[0]){let value=codes[0].rawValue;$("search").value=value;render();stopScan()}}catch{}},500)}catch(e){alert("No se pudo abrir la cámara. Comprueba el permiso de cámara.")}};
function stopScan(){clearInterval(scanTimer);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$("scanner").hidden=true}
$("stopScan").onclick=stopScan;
let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}};
showApp();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));