const STORAGE_KEY = "cierraclick_mvp_v1";

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
  s.proposals.forEach(p=>{p.kind=p.kind||"service";p.options=p.options.map(normalizeOption);});
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
  builderOptions=[
    newOption({name:"Básica",price:850000,description:"Servicio básico",hasInstallments:true,installments:6,hasWarranty:true,warranty:"3 meses"}),
    newOption({name:"Recomendada",price:1050000,description:"Servicio completo",hasInstallments:true,installments:8,hasWarranty:true,warranty:"6 meses",recommended:true}),
    newOption({name:"Premium",price:1350000,description:"Servicio premium",hasInstallments:true,installments:12,hasWarranty:true,warranty:"12 meses"})
  ];
  renderOptionEditors();
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
        <label class="chk"><input type="checkbox" data-field="recommended" ${o.recommended&&!one?"checked":""} ${one?"disabled":""}> Recomendada ⭐</label>
        <button type="button" class="text-btn danger" data-remove ${one?"disabled":""}>Quitar</button>
      </div>
      <label>Nombre<input data-field="name" value="${escapeHtml(o.name)}"></label>
      <label>Precio<input data-field="price" type="number" min="0" step="any" value="${o.price}"></label>
      <label>Descuento<span class="inline"><input data-field="discountValue" type="number" min="0" step="any" value="${o.discountValue}"><select data-field="discountType"><option value="percent" ${o.discountType==="percent"?"selected":""}>%</option><option value="fixed" ${o.discountType==="fixed"?"selected":""}>$</option></select></span></label>
      <label class="full">Descripción<input data-field="description" placeholder="${escapeHtml(ph)}" value="${escapeHtml(o.description)}"></label>
      <div class="toggle"><label class="chk"><input type="checkbox" data-field="hasInstallments" ${o.hasInstallments?"checked":""}> Ofrecer cuotas</label><input data-field="installments" type="number" min="2" value="${o.installments}" ${o.hasInstallments?"":"disabled"} aria-label="Cantidad de cuotas"></div>
      <div class="toggle"><label class="chk"><input type="checkbox" data-field="hasWarranty" ${o.hasWarranty?"checked":""}> Incluir garantía</label><input data-field="warranty" value="${escapeHtml(o.warranty)}" placeholder="Ej: 6 meses" ${o.hasWarranty?"":"disabled"}></div>
      <label class="full">Características (una por línea)<textarea data-field="features" rows="3" placeholder="Ej: Envío gratis&#10;Instalación incluida">${escapeHtml(o.features)}</textarea></label>
      <label class="full">Términos y condiciones de esta opción<textarea data-field="terms" rows="2">${escapeHtml(o.terms)}</textarea></label>
      <div class="option-total full" data-total>${totalText(o)}</div>
    </div>`).join("");
  $("#addOption").disabled=builderOptions.length>=MAX_OPTIONS;
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
  builderKind=k; renderOptionEditors(); renderBuilderPreview();
}

function collectBuilderData(){
  const options=builderOptions.map(o=>{
    const warranty=String(o.warranty).trim();
    return {...o,
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
    validity:$("#proposalValidity").value.trim(),
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
      ${d>0?`<span class="disc">${badge}</span>`:""}
      ${o.hasInstallments&&o.installments>1?`<p>${o.installments} cuotas de ${money(fin/o.installments)}</p>`:""}
      ${o.description?`<p>${escapeHtml(o.description)}</p>`:""}
      ${o.hasWarranty&&o.warranty?`<p>Garantía: ${escapeHtml(o.warranty)}</p>`:""}
      ${(o.features||"").trim()?`<ul class="feat">${o.features.split("\n").map(x=>x.trim()).filter(Boolean).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}
      ${(o.terms||"").trim()?`<details class="terms"><summary>Términos y condiciones</summary><p>${escapeHtml(o.terms)}</p></details>`:""}
      ${mode==="full"&&multi?`<button class="select" data-select-option="${escapeHtml(o.id)}">Elegir ${escapeHtml(o.name)}</button>`:""}
    </article>`;
}

function publicProposalMarkup(p, mode="full"){
  const multi=p.options.length>1;
  const includes=(p.includes||[]).map(x=>`<div class="include">✓ ${escapeHtml(x)}</div>`).join("");
  return `
    <div class="public-card" data-public-id="${escapeHtml(p.id)}">
      <div class="public-brand">${escapeHtml(state.business.name).toUpperCase()}</div>
      <div class="public-greeting">Hola ${escapeHtml(p.client.name)} 👋</div>
      <div class="public-title">${escapeHtml(p.title)}</div>
      <div class="choice-grid n${p.options.length}">${p.options.map(o=>optionMarkup(p,o,mode)).join("")}</div>
      <div class="public-includes">${includes}</div>
      <p style="color:#64748b;font-size:13px">${escapeHtml(p.conditions)}</p>
      <div class="public-actions">
        ${mode==="full"?`<button class="public-seña" id="acceptBtn">${multi?"Quiero esta opción":"Quiero esto"}</button>`:''}
        ${mode==="full"?`<a class="public-whatsapp" id="publicWhatsapp" href="#" target="_blank" rel="noopener">Hablar por WhatsApp</a>`:""}
      </div>
      <div class="public-foot">Válida por ${escapeHtml(p.validity)} · Propuesta digital CierraClick</div>
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
    validity:$("#proposalValidity").value||"7 días",
    includes:$("#includes").value.split("\n").map(x=>x.trim()).filter(Boolean),
    conditions:$("#conditions").value||"La reserva se confirma con la seña.",
    options:builderOptions.map(o=>({...o,hasWarranty:o.hasWarranty&&!!String(o.warranty).trim(),installments:Number(o.installments)||2,recommended:o.recommended&&builderOptions.length>1}))
  };
  $("#builderPreview").innerHTML=publicProposalMarkup(p,"preview");
}

function openBuilder(){
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

function openPublic(id){
  const p=state.proposals.find(x=>x.id===id); if(!p) return;
  currentProposalId=id;
  p.views=(p.views||0)+1;
  if(p.status==="sent") p.status="viewed";
  p.lastEvent="Cliente abrió la propuesta.";
  state.activity.unshift({icon:"👀",text:`${p.client.name} abrió una propuesta.`,time:"Ahora"});
  saveState();
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
  const paymentUrl=state.business.paymentLink||"";
  $("#publicContent").innerHTML=`
    <div class="public-card">
      <div class="public-brand">${escapeHtml(state.business.name).toUpperCase()}</div>
      <div class="public-greeting">¡Excelente, ${escapeHtml(p.client.name)}! ✅</div>
      <p style="color:#64748b">Tu elección quedó registrada: <strong>${escapeHtml(option.name)}</strong> · ${money(finalPrice(option))}</p>
      <div class="card" style="margin-top:16px;background:#f8fafc">
        <strong>Para reservar la operación</strong>
        <p style="color:#64748b;margin-bottom:0">Aboná la seña mediante el link de pago del vendedor.</p>
      </div>
      <div class="public-actions">
        ${paymentUrl?`<a class="public-seña" href="${escapeHtml(paymentUrl)}" target="_blank" rel="noopener" id="depositLink">PAGAR SEÑA</a>`:`<button class="public-seña" id="depositDemo">PAGAR SEÑA (DEMO)</button>`}
        <a class="public-whatsapp" href="https://wa.me/${normalizePhone(state.business.whatsapp)}?text=${encodeURIComponent(`Hola ${state.business.name} 👋 Acepté la propuesta y quiero avanzar con la seña.`)}" target="_blank" rel="noopener">Escribir al vendedor</a>
      </div>
    </div>`;
  if($("#depositLink")) $("#depositLink").addEventListener("click",()=>{p.depositStarted=(p.depositStarted||0)+1;saveState();});
  $("#depositDemo")?.addEventListener("click",()=>{p.depositStarted=(p.depositStarted||0)+1;saveState();toast("Demo: acá se conectará el link de Mercado Pago.");});
}

function renderDashboard(){
  const proposals=state.proposals||[];
  const views=proposals.reduce((s,p)=>s+(p.views||0),0);
  const accepted=proposals.filter(p=>p.status==="accepted").length;
  $("#metricProposals").textContent=proposals.length;
  $("#metricViews").textContent=views;
  $("#metricAccepted").textContent=accepted;
  $("#metricConversion").textContent=proposals.length?`${Math.round(accepted/proposals.length*100)}%`:"0%";

  $("#hotList").innerHTML=proposals.slice(0,5).map(p=>`
    <div class="proposal-item">
      <div><strong>${escapeHtml(p.client.name)}</strong><span>${money(finalPrice(chosenOf(p)))} · ${p.views||0} vistas</span></div>
      <div><span class="status">${statusLabel(p.status)}</span><button class="text-btn" data-open="${p.id}">Abrir</button></div>
    </div>`).join("") || '<p style="color:#64748b">Todavía no hay propuestas.</p>';

  $("#activityList").innerHTML=(state.activity||[]).slice(0,6).map(a=>`<div class="activity"><b>${a.icon}</b><div>${escapeHtml(a.text)}<br><span style="color:#94a3b8">${escapeHtml(a.time)}</span></div></div>`).join("");
  $("#proposalTable").innerHTML=proposals.map(p=>`
    <tr><td><strong>${escapeHtml(p.client.name)}</strong><br><small>${escapeHtml(p.title)}</small></td>
    <td>${money(finalPrice(chosenOf(p)))}</td>
    <td><span class="badge ${p.status}">${statusLabel(p.status)}</span></td>
    <td>${p.views||0}</td><td>${relativeTime(p.createdAt)}</td>
    <td><button class="text-btn" data-open="${p.id}">Ver</button></td></tr>`).join("");
  $("#clientsGrid").innerHTML=(state.clients||[]).map(c=>`<div class="client"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.phone)}</p><p>${c.proposals||0} propuesta(s)</p></div>`).join("");
  renderPerformance();
  $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openPublic(b.dataset.open)));
}
function statusLabel(s){return ({sent:"Enviada",viewed:"Vista",accepted:"Aceptada",lost:"Perdida"}[s]||"Enviada")}

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

  $$("[data-nav]").forEach(el=>el.addEventListener("click",()=>nav(el.dataset.nav)));
  $("#headerCta").addEventListener("click",openBuilder);
  $("#heroCta").addEventListener("click",openBuilder);
  $("#sideCreate").addEventListener("click",openBuilder);
  $("#overviewCreate").addEventListener("click",openBuilder);
  $("#proposalCreate").addEventListener("click",openBuilder);
  $("#proposalForm").addEventListener("submit",createProposal);
  $("#optionsList").addEventListener("input",onOptionInput);
  $("#optionsList").addEventListener("click",e=>{
    if(!e.target.matches("[data-remove]")||builderOptions.length<2) return;
    builderOptions.splice(+e.target.closest("[data-idx]").dataset.idx,1);
    if(builderOptions.length===1) builderOptions[0].recommended=false;
    renderOptionEditors(); renderBuilderPreview();
  });
  $("#addOption").addEventListener("click",()=>{
    if(builderOptions.length>=MAX_OPTIONS) return;
    builderOptions.push(newOption({name:`Opción ${builderOptions.length+1}`}));
    renderOptionEditors(); renderBuilderPreview();
  });
  $$('input[name="kind"]').forEach(r=>r.addEventListener("change",()=>setKind(r.value)));
  $$("[data-close]").forEach(el=>el.addEventListener("click",()=>closeModal(el.dataset.close==="builder"?"builderModal":"publicModal")));
  $$(".side-link").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));
  $$(".text-btn[data-panel]").forEach(el=>el.addEventListener("click",()=>showPanel(el.dataset.panel)));

  $("#settingsForm").addEventListener("submit",e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    state.business={...state.business,businessName:undefined,name:fd.get("businessName"),whatsapp:fd.get("whatsapp"),paymentLink:fd.get("paymentLink"),brandColor:fd.get("brandColor")};
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
