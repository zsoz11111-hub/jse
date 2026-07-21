const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.APP_CONFIG;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);
const authScreen = $("#authScreen");
const appScreen = $("#appScreen");
const emailInput = $("#emailInput");
const passwordInput = $("#passwordInput");
const loginButton = $("#loginButton");
const signupButton = $("#signupButton");
const logoutButton = $("#logoutButton");
const categoryInput = $("#categoryInput");
const writerInput = $("#writerInput");
const contentInput = $("#contentInput");
const eventDateInput = $("#eventDateInput");
const amountInput = $("#amountInput");
const addButton = $("#addButton");
const itemList = $("#itemList");
const loadingText = $("#loadingText");
const emptyText = $("#emptyText");
const listTitle = $("#listTitle");
const pendingCount = $("#pendingCount");
const monthCount = $("#monthCount");
const toast = $("#toast");

let items = [];
let selectedCategory = "전체";

function notify(message){
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.hidden = true, 2600);
}

function setBusy(button, busy, text){
  button.disabled = busy;
  button.dataset.original ||= button.textContent;
  button.textContent = busy ? text : button.dataset.original;
}

function showApp(signedIn){
  authScreen.hidden = signedIn;
  appScreen.hidden = !signedIn;
  if(signedIn) loadItems();
}

async function signUp(){
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if(!email || password.length < 6) return notify("이메일과 6자 이상의 비밀번호를 입력하세요.");
  setBusy(signupButton,true,"가입 중...");
  const { error } = await supabaseClient.auth.signUp({ email, password });
  setBusy(signupButton,false);
  if(error) return notify(error.message);
  notify("가입 완료. 이메일 인증 설정에 따라 인증 메일을 확인하세요.");
}

async function signIn(){
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if(!email || !password) return notify("이메일과 비밀번호를 입력하세요.");
  setBusy(loginButton,true,"로그인 중...");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setBusy(loginButton,false);
  if(error) return notify("로그인 정보를 확인하세요.");
}

async function signOut(){
  await supabaseClient.auth.signOut();
}

async function loadItems(){
  loadingText.hidden = false;
  emptyText.hidden = true;
  const { data, error } = await supabaseClient
    .from("couple_items")
    .select("*")
    .order("created_at",{ascending:false});
  loadingText.hidden = true;
  if(error) return notify("목록을 불러오지 못했습니다: " + error.message);
  items = data || [];
  render();
}

async function addItem(){
  const content = contentInput.value.trim();
  if(!content) return notify("내용을 입력하세요.");
  setBusy(addButton,true,"추가 중...");
  const payload = {
    content,
    category: categoryInput.value,
    writer: writerInput.value,
    completed: false,
    event_date: eventDateInput.value || null,
    amount: amountInput.value ? Number(amountInput.value) : null
  };
  const { error } = await supabaseClient.from("couple_items").insert(payload);
  setBusy(addButton,false);
  if(error) return notify("추가하지 못했습니다: " + error.message);
  contentInput.value = "";
  eventDateInput.value = "";
  amountInput.value = "";
  await loadItems();
}

async function toggleItem(item){
  const { error } = await supabaseClient
    .from("couple_items")
    .update({completed:!item.completed})
    .eq("id",item.id);
  if(error) return notify("상태를 변경하지 못했습니다.");
  await loadItems();
}

async function deleteItem(id){
  if(!confirm("이 기록을 삭제할까요?")) return;
  const { error } = await supabaseClient.from("couple_items").delete().eq("id",id);
  if(error) return notify("삭제하지 못했습니다.");
  await loadItems();
}

function formatDate(value){
  if(!value) return "";
  return new Intl.DateTimeFormat("ko-KR",{month:"numeric",day:"numeric"}).format(new Date(value));
}

function formatMoney(value){
  return value == null ? "" : `${Number(value).toLocaleString("ko-KR")}원`;
}

function render(){
  itemList.replaceChildren();
  const filtered = selectedCategory === "전체"
    ? items
    : items.filter(item => item.category === selectedCategory);

  listTitle.textContent = selectedCategory === "전체" ? "전체 기록" : selectedCategory;
  emptyText.hidden = filtered.length > 0;

  const now = new Date();
  pendingCount.textContent = items.filter(x => !x.completed && ["할 일","장보기"].includes(x.category)).length;
  monthCount.textContent = items.filter(x => {
    const d = new Date(x.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  filtered.forEach(item => {
    const li = document.createElement("li");
    li.className = `item ${item.completed ? "completed" : ""}`;

    const check = document.createElement("button");
    check.className = "check-button";
    check.textContent = item.completed ? "✓" : "";
    check.addEventListener("click",() => toggleItem(item));

    const body = document.createElement("div");
    const badge = document.createElement("span");
    badge.className = "item-badge";
    badge.textContent = item.category || "기록";

    const content = document.createElement("p");
    content.className = "item-content";
    content.textContent = item.content;

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const bits = [
      item.writer,
      item.event_date ? formatDate(item.event_date) : null,
      item.amount != null ? formatMoney(item.amount) : null,
      formatDate(item.created_at)
    ].filter(Boolean);
    meta.textContent = bits.join(" · ");

    const del = document.createElement("button");
    del.className = "delete-button";
    del.textContent = "삭제";
    del.addEventListener("click",() => deleteItem(item.id));

    body.append(badge,content,meta);
    li.append(check,body,del);
    itemList.append(li);
  });
}

document.querySelectorAll(".category-button").forEach(button => {
  button.addEventListener("click",() => {
    selectedCategory = button.dataset.category;
    document.querySelectorAll(".category-button").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

categoryInput.addEventListener("change",() => {
  const category = categoryInput.value;
  eventDateInput.closest("#extraFields").style.display = ["일정","가계부"].includes(category) ? "grid" : "none";
  eventDateInput.style.display = category === "일정" ? "block" : "none";
  amountInput.style.display = category === "가계부" ? "block" : "none";
});
categoryInput.dispatchEvent(new Event("change"));

loginButton.addEventListener("click",signIn);
signupButton.addEventListener("click",signUp);
logoutButton.addEventListener("click",signOut);
addButton.addEventListener("click",addItem);
$("#refreshButton").addEventListener("click",loadItems);

const today = new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date());
$("#todayText").textContent = today;

supabaseClient.auth.getSession().then(({data}) => showApp(Boolean(data.session)));
supabaseClient.auth.onAuthStateChange((_event,session) => showApp(Boolean(session)));

supabaseClient
  .channel("couple-items-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"couple_items"},() => loadItems())
  .subscribe();

if("serviceWorker" in navigator){
  window.addEventListener("load",() => navigator.serviceWorker.register("./service-worker.js"));
}
