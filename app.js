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
const MAX_PHOTOS=10;
/* ===== Nombre opcional, saludo según la hora y varias fotos por opción ===== */
const NO_NAME="Cliente";
function firstName(n){const f=String(n||"").trim().split(/\s+/)[0]||"";return f===NO_NAME?"":f;}
function saludoHora(d=new Date()){const h=d.getHours();return h>=6&&h<12?"Buen día":h>=12&&h<20?"Buenas tardes":"Buenas noches";}
function hello(name){const f=firstName(name);return f?`${saludoHora()}, ${f}`:saludoHora();}
function soy(p){const n=String((p&&p.client&&p.client.name)||"").trim();return n&&n!==NO_NAME?`Soy ${n}. `:"";}
function photosOf(o){const l=Array.isArray(o&&o.photos)&&o.photos.length?o.photos:(o&&o.photo?[o.photo]:[]);return l.filter(x=>typeof x==="string"&&x).slice(0,MAX_PHOTOS);}
const newOption=(o={})=>({id:`o-${Math.random().toString(36).slice(2,8)}`,name:"",price:0,discountType:"percent",discountValue:0,description:"",hasInstallments:false,installments:3,hasWarranty:false,warranty:"",features:"",terms:"",recommended:false,why:"",photo:"",photos:[],...o});
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
const expiryLine=p=>{
  if(p.status==="expired") return `⛔ Esta propuesta venció el ${fmtDate(p.expiresAt)}`;
  const end=dayEnd(p.expiresAt), ms=end-Date.now();
  // Con menos de 48 h se muestra la cuenta regresiva real (se actualiza sola cada segundo).
  if(ms>0&&ms<48*36e5) return `⏳ Vence en <b data-cd="${end}">${fmtLeft(ms)}</b> · hasta el ${fmtDate(p.expiresAt)}`;
  return `⏳ ${expiryText(p)} · válida hasta el ${fmtDate(p.expiresAt)}`;
};
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
  const sc=leadScore(p); return sc>=60?"🔥 Interés alto":sc>=25?"🟡 Interés medio":(p.views||0)>0?"🟠 Interés bajo":"⚪ Sin abrir";
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
// El estado en memoria conserva el render existente; Supabase es la fuente de verdad.
const Cloud={
  get on(){return Auth.remote;},
  async rpc(name,args={}){const {data,error}=await (await Auth.client()).rpc(name,args);if(error)throw error;return data;},
  proposal(row){return {...row,lostReason:row.lost_reason,recontactAt:row.recontact_at?new Date(row.recontact_at).getTime():null,client:{name:row.clients?.name||"Cliente",phone:row.clients?.phone||""},expiresAt:row.expires_at,cashDiscount:Number(row.cash_discount||0),depositPct:Number(row.deposit_pct||0),chosenOption:row.chosen_option_id,createdAt:row.created_at,acceptedAt:row.accepted_at,lastViewedAt:row.last_viewed_at,lastFollowUpAt:row.last_follow_up_at,proofSentAt:row.proof_sent_at,depositPaidAt:row.deposit_paid_at,depositStarted:row.deposit_started||0,followUps:row.follow_ups||0,holdHours:row.hold_hours||0,payExitAt:row.pay_exit_at?new Date(row.pay_exit_at).getTime():null,bonusText:row.bonus_text||"",bonusHours:row.bonus_hours||0,slotsLeft:row.slots_left??null,slotsLabel:row.slots_label||"",acceptedName:row.accepted_name||"",termsAcceptedAt:row.terms_accepted_at||null,options:(row.proposal_options||[]).sort((a,b)=>a.position-b.position).map(o=>({id:o.id,name:o.name,price:Number(o.price),discountType:o.discount_type,discountValue:Number(o.discount_value),description:o.description,hasInstallments:o.has_installments,installments:o.installments,hasWarranty:o.has_warranty,warranty:o.warranty,features:o.features,terms:o.terms,recommended:o.recommended}))};},
  async hydrate(){
    if(!this.on||!currentUser)return;
    const sb=await Auth.client(); await this.rpc("refresh_expired").catch(()=>{});
    const [biz,props,catalog,events]=await Promise.all([sb.from("businesses").select("*").eq("owner_id",currentUser.id).single(),sb.from("proposals").select("*,clients(name,phone),proposal_options!proposal_options_proposal_id_fkey(*)").order("created_at",{ascending:false}),sb.from("catalog_items").select("*").order("updated_at",{ascending:false}),sb.from("proposal_events").select("type,message,created_at").order("created_at",{ascending:false}).limit(12)]);
    if(biz.error||props.error||catalog.error||events.error)throw biz.error||props.error||catalog.error||events.error;
    const b=biz.data;
    state={...structuredClone(defaultState),business:{name:b.name,whatsapp:b.whatsapp,paymentLink:b.payment_link,brandColor:b.brand_color,holder:b.holder,bank:b.bank,cbu:b.cbu,depositPolicy:b.deposit_policy,faq:b.faq,photo:b.photo||"",alias:b.alias,cuit:b.cuit,transferNote:b.transfer_note,afterSteps:b.after_steps||""},proposals:props.data.map(x=>this.proposal(x)),catalog:catalog.data.map(x=>({id:x.id,kind:x.kind,name:x.name,price:Number(x.price),discountType:x.discount_type,discountValue:Number(x.discount_value),description:x.description,hasInstallments:x.has_installments,installments:x.installments,hasWarranty:x.has_warranty,warranty:x.warranty,features:x.features,terms:x.terms})),clients:[],activity:events.data.map(x=>({icon:{created:"📝",view:"👀",select:"⭐",accept:"✅",deposit_paid:"💰",proof:"💸",follow_up:"🔔",renew:"🔄"}[x.type]||"•",text:x.message,time:relativeTime(x.created_at)}))};
    state.clients=Object.values(state.proposals.reduce((a,p)=>{const k=p.client.phone||p.client.name;a[k]||(a[k]={...p.client,proposals:0});a[k].proposals++;return a;},{}));fillSettings();renderDashboard();
  },
  // RPC anónimo por fetch: no necesita cargar supabase-js (~100 KB desde un CDN), que era lo que más demoraba la propuesta del cliente.
  async pub(name,args={}){
    const key=CFG.supabaseKey||"", r=await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,...(key.startsWith("sb_")?{}:{authorization:`Bearer ${key}`}),"content-type":"application/json"},body:JSON.stringify(args)});
    if(!r.ok){let m="";try{m=(await r.json()).message||"";}catch(e){} const err=new Error(m||`Error ${r.status}`); err.code=r.status===404?"PGRST202":""; throw err;}
    const t=await r.text(); return t?JSON.parse(t):null;
  },
  async publicProposal(id){
    // Las 4 consultas salen a la vez (antes: 1 y después 3), y las extras son opcionales.
    const [r,x,ox,v3,ph]=await Promise.all([
      this.pub("get_public_proposal",{p_id:id}),
      this.pub("get_public_extras",{p_id:id}).catch(()=>null),
      this.pub("get_public_option_extras",{p_id:id}).then(v=>({v}),()=>null),
      this.pub("get_public_v3",{p_id:id}).catch(()=>null),
      this.pub("get_public_option_photos",{p_id:id}).catch(()=>null)]);
    if(!r) return r;
    if(x) r.business={...(r.business||{}),...x};
    if(ox){const m=ox.v; if(m&&r.options) r.options.forEach(o=>{const e=m[o.id]; if(e){o.why=e.why;o.photo=e.photo;}}); r._ex=true;}
    if(ph&&r.options) r.options.forEach(o=>{const l=ph[o.id]; if(Array.isArray(l)&&l.length) o.photos=l;});
    if(v3){applyV3(r,v3); r.business={...(r.business||{}),afterSteps:v3.afterSteps||""};}
    return r;
  }
};
function applyUser(u){
  currentUser=u; STORAGE_KEY=`cierraclick_u_${u.id}`; state=loadState();
  if(u.biz&&state.business.name==="CierraClick Demo"){state.business.name=u.biz;saveState();}
  fillSettings(); updateAuthUI(); renderDashboard();
  Cloud.hydrate().catch(e=>toast(`No se pudieron cargar los datos: ${e.message||e}`));
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
  updateAvatarPreview();
  const f=$("#settingsForm"), b=state.business;
  Object.entries({businessName:b.name,whatsapp:b.whatsapp,paymentLink:b.paymentLink,brandColor:b.brandColor,holder:b.holder,bank:b.bank,cbu:b.cbu,alias:b.alias,cuit:b.cuit,transferNote:b.transferNote,depositPolicy:b.depositPolicy,faq:b.faq,afterSteps:b.afterSteps})
    .forEach(([k,v])=>{if(f.elements[k]) f.elements[k].value=v??"";});
}
async function markPaid(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  if(Cloud.on){try{await Cloud.rpc("confirm_deposit",{p_id:id});await Cloud.hydrate();toast("Seña marcada como recibida.");return;}catch(e){return toast(e.message||"No se pudo confirmar la seña.");}}
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
function saveState(){ if(!Cloud.on) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
  if(id==="publicModal"&&typeof stopTracker==="function") stopTracker();
  if(id==="builderModal"&&typeof cancelVoice==="function") cancelVoice();
  const modal=$("#"+id); modal.classList.remove("open"); modal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}
function resetBuilder(){
  $("#proposalForm").reset();
  builderKind="service";
  $("#proposalExpires").value=addDays(isoDate(Date.now()),7);
  builderOptions=[newOption({})];
  cancelVoice(); builderVoice=""; renderVoiceField();
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
          <label class="full">Por qué la recomiendo / frase para el cliente<input data-field="why" maxlength="300" value="${escapeHtml(o.why||"")}" placeholder="Ej: Es la que mejor relación precio-calidad tiene para tu caso."></label>
          <div class="photo-field full"><span>Fotos de esta opción (opcional · hasta ${MAX_PHOTOS}) <b class="photo-count">${photosOf(o).length}/${MAX_PHOTOS}</b></span>${photosOf(o).length?`<div class="photo-grid">${photosOf(o).map((ph,pi)=>safeImg(ph)?`<figure><img src="${safeImg(ph)}" alt="Foto ${pi+1}"><button type="button" class="photo-x" data-photo-del="${pi}" aria-label="Quitar foto ${pi+1}">×</button></figure>`:"").join("")}</div>`:""}${photosOf(o).length<MAX_PHOTOS?`<input type="file" data-photo accept="image/*" multiple>`:'<small>Llegaste al máximo. Quitá una para agregar otra.</small>'}</div>
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
async function saveToCatalog(o){
  const name=String(o.name).trim();
  if(!name) return toast("Poné un nombre para guardarla.");
  const {id,recommended,_open,photos,...rest}=o;
  const item={...rest,name,kind:builderKind,price:Number(o.price)||0,id:`c-${Math.random().toString(36).slice(2,8)}`};
  const i=state.catalog.findIndex(c=>c.kind===builderKind&&c.name.toLowerCase()===name.toLowerCase());
  if(i>=0) item.id=state.catalog[i].id;
  if(Cloud.on){try{item.id=await Cloud.rpc("save_catalog_item",{p:{...item,id:undefined}});}catch(e){return toast(e.message||"No se pudo guardar el catálogo.");}}
  if(i>=0) state.catalog[i]=item; else state.catalog.push(item);
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
function resizePhoto(file,max=640,q=.66){
  return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",q));};
    img.onerror=()=>rej(new Error("No se pudo leer la imagen."));img.src=u;});
}
document.addEventListener("change",async e=>{
  const t=e.target; if(!t.matches||!t.matches("[data-photo]")||!t.files||!t.files.length) return;
  const row=t.closest("[data-idx]"), o=builderOptions[row.dataset.idx];
  const room=MAX_PHOTOS-photosOf(o).length, files=[...t.files].filter(f=>f.type.startsWith("image/"));
  if(!files.length) return toast("Elegí archivos de imagen.");
  if(files.length>room) toast(`Solo entran ${MAX_PHOTOS} fotos por opción: agregué ${room}.`);
  try{
    const list=photosOf(o);
    for(const f of files.slice(0,room)) list.push(await resizePhoto(f));
    o.photos=list; o.photo=list[0]||""; o._open=true; renderOptionEditors(); renderBuilderPreview();
  }catch(err){toast(err.message);}
});
document.addEventListener("click",e=>{
  const b=e.target.closest&&e.target.closest("[data-photo-del]"); if(!b) return;
  const o=builderOptions[b.closest("[data-idx]").dataset.idx], i=Number(b.dataset.photoDel);
  const list=photosOf(o); list.splice(i,1); o.photos=list; o.photo=list[0]||""; o._open=true; renderOptionEditors(); renderBuilderPreview();
});
async function saveOptionExtras(id,p){
  if(!p.options.some(o=>o.why||photosOf(o).length)) return;
  try{await Cloud.rpc("set_option_extras",{p_id:id,p_extras:p.options.map(o=>({why:o.why||"",photo:photosOf(o)[0]||""}))});
    const r=state.proposals.find(x=>x.id===id); if(r) r.options.forEach((o,i)=>{if(p.options[i]){o.why=p.options[i].why;o.photo=photosOf(p.options[i])[0]||"";}});
  }catch(e){toast("La propuesta se creó, pero la foto y la frase no se guardaron: falta ejecutar supabase_fotos.sql.");}
  // Galería: solo hace falta cuando alguna opción tiene 2 o más fotos.
  if(p.options.some(o=>photosOf(o).length>1)){
    try{await Cloud.rpc("set_option_photos",{p_id:id,p_photos:p.options.map(o=>photosOf(o))});
      const r=state.proposals.find(x=>x.id===id); if(r) r.options.forEach((o,i)=>{if(p.options[i]) o.photos=photosOf(p.options[i]);});
    }catch(e){toast("Se guardó solo la primera foto de cada opción: falta ejecutar supabase_v4_fotos_nombre.sql en Supabase.");}
  }
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
    return {...o,_open:undefined,photos:photosOf(o),photo:photosOf(o)[0]||"",
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
    client:{name:$("#clientName").value.trim()||NO_NAME,phone:$("#clientPhone").value.trim()},
    title:$("#proposalTitle").value.trim(),
    validity:"",expiresAt:builderExpiry(),payments:selectedPayments(),cashDiscount:builderCash(),depositPct:builderDep(),
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    conditions:$("#conditions").value.trim(),
    ...perksFromForm(),
    options,
    status:"sent",views:0,chosenOption:null,createdAt:new Date().toISOString(),acceptedAt:null,depositStarted:0,
    lastEvent:"Propuesta creada."
  };
}

function optionMarkup(p,o,mode){
  const multi=p.options.length>1, rec=o.recommended&&multi, d=discountAmount(o), fin=finalPrice(o);
  const badge=o.discountType==="percent"?`-${Math.round(Number(o.discountValue)||0)}%`:`Ahorrás ${money(d)}`;
  const inst=o.hasInstallments&&o.installments>1?`<p class="meta-row"><b>${o.installments} cuotas</b> de ${money(fin/o.installments)}</p>`:"";
  const dep=p.depositPct>0?`<p class="meta-row">🔒 Seña para reservar: <b>${money(depositOf(p,o))}</b> (${p.depositPct}%)</p>`:"";
  const meta=(inst+String(cashLine(p,o)||"")+dep).trim();
  const feats=(o.features||"").trim()?`<ul class="feat">${o.features.split("\n").map(x=>x.trim()).filter(Boolean).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"";
  return `
    <article class="choice ${rec?"recommended":""}" data-choice="${escapeHtml(o.id)}">
      ${galleryMarkup(o)}
      <header class="choice-head"><h4>${escapeHtml(o.name)}</h4>${rec?'<span class="tag">⭐ Recomendada</span>':""}</header>
      <div class="choice-price">
        ${d>0?`<div class="price-row"><span class="price-old">${money(o.price)}</span><span class="disc">${badge}</span></div>`:""}
        <div class="price">${money(fin)}</div>
      </div>
      ${p.status!=="expired"?proofLine(p,o):""}
      ${o.why?`<blockquote class="choice-why">💬 ${escapeHtml(o.why)}<small>— ${escapeHtml(state.business.name||"")}</small></blockquote>`:""}
      ${meta?`<div class="choice-meta">${meta}</div>`:""}
      ${o.description?`<p>${escapeHtml(o.description)}</p>`:""}
      ${o.hasWarranty&&o.warranty?`<p>🛡️ Garantía: ${escapeHtml(o.warranty)}</p>`:""}
      ${feats}
      ${diffMarkup(p,o)}
      ${(o.terms||"").trim()?`<details class="terms"><summary>Términos y condiciones</summary><p>${escapeHtml(o.terms)}</p></details>`:""}
      ${mode==="full"&&multi&&p.status!=="expired"?`<button class="select" data-select-option="${escapeHtml(o.id)}" aria-label="Elegir ${escapeHtml(o.name)}">Elegir esta opción</button>`:""}
    </article>`;
}

function faqItems(b){
  return String(b.faq||"").split("\n").map(l=>l.split("|")).filter(a=>a.length>=2&&a[0].trim()&&a.slice(1).join("|").trim()).map(a=>({q:a[0].trim(),a:a.slice(1).join("|").trim()})).slice(0,12);
}
const FAQ_VISIBLE=4;
function faqMarkup(items){
  if(!items.length) return "";
  const extra=items.length-FAQ_VISIBLE;
  return `<div class="faq-wrap" data-faq><h5 class="faq-title">Preguntas frecuentes</h5><div class="faq-list">${items.map((x,i)=>`<details class="faq-item${i>=FAQ_VISIBLE?" faq-extra":""}" name="faq"${i>=FAQ_VISIBLE?" hidden":""}><summary>${escapeHtml(x.q)}</summary><p>${escapeHtml(x.a)}</p></details>`).join("")}</div>${extra>0?`<button type="button" class="faq-more" data-faq-more aria-expanded="false">Ver ${extra} pregunta${extra>1?"s":""} más</button>`:""}</div>`;
}
function assuranceMarkup(p){
  const b=state.business, items=faqItems(b), pol=(b.depositPolicy||"").trim(), war=p.options.filter(o=>o.hasWarranty&&o.warranty);
  if(!items.length&&!pol&&!war.length) return "";
  return `<section class="assure" data-sec="garantias"><h4>Antes de decidir</h4>
    ${pol?`<div class="assure-item"><b>🔒 Sobre la seña</b><p>${escapeHtml(pol)}</p></div>`:""}
    ${war.length?`<div class="assure-item"><b>🛡️ Garantía</b><p>${war.map(o=>`${escapeHtml(o.name)}: ${escapeHtml(o.warranty)}`).join(" · ")}</p></div>`:""}
    ${faqMarkup(items)}</section>`;
}
function galleryMarkup(o){
  const l=photosOf(o).map(safeImg).filter(Boolean), nm=escapeHtml(o.name);
  if(!l.length) return "";
  if(l.length===1) return `<img class="choice-photo" src="${l[0]}" alt="${nm}" loading="lazy">`;
  return `<div class="choice-gallery" role="group" aria-label="Fotos de ${nm}"><div class="gal-track" tabindex="0">${l.map((s,i)=>`<img src="${s}" alt="${nm} · foto ${i+1} de ${l.length}" loading="lazy">`).join("")}</div><button type="button" class="gal-nav prev" data-gal="-1" aria-label="Foto anterior">‹</button><button type="button" class="gal-nav next" data-gal="1" aria-label="Foto siguiente">›</button><span class="gal-count" aria-hidden="true">1/${l.length}</span></div>`;
}
document.addEventListener("scroll",e=>{
  const t=e.target; if(!t||!t.classList||!t.classList.contains("gal-track")) return;
  const i=Math.round(t.scrollLeft/Math.max(1,t.clientWidth)), c=t.parentElement.querySelector(".gal-count");
  if(c) c.textContent=`${Math.min(i+1,t.children.length)}/${t.children.length}`;
},true);
document.addEventListener("click",e=>{
  const b=e.target.closest&&e.target.closest("[data-gal]"); if(!b) return;
  const tr=b.parentElement.querySelector(".gal-track"); if(!tr) return;
  tr.scrollBy({left:Number(b.dataset.gal)*tr.clientWidth,behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
});
function publicProposalMarkup(p, mode="full"){
  const multi=p.options.length>1;
  const includes=(p.includes||[]).map(x=>`<div class="include">✓ ${escapeHtml(x)}</div>`).join("");
  return `
    <div class="public-card" data-public-id="${escapeHtml(p.id)}" style="--pc:${brandStyle()}">
      <div class="public-brand">${avatarHtml()}${escapeHtml(state.business.name).toUpperCase()}${ratingChip()}</div>
      <div class="public-greeting">${escapeHtml(hello(p.client.name))} 👋</div>
      <div class="public-title">${escapeHtml(p.title)}</div>
      ${mode==="full"?`<span class="valid">${expiryLine(p)}</span>`:""}
      ${p.status!=="expired"?voiceMarkup(p):""}
      ${mode==="full"&&p.status!=="expired"?`<div class="steps"><span><b>1</b> ${multi?"Elegí tu opción":"Revisá la propuesta"}</span><span><b>2</b> Aceptá</span><span><b>3</b> Reservá${p.depositPct>0?" con seña":""}</span></div><ul class="trust-strip"><li>🔒 Sin cargo al aceptar</li>${p.options.some(o=>o.hasWarranty&&o.warranty)?"<li>🛡️ Garantía</li>":""}<li>💬 Por WhatsApp</li></ul>`:""}
      ${p.status!=="expired"?perksMarkup(p):""}
      ${p.status!=="expired"?compareMarkup(p,mode):""}
      ${multi&&mode==="full"&&p.status!=="expired"?pickHelperMarkup(p):""}${multi&&mode==="full"?carouselTabsMarkup(p):""}<div class="choice-grid n${p.options.length}${multi&&mode==="full"?" cc-carousel":""}"${multi&&mode==="full"?' tabindex="0" role="group" aria-roledescription="carrusel" aria-label="Opciones de la propuesta"':""}>${p.options.map(o=>optionMarkup(p,o,mode)).join("")}</div>
      ${mode==="full"&&p.status!=="expired"?reviewsMarkup():""}
      <div class="public-includes" data-sec="incluye">${includes}</div>
      <div data-sec="pago">${payBlock(p)}</div>
      <p data-sec="condiciones" style="color:#64748b;font-size:13px">${escapeHtml(p.conditions)}</p>
      ${p.status!=="expired"?afterMarkup(p):""}
      ${mode==="full"&&p.status!=="expired"?`${assuranceMarkup(p)}<div class="later-box"><span>¿Necesitás tiempo o consultarlo con alguien?</span><button type="button" id="remindBtn">⏰ Recordame mañana</button><button type="button" id="shareBtn">👥 Compartir con otra persona</button></div><div class="pick-summary" id="pickSummary" hidden></div>${acceptFormMarkup(p)}<div class="doubt-panel" id="doubtPanel" hidden><b>¿Qué te frena? Te respondo por WhatsApp</b><div class="doubt-chips">${["Precio","Forma de pago","Plazo o fecha","Otra consulta"].map(d=>`<a class="chip-link" data-doubt="${d}" target="_blank" rel="noopener" href="#">${d}</a>`).join("")}</div></div>`:""}
      <div class="public-actions">
        ${mode==="full"&&p.status!=="expired"?`<div class="cta-note" id="ctaNote"></div>`:""}
        ${mode==="full"&&p.status==="expired"?`<button class="public-seña" disabled style="opacity:.5">Propuesta vencida</button>`:mode==="full"?`<button class="public-seña" id="acceptBtn">${escapeHtml(ctaLabel(p,chosenOf(p)))}</button>`:''}
        ${mode==="full"?`<a class="public-whatsapp" id="publicWhatsapp" href="#" target="_blank" rel="noopener">💬 WhatsApp</a>`:""}
        ${mode==="full"&&p.status!=="expired"?`<button type="button" class="public-doubt" id="doubtBtn">🙋 Tengo una duda</button>`:""}
      </div>
      <div class="public-foot">${expiryLine(p)} · Propuesta digital CierraClick</div>
    </div>`;
}

function markSelected(id){
  const root=$("#publicContent"), multi=$$("[data-choice]",root).length>1;
  $$("[data-choice]",root).forEach(el=>el.classList.toggle("selected",el.dataset.choice===id&&multi));
  $$("[data-cc-tab]",root).forEach(b=>b.classList.toggle("is-picked",b.dataset.ccTab===id&&multi));
  $$("[data-col]",root).forEach(el=>el.classList.toggle("sel",el.dataset.col===id&&multi));
}

function renderBuilderPreview(){
  updatePriceTip();
  const p = {
    kind:builderKind,
    client:{name:$("#clientName").value.trim()||NO_NAME},
    title:$("#proposalTitle").value||KINDS[builderKind].title,
    expiresAt:builderExpiry(),payments:selectedPayments(),cashDiscount:builderCash(),depositPct:builderDep(),
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    conditions:$("#conditions").value||"La reserva se confirma con la seña.",
    ...perksFromForm(), createdAt:new Date().toISOString(),
    options:builderOptions.map(o=>({...o,hasWarranty:o.hasWarranty&&!!String(o.warranty).trim(),installments:Number(o.installments)||2,recommended:o.recommended&&builderOptions.length>1}))
  };
  $("#builderPreview").innerHTML=publicProposalMarkup(p,"preview");
  renderStrength(p);
}
// Guía de cierre: solo mira lo que ya cargaste y sugiere lo que más ayuda a vender.
function renderStrength(p){
  const host=$("#builderPreview"); if(!host) return;
  let box=$("#proposalStrength"); if(!box){host.insertAdjacentHTML("beforebegin",'<div class="strength" id="proposalStrength" aria-live="polite"></div>'); box=$("#proposalStrength");}
  const multi=p.options.length>1, b=state.business||{}, O=p.options;
  const checks=[
    [!multi||O.some(o=>o.recommended),"Marcá una opción como recomendada","Cuando hay varias, elegir una guía al cliente y evita que postergue."],
    [p.depositPct>0,"Pedí una seña","Una seña convierte el \"me interesa\" en un compromiso."],
    [O.some(o=>o.why||photosOf(o).length),"Sumá una foto o el \"por qué la recomiendo\"","Una línea personal hace que se sienta atendido, no un presupuesto más."],
    [O.some(o=>(o.hasInstallments&&o.installments>1)||(Number(o.discountValue)||0)>0)||p.cashDiscount>0,"Ofrecé cuotas o un descuento","Le da una razón concreta para decidir hoy."],
    [!!(p.bonusText||p.slotsLeft>0),"Agregá un bonus por reservar a tiempo o cupos reales","Solo si es verdad: una fecha límite concreta ayuda a decidir."],
    [O.some(o=>o.hasWarranty),"Indicá la garantía","Reduce el miedo a equivocarse."],
    [faqItems(b).length>0,"Cargá preguntas frecuentes en Configuración","Responde las dudas antes de que se las lleve a otro lado."],
    [daysLeft(p)<=10,"Poné un vencimiento más corto (hasta 10 días)","Un plazo claro evita que la propuesta se enfríe."]
  ];
  const ok=checks.filter(c=>c[0]).length, pct=Math.round(100*ok/checks.length), miss=checks.filter(c=>!c[0]).slice(0,3);
  box.innerHTML=`<div class="strength-head"><b>Fuerza de la propuesta</b><span>${ok} de ${checks.length}</span></div><div class="strength-bar" role="img" aria-label="${pct}% completo"><i style="width:${pct}%"></i></div>${miss.length?`<ul>${miss.map(c=>`<li><b>${c[1]}</b><small>${c[2]}</small></li>`).join("")}</ul>`:'<p class="strength-ok">¡Muy buena! Tiene todo lo que ayuda a cerrar.</p>'}`;
}

function openBuilder(){
  if(!currentUser) return openAuth("login");
  resetBuilder();
  openModal("builderModal");
  $("#clientName").focus();
}

async function createProposal(e){
  e.preventDefault();
  const p=collectBuilderData();
  if(Cloud.on){try{const id=await Cloud.rpc("create_proposal",{p:{...p,options:p.options.map(({photo,photos,...o})=>o),id:undefined,validity:undefined,createdAt:undefined,status:undefined,views:undefined,chosenOption:undefined,acceptedAt:undefined,depositStarted:undefined,lastEvent:undefined,bonusText:undefined,bonusHours:undefined,slotsLeft:undefined,slotsLabel:undefined,voice:undefined,holdHours:undefined}});await Cloud.hydrate();await saveOptionExtras(id,p);await saveProposalExtras(id,p);const remote=state.proposals.find(x=>x.id===id);closeModal("builderModal");if(remote)window.open(`https://wa.me/${normalizePhone(remote.client.phone)}?text=${encodeURIComponent(shareText(remote))}`,"_blank","noopener");toast("Propuesta creada y WhatsApp preparado.");return;}catch(ex){return toast(ex.message||"No se pudo crear la propuesta.");}}
  state.proposals.unshift(p);
  const existing=state.clients.find(c=>c.phone===p.client.phone);
  if(existing) existing.proposals+=1;
  else state.clients.unshift({name:p.client.name,phone:p.client.phone,proposals:1});
  state.activity.unshift({icon:"📝",text:`Creaste una propuesta para ${p.client.name}.`,time:"Ahora"});
  saveState();
  closeModal("builderModal");
  renderDashboard();
  const waText = shareText(p);
  window.open(`https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(waText)}`,"_blank","noopener");
  toast("Propuesta creada y WhatsApp preparado.");
}

function normalizePhone(phone){ return String(phone||"").replace(/\D/g,""); }

const PROPOSAL_MODE=document.documentElement.classList.contains("proposal-mode");
function showProposalMissing(){
  $("#publicContent").innerHTML=`<div class="public-card"><div class="public-greeting">Esta propuesta no está disponible</div><p style="color:#64748b">El link puede estar incompleto o la propuesta fue eliminada. Pedile a quien te la envió que te mande el link de nuevo.</p></div>`;
  openModal("publicModal");
}
async function openPublicLink(id){
  try{ if(id&&(Cloud.on||state.proposals.some(p=>p.id===id))) await openPublic(id); }catch(e){}
  if(!$("#publicModal").classList.contains("open")) showProposalMissing();
  document.documentElement.classList.add("proposal-ready");
}
async function openPublic(id,preview=false,quiet=false){
  if(Cloud.on&&!preview){try{const remote=await Cloud.publicProposal(id);if(!remote)return toast("No se encontró la propuesta.");const p={...remote,createdAt:remote.createdAt||new Date().toISOString()};state.business={...state.business,...remote.business};state.proposals=[p,...state.proposals.filter(x=>x.id!==id)];Cloud.pub("track_proposal",{p_id:id,p_type:"view"}).catch(()=>{});return openPublic(id,true,true);}catch(e){return toast(e.message||"No se pudo abrir la propuesta.");}}
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  if(Cloud.on&&currentUser&&!p._ex){p._ex=true;try{const ox=await Cloud.rpc("get_public_option_extras",{p_id:id});(p.options||[]).forEach(o=>{const x=ox&&ox[o.id];if(x){o.why=x.why;o.photo=x.photo;}});}catch(e){}
    try{const ph=await Cloud.rpc("get_public_option_photos",{p_id:id});(p.options||[]).forEach(o=>{const l=ph&&ph[o.id];if(Array.isArray(l)&&l.length)o.photos=l;});}catch(e){}}
  if(Cloud.on&&currentUser&&!p._v3){p._v3=true;try{const v=await Cloud.rpc("get_public_v3",{p_id:id});if(v)applyV3(p,v);}catch(e){}}
  currentProposalId=id;
  if(!preview){
  p.views=(p.views||0)+1; p.lastViewedAt=Date.now();
  if(p.status==="sent") p.status="viewed";
  p.lastEvent="Cliente abrió la propuesta.";
  state.activity.unshift({icon:"👀",text:`${p.client.name} abrió una propuesta.`,time:"Ahora"});
  saveState();
  } else if(!quiet) toast("Vista previa: no cuenta como visita.");
  $("#publicContent").innerHTML=publicProposalMarkup(p,"full");
  if(PROPOSAL_MODE) document.title=`${p.title} · ${state.business.name||"CierraClick"}`;
  const sel=chosenOf(p);
  $("#publicWhatsapp").href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${state.business.name} 👋 Quiero consultar la propuesta${firstName(p.client.name)?` de ${p.client.name}`:""} por ${money(finalPrice(sel))}.`)}`;
  markSelected(sel.id);
  openModal("publicModal");
  initChoiceCarousel();
  initPickHelper();
  if(p.status==="accepted"){ renderAcceptedState(p); if(!preview||quiet) startTracker(p); return; }
  attachPublicEvents(p);
  if(!preview||quiet) startTracker(p);
}
function attachPublicEvents(p){
  const upd=()=>{const o=chosenOf(p), sum=$("#pickSummary");
    const ab=$("#acceptBtn"); if(ab) ab.textContent=ctaLabel(p,o);
    const st=$("#sumTxt"); if(st){const t=sumTexts(p,o); st.innerHTML=t.head; $("#sumDet").innerHTML=t.det;}
    const cn=$("#ctaNote"); if(cn) cn.innerHTML=riskLine(p,o);
    if(sum){sum.hidden=false;sum.innerHTML=`<b>${escapeHtml(o.name)}</b> · ${money(finalPrice(o))}${p.depositPct>0?` · Seña ${money(depositOf(p,o))}`:""}${o.hasInstallments&&o.installments>1?` · ${o.installments} cuotas`:""}`;}
    const as=$("#acceptSum"); if(as){const dep=depositOf(p,o); as.innerHTML=`Elegiste <b>${escapeHtml(o.name)}</b> por <b>${money(finalPrice(o))}</b>.${p.depositPct>0?` Seña para reservar: <b>${money(dep)}</b> · saldo ${money(finalPrice(o)-dep)}.`:""}${bonusActive(p)?` 🎁 Incluye el bonus: ${escapeHtml(p.bonusText)}.`:""}`;}
    const at=$("#acceptTermsText"); if(at) at.textContent=[o.terms,p.conditions].filter(x=>x&&String(x).trim()).join("\n\n")||"Esta propuesta no tiene condiciones adicionales.";
    $$("[data-doubt]").forEach(a=>{a.href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${state.business.name} 👋 ${soy(p)}Tengo una duda sobre "${p.title}" (${o.name}, ${money(finalPrice(o))}): ${a.dataset.doubt}.`)}`;});};
  upd(); if(p.options.length>1) markSelected(chosenOf(p).id);
  $("#remindBtn")?.addEventListener("click",()=>{
    p.remindAt=Date.now()+864e5; p.lastEvent="Pidió que le recuerden mañana.";
    state.activity.unshift({icon:"⏰",text:`${p.client.name} pidió que le recuerdes mañana.`,time:"Ahora"}); saveState();
    toast("Listo, le avisamos a "+(state.business.name||"tu vendedor")+". Te escribirán mañana.");
    window.open(`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${state.business.name} 👋 ${soy(p)}Lo estoy pensando con "${p.title}". ¿Me escribís mañana para retomarlo?`)}`,"_blank","noopener");
  });
  $("#shareBtn")?.addEventListener("click",async()=>{
    const url=shareLink(p), text=`Mirá esta propuesta de ${state.business.name}: ${p.title}`;
    p.shared=(p.shared||0)+1; state.activity.unshift({icon:"👥",text:`${p.client.name} compartió la propuesta.`,time:"Ahora"}); saveState();
    try{ if(navigator.share){await navigator.share({title:p.title,text,url});return;} }catch(e){ if(e&&e.name==="AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text+" "+url)}`,"_blank","noopener");
  });
  $("#doubtBtn")?.addEventListener("click",()=>{const el=$("#doubtPanel"); el.hidden=!el.hidden; if(!el.hidden) el.scrollIntoView({block:"center",behavior:"smooth"});});
  $$("[data-doubt]").forEach(a=>a.addEventListener("click",()=>{p.doubts=(p.doubts||0)+1;p.lastDoubt=a.dataset.doubt;state.activity.unshift({icon:"🙋",text:`${p.client.name} tiene una duda: ${a.dataset.doubt}.`,time:"Ahora"});saveState();}));
  $$("[data-select-option]",$("#publicContent")).forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.selectOption;
      p.chosenOption=id;
      p.lastEvent=`Cliente eligió ${p.options.find(x=>x.id===id)?.name||"una opción"}.`;
      state.activity.unshift({icon:"⭐",text:`${p.client.name} seleccionó una opción.`,time:"Ahora"});
      saveState(); if(Cloud.on) Cloud.rpc("track_proposal",{p_id:p.id,p_type:"select",p_option:id}).catch(()=>toast("No se pudo guardar la elección."));
      markSelected(id); upd(); celebratePick(id);
      const chosen=p.options.find(x=>x.id===id);
      $("#publicWhatsapp").href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${state.business.name} 👋 Quiero avanzar con ${chosen.name} por ${money(finalPrice(chosen))}.`)}`;
      toast(`Elegiste ${chosen.name}.`);
    });
  });
  $("#sumBtn")?.addEventListener("click",()=>$("#acceptBtn")?.click());
  const aform=$("#acceptForm");
  $("#acceptBtn")?.addEventListener("click",()=>{
    if(!aform) return;
    if(aform.hidden){aform.hidden=false; upd(); aform.scrollIntoView({block:"center",behavior:"smooth"}); setTimeout(()=>{try{$("#acceptName").focus({preventScroll:true});}catch(e){}},350); return;}
    aform.dispatchEvent(new Event("submit",{cancelable:true}));
  });
  aform?.addEventListener("submit",async e=>{
    e.preventDefault();
    const err=$("#acceptErr"), show=m=>{err.textContent=m; err.hidden=false;};
    const name=($("#acceptName").value||"").trim().replace(/\s+/g," ");
    if(name.length<5||!name.includes(" ")) return show("Escribí tu nombre y apellido.");
    if(!$("#acceptTerms").checked) return show("Tildá la casilla para aceptar las condiciones.");
    err.hidden=true;
    const btn=$("#acceptConfirm"); btn.disabled=true; btn.textContent="Confirmando…";
    const ok=await acceptNow(p,chosenOf(p),name);
    if(!ok){btn.disabled=false; btn.textContent="Confirmar mi aceptación";}
  });
}
function renderAcceptedStateBase(p){
  const option=chosenOf(p), b=state.business, e=escapeHtml;
  const pu=String(b.paymentLink||"").trim(), paymentUrl=/^https?:\/\//i.test(pu)?pu:/^[\w-]+(\.[\w-]+)+(\/|$)/.test(pu)?"https://"+pu:"";
  const hasTransfer=!!(b.cbu||b.alias), fin=finalPrice(option), dep=depositOf(p,option), paid=!!p.depositPaidAt, first=firstName(p.client.name);
  const trow=(l,v,c)=>v?`<div class="tr-row"><span>${l}</span><b>${e(v)}</b>${c?`<button type="button" class="text-btn" data-copy="${e(v)}">Copiar</button>`:""}</div>`:"";
  const copyAll=[["Titular",b.holder],["Banco",b.bank],["CBU/CVU",b.cbu],["Alias",b.alias],["CUIT/CUIL",b.cuit]].filter(r=>r[1]).map(r=>`${r[0]}: ${r[1]}`).concat(dep>0?[`Monto: ${money(dep)}`]:[]).join("\n");
  const transferBlock=hasTransfer?`<div class="card transfer"><strong>Transferí la seña${dep?` de ${money(dep)}`:""}</strong>${trow("Titular",b.holder)}${trow("Banco",b.bank)}${trow("CBU/CVU",b.cbu,1)}${trow("Alias",b.alias,1)}${trow("CUIT/CUIL",b.cuit)}${b.transferNote?`<p class="hint">${e(b.transferNote)}</p>`:""}<button type="button" class="copy-all" data-copy="${e(copyAll)}">📋 Copiar todos los datos</button><button type="button" class="public-whatsapp" id="proofBtn">${p.proofSentAt?"✅ Aviso enviado · reenviar":"💸 Ya transferí · enviar comprobante"}</button></div>`:"";
  const amt=dep>0?`<div class="pay-amt"><span>Seña para reservar tu lugar</span><b>${money(dep)}</b><small>Saldo: ${money(fin-dep)}</small></div>`:`<div class="pay-amt"><span>Total de tu propuesta</span><b>${money(fin)}</b><small>No hay seña: coordinás el pago con ${e(b.name)}.</small></div>`;
  const payLabel=dep>0?`Pagar seña de ${money(dep)}`:"Ir al pago";
  let primary="";
  if(!paid){
    if(paymentUrl) primary=`<div class="pay-card">${amt}<details class="qr-box" id="qrBox"><summary>📱 Pagar desde otro dispositivo (QR)</summary><div id="qrHolder"></div></details></div>${hasTransfer?`<details class="alt-pay"><summary>Prefiero pagar por transferencia</summary>${transferBlock}</details>`:""}`;
    else if(hasTransfer) primary=`<div class="pay-card">${amt}${transferBlock}</div>`;
    else primary=`<div class="pay-card">${amt}<p class="hint">${e(b.name)} te va a pasar los datos para pagar por WhatsApp.</p></div>`;
  }
  const mainAction=paid?"":paymentUrl?`<a class="public-seña" href="${e(paymentUrl)}" target="_blank" rel="noopener" id="depositLink">${e(payLabel)}</a>`:hasTransfer?`<button type="button" class="public-seña" data-copy="${e(copyAll)}">📋 Copiar datos${dep>0?` y transferir ${money(dep)}`:""}</button>`:Cloud.on?"":`<button class="public-seña" id="depositDemo">${e(payLabel)} (demo)</button>`;
  const lead=paid?"Tu reserva está confirmada.":p.proofSentAt?`${e(b.name)} está verificando tu transferencia.`:dep>0?`Falta un solo paso: la seña de <b>${money(dep)}</b>.`:"Tu elección quedó registrada.";
  $("#publicContent").innerHTML=`
    <div class="public-card" style="--pc:${brandStyle()}">
      <div class="public-brand">${avatarHtml()}${e(state.business.name).toUpperCase()}${ratingChip()}</div>
      <div class="public-greeting">${paid?"¡Reserva confirmada!":(first?`¡Listo, ${e(first)}!`:"¡Listo!")} ✅</div>
      <p class="pay-lead">${lead}</p>
      <p class="pay-choice">Tu elección: <strong>${e(option.name)}</strong> · ${money(fin)}</p>
      ${p.acceptedName?`<p class="accepted-by">Aceptada por <b>${e(p.acceptedName)}</b>${p.termsAcceptedAt?" · condiciones aceptadas":""}</p>`:""}${bonusWonMarkup(p)}
      ${paid?`<div class="state-note">💰 <b>Seña recibida.</b> ¡Tu reserva está confirmada!</div>`:p.proofSentAt?`<div class="state-note">💸 Avisaste que transferiste. ${e(b.name)} lo está verificando.</div>`:""}
      ${paid||p.proofSentAt?"":holdMarkup(p)}
      ${primary}
      ${afterMarkup(p,true)}
      <div class="public-actions">
        ${mainAction}
        <button class="public-whatsapp" id="receiptBtn" type="button">📄 Descargar constancia</button>
        <a class="public-whatsapp" href="https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${state.business.name} 👋 Acepté la propuesta y quiero avanzar con la seña.`)}" target="_blank" rel="noopener">Escribir al vendedor</a>
      </div>
    </div>`;
  $("#receiptBtn")?.addEventListener("click",()=>printReceipt(p.id));
  $$("[data-copy]").forEach(x=>x.addEventListener("click",()=>{(navigator.clipboard?navigator.clipboard.writeText(x.dataset.copy):Promise.reject()).then(()=>toast("Copiado ✔"),()=>toast("No se pudo copiar."));}));
  $("#proofBtn")?.addEventListener("click",()=>{
    p.proofSentAt=Date.now(); p.lastEvent="Cliente avisó que transfirió la seña.";
    state.activity.unshift({icon:"💸",text:`${p.client.name} avisó que transfirió la seña.`,time:"Ahora"}); saveState(); if(Cloud.on) Cloud.rpc("report_deposit_transfer",{p_id:p.id}).catch(()=>toast("No se pudo registrar el aviso."));
    window.open(`https://wa.me/${normalizePhone(b.whatsapp)}?text=${encodeURIComponent(`${saludoHora()}, ${b.name} 👋 ${soy(p)}Ya transferí la seña${dep?` de ${money(dep)}`:""} por "${p.title}" (${option.name}). Te mando el comprobante por acá.`)}`,"_blank","noopener");
    toast("Adjuntá el comprobante en el chat de WhatsApp.");
  });
  $("#depositLink")?.addEventListener("click",()=>{p._payClicked=true;p.depositStarted=(p.depositStarted||0)+1;saveState();if(Cloud.on)Cloud.rpc("track_proposal",{p_id:p.id,p_type:"deposit_click"}).catch(()=>{});});
  $("#depositDemo")?.addEventListener("click",()=>{p._payClicked=true;p.depositStarted=(p.depositStarted||0)+1;saveState();if(Cloud.on)Cloud.rpc("track_proposal",{p_id:p.id,p_type:"deposit_click"}).catch(()=>{});toast("Demo: configurá un link de pago en Ajustes.");});
  const qb=$("#qrBox"); if(qb){const svg=CCQR.svg(paymentUrl,184); if(svg) $("#qrHolder").innerHTML=svg; else qb.remove();}
  watchPayExit(p);
}

function renderGreeting(){
  const n=String((currentUser&&state.business.name)||"").trim(), el=$("#greeting");
  if(el) el.textContent=n&&n!=="CierraClick Demo"?`${saludoHora()}, ${n} 👋`:`${saludoHora()} 👋`;
}
let _engBoot=false;
function renderDashboard(){
  if(Cloud.on&&currentUser&&!_engBoot){_engBoot=true;loadEngTotals();loadReviews();registerOwnerDevice();}
  renderGreeting();
  if(syncExpired(state.proposals)) saveState();
  const proposals=state.proposals||[];
  const views=proposals.reduce((s,p)=>s+(p.views||0),0);
  const accepted=proposals.filter(p=>p.status==="accepted").length;
  $("#metricProposals").textContent=proposals.length;
  $("#metricViews").textContent=views;
  $("#metricAccepted").textContent=accepted;
  $("#metricConversion").textContent=proposals.length?`${Math.round(accepted/proposals.length*100)}%`:"0%";

  const wk=Date.now()-7*DAY, won=proposals.filter(p=>p.status==="accepted"&&new Date(p.acceptedAt)>wk);
  $("#weekCard").innerHTML=proposals.length?`<b>Últimos 7 días</b><div class="week-row"><span><strong>${proposals.filter(p=>new Date(p.createdAt)>wk).length}</strong> enviadas</span><span><strong>${won.length}</strong> aceptadas</span><span><strong>${money(won.reduce((s,p)=>s+finalPrice(chosenOf(p)),0))}</strong> cerrado</span><span><strong>${money(recoveredOf(proposals,+wk).amount)}</strong> tras seguimiento</span></div>`:"";
  const open=proposals.filter(p=>p.status==="sent"||p.status==="viewed");
  const pending=open.reduce((s,p)=>s+finalPrice(chosenOf(p)),0);
  $("#pendingBanner").innerHTML=open.length?`💰 <b>${money(pending)}</b> esperando respuesta en ${open.length} propuesta${open.length>1?"s":""}. Pronóstico estimado: <b>${money(salesMetrics(proposals).forecast)}</b>. Tocá <b>🔔 Seguimiento</b> para recuperarlas por WhatsApp.`:"";
  const paidBtn=p=>(p.status==="accepted"&&!p.depositPaidAt)?`<button class="text-btn" data-paid="${p.id}">✔ Seña recibida</button>`:"";
  const followBtn=p=>p.status==="lost"?`<button class="text-btn" data-follow="${p.id}">💬 Retomar</button>`:(p.status==="accepted"&&!p.depositPaidAt&&p.depositPct>0)?`<button class="text-btn" data-follow="${p.id}">💸 Pedir seña</button>`:(p.status==="sent"||p.status==="viewed")?`<button class="text-btn" data-follow="${p.id}">${(p.followUps||0)>=3?"✉️ Cierre amable":"🔔 Seguimiento"}</button>`:"";
  const reviewBtn=p=>p.status==="accepted"?`<button class="text-btn" data-ask-review="${p.id}">⭐ Pedir opinión</button>`:"";
  const lostBtn=p=>["sent","viewed","expired"].includes(p.status)?`<button class="text-btn" data-lost="${p.id}">✖ Perdida</button>`:"";
  const items=todayItems();
  $("#todayCount").textContent=items.length||"";
  $("#todayList").innerHTML=items.map(({p,reason})=>`<div class="proposal-item"><div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${heat(p)} · ${reason}</span></div><div>${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>`:followBtn(p)+paidBtn(p)+lostBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div></div>`).join("")||'<p style="color:#64748b">🎉 Todo al día: no hay propuestas para seguir hoy.</p>';
  $("#hotList").innerHTML=proposals.slice(0,5).map(p=>`
    <div class="proposal-item">
      <div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${p.views||0} vistas</span></div>
      <div><span class="status">${statusLabel(p.status)}</span>${followBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div>
    </div>`).join("") || '<p style="color:#64748b">Todavía no hay propuestas.</p>';

  $("#activityList").innerHTML=(state.activity||[]).slice(0,6).map(a=>`<div class="activity"><b>${a.icon}</b><div>${escapeHtml(a.text)}<br><span style="color:#94a3b8">${escapeHtml(a.time)}</span></div></div>`).join("");
  $("#proposalTable").innerHTML=proposals.map(p=>`
    <tr><td><strong>${escapeHtml(p.client.name)}</strong><br><small>${escapeHtml(p.title)}</small></td>
    <td>${money(finalPrice(chosenOf(p)))}</td>
    <td><span class="badge ${p.status}">${statusLabel(p.status)}</span><br><small>${heat(p)}${engBadge(p)}</small></td>
    <td>${p.views||0}</td><td>${relativeTime(p.createdAt)}</td>
    <td class="actions">${followBtn(p)}${paidBtn(p)}${lostBtn(p)}${reviewBtn(p)}${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>`:""}${p.status==="accepted"?`<button class="text-btn" data-receipt="${p.id}">📄 Constancia</button>`:""}<button class="text-btn" data-copylink="${p.id}">🔗 Link</button><button class="text-btn" data-dup="${p.id}">Duplicar</button><button class="text-btn" data-open="${p.id}">Ver</button><button class="text-btn" data-hist="${p.id}">📊 Atención</button></td></tr>`).join("");
  $("#clientsGrid").innerHTML=(state.clients||[]).map(c=>`<div class="client"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.phone)}</p><p>${c.proposals||0} propuesta(s)</p></div>`).join("");
  renderPerformance();
  $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openPublic(b.dataset.open,true)));
  $$("[data-follow]").forEach(b=>b.addEventListener("click",()=>followUp(b.dataset.follow)));
  $$("[data-lost]").forEach(b=>b.addEventListener("click",()=>openLost(b.dataset.lost)));
  $$("[data-hist]").forEach(b=>b.addEventListener("click",()=>openHistory(b.dataset.hist)));
  $$("[data-ask-review]").forEach(b=>b.addEventListener("click",()=>openAskReview(b.dataset.askReview)));
  $$("[data-paid]").forEach(b=>b.addEventListener("click",()=>markPaid(b.dataset.paid)));
  $$("[data-renew]").forEach(b=>b.addEventListener("click",()=>renewProposal(b.dataset.renew)));
  $$("[data-copylink]").forEach(b=>b.addEventListener("click",()=>{const p=state.proposals.find(x=>x.id===b.dataset.copylink);(navigator.clipboard?navigator.clipboard.writeText(shareLink(p)):Promise.reject()).then(()=>toast("Link copiado ✔"),()=>toast("No se pudo copiar."));}));
  $$("[data-dup]").forEach(b=>b.addEventListener("click",()=>duplicateProposal(b.dataset.dup)));
  $$("[data-receipt]").forEach(b=>b.addEventListener("click",()=>printReceipt(b.dataset.receipt)));
}
// ===== Agenda "Hoy", renovar, duplicar, constancia =====
function todayItems(){
  const now=Date.now(), out=[];
  const hTxt=h=>h<48?`${Math.floor(h)} h`:`${Math.floor(h/24)} días`;
  state.proposals.forEach(p=>{
    if(p.status==="accepted"&&p.proofSentAt&&!p.depositPaidAt){out.push({p,reason:"💸 Avisó que transfirió: verificá y confirmá la seña.",prio:0});return;}
    if(p.remindAt&&p.remindAt<=now&&["sent","viewed"].includes(p.status)){out.push({p,reason:"⏰ Pidió que lo contactes hoy.",prio:0});return;}
    if(p.status==="accepted"&&!p.depositPaidAt&&!p.proofSentAt&&p.payExitAt&&now-p.payExitAt>=20*6e4){out.push({p,reason:"👋 Abrió la pantalla de pago y se fue: ofrecele ayuda con la transferencia.",prio:0});return;}
    if(p.status==="accepted"&&!p.depositPaidAt&&p.depositPct>0){const ha=(now-new Date(p.acceptedAt||p.createdAt).getTime())/36e5;if(ha>=6)out.push({p,reason:`✅ Aceptó hace ${hTxt(ha)} y falta la seña.`,prio:1});return;}
    if(p.status==="lost"){if(p.recontactAt&&p.recontactAt<=now)out.push({p,reason:`🔁 Hora de retomar (${p.lostReason||"perdida"}).`,prio:2});return;}
    if(p.status==="accepted") return;
    const last=Math.max(new Date(p.lastViewedAt||p.createdAt).getTime(),p.lastFollowUpAt||0), h=(now-last)/36e5;
    let reason=null, prio=9;
    if(p.status==="expired"){reason="⛔ Venció: renovala y volvé a escribirle.";prio=1;}
    else if(p.doubts&&!p.lastFollowUpAt){reason=`🙋 Tiene una duda${p.lastDoubt?` (${p.lastDoubt})`:""} y nadie le respondió.`;prio=1;}
    else if(bonusActive(p)&&bonusDeadline(p)-now<12*36e5){reason=`🎁 El bonus vence en ${fmtLeft(bonusDeadline(p)-now)}: avisale.`;prio=2;}
    else if(daysLeft(p)<=2){reason=`⏳ ${expiryText(p)}.`;prio=2;}
    else if(p.chosenOption&&h>=6){reason=`⭐ Eligió una opción y no aceptó (hace ${hTxt(h)}).`;prio=2;}
    else if(h>=24){reason=p.status==="viewed"?`👀 La vio y no respondió (hace ${hTxt(h)}).`:`📨 Sin abrir hace ${hTxt(h)}.`;prio=p.status==="viewed"?3:4;}
    if(reason) out.push({p,reason,prio});
  });
  return out.sort((a,b)=>a.prio-b.prio||finalPrice(chosenOf(b.p))*(leadScore(b.p)+10)-finalPrice(chosenOf(a.p))*(leadScore(a.p)+10));
}
async function renewProposal(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  if(Cloud.on){try{await Cloud.rpc("renew_proposal",{p_id:id,p_days:7});await Cloud.hydrate();toast("Renovada por 7 días.");return;}catch(e){return toast(e.message||"No se pudo renovar.");}}
  p.expiresAt=addDays(isoDate(Date.now()),7);
  if(p.status==="expired") p.status=p.views>0?"viewed":"sent";
  state.activity.unshift({icon:"🔄",text:`Renovaste la propuesta de ${p.client.name} hasta el ${fmtDate(p.expiresAt)}.`,time:"Ahora"});
  saveState(); renderDashboard(); toast("Renovada por 7 días.");
}
function duplicateProposal(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  openBuilder();
  $("#clientName").value=p.client.name===NO_NAME?"":p.client.name; $("#clientPhone").value=p.client.phone;
  $("#proposalTitle").value=p.title; $("#includes").value=(p.includes||[]).join("\n"); $("#conditions").value=p.conditions||"";
  $("#cashDiscount").value=p.cashDiscount||0; $("#depositPct").value=p.depositPct||0;
  $("#bonusText").value=p.bonusText||""; $("#bonusHours").value=p.bonusHours||48; $("#slotsLeft").value=p.slotsLeft??""; $("#slotsLabel").value=p.slotsLabel||""; $("#holdHours").value=p.holdHours||"";
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
  const rows=[["Cliente",p.client.name],p.acceptedName?["Aceptada por",p.acceptedName]:null,["Propuesta",p.title],["Opción elegida",o.name],["Descripción",o.description],["Precio de lista",money(o.price)],d>0?["Descuento","-"+money(d)]:null,["Precio final",money(fin)],p.depositPct>0?[`Seña (${p.depositPct}%)`,money(Math.round(fin*p.depositPct/100))]:null,p.cashDiscount>0?[`Pago contado (-${p.cashDiscount}%)`,money(fin*(1-p.cashDiscount/100))]:null,o.hasInstallments?["Cuotas",`${o.installments} de ${money(fin/o.installments)}`]:null,o.hasWarranty?["Garantía",o.warranty]:null,["Medios de pago",(p.payments||[]).map(k=>PAY[k]).join(", ")||"A convenir"],["Aceptada el",new Date(p.acceptedAt||Date.now()).toLocaleString("es-AR")],p.termsAcceptedAt?["Condiciones aceptadas",new Date(p.termsAcceptedAt).toLocaleString("es-AR")]:null,bonusWon(p)?["Bonus incluido (aceptó a tiempo)",p.bonusText]:null,["Vigencia de la propuesta",`hasta el ${fmtDate(p.expiresAt)}`],(o.terms||p.conditions)?["Términos y condiciones",[o.terms,p.conditions].filter(Boolean).join(" · ")]:null].filter(r=>r&&r[1]);
  const w=window.open("","_blank"); if(!w) return toast("Habilitá las ventanas emergentes para generar la constancia.");
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Constancia - ${e(p.client.name)}</title><style>body{font:14px system-ui,sans-serif;max-width:680px;margin:30px auto;padding:0 20px;color:#0b1220}h1{font-size:22px;margin:4px 0 2px}small{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:9px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}td:first-child{color:#64748b;width:38%}.f{margin-top:22px;font-size:11px;color:#94a3b8}</style><small>${e(state.business.name).toUpperCase()}</small><h1>Constancia de aceptación</h1><small>Código: ${e(p.id)}</small><table>${rows.map(r=>`<tr><td>${e(r[0])}</td><td>${e(String(r[1]))}</td></tr>`).join("")}</table><p class="f">Documento generado con CierraClick que deja constancia de la opción aceptada. No reemplaza una factura.</p><script>onload=()=>print()<\/script>`);
  w.document.close();
}
// ===== Compartir: link y mensaje persuasivo (la vista previa la arma functions/index.js) =====
function shareLink(p){return `${location.origin}${location.pathname.replace(/index\.html$/,"")}?p=${encodeURIComponent(p.id)}`;}
function shareText(p){
  const first=firstName(p.client.name), d=daysLeft(p), multi=p.options.length>1;
  const when=d<=0?"Vence hoy":d===1?"Vence mañana":`Vigente hasta el ${fmtDate(p.expiresAt)}`;
  return `${hello(first)} 👋 Te armé tu propuesta de ${state.business.name}: ${multi?"elegí la opción que más te sirva":"revisá el detalle"}${p.depositPct>0?` y reservá con una seña del ${p.depositPct}%`:""}. ${when}.${perksText(p)} 👇\n${shareLink(p)}`;
}
// Seguimiento por WhatsApp con un toque (propuestas enviadas o vistas sin aceptar)
function leadScore(p){
  const t=p.lastViewedAt?new Date(p.lastViewedAt).getTime():0, h=(Date.now()-t)/36e5;
  let sc=Math.min(p.views||0,5)*10;
  if((p.views||0)>0&&h<24) sc+=20;
  if(p.chosenOption) sc+=25;
  sc+=Math.min(p.doubts||0,2)*5; if(p.shared) sc+=10;
  const E=engOf(p); if(E.total>=180000) sc+=15; else if(E.total>=60000) sc+=10; if(E.scroll>=80) sc+=5; if(E.terms) sc+=5;
  if(daysLeft(p)<=2) sc+=10;
  sc-=Math.max(0,(p.followUps||0)-2)*10;
  return Math.max(0,Math.min(100,sc));
}
function followMsg(p){
  const first=firstName(p.client.name), link=shareLink(p), o=chosenOf(p), tot=money(finalPrice(o));
  const dep=p.depositPct>0?money(depositOf(p,o)):tot, vig=fmtDate(p.expiresAt), bn=bonusActive(p)?` 🎁 Si avanzás antes del ${fmtDateTime(bonusDeadline(p))}: ${p.bonusText}.`:"";
  if(p.status==="lost") return `${hello(first)} 👋 Hace unos días hablamos de "${p.title}". ¿Retomamos? Si algo cambió, te lo ajusto.`;
  if(p.status==="accepted"&&p.payExitAt&&!p.proofSentAt&&!p.depositPaidAt) return `${hello(first)} 👋 ¿Te ayudo con la transferencia? Si te trabaste con algún paso o con los datos, decime y lo resolvemos ahora.${p.depositPct>0?` La seña es ${dep}.`:""}`;
  if(p.status==="accepted") return `${hello(first)} 👋 ¡Gracias por aceptar! Para dejarte reservado queda la seña de ${dep}. Si ya la hiciste, mandame el comprobante y lo confirmo: ${link}`;
  if(p.status==="expired") return `${hello(first)} 👋 Tu propuesta venció el ${vig}. Si querés, te la actualizo hoy y retomamos: ${link}`;
  if(p.remindAt&&p.remindAt<=Date.now()) return `${hello(first)} 👋 Como quedamos, te escribo hoy por "${p.title}". ¿Pudiste pensarlo? Si querés avanzar, te lo dejo reservado.${bn} ${link}`;
  if((p.followUps||0)<3&&p.lastDoubt){
    const cuotas=p.options.some(x=>x.hasInstallments&&x.installments>1);
    const byDoubt={
      "Precio":`Vi que te quedó una duda con el precio. ${p.options.length>1?"Si querés, te ayudo a elegir la opción que mejor se ajuste a lo que necesitás.":"Contame qué te preocupa y vemos cómo acomodarlo."}`,
      "Forma de pago":`Vi que consultaste por la forma de pago. Te explico cómo es: ${p.depositPct>0?`reservás con la seña de ${dep} y el resto lo coordinamos`:"lo coordinamos como te quede cómodo"}${cuotas?", y hay opción en cuotas":""}.`,
      "Plazo o fecha":"Vi que te preocupa el plazo. Decime qué fecha te sirve y veo si llegamos.",
      "Otra consulta":"Vi que tenías una consulta. Preguntame lo que quieras y te respondo enseguida."};
    if(byDoubt[p.lastDoubt]) return `${hello(first)} 👋 ${byDoubt[p.lastDoubt]}${bn} ${link}`;
  }
  if((p.followUps||0)>=3) return `${hello(first)}, no quiero molestarte 🙂 Dejo la propuesta disponible hasta el ${vig} por si querés retomarla más adelante: ${link}`;
  if(p.chosenOption) return `${hello(first)} 👋 Vi que elegiste ${o.name} (${tot}).${p.depositPct>0?` La seña es ${dep}.`:""} ¿Avanzamos y te lo dejo reservado?${bn} ${link}`;
  if(daysLeft(p)<=2) return `${hello(first)} 👋 Aviso rápido: ${expiryText(p).toLowerCase()}. ¿Avanzamos para que no pierdas el precio?${bn} ${link}`;
  if((p.views||0)>=3) return `${hello(first)} 👋 Vi que estuviste mirando la propuesta. ¿Querés que te ayude a elegir la opción que mejor te cierre?${bn} ${link}`;
  if(p.status==="viewed") return `${hello(first)} 👋 Vi que ya revisaste la propuesta. ¿Te quedó alguna duda? Si querés avanzar, te reservo con la seña.${bn} Vigente hasta el ${vig}: ${link}`;
  return `${hello(first)} 👋 ¿Pudiste ver la propuesta que te mandé?${bn} Vigente hasta el ${vig}: ${link}`;
}
async function followUp(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  const msg=followMsg(p);
  if(Cloud.on){try{await Cloud.rpc("record_follow_up",{p_id:id});}catch(e){if(p.status!=="accepted"&&p.status!=="lost")return toast(e.message||"No se pudo registrar el seguimiento.");}}
  p.followUps=(p.followUps||0)+1; p.lastFollowUpAt=Date.now(); p.remindAt=null; if(p.status==="lost") p.recontactAt=null;
  state.activity.unshift({icon:"🔔",text:`Seguimiento enviado a ${p.client.name}.`,time:"Ahora"});
  saveState(); renderDashboard();
  window.open(`https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
}
/* ===== Atención del cliente: tiempo, scroll, secciones y toques ===== */
let _trk=null;
const fmtDur=ms=>{const s=Math.round(ms/1000); if(s<60) return s+" s"; const m=Math.floor(s/60); return m<60?`${m} min ${s%60} s`:`${Math.floor(m/60)} h ${m%60} min`;};
function startTracker(p){
  stopTracker();
  const T=_trk={p,sid:Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4),buf:[],ms:{},scroll:0,sent:0,act:Date.now(),vis:new Set(),off:[]};
  const root=$("#publicContent"), w=innerWidth, optName=id=>(p.options.find(o=>o.id===id)||{}).name||"una opción";
  T.buf.push({k:"open",key:`${w<640?"celular":w<1000?"tablet":"escritorio"} ${w}px`,ms:0});
  const on=(t,ev,fn,o)=>{t.addEventListener(ev,fn,o);T.off.push(()=>t.removeEventListener(ev,fn,o));};
  ["pointerdown","keydown","touchstart","wheel","mousemove"].forEach(ev=>on(window,ev,()=>{T.act=Date.now();},{passive:true}));
  on(document,"scroll",e=>{T.act=Date.now();const t=e.target===document?document.scrollingElement:e.target;if(!t||!t.scrollHeight)return;
    T.scroll=Math.max(T.scroll,Math.min(100,Math.round((t.scrollTop+t.clientHeight)/t.scrollHeight*100)));},true);
  const sc=root.closest(".modal-dialog"); if(sc&&sc.scrollHeight) T.scroll=Math.min(100,Math.round(sc.clientHeight/sc.scrollHeight*100));
  const keyOf=el=>el.dataset.choice?"o:"+el.dataset.choice:"s:"+el.dataset.sec;
  if("IntersectionObserver" in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{const k=keyOf(e.target); e.isIntersecting&&e.intersectionRatio>=.5?T.vis.add(k):T.vis.delete(k);}),{threshold:[0,.5,1]});
    root.querySelectorAll("[data-choice],[data-sec]").forEach(el=>io.observe(el)); T.off.push(()=>io.disconnect());
  }
  on(root,"click",e=>{const el=e.target.closest("button,a,summary,[data-choice]"); if(!el) return; let key;
    if(el.dataset.selectOption) key="Elige "+optName(el.dataset.selectOption);
    else if(el.id==="acceptBtn"||el.id==="sumBtn") key="Toca el botón de aceptar";
    else if(el.id==="acceptConfirm") key="Toca «Confirmar mi aceptación»";
    else if(el.tagName==="SUMMARY"&&el.closest(".terms-box")) key="Abre las condiciones antes de aceptar";
    else if(el.id==="publicWhatsapp") key="Toca WhatsApp";
    else if(el.id==="doubtBtn") key="Abre «Tengo una duda»";
    else if(el.dataset.doubt) key="Duda: "+el.dataset.doubt;
    else if(el.tagName==="SUMMARY"&&el.closest(".faq-item")) key="Abre pregunta: "+el.textContent.trim().slice(0,40);
    else if(el.tagName==="SUMMARY"){const c=el.closest("[data-choice]");key="Abre términos"+(c?" de "+optName(c.dataset.choice):"");}
    else if(el.dataset.choice) key="Toca la opción "+optName(el.dataset.choice);
    else {const tx=(el.textContent||el.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,40); if(!tx) return; key="Toca: "+tx;}
    T.buf.push({k:"tap",key,ms:0,t:Date.now()});
  },true);
  on(root,"play",e=>{if(e.target&&e.target.tagName==="AUDIO") T.buf.push({k:"tap",key:"Escucha el mensaje de voz",ms:0,t:Date.now()});},true);
  const add=(k,ms)=>{T.ms[k]=(T.ms[k]||0)+ms;};
  const tick=setInterval(()=>{ if(document.visibilityState==="visible"&&Date.now()-T.act<30000){add("total",1000);T.vis.forEach(k=>add(k,1000));} },1000);
  const fl=setInterval(()=>flushTracker(),10000);
  T.off.push(()=>{clearInterval(tick);clearInterval(fl);});
  on(document,"visibilitychange",()=>{if(document.visibilityState==="hidden") flushTracker();});
  on(window,"pagehide",()=>flushTracker());
}
function stopTracker(){ if(!_trk) return; flushTracker(); _trk.off.forEach(f=>f()); _trk=null; }
function flushTracker(){
  const T=_trk; if(!T) return;
  const ev=T.buf.splice(0);
  Object.entries(T.ms).forEach(([key,ms])=>{if(ms>0) ev.push({k:"time",key,ms});}); T.ms={};
  if(T.scroll>T.sent){ev.push({k:"scroll",key:"max",ms:T.scroll});T.sent=T.scroll;}
  if(!ev.length) return;
  const now=Date.now(); ev.forEach(e=>{e.s=T.sid;e.t=e.t||now;});
  const p=T.p;
  if(Cloud.on){
    const c=window.CC_CONFIG||{}, key=c.supabaseKey||"";
    fetch(`${c.supabaseUrl}/rest/v1/rpc/track_engagement`,{method:"POST",keepalive:true,headers:{apikey:key,...(key.startsWith("sb_")?{}:{authorization:`Bearer ${key}`}),"content-type":"application/json"},
      body:JSON.stringify({p_id:p.id,p_session:T.sid,p_events:ev.map(e=>({k:e.k,key:e.key,ms:e.ms}))})}).catch(()=>{});
  } else { p.engEvents=(p.engEvents||[]).concat(ev).slice(-600); saveState(); }
}
function engSummary(ev){
  const S={total:0,sessions:new Set(),scroll:0,opts:{},secs:{},taps:[],device:"",last:0};
  (ev||[]).forEach(e=>{S.sessions.add(e.s); if(e.t>S.last) S.last=e.t;
    if(e.k==="time"){ if(e.key==="total") S.total+=e.ms; else if(e.key.startsWith("o:")){const i=e.key.slice(2);S.opts[i]=(S.opts[i]||0)+e.ms;} else if(e.key.startsWith("s:")){const i=e.key.slice(2);S.secs[i]=(S.secs[i]||0)+e.ms;} }
    else if(e.k==="scroll") S.scroll=Math.max(S.scroll,e.ms);
    else if(e.k==="tap") S.taps.push(e);
    else if(e.k==="open") S.device=e.key;});
  S.sessions=S.sessions.size; return S;
}
function engOf(p){
  if(p.engMs!=null) return {total:p.engMs,sessions:p.engSessions||0,scroll:p.engScroll||0,terms:false};
  if(p.engEvents&&p.engEvents.length){const S=engSummary(p.engEvents);return {total:S.total,sessions:S.sessions,scroll:S.scroll,terms:S.taps.some(t=>t.key.startsWith("Abre términos"))};}
  return {total:0,sessions:0,scroll:0,terms:false};
}
const engBadge=p=>{const E=engOf(p);return E.total>=1000?` · ⏱ ${fmtDur(E.total)}`:"";};
function engInsights(p,S){
  const out=[], nm=id=>(p.options.find(o=>o.id===id)||{}).name||"una opción";
  const top=Object.entries(S.opts).sort((a,b)=>b[1]-a[1]);
  if(top.length&&top[0][1]>=5000){out.push(`⏱ Pasó más tiempo en ${nm(top[0][0])} (${fmtDur(top[0][1])}).`);
    if(p.chosenOption&&p.chosenOption!==top[0][0]) out.push(`🤔 Miró más ${nm(top[0][0])} pero eligió ${nm(p.chosenOption)}: puede estar comparando precios.`);}
  if((S.secs.pago||0)>=8000) out.push("💳 Leyó la forma de pago: ofrecele reservar con la seña.");
  if((S.secs.condiciones||0)>=8000||S.taps.some(t=>t.key.startsWith("Abre términos"))) out.push("📄 Revisó las condiciones: aclarale cualquier duda sobre eso.");
  if(S.taps.some(t=>t.key==="Escucha el mensaje de voz")) out.push("🎧 Escuchó tu mensaje de voz: buen momento para escribirle.");
  if((S.secs.despues||0)>=6000) out.push("🧭 Leyó «qué pasa después de reservar»: ya se imagina el siguiente paso.");
  const qs=[...new Set(S.taps.filter(t=>t.key.startsWith("Abre pregunta")).map(t=>t.key.slice(16)))]; if(qs.length) out.push("❓ Abrió estas preguntas: "+qs.slice(0,3).join(" · ")+".");
  if(S.sessions>=2) out.push(`🔁 Volvió ${S.sessions} veces: lo está evaluando en serio.`);
  if(S.total&&S.total<15000&&S.scroll<50) out.push("⚠️ Se fue rápido y no llegó al final: quizás no vio las opciones.");
  if(S.scroll>=90&&S.total>=60000) out.push("✅ Leyó toda la propuesta con atención.");
  return out;
}
function engHtml(p,S){
  if(!S.total&&!S.taps.length&&!S.sessions) return '<p class="tool-sub">Todavía no hay datos de atención. Se registran cuando el cliente abre el link.</p>';
  const SEC={incluye:"Qué incluye",pago:"Forma de pago",condiciones:"Condiciones",garantias:"Garantías y preguntas",despues:"Qué pasa después",mensaje:"Mensaje de voz",bonus:"Bonus y cupos",aceptar:"Confirmación",resumen:"Resumen fijo",comparar:"Comparativa"};
  const bars=(obj,lab)=>{const e=Object.entries(obj).filter(x=>x[1]>=1000).sort((a,b)=>b[1]-a[1]); const mx=e[0]?e[0][1]:1;
    return e.map(([k,ms])=>`<div class="eng-row"><span>${escapeHtml(lab(k))}</span><i style="width:${Math.max(4,Math.round(ms/mx*100))}%"></i><em>${fmtDur(ms)}</em></div>`).join("")||'<p class="tool-sub">Sin datos suficientes.</p>';};
  const ins=engInsights(p,S);
  return `<div class="eng-stats"><div><b>${fmtDur(S.total)}</b><span>tiempo activo</span></div><div><b>${S.sessions}</b><span>visita${S.sessions!==1?"s":""}</span></div><div><b>${S.scroll}%</b><span>llegó hasta</span></div><div><b>${escapeHtml(S.device||"—")}</b><span>dispositivo</span></div></div>
  ${ins.length?`<ul class="eng-insights">${ins.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}
  <h4>Tiempo por opción</h4>${bars(S.opts,id=>(p.options.find(o=>o.id===id)||{}).name||"Opción")}
  <h4>Tiempo por sección</h4>${bars(S.secs,k=>SEC[k]||k)}
  <h4>Todo lo que tocó</h4>${S.taps.length?`<ol class="eng-taps">${S.taps.slice(-25).reverse().map(t=>`<li>${escapeHtml(t.key)}<small>${relativeTime(new Date(t.t).toISOString())}</small></li>`).join("")}</ol>`:'<p class="tool-sub">Todavía no tocó nada.</p>'}`;
}
async function fillEngagement(p){
  let ev=p.engEvents||[];
  if(Cloud.on&&currentUser){try{const sb=await Auth.client(); const {data}=await sb.from("proposal_engagement_events").select("session,kind,key,ms,created_at").eq("proposal_id",p.id).order("created_at").limit(1500);
    ev=(data||[]).map(r=>({s:r.session,k:r.kind,key:r.key,ms:r.ms,t:new Date(r.created_at).getTime()}));}catch(e){}}
  const box=$("#engBox"); if(box) box.innerHTML=engHtml(p,engSummary(ev));
}
async function loadEngTotals(){
  if(!Cloud.on||!currentUser) return;
  try{const sb=await Auth.client(); const {data}=await sb.rpc("engagement_totals"); (data||[]).forEach(r=>{const p=state.proposals.find(x=>x.id===r.proposal_id); if(p){p.engMs=Number(r.ms);p.engSessions=Number(r.sessions);p.engScroll=Number(r.max_scroll);}}); renderDashboard();}catch(e){}
}
function initRoi(){
  const t=$("#roiTicket"),n=$("#roiCount"),c=$("#roiRate"),out=$("#roiOut"); if(!t||!out) return;
  const plan=29900, fx=v=>String(v).replace(".",",");
  const calc=()=>{const tk=Math.max(0,Number(t.value)||0),cnt=Math.max(0,Number(n.value)||0),r=Math.min(100,Math.max(0,Number(c.value)||0));
    const now=Math.round(cnt*r/100), more=Math.max(1,Math.round(cnt*.1)), meses=tk/plan;
    out.innerHTML=`Hoy cerrás unas <b>${now}</b> ventas por mes. <b>Una sola venta más</b> suma ${money(tk)}: eso cubre ${meses>=1?`unos <b>${fx(meses.toFixed(1))} meses</b> del plan Profesional (${money(plan)})`:"parte del plan Profesional ("+money(plan)+")"}. Si cerraras 10 puntos más, serían ${more} ventas extra: <b>${money(more*tk)}</b> por mes.`;};
  [t,n,c].forEach(i=>i.addEventListener("input",calc)); calc();
}
/* ===== Modo rápido: 3 opciones armadas desde un solo precio ===== */
function quickOptions(){
  const base=Number($("#quickPrice").value)||0;
  if(base<=0) return toast("Ingresá el precio de tu opción principal.");
  if(builderOptions.some(o=>Number(o.price)>0)&&!confirm("Esto reemplaza las opciones que ya cargaste. ¿Seguir?")) return;
  const step=base>=50000?1000:100, rd=v=>Math.round(v/step)*step;
  // La diferencia entre Básica y Recomendada es menor que entre Recomendada y Premium (guía de precios por niveles).
  builderOptions.splice(0,builderOptions.length,
    newOption({name:"Básica",price:rd(base*.8),description:"Lo esencial para resolver lo que necesitás."}),
    newOption({name:"Recomendada",price:rd(base),recommended:true,description:"La mejor relación entre precio y alcance."}),
    newOption({name:"Premium",price:rd(base*1.3),description:"Alcance completo y máxima tranquilidad."}));
  renderOptionEditors(); renderBuilderPreview();
  toast("Listo: ajustá nombres, precios y detalles de cada opción.");
}
function updatePriceTip(){
  const el=$("#priceTip"); if(!el) return;
  const ps=builderOptions.map(o=>finalPrice(o)).filter(v=>v>0).sort((a,b)=>a-b); let t="";
  if(builderOptions.length>=4) t="💡 Con 4 opciones el cliente suele dudar más: probá con 3.";
  else if(ps.length>=3&&ps[1]-ps[0]>=ps[2]-ps[1]) t="💡 Conviene que la diferencia entre la opción económica y la del medio sea menor que entre la del medio y la premium.";
  else if(ps.length===2&&ps[0]===ps[1]) t="💡 Las dos opciones cuestan lo mismo: el cliente no tiene qué comparar.";
  el.textContent=t; el.hidden=!t;
}
function initQuick(){
  const list=$("#optionsList"); if(!list||$("#quickBtn")) return;
  list.insertAdjacentHTML("beforebegin",`<div class="quick-box"><div><b>⚡ Modo rápido</b><small>Poné el precio de tu opción principal y armamos Básica, Recomendada y Premium. Después ajustás lo que quieras.</small></div><div class="quick-row"><input id="quickPrice" type="number" inputmode="numeric" min="0" placeholder="Ej: 850000" aria-label="Precio de la opción principal"><button type="button" class="btn btn-primary" id="quickBtn">Armar 3 opciones</button></div></div>`);
  list.insertAdjacentHTML("afterend",`<p class="price-tip" id="priceTip" hidden></p>`);
  $("#quickBtn").addEventListener("click",quickOptions);
  $("#quickPrice").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();quickOptions();}});
}
/* ===== Dinero recuperado y pronóstico ===== */
const lastFollowOf=p=>p.lastFollowUpAt||(p.last_follow_up_at?new Date(p.last_follow_up_at).getTime():0);
function recoveredOf(ps,since=0){
  // Cierres de clientes que aceptaron DESPUÉS de que el vendedor les escribió (no prueba que fue por eso).
  const hit=ps.filter(p=>{const a=p.acceptedAt?new Date(p.acceptedAt).getTime():0; return a&&(p.followUps||0)>0&&lastFollowOf(p)&&a>=lastFollowOf(p)&&a>=since;});
  return {n:hit.length,amount:hit.reduce((x,p)=>x+finalPrice(chosenOf(p)),0)};
}
function salesMetrics(ps){
  const price=p=>finalPrice(chosenOf(p)), openP=ps.filter(p=>["sent","viewed"].includes(p.status)&&daysLeft(p)>=0);
  const acc=ps.filter(p=>p.status==="accepted"||p.acceptedAt).length, lost=ps.filter(p=>p.status==="lost").length, exp=ps.filter(p=>p.status==="expired").length;
  const closed=acc+lost+exp, real=closed>=5, rate=real?acc/closed:.25;
  // Probabilidad = tu tasa de cierre ajustada por el interés de cada propuesta (0,5x a 2x), con tope.
  const prob=p=>Math.min(.9,Math.max(.02,rate*(.5+leadScore(p)/100*1.5)));
  return {rate,real,closed,nOpen:openP.length,open:openP.reduce((x,p)=>x+price(p),0),
    forecast:Math.round(openP.reduce((x,p)=>x+price(p)*prob(p),0)),hot:openP.filter(p=>leadScore(p)>=60).reduce((x,p)=>x+price(p),0)};
}
/* ===== Foto de perfil, estrellas y comentarios ===== */
const OK_IMG=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
const safeImg=v=>OK_IMG.test(v||"")?v:"";
const stars=n=>"★".repeat(n)+"☆".repeat(5-n);
const fmtAvg=v=>(Math.round(v*10)/10).toFixed(1).replace(".",",");
function resizeSquare(file,size=256,q=.82){
  return new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{const m=Math.min(img.width,img.height),c=document.createElement("canvas");c.width=c.height=size;
      c.getContext("2d").drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,size,size);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",q));};
    img.onerror=()=>rej(new Error("No se pudo leer la imagen."));img.src=u;});
}
function avatarHtml(){
  const b=state.business||{};
  return safeImg(b.photo)?`<span class="avatar has-photo"><img src="${safeImg(b.photo)}" alt=""></span>`:`<span class="avatar">${escapeHtml((b.name||"?").trim().charAt(0).toUpperCase())}</span>`;
}
function updateAvatarPreview(){
  const el=$("#avatarPreview"); if(!el) return; const b=state.business||{};
  el.innerHTML=safeImg(b.photo)?`<img src="${safeImg(b.photo)}" alt="Foto de perfil">`:escapeHtml((b.name||"?").trim().charAt(0).toUpperCase());
  const d=$("#avatarDel"); if(d) d.hidden=!b.photo;
}
document.addEventListener("change",async e=>{
  if(!e.target.matches||!e.target.matches("#avatarInput")||!e.target.files[0]) return;
  try{state.business.photo=await resizeSquare(e.target.files[0]); saveState(); updateAvatarPreview(); toast("Foto lista. Tocá «Guardar configuración» para publicarla.");}catch(err){toast(err.message);}
});
document.addEventListener("click",e=>{
  if(e.target.closest&&e.target.closest("#avatarDel")){state.business.photo=""; saveState(); updateAvatarPreview(); toast("Foto quitada. Guardá la configuración para confirmar.");}
});
function getReviews(){
  const b=state.business||{};
  if(Array.isArray(b.reviews)&&b.rating) return {avg:Number(b.rating.avg)||0,count:Number(b.rating.count)||0,
    list:b.reviews.map(r=>({stars:r.stars,comment:r.comment,photo:r.photo||"",author:r.author,source:r.source,at:r.created_at?new Date(r.created_at).getTime():(r.at||0)}))};
  const rs=[...(state.proposals||[]).filter(p=>p.review&&p.review.stars).map(p=>({stars:p.review.stars,comment:p.review.comment||"",photo:p.review.photo||"",author:firstName(p.client.name),source:"proposal",at:p.review.at||0})),...(state.extReviews||[]).map(r=>({...r,source:"external"}))];
  const c=rs.length;
  return {avg:c?rs.reduce((x,r)=>x+r.stars,0)/c:0,count:c,list:rs.filter(r=>r.comment).sort((x,y)=>y.at-x.at).slice(0,8)};
}
function ratingChip(){const r=getReviews(); return r.count?`<span class="rating-chip">★ ${fmtAvg(r.avg)} · ${r.count} ${r.count>1?"opiniones":"opinión"}</span>`:"";}
const reviewCard=r=>{const nm=(r.author||"Cliente").trim()||"Cliente";
  return `<figure class="review"><div class="review-top"><span class="review-av${safeImg(r.photo)?" has-photo":""}" aria-hidden="true">${safeImg(r.photo)?`<img src="${safeImg(r.photo)}" alt="" loading="lazy">`:escapeHtml(nm.charAt(0).toUpperCase())}</span><div><div class="review-stars" role="img" aria-label="${Number(r.stars)||0} de 5 estrellas">${stars(r.stars)}</div><figcaption>${escapeHtml(nm)}<small>${r.source==="external"?"Cliente del negocio":"Cliente verificado"}</small></figcaption></div></div>${r.comment?`<blockquote>${escapeHtml(r.comment)}</blockquote>`:""}</figure>`;};
const revRow=list=>`<div class="rev-row" tabindex="0" role="group" aria-label="Opiniones de clientes">${list.map(reviewCard).join("")}</div>`;
function reviewsMarkup(){
  const r=getReviews(); if(!r.count) return "";
  const list=r.list.filter(x=>x.comment).slice(0,8);
  return `<section class="reviews-box" data-sec="opiniones"><div class="rev-head"><div class="rev-sum"><strong>${fmtAvg(r.avg)}</strong><span class="review-stars">${stars(Math.round(r.avg))}</span><small>${r.count} opinión${r.count>1?"es":""} de clientes</small></div>${list.length>1?'<div class="rev-nav"><button type="button" data-rev-nav="-1" aria-label="Opiniones anteriores">‹</button><button type="button" data-rev-nav="1" aria-label="Opiniones siguientes">›</button></div>':""}</div>${list.length?revRow(list):""}</section>`;
}
function reviewsPanel(){
  const r=getReviews();
  return `<div class="loss-list"><b>⭐ Opiniones de tus clientes</b>${state.business.pendingReviews?`<small style="color:#92400e">${state.business.pendingReviews} opinión${state.business.pendingReviews>1?"es":""} en revisión: no se muestran al público ni cuentan en el promedio.</small>`:""}${r.count?`<div class="rev-sum"><strong>${fmtAvg(r.avg)}</strong><span class="review-stars">${stars(Math.round(r.avg))}</span><small>${r.count} opinión${r.count>1?"es":""}</small></div>${revRow(r.list)}`:'<p style="color:#64748b;margin:6px 0 0">Todavía no hay opiniones. Aparecen cuando un cliente que aceptó una propuesta deja la suya desde su enlace.</p>'}</div>`;
}
function renderPerfExtras(){renderPerfExtrasBase(); const box=$("#perfExtras"); if(box) box.insertAdjacentHTML("beforeend",reviewsPanel());}
async function loadReviews(){
  if(!Cloud.on||!currentUser) return;
  try{const sb=await Auth.client(); const q=c=>sb.from("business_reviews").select(c).order("created_at",{ascending:false}).limit(100);
    let {data,error}=await q("stars,comment,author,source,status,created_at,photo"); if(error) ({data}=await q("stars,comment,author,source,status,created_at"));
    const rows=data||[], pub=rows.filter(r=>r.status==="published"), c=pub.length;
    state.business.rating={avg:c?pub.reduce((x,r)=>x+r.stars,0)/c:0,count:c};
    state.business.reviews=pub.filter(r=>r.comment).slice(0,8); state.business.pendingReviews=rows.length-c;}catch(e){}
}
function reviewFormMarkup(p){
  const rv=p.review, bn=escapeHtml(state.business.name||"el negocio");
  if(rv&&rv.stars&&!p._editReview) return `<section class="review-box" id="reviewBox"><h4>Tu opinión</h4>${safeImg(rv.photo)?`<span class="rv-avatar"><img src="${safeImg(rv.photo)}" alt="Tu foto"></span>`:""}<div class="review-stars big">${stars(rv.stars)}</div>${rv.comment?`<p>“${escapeHtml(rv.comment)}”</p>`:""}${p._token?"":'<button type="button" class="text-btn" id="reviewEdit">Editar mi opinión</button>'}</section>`;
  return `<section class="review-box" id="reviewBox"><h4>Dejá tu opinión sobre ${bn}</h4><p class="tool-sub">Ayuda a otras personas a decidir. Es opcional.</p>
    <div class="star-pick" role="radiogroup" aria-label="Calificación">${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn ${rv&&rv.stars>=n?"on":""}" data-star="${n}" role="radio" aria-label="${n} estrella${n>1?"s":""}">★</button>`).join("")}</div>
    <textarea id="reviewText" rows="3" maxlength="500" placeholder="Contá cómo fue tu experiencia (opcional)">${escapeHtml(rv?rv.comment||"":"")}</textarea>
    <div class="rv-photo"><span class="rv-avatar" id="rvAvatar">${safeImg(p._rvPhoto)?`<img src="${safeImg(p._rvPhoto)}" alt="Tu foto">`:"👤"}</span>
      <div class="rv-photo-actions"><b>Tu foto (opcional)</b><div>
        <label class="btn btn-secondary btn-sm">📷 Sacarme una foto<input type="file" accept="image/*" capture="user" data-rvphoto hidden></label>
        <label class="btn btn-secondary btn-sm">🖼 Elegir foto<input type="file" accept="image/*" data-rvphoto hidden></label>
        <button type="button" class="text-btn" id="rvPhotoDel" ${p._rvPhoto?"":"hidden"}>Quitar</button></div>
        <small>Se muestra junto a tu comentario.</small></div></div>
    <button type="button" class="btn btn-primary" id="reviewSend">Enviar opinión</button></section>`;
}
function deviceId(){try{let d=localStorage.getItem("cc_device"); if(!d){d=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now()); localStorage.setItem("cc_device",d);} return d;}catch(e){return "";}}
function registerOwnerDevice(){ if(Cloud.on&&currentUser) Cloud.rpc("register_owner_device",{p_device:deviceId()}).catch(()=>{}); }
function renderReviewBox(p){const box=$("#reviewBox"); if(box){box.outerHTML=reviewFormMarkup(p); attachReview(p);}}
function attachReview(p){
  let sel=p.review?p.review.stars:0;
  $$("[data-star]").forEach(b=>b.addEventListener("click",()=>{sel=Number(b.dataset.star); $$("[data-star]").forEach(x=>x.classList.toggle("on",Number(x.dataset.star)<=sel));}));
  $("#reviewEdit")?.addEventListener("click",()=>{p._editReview=true; p._rvPhoto=(p.review&&p.review.photo)||p._rvPhoto||""; renderReviewBox(p);});
  const paintRv=()=>{const av=$("#rvAvatar"); if(av) av.innerHTML=safeImg(p._rvPhoto)?`<img src="${safeImg(p._rvPhoto)}" alt="Tu foto">`:"👤"; const d=$("#rvPhotoDel"); if(d) d.hidden=!p._rvPhoto;};
  $$("[data-rvphoto]").forEach(inp=>inp.addEventListener("change",async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    try{p._rvPhoto=await resizeSquare(f,192,.8); paintRv();}catch(err){toast(err.message||"No se pudo leer la foto.");}
    inp.value="";
  }));
  $("#rvPhotoDel")?.addEventListener("click",()=>{p._rvPhoto=""; paintRv();});
  $("#reviewSend")?.addEventListener("click",async()=>{
    if(!sel) return toast("Elegí cuántas estrellas das.");
    const comment=($("#reviewText").value||"").trim().slice(0,500), photo=safeImg(p._rvPhoto);
    try{
      if(p._token){ if(Cloud.on) await Cloud.rpc("submit_review_request",{p_token:p._token,p_stars:sel,p_comment:comment,p_device:deviceId()}); else localSubmitReq(p._token,sel,comment,photo); }
      else if(Cloud.on) await Cloud.rpc("submit_review",{p_id:p.id,p_stars:sel,p_comment:comment,p_device:deviceId()});
    }catch(e){return toast(e.message||"No se pudo enviar tu opinión.");}
    if(Cloud.on){ // la foto va aparte: si falta el SQL nuevo, la opinión igual queda guardada
      try{await Cloud.rpc("set_review_photo",{p_id:p._token?null:p.id,p_token:p._token||null,p_photo:photo||""});}
      catch(e){if(photo) toast("Tu opinión se envió, pero la foto no se pudo guardar todavía.");}
    }
    p.review={stars:sel,comment,photo,at:Date.now()}; p._editReview=false; if(!p._token) saveState(); toast("¡Gracias por tu opinión!"); renderReviewBox(p);
  });
}
function renderAcceptedState(p){
  if(!p.review&&Cloud.on&&state.business.review) p.review=state.business.review;
  renderAcceptedStateBase(p);
  const card=$("#publicContent .public-card"); if(card){card.insertAdjacentHTML("beforeend",reviewFormMarkup(p)); attachReview(p);}
}
/* ===== Pedir opinión (dentro o fuera de la plataforma) ===== */
const reviewLink=t=>`${location.origin}${location.pathname.replace(/index\.html$/,"")}?r=${t}`;
function localSubmitReq(t,stars,comment,photo=""){
  const r=(state.reviewRequests||{})[t]; if(!r||r.used) throw new Error("Este link ya no está disponible");
  r.used=true;
  if(r.proposalId){const p=state.proposals.find(x=>x.id===r.proposalId); if(p) p.review={stars,comment,photo,at:Date.now()};}
  else (state.extReviews=state.extReviews||[]).push({stars,comment,photo,author:r.name.split(" ")[0],at:Date.now()});
  saveState();
}
async function createReviewToken(name,phone,proposalId){
  if(Cloud.on) return await Cloud.rpc("create_review_request",{p_name:name,p_phone:phone,p_proposal:proposalId||null});
  const t="r"+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
  state.reviewRequests=state.reviewRequests||{}; state.reviewRequests[t]={name,phone,proposalId:proposalId||null,createdAt:Date.now(),used:false}; saveState(); return t;
}
async function sendReviewRequest(name,phone,proposalId){
  name=(name||"").trim();
  if(!name||normalizePhone(phone).length<8) return toast("Completá el nombre y un WhatsApp válido.");
  let token; try{token=await createReviewToken(name,phone,proposalId);}catch(e){return toast(e.message||"No se pudo crear el pedido.");}
  const msg=`${hello(name)} 👋 ¡Gracias por confiar en ${state.business.name}! ¿Me dejás una opinión? Te lleva 1 minuto y me ayuda un montón: ${reviewLink(token)}`;
  closeModal("toolModal");
  state.activity.unshift({icon:"⭐",text:`Pediste una opinión a ${name}.`,time:"Ahora"}); saveState();
  window.open(`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
}
function openAskReview(id){
  const p=id?state.proposals.find(x=>x.id===id):null;
  openTool(`<h3>⭐ Pedir una opinión</h3><p class="tool-sub">${p?"Le mandamos un link de un solo uso para que cuente cómo le fue.":"Sirve también para clientes que cerraron el trato fuera de la plataforma."}</p>
    <label class="tool-field">Nombre del cliente<input id="rqName" maxlength="60" value="${escapeHtml(p&&p.client.name!==NO_NAME?p.client.name:"")}"></label>
    <label class="tool-field" style="margin-top:10px">WhatsApp<input id="rqPhone" inputmode="tel" placeholder="3511234567" value="${escapeHtml(p?p.client.phone:"")}"></label>
    <p class="tool-sub" style="margin-top:12px">Cada link se usa una sola vez. Por seguridad, vos no podés opinar sobre tu propio negocio.</p>
    <div class="tool-actions"><button class="btn btn-ghost" data-tool-close>Cancelar</button><button class="btn btn-primary" id="rqSend">Enviar por WhatsApp</button></div>`);
  $("#rqSend").onclick=()=>sendReviewRequest($("#rqName").value,$("#rqPhone").value,id||null);
}
function initReviewAsk(){
  const h=$("#panel-clients .panel-head"); if(!h||$("#askReviewBtn")) return;
  h.insertAdjacentHTML("beforeend",'<button class="btn btn-ghost" id="askReviewBtn" type="button">⭐ Pedir opinión</button>');
  $("#askReviewBtn").addEventListener("click",()=>openAskReview(null));
}
async function openReviewLink(token){
  let info=null;
  try{
    if(Cloud.on){info=await Cloud.rpc("get_review_request",{p_token:token}); if(info&&info.business) state.business={...state.business,...info.business};}
    else{const r=(state.reviewRequests||{})[token]; info=r?{status:r.used?"used":"valid",client:r.name.split(" ")[0]}:null;}
  }catch(e){}
  const card=$("#publicContent");
  if(!info||info.status!=="valid"){
    const used=info&&info.status==="used";
    card.innerHTML=`<div class="public-card"><div class="public-greeting">${used?"Ya recibimos tu opinión 🙌":"Este link no está disponible"}</div><p style="color:#64748b">${used?"¡Gracias por tomarte el tiempo!":"Pedile a quien te lo envió que te mande uno nuevo."}</p></div>`;
  }else{
    const rp={review:null,_token:token};
    card.innerHTML=`<div class="public-card"><div class="public-brand">${avatarHtml()}${escapeHtml((state.business.name||"").toUpperCase())}${ratingChip()}</div><div class="public-greeting">${escapeHtml(hello(info.client))} 👋</div><p style="color:#475569">Contanos cómo fue tu experiencia con ${escapeHtml(state.business.name||"el negocio")}.</p>${reviewFormMarkup(rp)}</div>`;
    attachReview(rp);
  }
  openModal("publicModal"); document.documentElement.classList.add("proposal-ready");
  if(state.business.name) document.title=`Tu opinión · ${state.business.name}`;
}
/* Perdida con motivo y recontacto */
const LOST_REASONS=["Precio","Eligió a otro","No responde","Postergó","Otro"];
function openTool(html){$("#toolContent").innerHTML=html;openModal("toolModal");}
function openLost(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  openTool(`<h3>¿Qué pasó con ${escapeHtml(p.client.name)}?</h3><p class="tool-sub">Guardar el motivo te muestra qué mejorar.</p>
  <div class="reason-grid">${LOST_REASONS.map((r,i)=>`<label class="reason"><input type="radio" name="lostReason" value="${r}" ${i===0?"checked":""}><span>${r}</span></label>`).join("")}</div>
  <label class="tool-field">Recordame retomarla<select id="lostRecontact"><option value="0">No, cerrar</option><option value="7" selected>En 7 días</option><option value="15">En 15 días</option><option value="30">En 30 días</option></select></label>
  <div class="tool-actions"><button class="btn btn-ghost" data-tool-close>Cancelar</button><button class="btn btn-primary" id="lostOk">Marcar perdida</button></div>`);
  $("#lostOk").onclick=()=>confirmLost(id);
}
async function confirmLost(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  const reason=$("input[name=lostReason]:checked").value, days=Number($("#lostRecontact").value);
  if(Cloud.on){try{await Cloud.rpc("mark_lost",{p_id:id,p_reason:reason,p_recontact_days:days});}catch(e){try{await Cloud.rpc("mark_lost",{p_id:id});}catch(e2){return toast(e2.message||"No se pudo marcar como perdida.");}}}
  p.status="lost"; p.lostReason=reason; p.recontactAt=days?Date.now()+days*864e5:null; p.lastEvent=`Perdida: ${reason}.`;
  state.activity.unshift({icon:"📉",text:`${p.client.name}: perdida (${reason}).`,time:"Ahora"});
  saveState(); closeModal("toolModal"); renderDashboard();
  toast(days?`Te lo recuerdo en ${days} días.`:"Propuesta marcada como perdida.");
}
/* Historial de cada propuesta, armado con los datos que ya guarda */
function openHistory(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  const t=v=>v?new Date(v).getTime():0, lv=t(p.lastViewedAt)||t(p.createdAt), ev=[{t:t(p.createdAt),i:"📨",x:"Propuesta creada y enviada"}];
  if(p.views) ev.push({t:lv,i:"👀",x:`Vista ${p.views} ${p.views>1?"veces":"vez"}`});
  if(p.chosenOption) ev.push({t:lv+1,i:"⭐",x:`Eligió ${chosenOf(p).name}`});
  if(p.doubts) ev.push({t:lv+2,i:"🙋",x:`Consultó una duda${p.lastDoubt?`: ${p.lastDoubt}`:""}`});
  if(p.shared) ev.push({t:lv+3,i:"👥",x:`Compartió la propuesta con otra persona (${p.shared})`});
  if(p.remindAt) ev.push({t:lv+4,i:"⏰",x:"Pidió que lo contactes mañana"});
  if(p.followUps) ev.push({t:p.lastFollowUpAt||0,i:"🔔",x:`${p.followUps} seguimiento${p.followUps>1?"s":""} enviado${p.followUps>1?"s":""}`});
  if(p.acceptedAt) ev.push({t:t(p.acceptedAt),i:"✅",x:`Aceptó la propuesta${p.acceptedName?` como ${p.acceptedName}`:""}${bonusWon(p)?" · a tiempo para el bonus 🎁":""}`});
  if(p.proofSentAt) ev.push({t:t(p.proofSentAt),i:"💸",x:"Avisó que transfirió"});
  if(p.depositPaidAt) ev.push({t:t(p.depositPaidAt),i:"💰",x:"Seña cobrada"});
  if(p.status==="lost") ev.push({t:Date.now(),i:"📉",x:`Perdida: ${p.lostReason||"sin motivo"}${p.recontactAt?` · retomar ${relativeTime(new Date(p.recontactAt).toISOString())}`:""}`});
  ev.sort((a,b)=>a.t-b.t);
  openTool(`<h3>Historial · ${escapeHtml(p.client.name)}</h3><p class="tool-sub">${escapeHtml(p.title)} · ${heat(p)}</p><ol class="timeline">${ev.map(e=>`<li><b>${e.i}</b><div>${escapeHtml(e.x)}${e.t>864e5?`<small>${relativeTime(new Date(e.t).toISOString())}</small>`:""}</div></li>`).join("")}</ol><h3 class="eng-title">Atención del cliente</h3><div id="engBox"><p class="tool-sub">Cargando análisis…</p></div><div class="tool-actions"><button class="btn btn-ghost" data-tool-close>Cerrar</button></div>`);
  fillEngagement(p);
}
/* Métricas de seguimiento dentro de Performance */
function renderPerfExtrasBase(){
  const ps=state.proposals||[]; let box=$("#perfExtras");
  if(!box){box=document.createElement("div");box.id="perfExtras";box.className="perf-extras";$("#panel-performance").appendChild(box);}
  const by={}; ps.filter(p=>p.status==="lost").forEach(p=>{const r=p.lostReason||"Sin motivo";by[r]=(by[r]||0)+1;});
  const lostN=Object.values(by).reduce((x,y)=>x+y,0);
  const acc=ps.filter(p=>p.acceptedAt), hrs=acc.length?Math.round(acc.reduce((x,p)=>x+(new Date(p.acceptedAt)-new Date(p.createdAt)),0)/acc.length/36e5):null;
  const win={}; acc.forEach(p=>{const n=chosenOf(p).name;win[n]=(win[n]||0)+1;}); const top=Object.entries(win).sort((x,y)=>y[1]-x[1])[0];
  const risk=ps.filter(p=>["sent","viewed"].includes(p.status)&&daysLeft(p)<=2).reduce((x,p)=>x+finalPrice(chosenOf(p)),0);
  const noDep=ps.filter(p=>p.status==="accepted"&&!p.depositPaidAt&&p.depositPct>0).reduce((x,p)=>x+depositOf(p,chosenOf(p)),0);
  const att=ps.map(p=>engOf(p).total).filter(x=>x>0), avgAtt=att.length?att.reduce((x,y)=>x+y,0)/att.length:0;
  const rec=recoveredOf(ps), sm=salesMetrics(ps);
  const doubts=ps.reduce((x,p)=>x+(p.doubts||0),0);
  box.innerHTML=`<h3>Seguimiento y pérdidas</h3><div class="perf-grid">
    <div class="perf-card perf-hl"><span>Cierres tras seguimiento</span><strong>${money(rec.amount)}</strong><small>${rec.n} aceptada${rec.n!==1?"s":""} después de que les escribiste</small></div>
    <div class="perf-card perf-hl"><span>Pronóstico estimado</span><strong>${money(sm.forecast)}</strong><small>de ${money(sm.open)} en juego · ${sm.real?`tu cierre histórico ${Math.round(sm.rate*100)}%`:"usa 25% hasta tener 5 cierres"}</small></div>
    <div class="perf-card"><span>Interés alto (60+)</span><strong>${money(sm.hot)}</strong><small>las que más conviene priorizar</small></div>
    <div class="perf-card"><span>Hasta aceptar</span><strong>${hrs===null?"—":hrs<48?hrs+" h":Math.round(hrs/24)+" días"}</strong><small>promedio</small></div>
    <div class="perf-card"><span>Opción más aceptada</span><strong>${top?escapeHtml(top[0]):"—"}</strong><small>${top?top[1]+" aceptada"+(top[1]>1?"s":""):"sin datos"}</small></div>
    <div class="perf-card"><span>En riesgo (vence ≤2 días)</span><strong>${money(risk)}</strong><small>sin respuesta</small></div>
    <div class="perf-card"><span>Seña por cobrar</span><strong>${money(noDep)}</strong><small>aceptadas sin pago</small></div>
    <div class="perf-card"><span>Atención promedio</span><strong>${avgAtt?fmtDur(avgAtt):"—"}</strong><small>por propuesta vista</small></div>
    <div class="perf-card"><span>Dudas del cliente</span><strong>${doubts}</strong><small>consultas desde la propuesta</small></div></div>
    <div class="loss-list"><b>Motivos de pérdida</b>${lostN?Object.entries(by).sort((x,y)=>y[1]-x[1]).map(([r,n])=>`<div class="loss-row"><span>${escapeHtml(r)}</span><i style="width:${Math.round(n/lostN*100)}%"></i><em>${n}</em></div>`).join(""):'<p style="color:#64748b;margin:6px 0 0">Todavía no marcaste propuestas como perdidas.</p>'}</div>`;
}
/* Avisos al vendedor: revisa novedades cada 45 s (modo Supabase) */
let _unread=0; const BASE_TITLE=document.title;
function startNewsPoll(){
  window.addEventListener("focus",()=>{_unread=0;document.title=BASE_TITLE;});
  if(!Cloud.on||PROPOSAL_MODE) return;
  setInterval(async()=>{
    if(document.hidden||!currentUser) return;
    const before=new Map(state.proposals.map(p=>[p.id,{v:p.views||0,c:p.chosenOption,s:p.status}]));
    try{await Cloud.hydrate();}catch(e){return;}
    let msg=null;
    state.proposals.forEach(p=>{const b=before.get(p.id); if(!b) return;
      if(p.status==="accepted"&&b.s!=="accepted") msg=`✅ ${p.client.name} aceptó la propuesta`;
      else if(p.chosenOption&&p.chosenOption!==b.c) msg=msg||`⭐ ${p.client.name} eligió una opción`;
      else if((p.views||0)>b.v) msg=msg||`👀 ${p.client.name} abrió la propuesta`;});
    if(msg){toast(msg);_unread++;document.title=`(${_unread}) ${BASE_TITLE}`;try{if(window.Notification&&Notification.permission==="granted")new Notification(msg);}catch(e){}}
    loadEngTotals(); loadReviews(); renderDashboard();
  },45000);
}
function statusLabel(s){return ({sent:"Enviada",viewed:"Vista",accepted:"Aceptada",lost:"Perdida",expired:"Vencida"}[s]||"Enviada")}

function renderPerformance(){
  renderPerfExtras();
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
  // En el link del cliente no se carga supabase-js al inicio (compite con la propuesta); se precarga después, en reposo.
  if(ls) applyUser(ls); else if(Auth.remote&&!PROPOSAL_MODE) Auth.restore().then(u=>u&&applyUser(u)).catch(()=>{});
  else if(Auth.remote&&PROPOSAL_MODE) setTimeout(()=>{(window.requestIdleCallback||setTimeout)(()=>Auth.client().catch(()=>{}));},2500);
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
      if(Cloud.on){const id=d.dataset.delCat;Auth.client().then(sb=>sb.from("catalog_items").delete().eq("id",id)).catch(()=>toast("No se pudo borrar del catálogo."));}
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
  $$("[data-close]").forEach(el=>el.addEventListener("click",()=>PROPOSAL_MODE&&el.dataset.close==="public"?0:closeModal({builder:"builderModal",auth:"authModal"}[el.dataset.close]||"publicModal")));
  $$(".side-link").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));
  $$(".text-btn[data-panel]").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));

  $("#settingsForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const g=k=>String(fd.get(k)||"").trim(), cbu=g("cbu").replace(/\s/g,""), alias=g("alias");
    if(cbu&&!/^\d{22}$/.test(cbu)) return toast("El CBU/CVU debe tener 22 números.");
    if(alias&&!/^[A-Za-z0-9.\-]{6,20}$/.test(alias)) return toast("El alias debe tener 6 a 20 letras, números, puntos o guiones.");
    state.business={...state.business,name:g("businessName"),whatsapp:g("whatsapp"),paymentLink:g("paymentLink"),brandColor:g("brandColor"),holder:g("holder"),bank:g("bank"),cbu,alias,cuit:g("cuit"),transferNote:g("transferNote"),depositPolicy:g("depositPolicy"),faq:g("faq"),afterSteps:g("afterSteps")};
    if(Cloud.on){try{const sb=await Auth.client();const {error}=await sb.from("businesses").update({name:state.business.name,whatsapp:state.business.whatsapp,payment_link:state.business.paymentLink,deposit_policy:state.business.depositPolicy||"",photo:state.business.photo||"",faq:state.business.faq||"",brand_color:state.business.brandColor,holder:state.business.holder,bank:state.business.bank,cbu,alias,cuit:state.business.cuit,transfer_note:state.business.transferNote}).eq("owner_id",currentUser.id);if(error)throw error;{const r2=await sb.from("businesses").update({after_steps:state.business.afterSteps||""}).eq("owner_id",currentUser.id);if(r2.error)toast("Guardé el resto, pero «Qué pasa después» necesita ejecutar supabase_v3.sql en Supabase.");}}catch(ex){return toast(ex.message||"No se pudo guardar la configuración.");}}
    saveState(); toast("Configuración guardada.");
  });

  $$("#builderModal input, #builderModal textarea").forEach(el=>el.addEventListener("input",renderBuilderPreview));

  // Performance-first: avoid intercepting the public URL until DOM is ready.
  const params=new URLSearchParams(location.search);
  const proposalId=params.get("p");
  if(PROPOSAL_MODE){ params.get("r")?openReviewLink(params.get("r")):openPublicLink(proposalId); }
  else nav("home");
  document.addEventListener("click",e=>{if(e.target.closest("[data-tool-close]")||e.target.classList.contains("tool-backdrop")) closeModal("toolModal");});
  startNewsPoll();
  initRoi();
  initQuick();
  initReviewAsk();
  initPerks();

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}),{once:true});
  }
}


/* ===== v23: bonus, cupos, mensaje de voz, "qué pasa después" y aceptación con nombre ===== */
const VOICE_MAX=60;
const OK_AUDIO=/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/;
function safeAudio(u){return typeof u==="string"&&u.length<=800000&&OK_AUDIO.test(u)?u:"";}
let builderVoice="", _voiceRec=null;

function fmtLeft(ms){
  const s=Math.max(0,Math.floor(ms/1000)), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60;
  return h>0?`${h} h ${String(m).padStart(2,"0")} min`:`${m} min ${String(x).padStart(2,"0")} s`;
}
function fmtDateTime(ms){return new Date(ms).toLocaleString("es-AR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+" h";}
function bonusDeadline(p){
  if(!p||!String(p.bonusText||"").trim()) return 0;
  if(p.bonusDeadlineMs) return p.bonusDeadlineMs;
  const h=Number(p.bonusHours)||0, c=new Date(p.createdAt||0).getTime();
  return h>0&&c?c+h*36e5:0;
}
function bonusActive(p){const d=bonusDeadline(p);return !!(d&&Date.now()<d&&!["expired","lost","accepted"].includes(p.status));}
function bonusWon(p){const d=bonusDeadline(p), a=p&&p.acceptedAt?new Date(p.acceptedAt).getTime():0;return !!(d&&a&&a<=d);}
function bonusWonMarkup(p){
  return bonusWon(p)?`<div class="bonus-box won"><b>🎁 Bonus incluido</b><p>${escapeHtml(p.bonusText)}</p><small>Aceptaste a tiempo: queda incluido en tu reserva.</small></div>`:"";
}
function applyV3(p,x){
  if(!x) return p;
  if(x.createdAt) p.createdAt=x.createdAt;
  if(x.acceptedAt) p.acceptedAt=x.acceptedAt;
  p.acceptedName=x.acceptedName||"";
  p.bonusText=x.bonusText||"";
  p.bonusDeadlineMs=x.bonusDeadline?new Date(x.bonusDeadline).getTime():0;
  p.slotsLeft=x.slotsLeft??null; p.slotsLabel=x.slotsLabel||"";
  p.voice=safeAudio(x.voice);
  p.holdHours=x.holdHours||0; p.proof=x.proof&&typeof x.proof==="object"?x.proof:{};
  return p;
}
function perksFromForm(){
  const t=($("#bonusText")?.value||"").trim().slice(0,140);
  const h=Math.min(168,Math.max(1,parseInt($("#bonusHours")?.value,10)||48));
  const sv=$("#slotsLeft")?.value, sl=(sv===""||sv==null)?null:Math.min(999,Math.max(0,parseInt(sv,10)||0));
  return {bonusText:t,bonusHours:t?h:0,slotsLeft:sl,slotsLabel:sl==null?"":($("#slotsLabel")?.value||"").trim().slice(0,60),voice:builderVoice||"",holdHours:($("#holdHours")?.value||"")===""?0:Math.min(720,Math.max(0,parseInt($("#holdHours").value,10)||0))};
}
function perksMarkup(p){
  const out=[], d=bonusDeadline(p), n=p.slotsLeft;
  if(bonusActive(p)) out.push(`<div class="bonus-box"><b>🎁 Bonus por reservar a tiempo</b><p>${escapeHtml(p.bonusText)}</p><small>Si aceptás antes del ${escapeHtml(fmtDateTime(d))} · te quedan <b data-cd="${d}">${fmtLeft(d-Date.now())}</b></small></div>`);
  if(n!=null&&n>0) out.push(`<span class="slots-chip">📅 ${n===1?"Queda":"Quedan"} <b>${n}</b> ${escapeHtml(p.slotsLabel||"cupos")}</span>`);
  return out.length?`<div class="perks" data-sec="bonus">${out.join("")}</div>`:"";
}
function perksText(p){
  let t=""; const n=p.slotsLeft;
  if(bonusActive(p)) t+=` 🎁 Bonus por reservar antes del ${fmtDateTime(bonusDeadline(p))}: ${p.bonusText}.`;
  if(n!=null&&n>0) t+=` 📅 ${n===1?"Queda":"Quedan"} ${n} ${p.slotsLabel||"cupos"}.`;
  return t;
}
function voiceMarkup(p){
  const v=safeAudio(p.voice); if(!v) return "";
  return `<div class="voice-box" data-sec="mensaje">${avatarHtml()}<div><b>Un mensaje de ${escapeHtml(state.business.name)} para vos</b><audio controls preload="metadata" src="${v}"></audio><small>Audio corto, hasta 1 minuto</small></div></div>`;
}
const DEFAULT_AFTER=[
  {t:"Reservás",d:"Confirmás tu lugar con la seña y te mostramos cómo pagarla.",w:""},
  {t:"Coordinamos",d:"Te escribimos por WhatsApp para acordar los detalles.",w:""},
  {t:"Lo recibís",d:"Concretamos la entrega o el turno que acordamos.",w:""}];
function afterSteps(){
  const raw=String((state.business&&state.business.afterSteps)||"").split("\n").map(l=>l.split("|").map(x=>x.trim())).filter(a=>a[0]).slice(0,5)
    .map(a=>({t:a[0].slice(0,80),d:(a[1]||"").slice(0,160),w:(a[2]||"").slice(0,40)}));
  return raw.length?raw:DEFAULT_AFTER;
}
function afterMarkup(p,compact){
  const e=escapeHtml;
  return `<div class="after-box${compact?" compact":""}" data-sec="despues"><h4>${compact?"Qué sigue ahora":"Qué pasa después de reservar"}</h4><ol>${afterSteps().map((s,i)=>`<li><b>${i+1}</b><div><strong>${e(s.t)}</strong>${s.d?`<p>${e(s.d)}</p>`:""}${s.w?`<span class="after-when">⏱ ${e(s.w)}</span>`:""}</div></li>`).join("")}</ol></div>`;
}
function acceptFormMarkup(p){
  return `<form class="accept-form" id="acceptForm" hidden novalidate data-sec="aceptar">
    <h4>Último paso: confirmá tu aceptación</h4>
    <p class="accept-sum" id="acceptSum"></p>
    <label class="accept-name">Nombre y apellido<input id="acceptName" autocomplete="name" maxlength="120" value="${escapeHtml(p.client.name===NO_NAME?"":p.client.name)}"></label>
    <details class="terms-box"><summary>Leer las condiciones</summary><p id="acceptTermsText"></p></details>
    <label class="accept-chk"><input type="checkbox" id="acceptTerms"><span>Leí y acepto las condiciones de esta propuesta.</span></label>
    <p class="voice-status" id="acceptErr" role="alert" hidden></p>
    <button type="submit" class="public-seña" id="acceptConfirm">Confirmar mi aceptación</button>
    <p class="accept-note">${p.depositPct>0?"Aceptar no te cobra nada. Después reservás con la seña.":"Aceptar no te cobra nada todavía."}${p.holdHours>0?` Tu lugar queda reservado ${p.holdHours} h desde que aceptás.`:""}</p>
  </form>`;
}
// Confirma primero en el servidor y recién después muestra la aceptación (sin "aceptación optimista").
async function acceptNow(p,o,name){
  const when=new Date().toISOString();
  if(Cloud.on){
    try{
      try{await Cloud.rpc("accept_with_name",{p_id:p.id,p_name:name,p_terms:true,p_option:o.id});}
      catch(e){
        if(e&&(e.code==="PGRST202"||/could not find the function/i.test(e.message||""))) await Cloud.rpc("track_proposal",{p_id:p.id,p_type:"accept",p_option:o.id});
        else throw e;
      }
    }catch(e){toast((e&&e.message)||"No se pudo registrar la aceptación. Probá de nuevo.");return false;}
    try{const remote=await Cloud.publicProposal(p.id); if(remote){state.business={...state.business,...remote.business}; Object.assign(p,remote,{createdAt:remote.createdAt||p.createdAt});}}catch(e){}
  }
  p.status="accepted"; p.chosenOption=p.chosenOption||o.id; p.acceptedAt=p.acceptedAt||when;
  p.acceptedName=p.acceptedName||name; p.termsAcceptedAt=p.termsAcceptedAt||when;
  p.lastEvent=`Cliente aceptó la propuesta (${name}).`;
  state.activity.unshift({icon:"✅",text:`${name} aceptó la propuesta.`,time:"Ahora"});
  saveState(); renderAcceptedState(p); return true;
}
async function saveProposalExtras(id,p){
  if(!(p.bonusText||p.slotsLeft!=null||p.voice||p.holdHours)) return;
  try{await Cloud.rpc("set_proposal_extras",{p_id:id,p:{bonusText:p.bonusText||"",bonusHours:p.bonusHours||0,slotsLeft:p.slotsLeft==null?"":String(p.slotsLeft),slotsLabel:p.slotsLabel||"",voice:safeAudio(p.voice),holdHours:p.holdHours||0}});}
  catch(e){toast("La propuesta se creó, pero bonus, cupos o audio necesitan ejecutar supabase_v3.sql en Supabase.");}
}
// ---- Audio del vendedor (grabado o subido) ----
function blobToAudioUrl(blob){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>{
      const m=String(r.result).match(/^data:([^;,]*)[^,]*;base64,([\s\S]*)$/);
      const type=((m&&m[1])||blob.type||"").toLowerCase().split(";")[0];
      if(!m||!type.startsWith("audio/")) return rej(new Error("Ese archivo no es un audio válido."));
      const url=`data:${type};base64,${m[2]}`;
      safeAudio(url)?res(url):rej(new Error("El audio pesa demasiado. Probá con uno más corto."));
    };
    r.onerror=()=>rej(new Error("No se pudo leer el audio."));
    r.readAsDataURL(blob);
  });
}
async function fileToVoice(file){
  if(!file.type.startsWith("audio/")) throw new Error("Elegí un archivo de audio.");
  if(file.size>600*1024) throw new Error("El audio pesa demasiado. Probá con uno de hasta 60 segundos y más liviano (menos de 600 KB).");
  const dur=await new Promise(res=>{
    const a=new Audio(), u=URL.createObjectURL(file), done=v=>{URL.revokeObjectURL(u);res(v);};
    a.preload="metadata"; a.onloadedmetadata=()=>done(a.duration); a.onerror=()=>done(NaN); setTimeout(()=>done(NaN),4000); a.src=u;
  });
  if(isFinite(dur)&&dur>VOICE_MAX+.5) throw new Error("El audio dura más de 60 segundos.");
  return blobToAudioUrl(file);
}
function renderVoiceField(msg){
  const el=$("#voiceField"); if(!el) return;
  const rec=!!_voiceRec, canRec=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
  el.innerHTML=`${builderVoice&&!rec?`<audio controls src="${builderVoice}"></audio>`:""}
    <div class="voice-actions">
      ${canRec?(rec?`<button type="button" class="btn btn-secondary btn-sm" data-voice="stop">⏹ Detener (<span id="voiceSecs">0</span> s)</button>`:`<button type="button" class="btn btn-secondary btn-sm" data-voice="rec">🎙 ${builderVoice?"Grabar de nuevo":"Grabar mensaje"}</button>`):""}
      ${rec?"":`<label class="btn btn-secondary btn-sm voice-up">📎 Subir audio<input type="file" accept="audio/*" data-voice="file" hidden></label>`}
      ${builderVoice&&!rec?`<button type="button" class="text-btn" data-voice="del">Quitar</button>`:""}
    </div>
    <p class="voice-status"${msg?"":" hidden"}>${escapeHtml(msg||"")}</p>`;
}
async function startVoice(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
    const rec=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:24000});
    const st={rec,stream,chunks:[],t0:Date.now(),timer:null,cancelled:false};
    rec.ondataavailable=e=>{if(e.data&&e.data.size) st.chunks.push(e.data);};
    rec.onstop=async()=>{
      clearInterval(st.timer); stream.getTracks().forEach(t=>t.stop()); if(_voiceRec===st) _voiceRec=null;
      if(st.cancelled) return;
      try{const url=await blobToAudioUrl(new Blob(st.chunks,{type:rec.mimeType||mime||"audio/webm"})); builderVoice=url; renderVoiceField(); renderBuilderPreview();}
      catch(e){renderVoiceField(e.message||"No se pudo guardar el audio.");}
    };
    _voiceRec=st; rec.start();
    st.timer=setInterval(()=>{const sec=Math.floor((Date.now()-st.t0)/1000), el=$("#voiceSecs"); if(el) el.textContent=sec; if(sec>=VOICE_MAX) stopVoice();},250);
    renderVoiceField();
  }catch(e){renderVoiceField("No pude acceder al micrófono. Podés subir un audio ya grabado.");}
}
function stopVoice(){if(_voiceRec&&_voiceRec.rec.state!=="inactive") _voiceRec.rec.stop();}
function cancelVoice(){
  const st=_voiceRec; if(!st) return;
  st.cancelled=true; clearInterval(st.timer);
  try{if(st.rec.state!=="inactive") st.rec.stop();}catch(e){}
  st.stream.getTracks().forEach(t=>t.stop()); _voiceRec=null;
}
function tickCountdowns(){
  document.querySelectorAll("[data-cd]").forEach(el=>{
    const left=Number(el.dataset.cd)-Date.now();
    if(left<=0){const hb=el.closest(".hold-box"); if(hb){hb.classList.add("late"); hb.textContent="⏱ El plazo de reserva terminó. Escribile al vendedor para confirmar si el lugar sigue disponible."; return;} const box=el.closest(".bonus-box"); if(box) box.remove(); else el.textContent="0 min 00 s"; return;}
    el.textContent=fmtLeft(left);
  });
}
function initPerks(){
  setInterval(tickCountdowns,1000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden") payExitFire();});
  window.addEventListener("pagehide",payExitFire);
  const vf=$("#voiceField"); if(!vf) return;
  vf.addEventListener("click",e=>{
    const b=e.target.closest("button[data-voice]"); if(!b) return;
    if(b.dataset.voice==="rec") startVoice();
    else if(b.dataset.voice==="stop") stopVoice();
    else if(b.dataset.voice==="del"){builderVoice="";renderVoiceField();renderBuilderPreview();}
  });
  vf.addEventListener("change",async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f||e.target.dataset.voice!=="file") return;
    try{builderVoice=await fileToVoice(f); renderVoiceField(); renderBuilderPreview();}
    catch(err){renderVoiceField(err.message||"No se pudo leer el audio.");}
  });
  renderVoiceField();
}

/* ===== v24: persuasión en la vista del cliente ===== */
function shortDate(iso){return new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"});}
function dayWord(ms){
  const d=new Date(ms), n=new Date(), a=new Date(d.getFullYear(),d.getMonth(),d.getDate()), b=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  const diff=Math.round((a-b)/864e5), t=d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false});
  return (diff===0?"hoy":diff===1?"mañana":d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}))+" "+t;
}
// Texto del botón: dice qué paga y qué obtiene.
function ctaLabel(p,o){const dep=depositOf(p,o); return dep>0?`Reservar mi lugar con ${money(dep)}`:`Aceptar · ${money(finalPrice(o))}`;}
function sumTexts(p,o){
  const fin=finalPrice(o), dep=depositOf(p,o), multi=p.options.length>1;
  const head=`<span class="sum-lab">Tu propuesta${multi?` · ${escapeHtml(o.name)}`:""}:</span> <b>${money(fin)}</b>${dep>0?` <span class="sum-lab sum-res">Reservás con</span> <b>${money(dep)}</b>`:""}`;
  const det=[dep>0?`Saldo ${money(fin-dep)}`:"",`Vigente hasta el ${shortDate(p.expiresAt)}`].filter(Boolean).join(" · ");
  return {head,det};
}
// Resumen fijo: quién, cuánto y cuál es el único próximo paso. Se actualiza al elegir otra opción.
function sumBarMarkup(p,mode){
  const o=chosenOf(p), t=sumTexts(p,o), full=mode==="full";
  return `<div class="sum-bar${full?"":" static"}" id="sumBar" data-sec="resumen"><div class="sum-info"><div class="sum-head" id="sumTxt">${t.head}</div><small id="sumDet">${t.det}</small></div>${full?`<button type="button" class="sum-btn" id="sumBtn">${depositOf(p,o)>0?"Reservar":"Aceptar"}</button>`:""}</div>`;
}
// Reduce el riesgo percibido junto al botón (no al final de la página).
function riskLine(p,o){
  const pol=String(state.business.depositPolicy||"").trim().replace(/\s+/g," "), parts=[];
  parts.push(p.depositPct>0?`Aceptar no te cobra nada. Después reservás con la seña de ${money(depositOf(p,o))}.`:"Aceptar no te cobra nada todavía.");
  if(pol) parts.push("🔒 "+escapeHtml(pol.length>120?pol.slice(0,117)+"…":pol));
  if(o.hasWarranty&&o.warranty) parts.push("🛡️ Garantía: "+escapeHtml(o.warranty));
  return parts.map((x,i)=>i?x:escapeHtml(x)).join("<br>");
}
function compareMarkup(p,mode){
  if(p.options.length<2) return "";
  const O=p.options, e=escapeHtml, dep=p.depositPct>0;
  const anyInst=O.some(o=>o.hasInstallments&&o.installments>1), anyW=O.some(o=>o.hasWarranty&&o.warranty), anyF=O.some(o=>(o.features||"").trim());
  const feats=o=>{const l=(o.features||"").split("\n").map(x=>x.trim()).filter(Boolean); return l.length?`<ul class="cmp-feat">${l.slice(0,3).map(x=>`<li>${e(x)}</li>`).join("")}</ul>${l.length>3?`<small>y ${l.length-3} más</small>`:""}`:"—";};
  const rows=[
    ["Precio final",o=>`${discountAmount(o)>0?`<s>${money(o.price)}</s><br>`:""}<b>${money(finalPrice(o))}</b>`],
    dep?["Seña para reservar",o=>money(depositOf(p,o))]:null,
    dep?["Saldo",o=>money(finalPrice(o)-depositOf(p,o))]:null,
    anyInst?["Cuotas",o=>o.hasInstallments&&o.installments>1?`${o.installments} de ${money(finalPrice(o)/o.installments)}`:"—"]:null,
    anyW?["Garantía",o=>o.hasWarranty&&o.warranty?e(o.warranty):"—"]:null,
    anyF?["Incluye",feats]:null
  ].filter(Boolean);
  const cell=(o,h)=>`<td class="${o.recommended?"rec":""}" data-col="${e(o.id)}">${h}</td>`;
  const head=O.map(o=>`<th class="${o.recommended?"rec":""}" data-col="${e(o.id)}">${o.recommended?'<span class="tag">⭐ Recomendada</span>':""}${e(o.name)}</th>`).join("");
  const body=rows.map(([l,f])=>`<tr><th scope="row">${l}</th>${O.map(o=>cell(o,f(o))).join("")}</tr>`).join("");
  const pick=mode==="full"&&p.status!=="expired"?`<tr class="cmp-pick"><th scope="row"></th>${O.map(o=>cell(o,`<button type="button" class="select" data-select-option="${e(o.id)}" aria-label="Elegir ${e(o.name)}">Elegir</button>`)).join("")}</tr>`:"";
  return `<div class="cmp-box" data-sec="comparar"><h4>Compará de un vistazo</h4><div class="cmp-wrap"><table class="cmp"><thead><tr><th></th>${head}</tr></thead><tbody>${body}${pick}</tbody></table></div></div>`;
}
// Prueba social: solo si el sistema la calcula de verdad y hay al menos 3 casos.
function proofCount(p,o){
  if(p.proof&&typeof p.proof==="object") return Number(p.proof[o.id])||0;
  const lim=Date.now()-30*864e5, nm=String(o.name||"").trim().toLowerCase();
  return state.proposals.filter(x=>x.id!==p.id&&x.status==="accepted"&&x.acceptedAt&&new Date(x.acceptedAt).getTime()>=lim&&(x.depositPaidAt||!(x.depositPct>0))&&String((chosenOf(x)||{}).name||"").trim().toLowerCase()===nm).length;
}
function proofLine(p,o){
  const n=proofCount(p,o); if(n<3) return "";
  return `<p class="proof">👥 ${n} clientes ya ${p.depositPct>0?"reservaron":"eligieron"} esta opción en los últimos 30 días</p>`;
}
// Urgencia real: el vendedor define cuánto tiempo retiene el lugar una vez aceptada.
function holdUntil(p){return p.holdHours>0&&p.acceptedAt?new Date(p.acceptedAt).getTime()+p.holdHours*36e5:0;}
function holdMarkup(p){
  const h=holdUntil(p); if(!h) return "";
  if(Date.now()>=h) return `<div class="hold-box late">⏱ El plazo de reserva (${escapeHtml(dayWord(h))}) terminó. Escribile a ${escapeHtml(state.business.name)} para confirmar si el lugar sigue disponible.</div>`;
  return `<div class="hold-box">⏱ <span>Tu lugar queda reservado hasta <b>${escapeHtml(dayWord(h))}</b> · te quedan <b data-cd="${h}">${fmtLeft(h-Date.now())}</b></span></div>`;
}
// Cierre con intención: si abrió la pantalla de pago y se fue sin pagar ni avisar, queda marcado para el vendedor.
let _payWatch=null;
function watchPayExit(p){_payWatch=(p.depositPaidAt||p.proofSentAt||(Cloud.on&&currentUser))?null:{p,t0:Date.now(),sent:false};}
function payExitFire(){
  const w=_payWatch; if(!w||w.sent) return; const p=w.p;
  if(p.depositPaidAt||p.proofSentAt||p._payClicked||Date.now()-w.t0<3000) return;
  w.sent=true; p.payExitAt=Date.now(); p.lastEvent="Abrió la pantalla de pago y se fue."; saveState();
  if(Cloud.on) Cloud.rpc("report_pay_exit",{p_id:p.id}).catch(()=>{});
}

/* ===== Generador de QR mínimo (modo byte, versiones 1-10, corrección L/M). Sin dependencias. ===== */
const CCQR=(()=>{
  const EXP=new Uint8Array(512), LOG=new Uint8Array(256);
  for(let i=0,x=1;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}
  for(let i=255;i<512;i++) EXP[i]=EXP[i-255];
  const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
  const rsEc=(data,n)=>{
    let g=[1]; for(let i=0;i<n;i++){const ng=new Array(g.length+1).fill(0); for(let j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=mul(g[j],EXP[i]);} g=ng;}
    const r=new Array(n).fill(0);
    for(const b of data){const f=b^r.shift(); r.push(0); for(let i=0;i<n;i++) r[i]^=mul(g[i+1],f);}
    return r;
  };
  // [bytes de corrección por bloque, bloques grupo 1, datos grupo 1, bloques grupo 2, datos grupo 2]
  const T={
    L:[null,[7,1,19,0,0],[10,1,34,0,0],[15,1,55,0,0],[20,1,80,0,0],[26,1,108,0,0],[18,2,68,0,0],[20,2,78,0,0],[24,2,97,0,0],[30,2,116,0,0],[18,2,68,2,69]],
    M:[null,[10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],[16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44]]
  };
  const FMT={L:1,M:0}, ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  const dataCap=(v,e)=>{const t=T[e][v];return t[1]*t[2]+t[3]*t[4];};
  function build(bytes,v,e){
    const t=T[e][v], cap=dataCap(v,e), bits=[];
    const put=(val,n)=>{for(let i=n-1;i>=0;i--) bits.push((val>>>i)&1);};
    put(4,4); put(bytes.length,v<10?8:16); bytes.forEach(b=>put(b,8));
    put(0,Math.min(4,cap*8-bits.length)); while(bits.length%8) bits.push(0);
    const cw=[]; for(let i=0;i<bits.length;i+=8) cw.push(parseInt(bits.slice(i,i+8).join(""),2));
    for(let p=0xEC;cw.length<cap;p^=0xEC^0x11) cw.push(p);
    const blocks=[]; let o=0;
    for(let i=0;i<t[1]+t[3];i++){const n=i<t[1]?t[2]:t[4]; const d=cw.slice(o,o+n); o+=n; blocks.push({d,e:rsEc(d,t[0])});}
    const out=[], maxd=Math.max(t[2],t[4]);
    for(let i=0;i<maxd;i++) blocks.forEach(b=>{if(i<b.d.length) out.push(b.d[i]);});
    for(let i=0;i<t[0];i++) blocks.forEach(b=>out.push(b.e[i]));
    return out;
  }
  function matrix(all,v,e){
    const size=17+4*v, M=Array.from({length:size},()=>new Array(size).fill(false)), F=Array.from({length:size},()=>new Array(size).fill(false));
    const setF=(x,y,c)=>{M[y][x]=c;F[y][x]=true;};
    for(let i=0;i<size;i++){setF(6,i,i%2===0);setF(i,6,i%2===0);}
    const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy; if(x<0||y<0||x>=size||y>=size) continue; const d=Math.max(Math.abs(dx),Math.abs(dy)); setF(x,y,d!==2&&d!==4);}};
    finder(3,3); finder(size-4,3); finder(3,size-4);
    const ap=ALIGN[v];
    ap.forEach((a,i)=>ap.forEach((b,j)=>{
      if((i===0&&j===0)||(i===0&&j===ap.length-1)||(i===ap.length-1&&j===0)) return;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) setF(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
    }));
    const fmt=mask=>{
      const d=(FMT[e]<<3)|mask; let r=d; for(let i=0;i<10;i++) r=(r<<1)^((r>>>9)*0x537);
      const bits=((d<<10)|r)^0x5412, g=i=>((bits>>>i)&1)===1;
      for(let i=0;i<=5;i++) setF(8,i,g(i)); setF(8,7,g(6)); setF(8,8,g(7)); setF(7,8,g(8));
      for(let i=9;i<15;i++) setF(14-i,8,g(i));
      for(let i=0;i<8;i++) setF(size-1-i,8,g(i));
      for(let i=8;i<15;i++) setF(8,size-15+i,g(i));
      setF(8,size-8,true);
    };
    fmt(0);
    if(v>=7){let r=v; for(let i=0;i<12;i++) r=(r<<1)^((r>>>11)*0x1F25); const bits=(v<<12)|r;
      for(let i=0;i<18;i++){const c=((bits>>>i)&1)===1, a=size-11+i%3, b=Math.floor(i/3); setF(a,b,c); setF(b,a,c);}}
    let k=0;
    for(let right=size-1;right>=1;right-=2){
      if(right===6) right=5;
      for(let vert=0;vert<size;vert++) for(let j=0;j<2;j++){
        const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
        if(!F[y][x]&&k<all.length*8){M[y][x]=((all[k>>>3]>>>(7-(k&7)))&1)===1;k++;}
      }
    }
    const MASK=[(r,c)=>(r+c)%2===0,(r)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,(r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
    const base=M.map(r=>r.slice());
    const penalty=m=>{
      let p=0;
      for(const line of [m,m[0].map((_,c)=>m.map(r=>r[c]))]){
        for(const row of line){
          let run=1; for(let i=1;i<=size;i++){ if(i<size&&row[i]===row[i-1]) run++; else {if(run>=5) p+=run-2; run=1;} }
          const s=row.map(x=>x?"1":"0").join("");
          for(const q of ["10111010000","00001011101"]){let at=s.indexOf(q); while(at>=0){p+=40; at=s.indexOf(q,at+1);}}
        }
      }
      for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x]; if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1]) p+=3;}
      let dark=0; m.forEach(r=>r.forEach(c=>{if(c)dark++;})); p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;
      return p;
    };
    let best=null,bp=1e9;
    for(let mk=0;mk<8;mk++){
      for(let y=0;y<size;y++)for(let x=0;x<size;x++) M[y][x]=F[y][x]?base[y][x]:(base[y][x]!==MASK[mk](y,x));
      fmt(mk); const pn=penalty(M); if(pn<bp){bp=pn;best=M.map(r=>r.slice());}
    }
    return best;
  }
  function make(text){
    const bytes=Array.from(new TextEncoder().encode(String(text)));
    for(const e of ["M","L"]) for(let v=1;v<=10;v++){
      const need=4+(v<10?8:16)+8*bytes.length;
      if(need<=dataCap(v,e)*8) return matrix(build(bytes,v,e),v,e);
    }
    return null;
  }
  // Devuelve un <svg> listo para insertar (o "" si el texto es demasiado largo).
  function svg(text,px=176){
    const m=make(text); if(!m) return "";
    const n=m.length, q=4; let d="";
    m.forEach((row,y)=>row.forEach((c,x)=>{if(c) d+=`M${x+q} ${y+q}h1v1h-1z`;}));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+2*q} ${n+2*q}" width="${px}" height="${px}" role="img" aria-label="Código QR" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  return {svg,make};
})();

document.addEventListener("DOMContentLoaded",bind);


/* ===== Carrusel de opciones (celular) =====
   En pantallas angostas las opciones se deslizan en horizontal con snap, la activa se agranda y
   unas pestañas con indicador animado permiten saltar entre ellas. En escritorio no cambia nada. */
function carouselTabsMarkup(p){
  return `<div class="cc-nav" data-cc-nav>
    <div class="cc-tabs" role="tablist" aria-label="Elegí entre las opciones"><span class="cc-ind" aria-hidden="true"></span>${p.options.map(o=>`<button type="button" role="tab" class="cc-tab" data-cc-tab="${escapeHtml(o.id)}" aria-selected="false"><span>${escapeHtml(o.name)}</span></button>`).join("")}</div>
    <p class="cc-hint">Deslizá para comparar · Tocá <b>Elegir</b> en la que más te sirva</p>
  </div>`;
}
function initChoiceCarousel(){
  const root=$("#publicContent"); if(!root) return;
  const grid=$(".cc-carousel",root), nav=$("[data-cc-nav]",root); if(!grid||!nav) return;
  const cards=[...grid.querySelectorAll("[data-choice]")], tabs=[...nav.querySelectorAll("[data-cc-tab]")], ind=nav.querySelector(".cc-ind");
  if(cards.length<2) return;
  const mq=matchMedia("(max-width:640px)"), reduce=()=>matchMedia("(prefers-reduced-motion:reduce)").matches;
  let active=-1, raf=0;
  const nearest=()=>{const c=grid.scrollLeft+grid.clientWidth/2; let b=0,d=Infinity; cards.forEach((el,i)=>{const x=Math.abs(el.offsetLeft+el.offsetWidth/2-c); if(x<d){d=x;b=i;}}); return b;};
  const paint=i=>{
    if(i===active) return; active=i;
    cards.forEach((el,k)=>el.classList.toggle("is-active",k===i));
    tabs.forEach((b,k)=>{b.setAttribute("aria-selected",k===i?"true":"false"); b.tabIndex=k===i?0:-1;});
    const t=tabs[i]; if(t&&ind){ind.style.width=t.offsetWidth+"px"; ind.style.transform=`translateX(${t.offsetLeft}px)`;}
    const box=ind&&ind.parentElement; if(box&&t) box.scrollTo({left:t.offsetLeft-(box.clientWidth-t.offsetWidth)/2,behavior:reduce()?"auto":"smooth"});
    syncCta();
  };
  // Si la opción que se está mirando no es la elegida, el botón principal dice "Elegir X" (evita aceptar sin querer otra).
  const syncCta=()=>{
    const p=state.proposals.find(x=>x.id===currentProposalId), ab=$("#acceptBtn"), el=cards[active]; if(!p||!ab||!el||!mq.matches) return;
    const sel=chosenOf(p), o=p.options.find(x=>x.id===el.dataset.choice);
    ab.textContent=(!o||o.id===sel.id)?ctaLabel(p,sel):`Elegir ${o.name} · ${money(finalPrice(o))}`;
  };
  window.__ccSync=syncCta;
  window.__ccGoTo=id=>{const i=cards.findIndex(c=>c.dataset.choice===id); if(i>=0&&mq.matches) goTo(i);};
  root.addEventListener("click",e=>{
    const ab=e.target.closest&&e.target.closest("#acceptBtn"); if(!ab||!mq.matches||active<0) return;
    const p=state.proposals.find(x=>x.id===currentProposalId), el=cards[active]; if(!p||!el||el.dataset.choice===chosenOf(p).id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const b=el.querySelector("[data-select-option]"); if(b) b.click();
  },true);
  const goTo=(i,smooth=true)=>{const el=cards[i]; if(!el) return; grid.scrollTo({left:el.offsetLeft-(grid.clientWidth-el.offsetWidth)/2,behavior:smooth&&!reduce()?"smooth":"auto"});};
  grid.addEventListener("scroll",()=>{if(!mq.matches) return; cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{paint(nearest()); nav.classList.add("touched");});},{passive:true});
  tabs.forEach((b,i)=>b.addEventListener("click",()=>goTo(i)));
  cards.forEach((el,i)=>el.addEventListener("click",()=>{if(mq.matches&&i!==active) goTo(i);}));
  grid.addEventListener("keydown",e=>{if(!mq.matches) return; if(e.key==="ArrowRight"){e.preventDefault(); goTo(Math.min(cards.length-1,nearest()+1));} if(e.key==="ArrowLeft"){e.preventDefault(); goTo(Math.max(0,nearest()-1));}});
  const start=()=>{ if(!mq.matches) return; const i=Math.max(0,cards.findIndex(c=>c.classList.contains("selected"))); active=-1; goTo(i,false); paint(nearest()); };
  requestAnimationFrame(()=>requestAnimationFrame(start));
  const re=()=>{ if(mq.matches){ const i=active<0?0:active; active=-1; goTo(i,false); paint(nearest()); } };
  addEventListener("resize",re,{passive:true});
}
// Respuesta a la acción de elegir: pulso en la tarjeta, vibración corta y un empujoncito al botón principal.
function celebratePick(id){
  const root=$("#publicContent"); if(!root) return;
  const card=root.querySelector(`[data-choice="${CSS.escape(id)}"]`), cta=$("#acceptBtn");
  if(card){card.classList.remove("just-picked"); void card.offsetWidth; card.classList.add("just-picked");}
  if(cta){cta.classList.remove("nudge"); void cta.offsetWidth; cta.classList.add("nudge");}
  try{navigator.vibrate&&navigator.vibrate(12);}catch(e){}
  if(window.__ccSync) window.__ccSync();
}


/* ===== Qué cambia entre opciones =====
   Ancla cada opción contra la recomendada (o la más económica): cuánto más/menos cuesta y qué suma o qué no incluye.
   Solo usa datos reales cargados en las opciones. */
function diffBase(p){return p.options.find(o=>o.recommended)||[...p.options].sort((a,b)=>finalPrice(a)-finalPrice(b))[0];}
function featList(o){return String(o.features||"").split("\n").map(x=>x.trim()).filter(Boolean);}
function diffMarkup(p,o){
  if(p.options.length<2) return "";
  const b=diffBase(p); if(!b||b.id===o.id) return "";
  const key=x=>String(x).toLowerCase().replace(/\s+/g," "), e=escapeHtml;
  const delta=Math.round(finalPrice(o)-finalPrice(b)), bf=new Set(featList(b).map(key)), of=new Set(featList(o).map(key));
  const sums=featList(o).filter(x=>!bf.has(key(x))), lacks=featList(b).filter(x=>!of.has(key(x)));
  const w=x=>String(x.warranty||"").trim().toLowerCase();
  if(o.hasWarranty&&w(o)&&(!b.hasWarranty||w(b)!==w(o))) sums.push("Garantía: "+o.warranty);
  else if(b.hasWarranty&&w(b)&&!(o.hasWarranty&&w(o))) lacks.push("Garantía: "+b.warranty);
  if(o.hasInstallments&&o.installments>1&&!(b.hasInstallments&&b.installments>=o.installments)) sums.push(`Hasta ${o.installments} cuotas`);
  else if(b.hasInstallments&&b.installments>1&&!(o.hasInstallments&&o.installments>1)) lacks.push(`Cuotas (${b.installments})`);
  const down=delta<0, list=down?lacks:sums; if(!list.length) return "";
  const head=down?`Ahorrás <em>${money(-delta)}</em> frente a ${e(b.name)}. No incluye:`:delta>0?`Por <em>${money(delta)} más</em> que ${e(b.name)} sumás:`:`Mismo precio que ${e(b.name)}. Suma:`;
  return `<div class="choice-diff ${down?"down":"up"}"><p>${head}</p><ul>${list.slice(0,3).map(x=>`<li>${e(x)}</li>`).join("")}${list.length>3?`<li class="more">y ${list.length-3} más</li>`:""}</ul></div>`;
}

/* ===== "¿Qué es lo más importante para vos?" =====
   Reduce la parálisis de elegir: un toque elige la opción que mejor responde a esa prioridad y explica por qué. */
function helperPicks(p){
  const O=p.options, cheap=[...O].sort((a,b)=>finalPrice(a)-finalPrice(b))[0];
  const score=o=>featList(o).length*10+(o.hasWarranty&&o.warranty?3:0)+(o.hasInstallments&&o.installments>1?1:0);
  const best=[...O].sort((a,b)=>score(b)-score(a)||finalPrice(b)-finalPrice(a))[0], rec=O.find(o=>o.recommended);
  const list=[{k:"cheap",ico:"💸",lab:"Ahorrar",o:cheap},{k:"best",ico:"🏆",lab:"Más completa",o:best}];
  if(rec) list.splice(1,0,{k:"rec",ico:"⭐",lab:"Recomendada",o:rec});
  const seen=new Set(); const out=list.filter(x=>x.o&&!seen.has(x.o.id)&&seen.add(x.o.id));
  return out.length>=2?out:[];
}
function pickHelperMarkup(p){
  const picks=helperPicks(p); if(!picks.length) return "";
  return `<div class="pick-helper" data-pick-helper><span class="ph-q">¿Qué priorizás?</span><div class="ph-chips" role="group" aria-label="Elegir según tu prioridad">${picks.map(x=>`<button type="button" class="ph-chip" data-ph="${x.k}"><i class="ph-ico" aria-hidden="true">${x.ico}</i>${x.lab}</button>`).join("")}</div><p class="ph-out" id="phOut" aria-live="polite" hidden></p></div>`;
}
function initPickHelper(){
  const root=$("#publicContent"), box=root&&$("[data-pick-helper]",root); if(!box) return;
  const p=state.proposals.find(x=>x.id===currentProposalId); if(!p) return;
  const picks=Object.fromEntries(helperPicks(p).map(x=>[x.k,x.o])), out=$("#phOut",root), biz=state.business.name||"Tu vendedor";
  const why={
    cheap:o=>`La más económica es <b>${escapeHtml(o.name)}</b>: ${money(finalPrice(o))}${p.depositPct>0?` y reservás con ${money(depositOf(p,o))}`:""}.`,
    rec:o=>`${escapeHtml(biz)} te recomienda <b>${escapeHtml(o.name)}</b>${o.why?`: “${escapeHtml(o.why)}”`:"."}`,
    best:o=>{const n=featList(o).length; return `La más completa es <b>${escapeHtml(o.name)}</b>${n?`: incluye ${n} ${n===1?"punto":"puntos"}`:""}${o.hasWarranty&&o.warranty?`${n?" y":":"} garantía de ${escapeHtml(o.warranty)}`:""}.`;}
  };
  box.addEventListener("click",e=>{
    const chip=e.target.closest("[data-ph]"); if(!chip) return;
    const o=picks[chip.dataset.ph]; if(!o) return;
    $$("[data-ph]",box).forEach(c=>c.classList.toggle("on",c===chip));
    const btn=root.querySelector(`.choice[data-choice="${CSS.escape(o.id)}"] [data-select-option]`);
    if(btn) btn.click();
    if(out){out.innerHTML=why[chip.dataset.ph](o); out.hidden=false;}
    if(window.__ccGoTo) window.__ccGoTo(o.id);
    const card=root.querySelector(`.choice[data-choice="${CSS.escape(o.id)}"]`);
    if(card&&!matchMedia("(max-width:640px)").matches) card.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});
  });
}


/* v28: carrusel horizontal de opiniones y "ver más" en preguntas frecuentes */
document.addEventListener("click",e=>{
  const nav=e.target.closest&&e.target.closest("[data-rev-nav]");
  if(nav){const row=nav.closest(".reviews-box").querySelector(".rev-row"); if(row){const calm=matchMedia("(prefers-reduced-motion:reduce)").matches; row.scrollBy({left:Number(nav.dataset.revNav)*Math.max(row.clientWidth*.8,260),behavior:calm?"auto":"smooth"});} return;}
  const more=e.target.closest&&e.target.closest("[data-faq-more]");
  if(more){
    const wrap=more.closest("[data-faq]"), open=more.getAttribute("aria-expanded")!=="true", extra=wrap.querySelectorAll(".faq-extra");
    extra.forEach(d=>{d.hidden=!open; if(!open) d.open=false;});
    more.setAttribute("aria-expanded",String(open));
    more.textContent=open?"Ver menos":`Ver ${extra.length} pregunta${extra.length>1?"s":""} más`;
    if(!open) wrap.scrollIntoView({block:"nearest",behavior:"smooth"});
  }
});
