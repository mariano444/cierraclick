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
function fullName(n){const f=String(n||"").trim().replace(/\s+/g," ");return f===NO_NAME?"":f;}
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
  proposal(row){return {...row,follow:row.follow&&typeof row.follow==="object"?row.follow:null,versionOf:row.version_of||null,versionNo:row.version_no||1,excludes:Array.isArray(row.extra&&row.extra.excludes)?row.extra.excludes:[],deliveryTime:(row.extra&&row.extra.deliveryTime)||"",offerUpdate:row.offer_update||null,lostReason:row.lost_reason,recontactAt:row.recontact_at?new Date(row.recontact_at).getTime():null,client:{name:row.clients?.name||"Cliente",phone:row.clients?.phone||""},expiresAt:row.expires_at,cashDiscount:Number(row.cash_discount||0),depositPct:Number(row.deposit_pct||0),chosenOption:row.chosen_option_id,createdAt:row.created_at,acceptedAt:row.accepted_at,lastViewedAt:row.last_viewed_at,lastFollowUpAt:row.last_follow_up_at,proofSentAt:row.proof_sent_at,depositPaidAt:row.deposit_paid_at,depositStarted:row.deposit_started||0,followUps:row.follow_ups||0,holdHours:row.hold_hours||0,payExitAt:row.pay_exit_at?new Date(row.pay_exit_at).getTime():null,bonusText:row.bonus_text||"",bonusHours:row.bonus_hours||0,slotsLeft:row.slots_left??null,slotsLabel:row.slots_label||"",acceptedName:row.accepted_name||"",termsAcceptedAt:row.terms_accepted_at||null,options:(row.proposal_options||[]).sort((a,b)=>a.position-b.position).map(o=>({id:o.id,name:o.name,price:Number(o.price),discountType:o.discount_type,discountValue:Number(o.discount_value),description:o.description,hasInstallments:o.has_installments,installments:o.installments,hasWarranty:o.has_warranty,warranty:o.warranty,features:o.features,terms:o.terms,recommended:o.recommended}))};},
  async hydrate(){
    if(!this.on||!currentUser)return;
    const sb=await Auth.client(); await this.rpc("refresh_expired").catch(()=>{});
    const [biz,props,catalog,events]=await Promise.all([sb.from("businesses").select("*").eq("owner_id",currentUser.id).single(),sb.from("proposals").select("*,clients(name,phone),proposal_options!proposal_options_proposal_id_fkey(*)").order("created_at",{ascending:false}),sb.from("catalog_items").select("*").order("updated_at",{ascending:false}),sb.from("proposal_events").select("type,message,created_at").order("created_at",{ascending:false}).limit(12)]);
    if(biz.error||props.error||catalog.error||events.error)throw biz.error||props.error||catalog.error||events.error;
    const b=biz.data;
    state={...structuredClone(defaultState),business:{name:b.name,whatsapp:b.whatsapp,paymentLink:b.payment_link,brandColor:b.brand_color,holder:b.holder,bank:b.bank,cbu:b.cbu,depositPolicy:b.deposit_policy,faq:b.faq,photo:b.photo||"",alias:b.alias,cuit:b.cuit,transferNote:b.transfer_note,afterSteps:b.after_steps||"",profile:profileOf(b.profile)},proposals:props.data.map(x=>this.proposal(x)),catalog:catalog.data.map(x=>({id:x.id,kind:x.kind,name:x.name,price:Number(x.price),discountType:x.discount_type,discountValue:Number(x.discount_value),description:x.description,hasInstallments:x.has_installments,installments:x.installments,hasWarranty:x.has_warranty,warranty:x.warranty,features:x.features,terms:x.terms})),clients:[],activity:events.data.map(x=>({icon:{created:"📝",view:"👀",select:"⭐",accept:"✅",deposit_paid:"💰",proof:"💸",follow_up:"🔔",renew:"🔄"}[x.type]||"•",text:x.message,time:relativeTime(x.created_at)}))};
    state.clients=Object.values(state.proposals.reduce((a,p)=>{const k=p.client.phone||p.client.name;a[k]||(a[k]={...p.client,proposals:0});a[k].proposals++;return a;},{}));applyRevCache();fillSettings();renderDashboard();
  },
  // RPC anónimo por fetch: no necesita cargar supabase-js (~100 KB desde un CDN), que era lo que más demoraba la propuesta del cliente.
  async pub(name,args={}){
    const key=CFG.supabaseKey||"", r=await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,...(key.startsWith("sb_")?{}:{authorization:`Bearer ${key}`}),"content-type":"application/json"},body:JSON.stringify(args)});
    if(!r.ok){let m="";try{m=(await r.json()).message||"";}catch(e){} const err=new Error(m||`Error ${r.status}`); err.code=r.status===404?"PGRST202":""; throw err;}
    const t=await r.text(); return t?JSON.parse(t):null;
  },
  async publicProposal(id){
    // Las 4 consultas salen a la vez (antes: 1 y después 3), y las extras son opcionales.
    const [r,x,ox,v3,ph,pf,ou,tr]=await Promise.all([
      this.pub("get_public_proposal",{p_id:id}),
      this.pub("get_public_extras",{p_id:id}).catch(()=>null),
      this.pub("get_public_option_extras",{p_id:id}).then(v=>({v}),()=>null),
      this.pub("get_public_v3",{p_id:id}).catch(()=>null),
      this.pub("get_public_option_photos",{p_id:id}).catch(()=>null),
      this.pub("get_public_business_profile",{p_id:id}).catch(()=>null),
      this.pub("get_public_proposal_extra",{p_id:id}).catch(()=>this.pub("get_public_offer_update",{p_id:id}).then(o=>({offerUpdate:o})).catch(()=>null)),
      this.pub("get_public_reviews_by_proposal",{p_id:id}).catch(()=>null)]);
    if(!r) return r;
    if(x) r.business={...(r.business||{}),...x};
    if(ox){const m=ox.v; if(m&&r.options) r.options.forEach(o=>{const e=m[o.id]; if(e){o.why=e.why;o.photo=e.photo;}}); r._ex=true;}
    if(ph&&r.options) r.options.forEach(o=>{const l=ph[o.id]; if(Array.isArray(l)&&l.length) o.photos=l;});
    if(v3){applyV3(r,v3); r.business={...(r.business||{}),afterSteps:v3.afterSteps||""};}
    if(pf&&typeof pf==="object") r.business={...(r.business||{}),profile:profileOf(pf)};
    if(ou&&typeof ou==="object"){
      const ex=("offerUpdate" in ou||"excludes" in ou||"deliveryTime" in ou)?ou:{offerUpdate:ou};
      if(ex.offerUpdate){r.offerUpdate=ex.offerUpdate; applyOfferUpdate(r);}
      if(Array.isArray(ex.excludes)) r.excludes=ex.excludes; if(ex.deliveryTime) r.deliveryTime=ex.deliveryTime;
    }
    if(tr&&typeof tr==="object") r.business={...(r.business||{}),...trustFields(tr)};
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
  fillProfile();
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
  $("#proposalForm").reset(); builderReferral=null; builderAltOf=null;
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
          <div class="photo-field full"><span>Fotos de esta opción (opcional · hasta ${MAX_PHOTOS}) <b class="photo-count">${photosOf(o).length}/${MAX_PHOTOS}</b></span>${photosOf(o).length?`<div class="photo-grid">${photosOf(o).map((ph,pi)=>safeImg(ph)?`<figure><img src="${safeImg(ph)}" alt="Foto ${pi+1}"><button type="button" class="photo-x" data-photo-del="${pi}" aria-label="Quitar foto ${pi+1}">×</button></figure>`:"").join("")}</div>`:""}${photosOf(o).length<MAX_PHOTOS?`<input type="file" data-photo accept="image/*" multiple><button type="button" class="btn btn-secondary btn-sm gal-open-btn" data-gal-open>🖼 Elegir de mi galería</button>`:'<small>Llegaste al máximo. Quitá una para agregar otra.</small>'}</div>
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
    const list=photosOf(o), nuevas=[];
    if(Cloud.on) toast("Subiendo fotos…");
    for(const f of files.slice(0,room)){const ph=await storePhoto(await resizePhoto(f)); list.push(ph); nuevas.push(ph);}
    galAdd(nuevas).catch(()=>{});
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
  try{await rpcPhotos("set_option_extras",c=>({p_id:id,p_extras:p.options.map(o=>({why:o.why||"",photo:c(photosOf(o)[0]||"")}))}));
    const r=state.proposals.find(x=>x.id===id); if(r) r.options.forEach((o,i)=>{if(p.options[i]){o.why=p.options[i].why;o.photo=photosOf(p.options[i])[0]||"";}});
  }catch(e){toast("La propuesta se creó, pero la foto y la frase no se guardaron: falta ejecutar supabase_fotos.sql.");}
  // Galería: solo hace falta cuando alguna opción tiene 2 o más fotos.
  if(p.options.some(o=>photosOf(o).length>1)){
    try{await rpcPhotos("set_option_photos",c=>({p_id:id,p_photos:p.options.map(o=>photosOf(o).map(c))}));
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
    excludes:$("#excludes").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,12),deliveryTime:$("#deliveryTime").value.trim().slice(0,80),
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
  const inst=o.hasInstallments&&o.installments>1?`<p class="meta-row"><b>${o.installments} cuotas</b> de ${money(fin/o.installments)} <small>(total ${money(fin)})</small></p>`:"";
  const dep=p.depositPct>0?`<p class="meta-row">🔒 Seña para reservar: <b>${money(depositOf(p,o))}</b> (${p.depositPct}%) · saldo ${money(fin-depositOf(p,o))}</p>`:"";
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
      ${diffMarkup(p,o)}
      ${(()=>{const body=`${o.description?`<p>${escapeHtml(o.description)}</p>`:""}${o.hasWarranty&&o.warranty?`<p>🛡️ Garantía: ${escapeHtml(o.warranty)}</p>`:""}${feats}${(o.terms||"").trim()?`<details class="terms"><summary>Términos y condiciones</summary><p>${escapeHtml(o.terms)}</p></details>`:""}`;return !body.trim()?"":(multi&&mode==="full")?`<details class="choice-more"><summary>Ver qué incluye</summary>${body}</details>`:body;})()}
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
      ${whoChip()}${advisorLine()}${contactChip()}
      <div class="public-greeting">${escapeHtml(hello(p.client.name))} 👋</div>
      <div class="public-title">${escapeHtml(p.title)}</div>
      ${mode==="full"&&p.status!=="expired"?`<p class="public-intro">${escapeHtml(introText(p))}</p>`:""}
      ${mode==="full"?`<span class="valid">${expiryLine(p)}</span>`:""}
      ${offerBannerMarkup(p)}
      ${p.status!=="expired"?voiceMarkup(p):""}
      ${mode==="full"&&p.status!=="expired"?`<div class="steps"><span><b>1</b> ${multi?"Elegí tu opción":"Revisá la propuesta"}</span><span><b>2</b> Aceptá</span><span><b>3</b> Reservá${p.depositPct>0?" con seña":""}</span></div><ul class="trust-strip"><li>🔒 Sin cargo al aceptar</li>${p.options.some(o=>o.hasWarranty&&o.warranty)?"<li>🛡️ Garantía</li>":""}<li>💬 Por WhatsApp</li></ul>`:""}
      ${p.status!=="expired"?perksMarkup(p):""}
      ${p.status!=="expired"?compareMarkup(p,mode):""}
      ${multi&&mode==="full"&&p.status!=="expired"?pickHelperMarkup(p):""}${multi&&mode==="full"?carouselTabsMarkup(p):""}<div class="choice-grid n${p.options.length}${multi&&mode==="full"?" cc-carousel":""}"${multi&&mode==="full"?' tabindex="0" role="group" aria-roledescription="carrusel" aria-label="Opciones de la propuesta"':""}>${p.options.map(o=>optionMarkup(p,o,mode)).join("")}</div>
      ${p.status!=="expired"?detailsMarkup(p):`<div class="public-includes" data-sec="incluye">${includes}</div><div data-sec="pago">${payBlock(p)}</div><p data-sec="condiciones" style="color:#64748b;font-size:13px">${escapeHtml(p.conditions)}</p>`}
      ${p.status!=="expired"?whoMarkup():""}${mode==="full"&&p.status!=="expired"?reviewsMarkup()+assuranceMarkup(p):""}
      ${mode==="full"&&p.status!=="expired"?`${needMarkup(p)}${consultMarkup(p)}<div class="later-box"><span>¿Necesitás tiempo o consultarlo con alguien?</span><button type="button" id="remindBtn">⏰ Recordame mañana</button><button type="button" id="shareBtn">👥 Compartir con otra persona</button></div><div class="pick-summary" id="pickSummary" hidden></div>${acceptFormMarkup(p)}`:""}
      <div class="public-actions">
        ${mode==="full"&&p.status!=="expired"?`<div class="cta-note" id="ctaNote"></div>`:""}
        ${mode==="full"&&p.status==="expired"?`<button class="public-seña" disabled style="opacity:.5">Propuesta vencida</button>`:mode==="full"?`<button class="public-seña" id="acceptBtn">${escapeHtml(ctaLabel(p,chosenOf(p)))}</button>`:''}
        ${mode==="full"&&p.status==="expired"?`<a class="public-whatsapp" id="publicWhatsapp" href="#" target="_blank" rel="noopener">💬 Escribir por WhatsApp</a>`:""}
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
  try{updateAltBanner();}catch(e){}
  updatePriceTip();
  const p = {
    kind:builderKind,
    client:{name:$("#clientName").value.trim()||NO_NAME},
    title:$("#proposalTitle").value||KINDS[builderKind].title,
    expiresAt:builderExpiry(),payments:selectedPayments(),cashDiscount:builderCash(),depositPct:builderDep(),
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    excludes:$("#excludes").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,12),deliveryTime:$("#deliveryTime").value.trim().slice(0,80),
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
    [O.some(o=>o.hasInstallments&&o.installments>1)||!!p.bonusText||p.slotsLeft>0||p.holdHours>0,"Dale una razón para decidir hoy","Cuotas, un bonus por reservar a tiempo o cupos reales ayudan a decidir sin bajar tu precio. Usá solo lo que sea verdad."],
    [!profileEmpty(profileOf(b.profile)),"Completá «Quién te atiende» en Configuración","Zona, experiencia y trabajos realizados dan confianza antes de pedir la seña."],
    [O.some(o=>o.hasWarranty),"Indicá la garantía","Reduce el miedo a equivocarse."],
    [faqItems(b).length>0,"Cargá preguntas frecuentes en Configuración","Responde las dudas antes de que se las lleve a otro lado."],
    [daysLeft(p)<=10,"Poné un vencimiento más corto (hasta 10 días)","Un plazo claro evita que la propuesta se enfríe."]
  ];
  const ok=checks.filter(c=>c[0]).length, pct=Math.round(100*ok/checks.length), miss=checks.filter(c=>!c[0]).slice(0,3);
  box.innerHTML=`<div class="strength-head"><b>Fuerza de la propuesta</b><span>${ok} de ${checks.length}</span></div><div class="strength-bar" role="img" aria-label="${pct}% completo"><i style="width:${pct}%"></i></div>${miss.length?`<ul>${miss.map(c=>`<li><b>${c[1]}</b><small>${c[2]}</small></li>`).join("")}</ul>`:'<p class="strength-ok">¡Muy buena! Tiene todo lo que ayuda a cerrar.</p>'}`;
}

function openBuilder(){
  if(!currentUser) return openAuth("login");
  resetBuilder(); window._buildStart=Date.now(); _wizNoDraft=false; wizGo(1); wizClearErrors();
  openModal("builderModal"); offerDraft();
  $("#clientName").focus();
}

async function createProposal(e){
  e.preventDefault();
  const p=collectBuilderData();
  galAdd(p.options.flatMap(photosOf)).catch(()=>{});
  if(Cloud.on){try{const id=await Cloud.rpc("create_proposal",{p:{...p,options:p.options.map(({photo,photos,...o})=>o),id:undefined,validity:undefined,createdAt:undefined,status:undefined,views:undefined,chosenOption:undefined,acceptedAt:undefined,depositStarted:undefined,lastEvent:undefined,bonusText:undefined,bonusHours:undefined,slotsLeft:undefined,slotsLabel:undefined,voice:undefined,holdHours:undefined}});await Cloud.hydrate();await saveOptionExtras(id,p);await saveProposalExtras(id,p);await saveProposalExtra(id,p);await linkReferral(id);await linkVersion(id);const remote=state.proposals.find(x=>x.id===id);closeModal("builderModal");if(remote)window.open(`https://wa.me/${normalizePhone(remote.client.phone)}?text=${encodeURIComponent(shareText(remote))}`,"_blank","noopener");toast("Propuesta creada y WhatsApp preparado.");return;}catch(ex){return toast(ex.message||"No se pudo crear la propuesta.");}}
  state.proposals.unshift(p);
  linkReferral(p.id); linkVersion(p.id);
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
  if(Cloud.on&&!preview){try{const remote=await Cloud.publicProposal(id);if(!remote)return toast("No se encontró la propuesta.");const p={...remote,createdAt:remote.createdAt||new Date().toISOString()};state.business={...state.business,...remote.business};state.proposals=[p,...state.proposals.filter(x=>x.id!==id)];humanOnce(()=>Cloud.pub("track_proposal",{p_id:id,p_type:"view"}).catch(()=>{}));return openPublic(id,true,true);}catch(e){return toast(e.message||"No se pudo abrir la propuesta.");}}
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  if(Cloud.on&&currentUser&&!p._ex){p._ex=true;try{const ox=await Cloud.rpc("get_public_option_extras",{p_id:id});(p.options||[]).forEach(o=>{const x=ox&&ox[o.id];if(x){o.why=x.why;o.photo=x.photo;}});}catch(e){}
    try{const ph=await Cloud.rpc("get_public_option_photos",{p_id:id});(p.options||[]).forEach(o=>{const l=ph&&ph[o.id];if(Array.isArray(l)&&l.length)o.photos=l;});}catch(e){}}
  if(Cloud.on&&currentUser&&!p._v3){p._v3=true;try{const v=await Cloud.rpc("get_public_v3",{p_id:id});if(v)applyV3(p,v);}catch(e){} applyOfferUpdate(p);}
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
  $("#publicWhatsapp").href=`https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`Hola, estuve revisando la propuesta “${p.title}”${firstName(p.client.name)?` de ${p.client.name}`:""} y quisiera hacer una consulta antes de avanzar.`)}`;
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
  // Después de elegir, se muestra solo el último paso (nombre + condiciones) y se lleva a la persona hasta ahí.
  const revealAccept=()=>{
    const f=$("#acceptForm"); if(!f) return;
    f.hidden=false; upd();
    setTimeout(()=>{
      const r=f.getBoundingClientRect(), visible=r.top<innerHeight*.75&&r.bottom>innerHeight*.25;
      if(!visible) f.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
      const n=$("#acceptName"); if(n&&!n.value.trim()){try{n.focus({preventScroll:true});}catch(e){}}
    },380);
  };
  $$("[data-select-option]",$("#publicContent")).forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.selectOption;
      p.chosenOption=id;
      p.lastEvent=`Cliente eligió ${p.options.find(x=>x.id===id)?.name||"una opción"}.`;
      state.activity.unshift({icon:"⭐",text:`${p.client.name} seleccionó una opción.`,time:"Ahora"});
      saveState(); if(Cloud.on) Cloud.rpc("track_proposal",{p_id:p.id,p_type:"select",p_option:id}).catch(()=>toast("No se pudo guardar la elección."));
      markSelected(id); upd(); celebratePick(id); revealAccept();
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
      ${statusTrackMarkup(p,dep,paid)}
      ${p.acceptedName?`<p class="accepted-by">Aceptada por <b>${e(p.acceptedName)}</b>${p.termsAcceptedAt?" · condiciones aceptadas":""}</p>`:""}${bonusWonMarkup(p)}
      ${paid?`<div class="state-note">💰 <b>Seña recibida.</b> ¡Tu reserva está confirmada!</div>`:p.proofSentAt?`<div class="state-note">💸 Avisaste que transferiste. ${e(b.name)} lo está verificando.</div>`:""}
      ${paid||p.proofSentAt?"":holdMarkup(p)}
      ${primary}
      ${afterMarkup(p,true)}
      ${contactChip()}
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
  if(Cloud.on&&currentUser&&!_engBoot){_engBoot=true;loadEngTotals();loadReviews();registerOwnerDevice();loadReferrals();loadResponses();}
  renderGreeting();
  if(syncExpired(state.proposals)) saveState();
  const proposals=state.proposals||[];
  const views=proposals.reduce((s,p)=>s+(p.views||0),0);
  const accepted=proposals.filter(p=>p.status==="accepted").length;
  $("#metricProposals").textContent=proposals.length;
  $("#metricViews").textContent=views;
  $("#metricAccepted").textContent=accepted;
  $("#metricConversion").textContent=proposals.length?`${Math.round(accepted/proposals.length*100)}%`:"—";

  const wk=Date.now()-7*DAY, won=proposals.filter(p=>p.status==="accepted"&&new Date(p.acceptedAt)>wk);
  $("#weekCard").innerHTML=proposals.length?`<b>Últimos 7 días</b><div class="week-row"><span><strong>${proposals.filter(p=>new Date(p.createdAt)>wk).length}</strong> enviadas</span><span><strong>${won.length}</strong> aceptadas</span><span><strong>${money(won.reduce((s,p)=>s+finalPrice(chosenOf(p)),0))}</strong> cerrado</span><span><strong>${money(recoveredOf(proposals,+wk).amount)}</strong> tras seguimiento</span></div>`:"";
  const open=proposals.filter(p=>(p.status==="sent"||p.status==="viewed")&&!isDormant(p));
  const pending=open.reduce((s,p)=>s+finalPrice(chosenOf(p)),0);
  $("#pendingBanner").innerHTML=open.length?`💰 <b>${money(pending)}</b> esperando respuesta en ${open.length} propuesta${open.length>1?"s":""}. Pronóstico estimado: <b>${money(salesMetrics(proposals).forecast)}</b>. Tocá <b>🔔 Seguimiento</b> para recuperarlas por WhatsApp.`:"";
  const paidBtn=p=>(p.status==="accepted"&&!p.depositPaidAt)?`<button class="text-btn" data-paid="${p.id}">✔ Seña recibida</button>`:"";
  const followBtn=p=>p.status==="lost"?`<button class="text-btn" data-follow="${p.id}">💬 Retomar</button>`:(p.status==="accepted"&&!p.depositPaidAt&&p.depositPct>0)?`<button class="text-btn" data-follow="${p.id}">💸 Pedir seña</button>`:(p.status==="sent"||p.status==="viewed")?`<button class="text-btn" data-follow="${p.id}">${(p.followUps||0)>=3?"✉️ Cierre amable":"🔔 Seguimiento"}</button>`:"";
  const reviewBtn=p=>p.status==="accepted"?`<button class="text-btn" data-ask-review="${p.id}">⭐ Pedir opinión</button>`:"";
  const refAskBtn=p=>p.status==="accepted"&&refCfg().on?`<button class="text-btn" data-ref-ask="${p.id}">🎁 Pedir recomendación</button>`:"";
  const improveBtn=p=>["sent","viewed","expired"].includes(p.status)?`<button class="text-btn" data-improve="${p.id}">✨ Mejorar oferta</button>`:"";
  const lostBtn=p=>["sent","viewed","expired"].includes(p.status)?`<button class="text-btn" data-lost="${p.id}">✖ Perdida</button>`:"";
  const items=todayItems();
  $("#todayCount").textContent=items.length||"";
  $("#todayList").innerHTML=items.map(({p,reason})=>`<div class="proposal-item"><div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${heat(p)} · ${reason}</span></div><div>${unlockBtn(p)}${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>${improveBtn(p)}`:followBtn(p)+paidBtn(p)+improveBtn(p)+lostBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div></div>`).join("")||EMPTY_TODAY(proposals.length);
  $("#hotList").innerHTML=proposals.slice(0,5).map(p=>`
    <div class="proposal-item">
      <div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${p.views||0} vistas</span></div>
      <div><span class="status">${statusLabel(p.status)}</span>${followBtn(p)}<button class="text-btn" data-open="${p.id}">Abrir</button></div>
    </div>`).join("") || EMPTY_FIRST();

  $("#activityList").innerHTML=(state.activity||[]).slice(0,6).map(a=>`<div class="activity"><b>${a.icon}</b><div>${escapeHtml(a.text)}<br><span style="color:#94a3b8">${escapeHtml(a.time)}</span></div></div>`).join("")||EMPTY_ACTIVITY(proposals.length);
  $("#proposalTable").innerHTML=proposals.map(p=>`
    <tr><td><strong>${escapeHtml(p.client.name)}</strong><br><small>${escapeHtml(p.title)}${p.versionNo>1?` · <b>v${p.versionNo}</b>`:""}</small></td>
    <td>${money(finalPrice(chosenOf(p)))}</td>
    <td><span class="badge ${p.status}">${statusLabel(p.status)}</span><br><small>${heat(p)}${engBadge(p)}</small>${stageTag(p)}${nextStepMarkup(p)}</td>
    <td>${p.views||0}</td><td>${relativeTime(p.createdAt)}</td>
    <td class="actions">${unlockBtn(p)}${followBtn(p)}${paidBtn(p)}${improveBtn(p)}${lostBtn(p)}${reviewBtn(p)}${refAskBtn(p)}${p.status==="expired"?`<button class="text-btn" data-renew="${p.id}">🔄 Renovar</button>`:""}${p.status==="accepted"?`<button class="text-btn" data-receipt="${p.id}">📄 Constancia</button>`:""}<button class="text-btn" data-copylink="${p.id}">🔗 Link</button><button class="text-btn" data-dup="${p.id}">Duplicar</button><button class="text-btn" data-open="${p.id}">Ver</button><button class="text-btn" data-hist="${p.id}">📊 Atención</button></td></tr>`).join("")||EMPTY_TABLE();
  $("#clientsGrid").innerHTML=(state.clients||[]).map(c=>`<div class="client"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.phone)}</p><p>${c.proposals||0} propuesta(s)</p></div>`).join("")||EMPTY_CLIENTS();
  renderPerformance(); renderReferrals();
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
    const tx=todayExtra(p); if(tx==="skip") return; if(tx){out.push(tx); return;}
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
  $("#proposalTitle").value=p.title; $("#includes").value=(p.includes||[]).join("\n"); $("#conditions").value=p.conditions||""; $("#excludes").value=(p.excludes||[]).join("\n"); $("#deliveryTime").value=p.deliveryTime||"";
  $("#cashDiscount").value=p.cashDiscount||0; $("#depositPct").value=p.depositPct||0;
  $("#bonusText").value=p.bonusText||""; $("#bonusHours").value=p.bonusHours||48; $("#slotsLeft").value=p.slotsLeft??""; $("#slotsLabel").value=p.slotsLabel||""; $("#holdHours").value=p.holdHours||"";
  $$('input[name="pay"]').forEach(x=>x.checked=(p.payments||[]).includes(x.value));
  $$('input[name="kind"]').forEach(x=>x.checked=x.value===(p.kind||"service"));
  builderKind=p.kind||"service";
  builderOptions=p.options.map(o=>{const {id,...rest}=o;return newOption({...rest,_open:true});});
  renderOptionEditors(); renderCatalog(); renderBuilderPreview();
  wizPrefilled(2); toast("Duplicada: cambiá lo necesario y creá la propuesta.");
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
    else if(el.id==="publicWhatsapp") key="Consulta por WhatsApp (antes de decidir)";
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
const STORE_PREFIX=String(CFG.supabaseUrl||"").replace(/\/+$/,"")+"/storage/v1/object/public/fotos/";
const OK_STORE=v=>!!CFG.supabaseUrl&&typeof v==="string"&&v.startsWith(STORE_PREFIX)&&/^[A-Za-z0-9\/._-]{1,200}$/.test(v.slice(STORE_PREFIX.length));
const safeImg=v=>(OK_IMG.test(v||"")||OK_STORE(v))?v:"";
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
  return safeImg(b.photo)?`<span class="avatar has-photo" role="img" aria-label="Foto de ${escapeHtml(b.name||"quien te atiende")}" style="background-image:url('${safeImg(b.photo)}')"></span>`:`<span class="avatar">${escapeHtml((b.name||"?").trim().charAt(0).toUpperCase())}</span>`;
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
  if(Array.isArray(b.reviews)&&b.rating) return {avg:Number(b.rating.avg)||0,count:Number(b.rating.count)||0,dist:b.ratingDist||null,
    list:b.reviews.map(r=>({stars:r.stars,comment:r.comment,photo:r.photo||"",author:r.author,source:r.source,at:r.created_at?new Date(r.created_at).getTime():(r.at||0)}))};
  const rs=[...(state.proposals||[]).filter(p=>p.review&&p.review.stars).map(p=>({stars:p.review.stars,comment:p.review.comment||"",photo:p.review.photo||"",author:fullName(p.client.name),source:"proposal",at:p.review.at||0})),...(state.extReviews||[]).map(r=>({...r,source:"external"}))];
  const c=rs.length, dist={}; [1,2,3,4,5].forEach(n=>{dist[n]=rs.filter(r=>r.stars===n).length;});
  return {avg:c?rs.reduce((x,r)=>x+r.stars,0)/c:0,count:c,dist,list:rs.filter(r=>r.comment).sort((x,y)=>y.at-x.at).slice(0,60)};
}
function ratingChip(){const r=getReviews(); return r.count?`<span class="rating-chip">★ ${fmtAvg(r.avg)} · ${r.count} ${r.count>1?"opiniones":"opinión"}</span>`:"";}
const reviewCard=r=>{const nm=String(r.author||"Cliente").trim().replace(/\s+/g," ")||"Cliente";
  return `<figure class="review"><div class="review-top"><span class="review-av${safeImg(r.photo)?" has-photo":""}" aria-hidden="true">${safeImg(r.photo)?`<img src="${safeImg(r.photo)}" alt="" loading="lazy">`:escapeHtml(nm.charAt(0).toUpperCase())}</span><div><div class="review-stars" role="img" aria-label="${Number(r.stars)||0} de 5 estrellas">${stars(r.stars)}</div><figcaption>${escapeHtml(nm)}<small>${r.source==="external"?"Cliente del negocio":"✔ Cliente verificado"}</small></figcaption></div></div>${r.comment?`<blockquote>${escapeHtml(r.comment)}</blockquote>`:""}</figure>`;};
const revRow=list=>`<div class="rev-row" tabindex="0" role="group" aria-label="Opiniones de clientes">${list.map(reviewCard).join("")}</div>`;
function reviewDistMarkup(r){
  const d=r.dist; if(!d||!r.count) return "";
  const get=n=>Number(d[n]!==undefined?d[n]:d[String(n)])||0, total=[1,2,3,4,5].reduce((s,n)=>s+get(n),0);
  if(!total) return "";
  const rows=[5,4,3,2,1].map(n=>`<div class="rd-row"><span>${n}★</span><i aria-hidden="true"><b style="width:${Math.round(100*get(n)/total)}%"></b></i><em>${get(n)}</em></div>`).join("");
  return `<div class="rev-dist" role="img" aria-label="Opiniones por cantidad de estrellas">${rows}</div>`;
}
function reviewsMarkup(opts){
  const asList=!!(opts&&opts.list), r=getReviews(); if(!r.count) return "";
  const list=r.list.filter(x=>x.comment);
  const nav=!asList&&list.length>1?'<div class="rev-nav"><button type="button" data-rev-nav="-1" aria-label="Opiniones anteriores">‹</button><button type="button" data-rev-nav="1" aria-label="Opiniones siguientes">›</button></div>':"";
  const body=!list.length?"":asList?`<div class="rev-list">${list.map(reviewCard).join("")}</div>`:revRow(list);
  return `<section class="reviews-box${asList?" as-list":""}" data-sec="opiniones"><div class="rev-head"><div class="rev-sum"><strong>${fmtAvg(r.avg)}</strong><span class="review-stars">${stars(Math.round(r.avg))}</span><small>${r.count} opinión${r.count>1?"es":""} de clientes</small></div>${nav}</div>${reviewDistMarkup(r)}${body}</section>`;
}
function reviewsPanel(){
  const r=getReviews();
  return `<div class="loss-list"><b>⭐ Opiniones de tus clientes</b>${state.business.pendingReviews?`<small style="color:#92400e">${state.business.pendingReviews} opinión${state.business.pendingReviews>1?"es":""} en revisión: no se muestran al público ni cuentan en el promedio.</small>`:""}${r.count?`<div class="rev-sum"><strong>${fmtAvg(r.avg)}</strong><span class="review-stars">${stars(Math.round(r.avg))}</span><small>${r.count} opinión${r.count>1?"es":""}</small></div>${revRow(r.list)}`:'<p style="color:#64748b;margin:6px 0 0">Todavía no hay opiniones. Aparecen cuando un cliente que aceptó una propuesta deja la suya desde su enlace.</p>'}</div>`;
}
function renderPerfExtras(){renderPerfExtrasBase(); const box=$("#perfExtras"); if(box) box.insertAdjacentHTML("beforeend",reviewsPanel());}
let REV_CACHE=null; // las reseñas sobreviven a Cloud.hydrate(), que reconstruye state.business
function applyRevCache(){ if(REV_CACHE&&state&&state.business) Object.assign(state.business,REV_CACHE); }
async function loadReviews(){
  if(!Cloud.on||!currentUser) return;
  try{const sb=await Auth.client(); const q=c=>sb.from("business_reviews").select(c).order("created_at",{ascending:false}).limit(100);
    let {data,error}=await q("stars,comment,author,source,status,created_at,photo"); if(error) ({data,error}=await q("stars,comment,author,source,status,created_at"));
    if(error) throw error;
    const rows=data||[], pub=rows.filter(r=>r.status==="published"), c=pub.length;
    REV_CACHE={rating:{avg:c?pub.reduce((x,r)=>x+r.stars,0)/c:0,count:c},reviews:pub.filter(r=>r.comment).slice(0,60),pendingReviews:rows.length-c};
    applyRevCache();
    if($("#perfExtras")) renderPerfExtras(); // repinta el panel con los datos ya cargados
  }catch(e){console.warn("loadReviews:",e);}
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
  const card=$("#publicContent .public-card"); if(card){card.insertAdjacentHTML("beforeend",reviewFormMarkup(p)); attachReview(p); card.insertAdjacentHTML("beforeend",refCardMarkup(p)); attachRefCard(p);}
}
/* ===== Pedir opinión (dentro o fuera de la plataforma) ===== */
const reviewLink=t=>`${location.origin}${location.pathname.replace(/index\.html$/,"")}?r=${t}`;
function localSubmitReq(t,stars,comment,photo=""){
  const r=(state.reviewRequests||{})[t]; if(!r||r.used) throw new Error("Este link ya no está disponible");
  r.used=true;
  if(r.proposalId){const p=state.proposals.find(x=>x.id===r.proposalId); if(p) p.review={stars,comment,photo,at:Date.now()};}
  else (state.extReviews=state.extReviews||[]).push({stars,comment,photo,author:fullName(r.name),at:Date.now()});
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
    if(Cloud.on){
      info=await Cloud.rpc("get_review_request",{p_token:token}); if(info&&info.business) state.business={...state.business,...info.business};
      // Reseñas completas + «Quién te atiende» (si falta supabase_v7_resenas_publicas.sql, se ven las que mande la función anterior)
      try{const t=await Cloud.rpc("get_public_reviews_by_token",{p_token:token}); if(t&&typeof t==="object") state.business={...state.business,...trustFields(t)};}catch(e){}
    }
    else{const r=(state.reviewRequests||{})[token]; info=r?{status:r.used?"used":"valid",client:r.name.split(" ")[0]}:null;}
  }catch(e){}
  const card=$("#publicContent");
  if(!info||info.status!=="valid"){
    const used=info&&info.status==="used";
    card.innerHTML=`<div class="public-card"><div class="public-greeting">${used?"Ya recibimos tu opinión 🙌":"Este link no está disponible"}</div><p style="color:#64748b">${used?"¡Gracias por tomarte el tiempo!":"Pedile a quien te lo envió que te mande uno nuevo."}</p></div>`;
  }else{
    const rp={review:null,_token:token};
    card.innerHTML=`<div class="public-card rv-page"><div class="public-brand">${avatarHtml()}${escapeHtml((state.business.name||"").toUpperCase())}${ratingChip()}</div>${whoChip()}<div class="public-greeting">${escapeHtml(hello(info.client))} 👋</div><p style="color:#475569">Contanos cómo fue tu experiencia con ${escapeHtml(state.business.name||"el negocio")}.</p>${reviewSafeMarkup()}${reviewFormMarkup(rp)}${whoMarkup()}${reviewsMarkup({list:true})}</div>`;
    attachReview(rp);
  }
  openModal("publicModal"); document.documentElement.classList.add("proposal-ready");
  if(state.business.name) document.title=`Tu opinión · ${state.business.name}`;
}
/* Perdida con motivo y recontacto */
const LOST_REASONS=["Precio","Eligió a otro","No responde","Postergó","Otro"];
function openTool(html){$("#toolModal").classList.remove("wide");$("#toolContent").innerHTML=html;openModal("toolModal");}
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
  openTool(`<h3>Historial · ${escapeHtml(p.client.name)}</h3><p class="tool-sub">${escapeHtml(p.title)} · ${heat(p)}</p><p>${unlockBtn(p)}</p><ol class="timeline">${ev.map(e=>`<li><b>${e.i}</b><div>${escapeHtml(e.x)}${e.t>864e5?`<small>${relativeTime(new Date(e.t).toISOString())}</small>`:""}</div></li>`).join("")}</ol><h3 class="eng-title">Atención del cliente</h3><div id="engBox"><p class="tool-sub">Cargando análisis…</p></div><div class="tool-actions"><button class="btn btn-ghost" data-tool-close>Cerrar</button></div>`);
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
  perfEmptyPass(); renderRecovery();
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
    state.business={...state.business,name:g("businessName"),whatsapp:g("whatsapp"),paymentLink:g("paymentLink"),brandColor:g("brandColor"),holder:g("holder"),bank:g("bank"),cbu,alias,cuit:g("cuit"),transferNote:g("transferNote"),depositPolicy:g("depositPolicy"),faq:g("faq"),afterSteps:g("afterSteps"),profile:readProfile()};
    if(Cloud.on){try{const sb=await Auth.client();const {error}=await sb.from("businesses").update({name:state.business.name,whatsapp:state.business.whatsapp,payment_link:state.business.paymentLink,deposit_policy:state.business.depositPolicy||"",photo:state.business.photo||"",faq:state.business.faq||"",brand_color:state.business.brandColor,holder:state.business.holder,bank:state.business.bank,cbu,alias,cuit:state.business.cuit,transfer_note:state.business.transferNote}).eq("owner_id",currentUser.id);if(error)throw error;{const r2=await sb.from("businesses").update({after_steps:state.business.afterSteps||""}).eq("owner_id",currentUser.id);if(r2.error)toast("Guardé el resto, pero «Qué pasa después» necesita ejecutar supabase_v3.sql en Supabase.");}}catch(ex){return toast(ex.message||"No se pudo guardar la configuración.");}}
    if(Cloud.on){try{await Cloud.rpc("save_business_profile",{p:state.business.profile});}catch(ex){toast(isMissingFn(ex)?"Guardé el resto, pero «Quién te atiende» necesita ejecutar supabase_v6_oferta_perfil.sql en Supabase.":(ex.message||"No se pudo guardar «Quién te atiende»."));}}
    saveState(); toast("Configuración guardada.");
  });

  $$("#builderModal input, #builderModal textarea").forEach(el=>el.addEventListener("input",renderBuilderPreview));

  // Performance-first: avoid intercepting the public URL until DOM is ready.
  const params=new URLSearchParams(location.search);
  const proposalId=params.get("p");
  if(PROPOSAL_MODE){ params.get("ref")?openReferralPage(params.get("ref")):params.get("r")?openReviewLink(params.get("r")):openPublicLink(proposalId); }
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
  return `<div class="voice-box" data-sec="mensaje">${avatarHtml()}<div><b>Un mensaje de ${escapeHtml(state.business.name)} para vos</b>${voicePlayerHtml(v)}<small data-vp-len>Audio corto, hasta 1 minuto</small></div></div>`;
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
  p.lastEvent=`Cliente aceptó la propuesta (${name}).`; referralWon(p);
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
  el.innerHTML=`${builderVoice&&!rec?voicePlayerHtml(builderVoice):""}
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
function ctaLabel(p,o){return "Quiero avanzar";}
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

/* ===== v31: reproductor de audio propio (duración visible, progreso animado y barra para adelantar) ===== */
/* Los audios grabados con MediaRecorder (webm) no traen la duración: el reproductor nativo la calcula al darle play,
   cargando todo el archivo, y por eso la barra no avanzaba. Acá la duración se resuelve antes (decodificando el audio)
   y se deja el archivo "adelantable" en segundo plano, así al tocar play arranca y avanza al ritmo real del audio. */
const vpFmt=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
const vpLong=s=>{s=Math.max(1,Math.round(s));if(s<60)return s+(s===1?" segundo":" segundos");const m=Math.floor(s/60),r=s%60;return m+(m===1?" minuto":" minutos")+(r?" "+r+" s":"");};
function voicePlayerHtml(src){
  return `<div class="vp is-loading" data-vp><audio preload="auto" src="${src}"></audio>
    <button type="button" class="vp-btn" aria-label="Reproducir mensaje de voz" disabled>
      <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/></svg>
    </button>
    <div class="vp-main">
      <div class="vp-bar" role="slider" tabindex="0" aria-label="Progreso del audio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="vp-fill"></i><b class="vp-knob"></b></div>
      <div class="vp-time"><span class="vp-cur">0:00</span><span class="vp-total">--:--</span></div>
    </div></div>`;
}
async function vpDecodeDuration(src){
  const Ctx=window.OfflineAudioContext||window.webkitOfflineAudioContext; if(!Ctx) return 0;
  const buf=await (await fetch(src)).arrayBuffer();
  const ctx=new Ctx(1,1,44100);
  const ab=await new Promise((res,rej)=>{const r=ctx.decodeAudioData(buf,res,rej); if(r&&r.then) r.then(res,rej);});
  return ab.duration||0;
}
// Fuerza al navegador a calcular la duración real (y a permitir adelantar) sin que la persona tenga que esperar al darle play.
function vpFixDuration(a){
  return new Promise(res=>{
    if(isFinite(a.duration)&&a.duration>0) return res(a.duration);
    let done=false;
    const fin=d=>{if(done)return;done=true;clearTimeout(to);a.removeEventListener("durationchange",ch);a.removeEventListener("loadedmetadata",lm);try{a.currentTime=0;}catch{} res(d);};
    const ch=()=>{if(isFinite(a.duration)&&a.duration>0) fin(a.duration);};
    const lm=()=>{if(!isFinite(a.duration)){try{a.currentTime=1e101;}catch{}} else ch();};
    const to=setTimeout(()=>fin(0),4000);
    a.addEventListener("durationchange",ch); a.addEventListener("loadedmetadata",lm);
    if(a.readyState>=1) lm();
  });
}
function vpSetup(box){
  box.dataset.ready="1";
  const a=box.querySelector("audio"), btn=box.querySelector(".vp-btn"), bar=box.querySelector(".vp-bar"),
        fill=box.querySelector(".vp-fill"), knob=box.querySelector(".vp-knob"), cur=box.querySelector(".vp-cur"), tot=box.querySelector(".vp-total");
  let dur=0, raf=0, drag=false, lastTxt="0:00";
  const paint=()=>{
    const t=a.currentTime||0, r=dur?Math.min(1,t/dur):0, txt=vpFmt(t);
    fill.style.transform=`scaleX(${r})`; knob.style.left=(r*100)+"%";
    if(txt!==lastTxt){lastTxt=txt;cur.textContent=txt;}
    bar.setAttribute("aria-valuenow",Math.round(r*100)); bar.setAttribute("aria-valuetext",vpFmt(t)+" de "+vpFmt(dur));
  };
  const loop=()=>{paint(); raf=a.paused?0:requestAnimationFrame(loop);};
  const setDur=d=>{
    if(dur||!(d>0)||!isFinite(d)) return;
    dur=d; tot.textContent=vpFmt(d)+" min"; box.classList.remove("is-loading");
    const note=box.parentElement&&box.parentElement.querySelector("[data-vp-len]"); if(note) note.textContent="Dura "+vpLong(d)+".";
    paint();
  };
  // Duración: la del archivo si ya la trae; si no, se decodifica. En paralelo se deja el audio listo para adelantar.
  const ready=(async()=>{
    if(isFinite(a.duration)&&a.duration>0) setDur(a.duration);
    else vpDecodeDuration(a.currentSrc||a.src).then(setDur,()=>{});
    const d=await vpFixDuration(a); setDur(d);
  })();
  ready.finally(()=>{btn.disabled=false; box.classList.remove("is-loading"); if(!dur) tot.textContent="";});
  btn.addEventListener("click",()=>{
    if(!a.paused){a.pause();return;}
    document.querySelectorAll(".vp audio").forEach(x=>{if(x!==a) x.pause();});
    if(a.ended||(dur&&a.currentTime>=dur-.05)) a.currentTime=0;
    const p=a.play(); if(p&&p.catch) p.catch(()=>{});
  });
  a.addEventListener("play",()=>{box.classList.add("is-playing");btn.setAttribute("aria-label","Pausar mensaje de voz");cancelAnimationFrame(raf);loop();});
  a.addEventListener("pause",()=>{box.classList.remove("is-playing");btn.setAttribute("aria-label","Reproducir mensaje de voz");paint();});
  a.addEventListener("ended",()=>{box.classList.remove("is-playing");btn.setAttribute("aria-label","Reproducir mensaje de voz");try{a.currentTime=0;}catch{} paint();});
  a.addEventListener("seeked",paint);
  const seekTo=x=>{if(!dur) return; const rc=bar.getBoundingClientRect(); a.currentTime=Math.min(1,Math.max(0,(x-rc.left)/rc.width))*dur; paint();};
  bar.addEventListener("pointerdown",e=>{drag=true; try{bar.setPointerCapture(e.pointerId);}catch{} seekTo(e.clientX);});
  bar.addEventListener("pointermove",e=>{if(drag) seekTo(e.clientX);});
  ["pointerup","pointercancel"].forEach(ev=>bar.addEventListener(ev,()=>{drag=false;}));
  bar.addEventListener("keydown",e=>{
    if(!dur) return; let t=a.currentTime;
    if(e.key==="ArrowRight") t+=5; else if(e.key==="ArrowLeft") t-=5; else if(e.key==="Home") t=0; else if(e.key==="End") t=dur-.1; else return;
    e.preventDefault(); a.currentTime=Math.min(dur,Math.max(0,t)); paint();
  });
}
function initVoicePlayers(){document.querySelectorAll(".vp:not([data-ready])").forEach(vpSetup);}
(function(){
  let q=0;
  new MutationObserver(()=>{if(q) return; q=requestAnimationFrame(()=>{q=0; initVoicePlayers();});}).observe(document.body,{childList:true,subtree:true});
  initVoicePlayers();
})();

/* ===== v33: galería de fotos reutilizables ===== */
/* Toda foto que se sube a una opción se guarda sola en "Mi galería" (sin repetidas). Después se elige con un toque
   para usarla en otras opciones o presupuestos. Se guarda en este dispositivo y, con Supabase, también en la nube
   (tabla photo_library de supabase_galeria.sql); si esa tabla no existe, la galería sigue funcionando en el dispositivo. */
const GAL_MAX=()=>Cloud.on?60:24;
const galKey=()=>"cc_gallery_"+((typeof currentUser!=="undefined"&&currentUser&&currentUser.id)||"demo");
const photoHash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+"-"+s.length.toString(36);};
let _gal=null,_galFor="",_galNoCloud=false;
function galCloudFail(e){
  if(_galNoCloud) return; _galNoCloud=true;
  toast("Tu galería queda solo en este dispositivo: falta ejecutar supabase_galeria.sql en Supabase.");
}
function galLocal(){try{return JSON.parse(localStorage.getItem(galKey())||"[]").filter(x=>x&&x.h&&safeImg(x.src));}catch{return [];}}
function galStore(list){ // si el navegador se queda sin espacio, descarta las más viejas
  let l=list.slice(0,GAL_MAX());
  while(l.length){try{localStorage.setItem(galKey(),JSON.stringify(l));return l;}catch{l=l.slice(0,-1);}}
  try{localStorage.removeItem(galKey());}catch{}
  return l;
}
async function galCloudAdd(it){
  if(!Cloud.on||_galNoCloud) return;
  try{await Cloud.rpc("add_gallery_photo",{p_photo:it.src,p_hash:it.h});}catch(e){galCloudFail(e);}
}
async function galGet(force){
  if(_gal&&_galFor===galKey()&&!force) return _gal;
  _galFor=galKey(); _gal=galLocal();
  if(Cloud.on&&currentUser&&!_galNoCloud){
    try{
      const sb=await Auth.client();
      const {data,error}=await sb.from("photo_library").select("hash,photo,created_at").order("created_at",{ascending:false}).limit(GAL_MAX());
      if(error) throw error;
      const cloud=data.filter(r=>safeImg(r.photo)).map(r=>({h:r.hash,src:r.photo})), have=new Set(cloud.map(x=>x.h));
      const soloLocal=_gal.filter(x=>!have.has(x.h));
      _gal=galStore([...soloLocal,...cloud]);
      soloLocal.forEach(galCloudAdd); // las que estaban solo en este dispositivo se suben
    }catch(e){galCloudFail(e);}
  }
  return _gal;
}
async function galAdd(srcs){
  const l=await galGet(), added=[];
  for(const src of srcs||[]){
    if(!safeImg(src)) continue; const h=photoHash(src);
    if(l.some(x=>x.h===h)||added.some(x=>x.h===h)) continue;
    added.push({h,src});
  }
  if(!added.length) return;
  _gal=galStore([...added.reverse(),...l]);
  added.forEach(galCloudAdd);
}
async function galDelete(h){
  _gal=galStore((await galGet()).filter(x=>x.h!==h));
  if(Cloud.on&&!_galNoCloud){try{const sb=await Auth.client(); const {error}=await sb.from("photo_library").delete().eq("hash",h); if(error) throw error;}catch(e){galCloudFail(e);}}
}
function openGallery(idx){
  const o=builderOptions[idx]; if(!o) return;
  openGalleryCore({room:MAX_PHOTOS-photosOf(o).length,current:photosOf(o),full:`Esta opción ya tiene ${MAX_PHOTOS} fotos. Quitá una para agregar otra.`,
    onAdd:add=>{o.photos=[...photosOf(o),...add].slice(0,MAX_PHOTOS); o.photo=o.photos[0]||""; o._open=true; renderOptionEditors(); renderBuilderPreview();}});
}
function openGalleryCore({room,current,full,onAdd}){
  if(room<=0) return toast(full);
  const used=new Set(current.map(photoHash)), sel=[], opener=document.activeElement;
  const wrap=document.createElement("div");
  wrap.className="gal-modal"; wrap.setAttribute("role","dialog"); wrap.setAttribute("aria-modal","true"); wrap.setAttribute("aria-label","Mi galería de fotos");
  wrap.innerHTML=`<div class="gal-sheet">
    <header><h3>Mi galería</h3><button type="button" class="gal-close" data-gal-close aria-label="Cerrar">×</button></header>
    <p class="gal-hint">Tocá las fotos que quieras usar (hasta ${room}).</p>
    <div class="gal-grid"><p class="gal-empty">Cargando tus fotos…</p></div>
    <footer><button type="button" class="btn btn-secondary" data-gal-close>Cancelar</button><button type="button" class="btn btn-primary" data-gal-ok disabled>Agregar</button></footer></div>`;
  document.body.appendChild(wrap); document.body.classList.add("gal-open");
  const grid=wrap.querySelector(".gal-grid"), ok=wrap.querySelector("[data-gal-ok]");
  let list=[];
  const close=()=>{document.removeEventListener("keydown",onKey,true); wrap.remove(); document.body.classList.remove("gal-open"); if(opener&&opener.focus&&document.contains(opener)) try{opener.focus();}catch{}};
  const onKey=e=>{if(e.key==="Escape"){e.stopPropagation(); close();}};
  document.addEventListener("keydown",onKey,true);
  const paint=()=>{
    ok.disabled=!sel.length; ok.textContent=sel.length?`Agregar ${sel.length} ${sel.length===1?"foto":"fotos"}`:"Agregar";
    if(!list.length){grid.innerHTML='<p class="gal-empty">Todavía no hay fotos guardadas. Las que subas a una opción se guardan acá solas para que las reutilices.</p>'; return;}
    grid.innerHTML=list.map((x,i)=>{const u=used.has(x.h), s=sel.includes(x.h);
      return `<div class="gal-item${u?" is-used":""}${s?" is-sel":""}"><button type="button" class="gal-pick" data-h="${x.h}" aria-pressed="${s}" aria-label="Foto ${i+1}${u?" (ya está agregada)":""}"><img src="${x.src}" alt="" loading="lazy"></button><span class="gal-check" aria-hidden="true">✓</span>${u?'<span class="gal-tag">Ya está</span>':""}<button type="button" class="gal-del" data-del="${x.h}" aria-label="Borrar de mi galería">×</button></div>`;}).join("");
  };
  wrap.addEventListener("click",async e=>{
    if(e.target===wrap||e.target.closest("[data-gal-close]")) return close();
    const del=e.target.closest("[data-del]");
    if(del){
      if(!confirm("¿Borrar esta foto de tu galería? Las propuestas que ya la usan no se modifican.")) return;
      const h=del.dataset.del; await galDelete(h); list=list.filter(x=>x.h!==h); const k=sel.indexOf(h); if(k>=0) sel.splice(k,1); return paint();
    }
    const pick=e.target.closest("[data-h]");
    if(pick){
      const h=pick.dataset.h; if(used.has(h)) return toast("Esa foto ya está agregada.");
      const k=sel.indexOf(h);
      if(k>=0) sel.splice(k,1); else if(sel.length>=room) return toast(`Solo podés agregar ${room} ${room===1?"foto más":"fotos más"}.`); else sel.push(h);
      return paint();
    }
    if(e.target.closest("[data-gal-ok]")){
      const add=sel.map(h=>(list.find(x=>x.h===h)||{}).src).filter(Boolean);
      close(); onAdd(add); toast(add.length===1?"Foto agregada.":`${add.length} fotos agregadas.`);
    }
  });
  galGet().then(l=>{list=l.slice(); paint(); const f=grid.querySelector(".gal-pick:not(:disabled)")||wrap.querySelector("[data-gal-close]"); if(f&&f.focus) f.focus();}).catch(()=>{list=[]; paint();});
}
document.addEventListener("click",e=>{
  const b=e.target.closest&&e.target.closest("[data-gal-open]"); if(!b) return;
  const row=b.closest("[data-idx]"); if(row) openGallery(+row.dataset.idx);
});

/* ===== v34: mejorar oferta, «Quién te atiende» y fotos en Supabase Storage ===== */
const isMissingFn=e=>!!e&&(e.code==="PGRST202"||/could not find the function/i.test(e.message||""));

/* ---- Fotos en Storage (bucket público "fotos"): en la base queda solo el link, no la imagen ---- */
const _phData=new Map(); let _stFail=false;
function dataToBlob(d){const [h,b]=d.split(","),m=/data:([^;]+)/.exec(h)[1],bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:m});}
async function storePhoto(dataUrl){
  if(!(Cloud.on&&currentUser&&CFG.photoStorage!==false&&!_stFail)||!/^data:image\/jpeg;base64,/.test(dataUrl)) return dataUrl;
  try{
    const sb=await Auth.client(), path=`${currentUser.id}/${photoHash(dataUrl)}.jpg`;
    const {error}=await sb.storage.from("fotos").upload(path,dataToBlob(dataUrl),{contentType:"image/jpeg",upsert:true,cacheControl:"31536000"});
    if(error) throw error;
    const url=sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
    if(!safeImg(url)) throw new Error("URL de foto no válida");
    _phData.set(url,dataUrl); return url;
  }catch(e){
    if(!_stFail){_stFail=true; toast("Las fotos se guardan sin Storage: falta ejecutar supabase_storage_fotos.sql. La propuesta funciona igual.");}
    return dataUrl;
  }
}
// Si el SQL de fotos que ya tenías no acepta links, se reintenta con la imagen original (solo si sigue en memoria).
async function rpcPhotos(name,mk){
  try{return await Cloud.rpc(name,mk(x=>x));}
  catch(e){
    const a=mk(x=>_phData.get(x)||x);
    if(JSON.stringify(a)===JSON.stringify(mk(x=>x))) throw e;
    return await Cloud.rpc(name,a);
  }
}

/* ---- «Quién te atiende» ---- */
function profileOf(x){
  x=x&&typeof x==="object"?x:{}; const s=(v,n)=>String(v||"").trim().replace(/\s+/g," ").slice(0,n);
  return {trade:s(x.trade,60),area:s(x.area,60),years:Math.min(80,Math.max(0,parseInt(x.years,10)||0)),response:s(x.response,40),advisor:s(x.advisor,60),bio:String(x.bio||"").trim().slice(0,280),refOn:x.refOn===true||x.refOn==="true",refGive:s(x.refGive,140),refGet:s(x.refGet,140),
    portfolio:(Array.isArray(x.portfolio)?x.portfolio:[]).map(safeImg).filter(Boolean).slice(0,8)};
}
const profileEmpty=f=>!(f.trade||f.area||f.years||f.response||f.bio||f.portfolio.length);
const yearsText=n=>n===1?"1 año de experiencia":`${n} años de experiencia`;
function whoChip(){
  const f=profileOf(state.business&&state.business.profile), bits=[f.trade,f.area,f.years?yearsText(f.years):""].filter(Boolean);
  return bits.length?`<div class="who-chip">${bits.map(escapeHtml).join(" · ")}</div>`:"";
}
function whoMarkup(){
  const f=profileOf(state.business&&state.business.profile); if(profileEmpty(f)) return "";
  const e=escapeHtml, b=state.business;
  const facts=[f.trade?`🧰 ${e(f.trade)}`:"",f.area?`📍 ${e(f.area)}`:"",f.years?`⭐ ${e(yearsText(f.years))}`:"",f.response?`💬 Responde ${e(f.response.toLowerCase())}`:""].filter(Boolean);
  return `<section class="who" data-sec="quien"><h4>Quién te atiende</h4>
    <div class="who-top">${avatarHtml()}<div><b>${e(b.name||"")}</b>${facts.length?`<ul class="who-facts">${facts.map(x=>`<li>${x}</li>`).join("")}</ul>`:""}</div></div>
    ${f.bio?`<p class="who-bio">${e(f.bio)}</p>`:""}
    ${f.portfolio.length?`<div class="who-work"><h5>Trabajos realizados</h5><div class="who-row" tabindex="0" role="group" aria-label="Trabajos realizados">${f.portfolio.map((s,i)=>`<img src="${s}" alt="Trabajo realizado ${i+1} de ${f.portfolio.length}" loading="lazy" decoding="async" tabindex="0" role="button">`).join("")}</div></div>`:""}
  </section>`;
}
function fillProfile(){
  const f=$("#settingsForm"); if(!f||!f.elements.profTrade) return;
  const p=profileOf(state.business&&state.business.profile); state.business.profile=p;
  f.elements.profTrade.value=p.trade; f.elements.profArea.value=p.area; f.elements.profYears.value=p.years||"";
  f.elements.profResponse.value=p.response; f.elements.profBio.value=p.bio; if(f.elements.profAdvisor) f.elements.profAdvisor.value=p.advisor;
  if(f.elements.refOn){f.elements.refOn.checked=p.refOn; f.elements.refGive.value=p.refGive; f.elements.refGet.value=p.refGet;}
  renderPortfolio();
}
function readProfile(){
  const f=$("#settingsForm").elements, cur=profileOf(state.business.profile);
  return profileOf({trade:f.profTrade.value,area:f.profArea.value,years:f.profYears.value,response:f.profResponse.value,advisor:f.profAdvisor?f.profAdvisor.value:"",bio:f.profBio.value,refOn:!!(f.refOn&&f.refOn.checked),refGive:f.refGive?f.refGive.value:"",refGet:f.refGet?f.refGet.value:"",portfolio:cur.portfolio});
}
function renderPortfolio(){
  const box=$("#portfolioGrid"); if(!box) return; const l=profileOf(state.business.profile).portfolio;
  box.innerHTML=l.map((s,i)=>`<figure><img src="${s}" alt="Trabajo ${i+1}"><button type="button" class="photo-x" data-pf-del="${i}" aria-label="Quitar trabajo ${i+1}">×</button></figure>`).join("");
  const c=$("#portfolioCount"); if(c) c.textContent=`${l.length}/8`;
  const inp=$("#portfolioInput"), gb=$("#portfolioGalBtn"); if(inp) inp.disabled=l.length>=8; if(gb) gb.disabled=l.length>=8;
}
document.addEventListener("change",async e=>{
  const t=e.target; if(!t||t.id!=="portfolioInput"||!t.files||!t.files.length) return;
  const prof=profileOf(state.business.profile), files=[...t.files].filter(f=>f.type.startsWith("image/")).slice(0,8-prof.portfolio.length);
  t.value=""; if(!files.length) return;
  if(Cloud.on) toast("Subiendo fotos…");
  try{
    const add=[]; for(const f of files) add.push(await storePhoto(await resizePhoto(f)));
    state.business.profile={...prof,portfolio:[...prof.portfolio,...add].slice(0,8)}; galAdd(add).catch(()=>{}); renderPortfolio();
    toast("Fotos listas. Tocá «Guardar configuración» para publicarlas.");
  }catch(err){toast(err.message||"No se pudo leer la imagen.");}
});
document.addEventListener("click",e=>{
  const T=e.target&&e.target.closest?e.target:null; if(!T) return;
  const del=T.closest("[data-pf-del]");
  if(del){const prof=profileOf(state.business.profile); prof.portfolio.splice(+del.dataset.pfDel,1); state.business.profile=prof; renderPortfolio(); return;}
  if(T.closest("#portfolioGalBtn")){
    const prof=profileOf(state.business.profile);
    openGalleryCore({room:8-prof.portfolio.length,current:prof.portfolio,full:"Ya cargaste 8 trabajos. Quitá uno para agregar otro.",
      onAdd:add=>{const c=profileOf(state.business.profile); state.business.profile={...c,portfolio:[...c.portfolio,...add].slice(0,8)}; renderPortfolio();}});
    return;
  }
  const imp=T.closest("[data-improve]"); if(imp) openImprove(imp.dataset.improve);
});

/* ---- Mejorar oferta: cambia la propuesta enviada sin crear otro link ---- */
function applyOfferUpdate(p){
  const u=p&&p.offerUpdate; if(!u||typeof u!=="object") return p;
  if(u.bonusText){p.bonusText=u.bonusText; if(u.bonusUntil){const t=new Date(u.bonusUntil).getTime(); if(t) p.bonusDeadlineMs=t;}}
  return p;
}
function offerBannerMarkup(p){
  const u=p&&p.offerUpdate; if(!u||!Array.isArray(u.summary)||!u.summary.length||["accepted","lost","expired"].includes(p.status)) return "";
  const at=new Date(u.at).getTime(); if(!at||Date.now()-at>14*864e5) return "";
  const e=escapeHtml, h=Math.floor((Date.now()-at)/36e5), when=h<1?"hace un momento":h<24?`hace ${h} h`:`hace ${Math.floor(h/24)} d`;
  return `<div class="offer-update" role="status"><div class="ou-head"><b>🔄 Actualizamos tu propuesta</b><small>${when}</small></div><ul>${u.summary.map(s=>`<li>${e(s)}</li>`).join("")}</ul>${u.note?`<p class="ou-note">💬 ${e(u.note)}</p>`:""}</div>`;
}
async function openImprove(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  if(!["sent","viewed","expired"].includes(p.status)) return toast("Esa propuesta ya está cerrada.");
  const e=escapeHtml, o=chosenOf(p), dep=Number(p.depositPct)||0, expired=p.status==="expired", canDep=dep>1;
  const base=daysLeft(p)>=0?p.expiresAt:isoDate(Date.now()), who=fullName(p.client.name)||"este cliente";
  openTool(`<form id="improveForm" class="improve" novalidate>
    <h3>✨ Mejorar oferta</h3>
    <p class="imp-lead">Para ${e(who)}. Se actualiza <b>el mismo link</b>: no perdés el seguimiento y el cliente ve “Actualizamos tu propuesta”.</p>
    <div class="imp-row"><input type="checkbox" id="impExt" aria-label="Extender la vigencia" ${expired?"checked":""}><div class="imp-txt"><b>Extender la vigencia</b><small>${expired?"Venció":"Vence"} el ${e(fmtDate(p.expiresAt))}</small></div><div class="imp-ctl"><select id="impExtDays" aria-label="Días a extender"><option value="2">+ 2 días (48 h)</option><option value="3">+ 3 días</option><option value="7">+ 7 días</option></select></div></div>
    <div class="imp-row"><input type="checkbox" id="impDep" aria-label="Bajar la seña" ${canDep?"":"disabled"}><div class="imp-txt"><b>Bajar la seña</b><small>${dep>0?`Hoy pedís el ${dep}% (${money(depositOf(p,o))})`:"No pedís seña"}</small></div><div class="imp-ctl"><input type="number" id="impDepVal" min="1" max="${Math.max(1,Math.ceil(dep)-1)}" value="${Math.max(1,Math.floor(dep/2))}" inputmode="numeric" aria-label="Nueva seña en porcentaje" ${canDep?"":"disabled"}> %</div></div>
    <div class="imp-row"><input type="checkbox" id="impInst" aria-label="Sumar cuotas"><div class="imp-txt"><b>Sumar cuotas</b><small>Se aplica a todas las opciones</small></div><div class="imp-ctl"><select id="impInstVal" aria-label="Cantidad de cuotas"><option>3</option><option>6</option><option>12</option></select></div></div>
    <div class="imp-row"><input type="checkbox" id="impBon" aria-label="Agregar un bonus"><div class="imp-txt"><b>Bonus por decidir a tiempo</b><small>Solo si lo vas a cumplir</small></div><div class="imp-ctl col"><input id="impBonTxt" maxlength="140" placeholder="Ej: Instalación gratis" aria-label="Qué incluye el bonus"><select id="impBonHrs" aria-label="Duración del bonus"><option value="24">Vale 24 h</option><option value="48" selected>Vale 48 h</option><option value="72">Vale 72 h</option></select></div></div>
    <label class="imp-note">Mensaje para el cliente (opcional)<textarea id="impNote" maxlength="300" rows="2" placeholder="Ej: Te armé esto para que te quede más cómodo."></textarea></label>
    <p class="imp-err" id="impErr" role="alert" hidden></p>
    <div class="form-actions"><button type="submit" class="btn btn-primary" id="impGo">Aplicar mejoras</button></div>
  </form>`);
  const form=$("#improveForm"), err=$("#impErr");
  const fail=m=>{err.textContent=m; err.hidden=false; return false;};
  const mark=ev=>{const row=ev.target.closest(".imp-row"); if(!row) return; const cb=row.querySelector('input[type=checkbox]'); if(cb&&ev.target!==cb&&!cb.disabled) cb.checked=true;};
  form.addEventListener("input",mark); form.addEventListener("change",mark);
  form.addEventListener("submit",async ev=>{
    ev.preventDefault(); err.hidden=true;
    const ch={};
    if($("#impExt").checked) ch.extendDays=+$("#impExtDays").value;
    if(canDep&&$("#impDep").checked){const v=Number($("#impDepVal").value); if(!(v>=1&&v<dep)) return fail(`La nueva seña tiene que ser menor al ${dep}%.`); ch.depositPct=v;}
    if($("#impInst").checked) ch.installments=+$("#impInstVal").value;
    if($("#impBon").checked){const t=$("#impBonTxt").value.trim(); if(!t) return fail("Escribí cuál es el bonus."); ch.bonusText=t.slice(0,140); ch.bonusHours=+$("#impBonHrs").value;}
    if(!Object.keys(ch).length) return fail("Elegí al menos una mejora.");
    if(expired&&!ch.extendDays) return fail("La propuesta venció: extendé la vigencia para reabrirla.");
    const newExp=ch.extendDays?addDays(base,ch.extendDays):null, until=ch.bonusText?Date.now()+ch.bonusHours*36e5:0, note=$("#impNote").value.trim().slice(0,300);
    const summary=[];
    if(newExp) summary.push(`Vigente hasta el ${fmtDate(newExp)}`);
    if(ch.depositPct!=null) summary.push(`Seña reducida al ${ch.depositPct}%${p.options.length===1?` (${money(Math.round(finalPrice(o)*ch.depositPct/100))})`:""}`);
    if(ch.installments) summary.push(`Hasta ${ch.installments} cuotas`);
    if(ch.bonusText) summary.push(`🎁 Bonus: ${ch.bonusText} (hasta ${dayWord(until)})`);
    const btn=$("#impGo"); btn.disabled=true;
    if(Cloud.on){
      try{await Cloud.rpc("improve_offer",{p_id:id,p:{...ch,summary,note}}); await Cloud.hydrate();}
      catch(ex){btn.disabled=false; return fail(isMissingFn(ex)?"Falta ejecutar supabase_v6_oferta_perfil.sql en Supabase.":(ex.message||"No se pudo aplicar la mejora."));}
    }else try{
      if(newExp){p.expiresAt=newExp; if(p.status==="expired") p.status=p.views>0?"viewed":"sent";}
      if(ch.depositPct!=null) p.depositPct=ch.depositPct;
      if(ch.installments) p.options.forEach(op=>{if(!op.hasInstallments||op.installments<ch.installments){op.hasInstallments=true; op.installments=ch.installments;}});
      let bText=ch.bonusText||"", bUntil=until;
      const prev=p.offerUpdate;
      if(!bText&&prev&&prev.bonusText&&new Date(prev.bonusUntil).getTime()>Date.now()){bText=prev.bonusText; bUntil=new Date(prev.bonusUntil).getTime();}
      if(bText){p.bonusText=bText; p.bonusHours=ch.bonusHours||p.bonusHours||48; p.bonusDeadlineMs=bUntil;}
      p.offerUpdate={at:new Date().toISOString(),summary,note,bonusText:bText,bonusUntil:bText?new Date(bUntil).toISOString():null};
      p.lastEvent="Oferta mejorada."; state.activity.unshift({icon:"✨",text:`Mejoraste la oferta de ${p.client.name}.`,time:"Ahora"});
      saveState(); renderDashboard();
    }catch(ex){btn.disabled=false; return fail(ex.message||"No se pudo aplicar la mejora.");}
    const msg=`${hello(firstName(p.client.name))} 👋 Mejoré tu propuesta de "${p.title}":\n${summary.map(s=>"• "+s).join("\n")}\n${note?note+"\n":""}Mirala acá 👇\n${shareLink(p)}`;
    $("#toolContent").innerHTML=`<div class="improve-done"><h3>✅ Oferta mejorada</h3><p>El cliente la ve actualizada en el mismo link, con el aviso “Actualizamos tu propuesta”.</p><ul>${summary.map(s=>`<li>${e(s)}</li>`).join("")}</ul>
      <div class="form-actions"><a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(msg)}">💬 Avisarle por WhatsApp</a><button type="button" class="btn btn-secondary" id="impDone">Cerrar</button></div></div>`;
    $("#impDone").addEventListener("click",()=>closeModal("toolModal"));
    toast("Oferta mejorada.");
  });
}

/* ===== v35: la foto de perfil no se ofrece para guardar ===== */
/* Es una disuasión, no un candado: lo que el navegador muestra siempre se puede capturar (captura de pantalla, herramientas de desarrollo). */
document.addEventListener("contextmenu",e=>{if(e.target.closest&&e.target.closest(".avatar.has-photo")) e.preventDefault();});
document.addEventListener("dragstart",e=>{if(e.target.closest&&e.target.closest(".avatar.has-photo")) e.preventDefault();});

/* ===== v36: reseñas completas, trabajos realizados y sello de seguridad en el enlace de opinión ===== */
const trustFields=t=>({
  reviews:Array.isArray(t.reviews)?t.reviews:[],
  rating:t.rating&&typeof t.rating==="object"?t.rating:{avg:0,count:0},
  ratingDist:t.dist&&typeof t.dist==="object"?t.dist:null,
  ...(t.profile&&typeof t.profile==="object"?{profile:profileOf(t.profile)}:{})
});
const reviewSafeMarkup=()=>`<section class="rv-safe" role="note" aria-labelledby="rvSafeT">
  <h4 id="rvSafeT">🔒 ¿Es seguro opinar acá?</h4>
  <p class="rv-safe-lead"><b>¡Sí!</b> Tu opinión es personal y está vinculada a un enlace único, habilitado exclusivamente para un cliente registrado.</p>
  <ul class="rv-safe-list">
    <li><span aria-hidden="true">✅</span><div><b>Acceso individual:</b> el enlace está destinado a una sola opinión por cliente.</div></li>
    <li><span aria-hidden="true">🔐</span><div><b>Privacidad y transparencia:</b> tu opinión se publica con tu nombre, para que otros puedan conocer tu experiencia real.</div></li>
    <li><span aria-hidden="true">🤝</span><div><b>Tu confianza es importante:</b> buscamos que cada opinión sea auténtica y que ayude a otras personas a tomar decisiones con mayor seguridad.</div></li>
  </ul>
  <p class="rv-safe-thanks">Tu experiencia cuenta. ¡Gracias por compartirla!</p>
</section>`;
function openLightbox(src,alt){
  if(!safeImg(src)) return;
  const wrap=document.createElement("div"), prev=document.activeElement;
  wrap.className="lb"; wrap.setAttribute("role","dialog"); wrap.setAttribute("aria-modal","true"); wrap.setAttribute("aria-label",alt||"Trabajo realizado");
  wrap.innerHTML=`<button type="button" class="lb-x" aria-label="Cerrar">×</button><img src="${src}" alt="${escapeHtml(alt||"")}">`;
  document.body.appendChild(wrap);
  const onKey=ev=>{if(ev.key==="Escape"){ev.stopPropagation(); close();}};
  const close=()=>{document.removeEventListener("keydown",onKey,true); wrap.remove(); if(prev&&prev.focus&&document.contains(prev)) try{prev.focus();}catch(e){}};
  document.addEventListener("keydown",onKey,true); wrap.addEventListener("click",close); wrap.querySelector(".lb-x").focus();
}
document.addEventListener("click",e=>{const im=e.target.closest&&e.target.closest(".who-row img"); if(im) openLightbox(im.getAttribute("src"),im.getAttribute("alt"));});
document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ") return; const im=e.target.closest&&e.target.closest(".who-row img"); if(im){e.preventDefault(); openLightbox(im.getAttribute("src"),im.getAttribute("alt"));}});

/* ===== v38: sistema de referidos ===== */
/* Cliente que compró → recibe su link personal → su amigo ve tus trabajos y opiniones y te escribe → vos lo seguís en «Referidos»
   → si compra, queda como cerrado y con recompensa pendiente para quien recomendó. */
var builderReferral=null, _refs=null, _refErr="";
const REF_STATUS={new:"Nuevo",contacted:"Contactado",proposal:"Propuesta enviada",won:"Cerrado ✔",lost:"No avanzó"};
const refCfg=()=>{const f=profileOf(state.business&&state.business.profile); return {on:f.refOn,give:f.refGive,get:f.refGet};};
const refLink=code=>`${location.origin}${location.pathname.replace(/index\.html$/,"")}?ref=${code}`;
const isTableMissing=e=>!!e&&(e.code==="42P01"||e.code==="PGRST205"||/could not find the table|does not exist/i.test(e.message||""));

/* ---- código personal de cada cliente ---- */
function localRefCode(p){
  if(!p.refCode){
    const a=new Uint8Array(5);
    if(window.crypto&&crypto.getRandomValues) crypto.getRandomValues(a); else a.forEach((_,i)=>{a[i]=Math.floor(Math.random()*256);});
    p.refCode=Array.from(a,b=>b.toString(16).padStart(2,"0")).join(""); saveState();
  }
  return p.refCode;
}
async function getRefCode(p,owner){
  if(Cloud.on){
    try{return await Cloud.rpc(owner?"get_owner_referral_code":"get_proposal_referral_code",{p_id:p.id});}
    catch(e){throw isMissingFn(e)?new Error("Falta ejecutar supabase_v8_referidos.sql en Supabase."):e;}
  }
  return localRefCode(p);
}

/* ---- 1) Lo que ve el cliente que compró ---- */
function refCardMarkup(p){
  const c=refCfg(); if(!c.on||p.status!=="accepted") return "";
  const e=escapeHtml;
  return `<section class="ref-card" data-ref-card><h4>🎁 ¿Conocés a alguien que lo necesite?</h4>
    <p>Recomendanos y ayudás a otra persona a resolverlo con alguien de confianza.</p>
    ${c.give?`<div class="ref-reward"><b>Vos recibís</b><span>${e(c.give)}</span></div>`:""}
    ${c.get?`<div class="ref-reward alt"><b>Tu amigo recibe</b><span>${e(c.get)}</span></div>`:""}
    <div class="ref-actions"><a class="btn btn-primary" id="refShare" role="button" aria-disabled="true" target="_blank" rel="noopener">💬 Recomendar por WhatsApp</a><button type="button" class="btn btn-secondary" id="refCopy" disabled>Copiar mi link</button></div>
    <small>${c.give?"La recompensa se entrega cuando la persona que recomendás compra.":"Tu link es personal: así sabemos quién nos recomendó."}</small></section>`;
}
async function attachRefCard(p){
  const sh=$("#refShare"); if(!sh) return;
  try{
    const code=await getRefCode(p,false); if(!code) throw new Error("sin código");
    const link=refLink(code), c=refCfg(), biz=state.business.name||"este negocio";
    const msg=`Hola! Te recomiendo a ${biz}. Mirá sus trabajos y las opiniones de sus clientes, y pedí tu presupuesto 👇\n${link}${c.get?`\nBeneficio para vos: ${c.get}`:""}`;
    sh.href=`https://wa.me/?text=${encodeURIComponent(msg)}`; sh.removeAttribute("aria-disabled");
    const cp=$("#refCopy"); cp.disabled=false;
    cp.onclick=async()=>{try{await navigator.clipboard.writeText(link); toast("Link copiado.");}catch(err){window.prompt("Copiá tu link:",link);}};
  }catch(e){const card=$("[data-ref-card]"); if(card) card.remove();}
}

/* ---- 2) La página que ve el amigo (?ref=CODIGO) ---- */
function localRegisterReferral(code,name,phone,note,referrer){
  const l=(state.referrals=state.referrals||[]);
  if(l.some(r=>r.phone===phone&&Date.now()-r.at<30*864e5)) return;
  l.unshift({id:"r-"+Math.random().toString(36).slice(2,9),code,referrer:referrer||"",friend:name,phone,note,status:"new",reward:"none",proposalId:"",at:Date.now()});
  saveState();
}
async function openReferralPage(code){
  const card=$("#publicContent"), e=escapeHtml; let data=null, refFull="";
  try{
    if(Cloud.on) data=await Cloud.rpc("get_referral_page",{p_code:code});
    else{const p=(state.proposals||[]).find(x=>x.refCode===code); if(p){refFull=fullName(p.client.name); data={business:{},referrer:firstName(p.client.name)};}}
  }catch(err){}
  if(!data){card.innerHTML=`<div class="public-card"><div class="public-greeting">Este link no está disponible</div><p style="color:#64748b">Pedile a quien te lo pasó que te envíe uno nuevo.</p></div>`; return;}
  if(Cloud.on){const b=data.business||{}; state.business={...state.business,name:b.name||state.business.name,whatsapp:b.whatsapp||"",brandColor:b.brandColor||state.business.brandColor,photo:b.photo||"",...trustFields(data)};}
  const c=refCfg(), b=state.business, ref=data.referrer||"", biz=b.name||"este negocio";
  card.innerHTML=`<div class="public-card ref-page" style="--brand:${brandStyle()}">
    <div class="public-brand">${avatarHtml()}${e(biz.toUpperCase())}${ratingChip()}</div>${whoChip()}
    <div class="ref-hero"><span class="ref-badge">🤝 ${ref?`Recomendado por ${e(ref)}`:"Recomendado por un cliente"}</span>
      <h2>${ref?`${e(ref)} te recomendó a ${e(biz)}`:`Te recomendaron a ${e(biz)}`}</h2>
      <p>Mirá sus trabajos, leé las opiniones de sus clientes y pedí tu presupuesto sin compromiso.</p></div>
    ${c.get?`<div class="ref-reward alt"><b>🎁 Beneficio para vos</b><span>${e(c.get)}</span></div>`:""}
    ${whoMarkup()}
    <form class="ref-form" id="refForm" novalidate><h3>Pedí tu presupuesto</h3>
      <label>Tu nombre<input id="refName" autocomplete="name" maxlength="80" placeholder="Ej: María Gómez"></label>
      <label>Tu WhatsApp<input id="refPhone" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="Ej: 3511234567"></label>
      <label>¿Qué necesitás? <small>(opcional)</small><textarea id="refNote" rows="2" maxlength="300" placeholder="Contanos en una línea"></textarea></label>
      <p class="imp-err" id="refErr" role="alert" hidden></p>
      <button type="submit" class="btn btn-primary btn-block" id="refGo">Pedir mi presupuesto</button>
      <small class="ref-priv">Usamos tus datos solo para que ${e(biz)} te contacte. No se publican.</small></form>
    ${reviewsMarkup({list:true})}</div>`;
  $("#refForm").addEventListener("submit",async ev=>{
    ev.preventDefault();
    const name=$("#refName").value.trim(), phone=normalizePhone($("#refPhone").value), note=$("#refNote").value.trim().slice(0,300), err=$("#refErr"), btn=$("#refGo");
    const fail=m=>{err.textContent=m; err.hidden=false;};
    err.hidden=true;
    if(name.length<2) return fail("Escribí tu nombre.");
    if(phone.length<8||phone.length>15) return fail("Revisá tu número de WhatsApp (con código de área).");
    btn.disabled=true;
    try{if(Cloud.on) await Cloud.rpc("register_referral",{p_code:code,p_name:name,p_phone:phone,p_note:note}); else localRegisterReferral(code,name,phone,note,refFull);}
    catch(ex){btn.disabled=false; return fail(ex&&ex.message&&!/function|schema/i.test(ex.message)?ex.message:"No pudimos registrar tu consulta. Probá de nuevo en un rato.");}
    const msg=`Hola ${biz}! Soy ${name}. Me recomendó ${ref||"un cliente"} y me gustaría pedir un presupuesto${note?": "+note:"."}`;
    $("#refForm").innerHTML=`<div class="ref-done"><h3>✅ ¡Listo, ${e(firstName(name)||name)}!</h3><p>Registramos tu consulta: ${e(biz)} ya puede verla. Para recibir tu presupuesto más rápido, escribile por WhatsApp.</p><a class="btn btn-primary btn-block" target="_blank" rel="noopener" href="https://wa.me/${normalizePhone(b.whatsapp)}?text=${encodeURIComponent(msg)}">💬 Abrir WhatsApp</a></div>`;
  });
}

/* ---- 3) Panel «Referidos» del vendedor ---- */
async function loadReferrals(){
  if(!(Cloud.on&&currentUser)) return;
  try{
    const sb=await Auth.client();
    const {data,error}=await sb.from("referrals").select("id,code,referrer_name,friend_name,friend_phone,note,status,reward_status,proposal_id,created_at").order("created_at",{ascending:false}).limit(200);
    if(error) throw error;
    _refErr=""; _refs=data.map(r=>({id:r.id,code:r.code,referrer:r.referrer_name,friend:r.friend_name,phone:r.friend_phone,note:r.note,status:r.status,reward:r.reward_status,proposalId:r.proposal_id,at:new Date(r.created_at).getTime()}));
  }catch(e){_refErr=isTableMissing(e)?"missing":"error"; _refs=_refs||[];}
  renderReferrals();
}
const getRefs=()=>Cloud.on?(_refs||[]):(state.referrals||[]);
async function updateReferral(id,patch){
  const r=getRefs().find(x=>x.id===id); if(!r) return;
  Object.assign(r,patch);
  if(Cloud.on){
    try{
      const sb=await Auth.client(), row={updated_at:new Date().toISOString()};
      if(patch.status) row.status=patch.status; if(patch.reward) row.reward_status=patch.reward;
      const {error}=await sb.from("referrals").update(row).eq("id",id); if(error) throw error;
    }catch(ex){toast(ex.message||"No se pudo actualizar."); await loadReferrals(); return;}
  }else saveState();
  renderReferrals();
}
async function deleteReferral(id){
  if(!confirm("¿Eliminar este referido? No se puede deshacer.")) return;
  if(Cloud.on){
    try{const sb=await Auth.client(); const {error}=await sb.from("referrals").delete().eq("id",id); if(error) throw error; _refs=(_refs||[]).filter(x=>x.id!==id);}
    catch(ex){return toast(ex.message||"No se pudo eliminar.");}
  }else{state.referrals=(state.referrals||[]).filter(x=>x.id!==id); saveState();}
  renderReferrals();
}
function refRowMarkup(r){
  const e=escapeHtml, d=new Date(r.at).toLocaleDateString("es-AR",{day:"numeric",month:"short"});
  const opts=Object.entries(REF_STATUS).map(([k,v])=>`<option value="${k}"${k===r.status?" selected":""}>${v}</option>`).join("");
  return `<article class="ref-item" data-ref="${e(r.id)}">
    <div class="ri-main"><b>${e(r.friend)}</b><span>📱 ${e(r.phone)}</span>${r.note?`<p>“${e(r.note)}”</p>`:""}<small>${r.referrer?`Lo recomendó ${e(r.referrer)} · `:""}${d}</small></div>
    <div class="ri-side"><span class="ri-chip st-${e(r.status)}">${REF_STATUS[r.status]||e(r.status)}</span><select data-ref-status aria-label="Cambiar estado">${opts}</select></div>
    <div class="ri-actions"><button type="button" class="text-btn" data-ref-act="contact">💬 Escribirle</button><button type="button" class="text-btn" data-ref-act="proposal">📝 Crear propuesta</button>${r.status==="won"&&r.reward==="pending"?`<button type="button" class="text-btn gift" data-ref-act="give">🎁 Recompensa entregada</button>`:""}${r.reward==="given"?`<span class="ri-given">🎁 Recompensa entregada</span>`:""}<button type="button" class="text-btn danger" data-ref-act="del">Eliminar</button></div></article>`;
}
function renderReferrals(){
  const body=$("#refBody"); if(!body) return;
  const c=refCfg(), list=getRefs(), nNew=list.filter(r=>r.status==="new").length, badge=$("#refCount");
  if(badge) badge.textContent=nNew?String(nNew):"";
  if(Cloud.on&&_refErr==="missing"){body.innerHTML=`<div class="ref-banner warn"><b>Falta un paso en Supabase</b><span>Ejecutá <code>supabase_v8_referidos.sql</code> en el SQL Editor para activar los referidos.</span></div>`; return;}
  const won=list.filter(r=>r.status==="won").length, pend=list.filter(r=>r.reward==="pending").length, rate=list.length?Math.round(100*won/list.length):0;
  const off=!c.on?`<div class="ref-banner"><b>El programa está desactivado</b><span>Activalo y definí la recompensa en Configuración: tus clientes verán «Recomendanos» al aceptar.</span><button type="button" class="btn btn-secondary btn-sm" data-ref-settings>Configurar programa</button></div>`:"";
  const how=!list.length?`<ol class="ref-how"><li><b>Tu cliente compra</b><span>Al aceptar ve su link personal para recomendarte. También podés enviárselo con «🎁 Pedir recomendación» en Propuestas.</span></li><li><b>Su amigo te escribe</b><span>Entra, mira tus trabajos y opiniones, y deja su consulta. Aparece acá.</span></li><li><b>Cerrás y recompensás</b><span>Creás la propuesta desde acá y, cuando compra, queda cerrada con la recompensa pendiente.</span></li></ol>`:"";
  body.innerHTML=`${off}<div class="ref-stats"><div><strong>${list.length}</strong><span>Recomendaciones</span></div><div><strong>${won}</strong><span>Cerradas${list.length?` · ${rate}%`:""}</span></div><div><strong>${pend}</strong><span>Recompensas pendientes</span></div></div>${how}<div class="ref-list">${list.map(refRowMarkup).join("")}</div>`;
}

/* ---- acciones ---- */
function proposalFromReferral(id){
  const r=getRefs().find(x=>x.id===id); if(!r) return;
  openBuilder(); if(!$("#clientName")) return;
  builderReferral=id;
  const n=$("#clientName"), ph=$("#clientPhone"); n.value=r.friend; ph.value=r.phone;
  [n,ph].forEach(el=>el.dispatchEvent(new Event("input",{bubbles:true})));
  wizPrefilled(2); toast(`Propuesta para ${r.friend}: quedará vinculada a esta recomendación.`);
}
async function linkReferral(pid){
  const rid=builderReferral; if(!rid) return; builderReferral=null;
  if(Cloud.on){
    try{
      const sb=await Auth.client();
      await sb.from("proposals").update({referral_id:rid}).eq("id",pid);
      await sb.from("referrals").update({status:"proposal",proposal_id:pid,updated_at:new Date().toISOString()}).eq("id",rid).neq("status","won");
      await loadReferrals();
    }catch(e){}
  }else{
    const r=getRefs().find(x=>x.id===rid); if(r&&r.status!=="won"){r.status="proposal"; r.proposalId=pid;}
    const p=state.proposals.find(x=>x.id===pid); if(p) p.referralId=rid;
    saveState(); renderReferrals();
  }
}
function referralWon(p){ // modo local: el trigger de Supabase hace lo mismo en la nube
  if(Cloud.on||!p||!p.referralId) return;
  const r=(state.referrals||[]).find(x=>x.id===p.referralId);
  if(r){r.status="won"; if(r.reward==="none") r.reward="pending";}
}
async function askReferral(pid){
  const p=state.proposals.find(x=>x.id===pid); if(!p) return;
  if(!refCfg().on) return toast("Activá el programa de referidos en Configuración.");
  try{
    const code=await getRefCode(p,true); if(!code) throw new Error("No se pudo crear el link.");
    const c=refCfg(), link=refLink(code);
    const msg=`${hello(firstName(p.client.name))} 🙌 Gracias por confiar en ${state.business.name}. Si conocés a alguien que lo necesite, pasale este link: ${link}${c.give?`\nSi compra, vos recibís: ${c.give}.`:""}${c.get?`\nY tu amigo recibe: ${c.get}.`:""}`;
    window.open(`https://wa.me/${normalizePhone(p.client.phone)}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
  }catch(ex){toast(ex.message||"No se pudo preparar el mensaje.");}
}
document.addEventListener("click",e=>{
  const T=e.target&&e.target.closest?e.target:null; if(!T) return;
  const act=T.closest("[data-ref-act]");
  if(act){
    const id=(act.closest("[data-ref]")||{dataset:{}}).dataset.ref, r=getRefs().find(x=>x.id===id); if(!r) return;
    if(act.dataset.refAct==="contact"){
      const msg=`Hola ${firstName(r.friend)||r.friend}! Soy ${state.business.name}. Me contó ${firstName(r.referrer)||"un cliente"} que estás buscando ayuda con esto 🙌 Contame qué necesitás y te armo un presupuesto sin compromiso.`;
      window.open(`https://wa.me/${normalizePhone(r.phone)}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
      if(r.status==="new") updateReferral(id,{status:"contacted"});
    }
    else if(act.dataset.refAct==="proposal") proposalFromReferral(id);
    else if(act.dataset.refAct==="give") updateReferral(id,{reward:"given"});
    else if(act.dataset.refAct==="del") deleteReferral(id);
    return;
  }
  const ask=T.closest("[data-ref-ask]"); if(ask) return askReferral(ask.dataset.refAsk);
  if(T.closest("[data-ref-settings]")){showPanel("settings"); setTimeout(()=>{const f=$("#settingsForm"); if(f&&f.elements.refOn) f.elements.refOn.focus();},60);}
});
document.addEventListener("change",e=>{
  const s=e.target.closest&&e.target.closest("[data-ref-status]"); if(!s) return;
  const id=s.closest("[data-ref]").dataset.ref, r=getRefs().find(x=>x.id===id); if(!r) return;
  updateReferral(id,{status:s.value,...(s.value==="won"&&r.reward==="none"?{reward:"pending"}:{})});
});

/* ===== v40: Destrabar venta · diagnóstico asistido, recomendación, mensajes por tono y resultados ===== */
/* Principio: detectar → diagnosticar → recomendar → actuar → medir. Se distinguen hechos confirmados, señales observadas,
   hipótesis comerciales e información pendiente. Nada se envía solo, y abrir WhatsApp no cuenta como mensaje enviado. */
var builderAltOf=null, _dv=null; const _savingFollow=new Set();
const isMissing=e=>!!e&&(e.code==="PGRST202"||/could not find the function/i.test(e.message||""));
const whoAmI=()=>String((currentUser&&(currentUser.name||currentUser.email||currentUser.id))||"").slice(0,60);
const DIAGS={
  not_opened:{L:"A",icon:"📭",title:"Todavía no la abrió",desc:"No hay una apertura registrada."},
  opened_silent:{L:"B",icon:"👀",title:"La abrió, pero no respondió",desc:"Hay una apertura, sin respuesta explícita."},
  price:{L:"C",icon:"💸",title:"Le preocupa el precio o la entrega inicial",desc:"Objeción económica."},
  payment:{L:"D",icon:"💳",title:"Necesita otra forma de pago",desc:"Otro medio o distribución de los pagos."},
  doubts:{L:"E",icon:"🔎",title:"Tiene dudas sobre la oferta o las condiciones",desc:"Lo incluido, la garantía o el proceso."},
  comparing:{L:"F",icon:"⚖️",title:"Quiere comparar otra opción",desc:"Está evaluando alternativas."},
  later:{L:"G",icon:"⏳",title:"Prefiere decidir más adelante",desc:"Falta de timing."},
  accepted_pending:{L:"H",icon:"🧩",title:"Aceptó o quiere avanzar, pero falta un paso",desc:"Hay una etapa pendiente."},
  unknown:{L:"I",icon:"❔",title:"Todavía no sabemos qué lo frena",desc:"Falta información."}};
const LEGACY={includes:"doubts",unsure:"unknown",not_now:"later",no_response:"opened_silent",other:"unknown"};
const DIAG_SOURCES={client_declared:"Lo dijo el cliente",seller_confirmed:"Lo confirmé yo (llamada o chat)",seller_assumption:"Es una hipótesis mía",pending:"Pendiente de confirmar"};
const EV_LABEL={confirmed:"Hecho confirmado",observed:"Señal observada",hypothesis:"Hipótesis comercial",pending:"Información pendiente"};
const TONES={consultivo:"Cercano y consultivo",directo:"Breve y directo",persuasivo:"Persuasivo y respetuoso"};
const OUTCOMES=[["replied","Respondió"],["clarify","Necesita una aclaración"],["changes","Solicitó una modificación"],["payment_change","Quiere otra forma de pago"],["accepted","Aceptó la propuesta"],["deposit_pending","Reserva pendiente"],["deposit_confirmed","Reserva confirmada"],["sale_closed","Venta cerrada"],["declined","No desea continuar"],["later","Solicitó retomar más adelante"],["no_reply","Sin respuesta"],["other","Otro resultado"]];
const LEGACY_STAGE={client_replied:"replied",changes_requested:"changes",revised_sent:"changes",confirmed:"sale_closed",paused:"later"};
const OUTCOME_NEXT={replied:"Respondele cuanto antes y registrá qué pidió.",clarify:"Mandale la aclaración y, si hace falta, sumala a una versión nueva de la propuesta.",changes:"Preparar una alternativa: la original queda intacta.",payment_change:"Revisá las modalidades habilitadas; podés sumar cuotas o bajar la seña con «Mejorar oferta».",accepted:"Explicale cómo continúa y cómo se confirma la reserva.",deposit_pending:"Enviale las instrucciones de pago y verificá la acreditación antes de confirmar.",deposit_confirmed:"Coordiná la entrega o el inicio y pedí la opinión más adelante.",sale_closed:"Cerrá la oportunidad: pedí la opinión y, si corresponde, una recomendación.",declined:"Respetá su decisión: no insistas. Podés marcarla como perdida.",later:"Programá la fecha en la que pidió retomar.",no_reply:"Probá un mensaje breve o cambiá de canal; evitá insistir a diario.",other:"Anotá el contexto en el historial."};
const DOUBT_MAP={"Precio":"price","Forma de pago":"payment","Plazo o fecha":"doubts","Otra consulta":"unknown"};
const stageOf=p=>{const s=p.follow&&p.follow.stage; return LEGACY_STAGE[s]||s||"";};
const isDormant=p=>["sale_closed","declined"].includes(stageOf(p));

function getFollow(p){
  if(!p.follow||typeof p.follow!=="object") p.follow={};
  if(!Array.isArray(p.follow.history)) p.follow.history=[];
  return p.follow;
}
function logFollow(p,type,text){
  const f=getFollow(p); f.history.push({at:new Date().toISOString(),type,text:String(text).slice(0,240),by:whoAmI()});
  if(f.history.length>80) f.history=f.history.slice(-80);
}
async function saveFollow(p){
  const f=getFollow(p); f.updatedAt=new Date().toISOString();
  if(!Cloud.on){saveState(); return true;}
  if(_savingFollow.has(p.id)) return false;
  _savingFollow.add(p.id);
  try{
    const clean={}; Object.keys(f).filter(k=>k[0]!=="_").forEach(k=>{clean[k]=f[k];});
    await Cloud.rpc("save_proposal_follow",{p_id:p.id,p:clean}); f._unsaved=false; return true;
  }catch(e){
    f._unsaved=true;
    toast(isMissing(e)?"Falta ejecutar supabase_v10_diagnostico.sql: el seguimiento no se guardó en la nube.":"No se pudo guardar el seguimiento. Revisá tu conexión y tocá «Reintentar».");
    return false;
  }finally{_savingFollow.delete(p.id);}
}
function waPhone(raw){
  let d=String(raw||"").replace(/\D/g,""); if(d.startsWith("00")) d=d.slice(2);
  if(d.length===10) d="549"+d; else if(d.length===11&&d.startsWith("0")) d="549"+d.slice(1);
  return d.length>=10&&d.length<=15?d:"";
}

/* ---- respuestas del cliente («¿Qué te falta para decidir?») ---- */
const RESP_KINDS=[
  {id:"price",label:"El precio o la entrega inicial",diag:"price"},
  {id:"payment",label:"Necesito otra forma de pago",diag:"payment"},
  {id:"includes",label:"Tengo dudas sobre lo que incluye",diag:"doubts"},
  {id:"compare",label:"Quiero comparar otra opción",diag:"comparing"},
  {id:"advance",label:"Quiero avanzar con la propuesta",diag:"accepted_pending"},
  {id:"later",label:"Prefiero retomarlo más adelante",diag:"later"},
  {id:"other",label:"Otro motivo",diag:"unknown"}];
const respKind=k=>RESP_KINDS.find(r=>r.id===k)||RESP_KINDS[6];
var _resp={}, _respErr="";
const getResponses=p=>Cloud.on?(_resp[p.id]||[]):(Array.isArray(p.responses)?p.responses:[]);
const openResponses=p=>getResponses(p).filter(r=>!r.answeredAt).sort((a,b)=>new Date(b.at)-new Date(a.at));
const ASPECTS={precio_total:"el precio total",entrega_inicial:"la entrega inicial",cuotas:"el valor de las cuotas",otro:"otro aspecto del importe"};

/* ---- diagnóstico ---- */
function diagnose(p){
  const ev=[], add=(type,text)=>ev.push({type,text}), f=p.follow||{};
  const when=iso=>iso?relativeTime(typeof iso==="number"?new Date(iso).toISOString():iso):"";
  if((p.status==="accepted"&&p.depositPaidAt)||stageOf(p)==="sale_closed"){add("confirmed",p.depositPaidAt?"La seña está confirmada.":"Registraste la venta como cerrada."); return {id:"closed",closed:true,source:"observed",evidence:ev};}
  if(stageOf(p)==="declined"){add("confirmed","Registraste que el cliente no desea continuar."); return {id:"declined",declined:true,source:"observed",evidence:ev};}
  const dep=depositOf(p,chosenOf(p));
  if(p.status==="accepted"){
    add("confirmed",`El cliente aceptó la propuesta${p.acceptedAt?` (${when(p.acceptedAt)})`:""}.`);
    if(p.depositPct>0){ if(p.proofSentAt) add("observed",`Avisó que transfirió ${when(p.proofSentAt)}; falta que verifiques que se acreditó.`); else add("pending",`La seña de ${money(dep)} todavía no está confirmada.`);}
    else add("pending","No hay seña configurada: falta coordinar el pago y el inicio.");
    return {id:"accepted_pending",source:"observed",evidence:ev};
  }
  const r=openResponses(p)[0];
  if(r){
    const k=respKind(r.kind); add("confirmed",`El cliente respondió «${k.label}» ${when(r.at)}.`);
    if(r.aspect&&ASPECTS[r.aspect]) add("confirmed",`Indicó que le preocupa ${ASPECTS[r.aspect]}.`);
    if(r.detail) add("confirmed",`Escribió: “${String(r.detail).slice(0,200)}”.`);
    if(r.laterDate) add("confirmed",`Pidió retomarlo alrededor del ${fmtDate(r.laterDate)}.`);
    if(r.kind==="advance") add("observed","Todavía no aceptó la propuesta en el link.");
    return {id:k.diag,source:"client_declared",evidence:ev,response:r};
  }
  if(p.lastDoubt&&DOUBT_MAP[p.lastDoubt]){add("confirmed",`El cliente tocó «${p.lastDoubt}» en la propuesta.`); return {id:DOUBT_MAP[p.lastDoubt],source:"client_declared",evidence:ev};}
  if((p.views||0)>0){
    add("observed",`Abrió la propuesta ${p.views} ${p.views===1?"vez":"veces"}${p.lastViewedAt?` (última ${when(p.lastViewedAt)})`:""}.`);
    add("pending","No hay una respuesta explícita del cliente.");
    return {id:"opened_silent",source:"observed",evidence:ev};
  }
  add("observed","No hay una apertura registrada (las vistas previas de WhatsApp y los robots no cuentan).");
  if(p.createdAt) add("confirmed",`La propuesta se creó ${when(p.createdAt)}.`);
  return {id:"not_opened",source:"observed",evidence:ev};
}
function effectiveDiag(p){
  const auto=diagnose(p); if(auto.closed||auto.declined) return auto;
  const r=getFollow(p).reason;
  if(r&&r.id){const id=LEGACY[r.id]||r.id; if(DIAGS[id]) return {...auto,id,source:r.source||"seller_assumption",fromSeller:true,autoId:auto.id,note:r.note||""};}
  return {...auto,autoId:auto.id};
}
const isConf=eff=>["client_declared","seller_confirmed"].includes(eff.source);
function dvCtx(p){
  const o=chosenOf(p), cheap=[...p.options].sort((a,b)=>finalPrice(a)-finalPrice(b))[0];
  const insts=Math.max(0,...p.options.filter(x=>x.hasInstallments&&x.installments>1).map(x=>x.installments));
  const methods=(p.payments||[]).map(k=>PAY[k]).filter(Boolean);
  return {o,first:firstName(p.client.name)||"",total:money(finalPrice(o)),dep:depositOf(p,o),insts,methods,
    cheaper:p.options.length>1&&cheap&&cheap.id!==o.id&&finalPrice(cheap)<finalPrice(o)?cheap:null,fu:p.followUps||0};
}
function explainDiag(p,eff){
  const c=dvCtx(p), conf=isConf(eff), id=eff.id;
  const hyp={
    not_opened:"Puede que el link no le haya llegado o que todavía no tuvo tiempo de abrirlo.",
    opened_silent:"Puede que no haya tenido tiempo o que tenga una duda que no expresó. No hay datos para asumir que es el precio.",
    price:conf?"El importe o la entrega inicial le resultan un obstáculo.":"Podría ser el importe o la entrega inicial, pero todavía no lo confirmó.",
    payment:conf?"Necesita otro medio o una distribución distinta de los pagos.":"Podría necesitar otra forma de pago, pero no lo dijo.",
    doubts:conf?"Necesita aclaraciones sobre lo incluido, las condiciones o el proceso.":"Podría tener dudas sobre lo incluido o las condiciones, pero no las expresó.",
    comparing:"Está evaluando otras alternativas antes de decidir.",
    later:"Por ahora no es el momento: respetar su tiempo cuida la relación.",
    accepted_pending:p.status==="accepted"?"Aceptó, pero la reserva no está completa hasta que se verifique la seña.":"Quiere avanzar, pero todavía no completó la aceptación en el link.",
    unknown:"No hay información suficiente para saber qué lo frena."};
  const miss={
    not_opened:"Si el link llegó y si lo pudo abrir.",opened_silent:"Qué le falta para decidir (información, tiempo o presupuesto).",
    price:"Qué parte del importe le pesa y qué alternativa real le serviría.",payment:"Qué modalidad necesita exactamente.",
    doubts:"Cuál es la duda concreta.",comparing:"Con qué compara y qué criterio prioriza.",later:"En qué fecha conviene retomar.",
    accepted_pending:p.proofSentAt?"Si la transferencia está acreditada en tu cuenta.":"Si recibió los datos para pagar y cuándo piensa hacerlo.",unknown:"Qué necesita para decidir."};
  const why={
    not_opened:"Antes de insistir conviene confirmar que el cliente puede ver la propuesta.",opened_silent:"Una pregunta corta y abierta invita a responder sin presión.",
    price:"Revisar el alcance protege tu margen y le da una salida real, sin regalar precio.",payment:"Resolver el cómo pagar suele destrabar más que insistir en el precio.",
    doubts:"Una duda sin responder frena más que cualquier precio.",comparing:"Comparar con criterios ayuda a decidir con confianza.",
    later:"Respetar su timing y dejar fecha acordada evita perder la oportunidad.",accepted_pending:"Completar el paso que falta es lo que convierte la aceptación en reserva.",unknown:"Una pregunta abierta es la forma más segura de descubrir qué falta."};
  const goal={
    not_opened:"Confirmar que recibió el link.",opened_silent:"Obtener una respuesta o una duda concreta.",price:"Encontrar una alternativa viable o confirmar que no hay margen.",
    payment:"Acordar una modalidad de pago habilitada.",doubts:"Despejar la duda y volver a la decisión.",comparing:"Que el cliente entienda las diferencias y elija.",
    later:"Dejar una fecha de seguimiento acordada.",accepted_pending:"Completar la reserva.",unknown:"Identificar qué lo frena."};
  return {maybe:hyp[id],missing:miss[id],why:why[id],goal:goal[id]};
}
function recoActions(p,eff){
  const c=dvCtx(p);
  switch(eff.id){
    case "not_opened":return {p:{k:"msg",l:"Comprobar que el link llegó"},a:{k:"schedule",l:"Programar reenviarlo mañana"}};
    case "opened_silent":return {p:{k:"msg",l:"Consultar si pudo revisarla"},a:{k:"schedule",l:"Programar un seguimiento"}};
    case "price":return c.cheaper?{p:{k:"msg",l:`Mostrarle la opción ${c.cheaper.name}`},a:{k:"alt",l:"Preparar una alternativa"}}:{p:{k:"alt",l:"Preparar una alternativa con otro alcance"},a:{k:"msg",l:"Preguntarle qué parte del importe evaluar"}};
    case "payment":return {p:{k:"msg",l:"Revisar las modalidades habilitadas"},a:{k:"improve",l:"Mejorar oferta (cuotas o seña)"}};
    case "doubts":return {p:{k:"msg",l:"Responder la duda"},a:{k:"schedule",l:"Ofrecer una llamada y programarla"}};
    case "comparing":return {p:{k:"msg",l:"Comparar las opciones con criterios"},a:{k:"alt",l:"Preparar otra alternativa"}};
    case "later":return {p:{k:"schedule",l:"Acordar la fecha de seguimiento"},a:{k:"msg",l:"Confirmarle por WhatsApp"}};
    case "accepted_pending":return p.status==="accepted"&&p.proofSentAt&&!p.depositPaidAt?{p:{k:"paid",l:"Verificar la transferencia y confirmar la seña"},a:{k:"msg",l:"Escribirle"}}
      :{p:{k:"msg",l:p.status==="accepted"?"Enviarle cómo continúa":"Ayudarlo a completar la aceptación"},a:{k:"result",l:"Registrar el resultado"}};
    default:return {p:{k:"msg",l:"Hacer una pregunta abierta y breve"},a:{k:"schedule",l:"Programar un seguimiento"}};
  }
}

/* ---- estado comercial y siguiente paso ---- */
function stageInfo(p){
  if(p.status==="accepted") return {label:p.depositPaidAt?"Seña recibida":p.proofSentAt?"Avisó que transfirió":p.depositPct>0?"Aceptada · seña pendiente":"Aceptada"};
  if(p.status==="lost") return {label:"Perdida"};
  const row=OUTCOMES.find(x=>x[0]===stageOf(p));
  if(row) return {label:row[1],registered:true};
  if(p.status==="expired") return {label:"Vencida · sin respuesta"};
  return {label:p.status==="viewed"?"Vista · sin respuesta":"Sin respuesta"};
}
function nextStep(p){
  const f=p.follow||{}, now=Date.now(), today=isoDate(now);
  if(isDormant(p)) return null;
  if(p.status==="lost"){return p.recontactAt&&p.recontactAt<=now?{id:"retake",label:"Retomar la conversación",why:"Llegó la fecha que te propusiste para retomarla.",btn:"Retomar",act:"follow"}:null;}
  if(p.status==="accepted"){
    if(p.depositPaidAt) return {id:"close",label:"Cerrar la oportunidad",why:"La seña está cobrada: registrá el resultado y pedí la opinión.",btn:"Registrar resultado",act:"result"};
    if(p.depositPct>0) return p.proofSentAt?{id:"verify",label:"Reserva pendiente: verificá la transferencia",why:"Avisó que transfirió. Confirmá la seña cuando la veas en tu cuenta.",btn:"Confirmar seña",act:"paid"}
      :{id:"deposit",label:"Reserva pendiente: mandale cómo pagar",why:"Aceptó, pero todavía no hay seña.",btn:"Enviar instrucciones",act:"follow"};
    return {id:"accepted",label:"Explicale cómo continúa",why:"Aceptó la propuesta: confirmale los próximos pasos.",btn:"Escribirle",act:"follow"};
  }
  const r=openResponses(p)[0];
  if(r&&!(r.kind==="later"&&r.laterDate&&r.laterDate>today)) return {id:"response",label:"Responder lo que pidió el cliente",why:`Respondió: «${respKind(r.kind).label}».`,btn:"Destrabar venta",act:"unlock"};
  if(f.next&&f.next.date&&f.next.date<=today) return {id:"scheduled",label:"Seguimiento programado",why:f.next.note||"Llegó la fecha que programaste.",btn:"Destrabar venta",act:"unlock"};
  if(stageOf(p)==="changes") return {id:"alt",label:"Preparar la nueva versión",why:"El cliente pidió cambios.",btn:"Preparar alternativa",act:"alt"};
  if(p.status==="expired") return {id:"renew",label:"Renovar y retomar",why:"La propuesta venció.",btn:"Renovar",act:"renew"};
  if(p.doubts&&!p.lastFollowUpAt) return {id:"doubt",label:"Responder la duda",why:`El cliente consultó${p.lastDoubt?`: ${p.lastDoubt}`:""} y no recibió respuesta.`,btn:"Destrabar venta",act:"unlock"};
  const last=Math.max(new Date(p.lastViewedAt||p.createdAt).getTime()||0,p.lastFollowUpAt||0), h=(now-last)/36e5;
  if(h>=48) return {id:"followup",label:"Seguimiento prudente",why:`Pasaron ${Math.floor(h/24)} días sin novedades.`,btn:"Destrabar venta",act:"unlock"};
  return null;
}
const unlockBtn=p=>`<button type="button" class="unlock-btn" data-unlock="${escapeHtml(p.id)}">🔓 Destrabar venta</button>`;
function nextStepMarkup(p){
  const ns=nextStep(p), nr=openResponses(p).length;
  return `${nr?`<div class="resp-badge" title="El cliente respondió «¿Qué te falta para decidir?»">💬 ${nr===1?"Respuesta nueva":nr+" respuestas nuevas"}</div>`:""}${ns?`<div class="next-step"><button type="button" class="text-btn" data-next="${escapeHtml(p.id)}|${ns.act}" title="${escapeHtml(ns.why)}">➜ ${escapeHtml(ns.label)}</button></div>`:""}`;
}
function stageTag(p){const s=stageInfo(p); return s.registered?`<br><small class="stage-tag">Seguimiento: ${escapeHtml(s.label)}</small>`:"";}
function runNext(id,act){
  if(act==="unlock") return openDestrabar(id);
  if(act==="result") return openDestrabar(id,{open:"dvRes"});
  if(act==="alt") return prepareAlternative(id,"copy");
  if(act==="renew") return renewProposal(id);
  if(act==="follow") return followUp(id);
  if(act==="paid") return markPaid(id);
}
// Agenda «Hoy»: respuestas del cliente y seguimientos pedidos o programados; lo cerrado o rechazado no aparece.
function todayExtra(p){
  if(isDormant(p)) return "skip";
  const today=isoDate(Date.now()), f=p.follow||{};
  if(p.status==="lost"||(p.status==="accepted"&&p.depositPaidAt)) return null;
  const r=openResponses(p)[0];
  if(r&&!(r.kind==="later"&&r.laterDate&&r.laterDate>today)) return {p,reason:`💬 Respondió: «${escapeHtml(respKind(r.kind).label)}».`,prio:0};
  if(r&&r.kind==="later"&&r.laterDate&&r.laterDate<=today) return {p,reason:"📌 Pidió retomar hoy.",prio:0};
  if(f.next&&f.next.date&&f.next.date<=today) return {p,reason:`📌 Seguimiento programado${f.next.note?`: ${escapeHtml(f.next.note)}`:""}.`,prio:0};
  return null;
}

/* ---- mensajes de WhatsApp: 3 tonos, regenerables, solo con datos reales ---- */
function buildMsg(p,eff,tone,variant,link){
  const c=dvCtx(p), conf=isConf(eff), n=c.first, t=`“${p.title}”`, T=tone==="persuasivo"?"la propuesta":`la propuesta de ${t}`, v=variant%2;
  const open={
    consultivo:[n?`Hola, ${n}. ¿Cómo estás?`:"Hola. ¿Cómo estás?",n?`Hola, ${n}, ¿todo bien?`:"Hola, ¿todo bien?"],
    directo:[n?`Hola, ${n}.`:"Hola.",n?`Hola, ${n}:`:"Hola:"],
    persuasivo:[n?`Hola, ${n}. Te escribo por la propuesta de ${t}.`:`Hola. Te escribo por la propuesta de ${t}.`,n?`Hola, ${n}. Quería retomar la propuesta de ${t}.`:`Hola. Quería retomar la propuesta de ${t}.`]}[tone][v];
  const bits=[...(c.methods.length?[c.methods.join(", ")]:[]),...(c.insts>1?[`hasta ${c.insts} cuotas`]:[]),...(p.depositPct>0?[`seña de ${money(c.dep)}`]:[])];
  const pay=bits.length?`Hoy contempla: ${bits.join("; ")}.`:"Podemos repasar las modalidades que figuran en la propuesta.";
  const r=eff.response, detail=r&&r.detail?` Me contaste: “${String(r.detail).slice(0,140)}”.`:"";
  const aspect=r&&r.aspect&&ASPECTS[r.aspect]?` Me dijiste que te preocupa ${ASPECTS[r.aspect]}.`:"";
  const cheap=c.cheaper?` La propuesta incluye también la opción ${c.cheaper.name} (${money(finalPrice(c.cheaper))}).`:"";
  const dateTxt=r&&r.laterDate?` alrededor del ${fmtDate(r.laterDate)}`:"", vig=(p.status!=="expired"&&daysLeft(p)>=0)?` La propuesta está vigente hasta el ${fmtDate(p.expiresAt)}.`:"";
  const C={
    not_opened:{consultivo:`Quería asegurarme de que te haya llegado ${T}. Si no pudiste abrir el link o preferís que te la mande de otra forma, avisame.`,
      directo:`¿Te llegó ${T}? Si no se abrió el link, te la reenvío.`,
      persuasivo:"Quiero que puedas verla con tranquilidad. Si el link no te abrió o preferís otro formato, decime y te la envío de otra manera."},
    opened_silent:{consultivo:`Quería saber si pudiste revisar ${T}. ¿Hay algo que te gustaría aclarar o adaptar para que se ajuste mejor a lo que necesitás?`,
      directo:`¿Pudiste revisar ${T}? Si tenés alguna duda, decime.`,
      persuasivo:"Quiero ayudarte a decidir con tranquilidad. Contame qué te gustaría aclarar o ver distinto y lo resolvemos."},
    price:{consultivo:conf?`Entiendo que el importe es un punto importante.${aspect} Podemos revisar las alternativas disponibles y ver si hay alguna que se adapte mejor a tu presupuesto.${cheap} ¿Qué parte te gustaría que evaluemos?`
        :`Si el importe de ${c.total} no se ajusta a lo que tenías previsto, podemos evaluar una alternativa con un alcance diferente y mantener claras las condiciones.${cheap} ¿Te parece que la prepare?`,
      directo:conf?`¿Qué parte del importe te gustaría que revisemos?${cheap}`:"Si el importe no es lo que esperabas, puedo preparar una alternativa con otro alcance. ¿Te sirve?",
      persuasivo:conf?`Quiero que encontremos algo que te cierre. Revisemos juntos qué parte del importe pesa más y qué alcance podemos ajustar sin perder lo importante.${cheap}`
        :"Si el importe es lo que te frena, podemos ver una alternativa con otro alcance y condiciones claras. ¿Querés que te la prepare?"},
    payment:{consultivo:conf?`Entiendo que necesitás otra forma de pago. ${pay} ¿Qué modalidad te vendría mejor? La reviso y te cuento qué es posible.${detail}`:`Si te resulta más cómodo otra forma de pago, podemos repasarlas. ${pay} ¿Cuál te vendría mejor?`,
      directo:conf?`¿Qué forma de pago te vendría mejor? ${pay}`:`¿Preferís otra forma de pago? ${pay}`,
      persuasivo:conf?`Quiero que el pago no sea un obstáculo. ${pay} Contame qué modalidad te vendría bien y veo qué se puede hacer.`:`Quiero que pagar sea cómodo para vos. ${pay} ¿Querés que elijamos juntos la que mejor te quede?`},
    doubts:{consultivo:conf?`Quiero que tengas todo claro antes de decidir.${detail} ¿Qué parte de la propuesta te gustaría que te explique mejor?`:"Quiero que tengas todo claro antes de decidir. ¿Hay algo de lo que incluye, los plazos o las condiciones que te gustaría que te aclare?",
      directo:conf?`¿Qué parte querés que te aclare?${detail} Te respondo enseguida.`:"¿Te quedó alguna duda sobre lo que incluye o las condiciones?",
      persuasivo:"Prefiero que decidas con toda la información. Preguntame lo que necesites sobre lo que incluye, los plazos o las condiciones, y lo vemos juntos."},
    comparing:{consultivo:"Si te sirve, podemos comparar las opciones y revisar las diferencias para que elijas con más tranquilidad. ¿Qué es lo más importante para vos al momento de decidir?",
      directo:"¿Querés que comparemos las opciones? Decime qué es lo que más priorizás.",
      persuasivo:"Elegir bien lleva su tiempo. Si estás comparando alternativas, repasemos juntos qué incluye cada una y en qué se diferencian, así decidís con claridad."},
    later:{consultivo:conf?`Gracias por avisarme que preferís retomarlo más adelante. ¿Te escribo${dateTxt||" en una fecha que te quede cómoda"}?${vig}`:"Entiendo si no es el momento ideal. Si te parece, lo retomamos más adelante: ¿qué día te quedaría cómodo que te escriba?",
      directo:"¿Qué día te viene bien que retomemos la propuesta?",
      persuasivo:`Sin apuro. ¿Te parece que lo retomemos${dateTxt||" más adelante"}?${vig} Te escribo cuando me digas.`},
    unknown:{consultivo:`Quería saber cómo venís con ${T}. ¿Hay algo que te gustaría aclarar o cambiar para poder avanzar?`,
      directo:`¿Cómo venís con ${T}? ¿Te falta algo para decidir?`,
      persuasivo:"Me gustaría ayudarte a decidir con tranquilidad. ¿Qué es lo que más te falta saber para avanzar?"}};
  let core;
  if(eff.id==="accepted_pending"){
    const sub=p.status==="accepted"?(p.proofSentAt?"verify":p.depositPct>0?"deposit":"nodep"):"advance";
    core={verify:{consultivo:"Gracias por avisarme la transferencia. En cuanto la vea acreditada te confirmo la reserva.",directo:"Gracias por avisar. Cuando se acredite la transferencia te confirmo la reserva.",persuasivo:"Gracias por avisarme la transferencia. Apenas la vea acreditada te confirmo la reserva y coordinamos los próximos pasos."},
      deposit:{consultivo:`Gracias por avanzar con ${T}. Para dejarlo reservado falta la seña de ${money(c.dep)}. ¿Te paso los datos para pagarla o preferís otra forma?`,directo:`Para reservar falta la seña de ${money(c.dep)}. ¿Te paso los datos?`,persuasivo:`Ya casi está: el último paso es la seña de ${money(c.dep)}. Si querés, te paso ahora los datos y te explico cómo seguimos.`},
      nodep:{consultivo:`Gracias por aceptar ${T}. ¿Coordinamos cómo seguimos y cuándo te viene bien empezar?`,directo:"Gracias por aceptar. ¿Coordinamos cómo seguimos?",persuasivo:"Gracias por confiar. Coordinemos ahora los próximos pasos para que quede todo listo."},
      advance:{consultivo:`Me alegra que quieras avanzar con ${T}. Para dejarlo confirmado tenés que aceptar la propuesta desde el link (es un paso y no te cobra nada). Si preferís, te voy guiando por acá.`,directo:"Para avanzar, aceptá la propuesta desde el link (no te cobra nada). Si querés, te guío.",persuasivo:"¡Genial que quieras avanzar! Solo falta aceptar la propuesta desde el link; en ese paso no se cobra nada y yo te acompaño con el resto."}}[sub][tone];
  }else core=(C[eff.id]||C.unknown)[tone];
  let m=`${open} ${core}${v?" Quedo a disposición.":""}`;
  if(link) m+=`\n\n${shareLink(p)}`;
  return m;
}

/* ---- ventana «Destrabar venta» ---- */
const dvP=()=>_dv&&state.proposals.find(x=>x.id===_dv.id);
function openDestrabar(id,opts){
  const p=state.proposals.find(x=>x.id===id); if(!p) return toast("No encontré esa propuesta.");
  opts=opts||{}; const f=getFollow(p);
  _dv={id,tone:TONES[f.tone]?f.tone:"consultivo",variant:0,msg:"",edited:false,link:true};
  openTool(`<div class="dv" id="dvRoot" role="region" aria-label="Destrabar venta"></div>`);
  $("#toolModal").classList.add("wide");
  const root=$("#dvRoot");
  root.innerHTML=`<header class="dv-top"><div><span class="eyebrow">DESTRABAR VENTA</span><h3 id="dvTitle"></h3><p class="dv-sub" id="dvSub"></p></div><span class="dv-stage" id="dvStage"></span></header>
    <div id="dvWarn"></div>
    <section class="dv-sec" id="dvCtx" aria-label="Contexto de la oportunidad"></section>
    <section class="dv-sec" id="dvDiag" aria-labelledby="dvDiagH"></section>
    <section class="dv-sec" id="dvReco" aria-labelledby="dvRecoH"></section>
    <section class="dv-sec" id="dvMsgSec" aria-labelledby="dvMsgH"></section>
    <details class="dv-acc" id="dvAlt"><summary>🧩 Preparar una alternativa</summary><div class="dv-accbody" id="dvAltBody"></div></details>
    <details class="dv-acc" id="dvNext"><summary>📌 Programar seguimiento</summary><div class="dv-accbody" id="dvNextBody"></div></details>
    <details class="dv-acc" id="dvRes"><summary>🏁 Registrar resultado</summary><div class="dv-accbody" id="dvResBody"></div></details>
    <details class="dv-acc" id="dvHist"><summary>🕘 Historial y versiones</summary><div class="dv-accbody" id="dvHistBody"></div></details>`;
  dvBind(root); dvPaintAll();
  if(opts.open&&$("#"+opts.open)) $("#"+opts.open).open=true;
  const h=$("#dvTitle"); if(h){h.tabIndex=-1; try{h.focus({preventScroll:true});}catch(e){}}
}
function dvPaintAll(){dvPaintTop(); dvPaintCtx(); dvPaintDiag(); dvPaintReco(); dvPaintMsg(); dvPaintAlt(); dvPaintNext(); dvPaintRes(); dvPaintHist(); dvPaintWarn();}
function dvPaintTop(){
  const p=dvP(); if(!p) return;
  $("#dvTitle").textContent=`Presupuesto de ${fullName(p.client.name)||"cliente sin nombre"}`;
  $("#dvSub").textContent=p.title; $("#dvStage").textContent=stageInfo(p).label;
}
function dvPaintWarn(){
  const p=dvP(), box=$("#dvWarn"); if(!box||!p) return;
  box.innerHTML=getFollow(p)._unsaved?`<div class="dv-alert" role="alert">⚠️ Hay cambios sin guardar en la nube. <button type="button" class="text-btn" id="dvRetry">Reintentar</button></div>`:"";
}
function dvLastActivity(p){
  const f=getFollow(p), c=[[p.lastViewedAt,"El cliente abrió la propuesta"],[p.lastFollowUpAt,"Último seguimiento enviado"],[p.acceptedAt,"El cliente aceptó"]];
  const rs=getResponses(p).slice().sort((a,b)=>new Date(b.at)-new Date(a.at))[0]; if(rs) c.push([rs.at,`El cliente respondió «${respKind(rs.kind).label}»`]);
  const h=f.history[f.history.length-1]; if(h) c.push([h.at,h.text]);
  const best=c.map(([t,l])=>[t?new Date(t).getTime():0,l]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0])[0];
  return best?`${relativeTime(new Date(best[0]).toISOString())} · ${best[1]}`:"Sin actividad registrada";
}
function dvPaintCtx(){
  const p=dvP(); if(!p) return; const e=escapeHtml, o=chosenOf(p), multi=p.options.length>1;
  const sub=multi?(p.chosenOption?`Opción elegida: ${o.name}`:`Opción recomendada: ${o.name} (hay ${p.options.length} opciones)`):"";
  const hist=getFollow(p).history, acts=[]; if(p.followUps) acts.push(`${p.followUps} seguimiento${p.followUps>1?"s":""} registrado${p.followUps>1?"s":""} como enviado${p.followUps>1?"s":""}`);
  const cp=hist.filter(h=>h.type==="copied").length, wa=hist.filter(h=>h.type==="whatsapp").length;
  if(cp) acts.push(`${cp} mensaje${cp>1?"s":""} preparado${cp>1?"s":""} y copiado${cp>1?"s":""}`); if(wa) acts.push(`WhatsApp abierto ${wa} ${wa>1?"veces":"vez"}`);
  const ns=nextStep(p), rs=getResponses(p).slice().sort((a,b)=>new Date(b.at)-new Date(a.at));
  $("#dvCtx").innerHTML=`<dl class="dv-facts"><div><dt>Importe</dt><dd>${money(finalPrice(o))}</dd>${sub?`<small>${e(sub)}</small>`:""}</div>
    <div><dt>Estado</dt><dd>${e(stageInfo(p).label)}</dd></div><div><dt>Creada</dt><dd>${p.createdAt?relativeTime(p.createdAt):"—"}</dd></div>
    <div><dt>Última actividad</dt><dd class="dv-small">${e(dvLastActivity(p))}</dd></div></dl>
    <p class="dv-acts">${acts.length?`Acciones registradas: ${e(acts.join(" · "))}.`:"Todavía no registraste acciones sobre esta propuesta."}</p>
    <h5>Respuestas del cliente a «¿Qué te falta para decidir?»</h5>
    ${rs.length?`<ul class="dv-resps">${rs.map(r=>`<li class="${r.answeredAt?"done":""}"><div><b>${e(respKind(r.kind).label)}</b>${r.aspect&&ASPECTS[r.aspect]?` · ${e(ASPECTS[r.aspect])}`:""}${r.laterDate?` · retomar ${e(fmtDate(r.laterDate))}`:""}${r.detail?`<p>“${e(r.detail)}”</p>`:""}<small>${relativeTime(r.at)}${r.answeredAt?" · respondida":""}</small></div>${r.answeredAt?"":`<button type="button" class="text-btn" data-dv-ans="${e(r.id)}">Marcar como respondida</button>`}</li>`).join("")}</ul>`
      :`<p class="dv-hint">El cliente todavía no respondió esa pregunta en la propuesta. ${_respErr==="missing"&&Cloud.on?"(Falta ejecutar supabase_v10_diagnostico.sql para ver respuestas.)":""}</p>`}
    ${ns?`<div class="dv-next"><span>Siguiente paso recomendado:</span> <b>${e(ns.label)}</b><small>${e(ns.why)}</small></div>`:""}`;
}
function dvPaintDiag(){
  const p=dvP(), box=$("#dvDiag"); if(!p) return; const e=escapeHtml, eff=effectiveDiag(p), f=getFollow(p);
  if(eff.closed){box.innerHTML=`<h4 id="dvDiagH">Diagnóstico</h4><div class="dv-banner ok">✅ Esta venta figura como cerrada. No hay nada para destrabar; podés pedir la opinión o una recomendación.</div>`; return;}
  if(eff.declined){box.innerHTML=`<h4 id="dvDiagH">Diagnóstico</h4><div class="dv-banner warn">🛑 El cliente indicó que no desea continuar. Respetá su decisión: no se recomiendan más mensajes comerciales.<div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" data-dv-lost="${e(p.id)}">Marcar como perdida</button></div></div>`; return;}
  const d=DIAGS[eff.id], x=explainDiag(p,eff), srcTxt=eff.fromSeller?DIAG_SOURCES[eff.source]||"Hipótesis mía":(eff.source==="client_declared"?"Lo dijo el cliente":"Señal que registró CierraClick");
  const evs=[...eff.evidence.map(v=>[v.type,v.text]),["hypothesis",x.maybe],["pending",x.missing]];
  const changed=eff.fromSeller&&eff.autoId&&eff.autoId!==eff.id;
  box.innerHTML=`<h4 id="dvDiagH">Diagnóstico</h4>
    <div class="dv-diag-card"><span class="dv-ic" aria-hidden="true">${d.icon}</span><div><b>${d.L}. ${e(d.title)}</b><small>${e(d.desc)}</small></div><span class="dv-src-tag">${e(srcTxt)}</span></div>
    ${changed?`<p class="dv-hint">CierraClick detectó «${e(DIAGS[eff.autoId].title)}», pero vos lo cambiaste.</p>`:""}
    <ul class="dv-ev">${evs.map(([t,s])=>`<li class="ev-${t}"><span class="ev-chip">${EV_LABEL[t]}</span>${e(s)}</li>`).join("")}</ul>
    ${f.context?`<p class="dv-hint"><b>Tu contexto:</b> ${e(f.context)} <i>(información tuya, no confirmada por el cliente)</i></p>`:""}
    <details class="dv-change"><summary>Confirmar o cambiar el diagnóstico</summary>
      <div class="dv-reasons" role="radiogroup" aria-label="Diagnóstico">${Object.entries(DIAGS).map(([id,g])=>`<button type="button" class="dv-reason${eff.id===id?" on":""}" role="radio" aria-checked="${eff.id===id}" data-dv-diag="${id}"><span class="dv-ic" aria-hidden="true">${g.icon}</span><span><b>${g.L}. ${e(g.title)}</b><small>${e(g.desc)}</small></span></button>`).join("")}</div>
      <label class="dv-src">¿Cómo lo sabés?<select id="dvSource">${Object.entries(DIAG_SOURCES).map(([k,v])=>`<option value="${k}"${(eff.fromSeller?eff.source:"seller_confirmed")===k?" selected":""}>${e(v)}</option>`).join("")}</select></label>
      <div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" id="dvConfirm">Es correcto: confirmarlo</button></div>
      <p class="dv-hint">Queda guardado para no confundir lo que dijo el cliente con lo que suponés.</p>
      <label class="dv-src">Contexto adicional (opcional)<textarea id="dvContext" maxlength="500" rows="2" placeholder="Ej: hablamos por teléfono y me dijo que lo ve con su socio">${e(f.context||"")}</textarea></label>
      <div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" id="dvCtxSave">Guardar contexto</button></div>
    </details>`;
}
function dvPaintReco(){
  const p=dvP(), box=$("#dvReco"); if(!p) return; const e=escapeHtml, eff=effectiveDiag(p);
  if(eff.closed||eff.declined){box.hidden=true; return;} box.hidden=false;
  const x=explainDiag(p,eff), act=recoActions(p,eff), know=eff.evidence.filter(v=>v.type==="confirmed"||v.type==="observed");
  box.innerHTML=`<h4 id="dvRecoH">Qué te conviene hacer</h4>
    ${eff.id==="unknown"?`<div class="dv-empty"><p>Todavía no sabemos qué necesita el cliente para decidir. Podés enviarle una pregunta breve para descubrirlo.</p></div>`:""}
    <dl class="dv-why"><div><dt>Qué sabemos</dt><dd>${know.length?e(know.map(v=>v.text).join(" ")):"Todavía no hay datos confirmados."}</dd></div>
      <div><dt>Qué podría estar frenando</dt><dd>${e(x.maybe)} <i>(hipótesis)</i></dd></div>
      <div><dt>Qué falta confirmar</dt><dd>${e(x.missing)}</dd></div>
      <div><dt>Acción recomendada</dt><dd><b>${e(act.p.l)}</b></dd></div>
      <div><dt>Por qué</dt><dd>${e(x.why)}</dd></div>
      <div><dt>Resultado que buscamos</dt><dd>${e(x.goal)}</dd></div></dl>
    <div class="dv-btns"><button type="button" class="btn btn-primary btn-sm" data-dv-k="${act.p.k}">${e(act.p.l)}</button><button type="button" class="btn btn-secondary btn-sm" data-dv-k="${act.a.k}">${e(act.a.l)}</button></div>`;
}
function dvRegen(){const p=dvP(), eff=effectiveDiag(p); _dv.msg=buildMsg(p,eff,_dv.tone,_dv.variant,_dv.link); _dv.edited=false;}
function dvPaintMsg(){
  const p=dvP(), box=$("#dvMsgSec"); if(!p) return; const e=escapeHtml, eff=effectiveDiag(p);
  if(eff.closed||eff.declined){box.hidden=true; return;} box.hidden=false;
  if(!_dv.edited) dvRegen();
  const first=firstName(p.client.name);
  box.innerHTML=`<h4 id="dvMsgH">Mensaje${first?` para ${e(first)}`:""}</h4>
    <div class="dv-tones" role="radiogroup" aria-label="Tono del mensaje">${Object.entries(TONES).map(([k,l])=>`<label class="dv-tone${_dv.tone===k?" on":""}"><input type="radio" name="dvTone" value="${k}" data-dv-tone="${k}"${_dv.tone===k?" checked":""}>${e(l)}</label>`).join("")}</div>
    <label class="check-row dv-link"><input type="checkbox" id="dvLink"${_dv.link?" checked":""}><span>Incluir el link de la propuesta</span></label>
    <label class="sr-only" for="dvMsg">Mensaje para el cliente</label>
    <textarea id="dvMsg" rows="7" maxlength="1200">${e(_dv.msg)}</textarea>
    <div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" id="dvEdit">✏️ Editar mensaje</button><button type="button" class="btn btn-secondary btn-sm" id="dvRegen">🔄 Regenerar</button><button type="button" class="btn btn-secondary btn-sm" id="dvCopy">📋 Copiar mensaje</button><button type="button" class="btn btn-primary btn-sm" id="dvWa">💬 Abrir WhatsApp</button></div>
    <button type="button" class="text-btn" id="dvReset"${_dv.edited?"":" hidden"}>↺ Volver al mensaje sugerido</button>
    <div id="dvPhone"></div>
    <p class="dv-note">No se envía nada automáticamente. Abrir WhatsApp no demuestra que el mensaje se haya enviado: confirmalo vos después.</p>
    <div id="dvSentAsk" class="dv-sentask" hidden>¿Ya lo enviaste? <button type="button" class="btn btn-secondary btn-sm" id="dvMarkSent">Sí, registrar como enviado</button></div>`;
}
const dvVersions=p=>{const root=p.versionOf||p.id; return state.proposals.filter(x=>(x.versionOf||x.id)===root).sort((a,b)=>(a.versionNo||1)-(b.versionNo||1));};
function dvPaintAlt(){
  const p=dvP(); if(!p) return; const multi=p.options.length>1, c=dvCtx(p), ch=[...p.options].sort((a,b)=>finalPrice(a)-finalPrice(b))[0];
  $("#dvAltBody").innerHTML=`<p class="dv-hint">Crea una copia para ajustar alcance, precio o condiciones de pago. <b>La propuesta original no se modifica</b> y vos revisás todo antes de enviarla. No se aplica ningún descuento automático.</p>
    <div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" data-dv-alt="copy">Copiar la propuesta completa</button>${multi?`<button type="button" class="btn btn-secondary btn-sm" data-dv-alt="cheapest">Solo con la opción más económica (${escapeHtml(ch.name)})</button>`:""}</div>`;
}
function dvPaintNext(){
  const p=dvP(); if(!p) return; const e=escapeHtml, f=getFollow(p), n=f.next, r=openResponses(p).find(x=>x.kind==="later"&&x.laterDate);
  const val=(n&&n.date)||(r&&r.laterDate)||"";
  $("#dvNextBody").innerHTML=`${n&&n.date?`<div class="dv-sched"><b>Programado: ${e(fmtDate(n.date))}</b> · ${e(n.action||"Seguimiento")}${n.note?` · ${e(n.note)}`:""}<div class="dv-btns"><button type="button" class="btn btn-secondary btn-sm" id="dvNextDone">Marcar como hecho</button><button type="button" class="text-btn" id="dvNextClear">Quitar</button></div></div>`:""}
    ${r&&!n?`<p class="dv-hint">El cliente pidió retomarlo alrededor del ${e(fmtDate(r.laterDate))}. Programalo para no olvidarte.</p>`:""}
    <form id="dvNextForm" class="dv-form" novalidate><label>Fecha<input type="date" id="dvNextDate" min="${isoDate(Date.now())}" value="${e(val)}"></label>
      <label>Próxima acción<select id="dvNextAct">${["Escribirle por WhatsApp","Llamarlo/a","Enviar una alternativa","Revisar la propuesta","Otra"].map(a=>`<option${n&&n.action===a?" selected":""}>${a}</option>`).join("")}</select></label>
      <label>Nota<input id="dvNextNote" maxlength="140" placeholder="Ej: me pidió que lo llame el viernes" value="${e((n&&n.note)||"")}"></label>
      <p class="imp-err" id="dvNextErr" role="alert" hidden></p><button type="submit" class="btn btn-primary btn-sm">Guardar seguimiento</button></form>`;
}
function dvPaintRes(){
  const p=dvP(); if(!p) return; const cur=stageOf(p), row=OUTCOMES.find(x=>x[0]===cur);
  $("#dvResBody").innerHTML=`<p class="dv-hint">Registrá en qué quedó. Es tu seguimiento: <b>no cambia</b> el estado real de la propuesta (aceptada, seña cobrada) salvo «Perdida», que usa el flujo de siempre.</p>
    <div class="dv-stages">${OUTCOMES.map(([k,l])=>`<button type="button" class="dv-stage-btn${cur===k?" on":""}" data-dv-stage="${k}" aria-pressed="${cur===k}">${escapeHtml(l)}</button>`).join("")}</div>
    ${row?`<p class="dv-next-out"><b>Próximo paso:</b> ${escapeHtml(OUTCOME_NEXT[cur])}</p>`:'<p class="dv-hint">Todavía no registraste un resultado.</p>'}
    <button type="button" class="text-btn" data-dv-lost="${escapeHtml(p.id)}">Marcar como perdida…</button>`;
}
function dvPaintHist(){
  const p=dvP(); if(!p) return; const e=escapeHtml, h=getFollow(p).history.slice().reverse().slice(0,25), vs=dvVersions(p);
  $("#dvHistBody").innerHTML=`${vs.length>1?`<h5>Versiones</h5><ul class="dv-vers">${vs.map(v=>{const base=finalPrice(chosenOf(vs[0])), cur=finalPrice(chosenOf(v)), d=base?Math.round(100*(cur-base)/base):0;
      return `<li><b>${(v.versionNo||1)===1?"Original":`Alternativa v${v.versionNo}`}</b> · ${e(v.title)} · ${money(cur)}${v.id!==vs[0].id&&d?` (${d>0?"+":""}${d}% vs. original)`:""} · ${statusLabel(v.status)} <button type="button" class="text-btn" data-dv-ver="${e(v.id)}">Ver</button></li>`;}).join("")}</ul>`:""}
    <h5>Acciones registradas</h5>${h.length?`<ol class="dv-hist">${h.map(x=>`<li><span>${e(x.text)}${x.by?` <i>· ${e(x.by)}</i>`:""}</span><small>${relativeTime(x.at)}</small></li>`).join("")}</ol>`:'<p class="dv-hint">Todavía no hay acciones registradas.</p>'}
    <button type="button" class="text-btn" data-dv-full="${e(p.id)}">Ver actividad completa del cliente</button>`;
}

/* ---- acciones ---- */
async function dvSetDiag(id,source){
  const p=dvP(); if(!p||!DIAGS[id]) return; const f=getFollow(p), prev=f.reason&&f.reason.id;
  if(_dv.edited&&_dv.msg.trim()&&!confirm("Cambiar el diagnóstico reemplaza el mensaje que editaste. ¿Seguir?")) return;
  _dv.edited=false; const src=source||(prev===id&&f.reason?f.reason.source:"seller_assumption");
  f.reason={id,source:src,at:new Date().toISOString()};
  logFollow(p,"reason",`Diagnóstico: ${DIAGS[id].title} (${DIAG_SOURCES[src]}).`);
  dvPaintDiag(); dvPaintReco(); dvPaintMsg(); dvPaintCtx(); dvPaintHist(); await saveFollow(p); dvPaintWarn();
}
async function dvConfirmDiag(){
  const p=dvP(), eff=effectiveDiag(p), src=$("#dvSource")?$("#dvSource").value:"seller_confirmed";
  return dvSetDiag(eff.id,DIAG_SOURCES[src]?src:"seller_confirmed");
}
async function dvSetSource(v){
  const p=dvP(); if(!p||!DIAG_SOURCES[v]) return; const f=getFollow(p), eff=effectiveDiag(p);
  f.reason={id:eff.id,source:v,at:new Date().toISOString()}; _dv.edited=false;
  logFollow(p,"reason",`Origen del diagnóstico: ${DIAG_SOURCES[v]}.`);
  dvPaintDiag(); dvPaintMsg(); dvPaintHist(); await saveFollow(p); dvPaintWarn();
}
async function dvSaveContext(){
  const p=dvP(), v=$("#dvContext").value.trim().slice(0,500), f=getFollow(p);
  if(v) f.context=v; else delete f.context; logFollow(p,"note",v?"Agregaste contexto al diagnóstico.":"Quitaste el contexto del diagnóstico.");
  dvPaintDiag(); dvPaintHist(); await saveFollow(p); dvPaintWarn(); toast("Contexto guardado ✔");
}
async function dvAnswer(rid){
  const p=dvP(), r=getResponses(p).find(x=>x.id===rid); if(!r) return;
  r.answeredAt=new Date().toISOString();
  if(Cloud.on){try{const sb=await Auth.client(); const {error}=await sb.from("proposal_responses").update({answered_at:r.answeredAt}).eq("id",rid); if(error) throw error;}catch(e){r.answeredAt=null; return toast("No se pudo marcar como respondida. Probá de nuevo.");}}
  logFollow(p,"answered",`Marcaste como respondida: «${respKind(r.kind).label}».`); saveState();
  dvPaintCtx(); dvPaintDiag(); dvPaintReco(); dvPaintMsg(); dvPaintHist(); await saveFollow(p); renderDashboard(); dvPaintWarn();
}
async function dvCopy(){
  const p=dvP(), t=_dv.msg.trim(); if(!t) return toast("No hay mensaje para copiar.");
  try{await navigator.clipboard.writeText(t); toast("Mensaje copiado ✔");}catch(err){window.prompt("Copiá el mensaje:",t);}
  logFollow(p,"copied","Mensaje preparado y copiado (sin confirmar el envío)."); dvPaintHist(); dvPaintCtx(); await saveFollow(p); dvPaintWarn();
}
function dvWhatsApp(){
  const p=dvP(), t=_dv.msg.trim(); if(!t) return toast("No hay mensaje para enviar.");
  const ph=waPhone(p.client.phone); if(!ph){dvPhoneFix(); return;}
  window.open(`https://wa.me/${ph}?text=${encodeURIComponent(t)}`,"_blank","noopener");
  logFollow(p,"whatsapp","Mensaje preparado y WhatsApp abierto (sin confirmar el envío)."); $("#dvSentAsk").hidden=false;
  dvPaintHist(); dvPaintCtx(); saveFollow(p).then(dvPaintWarn);
}
function dvPhoneFix(msg){
  const p=dvP(), e=escapeHtml;
  $("#dvPhone").innerHTML=`<div class="dv-phone" role="alert"><label>${msg||"Falta un teléfono válido para abrir WhatsApp."}<input id="dvPhoneIn" inputmode="tel" autocomplete="tel" placeholder="Ej: 3511234567" value="${e(p.client.phone||"")}"></label><button type="button" class="btn btn-secondary btn-sm" id="dvSavePhone">Guardar teléfono</button></div>`;
  $("#dvPhoneIn").focus();
}
async function dvSavePhone(){
  const p=dvP(), v=$("#dvPhoneIn").value.trim();
  if(!waPhone(v)) return dvPhoneFix("Ese número no parece válido (10 dígitos con código de área, o con código de país).");
  const prev=p.client.phone; p.client.phone=v;
  if(Cloud.on){
    try{if(!p.client_id) throw new Error("sin cliente"); const sb=await Auth.client(); const {error}=await sb.from("clients").update({phone:v}).eq("id",p.client_id); if(error) throw error;}
    catch(err){p.client.phone=prev; return dvPhoneFix("No se pudo guardar el teléfono. Revisá tu conexión e intentá de nuevo.");}
  }else{const c=(state.clients||[]).find(x=>x.phone===prev&&x.name===p.client.name); if(c) c.phone=v; saveState();}
  $("#dvPhone").innerHTML=""; toast("Teléfono guardado ✔. Tocá «Abrir WhatsApp» de nuevo.");
}
async function dvMarkSent(){
  const p=dvP(); if(!p) return; const btn=$("#dvMarkSent"); if(btn) btn.disabled=true;
  if(Cloud.on){try{await Cloud.rpc("record_follow_up",{p_id:p.id});}catch(e){if(p.status!=="accepted"&&p.status!=="lost"){if(btn) btn.disabled=false; return toast(e.message||"No se pudo registrar el envío.");}}}
  p.followUps=(p.followUps||0)+1; p.lastFollowUpAt=Date.now(); p.remindAt=null;
  logFollow(p,"sent","Registraste el mensaje como enviado."); state.activity.unshift({icon:"🔔",text:`Seguimiento enviado a ${p.client.name}.`,time:"Ahora"});
  $("#dvSentAsk").hidden=true; dvPaintTop(); dvPaintCtx(); dvPaintHist();
  await saveFollow(p); saveState(); renderDashboard(); dvPaintWarn();
}
async function dvSaveNext(ev){
  ev.preventDefault(); const p=dvP(), err=$("#dvNextErr"), date=$("#dvNextDate").value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<isoDate(Date.now())){err.textContent="Elegí una fecha de hoy en adelante."; err.hidden=false; return;}
  err.hidden=true; const f=getFollow(p);
  f.next={date,action:$("#dvNextAct").value,note:$("#dvNextNote").value.trim().slice(0,140)};
  logFollow(p,"scheduled",`Seguimiento programado para el ${fmtDate(date)}: ${f.next.action}${f.next.note?` (${f.next.note})`:""}.`);
  dvPaintNext(); dvPaintCtx(); dvPaintHist(); await saveFollow(p); renderDashboard(); dvPaintWarn(); toast("Seguimiento programado ✔");
}
async function dvNextClose(done){
  const p=dvP(), f=getFollow(p); if(!f.next) return;
  logFollow(p,"scheduled",done?"Seguimiento programado marcado como hecho.":"Quitaste el seguimiento programado.");
  delete f.next; dvPaintNext(); dvPaintCtx(); dvPaintHist(); await saveFollow(p); renderDashboard(); dvPaintWarn();
}
async function dvSetStage(k){
  const p=dvP(); if(!p) return; const row=OUTCOMES.find(x=>x[0]===k); if(!row) return;
  if(k==="deposit_confirmed"&&!p.depositPaidAt&&!confirm("Todavía no confirmaste la seña en CierraClick. Una reserva se confirma con evidencia (por ejemplo, la transferencia acreditada). ¿Registrarla igual?")) return;
  if(k==="sale_closed"&&p.status!=="accepted"&&!confirm("El cliente todavía no aceptó la propuesta en el link. ¿Registrar igual la venta como cerrada por otro medio?")) return;
  if(k==="declined"&&!confirm("Vas a registrar que el cliente no desea continuar. Dejará de aparecer en tus seguimientos. ¿Seguir?")) return;
  getFollow(p).stage=k; logFollow(p,"stage",`Resultado registrado: ${row[1]}.`);
  dvPaintTop(); dvPaintCtx(); dvPaintDiag(); dvPaintReco(); dvPaintMsg(); dvPaintRes(); dvPaintHist();
  if(k==="later"){$("#dvNext").open=true; dvPaintNext();}
  await saveFollow(p); renderDashboard(); dvPaintWarn();
}
function dvAction(k){
  const p=dvP();
  if(k==="msg"){const m=$("#dvMsg"); if(m){m.scrollIntoView({block:"center"}); m.focus();} return;}
  if(k==="alt"){$("#dvAlt").open=true; $("#dvAlt").scrollIntoView({block:"nearest"}); return;}
  if(k==="improve"){closeModal("toolModal"); return openImprove(p.id);}
  if(k==="schedule"){$("#dvNext").open=true; $("#dvNextDate").focus(); return;}
  if(k==="paid"){closeModal("toolModal"); return markPaid(p.id);}
  if(k==="result"){$("#dvRes").open=true; $("#dvRes").scrollIntoView({block:"nearest"});}
}
function dvBind(root){
  root.addEventListener("click",ev=>{
    const T=ev.target.closest?ev.target:null; if(!T) return;
    const d=T.closest("[data-dv-diag]"); if(d) return dvSetDiag(d.dataset.dvDiag);
    if(T.closest("#dvConfirm")) return dvConfirmDiag();
    if(T.closest("#dvCtxSave")) return dvSaveContext();
    if(T.closest("#dvCopy")) return dvCopy();
    if(T.closest("#dvWa")) return dvWhatsApp();
    if(T.closest("#dvEdit")){const m=$("#dvMsg"); m.focus(); m.setSelectionRange(m.value.length,m.value.length); return;}
    if(T.closest("#dvRegen")){ if(_dv.edited&&!confirm("Regenerar reemplaza el mensaje que editaste. ¿Seguir?")) return; _dv.variant++; _dv.edited=false; return dvPaintMsg();}
    if(T.closest("#dvReset")){_dv.edited=false; return dvPaintMsg();}
    if(T.closest("#dvMarkSent")) return dvMarkSent();
    if(T.closest("#dvSavePhone")) return dvSavePhone();
    if(T.closest("#dvNextDone")) return dvNextClose(true);
    if(T.closest("#dvNextClear")) return dvNextClose(false);
    if(T.closest("#dvRetry")){const p=dvP(); return saveFollow(p).then(()=>dvPaintWarn());}
    const k=T.closest("[data-dv-k]"); if(k) return dvAction(k.dataset.dvK);
    const alt=T.closest("[data-dv-alt]"); if(alt) return prepareAlternative(_dv.id,alt.dataset.dvAlt);
    const st=T.closest("[data-dv-stage]"); if(st) return dvSetStage(st.dataset.dvStage);
    const ans=T.closest("[data-dv-ans]"); if(ans) return dvAnswer(ans.dataset.dvAns);
    const lost=T.closest("[data-dv-lost]"); if(lost){closeModal("toolModal"); return openLost(lost.dataset.dvLost);}
    const ver=T.closest("[data-dv-ver]"); if(ver){const id=ver.dataset.dvVer; closeModal("toolModal"); return openPublic(id,true);}
    const full=T.closest("[data-dv-full]"); if(full) return openHistory(full.dataset.dvFull);
  });
  root.addEventListener("input",ev=>{if(ev.target.id==="dvMsg"){_dv.msg=ev.target.value; _dv.edited=true; const rs=$("#dvReset"); if(rs) rs.hidden=false;}});
  root.addEventListener("change",ev=>{
    if(ev.target.id==="dvSource") return dvSetSource(ev.target.value);
    if(ev.target.id==="dvLink"){_dv.link=ev.target.checked; if(_dv.edited) toast("Editaste el mensaje: agregá o quitá el link a mano."); else dvPaintMsg(); return;}
    if(ev.target.dataset&&ev.target.dataset.dvTone){
      if(_dv.edited&&!confirm("Cambiar el tono reemplaza el mensaje que editaste. ¿Seguir?")){dvPaintMsg(); return;}
      _dv.tone=ev.target.dataset.dvTone; _dv.edited=false; const p=dvP(); getFollow(p).tone=_dv.tone; dvPaintMsg(); saveFollow(p).then(dvPaintWarn);
    }
  });
  root.addEventListener("submit",ev=>{if(ev.target.id==="dvNextForm") dvSaveNext(ev);});
}
document.addEventListener("click",e=>{
  const T=e.target&&e.target.closest?e.target:null; if(!T) return;
  const u=T.closest("[data-unlock]"); if(u) return openDestrabar(u.dataset.unlock);
  const n=T.closest("[data-next]"); if(n){const [id,act]=n.dataset.next.split("|"); runNext(id,act);}
});

/* ---- alternativas (versiones) ---- */
function prepareAlternative(id,mode){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  closeModal("toolModal"); duplicateProposal(id);
  if(!$("#clientName")) return;
  builderAltOf=id; $("#proposalTitle").value=`${p.title} (alternativa)`;
  if(mode==="cheapest"&&p.options.length>1){
    const ch=[...p.options].sort((a,b)=>finalPrice(a)-finalPrice(b))[0], {id:_x,...rest}=ch;
    builderOptions=[newOption({...rest,recommended:true,_open:true})]; renderOptionEditors();
  }
  renderBuilderPreview(); updateAltBanner(); wizPrefilled(2);
  toast("Borrador de alternativa: la original no se modifica. Revisá y creala cuando estés conforme.");
}
function updateAltBanner(){
  const form=$("#proposalForm"); if(!form) return; let b=$("#altBanner");
  if(!builderAltOf){if(b) b.remove(); return;}
  const orig=state.proposals.find(x=>x.id===builderAltOf); if(!orig){if(b) b.remove(); return;}
  if(!b){b=document.createElement("div"); b.id="altBanner"; b.className="alt-banner"; b.setAttribute("role","status"); form.prepend(b);}
  const nOpts=builderOptions.filter(o=>o.name||o.price), cur=nOpts.length?[...nOpts].sort((a,c)=>finalPrice(a)-finalPrice(c))[0]:null;
  const oTot=finalPrice(chosenOf(orig)), nTot=cur?finalPrice(cur):0, d=oTot?Math.round(100*(nTot-oTot)/oTot):0;
  const lines=s=>(String(s||"").split("\n").filter(x=>x.trim()).length);
  b.innerHTML=`<b>🧩 Alternativa de «${escapeHtml(orig.title)}»</b><span>Original: <b>${money(oTot)}</b> · ${orig.options.length} ${orig.options.length===1?"opción":"opciones"} · ${(orig.includes||[]).length} incluido${(orig.includes||[]).length===1?"":"s"}</span><span>Esta alternativa: <b>${cur?money(nTot):"—"}</b> · ${nOpts.length} ${nOpts.length===1?"opción":"opciones"} · ${lines($("#includes")&&$("#includes").value)} incluido${lines($("#includes")&&$("#includes").value)===1?"":"s"}${cur&&oTot?` · <b>${d>0?"+":""}${d}%</b> frente a la original`:""}</span>${cur&&nTot<oTot?"<small>Revisá que el nuevo importe te siga dejando margen: la app no conoce tus costos.</small>":""}`;
}
async function linkVersion(pid){
  onProposalCreated();
  const oid=builderAltOf; if(!oid) return; builderAltOf=null;
  const orig=state.proposals.find(x=>x.id===oid), np=state.proposals.find(x=>x.id===pid); if(!orig||!np) return;
  const root=orig.versionOf||orig.id, n=Math.max(1,...state.proposals.filter(x=>(x.versionOf||x.id)===root).map(x=>x.versionNo||1))+1;
  if(Cloud.on){
    try{const sb=await Auth.client(); const {error}=await sb.from("proposals").update({version_of:root,version_no:n}).eq("id",pid); if(error) throw error;}
    catch(e){return toast("La alternativa se creó, pero no pude vincularla a la original (¿falta ejecutar supabase_v9_destrabar.sql?).");}
  }
  np.versionOf=root; np.versionNo=n;
  logFollow(orig,"alternative",`Alternativa v${n} preparada por ${money(finalPrice(chosenOf(np)))}.`);
  await saveFollow(orig); saveState();
}

/* ---- campos nuevos de la propuesta: «qué no incluye» y plazo ---- */
async function saveProposalExtra(id,p){
  if(!Cloud.on||!((p.excludes||[]).length||p.deliveryTime)) return;
  try{await Cloud.rpc("save_proposal_extra",{p_id:id,p:{excludes:p.excludes||[],deliveryTime:p.deliveryTime||""}});}
  catch(e){toast(isMissing(e)?"Falta ejecutar supabase_v9_destrabar.sql para guardar «qué no incluye» y el plazo.":"No se pudo guardar «qué no incluye» y el plazo.");}
}

/* ---- visitas humanas: no se cuentan robots ni vistas previas de mensajería ---- */
function isBotUA(){
  const ua=navigator.userAgent||"";
  return navigator.webdriver===true||/bot\b|crawl|spider|preview|facebookexternalhit|whatsapp\/|slackbot|telegrambot|linkedinbot|headless|lighthouse|pagespeed|curl\/|wget|python-requests|okhttp/i.test(ua);
}
function humanOnce(fn){
  if(isBotUA()) return;
  let done=false; const evs=["pointerdown","touchstart","keydown","wheel","scroll","mousemove"];
  const go=()=>{if(done) return; done=true; evs.forEach(x=>window.removeEventListener(x,go,true)); try{fn();}catch(e){}};
  evs.forEach(x=>window.addEventListener(x,go,{capture:true,passive:true}));
}

/* ---- vista pública: piezas nuevas ---- */
function contactChip(){
  const d=normalizePhone(state.business.whatsapp); if(!d) return "";
  return `<div class="contact-chip">📱 <a href="https://wa.me/${d}" target="_blank" rel="noopener">WhatsApp ${escapeHtml(d)}</a></div>`;
}
const acc=(sec,ic,title,body)=>`<details class="acc" data-sec="${sec}"><summary><span aria-hidden="true">${ic}</span>${title}</summary><div class="acc-body">${body}</div></details>`;
function financeMarkup(p){
  const rows=p.options.map(o=>{
    const fin=finalPrice(o), dep=depositOf(p,o), n=o.hasInstallments&&o.installments>1?o.installments:0, bits=[`Total <b>${money(fin)}</b>`];
    if(p.depositPct>0) bits.push(`Seña inicial <b>${money(dep)}</b> (${p.depositPct}%)`,`Saldo <b>${money(fin-dep)}</b>`);
    if(n) bits.push(`o en <b>${n} cuotas de ${money(fin/n)}</b> (total ${money(fin)})`);
    return `<li>${p.options.length>1?`<b>${escapeHtml(o.name)}:</b> `:""}${bits.join(" · ")}</li>`;}).join("");
  return `${payBlock(p)}<ul class="fin-list">${rows}</ul>`;
}
function detailsMarkup(p){
  const e=escapeHtml, inc=(p.includes||[]).filter(Boolean), exc=(p.excludes||[]).filter(Boolean), out=[];
  if(inc.length||exc.length||p.deliveryTime) out.push(acc("incluye","✓","Qué incluye y qué no incluye",`${inc.map(x=>`<div class="include">✓ ${e(x)}</div>`).join("")}${exc.map(x=>`<div class="include no">✗ ${e(x)}</div>`).join("")}${p.deliveryTime?`<p class="plazo">⏱ <b>Plazo:</b> ${e(p.deliveryTime)}</p>`:""}`));
  out.push(acc("pago","💳","Cómo se paga",financeMarkup(p)));
  if((p.conditions||"").trim()) out.push(acc("condiciones","📄","Condiciones",`<p>${e(p.conditions)}</p>`));
  return `<div class="acc-group">${out.join("")}</div>${afterMarkup(p)}`;
}
function consultMarkup(p){
  return `<section class="consult" data-sec="consulta"><h4>¿Preferís hablarlo por WhatsApp?</h4><p>Podés consultarme sin aceptar nada.</p>
    <a class="btn btn-secondary consult-wa" id="publicWhatsapp" href="#" target="_blank" rel="noopener">💬 Consultar por WhatsApp</a></section>`;
}
function statusTrackMarkup(p,dep,paid){
  const s=[["Opción seleccionada","done"],["Propuesta aceptada","done"]];
  if(dep>0){s.push([paid?"Seña confirmada":p.proofSentAt?"Transferencia avisada · en verificación":"Seña pendiente",paid?"done":p.proofSentAt?"wait":"todo"]); s.push(["Reserva confirmada",paid?"done":"todo"]);}
  else s.push(["Pago a coordinar con el negocio","todo"]);
  return `<ol class="status-track" aria-label="Estado de tu propuesta">${s.map(([t,k])=>`<li class="${k}"><span aria-hidden="true">${k==="done"?"✔":k==="wait"?"…":"○"}</span>${escapeHtml(t)}</li>`).join("")}</ol>`;
}

/* ===== v40 (parte 2): «¿Qué te falta para decidir?», encabezado, asistente de 3 pasos, estados vacíos y métricas ===== */
const hash32=s=>{let h=5381; s=String(s); for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36);};

/* ---- 1) Encabezado: asesor y presentación variable ---- */
function introText(p){
  const multi=p.options.length>1;
  const A=multi?[
    "Preparamos esta propuesta pensando en lo que necesitás. Acá podés revisar los detalles, comparar las opciones y elegir cómo querés avanzar.",
    "Armamos estas opciones para vos. Revisalas con calma y, si algo no te cierra, preguntanos antes de decidir.",
    "Acá tenés las alternativas con todo el detalle. Compará, tomate el tiempo que necesites y avisanos si querés ajustar algo."
  ]:[
    "Preparamos esta propuesta pensando en lo que necesitás. Acá podés revisar los detalles y elegir cómo querés avanzar.",
    "Armamos esta propuesta para vos. Revisala con calma y, si algo no te cierra, preguntanos antes de decidir.",
    "Acá tenés la propuesta con todo el detalle. Tomate el tiempo que necesites y avisanos si querés ajustar algo."];
  const t=A[parseInt(hash32(p.id),36)%A.length];
  return t;
}
const advisorLine=()=>{const a=profileOf(state.business&&state.business.profile).advisor; return a?`<div class="advisor-line">Te atiende <b>${escapeHtml(a)}</b></div>`:"";};

/* ---- 2) «¿Qué te falta para decidir?» (lo que ve el cliente) ---- */
const needStored=pid=>{try{return JSON.parse(localStorage.getItem("cc_need_"+pid)||"null");}catch(e){return null;}};
function needMarkup(p){
  if(!["sent","viewed"].includes(p.status)) return "";
  const st=needStored(p.id), e=escapeHtml;
  return `<section class="need" id="needBox" data-pid="${e(p.id)}" data-sec="necesito" aria-labelledby="needH">
    <h4 id="needH">¿Qué te falta para decidir?</h4>
    <p>Queremos ayudarte a encontrar la opción que mejor se adapte a vos. Elegí lo que necesitás y te ayudamos con el próximo paso.</p>
    ${st?`<p class="need-done" role="status">✅ Ya registramos tu respuesta («${e(respKind(st.kind).label)}»). Si querés agregar algo, elegí otra opción.</p>`:""}
    <div class="need-opts" role="radiogroup" aria-labelledby="needH">${RESP_KINDS.map(k=>`<button type="button" class="need-opt" role="radio" aria-checked="false" data-need="${k.id}">${e(k.label)}</button>`).join("")}</div>
    <div id="needFlow" aria-live="polite"></div>
    <small class="need-hint">Es opcional: podés revisar toda la propuesta sin responder.</small></section>`;
}
function needFlowMarkup(p,kind){
  const e=escapeHtml, biz=e(state.business.name||"el negocio"), fld=(id,label,ph,req)=>`<label class="need-f">${label}${req?"":" <small>(opcional)</small>"}<textarea id="${id}" rows="3" maxlength="400" placeholder="${ph}"></textarea></label>`;
  const bits=[]; const methods=(p.payments||[]).map(k=>PAY[k]).filter(Boolean); if(methods.length) bits.push(methods.join(", "));
  const insts=Math.max(0,...p.options.filter(x=>x.hasInstallments&&x.installments>1).map(x=>x.installments)); if(insts>1) bits.push(`hasta ${insts} cuotas`);
  if(p.depositPct>0) bits.push(`seña del ${p.depositPct}%`);
  const send=`<p class="imp-err" id="needErr" role="alert" hidden></p><button type="submit" class="btn btn-primary btn-sm" id="needSend">Enviar</button>`;
  const body={
    price:`<fieldset class="need-f"><legend>¿Qué parte te preocupa?</legend>${Object.entries(ASPECTS).map(([k,l],i)=>`<label class="need-r"><input type="radio" name="needAspect" value="${k}"${i===0?" checked":""}> ${e(l[0].toUpperCase()+l.slice(1))}</label>`).join("")}</fieldset>${fld("needDetail","Si querés, contanos un poco más","Ej: me gustaría una entrega inicial menor")}<p class="need-note">Con esto ${biz} revisa tu caso. No se aplica ningún descuento automático.</p>`,
    payment:`${bits.length?`<p class="need-note">Hoy la propuesta contempla: ${e(bits.join("; "))}.</p>`:""}${fld("needDetail","¿Qué forma de pago te vendría mejor?","Ej: pagar en más cuotas")}`,
    includes:fld("needDetail","¿Qué te gustaría saber?","Escribí tu pregunta",true),
    compare:`<div class="need-actions"><button type="button" class="btn btn-secondary btn-sm" data-need-go="compare">Ver las opciones</button></div>${fld("needDetail","¿Qué es lo más importante para vos?","Ej: el plazo, el precio, la garantía")}`,
    later:`<fieldset class="need-f"><legend>¿Cuándo te conviene que retomemos?</legend>${[["3","En unos 3 días"],["7","En una semana"],["14","En dos semanas"],["custom","Elegir una fecha"]].map(([v,l],i)=>`<label class="need-r"><input type="radio" name="needWhen" value="${v}"${i===1?" checked":""}> ${l}</label>`).join("")}<input type="date" id="needDate" min="${addDays(isoDate(Date.now()),1)}" max="${addDays(isoDate(Date.now()),365)}" aria-label="Fecha para retomar" hidden></fieldset>`,
    other:fld("needDetail","Contanos qué necesitás","Escribilo con tus palabras",true)}[kind];
  return `<form class="need-form" id="needForm" data-kind="${kind}" novalidate>${body}${send}</form>`;
}
const NEED_OK={
  price:b=>`${b} va a revisar tu caso y te escribe. Mientras tanto podés seguir mirando la propuesta.`,
  payment:b=>`${b} va a revisar las modalidades disponibles y te escribe.`,
  includes:b=>`Te van a responder para que tengas todo claro antes de decidir.`,
  compare:b=>`Podés mirar las opciones acá arriba; ${b} también puede ayudarte a compararlas.`,
  later:(b,d)=>`Anotamos que preferís retomarlo${d?` alrededor del ${fmtDate(d)}`:" más adelante"}. Respetamos tu tiempo.`,
  other:b=>`Gracias por contarnos. ${b} lo va a leer y te responde.`,
  advance:b=>`Registramos que querés avanzar. Completá el último paso acá abajo para confirmarlo.`};
async function submitNeed(pid,kind,data){
  const key="k1-"+hash32(`${pid}|${kind}|${data.aspect||""}|${data.detail||""}|${data.later||""}`)+hash32(pid+kind);
  if(Cloud.on){
    await Cloud.pub("submit_proposal_response",{p_id:pid,p_kind:kind,p_aspect:data.aspect||"",p_detail:data.detail||"",p_later:data.later||null,p_key:key});
  }else{
    const p=state.proposals.find(x=>x.id===pid); if(!p) throw new Error("No encontramos la propuesta.");
    const l=(p.responses=Array.isArray(p.responses)?p.responses:[]);
    if(!l.some(r=>r.key===key)){
      l.push({id:"resp-"+Math.random().toString(36).slice(2,9),kind,aspect:data.aspect||"",detail:data.detail||"",laterDate:data.later||"",at:new Date().toISOString(),key});
      p.lastEvent=`El cliente respondió: ${respKind(kind).label}.`; state.activity.unshift({icon:"💬",text:`${p.client.name} respondió: ${respKind(kind).label}.`,time:"Ahora"}); saveState();
    }
  }
  try{localStorage.setItem("cc_need_"+pid,JSON.stringify({kind,at:Date.now(),key}));}catch(e){}
}
document.addEventListener("click",ev=>{
  const T=ev.target&&ev.target.closest?ev.target:null; if(!T) return;
  const box=T.closest("#needBox"); if(!box) return;
  const opt=T.closest("[data-need]");
  if(opt){
    const kind=opt.dataset.need, pid=box.dataset.pid, p=state.proposals.find(x=>x.id===pid);
    box.querySelectorAll(".need-opt").forEach(b=>{const on=b===opt; b.setAttribute("aria-checked",on); b.classList.toggle("on",on);});
    const flow=$("#needFlow");
    if(kind==="advance"){
      flow.innerHTML=`<p class="need-ok" role="status">✅ ${escapeHtml(NEED_OK.advance(state.business.name||"el negocio"))}</p>`;
      submitNeed(pid,"advance",{}).catch(()=>{});
      const ab=$("#acceptBtn"); if(ab){ab.click();} return;
    }
    flow.innerHTML=p?needFlowMarkup(p,kind):""; const f=flow.querySelector("textarea,input"); if(f) try{f.focus({preventScroll:true});}catch(e){} return;
  }
  if(T.closest("[data-need-go]")){const g=document.querySelector(".choice-grid,.cmp-box"); if(g) g.scrollIntoView({behavior:"smooth",block:"start"});}
});
document.addEventListener("change",ev=>{
  if(ev.target&&ev.target.name==="needWhen"){const d=$("#needDate"); if(d){d.hidden=ev.target.value!=="custom"; if(!d.hidden) d.focus();}}
});
document.addEventListener("submit",async ev=>{
  const form=ev.target; if(!form||form.id!=="needForm") return;
  ev.preventDefault(); const box=form.closest("#needBox"), pid=box.dataset.pid, kind=form.dataset.kind, err=$("#needErr"), btn=$("#needSend");
  const val=id=>{const el=form.querySelector("#"+id); return el?el.value.trim().slice(0,400):"";}, fail=m=>{err.textContent=m; err.hidden=false; return false;};
  err.hidden=true; const data={detail:val("needDetail")};
  if(kind==="price"){const r=form.querySelector('input[name="needAspect"]:checked'); data.aspect=r?r.value:"otro";}
  if(kind==="includes"||kind==="other"){if(data.detail.length<3) return fail("Escribí unas palabras para que podamos ayudarte.");}
  if(kind==="later"){
    const w=form.querySelector('input[name="needWhen"]:checked').value;
    if(w==="custom"){const d=$("#needDate").value, min=addDays(isoDate(Date.now()),1); if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<min) return fail("Elegí una fecha a partir de mañana."); data.later=d;}
    else data.later=addDays(isoDate(Date.now()),Number(w));
  }
  btn.disabled=true; btn.textContent="Enviando…";
  try{await submitNeed(pid,kind,data);}
  catch(e){btn.disabled=false; btn.textContent="Enviar"; return fail(e&&e.message&&!/function|schema|fetch|network/i.test(e.message)?e.message:"No pudimos registrar tu respuesta ahora. Probá de nuevo en un rato o consultanos por WhatsApp. Tu texto sigue acá.");}
  $("#needFlow").innerHTML=`<p class="need-ok" role="status">✅ Listo, registramos tu respuesta. ${escapeHtml(NEED_OK[kind](state.business.name||"El negocio",data.later))}</p>`;
});

/* ---- 3) Respuestas del cliente en el panel (nube) ---- */
async function loadResponses(){
  if(!(Cloud.on&&currentUser)) return;
  try{
    const sb=await Auth.client();
    const {data,error}=await sb.from("proposal_responses").select("id,proposal_id,kind,aspect,detail,later_date,created_at,answered_at,client_key").order("created_at",{ascending:false}).limit(500);
    if(error) throw error;
    _resp={}; data.forEach(r=>{(_resp[r.proposal_id]=_resp[r.proposal_id]||[]).push({id:r.id,kind:r.kind,aspect:r.aspect||"",detail:r.detail||"",laterDate:r.later_date||"",at:r.created_at,answeredAt:r.answered_at||null,key:r.client_key});});
    _respErr="";
  }catch(e){_respErr=isTableMissing(e)?"missing":"error";}
  renderDashboard();
}

/* ---- 4) Estados vacíos con una acción real ---- */
const emptyState=(icon,title,text,btn,act)=>`<div class="empty-state"><span class="es-ic" aria-hidden="true">${icon}</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(text)}</p>${btn?`<button type="button" class="btn btn-primary btn-sm" data-empty="${act}">${escapeHtml(btn)}</button>`:""}</div>`;
document.addEventListener("click",e=>{
  const b=e.target&&e.target.closest?e.target.closest("[data-empty]"):null; if(!b) return;
  if(b.dataset.empty==="new") openBuilder();
});
const EMPTY_FIRST=()=>emptyState("📝","Aún no creaste tu primera propuesta","Preparás una oferta personalizada y la compartís con tu cliente.","Crear primera propuesta","new");
const EMPTY_TODAY=n=>n?emptyState("✅","Estás al día","Las oportunidades que necesiten una próxima acción aparecerán acá."):EMPTY_FIRST();
const EMPTY_ACTIVITY=n=>emptyState("🕒","Todavía no hay actividad registrada","Cuando compartas propuestas, acá vas a ver su evolución.",n?"":"Crear primera propuesta","new");
const EMPTY_CLIENTS=()=>emptyState("👥","Todavía no hay clientes","Se guardan solos cuando creás una propuesta.","Crear primera propuesta","new");
const EMPTY_TABLE=()=>`<tr><td colspan="6">${EMPTY_FIRST()}</td></tr>`;
const PERF_MIN=5;
function perfEmptyPass(){
  const n=(state.proposals||[]).length; if(n>=PERF_MIN) return;
  ["perfViewed","perfAccepted","perfRecommended"].forEach(id=>{const el=$("#"+id); if(el) el.textContent="—";});
  const sc=$("#perfScore"); if(sc) sc.textContent="—"; const bar=$("#perfBar"); if(bar) bar.style.width="0%";
  const s=$("#perfSeñas"); if(s&&!n) s.textContent="—";
  const a=$("#performanceAdvice"); if(a) a.textContent=n?`Todavía hay pocos datos para medir tu rendimiento: se necesitan al menos ${PERF_MIN} propuestas (hoy tenés ${n}). Mientras tanto, esto no significa un mal resultado.`:"Creá y compartí tu primera propuesta para empezar a ver tus indicadores.";
}

/* ---- 5) Métricas de recuperación (con fórmulas y mínimos) ---- */
const REPLIED_STAGES=["replied","clarify","changes","payment_change","accepted","deposit_pending","deposit_confirmed","sale_closed","later"];
function recoveryStats(){
  const ps=state.proposals||[], R={n:ps.length};
  R.opened=ps.filter(p=>(p.views||0)>0).length;
  R.explicit=ps.filter(p=>getResponses(p).length||p.lastDoubt).length;
  R.objections={}; ps.forEach(p=>{const d=effectiveDiag(p); if(d.closed||d.declined||!isConf(d)) return; R.objections[d.id]=(R.objections[d.id]||0)+1;});
  R.prepared=ps.reduce((s,p)=>s+((p.follow&&p.follow.history)||[]).filter(h=>h.type==="copied"||h.type==="whatsapp").length,0);
  R.sent=ps.reduce((s,p)=>s+(p.followUps||0),0);
  R.fuBase=ps.filter(p=>(p.followUps||0)>0);
  R.fuReplied=R.fuBase.filter(p=>p.status==="accepted"||REPLIED_STAGES.includes(stageOf(p))||getResponses(p).some(r=>new Date(r.at).getTime()>(p.lastFollowUpAt||0))).length;
  R.accepted=ps.filter(p=>p.status==="accepted").length; R.deposits=ps.filter(p=>p.depositPaidAt).length;
  R.closed=ps.filter(p=>p.depositPaidAt||stageOf(p)==="sale_closed").length; R.lost=ps.filter(p=>p.status==="lost").length;
  try{const t=JSON.parse(localStorage.getItem("cc_buildtimes_"+((currentUser&&currentUser.id)||"demo"))||"[]").filter(x=>x>0).sort((a,b)=>a-b); R.build=t.length>=3?t[Math.floor(t.length/2)]:null; R.buildN=t.length;}catch(e){R.build=null;R.buildN=0;}
  return R;
}
function recordBuildTime(){
  const t=window._buildStart; window._buildStart=0; if(!t) return; const s=Math.max(1,Math.round((Date.now()-t)/1000)); if(s>7200) return;
  const k="cc_buildtimes_"+((currentUser&&currentUser.id)||"demo");
  try{const l=JSON.parse(localStorage.getItem(k)||"[]"); l.push(s); localStorage.setItem(k,JSON.stringify(l.slice(-20)));}catch(e){}
}
function renderRecovery(){
  const box=$("#recoveryCard"); if(!box) return; const R=recoveryStats(), e=escapeHtml;
  if(!R.n){box.innerHTML=`<div class="card-head"><h3>Recuperación de oportunidades</h3></div>${emptyState("📊","Todavía no hay datos suficientes","Cuando compartas propuestas y registres seguimientos, acá vas a ver qué objeciones aparecen y qué acciones funcionan.","Crear primera propuesta","new")}`; return;}
  const pct=(a,b)=>b?`${Math.round(100*a/b)}%`:"—", row=(label,val,formula,need)=>`<div class="rec-row"><div><b>${e(label)}</b><small>${e(formula)}</small></div><strong>${need?`<span class="rec-need">${e(need)}</span>`:e(val)}</strong></div>`;
  const obj=Object.entries(R.objections).sort((a,b)=>b[1]-a[1]);
  box.innerHTML=`<div class="card-head"><h3>Recuperación de oportunidades</h3></div><div class="rec-grid">
    ${row("Propuestas abiertas",`${R.opened} de ${R.n}`,"Con al menos una apertura humana ÷ propuestas creadas.","")}
    ${row("Con respuesta explícita del cliente",`${R.explicit} de ${R.n}`,"Respondieron «¿Qué te falta para decidir?» o tocaron una duda ÷ propuestas creadas.","")}
    ${row("Mensajes preparados / registrados como enviados",`${R.prepared} / ${R.sent}`,"Copiados o con WhatsApp abierto / confirmados por vos. Abrir WhatsApp no cuenta como envío.","")}
    ${row("Respuestas tras un seguimiento",pct(R.fuReplied,R.fuBase.length),"Propuestas con resultado distinto de «Sin respuesta» ÷ propuestas con seguimiento enviado.",R.fuBase.length<3?`Faltan datos: hacen falta 3 propuestas con seguimiento enviado (hoy ${R.fuBase.length}).`:"")}
    ${row("Aceptadas · señas confirmadas · ventas cerradas",`${R.accepted} · ${R.deposits} · ${R.closed}`,"Conteos reales; la reserva solo cuenta con seña confirmada.","")}
    ${row("Tiempo típico para crear una propuesta",R.build?`${Math.floor(R.build/60)} min ${R.build%60} s`:"","Mediana de las últimas 20 creadas en este dispositivo.",R.build?"":`Faltan datos: hacen falta 3 propuestas creadas con el creador nuevo (hoy ${R.buildN}).`)}
  </div>
  <h4 class="rec-h">Objeciones confirmadas más frecuentes</h4>
  ${obj.length?`<ul class="rec-obj">${obj.map(([id,c])=>`<li><span>${DIAGS[id].icon} ${e(DIAGS[id].title)}</span><b>${c}</b></li>`).join("")}</ul><small class="dv-hint">Solo cuentan las que dijo el cliente o confirmaste vos; las hipótesis no.</small>`:emptyState("🔎","Todavía no hay objeciones confirmadas","Aparecen cuando un cliente responde «¿Qué te falta para decidir?» o cuando confirmás un diagnóstico en «Destrabar venta».")}
  <small class="dv-hint">Una mejora de diseño no se considera «ventas»: compará estos números a lo largo de varias semanas antes de sacar conclusiones.</small>`;
}


/* ===== v40 (parte 3): creador en 3 pasos con borrador automático ===== */
var _wizStep=1, _wizNoDraft=false, _draftT=0;
const DRAFT_KEY=()=>"cc_draft_"+((currentUser&&currentUser.id)||"demo");
const DRAFT_FIELDS=["clientName","clientPhone","proposalTitle","proposalExpires","includes","excludes","deliveryTime","conditions","cashDiscount","depositPct","bonusText","bonusHours","slotsLeft","slotsLabel","holdHours"];
const WIZ_LABELS=["Cliente","Oferta","Revisar y compartir"];
function wizGo(n){
  const f=$("#proposalForm"); if(!f) return; _wizStep=Math.max(1,Math.min(3,n)); f.dataset.step=String(_wizStep);
  $$("#wizSteps li").forEach(li=>{const k=+li.dataset.wstep; li.classList.toggle("on",k===_wizStep); li.classList.toggle("done",k<_wizStep); if(k===_wizStep) li.setAttribute("aria-current","step"); else li.removeAttribute("aria-current");});
  const lb=$("#wizLabel"); if(lb) lb.textContent=`Paso ${_wizStep} de 3 · ${WIZ_LABELS[_wizStep-1]}`;
  if(_wizStep===3) renderBuilderPreview();
  const d=$("#builderModal .modal-dialog"); if(d) d.scrollTop=0;
}
function wizPrefilled(step){_wizNoDraft=true; const b=$("#draftBanner"); if(b) b.remove(); wizGo(step||2);}
function wizClearErrors(){$$("#proposalForm .field-err").forEach(x=>x.remove()); const s=$("#wizErr"); if(s){s.hidden=true; s.textContent="";}}
function wizValidate(n){
  wizClearErrors(); const errs=[];
  if(n>=1){const ph=normalizePhone($("#clientPhone").value); if(ph.length<8||ph.length>15) errs.push(["clientPhone","Ingresá un WhatsApp válido, con código de área (ej: 3511234567)."]);}
  if(n>=2){
    if(!$("#proposalTitle").value.trim()) errs.push(["proposalTitle","Poné un título para la propuesta."]);
    const exp=$("#proposalExpires").value; if(!/^\d{4}-\d{2}-\d{2}$/.test(exp)||exp<isoDate(Date.now())) errs.push(["proposalExpires","Elegí una fecha de vencimiento de hoy en adelante."]);
    if(!builderOptions.some(o=>String(o.name||"").trim()&&Number(o.price)>0)) errs.push(["optionsList","Cargá al menos una opción con nombre y precio mayor a 0."]);
  }
  errs.forEach(([id,msg])=>{const el=$("#"+id); if(!el) return; const s=document.createElement("small"); s.className="field-err"; s.setAttribute("role","alert"); s.textContent=msg; el.insertAdjacentElement("afterend",s);});
  if(errs.length){const s=$("#wizErr"); if(s){s.textContent=`Revisá ${errs.length===1?"un dato":errs.length+" datos"} antes de seguir.`; s.hidden=false;} const first=$("#"+errs[0][0]); if(first&&first.focus) try{first.focus();}catch(e){}}
  return !errs.length;
}
document.addEventListener("click",ev=>{
  const T=ev.target&&ev.target.closest?ev.target:null; if(!T||!T.closest("#builderModal")) return;
  if(T.closest("#wizNext")){ if(wizValidate(_wizStep)) wizGo(_wizStep+1); return; }
  if(T.closest("#wizBack")){ wizClearErrors(); wizGo(_wizStep-1); return; }
  const g=T.closest("[data-wiz-go]"); if(g){wizClearErrors(); wizGo(+g.dataset.wizGo); return;}
  if(T.closest("#draftUse")) return applyDraft();
  if(T.closest("#draftDrop")){clearDraft(); const b=$("#draftBanner"); if(b) b.remove(); toast("Borrador descartado.");}
});
// El botón «Crear y compartir» solo existe en el paso 3, pero si alguien presiona Enter en un campo se valida igual.
document.addEventListener("submit",ev=>{
  if(!(ev.target&&ev.target.id==="proposalForm")) return;
  if(_wizStep<3){ev.preventDefault(); ev.stopImmediatePropagation(); if(wizValidate(_wizStep)) wizGo(_wizStep+1); return;}
  if(!wizValidate(3)){ev.preventDefault(); ev.stopImmediatePropagation(); wizGo(normalizePhone($("#clientPhone").value).length<8?1:2);}
},true);

/* ---- borrador automático (en este dispositivo) ---- */
function draftData(){
  const fields={}; DRAFT_FIELDS.forEach(id=>{const el=$("#"+id); if(el) fields[id]=el.value;});
  return {at:Date.now(),step:_wizStep,kind:builderKind,pays:selectedPayments(),fields,options:builderOptions.map(({photo,photos,_open,...o})=>o)};
}
const draftHasContent=d=>!!d&&!!(String(d.fields.clientName||"").trim()||String(d.fields.clientPhone||"").trim()||(d.options||[]).some(o=>String(o.name||"").trim()||Number(o.price)>0));
function saveDraft(){
  if(_wizNoDraft||!currentUser) return; const st=$("#draftState"), d=draftData();
  if(!draftHasContent(d)) return;
  try{localStorage.setItem(DRAFT_KEY(),JSON.stringify(d)); if(st) st.textContent="Borrador guardado en este dispositivo ✓";}
  catch(e){if(st) st.textContent="No se pudo guardar el borrador (sin espacio en el navegador).";}
}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY());}catch(e){} const st=$("#draftState"); if(st) st.textContent="";}
function onProposalCreated(){recordBuildTime(); clearDraft();}
function offerDraft(){
  const f=$("#proposalForm"); if(!f) return; const old=$("#draftBanner"); if(old) old.remove();
  let d=null; try{d=JSON.parse(localStorage.getItem(DRAFT_KEY())||"null");}catch(e){}
  if(!draftHasContent(d)) return;
  const b=document.createElement("div"); b.id="draftBanner"; b.className="draft-banner"; b.setAttribute("role","region"); b.setAttribute("aria-label","Borrador guardado");
  b.innerHTML=`<span>📝 Tenés un borrador sin terminar (${relativeTime(new Date(d.at).toISOString())}). Las fotos y el audio no se guardan en los borradores.</span><span class="draft-btns"><button type="button" class="btn btn-secondary btn-sm" id="draftUse">Continuar</button><button type="button" class="text-btn" id="draftDrop">Descartar</button></span>`;
  f.prepend(b);
}
function applyDraft(){
  let d=null; try{d=JSON.parse(localStorage.getItem(DRAFT_KEY())||"null");}catch(e){} if(!d) return toast("No se pudo leer el borrador.");
  builderKind=d.kind||"service"; $$('input[name="kind"]').forEach(r=>{r.checked=r.value===builderKind;});
  DRAFT_FIELDS.forEach(id=>{const el=$("#"+id); if(el&&d.fields&&d.fields[id]!==undefined) el.value=d.fields[id];});
  $$('input[name="pay"]').forEach(c=>{c.checked=(d.pays||[]).includes(c.value);});
  builderOptions=(d.options&&d.options.length?d.options:[{}]).map(o=>newOption({...o,_open:true})); renderOptionEditors(); renderCatalog(); renderBuilderPreview();
  const b=$("#draftBanner"); if(b) b.remove(); wizGo(d.step||1); toast("Borrador recuperado.");
}
document.addEventListener("input",e=>{
  if(!(e.target&&e.target.closest&&e.target.closest("#proposalForm"))) return;
  clearTimeout(_draftT); _draftT=setTimeout(saveDraft,700);
});
document.addEventListener("change",e=>{
  if(!(e.target&&e.target.closest&&e.target.closest("#proposalForm"))) return;
  clearTimeout(_draftT); _draftT=setTimeout(saveDraft,700);
});
