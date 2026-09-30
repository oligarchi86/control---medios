"use strict";

const KEY="control_medios_pwa_v6";
const OLD_KEYS=["control_medios_pwa_v4","control_medios_pwa_v3"];
const DEFAULT_LOCATIONS=["Almacén","Estudio 1","Estudio 2","Control","Oficina"];

const $=id=>document.getElementById(id);
const now=()=>new Date().toISOString();
const uid=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const currentUser=()=>sessionStorage.getItem("cm_user")||"";
const logged=()=>sessionStorage.getItem("cm_login")==="1";
let db=null;

function defaultDB(){
 return {version:5,equipment:[],movements:[],loans:[],users:[{u:"admin",p:"admin123",role:"admin",active:true,created:now()}],locations:[...DEFAULT_LOCATIONS],audit:[]};
}
function normalize(d){
 const x=d||defaultDB();
 x.version=5;
 x.equipment=Array.isArray(x.equipment)?x.equipment:[];
 x.movements=Array.isArray(x.movements)?x.movements:[];
 x.loans=Array.isArray(x.loans)?x.loans:[];
 x.users=Array.isArray(x.users)&&x.users.length?x.users:[{u:"admin",p:"admin123",role:"admin",active:true,created:now()}];
 x.locations=Array.isArray(x.locations)&&x.locations.length?x.locations:DEFAULT_LOCATIONS.slice();
 x.audit=Array.isArray(x.audit)?x.audit:[];
 x.users.forEach(u=>{if(!u.role)u.role=u.u==="admin"?"admin":"operador";if(u.active===undefined)u.active=true});
 x.equipment.forEach(e=>{
   if(!e.id)e.id=uid();
   if(!e.status)e.status="Disponible";
   if(!e.location)e.location=x.locations[0]||"Almacén";
   if(!e.updated)e.updated=now();
 });
 return x;
}
function loadDB(){
 let d=null;
 try{d=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
 if(!d) for(const k of OLD_KEYS){try{d=JSON.parse(localStorage.getItem(k)||"null");if(d)break}catch(e){}}
 db=normalize(d);
 saveDB();
}
function saveDB(){localStorage.setItem(KEY,JSON.stringify(db))}
function role(){const u=db.users.find(x=>x.u===currentUser());return u?.role||"consulta"}
function canEdit(){return role()==="admin"||role()==="operador"}
function isAdmin(){return role()==="admin"}
function audit(action,detail=""){
 db.audit.push({id:uid(),date:now(),user:currentUser(),action,detail});
 if(db.audit.length>3000)db.audit=db.audit.slice(-3000);
}
function download(name,data,type){
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function csv(rows){
 return rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");
}
async function hashPassword(p){
 if(window.crypto?.subtle){
   const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(p));
   return "sha256:"+[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
 }
 return p;
}
async function verifyPassword(user,p){
 if(user.p?.startsWith("sha256:")) return user.p===(await hashPassword(p));
 return user.p===p;
}
async function setPassword(user,p){user.p=await hashPassword(p)}

function render(){
 if(!logged())return;
 const q=($("search").value||"").toLowerCase().trim();
 const sf=$("statusFilter").value, lf=$("locationFilter").value;
 const a=db.equipment.filter(e=>{
   const text=Object.values(e).join(" ").toLowerCase();
   return (!q||text.includes(q))&&(!sf||e.status===sf)&&(!lf||e.location===lf);
 });
 $("countTotal").textContent=db.equipment.length;
 $("countAvailable").textContent=db.equipment.filter(e=>e.status==="Disponible").length;
 $("countLoaned").textContent=db.equipment.filter(e=>e.status==="Prestado").length;
 $("countMaintenance").textContent=db.equipment.filter(e=>e.status==="En mantenimiento").length;
 $("list").innerHTML=a.length?a.map(card).join(""):'<div class="empty">No hay equipos que coincidan.</div>';
 fillLocationFilters();
 applyPermissions();
}
function card(e){
 const loan=db.loans.find(l=>l.equipment===e.id&&!l.returned);
 const photo=e.photo?`<img class="thumb" src="${e.photo}" alt="">`:`<div class="thumb"></div>`;
 const loanText=loan?`<br>Prestado a: ${esc(loan.borrower)}`:"";
 const edit=canEdit()?`<button onclick="openEquipment('${e.id}')">Editar</button>`:"";
 const move=canEdit()?`<button class="secondary" onclick="openMove('${e.id}')">Mover</button>`:"";
 const loanBtn=e.status==="Prestado"
   ?(canEdit()?`<button class="secondary" onclick="openReturn('${e.id}')">Devolver</button>`:"")
   :(e.status==="Disponible"&&canEdit()?`<button class="secondary" onclick="openLoan('${e.id}')">Prestar</button>`:"");
 return `<article class="item">${photo}<div><h3>${esc(e.name)} <span class="badge">${esc(e.status)}</span></h3><div class="meta">${esc(e.category)} ${esc(e.brand)} ${esc(e.model)}<br>Serie: ${esc(e.serial)}<br>Inventario: ${esc(e.inventory)}<br>Ubicación: ${esc(e.location)}${loanText}</div><div class="actions">${edit}${move}${loanBtn}<button class="secondary" onclick="showHistory('${e.id}')">Historial</button><button class="secondary" onclick="showQR('${e.id}')">QR</button></div></div></article>`;
}
function fillLocationFilters(){
 const selected=$("locationFilter").value;
 $("locationFilter").innerHTML='<option value="">Todas las ubicaciones</option>'+db.locations.map(x=>`<option>${esc(x)}</option>`).join("");
 if(db.locations.includes(selected))$("locationFilter").value=selected;
 $("location").innerHTML=db.locations.map(x=>`<option>${esc(x)}</option>`).join("");
 $("newLocation").innerHTML=db.locations.map(x=>`<option>${esc(x)}</option>`).join("");
 $("returnLocation").innerHTML=db.locations.map(x=>`<option>${esc(x)}</option>`).join("");
}
function applyPermissions(){
 $("usersBtn").classList.toggle("hidden",!isAdmin());
 $("importBtn").classList.toggle("hidden",!isAdmin());
 $("currentUserLabel").textContent=currentUser();
 $("roleLabel").textContent=role();
}
function updateView(){
 const ok=logged();
 $("loginView").classList.toggle("hidden",ok);
 $("appView").classList.toggle("hidden",!ok);
 if(ok){fillLocationFilters();render()}
}

$("loginBtn").onclick=async()=>{
 const u=$("loginUser").value.trim(),p=$("loginPass").value;
 const account=db.users.find(x=>x.u===u&&x.active!==false);
 if(account&&await verifyPassword(account,p)){
   if(!account.p.startsWith("sha256:"))await setPassword(account,p);
   audit("LOGIN","Inicio de sesión");
   saveDB();
   sessionStorage.setItem("cm_login","1");sessionStorage.setItem("cm_user",u);
   $("loginPass").value="";updateView();
 }else alert("Usuario o contraseña incorrectos");
};
$("loginPass").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").onclick=()=>{audit("LOGOUT","Cierre de sesión");saveDB();sessionStorage.clear();updateView()};
$("search").oninput=render;$("statusFilter").onchange=render;$("locationFilter").onchange=render;
$("newBtn").onclick=()=>{if(canEdit())openEquipment();else alert("Tu usuario no tiene permiso para crear equipos.")};
$("cancelEquipment").onclick=()=>$("equipmentDialog").close();

let pendingPhoto="";
$("photo").onchange=async()=>{
 const f=$("photo").files[0]; if(!f)return;
 const MAX_UPLOAD=20*1024*1024;
 if(f.size>MAX_UPLOAD){
   alert("La foto es demasiado grande. Máximo permitido: 20 MB.");
   $("photo").value="";return;
 }
 try{
   pendingPhoto=await preparePhoto(f);
   $("photoPreview").innerHTML=`<img class="preview" src="${pendingPhoto}" alt="">`;
 }catch(err){
   console.error(err);
   alert("No se pudo procesar la foto. Prueba con otra imagen.");
   $("photo").value="";
 }
};
function preparePhoto(file){
 return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=reject;
   reader.onload=()=>{
     const img=new Image();
     img.onerror=reject;
     img.onload=()=>{
       const MAX_SIDE=2000;
       const scale=Math.min(1,MAX_SIDE/Math.max(img.width,img.height));
       const w=Math.max(1,Math.round(img.width*scale));
       const h=Math.max(1,Math.round(img.height*scale));
       const canvas=document.createElement("canvas");
       canvas.width=w;canvas.height=h;
       const ctx=canvas.getContext("2d");
       ctx.drawImage(img,0,0,w,h);
       // JPEG keeps the local database small enough for phones while accepting originals up to 20 MB.
       let quality=.88;
       let data=canvas.toDataURL("image/jpeg",quality);
       while(data.length>3.5*1024*1024 && quality>.45){
         quality-=.08;
         data=canvas.toDataURL("image/jpeg",quality);
       }
       resolve(data);
     };
     img.src=reader.result;
   };
   reader.readAsDataURL(file);
 });
}
function openEquipment(id){
 $("equipmentForm").reset();pendingPhoto="";
 $("equipmentId").value=id||"";fillLocationFilters();
 $("location").value=db.locations[0]||"Almacén";$("status").value="Disponible";$("photoPreview").innerHTML="";
 $("dialogTitle").textContent=id?"Editar equipo":"Nuevo equipo";
 if(id){
   const e=db.equipment.find(x=>x.id===id);
   ["name","category","model","brand","serial","inventory","location","status"].forEach(k=>$(k).value=e[k]||"");
   if(e.photo){pendingPhoto=e.photo;$("photoPreview").innerHTML=`<img class="preview" src="${e.photo}" alt="">`}
 }
 $("equipmentDialog").showModal();
}
$("equipmentForm").onsubmit=e=>{
 e.preventDefault();if(!canEdit())return;
 const id=$("equipmentId").value||uid(), old=db.equipment.find(x=>x.id===id);
 const obj={id,name:$("name").value.trim(),category:$("category").value.trim(),model:$("model").value.trim(),brand:$("brand").value.trim(),serial:$("serial").value.trim(),inventory:$("inventory").value.trim(),location:$("location").value,status:$("status").value,photo:pendingPhoto||old?.photo||"",updated:now()};
 const i=db.equipment.findIndex(x=>x.id===id);
 if(i>=0){
   db.equipment[i]=obj;audit("EDITAR_EQUIPO",obj.name);
   if(old.location!==obj.location)db.movements.push({id:uid(),equipment:id,type:"MOVIMIENTO",from:old.location,to:obj.location,person:currentUser(),detail:"Cambio desde edición",date:now(),user:currentUser()});
 }else{db.equipment.push(obj);db.movements.push({id:uid(),equipment:id,type:"ALTA",date:now(),user:currentUser(),detail:"Alta de equipo"});audit("ALTA_EQUIPO",obj.name)}
 saveDB();$("equipmentDialog").close();render();
};

function openMove(id){
 if(!canEdit())return;
 const e=db.equipment.find(x=>x.id===id);fillLocationFilters();
 $("moveId").value=id;$("moveInfo").textContent=`${e.name} — ubicación actual: ${e.location}`;
 $("newLocation").value=db.locations.find(x=>x!==e.location)||e.location;$("movePerson").value=currentUser();$("moveNote").value="";$("moveDialog").showModal();
}
$("cancelMove").onclick=()=>$("moveDialog").close();
$("moveForm").onsubmit=e=>{
 e.preventDefault();const x=db.equipment.find(x=>x.id===$("moveId").value),to=$("newLocation").value,from=x.location;
 if(from===to){alert("La ubicación nueva es igual a la actual.");return}
 x.location=to;x.updated=now();db.movements.push({id:uid(),equipment:x.id,type:"MOVIMIENTO",from,to,person:$("movePerson").value.trim(),detail:$("moveNote").value.trim(),date:now(),user:currentUser()});
 audit("MOVER_EQUIPO",`${x.name}: ${from} → ${to}`);saveDB();$("moveDialog").close();render();
};

function openLoan(id){
 if(!canEdit())return;
 const e=db.equipment.find(x=>x.id===id);$("loanId").value=id;$("loanInfo").textContent=`Equipo: ${e.name} — ${e.inventory}`;$("borrower").value="";$("destination").value="";$("dueDate").value="";$("loanNote").value="";$("loanDialog").showModal();
}
$("cancelLoan").onclick=()=>$("loanDialog").close();
$("loanForm").onsubmit=e=>{
 e.preventDefault();const x=db.equipment.find(x=>x.id===$("loanId").value);if(!x||x.status!=="Disponible")return;
 const loan={id:uid(),equipment:x.id,borrower:$("borrower").value.trim(),destination:$("destination").value.trim(),dueDate:$("dueDate").value,note:$("loanNote").value.trim(),date:now(),returned:false,user:currentUser()};
 db.loans.push(loan);x.status="Prestado";x.updated=now();
 db.movements.push({id:uid(),equipment:x.id,type:"PRESTAMO",person:loan.borrower,to:loan.destination,detail:loan.note,date:now(),user:currentUser()});
 audit("PRESTAMO",`${x.name} → ${loan.borrower}`);saveDB();$("loanDialog").close();render();
};
function openReturn(id){
 if(!canEdit())return;
 const e=db.equipment.find(x=>x.id===id),loan=db.loans.find(l=>l.equipment===id&&!l.returned);fillLocationFilters();
 $("returnId").value=id;$("returnInfo").textContent=loan?`Prestado a: ${loan.borrower}`:`Equipo: ${e.name}`;$("returnLocation").value=e.location;$("returnNote").value="";$("returnDialog").showModal();
}
$("cancelReturn").onclick=()=>$("returnDialog").close();
$("returnForm").onsubmit=e=>{
 e.preventDefault();const id=$("returnId").value,x=db.equipment.find(x=>x.id===id),loan=db.loans.find(l=>l.equipment===id&&!l.returned);
 if(loan)loan.returned=true,loan.returnDate=now(),loan.returnUser=currentUser();
 x.status="Disponible";x.location=$("returnLocation").value;x.updated=now();
 db.movements.push({id:uid(),equipment:id,type:"DEVOLUCION",from:"Préstamo",to:x.location,person:currentUser(),detail:$("returnNote").value.trim(),date:now(),user:currentUser()});
 audit("DEVOLUCION",x.name);saveDB();$("returnDialog").close();render();
};

function showQR(id){
 const e=db.equipment.find(x=>x.id===id);$("qrTitle").textContent="QR — "+e.name;$("qrText").textContent=`Inventario: ${e.inventory} | Serie: ${e.serial}`;
 if(window.QRCode){QRCode.toCanvas($("qrCanvas"),`CONTROL-MEDIOS|ID:${e.id}|INV:${e.inventory}|SERIE:${e.serial}`,{width:260,margin:2},()=>{});$("qrDialog").showModal()}
 else alert("No se pudo cargar el generador QR. Comprueba la conexión a Internet.");
}
$("closeQR").onclick=()=>$("qrDialog").close();
$("downloadQR").onclick=()=>{const a=document.createElement("a");a.href=$("qrCanvas").toDataURL("image/png");a.download="QR_"+Date.now()+".png";a.click()};

function showHistory(id){
 const e=db.equipment.find(x=>x.id===id);$("historyTitle").textContent=`Historial — ${e?.name||"Equipo"}`;
 const events=[
   ...db.movements.filter(m=>m.equipment===id),
   ...db.loans.filter(l=>l.equipment===id).map(l=>({type:l.returned?"DEVOLUCION":"PRESTAMO",date:l.returnDate||l.date,user:l.user,detail:`${l.borrower}${l.destination?" → "+l.destination:""}`}))
 ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $("historyList").innerHTML=events.length?events.map(m=>`<div class="historyItem"><b>${esc(m.type)}</b><br>${new Date(m.date).toLocaleString()} — ${esc(m.user||m.person||"")}<br>${esc(m.detail||"")}${m.from?`<br>${esc(m.from)} → ${esc(m.to)}`:""}</div>`).join(""):"<p class='empty'>Sin movimientos.</p>";
 $("historyDialog").showModal();
}
$("historyBtn").onclick=()=>{if(!logged())return;$("historyTitle").textContent="Historial y auditoría";const all=[...db.audit].sort((a,b)=>b.date.localeCompare(a.date));$("historyList").innerHTML=all.length?all.slice(0,500).map(a=>`<div class="historyItem"><b>${esc(a.action)}</b><br>${new Date(a.date).toLocaleString()} — ${esc(a.user)}<br>${esc(a.detail)}</div>`).join(""):"<p class='empty'>Sin registros.</p>";$("historyDialog").showModal()};
$("closeHistory").onclick=()=>$("historyDialog").close();

$("exportBtn").onclick=()=>{
 const rows=[["ID","Nombre","Categoría","Modelo","Marca","Serie","Inventario","Ubicación","Estado","Actualizado"],...db.equipment.map(e=>[e.id,e.name,e.category,e.model,e.brand,e.serial,e.inventory,e.location,e.status,e.updated])];
 download("inventario_medios.csv",csv(rows),"text/csv;charset=utf-8");
};
$("exportHistoryBtn").onclick=()=>{
 const rows=[["Fecha","Usuario","Equipo","Tipo","Desde","Hasta","Responsable","Detalle"],...db.movements.map(m=>[m.date,m.user||"",db.equipment.find(e=>e.id===m.equipment)?.name||"",m.type,m.from||"",m.to||"",m.person||"",m.detail||""])];
 download("historial_medios.csv",csv(rows),"text/csv;charset=utf-8");
};
$("backupBtn").onclick=()=>download("control_medios_backup_"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(db,null,2),"application/json");
$("importBtn").onclick=()=>{if(isAdmin())$("importFile").click()};
$("importFile").onchange=()=>{
 const f=$("importFile").files[0];if(!f)return;const r=new FileReader();
 r.onload=()=>{
  try{
   const incoming=normalize(JSON.parse(r.result));
   if(!confirm("Esto reemplazará los datos actuales por la copia seleccionada. ¿Continuar?"))return;
   db=incoming;audit("RESTAURAR_COPIA","Restauración de respaldo");saveDB();render();alert("Copia restaurada correctamente.");
  }catch(e){alert("La copia no es válida.")}
 };r.readAsText(f);
};

function renderUsers(){
 $("usersList").innerHTML=db.users.map((u,i)=>`<div class="userRow"><b>${esc(u.u)}</b><select onchange="changeRole(${i},this.value)"><option value="admin" ${u.role==="admin"?"selected":""}>Administrador</option><option value="operador" ${u.role==="operador"?"selected":""}>Operador</option><option value="consulta" ${u.role==="consulta"?"selected":""}>Consulta</option></select><button class="secondary" onclick="toggleUser(${i})">${u.active===false?"Activar":"Desactivar"}</button>${u.u!=="admin"?`<button class="danger" onclick="deleteUser(${i})">Eliminar</button>`:""}</div>`).join("");
}
window.changeRole=(i,v)=>{if(!isAdmin())return;db.users[i].role=v;audit("CAMBIAR_ROL",db.users[i].u+" → "+v);saveDB();renderUsers()};
window.toggleUser=i=>{if(!isAdmin()||db.users[i].u===currentUser())return;db.users[i].active=db.users[i].active===false;saveDB();renderUsers()};
window.deleteUser=i=>{if(!isAdmin()||db.users[i].u==="admin"||db.users[i].u===currentUser())return;if(confirm("¿Eliminar usuario?")){audit("ELIMINAR_USUARIO",db.users[i].u);db.users.splice(i,1);saveDB();renderUsers()}};
$("usersBtn").onclick=()=>{if(!isAdmin())return;renderUsers();$("usersDialog").showModal()};
$("closeUsers").onclick=()=>$("usersDialog").close();
$("userForm").onsubmit=async e=>{
 e.preventDefault();if(!isAdmin())return;
 const u=$("newUsername").value.trim(),p=$("newUserPassword").value,r=$("newUserRole").value;
 if(!u||p.length<6){alert("Usuario y contraseña son obligatorios; mínimo 6 caracteres.");return}
 if(db.users.some(x=>x.u===u)){alert("Ese usuario ya existe.");return}
 const account={u,p:"",role:r,active:true,created:now()};await setPassword(account,p);db.users.push(account);audit("CREAR_USUARIO",u+" ("+r+")");saveDB();$("newUsername").value="";$("newUserPassword").value="";renderUsers();alert("Usuario creado.");
};

function renderLocations(){
 $("locationsList").innerHTML=db.locations.map((x,i)=>`<div class="userRow"><b>${esc(x)}</b>${db.locations.length>1?`<button class="danger" onclick="deleteLocation(${i})">Eliminar</button>`:""}</div>`).join("");
}
window.deleteLocation=i=>{
 if(!isAdmin())return;const loc=db.locations[i];
 if(db.equipment.some(e=>e.location===loc)){alert("No puedes eliminar una ubicación que tiene equipos. Mueve primero esos equipos.");return}
 if(confirm("¿Eliminar ubicación?")){db.locations.splice(i,1);audit("ELIMINAR_UBICACION",loc);saveDB();renderLocations();fillLocationFilters();render()}
};
$("locationsBtn").onclick=()=>{renderLocations();$("locationsDialog").showModal()};
$("closeLocations").onclick=()=>$("locationsDialog").close();
$("locationsForm").onsubmit=e=>{
 e.preventDefault();if(!isAdmin())return;const n=$("newLocationName").value.trim();
 if(!n)return;if(db.locations.some(x=>x.toLowerCase()===n.toLowerCase())){alert("La ubicación ya existe.");return}
 db.locations.push(n);audit("CREAR_UBICACION",n);saveDB();$("newLocationName").value="";renderLocations();fillLocationFilters();
};

$("passwordBtn").onclick=()=>{$("currentPassword").value="";$("newPassword").value="";$("repeatPassword").value="";$("passwordDialog").showModal()};
$("cancelPassword").onclick=()=>$("passwordDialog").close();
$("passwordForm").onsubmit=async e=>{
 e.preventDefault();const cur=$("currentPassword").value,np=$("newPassword").value,rp=$("repeatPassword").value;
 const u=db.users.find(x=>x.u===currentUser());
 if(!u||!(await verifyPassword(u,cur))){alert("La contraseña actual no es correcta.");return}
 if(np.length<6){alert("La nueva contraseña debe tener al menos 6 caracteres.");return}
 if(np!==rp){alert("Las nuevas contraseñas no coinciden.");return}
 await setPassword(u,np);audit("CAMBIAR_CONTRASEÑA","");saveDB();$("passwordDialog").close();alert("Contraseña cambiada correctamente.");
};

loadDB();updateView();
