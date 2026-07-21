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
  shoppingCount:$("#shoppingCount"),tripCount:$("#tripCount"),todoCount:$("#todoCount"),
  homeExpenseTotal:$("#homeExpenseTotal"),
  homeShopping:$("#homeShopping"),homeTrips:$("#homeTrips"),
  shoppingList:$("#shoppingList"),tripList:$("#tripList"),
  currentProfile:$("#currentProfileText"),
  moneyWriter:$("#moneyWriter"),moneyList:$("#moneyList"),
  monthExpenseTotal:$("#monthExpenseTotal"),monthExpenseCount:$("#monthExpenseCount")
};

function toast(msg){
  els.toast.textContent=msg;els.toast.hidden=false;
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>els.toast.hidden=true,2500);
}
function iso(d=new Date()){return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtDate(v){return v?new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric"}).format(new Date(v+"T00:00:00")):""}
function money(v){return `${Number(v||0).toLocaleString("ko-KR")}원`}
function currentName(){return state.profile==="one"?state.settings.partner_one:state.settings.partner_two}

async function loadAll(){
  const [s1,s2,s3,s4]=await Promise.all([
    sb.from("couple_settings").select("*").eq("id",1).maybeSingle(),
    sb.from("shopping_items").select("*").order("created_at",{ascending:false}),
    sb.from("travel_plans").select("*").order("start_date",{ascending:true}),
    sb.from("couple_items").select("*").order("created_at",{ascending:false})
  ]);
  if(s1.data) state.settings={...state.settings,...s1.data};
  state.shopping=s2.data||[];
  state.trips=s3.data||[];
  state.records=s4.data||[];
  if(s2.error||s3.error||s4.error) toast("데이터를 불러오지 못했습니다.");
  renderAll();
}

function openApp(){
  els.profileScreen.hidden=true;
  els.app.hidden=false;
  loadAll().then(handleLaunchRoute);
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
  els.pageTitle.textContent={home:"홈",shopping:"장보기",travel:"여행",money:"가계부",settings:"설정"}[view];
  if(view==="money") setTimeout(()=>$("#moneyAmount")?.focus(),120);
}

function renderAll(){
  els.oneName.textContent=state.settings.partner_one;
  els.twoName.textContent=state.settings.partner_two;
  els.welcome.textContent=`${currentName()}님, 안녕하세요`;
  els.currentProfile.textContent=`이 기기 사용자: ${currentName()}`;

  $("#partnerOneInput").value=state.settings.partner_one;
  $("#partnerTwoInput").value=state.settings.partner_two;

  els.moneyWriter.innerHTML="";
  [state.settings.partner_one,state.settings.partner_two].forEach(n=>els.moneyWriter.add(new Option(n,n)));

  const now=new Date();
  const monthlyExpenses=state.records.filter(x=>{
    if(x.category!=="가계부"||x.amount==null)return false;
    const d=x.event_date?new Date(x.event_date+"T00:00:00"):new Date(x.created_at);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  const monthlyTotal=monthlyExpenses.reduce((sum,x)=>sum+Number(x.amount||0),0);

  els.shoppingCount.textContent=state.shopping.filter(x=>!x.completed).length;
  els.tripCount.textContent=state.trips.filter(x=>!x.end_date||x.end_date>=iso()).length;
  els.todoCount.textContent=state.records.filter(x=>x.category==="할 일"&&!x.completed).length;
  els.homeExpenseTotal.textContent=money(monthlyTotal);
  els.monthExpenseTotal.textContent=money(monthlyTotal);
  els.monthExpenseCount.textContent=`${monthlyExpenses.length}건`;

  renderMini(els.homeShopping,state.shopping.filter(x=>!x.completed).slice(0,4).map(x=>({
    title:x.item_name,meta:[x.quantity,x.store].filter(Boolean).join(" · ")
  })),"살 물건이 없습니다.");

  renderMini(els.homeTrips,state.trips.filter(x=>!x.end_date||x.end_date>=iso()).slice(0,3).map(x=>({
    title:x.title,meta:[fmtDate(x.start_date),fmtDate(x.end_date)].filter(Boolean).join(" ~ ")
  })),"예정된 여행이 없습니다.");

  renderShopping();
  renderTrips();
  renderMoney(monthlyExpenses);
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
    item_name:item,quantity:$("#shopQty").value.trim()||null,
    store:$("#shopStore").value||null,completed:false,writer:currentName()
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
    check.className="check-button";check.textContent=x.completed?"✓":"";check.onclick=()=>toggleShopping(x);
    const body=document.createElement("div");
    body.innerHTML="<strong></strong><div class='meta'></div>";
    body.querySelector("strong").textContent=x.item_name;
    body.querySelector(".meta").textContent=[x.quantity,x.store,x.writer].filter(Boolean).join(" · ");
    const del=document.createElement("button");
    del.className="delete-button";del.textContent="삭제";del.onclick=()=>removeRow("shopping_items",x.id);
    row.append(check,body,del);els.shoppingList.append(row);
  });
}

async function addTrip(){
  const title=$("#tripTitle").value.trim();
  if(!title)return toast("여행 이름이나 목적지를 입력하세요.");
  const {error}=await sb.from("travel_plans").insert({
    title,start_date:$("#tripStart").value||null,end_date:$("#tripEnd").value||null,
    memo:$("#tripMemo").value.trim()||null,writer:currentName()
  });
  if(error)return toast("여행 계획을 추가하지 못했습니다.");
  $("#tripTitle").value="";$("#tripStart").value="";$("#tripEnd").value="";$("#tripMemo").value="";
  await loadAll();
}
function renderTrips(){
  els.tripList.innerHTML="";
  if(!state.trips.length){els.tripList.innerHTML='<div class="empty">등록된 여행 계획이 없습니다.</div>';return;}
  state.trips.forEach(x=>{
    const card=document.createElement("article");card.className="trip-card";
    const title=document.createElement("strong");title.textContent=x.title;
    const meta=document.createElement("div");meta.className="meta";
    meta.textContent=[fmtDate(x.start_date),fmtDate(x.end_date),x.writer].filter(Boolean).join(" ~ ");
    const memo=document.createElement("p");memo.textContent=x.memo||"메모 없음";
    const del=document.createElement("button");del.className="delete-button";del.textContent="삭제";
    del.onclick=()=>removeRow("travel_plans",x.id,"여행 계획을 삭제할까요?");
    card.append(title,meta,memo,del);els.tripList.append(card);
  });
}

async function addMoney(){
  const amount=Number($("#moneyAmount").value);
  const content=$("#moneyContent").value.trim();
  if(!amount||amount<=0)return toast("금액을 입력하세요.");
  if(!content)return toast("사용한 곳이나 내용을 입력하세요.");
  const {error}=await sb.from("couple_items").insert({
    content,
    category:"가계부",
    writer:els.moneyWriter.value,
    completed:false,
    event_date:$("#moneyDate").value||iso(),
    amount,
    expense_group:$("#moneyCategory").value
  });
  if(error)return toast("지출을 저장하지 못했습니다.");
  $("#moneyAmount").value="";$("#moneyContent").value="";
  $("#moneyDate").value=iso();
  toast("지출을 저장했습니다.");
  await loadAll();
}
function renderMoney(list){
  els.moneyList.innerHTML="";
  if(!list.length){els.moneyList.innerHTML='<div class="empty">이번 달 지출 내역이 없습니다.</div>';return;}
  list.sort((a,b)=>(b.event_date||"").localeCompare(a.event_date||""));
  list.forEach(x=>{
    const row=document.createElement("div");row.className="money-row";
    const body=document.createElement("div");
    body.innerHTML="<strong></strong><div class='meta'></div>";
    body.querySelector("strong").textContent=x.content;
    body.querySelector(".meta").textContent=[x.expense_group,x.writer,fmtDate(x.event_date)].filter(Boolean).join(" · ");
    const right=document.createElement("div");
    const amount=document.createElement("div");amount.className="amount";amount.textContent=money(x.amount);
    const del=document.createElement("button");del.className="delete-button";del.textContent="삭제";
    del.onclick=()=>removeRow("couple_items",x.id,"이 지출 내역을 삭제할까요?");
    right.append(amount,del);
    row.append(body,right);els.moneyList.append(row);
  });
}

async function saveSettings(){
  const payload={id:1,partner_one:$("#partnerOneInput").value.trim()||"진성",partner_two:$("#partnerTwoInput").value.trim()||"성은"};
  const {error}=await sb.from("couple_settings").upsert(payload);
  if(error)return toast("설정을 저장하지 못했습니다.");
  state.settings={...state.settings,...payload};renderAll();toast("설정을 저장했습니다.");
}

function openQuickMoney(){
  switchView("money");
  const panel=$(".quick-money-panel");
  panel?.classList.remove("quick-money-focus");
  requestAnimationFrame(()=>panel?.classList.add("quick-money-focus"));
  setTimeout(()=>$("#moneyAmount")?.focus(),150);
}
function handleLaunchRoute(){
  const params=new URLSearchParams(location.search);
  if(params.get("quick")==="expense"||location.hash==="#expense") openQuickMoney();
}

$$(".profile-choice").forEach(b=>b.onclick=()=>chooseProfile(b.dataset.profile));
$$(".nav-button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
$("#settingsShortcut").onclick=()=>switchView("settings");
$("#addShop").onclick=addShopping;
$("#clearBought").onclick=async()=>{await sb.from("shopping_items").delete().eq("completed",true);await loadAll();};
$("#addTrip").onclick=addTrip;
$("#addMoney").onclick=addMoney;
$("#openQuickMoney").onclick=openQuickMoney;
$("#saveSettings").onclick=saveSettings;
$("#changeProfile").onclick=()=>{
  localStorage.removeItem("couple_profile");state.profile=null;
  els.app.hidden=true;els.profileScreen.hidden=false;
};

$("#moneyDate").value=iso();
els.today.textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());

if(state.profile) openApp();

sb.channel("couple-v5-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"shopping_items"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"travel_plans"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"couple_items"},loadAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"couple_settings"},loadAll)
  .subscribe();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
}
