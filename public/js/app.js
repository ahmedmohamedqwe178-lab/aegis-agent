// Aegis AI Agent — واجهة المستخدم

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  ws: null,
  connected: false,
  busy: false,
  currentToolCards: new Map(), // tool_call_id -> element
  openFiles: [],               // مسارات الملفات المفتوحة
  activeFile: null,
};

// ===== WebSocket =====
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  state.ws = new WebSocket(`${proto}://${location.host}/ws`);
  state.ws.onopen = () => { state.connected = true; setStatus("متصل"); };
  state.ws.onclose = () => { state.connected = false; setStatus("منقطع"); setTimeout(connect, 2000); };
  state.ws.onerror = () => setStatus("خطأ اتصال");
  state.ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleEvent(msg);
  };
}
function wsSend(obj) { if (state.connected) state.ws.send(JSON.stringify(obj)); }

// ===== أحداث الوكيل =====
function handleEvent(ev) {
  switch (ev.type) {
    case "provider_info":
      $("#provider-info").textContent = `${ev.data.provider} · ${ev.data.model}`;
      break;
    case "assistant_text":
      if (ev.data && ev.data.trim()) addMessage("assistant", ev.data);
      break;
    case "tool_call":
      addToolCard(ev.data);
      break;
    case "tool_result":
      updateToolCard(ev.data);
      break;
    case "permission_request":
      showPermissionModal(ev.data);
      break;
    case "file_changed":
      refreshFileTree();
      attachMediaToLastTool({ type: "file", path: ev.data.path, action: ev.data.action });
      break;
    case "browser_screenshot":
      attachMediaToLastTool({ type: "screenshot", path: ev.data.path, caption: ev.data.url });
      break;
    case "image_generated":
      attachMediaToLastTool({ type: "image", path: ev.data.path, caption: ev.data.prompt });
      showInPreview({ type: "image", path: ev.data.path });
      break;
    case "audio_generated":
      attachMediaToLastTool({ type: "audio", path: ev.data.path, caption: ev.data.text });
      showInPreview({ type: "audio", path: ev.data.path });
      break;
    case "shell_output":
      // النتيجة موجودة في tool_result، فقط نحدث الشجرة
      refreshFileTree();
      break;
    case "error":
      addMessage("error", "⚠️ " + ev.data);
      break;
    case "final":
      break;
    case "done":
      setBusy(false);
      refreshFileTree();
      break;
    case "reset_ok":
      $("#messages").innerHTML = "";
      state.currentToolCards.clear();
      break;
  }
}

// ===== الرسائل =====
function addMessage(role, text) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  const avatar = role === "user" ? "أنت" : role === "assistant" ? "AI" : role === "error" ? "!" : "🔧";
  div.innerHTML = `<div class="avatar">${avatar}</div><div class="body"><div class="bubble"></div></div>`;
  div.querySelector(".bubble").textContent = text;
  $("#messages").appendChild(div);
  scrollChat();
}

function addToolCard(data) {
  removeWelcome();
  const div = document.createElement("div");
  div.className = "msg tool";
  div.innerHTML = `
    <div class="avatar">🔧</div>
    <div class="body">
      <div class="tool-card">
        <div class="head">
          <span class="name">${data.name}</span>
          <span class="status" data-status>⏳ يعمل…</span>
        </div>
        <div class="args"></div>
        <div class="result hidden"></div>
        <div class="media"></div>
      </div>
    </div>`;
  div.querySelector(".args").textContent = JSON.stringify(data.args, null, 2);
  $("#messages").appendChild(div);
  state.currentToolCards.set(data.id, div);
  scrollChat();
}

function updateToolCard(data) {
  const div = state.currentToolCards.get(data.id);
  if (!div) return;
  const status = div.querySelector("[data-status]");
  const result = div.querySelector(".result");
  status.textContent = data.is_error ? "✗ خطأ" : "✓ تم";
  status.className = "status " + (data.is_error ? "err" : "ok");
  result.classList.remove("hidden");
  const text = String(data.result || "");
  result.textContent = text.length > 800 ? text.slice(0, 800) + "\n… (اضغط للتوسيع)" : text;
  if (text.length > 800) {
    div.querySelector(".tool-card").classList.add("expandable");
    result.addEventListener("click", () => { result.textContent = text; div.querySelector(".tool-card").classList.remove("expandable"); }, { once: true });
  }
  scrollChat();
}

function attachMediaToLastTool(media) {
  const cards = $$(".tool .tool-card");
  const card = cards[cards.length - 1];
  if (!card) return;
  const container = card.querySelector(".media");
  const wrap = document.createElement("div");
  wrap.className = "tool-media";
  if (media.type === "screenshot" || media.type === "image") {
    wrap.innerHTML = `<img src="/generated/${media.path}" alt="" /><div class="caption">${media.caption || media.path}</div>`;
  } else if (media.type === "audio") {
    wrap.innerHTML = `<audio controls src="/generated/${media.path}"></audio><div class="caption">${media.caption || media.path}</div>`;
  } else if (media.type === "file") {
    const icon = media.action === "deleted" ? "🗑️" : media.action === "created" ? "✨" : "✏️";
    wrap.innerHTML = `<div class="caption">${icon} ${media.action}: <code>${media.path}</code></div>`;
    wrap.style.cursor = "pointer";
    wrap.onclick = () => openFile(media.path);
  }
  container.appendChild(wrap);
  scrollChat();
}

function removeWelcome() { $(".welcome")?.remove(); }
function scrollChat() { const m = $("#messages"); m.scrollTop = m.scrollHeight; }
function setStatus(text) { $("#status").textContent = text; }
function setBusy(b) {
  state.busy = b;
  $("#chat-send").disabled = b;
  $("#status").textContent = b ? "يفكر…" : "جاهز";
  $("#status").classList.toggle("busy", b);
}

// ===== الأذونات =====
let currentPermission = null;
function showPermissionModal(data) {
  currentPermission = data;
  $("#perm-desc").textContent = data.description;
  $("#perm-tool").textContent = data.tool;
  $("#perm-category").textContent = data.category;
  $("#perm-args").textContent = JSON.stringify(data.args, null, 2);
  $("#perm-session").checked = true;
  $("#perm-modal").classList.remove("hidden");
}
function respondPermission(granted) {
  if (!currentPermission) return;
  wsSend({
    type: "permission_response",
    id: currentPermission.id,
    granted,
    applyToSession: $("#perm-session").checked,
  });
  $("#perm-modal").classList.add("hidden");
  currentPermission = null;
}
$("#perm-allow").onclick = () => respondPermission(true);
$("#perm-deny").onclick = () => respondPermission(false);

// ===== شجرة الملفات =====
async function refreshFileTree() {
  try {
    const res = await fetch("/api/files");
    const tree = await res.json();
    renderTree(tree, $("#file-tree"));
  } catch { /* ignore */ }
}

function renderTree(items, container) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = '<div class="empty">(فارغة — سيملأها الوكيل قريباً)</div>';
    return;
  }
  const build = (arr, parent) => {
    for (const item of arr) {
      const el = document.createElement("div");
      el.className = "tree-item";
      el.innerHTML = `<span class="icon">${item.type === "dir" ? "📁" : "📄"}</span><span>${item.name}</span>`;
      if (item.type === "file") {
        el.onclick = () => openFile(item.path);
        if (item.path === state.activeFile) el.classList.add("active");
      }
      parent.appendChild(el);
      if (item.type === "dir" && item.children) {
        const kids = document.createElement("div");
        kids.className = "tree-children";
        build(item.children, kids);
        parent.appendChild(kids);
      }
    }
  };
  build(items, container);
}

// ===== المحرر =====
async function openFile(relPath) {
  state.activeFile = relPath;
  refreshFileTree();
  const ext = relPath.split(".").pop()?.toLowerCase();
  const editor = $("#editor");
  const preview = $("#preview");

  // معاينة الوسائط
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    editor.classList.add("hidden");
    preview.classList.remove("hidden");
    preview.innerHTML = `<img src="/workspace/${relPath}" style="max-width:100%" />`;
    return;
  }
  if (["mp3", "wav", "ogg"].includes(ext)) {
    editor.classList.add("hidden");
    preview.classList.remove("hidden");
    preview.innerHTML = `<audio controls src="/workspace/${relPath}"></audio>`;
    return;
  }
  if (ext === "html") {
    editor.classList.add("hidden");
    preview.classList.remove("hidden");
    preview.innerHTML = `<iframe src="/workspace/${relPath}" style="width:100%;height:100%;border:0;background:white;border-radius:8px"></iframe>`;
    return;
  }

  // ملف نصي
  preview.classList.add("hidden");
  editor.classList.remove("hidden");
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    if (data.content !== undefined) {
      editor.textContent = data.content;
    } else {
      editor.textContent = "(binary or unreadable file)";
    }
  } catch {
    editor.textContent = "(failed to load)";
  }
}

function showInPreview(item) {
  const editor = $("#editor");
  const preview = $("#preview");
  editor.classList.add("hidden");
  preview.classList.remove("hidden");
  if (item.type === "image") {
    preview.innerHTML = `<img src="/generated/${item.path}" />`;
  } else if (item.type === "audio") {
    preview.innerHTML = `<audio controls src="/generated/${item.path}"></audio>`;
  }
}

// ===== نموذج الشات =====
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text || state.busy) return;
  addMessage("user", text);
  input.value = "";
  setBusy(true);
  wsSend({ type: "chat", message: text });
});

$("#chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#chat-form").requestSubmit();
  }
});

$("#btn-reset").onclick = () => {
  wsSend({ type: "reset" });
  $("#messages").innerHTML = `
    <div class="welcome">
      <h2>👋 محادثة جديدة</h2>
      <p>الذاكرة اتمسحت. ابدأ من جديد.</p>
    </div>`;
};

// اقتراحات
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) {
    $("#chat-input").value = chip.dataset.prompt;
    $("#chat-input").focus();
  }
});

// إطلاق
connect();
refreshFileTree();
setInterval(refreshFileTree, 5000);
