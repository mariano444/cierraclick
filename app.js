let STORAGE_KEY = "cierraclick_mvp_v1";

const defaultState = {
  business: {
    name: "CierraClick Demo",
    whatsapp: "5493518145289",
    paymentLink: "",
    brandColor: "#0b1220"
  },
  proposals: [
    {
      id: "demo-1",
      client: {name:"Juan Pérez", phone:"5493515551234"},
      title: "Propuesta de servicio",
      validity: "7 días",
      includes: ["Instalación","Materiales principales","Soporte inicial"],
      conditions: "La propuesta queda vigente durante 7 días. La reserva se confirma con la seña.",
      options: [
        {id:"basic",name:"Básica",price:850000,installments:6,service:"Servicio básico",warranty:"3 meses"},
        {id:"recommended",name:"Recomendada",price:1050000,installments:8,service:"Servicio completo",warranty:"6 meses"},
        {id:"premium",name:"Premium",price:1350000,installments:12,service:"Servicio premium",warranty:"12 meses"}
      ],
      status:"viewed",
      views:3,
      chosenOption:"recommended",
      createdAt: new Date(Date.now()-45*60*1000).toISOString(),
      acceptedAt:null,
      depositStarted:0,
      lastEvent:"Cliente miró la opción recomendada."
    }
  ],
  clients: [{name:"Juan Pérez",phone:"5493515551234",proposals:1}],
  activity: [
    {icon:"👀", text:"Juan Pérez vio la propuesta 3 veces.", time:"Hace 4 min"},
    {icon:"⭐", text:"Juan Pérez miró la opción recomendada.", time:"Hace 6 min"},
    {icon:"📨", text:"Propuesta enviada por WhatsApp.", time:"Hace 45 min"}
  ]
};

const KINDS={
  product:{title:"Propuesta de producto",includes:"Entrega\nFactura\nGarantía oficial",ph:"Ej: Heladera 400 L color acero"},
  service:{title:"Propuesta de servicio",includes:"Instalación\nMateriales principales\nSoporte inicial",ph:"Ej: Servicio completo"}
};
const MAX_OPTIONS=4;
const newOption=(o={})=>({id:`o-${Math.random().toString(36).slice(2,8)}`,name:"",price:0,discountType:"percent",discountValue:0,description:"",hasInstallments:false,installments:3,hasWarranty:false,warranty:"",features:"",terms:"",recommended:false,...o});
function discountAmount(o){
  const pr=Number(o.price)||0, v=Math.max(0,Number(o.discountValue)||0);
  return Math.min(pr,o.discountType==="percent"?pr*Math.min(v,100)/100:v);
}
const finalPrice=o=>Math.max(0,(Number(o.price)||0)-discountAmount(o));
// Migra propuestas guardadas con el formato viejo (service/warranty/installments fijos)
function normalizeOption(o){
  if("hasWarranty" in o) return {features:"",terms:"",...o};
  return newOption({id:o.id,name:o.name,price:o.price,description:o.service||"",hasInstallments:o.installments>1,installments:o.installments>1?o.installments:3,hasWarranty:!!o.warranty,warranty:o.warranty||"",recommended:o.id==="recommended"});
}
const chosenOf=p=>p.options.find(o=>o.id===p.chosenOption)||p.options.find(o=>o.recommended)||p.options[0];
let builderKind="service", builderOptions=[];

const DAY=864e5, PAY={cash:"Efectivo",transfer:"Transferencia",mp:"Mercado Pago"};
const isoDate=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const addDays=(iso,n)=>isoDate(new Date(iso+"T12:00:00").getTime()+n*DAY);
const dayEnd=iso=>new Date(iso+"T23:59:59").getTime();
const fmtDate=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
const daysLeft=p=>Math.floor((dayEnd(p.expiresAt)-Date.now())/DAY);
const expiryText=p=>{const d=daysLeft(p);return d<0?"Vencida":d===0?"Vence hoy":d===1?"Vence mañana":`Vence en ${d} días`;};
function syncExpired(list){
  let ch=false;
  list.forEach(p=>{if((p.status==="sent"||p.status==="viewed")&&Date.now()>dayEnd(p.expiresAt)){p.status="expired";ch=true;}});
  return ch;
}
const selectedPayments=()=>$$('input[name="pay"]:checked').map(x=>x.value);
const builderCash=()=>Math.min(50,Math.max(0,Number($("#cashDiscount").value)||0));
const builderExpiry=()=>$("#proposalExpires").value||addDays(isoDate(Date.now()),7);
const expiryLine=p=>p.status==="expired"?`⛔ Esta propuesta venció el ${fmtDate(p.expiresAt)}`:`⏳ ${expiryText(p)} · válida hasta el ${fmtDate(p.expiresAt)}`;
const payBlock=p=>(p.payments||[]).length?`<p class="pay">Medios de pago: ${p.payments.map(k=>PAY[k]).join(" · ")}</p>`:"";
function cashLine(p,o){
  const cd=Number(p.cashDiscount)||0, ks=(p.payments||[]).filter(k=>k==="cash"||k==="transfer");
  return cd>0&&ks.length?`<p class="cash">💵 ${ks.map(k=>PAY[k]).join(" / ")}: <b>${money(finalPrice(o)*(1-cd/100))}</b> (-${cd}%)</p>`:"";
}
const depositOf=(p,o)=>Math.round(finalPrice(o)*(Number(p.depositPct)||0)/100);
const builderDep=()=>Math.min(100,Math.max(0,Number($("#depositPct").value)||0));
const brandStyle=()=>{const c=(state.business.brandColor||"").trim();return /^#[0-9a-f]{3,8}$/i.test(c)?c:"#15803d";};
const heat=p=>{
  if(p.status==="accepted") return p.depositPaidAt?"💰 Seña cobrada":p.proofSentAt?"💸 Avisó el pago: verificá":"✅ Aceptada · seña pendiente";
  if(p.status==="expired") return "⛔ Vencida";
  const h=(Date.now()-(p.lastViewedAt||0))/36e5;
  if((p.views||0)>=3||((p.views||0)>0&&h<24)) return "🔥 Interés alto";
  return (p.views||0)>0?"🟡 Interés medio":"⚪ Sin abrir";
};
const TEMPLATES={
  auto:{name:"🚗 Autos / concesionaria",items:[
    {kind:"product",name:"Auto 0km",description:"Unidad 0km con entrega a coordinar",features:"Patentamiento incluido\nGarantía de fábrica\nPrimer service sin cargo",terms:"Precio sujeto a disponibilidad de la unidad."},
    {kind:"product",name:"Usado certificado",description:"Usado revisado, con informe de estado",features:"Informe de dominio\nRevisión mecánica\nTransferencia asistida",terms:"Precio sujeto a verificación final de la unidad."}]},
  hogar:{name:"🔧 Servicios técnicos / hogar",items:[
    {kind:"service",name:"Visita y diagnóstico",description:"Visita técnica con presupuesto",features:"Revisión en el lugar\nPresupuesto por escrito",terms:"La visita se descuenta si se contrata el trabajo."},
    {kind:"service",name:"Instalación estándar",description:"Instalación completa con materiales básicos",features:"Mano de obra incluida\nLimpieza al terminar",terms:"Materiales adicionales se presupuestan aparte."}]},
  belleza:{name:"💅 Belleza y bienestar",items:[
    {kind:"service",name:"Sesión individual",description:"Una sesión con turno reservado",features:"Turno a elección\nProductos incluidos",terms:"Reprogramación con 24 h de aviso."},
    {kind:"service",name:"Pack de 4 sesiones",description:"Pack con descuento por pack cerrado",features:"4 sesiones\nSeguimiento personalizado",terms:"Vigencia del pack: 60 días."}]},
  tech:{name:"💻 Tecnología / reparaciones",items:[
    {kind:"service",name:"Reparación estándar",description:"Diagnóstico y reparación del equipo",features:"Diagnóstico sin cargo\nRepuestos informados antes de cambiar",terms:"Si no se aprueba la reparación, se retira el equipo sin costo."},
    {kind:"product",name:"Equipo + instalación",description:"Equipo nuevo con configuración inicial",features:"Configuración inicial\nTraspaso de datos",terms:"Precio sujeto a stock."}]}
};
function loadTemplate(k){
  let n=0;
  TEMPLATES[k].items.forEach(it=>{
    if(state.catalog.some(c=>c.kind===it.kind&&c.name===it.name)) return;
    state.catalog.push(newOption({...it,id:`c-${Math.random().toString(36).slice(2,8)}`})); n++;
  });
  const k0=TEMPLATES[k].items[0].kind;
  if(k0!==builderKind){$$('input[name="kind"]').forEach(r=>r.checked=r.value===k0); setKind(k0);}
  saveState(); renderCatalog();
  toast(n?`Se agregaron ${n} ejemplos. Completá el precio de cada uno.`:"Ya tenías esos ejemplos cargados.");
}
const CFG=window.CC_CONFIG||{}, HOME_VIEW="home";
let currentUser=null, authTab="login";
const loadScript=src=>new Promise((ok,ko)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar Supabase."));document.head.appendChild(s);});
async function sha(t){
  const c=globalThis.crypto;
  if(c&&c.subtle){const b=await c.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
  let h=0;for(const ch of t)h=(h*31+ch.charCodeAt(0))|0;return String(h);
}
const users=()=>{try{return JSON.parse(localStorage.getItem("cc_users")||"{}");}catch{return {};}};
const Auth={
  remote:!!(CFG.supabaseUrl&&CFG.supabaseKey), sb:null,
  async client(){if(!this.sb){await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");this.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey);}return this.sb;},
  local(){try{return JSON.parse(localStorage.getItem("cc_session")||"null");}catch{return null;}},
  save(s){localStorage.setItem("cc_session",JSON.stringify(s));return s;},
  async restore(){
    if(!this.remote) return this.local();
    const {data}=await (await this.client()).auth.getSession(), u=data.session&&data.session.user;
    return u?{id:u.id,email:u.email,biz:(u.user_metadata||{}).business_name}:null;
  },
  async signUp(email,pass,biz){
    if(this.remote){
      const {data,error}=await (await this.client()).auth.signUp({email,password:pass,options:{data:{business_name:biz}}});
      if(error) throw new Error(error.message);
      if(!data.session) throw new Error("Cuenta creada. Confirmá tu email y después ingresá.");
      return {id:data.user.id,email,biz};
    }
    const us=users(); if(us[email]) throw new Error("Ese email ya tiene cuenta. Ingresá.");
    const salt=String(Math.random()).slice(2)+Date.now(), id="l"+Date.now().toString(36);
    us[email]={id,salt,hash:await sha(salt+pass),biz}; localStorage.setItem("cc_users",JSON.stringify(us));
    return this.save({id,email,biz});
  },
  async signIn(email,pass){
    if(this.remote){
      const {data,error}=await (await this.client()).auth.signInWithPassword({email,password:pass});
      if(error) throw new Error("Email o contraseña incorrectos.");
      return {id:data.user.id,email,biz:(data.user.user_metadata||{}).business_name};
    }
    const u=users()[email];
    if(!u||u.hash!==await sha(u.salt+pass)) throw new Error("Email o contraseña incorrectos.");
    return this.save({id:u.id,email,biz:u.biz});
  },
  async signOut(){localStorage.removeItem("cc_session");if(this.remote) await (await this.client()).auth.signOut();}
};
function applyUser(u){
  currentUser=u; STORAGE_KEY=`cierraclick_u_${u.id}`; state=loadState();
  if(u.biz&&state.business.name==="CierraClick Demo"){state.business.name=u.biz;saveState();}
  fillSettings(); updateAuthUI(); renderDashboard();
}
function updateAuthUI(){const b=$("#authBtn");b.textContent=currentUser?"Salir":"Ingresar";b.title=currentUser?currentUser.email:"";}
function openAuth(tab="login"){setAuthTab(tab);$("#authError").textContent="";openModal("authModal");}
function setAuthTab(t){
  authTab=t;
  $$("[data-auth-tab]").forEach(b=>b.classList.toggle("active",b.dataset.authTab===t));
  $("#bizRow").hidden=t!=="register"; $("#authSubmit").textContent=t==="register"?"Crear cuenta":"Ingresar";
  $("#authForm").elements.password.autocomplete=t==="register"?"new-password":"current-password";
  $("#authNote").textContent=Auth.remote?"":"Modo demo: la cuenta se guarda solo en este navegador.";
}
function fillSettings(){
  const f=$("#settingsForm"), b=state.business;
  Object.entries({businessName:b.name,whatsapp:b.whatsapp,paymentLink:b.paymentLink,brandColor:b.brandColor,holder:b.holder,bank:b.bank,cbu:b.cbu,alias:b.alias,cuit:b.cuit,transferNote:b.transferNote})
    .forEach(([k,v])=>{if(f.elements[k]) f.elements[k].value=v??"";});
}
function markPaid(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  p.depositPaidAt=Date.now(); p.lastEvent="Seña recibida.";
  state.activity.unshift({icon:"💰",text:`Confirmaste la seña de ${p.client.name}.`,time:"Ahora"});
  saveState(); renderDashboard(); toast("Seña marcada como recibida.");
}
let state = loadState();
let currentProposalId = null;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

function loadState(){
  let s;
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    s=raw?{...structuredClone(defaultState),...JSON.parse(raw)}:structuredClone(defaultState);
  }catch{ s=structuredClone(defaultState); }
  s.catalog=s.catalog||[];
  s.proposals.forEach(p=>{p.kind=p.kind||"service";p.options=p.options.map(normalizeOption);p.expiresAt=p.expiresAt||addDays(isoDate(new Date(p.createdAt||Date.now()).getTime()),parseInt(p.validity)||7);p.payments=p.payments||["cash","transfer","mp"];p.cashDiscount=p.cashDiscount||0;p.depositPct=p.depositPct||0;});
  syncExpired(s.proposals);
  return s;
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function money(value){
  return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(value)||0);
}
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function relativeTime(iso){
  const mins=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000));
  if(mins<1) return "Ahora";
  if(mins<60) return `Hace ${mins} min`;
  const h=Math.floor(mins/60); if(h<24) return `Hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-AR");
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2400);
}

function nav(view){
  if(view==="dashboard"&&!currentUser) return openAuth("login");
  $$(".view").forEach(v=>v.classList.remove("active"));
  $(`#view-${view}`)?.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  if(view==="dashboard") renderDashboard();
}

function openModal(id){
  const modal=$("#"+id); modal.classList.add("open"); modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeModal(id){
  const modal=$("#"+id); modal.classList.remove("open"); modal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}
function resetBuilder(){
  $("#proposalForm").reset();
  builderKind="service";
  $("#proposalExpires").value=addDays(isoDate(Date.now()),7);
  builderOptions=[newOption({})];
  renderOptionEditors(); renderCatalog();
  renderBuilderPreview();
}
function totalText(o){
  const d=discountAmount(o);
  return `Precio final: ${money(finalPrice(o))}${d>0?` (ahorro ${money(d)})`:""}`;
}
function renderOptionEditors(){
  const one=builderOptions.length===1, ph=KINDS[builderKind].ph;
  $("#optionsList").innerHTML=builderOptions.map((o,i)=>`
    <div class="option-editor ${o.recommended&&!one?"recommended":""}" data-idx="${i}">
      <div class="option-top">
        <span class="option-label">OPCIÓN ${i+1}</span>
        <label class="chk ${one?"hidden":""}"><input type="checkbox" data-field="recommended" ${o.recommended&&!one?"checked":""} ${one?"disabled":""}> Recomendada ⭐</label>
        <button type="button" class="text-btn" data-save title="Guardar en mi catálogo">💾 Guardar</button>
        <button type="button" class="text-btn danger" data-remove ${one?"disabled":""}>Quitar</button>
      </div>
      <label>Nombre<input data-field="name" placeholder="Ej: Plan estándar" value="${escapeHtml(o.name)}"></label>
      <label>Precio<input data-field="price" type="number" min="0" step="any" value="${o.price}"></label>
      <label class="full">Descripción<input data-field="description" placeholder="${escapeHtml(ph)}" value="${escapeHtml(o.description)}"></label>
      <details class="more full" ${o._open?"open":""}>
        <summary>Descuento, cuotas, garantía y más</summary>
        <div class="more-grid">
          <label>Descuento<span class="inline"><input data-field="discountValue" type="number" min="0" step="any" value="${o.discountValue}"><select data-field="discountType"><option value="percent" ${o.discountType==="percent"?"selected":""}>%</option><option value="fixed" ${o.discountType==="fixed"?"selected":""}>$</option></select></span></label>
          <div class="toggle"><label class="chk"><input type="checkbox" data-field="hasInstallments" ${o.hasInstallments?"checked":""}> Ofrecer cuotas</label><input data-field="installments" type="number" min="2" value="${o.installments}" ${o.hasInstallments?"":"disabled"} aria-label="Cantidad de cuotas"></div>
          <div class="toggle full"><label class="chk"><input type="checkbox" data-field="hasWarranty" ${o.hasWarranty?"checked":""}> Incluir garantía</label><input data-field="warranty" value="${escapeHtml(o.warranty)}" placeholder="Ej: 6 meses" ${o.hasWarranty?"":"disabled"}></div>
          <label class="full">Características (una por línea)<textarea data-field="features" rows="3" placeholder="Ej: Envío gratis&#10;Instalación incluida">${escapeHtml(o.features)}</textarea></label>
          <label class="full">Términos y condiciones de esta opción<textarea data-field="terms" rows="2">${escapeHtml(o.terms)}</textarea></label>
        </div>
      </details>
      <div class="option-total full" data-total>${totalText(o)}</div>
    </div>`).join("");
  $("#addOption").disabled=builderOptions.length>=MAX_OPTIONS;
}
// ===== Catálogo guardado (productos / servicios reutilizables) =====
function renderCatalog(){
  const items=state.catalog.filter(c=>c.kind===builderKind);
  const tpl=`<select id="tplPick" aria-label="Plantillas por rubro"><option value="">📦 Cargar ejemplos de un rubro…</option>${Object.entries(TEMPLATES).map(([k,t])=>`<option value="${k}">${t.name}</option>`).join("")}</select>`;
  $("#catalogList").innerHTML=(items.length
    ?`<span class="option-label">MI CATÁLOGO · tocá para agregar</span><div class="chips">${items.map(c=>`<span class="chip"><button type="button" data-add-cat="${c.id}">${escapeHtml(c.name)} · ${c.price?money(c.price):"completar precio"}</button><button type="button" data-del-cat="${c.id}" aria-label="Borrar del catálogo">×</button></span>`).join("")}</div>`
    :`<p class="hint">Con "💾 Guardar" en una opción la sumás a tu catálogo de ${builderKind==="product"?"productos":"servicios"} y la reutilizás.</p>`)+tpl;
}
function saveToCatalog(o){
  const name=String(o.name).trim();
  if(!name) return toast("Poné un nombre para guardarla.");
  const {id,recommended,_open,...rest}=o;
  const item={...rest,name,kind:builderKind,price:Number(o.price)||0,id:`c-${Math.random().toString(36).slice(2,8)}`};
  const i=state.catalog.findIndex(c=>c.kind===builderKind&&c.name.toLowerCase()===name.toLowerCase());
  if(i>=0){item.id=state.catalog[i].id;state.catalog[i]=item;} else state.catalog.push(item);
  saveState(); renderCatalog(); toast("Guardada en tu catálogo.");
}
function onOptionInput(e){
  const t=e.target, f=t.dataset.field, row=t.closest("[data-idx]");
  if(!f||!row) return;
  const o=builderOptions[row.dataset.idx];
  o[f]=t.type==="checkbox"?t.checked:t.value;
  if(["recommended","hasInstallments","hasWarranty"].includes(f)){
    if(f==="recommended"&&t.checked) builderOptions.forEach(x=>{if(x!==o)x.recommended=false;});
    renderOptionEditors();
  } else $("[data-total]",row).textContent=totalText(o);
  renderBuilderPreview();
}
function setKind(k){
  const prev=KINDS[builderKind];
  if($("#proposalTitle").value===prev.title) $("#proposalTitle").value=KINDS[k].title;
  if($("#includes").value===prev.includes) $("#includes").value=KINDS[k].includes;
  builderKind=k; renderOptionEditors(); renderCatalog(); renderBuilderPreview();
}

function collectBuilderData(){
  const options=builderOptions.map(o=>{
    const warranty=String(o.warranty).trim();
    return {...o,_open:undefined,
      name:String(o.name).trim()||"Opción",
      price:Number(o.price)||0,
      discountValue:Number(o.discountValue)||0,
      description:String(o.description).trim(),features:String(o.features||"").trim(),terms:String(o.terms||"").trim(),
      installments:Math.max(2,Number(o.installments)||2),
      hasWarranty:!!(o.hasWarranty&&warranty),warranty,
      recommended:!!o.recommended&&builderOptions.length>1};
  });
  return {
    id:`p-${Date.now()}`,
    kind:builderKind,
    client:{name:$("#clientName").value.trim(),phone:$("#clientPhone").value.trim()},
    title:$("#proposalTitle").value.trim(),
    validity:"",expiresAt:builderExpiry(),payments:selectedPayments(),cashDiscount:builderCash(),depositPct:builderDep(),
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    conditions:$("#conditions").value.trim(),
    options,
    status:"sent",views:0,chosenOption:null,createdAt:new Date().toISOString(),acceptedAt:null,depositStarted:0,
    lastEvent:"Propuesta creada."
  };
}

function optionMarkup(p,o,mode){
  const multi=p.options.length>1, rec=o.recommended&&multi, d=discountAmount(o), fin=finalPrice(o);
  const badge=o.discountType==="percent"?`-${Math.round(Number(o.discountValue)||0)}%`:`Ahorrás ${money(d)}`;
  return `
    <article class="choice ${rec?"recommended":""}" data-choice="${escapeHtml(o.id)}">
      ${rec?'<span class="tag">RECOMENDADA ⭐</span>':''}
      <h4>${escapeHtml(o.name)}</h4>
      ${d>0?`<div class="price-old">${money(o.price)}</div>`:""}
      <div class="price">${money(fin)}</div>
      ${cashLine(p,o)}
      ${p.depositPct>0?`<p class="cash">🔒 Seña para reservar: <b>${money(depositOf(p,o))}</b> (${p.depositPct}%)</p>`:""}
      ${d>0?`<span class="disc">${badge}</span>`:""}
      ${o.hasInstallments&&o.installments>1?`<p>${o.installments} cuotas de ${money(fin/o.installments)}</p>`:""}
      ${o.description?`<p>${escapeHtml(o.description)}</p>`:""}
      ${o.hasWarranty&&o.warranty?`<p>Garantía: ${escapeHtml(o.warranty)}</p>`:""}
      ${(o.features||"").trim()?`<ul class="feat">${o.features.split("\n").map(x=>x.trim()).filter(Boolean).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}
      ${(o.terms||"").trim()?`<details class="terms"><summary>Términos y condiciones</summary><p>${escapeHtml(o.terms)}</p></details>`:""}
      ${mode==="full"&&multi&&p.status!=="expired"?`<button class="select" data-select-option="${escapeHtml(o.id)}">Elegir ${escapeHtml(o.name)}</button>`:""}
    </article>`;
}

function publicProposalMarkup(p, mode="full"){
  const multi=p.options.length>1;
  const includes=(p.includes||[]).map(x=>`<div class="include">✓ ${escapeHtml(x)}</div>`).join("");
  return `
    <div class="public-card" data-public-id="${escapeHtml(p.id)}" style="--pc:${brandStyle()}">
      <div class="public-brand"><span class="avatar">${escapeHtml((state.business.name||"?").trim().charAt(0).toUpperCase())}</span>${escapeHtml(state.business.name).toUpperCase()}</div>
      <div class="public-greeting">Hola ${escapeHtml(p.client.name)} 👋</div>
      <div class="public-title">${escapeHtml(p.title)}</div>
      ${mode==="full"&&p.status!=="expired"?`<div class="steps"><span><b>1</b> ${multi?"Elegí tu opción":"Revisá la propuesta"}</span><span><b>2</b> Aceptá</span><span><b>3</b> Reservá${p.depositPct>0?" con seña":""}</span></div>`:""}
      <div class="choice-grid n${p.options.length}">${p.options.map(o=>optionMarkup(p,o,mode)).join("")}</div>
      <div class="public-includes">${includes}</div>
      ${payBlock(p)}
      <p style="color:#64748b;font-size:13px">${escapeHtml(p.conditions)}</p>
      <div class="public-actions">
        ${mode==="full"&&p.status==="expired"?`<button class="public-seña" disabled style="opacity:.5">Propuesta vencida</button>`:mode==="full"?`<button class="public-seña" id="acceptBtn">${multi?"Quiero esta opción":"Quiero esto"}</button>`:''}
        ${mode==="full"?`<a class="public-whatsapp" id="publicWhatsapp" href="#" target="_blank" rel="noopener">Hablar por WhatsApp</a>`:""}
      </div>
      <div class="public-foot">${expiryLine(p)} · Propuesta digital CierraClick</div>
    </div>`;
}

function markSelected(id){
  $$("[data-choice]",$("#publicContent")).forEach(el=>el.classList.toggle("selected",el.dataset.choice===id&&$$("[data-choice]",$("#publicContent")).length>1));
}

function renderBuilderPreview(){
  const p = {
    kind:builderKind,
    client:{name:$("#clientName").value||"Juan Pérez"},
    title:$("#proposalTitle").value||KINDS[builderKind].title,
    expiresAt:builderExpiry(),payments:selectedPayments(),cashDiscount:builderCash(),depositPct:builderDep(),
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    conditions:$("#conditions").value||"La reserva se confirma con la seña.",
    options:builderOptions.map(o=>({...o,hasWarranty:o.hasWarranty&&!!String(o.warranty).trim(),installments:Number(o.installments)||2,recommended:o.recommended&&builderOptions.length>1}))
  };
  $("#builderPreview").innerHTML=publicProposalMarkup(p,"preview");
}

function openBuilder(){
  if(!currentUser) return openAuth("login");
  resetBuilder();
  openModal("builderModal");
  $("#clientName").focus();
}

function createProposal(e){
  e.preventDefault();
  const p=collectBuilderData();
  state.proposals.unshift(p);
  const existing=state.clients.find(c=>c.phone===p.client.phone);
  if(existing) existing.proposals+=1;
  else state.clients.unshift({name:p.client.name,phone:p.client.phone,proposals:1});
  state.activity.unshift({icon:"📝",text:`Creaste una propuesta para ${p.client.name}.`,time:"Ahora"});
  saveState();
  closeModal("builderModal");
  renderDashboard();
  const link = `${location.origin}${location.pathname}?p=${encodeURIComponent(p.id)}`;
  const waText = `Hola ${p.client.name} 👋 Te comparto tu propuesta: ${link}`;
  window.open(`https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(waText)}`,"_blank","noopener");
  toast("Propuesta creada y WhatsApp preparado.");
}

function normalizePhone(phone){ return String(phone||"").replace(/\D/g,""); }

function openPublic(id,preview=false){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  currentProposalId=id;
  if(!preview){
  p.views=(p.views||0)+1; p.lastViewedAt=Date.now();
  if(p.status==="sent") p.status="viewed";
  p.lastEvent="Cliente abrió la propuesta.";
  state.activity.unshift({icon:"👀",text:`${p.client.name} abrió una propuesta.`,time:"Ahora"});
  saveState();
  } else toast("Vista previa: no cuenta como visita.");
  $("#publicContent").innerHTML=publicProposalMarkup(p,"full");
  const sel=chosenOf(p);
  $("#publicWhatsapp").href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`Hola ${state.business.name} 👋 Quiero consultar la propuesta de ${p.client.name} por ${money(finalPrice(sel))}.`)}`;
  markSelected(sel.id);
  openModal("publicModal");
  attachPublicEvents(p);
}
function attachPublicEvents(p){
  $$("[data-select-option]",$("#publicContent")).forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.selectOption;
      p.chosenOption=id;
      p.lastEvent=`Cliente eligió ${p.options.find(x=>x.id===id)?.name||"una opción"}.`;
      state.activity.unshift({icon:"⭐",text:`${p.client.name} seleccionó una opción.`,time:"Ahora"});
      saveState();
      markSelected(id);
      const chosen=p.options.find(x=>x.id===id);
      $("#publicWhatsapp").href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`Hola ${state.business.name} 👋 Quiero avanzar con ${chosen.name} por ${money(finalPrice(chosen))}.`)}`;
      toast(`Elegiste ${chosen.name}.`);
    });
  });
  $("#acceptBtn")?.addEventListener("click",()=>{
    p.chosenOption=chosenOf(p).id; p.status="accepted"; p.acceptedAt=new Date().toISOString();
    p.lastEvent="Cliente aceptó la propuesta.";
    state.activity.unshift({icon:"✅",text:`${p.client.name} aceptó la propuesta.`,time:"Ahora"});
    saveState();
    renderAcceptedState(p);
  });
}
function renderAcceptedState(p){
  const option=chosenOf(p);
  const paymentUrl=state.business.paymentLink||"", b=state.business, dep=depositOf(p,option), hasTransfer=!!(b.cbu||b.alias);
  const trow=(l,v,c)=>v?`<div class="tr-row"><span>${l}</span><b>${escapeHtml(v)}</b>${c?`<button type="button" class="text-btn" data-copy="${escapeHtml(v)}">Copiar</button>`:""}</div>`:"";
  const transferBlock=hasTransfer?`<div class="card transfer"><strong>Transferí la seña${dep?` de ${money(dep)}`:""}</strong>${trow("Titular",b.holder)}${trow("Banco",b.bank)}${trow("CBU/CVU",b.cbu,1)}${trow("Alias",b.alias,1)}${trow("CUIT/CUIL",b.cuit)}${b.transferNote?`<p class="hint">${escapeHtml(b.transferNote)}</p>`:""}<button type="button" class="public-whatsapp" id="proofBtn">${p.proofSentAt?"✅ Aviso enviado · reenviar":"💸 Ya transferí · enviar comprobante"}</button></div>`:"";
  $("#publicContent").innerHTML=`
    <div class="public-card" style="--pc:${brandStyle()}">
      <div class="public-brand"><span class="avatar">${escapeHtml((state.business.name||"?").trim().charAt(0).toUpperCase())}</span>${escapeHtml(state.business.name).toUpperCase()}</div>
      <div class="public-greeting">¡Excelente, ${escapeHtml(p.client.name)}! ✅</div>
      <p style="color:#64748b">Tu elección quedó registrada: <strong>${escapeHtml(option.name)}</strong> · ${money(finalPrice(option))}</p>
      <div class="card" style="margin-top:16px;background:#f8fafc">
        <strong>Para reservar la operación</strong>
        <p style="color:#64748b;margin-bottom:0">${p.depositPct>0?`Seña a pagar: <b>${money(depositOf(p,option))}</b> (${p.depositPct}%) · Saldo: ${money(finalPrice(option)-depositOf(p,option))}. `:""}Aboná la seña mediante el link de pago del vendedor.</p>
      </div>
      ${transferBlock}
      <div class="public-actions">
        ${paymentUrl?`<a class="public-seña" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener" id="depositLink">PAGAR SEÑA</a>`:hasTransfer?"":`<button class="public-seña" id="depositDemo">PAGAR SEÑA (DEMO)</button>`}
        <button class="public-whatsapp" id="receiptBtn" type="button">📄 Descargar constancia</button>
        <a class="public-whatsapp" href="https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`Hola ${state.business.name} 👋 Acepté la propuesta y quiero avanzar con la seña.`)}" target="_blank" rel="noopener">Escribir al vendedor</a>
      </div>
    </div>`;
  $("#receiptBtn")?.addEventListener("click",()=>printReceipt(p.id));
  $$("[data-copy]").forEach(x=>x.addEventListener("click",()=>{(navigator.clipboard?navigator.clipboard.writeText(x.dataset.copy):Promise.reject()).then(()=>toast("Copiado ✔"),()=>toast("No se pudo copiar."));}));
  $("#proofBtn")?.addEventListener("click",()=>{
    p.proofSentAt=Date.now(); p.lastEvent="Cliente avisó que transfirió la seña.";
    state.activity.unshift({icon:"💸",text:`${p.client.name} avisó que transfirió la seña.`,time:"Ahora"}); saveState();
    window.open(`https://wa.me/${normalizePhone(b.whatsapp)}?text=${encodeURIComponent(`Hola ${b.name} 👋 Soy ${p.client.name}. Ya transferí la seña${dep?` de ${money(dep)}`:""} por "${p.title}" (${option.name}). Te mando el comprobante por acá.`)}`,"_blank","noopener");
    toast("Adjuntá el comprobante en el chat de WhatsApp.");
  });
  if($("#depositLink")) $("#depositLink").addEventListener("click",()=>{p.depositStarted=(p.depositStarted||0)+1;saveState();});
  $("#depositDemo")?.addEventListener("click",()=>{p.depositStarted=(p.depositStarted||0)+1;saveState();toast("Demo: acá se conectará el link de Mercado Pago.");});
}

function renderDashboard(){
  if(syncExpired(state.proposals)) saveState();
  const proposals=state.proposals||[];
  const views=proposals.reduce((s,p)=>s+(p.views||0),0);
  const accepted=proposals.filter(p=>p.status==="accepted").length;
  $("#metricProposals").textContent=proposals.length;
  $("#metricViews").textContent=views;
  $("#metricAccepted").textContent=accepted;
  $("#metricConversion").textContent=proposals.length?`${Math.round(accepted/proposals.length*100)}%`:"0%";

  const wk=Date.now()-7*DAY, won=proposals.filter(p=>p.status==="accepted"&&new Date(p.acceptedAt)>wk);
  $("#weekCard").innerHTML=proposals.length?`<b>Últimos 7 días</b><div class="week-row"><span><strong>${proposals.filter(p=>new Date(p.createdAt)>wk).length}</strong> enviadas</span><span><strong>${won.length}</strong> aceptadas</span><span><strong>${money(won.reduce((s,p)=>s+finalPrice(chosenOf(p)),0))}</strong> cerrado</span></div>`:"";
  const open=proposals.filter(p=>p.status==="sent"||p.status==="viewed");
  const pending=open.reduce((s,p)=>s+finalPrice(chosenOf(p)),0);
  $("#pendingBanner").innerHTML=open.length?`💰 <b>${money(pending)}</b> esperando respuesta en ${open.length} propuesta${open.length>1?"s":""}. Tocá <b>🔔 Seguimiento</b> para recuperarlas por WhatsApp.`:"";
  const paidBtn=p=>(p.status==="accepted"&&!p.depositPaidAt)?`<button class="text-btn" data-paid="${p.id}">✔ Seña recibida</button>`:"";
  const followBtn=p=>(p.status==="sent"||p.status==="viewed")?`<button class="text-btn" data-follow="${p.id}">🔔 Seguimiento</button>`:"";
  const items=todayItems();
  $("#todayCount").textContent=items.length||"";
  $("#todayList").innerHTML=items.map(({p,reason})=>`<div class="proposal-item"><div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${heat(p)} · ${reason}</span></div><div>${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>`:followBtn(p)+paidBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div></div>`).join("")||'<p style="color:#64748b">🎉 Todo al día: no hay propuestas para seguir hoy.</p>';
  $("#hotList").innerHTML=proposals.slice(0,5).map(p=>`
    <div class="proposal-item">
      <div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${p.views||0} vistas</span></div>
      <div><span class="status">${statusLabel(p.status)}</span>${followBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div>
    </div>`).join("") || '<p style="color:#64748b">Todavía no hay propuestas.</p>';

  $("#activityList").innerHTML=(state.activity||[]).slice(0,6).map(a=>`<div class="activity"><b>${a.icon}</b><div>${escapeHtml(a.text)}<br><span style="color:#94a3b8">${escapeHtml(a.time)}</span></div></div>`).join("");
  $("#proposalTable").innerHTML=proposals.map(p=>`
    <tr><td><strong>${escapeHtml(p.client.name)}</strong><br><small>${escapeHtml(p.title)}</small></td>
    <td>${money(finalPrice(chosenOf(p)))}</td>
    <td><span class="badge ${p.status}">${statusLabel(p.status)}</span><br><small>${heat(p)}</small></td>
    <td>${p.views||0}</td><td>${relativeTime(p.createdAt)}</td>
    <td class="actions">${followBtn(p)}${paidBtn(p)}${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>`:""}${p.status==="accepted"?`<button class="text-btn" data-receipt="${p.id}">📄 Constancia</button>`:""}<button class="text-btn" data-dup="${p.id}">Duplicar</button><button class="text-btn" data-open="${p.id}">Ver</button></td></tr>`).join("");
  $("#clientsGrid").innerHTML=(state.clients||[]).map(c=>`<div class="client"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.phone)}</p><p>${c.proposals||0} propuesta(s)</p></div>`).join("");
  renderPerformance();
  $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openPublic(b.dataset.open,true)));
  $$("[data-follow]").forEach(b=>b.addEventListener("click",()=>followUp(b.dataset.follow)));
  $$("[data-paid]").forEach(b=>b.addEventListener("click",()=>markPaid(b.dataset.paid)));
  $$("[data-renew]").forEach(b=>b.addEventListener("click",()=>renewProposal(b.dataset.renew)));
  $$("[data-dup]").forEach(b=>b.addEventListener("click",()=>duplicateProposal(b.dataset.dup)));
  $$("[data-receipt]").forEach(b=>b.addEventListener("click",()=>printReceipt(b.dataset.receipt)));
}
// ===== Agenda "Hoy", renovar, duplicar, constancia =====
function todayItems(){
  const now=Date.now(), out=[];
  const hTxt=h=>h<48?`${Math.floor(h)} h`:`${Math.floor(h/24)} días`;
  state.proposals.forEach(p=>{
    if(p.status==="accepted"&&p.proofSentAt&&!p.depositPaidAt){out.push({p,reason:"💸 Avisó que transfirió: verificá y confirmá la seña.",prio:0});return;}
    if(p.status==="accepted"||p.status==="lost") return;
    const last=Math.max(new Date(p.lastViewedAt||p.createdAt).getTime(),p.lastFollowUpAt||0), h=(now-last)/36e5;
    let reason=null, prio=9;
    if(p.status==="expired"){reason="⛔ Venció: renovala y volvé a escribirle.";prio=1;}
    else if(daysLeft(p)<=2){reason=`⏳ ${expiryText(p)}.`;prio=2;}
    else if(h>=24){reason=p.status==="viewed"?`👀 La vio y no respondió (hace ${hTxt(h)}).`:`📨 Sin abrir hace ${hTxt(h)}.`;prio=p.status==="viewed"?3:4;}
    if(reason) out.push({p,reason,prio});
  });
  return out.sort((a,b)=>a.prio-b.prio||finalPrice(chosenOf(b.p))-finalPrice(chosenOf(a.p)));
}
function renewProposal(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  p.expiresAt=addDays(isoDate(Date.now()),7);
  if(p.status==="expired") p.status=p.views>0?"viewed":"sent";
  state.activity.unshift({icon:"🔄",text:`Renovaste la propuesta de ${p.client.name} hasta el ${fmtDate(p.expiresAt)}.`,time:"Ahora"});
  saveState(); renderDashboard(); toast("Renovada por 7 días.");
}
function duplicateProposal(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  openBuilder();
  $("#clientName").value=p.client.name; $("#clientPhone").value=p.client.phone;
  $("#proposalTitle").value=p.title; $("#includes").value=(p.includes||[]).join("\n"); $("#conditions").value=p.conditions||"";
  $("#cashDiscount").value=p.cashDiscount||0; $("#depositPct").value=p.depositPct||0;
  $$('input[name="pay"]').forEach(x=>x.checked=(p.payments||[]).includes(x.value));
  $$('input[name="kind"]').forEach(x=>x.checked=x.value===(p.kind||"service"));
  builderKind=p.kind||"service";
  builderOptions=p.options.map(o=>{const {id,...rest}=o;return newOption({...rest,_open:true});});
  renderOptionEditors(); renderCatalog(); renderBuilderPreview();
  toast("Duplicada: cambiá lo necesario y creá la propuesta.");
}
function printReceipt(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  const o=chosenOf(p), d=discountAmount(o), fin=finalPrice(o), e=escapeHtml;
  const rows=[["Cliente",p.client.name],["Propuesta",p.title],["Opción elegida",o.name],["Descripción",o.description],["Precio de lista",money(o.price)],d>0?["Descuento","-"+money(d)]:null,["Precio final",money(fin)],p.depositPct>0?[`Seña (${p.depositPct}%)`,money(Math.round(fin*p.depositPct/100))]:null,p.cashDiscount>0?[`Pago contado (-${p.cashDiscount}%)`,money(fin*(1-p.cashDiscount/100))]:null,o.hasInstallments?["Cuotas",`${o.installments} de ${money(fin/o.installments)}`]:null,o.hasWarranty?["Garantía",o.warranty]:null,["Medios de pago",(p.payments||[]).map(k=>PAY[k]).join(", ")||"A convenir"],["Aceptada el",new Date(p.acceptedAt||Date.now()).toLocaleString("es-AR")],["Vigencia de la propuesta",`hasta el ${fmtDate(p.expiresAt)}`],(o.terms||p.conditions)?["Términos y condiciones",[o.terms,p.conditions].filter(Boolean).join(" · ")]:null].filter(r=>r&&r[1]);
  const w=window.open("","_blank"); if(!w) return toast("Habilitá las ventanas emergentes para generar la constancia.");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Constancia - ${e(p.client.name)}</title><style>body{font:14px system-ui,sans-serif;max-width:680px;margin:30px auto;padding:0 20px;color:#0b1220}h1{font-size:22px;margin:4px 0 2px}small{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:9px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}td:first-child{color:#64748b;width:38%}.f{margin-top:22px;font-size:11px;color:#94a3b8}</style><small>${e(state.business.name).toUpperCase()}</small><h1>Constancia de aceptación</h1><small>Código: ${e(p.id)}</small><table>${rows.map(r=>`<tr><td>${e(r[0])}</td><td>${e(String(r[1]))}</td></tr>`).join("")}</table><p class="f">Documento generado con CierraClick que deja constancia de la opción aceptada. No reemplaza una factura.</p><script>onload=()=>print()<\/script>`);
  w.document.close();
}
// Seguimiento por WhatsApp con un toque (propuestas enviadas o vistas sin aceptar)
function followUp(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  const link=`${location.origin}${location.pathname}?p=${encodeURIComponent(p.id)}`;
  const first=p.client.name.split(" ")[0];
  const msg=p.status==="viewed"
    ?`Hola ${first} 👋 Vi que ya revisaste la propuesta. ¿Te quedó alguna duda? Si querés avanzar, te reservo con la seña. Vigente hasta el ${fmtDate(p.expiresAt)}: ${link}`
    :`Hola ${first} 👋 ¿Pudiste ver la propuesta que te mandé? Vigente hasta el ${fmtDate(p.expiresAt)}: ${link}`;
  p.followUps=(p.followUps||0)+1; p.lastFollowUpAt=Date.now();
  state.activity.unshift({icon:"🔔",text:`Seguimiento enviado a ${p.client.name}.`,time:"Ahora"});
  saveState(); renderDashboard();
  window.open(`https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
}
function statusLabel(s){return ({sent:"Enviada",viewed:"Vista",accepted:"Aceptada",lost:"Perdida",expired:"Vencida"}[s]||"Enviada")}

function renderPerformance(){
  const p=state.proposals||[], n=p.length;
  const viewed=n?Math.round(p.filter(x=>(x.views||0)>0).length/n*100):0;
  const accepted= n?Math.round(p.filter(x=>x.status==="accepted").length/Math.max(1,p.filter(x=>(x.views||0)>0).length)*100):0;
  const multi=p.filter(x=>x.options.length>1&&x.chosenOption);
  const recommended=multi.length?Math.round(multi.filter(x=>chosenOf(x).recommended).length/multi.length*100):0;
  const deposits=p.reduce((s,x)=>s+(x.depositStarted||0),0);
  const score=Math.min(100,Math.round(viewed*.35+Math.min(accepted,100)*.45+Math.min(recommended,100)*.2));
  $("#perfScore").textContent=score; $("#perfBar").style.width=`${score}%`;
  $("#perfViewed").textContent=`${viewed}%`; $("#perfAccepted").textContent=`${accepted}%`;
  $("#perfRecommended").textContent=`${recommended}%`; $("#perfSeñas").textContent=deposits;
  $("#performanceAdvice").textContent = !n ? "Creá y compartí tu primera propuesta para recibir recomendaciones."
    : accepted<20 ? "Hay vistas pero pocas aceptaciones. Probá destacar mejor la opción recomendada y reducir fricción en la seña."
    : deposits===0 ? "Ya tenés señales de intención. Configurá tu link de Mercado Pago para transformar aceptación en reserva."
    : "Buen rendimiento. Priorizá primero los clientes con varias vistas y sin aceptación.";
}

function showPanel(name){
  $$(".side-link").forEach(x=>x.classList.toggle("active",x.dataset.panel===name));
  $$(".panel").forEach(x=>x.classList.toggle("active",x.id===`panel-${name}`));
  renderDashboard();
}

function bind(){
  $("#year").textContent=new Date().getFullYear();
  const ls=Auth.remote?null:Auth.local();
  if(ls) applyUser(ls); else if(Auth.remote) Auth.restore().then(u=>u&&applyUser(u)).catch(()=>{});
  fillSettings(); updateAuthUI();
  $("#authBtn").addEventListener("click",async()=>{
    if(!currentUser) return openAuth("login");
    await Auth.signOut(); currentUser=null; STORAGE_KEY="cierraclick_mvp_v1"; state=loadState(); fillSettings(); updateAuthUI(); nav(HOME_VIEW); toast("Sesión cerrada.");
  });
  $$("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>setAuthTab(b.dataset.authTab)));
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget), email=String(fd.get("email")).trim().toLowerCase(), pass=String(fd.get("password")), biz=String(fd.get("biz")||"").trim(), err=$("#authError");
    err.textContent="";
    if(!/^\S+@\S+\.\S+$/.test(email)) return void(err.textContent="Ingresá un email válido.");
    if(pass.length<8) return void(err.textContent="La contraseña debe tener al menos 8 caracteres.");
    if(authTab==="register"&&!biz) return void(err.textContent="Poné el nombre de tu negocio.");
    $("#authSubmit").disabled=true;
    try{
      const u=authTab==="register"?await Auth.signUp(email,pass,biz):await Auth.signIn(email,pass);
      applyUser(u); closeModal("authModal"); e.currentTarget.reset(); nav("dashboard"); toast("¡Bienvenido!");
    }catch(ex){err.textContent=ex.message;}
    finally{$("#authSubmit").disabled=false;}
  });

  $$("[data-nav]").forEach(el=>el.addEventListener("click",()=>nav(el.dataset.nav)));
  $("#headerCta").addEventListener("click",openBuilder);
  $("#heroCta").addEventListener("click",openBuilder);
  $("#sideCreate").addEventListener("click",openBuilder);
  $("#overviewCreate").addEventListener("click",openBuilder);
  $("#proposalCreate").addEventListener("click",openBuilder);
  $("#proposalForm").addEventListener("submit",createProposal);
  $("#optionsList").addEventListener("input",onOptionInput);
  $("#optionsList").addEventListener("click",e=>{
    if(e.target.matches("[data-save]")){saveToCatalog(builderOptions[+e.target.closest("[data-idx]").dataset.idx]);return;}
    if(!e.target.matches("[data-remove]")||builderOptions.length<2) return;
    builderOptions.splice(+e.target.closest("[data-idx]").dataset.idx,1);
    if(builderOptions.length===1) builderOptions[0].recommended=false;
    renderOptionEditors(); renderBuilderPreview();
  });
  $("#optionsList").addEventListener("toggle",e=>{
    const row=e.target.closest("[data-idx]");
    if(row&&e.target.matches("details")) builderOptions[row.dataset.idx]._open=e.target.open;
  },true);
  $("#catalogList").addEventListener("change",e=>{if(e.target.id==="tplPick"&&e.target.value) loadTemplate(e.target.value);});
  $("#catalogList").addEventListener("click",e=>{
    const a=e.target.closest("[data-add-cat]"), d=e.target.closest("[data-del-cat]");
    if(a){
      if(builderOptions.length>=MAX_OPTIONS) return toast(`Máximo ${MAX_OPTIONS} opciones.`);
      const {id,kind,...rest}=state.catalog.find(c=>c.id===a.dataset.addCat);
      builderOptions.push(newOption({...rest,_open:true}));
      renderOptionEditors(); renderBuilderPreview();
    } else if(d){
      state.catalog=state.catalog.filter(c=>c.id!==d.dataset.delCat);
      saveState(); renderCatalog();
    }
  });
  $("#addOption").addEventListener("click",()=>{
    if(builderOptions.length>=MAX_OPTIONS) return;
    builderOptions.push(newOption({name:`Opción ${builderOptions.length+1}`}));
    renderOptionEditors(); renderBuilderPreview();
  });
  $$('input[name="kind"]').forEach(r=>r.addEventListener("change",()=>setKind(r.value)));
  $$("[data-close]").forEach(el=>el.addEventListener("click",()=>closeModal({builder:"builderModal",auth:"authModal"}[el.dataset.close]||"publicModal")));
  $$(".side-link").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));
  $$(".text-btn[data-panel]").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));

  $("#settingsForm").addEventListener("submit",e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const g=k=>String(fd.get(k)||"").trim(), cbu=g("cbu").replace(/\s/g,""), alias=g("alias");
    if(cbu&&!/^\d{22}$/.test(cbu)) return toast("El CBU/CVU debe tener 22 números.");
    if(alias&&!/^[A-Za-z0-9.\-]{6,20}$/.test(alias)) return toast("El alias debe tener 6 a 20 letras, números, puntos o guiones.");
    state.business={...state.business,name:g("businessName"),whatsapp:g("whatsapp"),paymentLink:g("paymentLink"),brandColor:g("brandColor"),holder:g("holder"),bank:g("bank"),cbu,alias,cuit:g("cuit"),transferNote:g("transferNote")};
    saveState(); toast("Configuración guardada.");
  });

  $$("#builderModal input, #builderModal textarea").forEach(el=>el.addEventListener("input",renderBuilderPreview));

  // Performance-first: avoid intercepting the public URL until DOM is ready.
  const params=new URLSearchParams(location.search);
  const proposalId=params.get("p");
  if(proposalId && state.proposals.some(p=>p.id===proposalId)){
    // Public proposal mode: keep the shell minimal and focus immediately on the proposal.
    nav("dashboard");
    openPublic(proposalId);
  } else {
    nav("home");
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}),{once:true});
  }
}

document.addEventListener("DOMContentLoaded",bind);
