const cfg=window.APP_CONFIG;
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const state={
  profile:localStorage.getItem("couple_profile"),
  settings:{id:1,partner_one:"진성",partner_two:"성은"},
  shopping:[],trips:[],records:[]
};

const els={
  profileScreen:$("#profileScreen"),app:$("#app"),toast:$("#toast"),
  oneName:$("#profileOneName"),twoName:$("#profileTwoName"),
  today:$("#todayText"),pageTitle:$("#pageTitle"),welcome:$("#welcomeName"),
  shoppingCount:$("#shoppingCount"),tripCount:$("#tripCount"),todoCount:$("#todoCount"),monthCount:$("#monthCount"),
  homeShopping:$("#homeShopping"),homeTrips:$("#homeTrips"),
  shoppingList:$("#shoppingList"),tripList:$("#tripList"),recordList:$("#recordList"),
  recordWriter:$("#recordWriter"),currentProfile:$("#currentProfileText")
};

function toast(msg){
  els.toast.textContent=msg;els.toast.hidden=false;
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>els.toast.hidden=true,2500);
}
function iso(d=new Date()){return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtDate(v){return v?new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric"}).format(new Date(v+"T00:00:00")):""}
function currentName(){return state.profile==="one"?state.settings.partner_one:state.settings.partner_two}

async function loadAll(){
  const [s1,s2,s3,s4]=await Promise.all([
    sb.from("couple_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("shopping_items").select("*").order("created_at",{ascending:false}),
    sb.from("travel_plans").select("*").order("start_date",{ascending:true}),
    sb.from("couple_items").select("*").order("created_at",{ascending:false})
  ]);
  if(s1.data) state.settings={...state.settings,...s1.data};
  if(s2.error||s3.error||s4.error) toast("데이터를 불러오지 못했습니다.");
  state.shopping=s2.data||[];
  state.trips=s3.data||[];
  state.records=s4.data||[];
  renderAll();
}

function openApp(){
  els.profileScreen.hidden=true;
  els.app.hidden=false;
  loadAll();
}
function chooseProfile(profile){
  state.profile=profile;
  localStorage.setItem("couple_profile",profile);
  openApp();
}
function switchView(view){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#"+view+"View").classList.add("active");
  $$(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  els.pageTitle.textContent={home:"홈",shopping:"장보기",travel:"여행",records:"기록",settings:"설정"}[view];
}

function renderAll(){
  els.oneName.textContent=state.settings.partner_one;
  els.twoName.textContent=state.settings.partner_two;
  els.welcome.textContent=`${currentName()}님, 안녕하세요`;
  els.currentProfile.textContent=`이 기기 사용자: ${currentName()}`;

  $("#partnerOneInput").value=state.settings.partner_one;
  $("#partnerTwoInput").value=state.settings.partner_two;

  els.recordWriter.innerHTML="";
  [state.settings.partner_one,state.settings.partner_two].forEach(n=>els.recordWriter.add(new Option(n,n)));

  const now=new Date();
  els.shoppingCount.textContent=state.shopping.filter(x=>!x.completed).length;
  els.tripCount.textContent=state.trips.filter(x=>!x.end_date||x.end_date>=iso()).length;
  els.todoCount.textContent=state.records.filter(x=>x.category==="할 일"&&!x.completed).length;
  els.monthCount.textContent=state.records.filter(x=>{
    const d=new Date(x.created_at);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).length;

  renderMini(els.homeShopping,state.shopping.filter(x=>!x.completed).slice(0,4).map(x=>({
    title:x.item_name,meta:[x.quantity,x.store].filter(Boolean).join(" · ")
  })),"살 물건이 없습니다.");

  renderMini(els.homeTrips,state.trips.filter(x=>!x.end_date||x.end_date>=iso()).slice(0,3).map(x=>({
    title:x.title,meta:[fmtDate(x.start_date),fmtDate(x.end_date)].filter(Boolean).join(" ~ ")
  })),"예정된 여행이 없습니다.");

  renderShopping();
  renderTrips();
  renderRecords();
}

function renderMini(container,list,emptyText){
  container.innerHTML="";
  if(!list.length){container.innerHTML=`<div class="empty">${emptyText}</div>`;return;}
  list.forEach(x=>{
    const row=document.createElement("div");
    row.className="list-item";
    row.innerHTML="<div></div><div><strong></strong><div class='meta'></div></div><div></div>";
    row.querySelector("strong").textContent=x.title;
    row.querySelector(".meta").textContent=x.meta||"";
    container.append(row);
  });
}

async function addShopping(){
  const item=$("#shopItem").value.trim();
  if(!item)return toast("살 물건을 입력하세요.");
  const {error}=await sb.from("shopping_items").insert({
    item_name:item,
    quantity:$("#shopQty").value.trim()||null,
    store:$("#shopStore").value||null,
    completed:false,
    writer:currentName()
  });
  if(error)return toast("추가하지 못했습니다.");
  $("#shopItem").value="";$("#shopQty").value="";
  await loadAll();
}
async function toggleShopping(item){
  await sb.from("shopping_items").update({completed:!item.completed}).eq("id",item.id);
  await loadAll();
}
async function removeRow(table,id,message="삭제할까요?"){
  if(!confirm(message))return;
  await sb.from(table).delete().eq("id",id);
  await loadAll();
}
function renderShopping(){
  els.shoppingList.innerHTML="";
  if(!state.shopping.length){els.shoppingList.innerHTML='<div class="empty">쇼핑리스트가 비어 있습니다.</div>';return;}
  state.shopping.forEach(x=>{
    const row=document.createElement("div");
    row.className=`list-item ${x.completed?"done":""}`;

    const check=document.createElement("button");
    check.className="check-button";check.textContent=x.completed?"✓":"";
    check.onclick=()=>toggleShopping(x);

    const body=document.createElement("div");
    body.innerHTML="<strong></strong><div class='meta'></div>";
    body.querySelector("strong").textContent=x.item_name;
    body.querySelector(".meta").textContent=[x.quantity,x.store,x.writer].filter(Boolean).join(" · ");

    const del=document.createElement("button");
    del.className="delete-button";del.textContent="삭제";
    del.onclick=()=>removeRow("shopping_items",x.id);

    row.append(check,body,del);
    els.shoppingList.append(row);
  });
}

async function addTrip(){
  const title=$("#tripTitle").value.trim();
  if(!title)return toast("여행 이름이나 목적지를 입력하세요.");
  const {error}=await sb.from("travel_plans").insert({
    title,
    start_date:$("#tripStart").value||null,
    end_date:$("#tripEnd").value||null,
    memo:$("#tripMemo").value.trim()||null,
    writer:currentName()
  });
  if(error)return toast("여행 계획을 추가하지 못했습니다.");
  $("#tripTitle").value="";$("#tripStart").value="";$("#tripEnd").value="";$("#tripMemo").value="";
  await loadAll();
}
function renderTrips(){
  els.tripList.innerHTML="";
  if(!state.trips.length){els.tripList.innerHTML='<div class="empty">등록된 여행 계획이 없습니다.</div>';return;}
  state.trips.forEach(x=>{
    const card=document.createElement("article");
    card.className="trip-card";

    const title=document.createElement("strong");title.textContent=x.title;
    const meta=document.createElement("div");meta.className="meta";
    meta.textContent=[fmtDate(x.start_date),fmtDate(x.end_date),x.writer].filter(Boolean).join(" ~ ");
    const memo=document.createElement("p");memo.textContent=x.memo||"메모 없음";
    const del=document.createElement("button");del.className="delete-button";del.textContent="삭제";
    del.onclick=()=>removeRow("travel_plans",x.id,"여행 계획을 삭제할까요?");

    card.append(title,meta,memo,del);
    els.tripList.append(card);
  });
}

async function addRecord(){
  const content=$("#recordContent").value.trim();
  if(!content)return toast("내용을 입력하세요.");
  const {error}=await sb.from("couple_items").insert({
    content,
    category:$("#recordCategory").value,
    writer:els.recordWriter.value,
    completed:false,
    event_date:$("#recordDate").value||null,
    amount:$("#recordAmount").value?Number($("#recordAmount").value):null
  });
  if(error)return toast("기록을 추가하지 못했습니다.");
  $("#recordContent").value="";$("#recordDate").value="";$("#recordAmount").value="";
  await loadAll();
}
async function toggleRecord(item){
  await sb.from("couple_items").update({completed:!item.completed}).eq("id",item.id);
  await loadAll();
}
function renderRecords(){
  els.recordList.innerHTML="";
  if(!state.records.length){els.recordList.innerHTML='<div class="empty">아직 기록이 없습니다.</div>';return;}
  state.records.forEach(x=>{
    const row=document.createElement("div");
    row.className=`list-item ${x.completed?"done":""}`;

    const check=document.createElement("button");
    check.className="check-button";check.textContent=x.completed?"✓":"";
    check.onclick=()=>toggleRecord(x);

    const body=document.createElement("div");
    body.innerHTML="<strong></strong><div class='meta'></div>";
    body.querySelector("strong").textContent=x.content;
    body.querySelector(".meta").textContent=[
      x.category,x.writer,x.event_date?fmtDate(x.event_date):null,
      x.amount!=null?`${Number(x.amount).toLocaleString("ko-KR")}원`:null
    ].filter(Boolean).join(" · ");

    const del=document.createElement("button");
    del.className="delete-button";del.textContent="삭제";
    del.onclick=()=>removeRow("couple_items",x.id);

    row.append(check,body,del);
    els.recordList.append(row);
  });
}

async function saveSettings(){
  const payload={
    id:1,
    partner_one:$("#partnerOneInput").value.trim()||"진성",
    partner_two:$("#partnerTwoInput").value.trim()||"성은"
  };
  const {error}=await sb.from("couple_settings").upsert(payload);
  if(error)return toast("설정을 저장하지 못했습니다.");
  state.settings={...state.settings,...payload};
  renderAll();
  toast("설정을 저장했습니다.");
}

$$(".profile-choice").forEach(b=>b.onclick=()=>chooseProfile(b.dataset.profile));
$$(".nav-button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
$("#settingsShortcut").onclick=()=>switchView("settings");
$("#addShop").onclick=addShopping;
$("#clearBought").onclick=async()=>{
  await sb.from("shopping_items").delete().eq("completed",true);
  await loadAll();
};
$("#addTrip").onclick=addTrip;
$("#addRecord").onclick=addRecord;
$("#saveSettings").onclick=saveSettings;
$("#changeProfile").onclick=()=>{
  localStorage.removeItem("couple_profile");
  state.profile=null;
  els.app.hidden=true;
  els.profileScreen.hidden=false;
};

$("#recordCategory").onchange=()=>{
  const value=$("#recordCategory").value;
  $("#recordExtra").hidden=!["일정","가계부"].includes(value);
  $("#recordDate").style.display=value==="일정"?"block":"none";
  $("#recordAmount").style.display=value==="가계부"?"block":"none";
};
$("#recordCategory").dispatchEvent(new Event("change"));

els.today.textContent=new Intl.DateTimeFormat("ko-KR",{
  year:"numeric",month:"long",day:"numeric",weekday:"long"
}).format(new Date());

if(state.profile) openApp();

sb.channel("couple-v4-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"shopping_items"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"travel_plans"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"couple_items"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"couple_settings"},loadAll)
  .subscribe();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
}
