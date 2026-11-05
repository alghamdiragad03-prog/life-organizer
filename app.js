'use strict';

/* ========= Storage ========= */
const KEY = 'life-organizer-v1';
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
const DEFAULT_CATS = ['Personal', 'Study', 'Work', 'Home', 'Health'];

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tasks)) return { name: '', categories: DEFAULT_CATS, events: [], theme: '', ...d };
  } catch (e) { /* corrupt data or storage unavailable */ }
  return { name: '', tasks: [], events: [], categories: [...DEFAULT_CATS], theme: '' };
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Couldn't save data on this device"); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ========= Date helpers ========= */
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayISO = () => iso(new Date());
const startOfWeek = d => addDays(d, -d.getDay()); // week starts on Sunday
const nowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const fmtDay = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShortDay = new Intl.DateTimeFormat('en', { weekday: 'short' });
let fmtHijri;
try { fmtHijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { fmtHijri = null; }

function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const s = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${s}`;
}
function relDate(s) {
  const t = todayISO();
  if (s === t) return 'Today';
  if (s === iso(addDays(new Date(), 1))) return 'Tomorrow';
  if (s === iso(addDays(new Date(), -1))) return 'Yesterday';
  return fmtDay.format(parse(s));
}

/* ========= Schedule logic ========= */
function occursOn(ev, dateStr) {
  if (dateStr < ev.date) return false;
  const day = parse(dateStr).getDay();
  switch (ev.repeat) {
    case 'daily': return true;
    case 'weekly': return day === parse(ev.date).getDay();
    case 'weekdays': return day <= 4;
    default: return ev.date === dateStr;
  }
}
const eventsOn = dateStr => state.events.filter(e => occursOn(e, dateStr)).sort((a, b) => a.start.localeCompare(b.start));
const tasksOn = dateStr => state.tasks.filter(t => t.due === dateStr).sort(taskSort);

const PRIO = { high: 0, med: 1, low: 2 };
function taskSort(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if ((a.due || '9') !== (b.due || '9')) return (a.due || '9').localeCompare(b.due || '9');
  if ((a.time || '99') !== (b.time || '99')) return (a.time || '99').localeCompare(b.time || '99');
  return PRIO[a.priority] - PRIO[b.priority];
}

/* ========= UI helpers ========= */
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function emptyBox(text) { return el('div', 'empty', text); }

function taskItem(t) {
  const item = el('div', `item${t.done ? ' done' : ''}`);
  const late = !t.done && t.due && t.due < todayISO();
  const meta = [];
  if (t.due) meta.push(`<span class="${late ? 'late' : ''}">${relDate(t.due)}</span>`);
  if (t.time) meta.push(`<span>${fmtTime(t.time)}</span>`);
  if (t.category) meta.push(`<span class="tag">${esc(t.category)}</span>`);
  if (t.notes) meta.push(`<span>📝</span>`);
  item.innerHTML = `
    <span class="prio ${t.priority}"></span>
    <button class="check" aria-label="Mark done">${t.done ? '✓' : ''}</button>
    <div class="body"><div class="title">${esc(t.title)}</div>${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}</div>`;
  item.querySelector('.check').addEventListener('click', e => { e.stopPropagation(); toggleTask(t.id); });
  item.addEventListener('click', () => openTask(t));
  return item;
}

function eventItem(ev, dateStr) {
  const item = el('div', 'item event');
  item.style.setProperty('--ev', ev.color);
  if (dateStr === todayISO()) {
    const n = nowMinutes(), s = toMin(ev.start), e = toMin(ev.end) ?? s + 60;
    if (n >= s && n < e) item.classList.add('now');
    else if (n >= e) item.classList.add('past');
  }
  const rep = { daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays' }[ev.repeat];
  const meta = [];
  if (ev.place) meta.push(`<span>📍 ${esc(ev.place)}</span>`);
  if (rep) meta.push(`<span>🔁 ${rep}</span>`);
  item.innerHTML = `
    <div class="time">${fmtTime(ev.start)}${ev.end ? `<small>${fmtTime(ev.end)}</small>` : ''}</div>
    <div class="body"><div class="title">${esc(ev.title)}</div>${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}</div>`;
  item.addEventListener('click', () => openEvent(ev));
  return item;
}

function fill(container, items, emptyText) {
  container.replaceChildren(...(items.length ? items : [emptyBox(emptyText)]));
}

/* ========= View: Today ========= */
function renderToday() {
  const t = todayISO();
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent = state.name ? `${hello}, ${state.name}` : hello;

  const todays = tasksOn(t);
  const done = todays.filter(x => x.done).length;
  const pct = todays.length ? Math.round(done / todays.length * 100) : 0;
  $('#ringFg').style.strokeDasharray = `${pct} 100`;
  $('#ringText').textContent = `${pct}%`;
  const evs = eventsOn(t);
  $('#todaySummary').textContent = todays.length
    ? `${done} of ${todays.length} tasks done · ${plural(evs.length, 'event')}`
    : `No tasks today · ${plural(evs.length, 'event')}`;

  fill($('#todayEvents'), evs.map(e => eventItem(e, t)), 'Your schedule is clear today');
  fill($('#todayTasks'), todays.map(taskItem), 'No tasks for today — tap + to add one');

  const overdue = state.tasks.filter(x => !x.done && x.due && x.due < t).sort(taskSort);
  $('#overdueWrap').hidden = !overdue.length;
  fill($('#overdueTasks'), overdue.map(taskItem), '');
}

/* ========= View: Tasks ========= */
let taskFilter = 'open', catFilter = '';
function renderTasks() {
  const t = todayISO();
  const cats = $('#catFilters');
  cats.replaceChildren(...['', ...state.categories].map(c => {
    const b = el('button', `chip${c === catFilter ? ' active' : ''}`, esc(c || 'All categories'));
    b.onclick = () => { catFilter = c; renderTasks(); };
    return b;
  }));
  let list = state.tasks.filter(x => {
    switch (taskFilter) {
      case 'today': return !x.done && x.due && x.due <= t;
      case 'upcoming': return !x.done && x.due && x.due > t;
      case 'nodate': return !x.done && !x.due;
      case 'done': return x.done;
      default: return !x.done;
    }
  });
  if (catFilter) list = list.filter(x => x.category === catFilter);
  list.sort(taskFilter === 'done' ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : taskSort);
  const msg = taskFilter === 'done' ? 'Nothing completed yet 💪' : 'No tasks here ✨';
  fill($('#taskList'), list.map(taskItem), msg);
}
$('#taskFilters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  taskFilter = b.dataset.filter;
  document.querySelectorAll('#taskFilters .chip').forEach(c => c.classList.toggle('active', c === b));
  renderTasks();
});

/* ========= View: Schedule ========= */
let selDate = todayISO();
function renderSchedule() {
  const start = startOfWeek(parse(selDate));
  const t = todayISO();
  $('#weekStrip').replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i), s = iso(d);
    const n = Math.min(eventsOn(s).length + tasksOn(s).filter(x => !x.done).length, 3);
    const b = el('button', `day-btn${s === t ? ' today' : ''}${s === selDate ? ' sel' : ''}`,
      `<span class="dn">${fmtShortDay.format(d)}</span><span class="dd">${d.getDate()}</span><span class="dots">${'<i></i>'.repeat(n)}</span>`);
    b.onclick = () => { selDate = s; renderSchedule(); };
    return b;
  }));
  $('#dayTitle').textContent = relDate(selDate) === fmtDay.format(parse(selDate)) ? fmtDay.format(parse(selDate)) : `${relDate(selDate)} · ${fmtDay.format(parse(selDate))}`;
  fill($('#dayEvents'), eventsOn(selDate).map(e => eventItem(e, selDate)), 'No events');
  fill($('#dayTasks'), tasksOn(selDate).map(taskItem), 'No tasks');
}
$('#prevWeek').onclick = () => { selDate = iso(addDays(parse(selDate), -7)); renderSchedule(); };
$('#nextWeek').onclick = () => { selDate = iso(addDays(parse(selDate), 7)); renderSchedule(); };
$('#thisWeek').onclick = () => { selDate = todayISO(); renderSchedule(); };

/* ========= View: Settings ========= */
function renderSettings() {
  $('#userName').value = state.name;
  $('#catManage').replaceChildren(...state.categories.map(c => {
    const b = el('button', 'chip', `${esc(c)}<span class="x">✕</span>`);
    b.onclick = () => {
      if (!confirm(`Delete category "${c}"? Tasks in it won't be deleted.`)) return;
      state.categories = state.categories.filter(x => x !== c);
      if (catFilter === c) catFilter = '';
      save(); renderSettings();
    };
    return b;
  }));
}
$('#userName').addEventListener('input', e => { state.name = e.target.value.trim(); save(); });
$('#catForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#catInput').value.trim();
  if (v && !state.categories.includes(v)) { state.categories.push(v); save(); }
  $('#catInput').value = ''; renderSettings();
});
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `life-organizer-${todayISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#importInput').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.tasks) || !Array.isArray(d.events)) throw new Error();
    if (!confirm('Importing will replace your current data. Continue?')) return;
    state = { ...load(), ...d }; save(); render(); toast('Imported ✓');
  } catch { toast('Invalid file'); }
  e.target.value = '';
});
$('#clearDone').onclick = () => {
  const n = state.tasks.filter(t => t.done).length;
  if (!n) return toast('No completed tasks');
  if (!confirm(`Delete ${plural(n, 'completed task')}?`)) return;
  state.tasks = state.tasks.filter(t => !t.done); save(); render();
};

/* ========= Tasks: add/edit ========= */
let editingTask = null;
function openTask(t = null) {
  editingTask = t;
  const f = $('#taskForm');
  f.category.replaceChildren(el('option', '', 'None'), ...state.categories.map(c => { const o = el('option', '', esc(c)); o.value = c; return o; }));
  f.category.options[0].value = '';
  f.title.value = t?.title || '';
  f.notes.value = t?.notes || '';
  f.due.value = t ? (t.due || '') : (currentView === 'schedule' ? selDate : todayISO());
  f.time.value = t?.time || '';
  f.priority.value = t?.priority || 'med';
  f.category.value = t?.category || (catFilter || '');
  $('#taskDialogTitle').textContent = t ? 'Edit task' : 'New task';
  $('#taskDelete').hidden = !t;
  $('#taskDialog').showModal();
  if (!t) f.title.focus();
}
$('#taskForm').addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const f = e.target;
  const data = { title: f.title.value.trim(), notes: f.notes.value.trim(), due: f.due.value, time: f.time.value, priority: f.priority.value, category: f.category.value };
  if (!data.title) return;
  if (editingTask) Object.assign(state.tasks.find(x => x.id === editingTask.id), data);
  else state.tasks.push({ id: uid(), done: false, createdAt: Date.now(), ...data });
  save(); render();
});
$('#taskDelete').onclick = () => {
  const t = editingTask, i = state.tasks.findIndex(x => x.id === t.id);
  state.tasks.splice(i, 1); save(); $('#taskDialog').close(); render();
  toast('Task deleted', () => { state.tasks.splice(i, 0, t); save(); render(); });
};
function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  save(); render();
  if (t.done) toast('Nice work! ✓', () => toggleTask(id));
}

/* ========= Events: add/edit ========= */
let editingEvent = null, pickedColor = COLORS[0];
function renderColors() {
  $('#colorPicker').replaceChildren(...COLORS.map(c => {
    const b = el('button', c === pickedColor ? 'sel' : '');
    b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', c);
    b.onclick = () => { pickedColor = c; renderColors(); };
    return b;
  }));
}
function openEvent(ev = null) {
  editingEvent = ev;
  const f = $('#eventForm');
  f.title.value = ev?.title || '';
  f.place.value = ev?.place || '';
  f.date.value = ev?.date || (currentView === 'schedule' ? selDate : todayISO());
  f.start.value = ev?.start || '';
  f.end.value = ev?.end || '';
  f.repeat.value = ev?.repeat || 'none';
  pickedColor = ev?.color || COLORS[0];
  renderColors();
  $('#eventDialogTitle').textContent = ev ? 'Edit event' : 'New event';
  $('#eventDelete').hidden = !ev;
  $('#eventDialog').showModal();
  if (!ev) f.title.focus();
}
$('#eventForm').addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const f = e.target;
  const data = { title: f.title.value.trim(), place: f.place.value.trim(), date: f.date.value, start: f.start.value, end: f.end.value, repeat: f.repeat.value, color: pickedColor };
  if (!data.title || !data.date || !data.start) return;
  if (data.end && data.end <= data.start) data.end = '';
  if (editingEvent) Object.assign(state.events.find(x => x.id === editingEvent.id), data);
  else state.events.push({ id: uid(), ...data });
  save(); render();
});
$('#eventDelete').onclick = () => {
  const ev = editingEvent;
  if (ev.repeat !== 'none' && !confirm('This is a repeating event — it will be removed from every day. Continue?')) return;
  const i = state.events.findIndex(x => x.id === ev.id);
  state.events.splice(i, 1); save(); $('#eventDialog').close(); render();
  toast('Event deleted', () => { state.events.splice(i, 0, ev); save(); render(); });
};

/* ========= Dialogs ========= */
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#fab').onclick = () => {
  if (currentView === 'tasks') return openTask();
  $('#addChoice').showModal();
};
$('#addTaskBtn').onclick = () => { $('#addChoice').close(); openTask(); };
$('#addEventBtn').onclick = () => { $('#addChoice').close(); openEvent(); };

let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (undo) { const b = el('button', '', 'Undo'); b.onclick = () => { t.hidden = true; undo(); }; t.append(b); }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 3500);
}

/* ========= Navigation ========= */
const TITLES = { today: 'Today', tasks: 'Tasks', schedule: 'Schedule', settings: 'Settings' };
let currentView = 'today';
function setView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === `view-${v}`));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#viewTitle').textContent = TITLES[v];
  $('#fab').hidden = v === 'settings';
  try { sessionStorage.setItem('lo-view', v); } catch (e) { /* */ }
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => setView(b.dataset.view));

function renderSub() {
  const d = new Date();
  $('#viewSub').textContent = fmtDay.format(d) + (fmtHijri ? ` · ${fmtHijri.format(d)}` : '');
}

function render() {
  renderSub();
  ({ today: renderToday, tasks: renderTasks, schedule: renderSchedule, settings: renderSettings })[currentView]();
}

/* ========= Dark mode ========= */
function applyTheme() {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = dark ? '#0f1017' : '#f5f6fb';
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
}
$('#themeBtn').onclick = () => {
  state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ========= Startup ========= */
applyTheme();
let saved; try { saved = sessionStorage.getItem('lo-view'); } catch (e) { /* */ }
setView(TITLES[saved] ? saved : 'today');
setInterval(() => { if (currentView === 'today' || currentView === 'schedule') render(); }, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
