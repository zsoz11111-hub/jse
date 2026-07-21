const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.APP_CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  items: [],
  selectedCategory: "전체",
  currentView: "home",
  calendarDate: new Date(),
  selectedDate: new Date(),
  settings: { anniversary_date: null, partner_one: "진성", partner_two: "성은" }
};

const els = {
  auth: $("#authScreen"), app: $("#appScreen"), toast: $("#toast"),
  email: $("#emailInput"), password: $("#passwordInput"),
  login: $("#loginButton"), signup: $("#signupButton"), logout: $("#logoutButton"),
  pageTitle: $("#pageTitle"), today: $("#todayText"),
  category: $("#categoryInput"), writer: $("#writerInput"), content: $("#contentInput"),
  eventDate: $("#eventDateInput"), amount: $("#amountInput"), dynamic: $("#dynamicFields"),
  add: $("#addButton"), itemList: $("#itemList"), loading: $("#loadingText"), empty: $("#emptyText"),
  listTitle: $("#listTitle"), pending: $("#pendingCount"), monthCount: $("#monthCount"),
  monthExpense: $("#monthExpense"), upcomingCount: $("#upcomingCount"),
  upcomingList: $("#upcomingList"), recentList: $("#recentList"),
  daysTogether: $("#daysTogether"), anniversaryText: $("#anniversaryText"),
  calendarTitle: $("#calendarTitle"), calendarGrid: $("#calendarGrid"), selectedDateList: $("#selectedDateList"),
  moneyTotal: $("#moneyTotal"), moneyBars: $("#moneyBars"), moneyList: $("#moneyList"),
  anniversaryInput: $("#anniversaryInput"), partnerOneInput: $("#partnerOneInput"), partnerTwoInput: $("#partnerTwoInput")
};

function toast(msg){ els.toast.textContent=msg; els.toast.hidden=false; clearTimeout(window.t); window.t=setTimeout(()=>els.toast.hidden=true,2600); }
function busy(btn,on,text){ btn.disabled=on; btn.dataset.original ||= btn.textContent; btn.textContent=on?text:btn.dataset.original; }
function money(n){ return `${Number(n||0).toLocaleString("ko-KR")}원`; }
function dateText(v, options={month:"numeric",day:"numeric"}){ if(!v)return ""; return new Intl.DateTimeFormat("ko-KR",options).format(new Date(v)); }
function todayISO(d=new Date()){ return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }

async function signUp(){
  const email=els.email.value.trim(), password=els.password.value;
  if(!email||password.length<6)return toast("이메일과 6자 이상의 비밀번호를 입력하세요.");
  busy(els.signup,true,"가입 중...");
  const {error}=await sb.auth.signUp({email,password});
  busy(els.signup,false);
  if(error)return toast(error.message);
  toast("가입 완료. 이메일 인증 설정에 따라 인증 메일을 확인하세요.");
}
async function signIn(){
  const email=els.email.value.trim(), password=els.password.value;
  if(!email||!password)return toast("이메일과 비밀번호를 입력하세요.");
  busy(els.login,true,"로그인 중...");
  const {error}=await sb.auth.signInWithPassword({email,password});
  busy(els.login,false);
  if(error)return toast("로그인 정보를 확인하세요.");
}
async function showApp(on){
  els.auth.hidden=on; els.app.hidden=!on;
  if(on){ await Promise.all([loadItems(),loadSettings()]); renderAll(); }
}

async function loadItems(){
  els.loading.hidden=false;
  const {data,error}=await sb.from("couple_items").select("*").order("created_at",{ascending:false});
  els.loading.hidden=true;
  if(error)return toast("목록을 불러오지 못했습니다: "+error.message);
  state.items=data||[];
}
async function loadSettings(){
  const {data,error}=await sb.from("couple_settings").select("*").limit(1).maybeSingle();
  if(error && error.code!=="PGRST116") return toast("설정을 불러오지 못했습니다.");
  if(data) state.settings=data;
  els.anniversaryInput.value=state.settings.anniversary_date||"";
  els.partnerOneInput.value=state.settings.partner_one||"진성";
  els.partnerTwoInput.value=state.settings.partner_two||"성은";
  updateWriterOptions();
}
function updateWriterOptions(){
  els.writer.innerHTML="";
  [state.settings.partner_one||"진성",state.settings.partner_two||"성은"].forEach(name=>{
    const o=document.createElement("option");o.textContent=name;o.value=name;els.writer.append(o);
  });
}
async function saveSettings(){
  const payload={
    id:1,
    anniversary_date:els.anniversaryInput.value||null,
    partner_one:els.partnerOneInput.value.trim()||"진성",
    partner_two:els.partnerTwoInput.value.trim()||"성은"
  };
  const {error}=await sb.from("couple_settings").upsert(payload);
  if(error)return toast("설정을 저장하지 못했습니다.");
  state.settings={...state.settings,...payload};updateWriterOptions();renderAll();toast("설정을 저장했습니다.");
}
async function addItem(){
  const content=els.content.value.trim();
  if(!content)return toast("내용을 입력하세요.");
  const payload={
    content,category:els.category.value,writer:els.writer.value,completed:false,
    event_date:els.eventDate.value||null,amount:els.amount.value?Number(els.amount.value):null,
    expense_group:els.category.value==="가계부" ? "생활" : null
  };
  busy(els.add,true,"추가 중...");
  const {error}=await sb.from("couple_items").insert(payload);
  busy(els.add,false);
  if(error)return toast("추가하지 못했습니다: "+error.message);
  els.content.value="";els.eventDate.value="";els.amount.value="";await loadItems();renderAll();
}
async function toggleItem(item){
  const {error}=await sb.from("couple_items").update({completed:!item.completed}).eq("id",item.id);
  if(error)return toast("상태를 변경하지 못했습니다.");
  await loadItems();renderAll();
}
async function deleteItem(id){
  if(!confirm("이 기록을 삭제할까요?"))return;
  const {error}=await sb.from("couple_items").delete().eq("id",id);
  if(error)return toast("삭제하지 못했습니다.");
  await loadItems();renderAll();
}

function switchView(view){
  state.currentView=view;
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#"+view+"View").classList.add("active");
  $$(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  els.pageTitle.textContent={home:"홈",records:"기록",calendar:"달력",money:"가계부",settings:"설정"}[view];
  if(view==="calendar")renderCalendar();
  if(view==="money")renderMoney();
}
function renderAll(){ renderHome();renderRecords();renderCalendar();renderMoney(); }

function renderHome(){
  const now=new Date();
  els.pending.textContent=state.items.filter(x=>!x.completed&&["할 일","장보기"].includes(x.category)).length;
  els.monthCount.textContent=state.items.filter(x=>{const d=new Date(x.created_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();}).length;
  const expenses=state.items.filter(x=>x.category==="가계부"&&x.amount!=null&&new Date(x.created_at).getMonth()===now.getMonth()&&new Date(x.created_at).getFullYear()===now.getFullYear());
  els.monthExpense.textContent=money(expenses.reduce((s,x)=>s+Number(x.amount||0),0));
  const upcoming=state.items.filter(x=>x.category==="일정"&&x.event_date&&x.event_date>=todayISO()).sort((a,b)=>a.event_date.localeCompare(b.event_date));
  els.upcomingCount.textContent=upcoming.length;
  renderMiniList(els.upcomingList,upcoming.slice(0,3),"다가오는 일정이 없습니다.");
  renderMiniList(els.recentList,state.items.slice(0,4),"최근 기록이 없습니다.");
  if(state.settings.anniversary_date){
    const start=new Date(state.settings.anniversary_date+"T00:00:00");
    const days=Math.floor((new Date(todayISO())-start)/86400000)+1;
    els.daysTogether.textContent=`${Math.max(days,0)}일`;
    els.anniversaryText.textContent=`${dateText(state.settings.anniversary_date,{year:"numeric",month:"long",day:"numeric"})}부터`;
  }else{
    els.daysTogether.textContent="0일";els.anniversaryText.textContent="기념일을 설정해주세요.";
  }
}
function renderMiniList(container,list,emptyMsg){
  container.replaceChildren();
  if(!list.length){const p=document.createElement("div");p.className="state-text";p.textContent=emptyMsg;container.append(p);return;}
  list.forEach(item=>{
    const d=document.createElement("div");d.className="mini-item";
    const left=document.createElement("div"), right=document.createElement("span");
    const strong=document.createElement("strong");strong.textContent=item.content;
    const meta=document.createElement("span");meta.textContent=[item.category,item.writer,item.event_date?dateText(item.event_date):null].filter(Boolean).join(" · ");
    left.append(strong,meta);right.textContent=item.amount!=null?money(item.amount):"";
    d.append(left,right);container.append(d);
  });
}

function renderRecords(){
  els.itemList.replaceChildren();
  const filtered=state.selectedCategory==="전체"?state.items:state.items.filter(x=>x.category===state.selectedCategory);
  els.listTitle.textContent=state.selectedCategory==="전체"?"전체 기록":state.selectedCategory;
  els.empty.hidden=filtered.length>0;
  filtered.forEach(item=>{
    const li=document.createElement("li");li.className=`item ${item.completed?"completed":""}`;
    const check=document.createElement("button");check.className="check-button";check.textContent=item.completed?"✓":"";check.onclick=()=>toggleItem(item);
    const body=document.createElement("div"),badge=document.createElement("span"),content=document.createElement("p"),meta=document.createElement("div");
    badge.className="item-badge";badge.textContent=item.category||"기록";
    content.className="item-content";content.textContent=item.content;
    meta.className="item-meta";meta.textContent=[item.writer,item.event_date?dateText(item.event_date):null,item.amount!=null?money(item.amount):null,dateText(item.created_at)].filter(Boolean).join(" · ");
    const del=document.createElement("button");del.className="delete-button";del.textContent="삭제";del.onclick=()=>deleteItem(item.id);
    body.append(badge,content,meta);li.append(check,body,del);els.itemList.append(li);
  });
}

function renderCalendar(){
  const y=state.calendarDate.getFullYear(),m=state.calendarDate.getMonth();
  els.calendarTitle.textContent=`${y}년 ${m+1}월`;
  els.calendarGrid.replaceChildren();
  const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay());
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const iso=todayISO(d),btn=document.createElement("button");
    btn.className="day-cell";btn.textContent=d.getDate();
    if(d.getMonth()!==m)btn.classList.add("muted");
    if(iso===todayISO())btn.classList.add("today");
    if(iso===todayISO(state.selectedDate))btn.classList.add("selected");
    const has=state.items.some(x=>x.event_date===iso);
    if(has){const dot=document.createElement("span");dot.className="day-dot";btn.append(dot);}
    btn.onclick=()=>{state.selectedDate=d;renderCalendar();};
    els.calendarGrid.append(btn);
  }
  const selected=todayISO(state.selectedDate);
  renderMiniList(els.selectedDateList,state.items.filter(x=>x.event_date===selected),`${dateText(selected,{year:"numeric",month:"long",day:"numeric"})} 기록이 없습니다.`);
}

function renderMoney(){
  const now=new Date();
  const list=state.items.filter(x=>x.category==="가계부"&&x.amount!=null&&new Date(x.created_at).getMonth()===now.getMonth()&&new Date(x.created_at).getFullYear()===now.getFullYear());
  const total=list.reduce((s,x)=>s+Number(x.amount||0),0);
  els.moneyTotal.textContent=money(total);
  els.moneyBars.replaceChildren();
  const groups={생활:0,식비:0,교통:0,기타:0};
  list.forEach(x=>groups[x.expense_group||"생활"]=(groups[x.expense_group||"생활"]||0)+Number(x.amount||0));
  Object.entries(groups).filter(([,v])=>v>0).forEach(([name,value])=>{
    const card=document.createElement("div");card.className="money-bar";
    const head=document.createElement("div");head.className="money-bar-head";head.innerHTML=`<span>${name}</span><strong>${money(value)}</strong>`;
    const track=document.createElement("div");track.className="money-bar-track";
    const fill=document.createElement("div");fill.className="money-bar-fill";fill.style.width=`${total?Math.max(4,value/total*100):0}%`;
    track.append(fill);card.append(head,track);els.moneyBars.append(card);
  });
  if(!els.moneyBars.children.length) els.moneyBars.innerHTML='<div class="state-text">이번 달 가계부 기록이 없습니다.</div>';
  renderMiniList(els.moneyList,list.slice(0,8),"최근 지출이 없습니다.");
}

els.category.onchange=()=>{
  const c=els.category.value;
  els.dynamic.hidden=!["일정","가계부"].includes(c);
  els.eventDate.style.display=c==="일정"?"block":"none";
  els.amount.style.display=c==="가계부"?"block":"none";
};
els.category.dispatchEvent(new Event("change"));
els.login.onclick=signIn;els.signup.onclick=signUp;els.logout.onclick=()=>sb.auth.signOut();els.add.onclick=addItem;
$("#refreshButton").onclick=async()=>{await loadItems();renderAll();};
$("#saveSettingsButton").onclick=saveSettings;$("#editAnniversaryButton").onclick=()=>switchView("settings");
$("#prevMonth").onclick=()=>{state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()-1,1);renderCalendar();};
$("#nextMonth").onclick=()=>{state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()+1,1);renderCalendar();};
$$(".nav-button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("[data-go]").forEach(b=>b.onclick=()=>switchView(b.dataset.go));
$$(".chip").forEach(b=>b.onclick=()=>{state.selectedCategory=b.dataset.category;$$(".chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderRecords();});

els.today.textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());

sb.auth.getSession().then(({data})=>showApp(Boolean(data.session)));
sb.auth.onAuthStateChange((_e,session)=>showApp(Boolean(session)));
sb.channel("couple-v2-live").on("postgres_changes",{event:"*",schema:"public",table:"couple_items"},async()=>{await loadItems();renderAll();}).subscribe();

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
