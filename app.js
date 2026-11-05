'use strict';

/* ========= Storage ========= */
const KEY = 'life-organizer-v1';
const COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#64748b'];
const DEFAULT_CATS = ['Work', 'Personal', 'Study', 'Health', 'Home'];
const XP_FOR = { high: 15, med: 10, low: 5 };
const FOCUS_XP = 20;

function fresh() {
  return { name: '', tasks: [], events: [], categories: [...DEFAULT_CATS], catColors: {}, theme: '', xp: 0, log: {}, goal: 3, celebrated: '', focusTask: '', sessions: 0 };
}
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* corrupt or unavailable */ }
  const s = { ...fresh(), ...(d && Array.isArray(d.tasks) ? d : {}) };
  // give every category a stable color (follows the category, not its position)
  s.categories.forEach((c, i) => { if (!s.catColors[c]) s.catColors[c] = COLORS[i % COLORS.length]; });
  // first run on this version: rebuild history + XP from already-completed tasks
  if (d && !d.log) {
    s.tasks.filter(t => t.done && t.doneAt).forEach(t => {
      const k = iso(new Date(t.doneAt));
      (s.log[k] ||= { t: 0, f: 0 }).t++;
      s.xp += XP_FOR[t.priority] || 10;
    });
  }
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Couldn't save data on this device"); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ========= Date helpers ========= */
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pad = n => String(n).padStart(2, '0');
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayISO = () => iso(new Date());
const startOfWeek = d => addDays(d, -d.getDay()); // week starts on Sunday
const nowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const fmtDay = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShortDay = new Intl.DateTimeFormat('en', { weekday: 'short' });
const fmtWeekday = new Intl.DateTimeFormat('en', { weekday: 'long' });
const fmtShortDate = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
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
  if (s === todayISO()) return 'Today';
  if (s === iso(addDays(new Date(), 1))) return 'Tomorrow';
  if (s === iso(addDays(new Date(), -1))) return 'Yesterday';
  return fmtDay.format(parse(s));
}
function inMinutes(min) {
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return `in ${h}h${m ? ` ${m}m` : ''}`;
}

/* ========= Motivation ========= */
const QUOTES = [
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Small daily improvements are the key to staggering long-term results.', 'Robin Sharma'],
  ['Discipline is choosing between what you want now and what you want most.', 'Abraham Lincoln'],
  ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['You don’t have to be great to start, but you have to start to be great.', 'Zig Ziglar'],
  ['Focus on being productive instead of busy.', 'Tim Ferriss'],
  ['The way to get started is to quit talking and begin doing.', 'Walt Disney'],
  ['It always seems impossible until it’s done.', 'Nelson Mandela'],
  ['Action is the foundational key to all success.', 'Pablo Picasso'],
  ['Dream big. Start small. Act now.', 'Robin Sharma'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Your future is created by what you do today, not tomorrow.', 'Robert Kiyosaki'],
  ['Great things are done by a series of small things brought together.', 'Vincent van Gogh'],
  ['Motivation gets you going, but habit gets you there.', 'Zig Ziglar'],
  ['Either you run the day or the day runs you.', 'Jim Rohn'],
  ['Hard work beats talent when talent doesn’t work hard.', 'Tim Notke'],
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Believe you can and you’re halfway there.', 'Theodore Roosevelt'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Push yourself, because no one else is going to do it for you.', 'Unknown'],
  ['A year from now you may wish you had started today.', 'Karen Lamb'],
  ['Quality is not an act, it is a habit.', 'Aristotle'],
  ['Make each day your masterpiece.', 'John Wooden'],
  ['Success usually comes to those who are too busy to be looking for it.', 'Henry David Thoreau'],
  ['If you spend too much time thinking about a thing, you’ll never get it done.', 'Bruce Lee'],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe'],
  ['The harder I work, the luckier I get.', 'Samuel Goldwyn'],
  ['Little by little, one travels far.', 'J.R.R. Tolkien'],
];
const dayIndex = () => Math.floor((parse(todayISO()) - new Date(2024, 0, 1)) / 864e5);
let quoteIdx = dayIndex() % QUOTES.length;

const LEVELS = ['Starter', 'Go-Getter', 'Achiever', 'Focused', 'Pro', 'High Performer', 'Champion', 'Master', 'Legend'];
const xpAt = L => 50 * L * (L - 1); // L1 = 0, L2 = 100, L3 = 300, L4 = 600 …
function levelInfo(xp) {
  let L = 1; while (xpAt(L + 1) <= xp) L++;
  const base = xpAt(L), next = xpAt(L + 1);
  return { L, title: LEVELS[Math.min(L - 1, LEVELS.length - 1)], pct: (xp - base) / (next - base) * 100, toNext: next - xp };
}

const logOf = d => state.log[d] || { t: 0, f: 0 };
function bumpLog(field, n) {
  const k = todayISO();
  const e = (state.log[k] ||= { t: 0, f: 0 });
  e[field] = Math.max(0, e[field] + n);
}
function streak() {
  const active = d => { const e = logOf(d); return e.t > 0 || e.f > 0; };
  let d = new Date();
  if (!active(iso(d))) d = addDays(d, -1); // today still counts as "in progress"
  let n = 0;
  while (active(iso(d))) { n++; d = addDays(d, -1); }
  return n;
}
function statusLine(done, goal) {
  if (done === 0) return 'Fresh day. Let’s make it count 💪';
  if (done >= goal * 2) return 'Unstoppable. You doubled your goal! 🚀';
  if (done >= goal) return 'Daily goal crushed! Anything more is a bonus ✨';
  if (done / goal >= .5) return `Over halfway — ${plural(goal - done, 'task')} to go 🔥`;
  return `Great start! ${plural(goal - done, 'task')} to your goal`;
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
const catColor = c => state.catColors[c] || '#64748b';

function emptyBox(emoji, text) { return el('div', 'empty', `<b>${emoji}</b>${esc(text)}`); }
function fill(container, items, emoji, emptyText) {
  container.replaceChildren(...(items.length ? items : emptyText ? [emptyBox(emoji, emptyText)] : []));
}

let justDone = null;
function taskItem(t) {
  const item = el('div', `item${t.done ? ' done' : ''}${justDone === t.id ? ' just-done' : ''}`);
  const late = !t.done && t.due && t.due < todayISO();
  const meta = [];
  if (t.due) meta.push(`<span class="${late ? 'late' : ''}">${late ? '⚠ ' : ''}${relDate(t.due)}</span>`);
  if (t.time) meta.push(`<span>🕑 ${fmtTime(t.time)}</span>`);
  if (t.category) meta.push(`<span class="tag" style="--cc:${catColor(t.category)}">${esc(t.category)}</span>`);
  if (t.notes) meta.push('<span>📝</span>');
  item.innerHTML = `
    <span class="prio ${t.priority}"></span>
    <button class="check" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${t.done ? '✓' : ''}</button>
    <div class="body"><div class="title">${esc(t.title)}</div>${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}</div>
    ${t.done ? '' : `<span class="xp-badge">+${XP_FOR[t.priority]} XP</span>`}`;
  item.querySelector('.check').addEventListener('click', e => { e.stopPropagation(); toggleTask(t.id, e); });
  item.addEventListener('click', () => openTask(t));
  return item;
}

function eventItem(ev, dateStr) {
  const item = el('div', 'event');
  item.style.setProperty('--ev', ev.color);
  if (dateStr === todayISO()) {
    const n = nowMinutes(), s = toMin(ev.start), e = toMin(ev.end) ?? s + 60;
    if (n >= s && n < e) item.classList.add('now');
    else if (n >= e) item.classList.add('past');
  }
  const rep = { daily: 'Daily', weekly: 'Weekly', weekdays: 'Workdays' }[ev.repeat];
  const meta = [];
  if (ev.place) meta.push(`<span>📍 ${esc(ev.place)}</span>`);
  if (rep) meta.push(`<span>🔁 ${rep}</span>`);
  item.innerHTML = `
    <div class="time">${fmtTime(ev.start)}${ev.end ? `<small>${fmtTime(ev.end)}</small>` : ''}</div>
    <div class="body"><div class="title">${esc(ev.title)}</div>${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}</div>`;
  item.addEventListener('click', () => openEvent(ev));
  return item;
}

/* ========= View: Today ========= */
function renderToday() {
  const t = todayISO();
  const h = new Date().getHours();
  const hello = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent = state.name ? `${hello}, ${state.name}` : hello;
  $('#heroKicker').textContent = `${fmtWeekday.format(new Date())} · Let's go`;

  const done = logOf(t).t, goal = Math.max(1, state.goal);
  const pct = Math.min(100, Math.round(done / goal * 100));
  $('#ringFg').style.strokeDasharray = `${pct} 100`;
  $('#ringFg').classList.toggle('zero', pct === 0);
  $('#ringText').textContent = `${pct}%`;
  $('#heroStatus').textContent = statusLine(done, goal);
  renderQuote();

  setStat('#stStreak', streak());
  setStat('#stDone', done);
  setStat('#stFocus', logOf(t).f);
  setStat('#stXp', state.xp);

  const lv = levelInfo(state.xp);
  $('#lvNum').textContent = lv.L;
  $('#lvTitle').textContent = lv.title;
  $('#lvNext').textContent = `${lv.toNext} XP to level ${lv.L + 1}`;
  requestAnimationFrame(() => $('#xpFill').style.width = `${lv.pct}%`);

  const evs = eventsOn(t);
  renderNext(evs);
  fill($('#todayEvents'), evs.map(e => eventItem(e, t)), '🌤️', 'Your schedule is clear today');
  const todays = tasksOn(t);
  fill($('#todayTasks'), todays.map(taskItem), '🎯', 'No tasks for today — tap + to add one');

  const overdue = state.tasks.filter(x => !x.done && x.due && x.due < t).sort(taskSort);
  $('#overdueWrap').hidden = !overdue.length;
  fill($('#overdueTasks'), overdue.map(taskItem));

  renderWeekChart();
  justDone = null;
}

const lastStat = {};
function setStat(sel, v) {
  const n = $(sel);
  if (lastStat[sel] !== undefined && lastStat[sel] !== v) {
    n.parentElement.classList.remove('pop'); void n.offsetWidth; n.parentElement.classList.add('pop');
  }
  lastStat[sel] = v; n.textContent = v;
}

function renderQuote(animate) {
  const [q, a] = QUOTES[quoteIdx];
  $('#quoteText').textContent = q;
  $('#quoteAuthor').textContent = `— ${a}`;
  if (animate) { const b = $('#quote'); b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap'); }
}
$('#quote').onclick = () => { quoteIdx = (quoteIdx + 1) % QUOTES.length; renderQuote(true); };

function renderNext(evs) {
  const n = nowMinutes();
  const card = $('#nextCard');
  const live = evs.find(e => toMin(e.start) <= n && n < (toMin(e.end) ?? toMin(e.start) + 60));
  const upcoming = evs.find(e => toMin(e.start) > n);
  const ev = live || upcoming;
  if (!ev) { card.hidden = true; return; }
  card.hidden = false;
  card.classList.toggle('live', !!live);
  card.style.setProperty('--ev', ev.color);
  $('#nextLabel').textContent = live ? 'Happening now' : 'Up next';
  $('#nextTitle').textContent = ev.title;
  $('#nextTime').textContent = live
    ? (ev.end ? `until ${fmtTime(ev.end)}` : 'now')
    : inMinutes(toMin(ev.start) - n);
}

function renderWeekChart() {
  const days = Array.from({ length: 7 }, (_, i) => iso(addDays(new Date(), i - 6)));
  const vals = days.map(d => logOf(d).t);
  const max = Math.max(...vals, state.goal, 1);
  const peak = Math.max(...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  $('#weekTotal').textContent = `${total} done`;
  const today = todayISO();
  $('#weekChart').replaceChildren(...days.map((d, i) => {
    const v = vals[i];
    const col = el('div', `bar-col${d === today ? ' today' : ''}`);
    const showVal = v > 0 && (d === today || v === peak);
    col.innerHTML = `
      <span class="tip">${fmtShortDate.format(parse(d))}: ${plural(v, 'task')}</span>
      <span class="val">${showVal ? v : ''}</span>
      <span class="bar" style="height:0"></span>
      <span class="lbl">${d === today ? 'Today' : fmtShortDay.format(parse(d))}</span>`;
    requestAnimationFrame(() => col.querySelector('.bar').style.height = `${v / max * 100}px`);
    return col;
  }));
}

/* ========= View: Tasks ========= */
let taskFilter = 'open', catFilter = '';
function renderTasks() {
  const t = todayISO();
  $('#catFilters').replaceChildren(...['', ...state.categories].map(c => {
    const b = el('button', `chip${c === catFilter ? ' active' : ''}`, c ? `<span class="dot" style="--cc:${catColor(c)}"></span>${esc(c)}` : 'All categories');
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
  if (taskFilter === 'done') fill($('#taskList'), list.map(taskItem), '💪', 'Nothing completed yet — your first win is waiting');
  else fill($('#taskList'), list.map(taskItem), '✨', 'All clear! Add something you want to get done');
  justDone = null;
}
$('#taskFilters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  taskFilter = b.dataset.filter;
  document.querySelectorAll('#taskFilters .chip').forEach(c => c.classList.toggle('active', c === b));
  renderTasks();
});
$('#quickAdd').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#quickInput').value.trim(); if (!v) return;
  state.tasks.push({ id: uid(), title: v, notes: '', due: todayISO(), time: '', priority: 'med', category: catFilter, done: false, createdAt: Date.now() });
  $('#quickInput').value = '';
  save(); render(); toast('Task added 🎯');
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
  const rel = relDate(selDate), full = fmtDay.format(parse(selDate));
  $('#dayTitle').textContent = rel === full ? full : `${rel} · ${full}`;
  fill($('#dayEvents'), eventsOn(selDate).map(e => eventItem(e, selDate)), '🗓️', 'No events — tap + to block some time');
  fill($('#dayTasks'), tasksOn(selDate).map(taskItem), '✅', 'No tasks for this day');
}
$('#prevWeek').onclick = () => { selDate = iso(addDays(parse(selDate), -7)); renderSchedule(); };
$('#nextWeek').onclick = () => { selDate = iso(addDays(parse(selDate), 7)); renderSchedule(); };
$('#thisWeek').onclick = () => { selDate = todayISO(); renderSchedule(); };

/* ========= View: Focus (Pomodoro) ========= */
const MODES = { focus: { min: 25, label: 'Focus time' }, short: { min: 5, label: 'Short break' }, long: { min: 15, label: 'Long break' } };
let timer = { mode: 'focus', remaining: 25 * 60, endsAt: null };
try { const t = JSON.parse(sessionStorage.getItem('lo-timer')); if (t && MODES[t.mode]) timer = t; } catch (e) { /* */ }
const saveTimer = () => { try { sessionStorage.setItem('lo-timer', JSON.stringify(timer)); } catch (e) { /* */ } };
const timeLeft = () => timer.endsAt ? Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000)) : timer.remaining;

function renderFocus() {
  document.querySelectorAll('#focusModes .chip').forEach(c => c.classList.toggle('active', c.dataset.mode === timer.mode));
  const open = state.tasks.filter(t => !t.done).sort(taskSort);
  const sel = $('#focusTask');
  sel.replaceChildren(el('option', '', 'Just focusing'), ...open.map(t => { const o = el('option', '', esc(t.title)); o.value = t.id; return o; }));
  sel.options[0].value = '';
  sel.value = open.some(t => t.id === state.focusTask) ? state.focusTask : '';
  const today = logOf(todayISO());
  $('#focusSummary').textContent = today.f
    ? `Today: ${today.f} focused minutes · ${plural(state.sessions, 'session')} all-time`
    : 'No focus sessions yet today. Your first one starts here.';
  tickTimer();
}
function tickTimer() {
  const left = timeLeft(), total = MODES[timer.mode].min * 60;
  $('#timerText').textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  $('#timerFg').style.strokeDasharray = `${left / total * 100} 100`;
  const running = !!timer.endsAt;
  const wrap = $('.timer');
  wrap.classList.toggle('running', running);
  wrap.classList.toggle('break', timer.mode !== 'focus');
  $('#timerStart').textContent = running ? 'Pause' : left < total ? 'Resume' : 'Start';
  $('#timerLabel').textContent = running ? MODES[timer.mode].label : left < total ? 'Paused' : timer.mode === 'focus' ? 'Ready to focus?' : 'Time to recharge';
  if (running) document.title = `${$('#timerText').textContent} · ${MODES[timer.mode].label}`;
  else document.title = 'Life Organizer';
  if (running && left === 0) finishTimer();
}
function setMode(m) { timer = { mode: m, remaining: MODES[m].min * 60, endsAt: null }; saveTimer(); tickTimer(); renderFocus(); }
$('#focusModes').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setMode(b.dataset.mode); });
$('#focusTask').addEventListener('change', e => { state.focusTask = e.target.value; save(); });
$('#timerStart').onclick = () => {
  if (timer.endsAt) { timer.remaining = timeLeft(); timer.endsAt = null; }
  else {
    timer.endsAt = Date.now() + timer.remaining * 1000;
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    beep(0); // unlock audio on user gesture
  }
  saveTimer(); tickTimer();
};
$('#timerReset').onclick = () => setMode(timer.mode);
$('#timerSkip').onclick = () => { timer.endsAt = Date.now(); finishTimer(true); };

function finishTimer(skipped) {
  const was = timer.mode;
  if (was === 'focus' && !skipped) {
    state.xp += FOCUS_XP; state.sessions++; bumpLog('f', MODES.focus.min); save();
    beep(1); confetti();
    notify('Focus session complete! 🎉', `+${FOCUS_XP} XP. Take a short break.`);
    toast(`Session complete! <span class="xp">+${FOCUS_XP} XP</span>`, null, true);
  } else if (!skipped) {
    beep(1); notify('Break is over', 'Ready for another focus session?');
    toast('Break over — let’s go again 💪');
  }
  setMode(was === 'focus' ? (state.sessions % 4 === 0 && !skipped ? 'long' : 'short') : 'focus');
}
let audioCtx;
function beep(loud) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (!loud) return;
    [0, .18, .36].forEach((t, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = [660, 880, 1100][i]; o.type = 'sine';
      g.gain.setValueAtTime(.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.25, audioCtx.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + t + .3);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + .32);
    });
  } catch (e) { /* audio unavailable */ }
}
function notify(title, body) {
  try { if (document.hidden && Notification.permission === 'granted') new Notification(title, { body, icon: 'icons/icon.svg' }); } catch (e) { /* */ }
}

/* ========= View: Settings ========= */
function renderSettings() {
  $('#userName').value = state.name;
  $('#dailyGoal').value = state.goal;
  $('#catManage').replaceChildren(...state.categories.map(c => {
    const b = el('button', 'chip', `<span class="dot" style="--cc:${catColor(c)}"></span>${esc(c)}<span class="x">✕</span>`);
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
$('#dailyGoal').addEventListener('change', e => { state.goal = Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 3)); e.target.value = state.goal; save(); });
$('#catForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#catInput').value.trim();
  if (v && !state.categories.includes(v)) {
    state.categories.push(v);
    if (!state.catColors[v]) {
      const used = new Set(Object.values(state.catColors));
      state.catColors[v] = COLORS.find(c => !used.has(c)) || COLORS[state.categories.length % COLORS.length];
    }
    save();
  }
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
    localStorage.setItem(KEY, JSON.stringify(d));
    state = load(); save(); render(); toast('Imported ✓');
  } catch { toast('Invalid file'); }
  e.target.value = '';
});
$('#clearDone').onclick = () => {
  const n = state.tasks.filter(t => t.done).length;
  if (!n) return toast('No completed tasks');
  if (!confirm(`Delete ${plural(n, 'completed task')}? Your XP and streak stay.`)) return;
  state.tasks = state.tasks.filter(t => !t.done); save(); render();
};

/* ========= Tasks: add/edit ========= */
let editingTask = null, pickedPrio = 'med';
function setPrio(p) { pickedPrio = p; document.querySelectorAll('#prioSeg button').forEach(b => b.classList.toggle('sel', b.dataset.p === p)); }
$('#prioSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPrio(b.dataset.p); });
function openTask(t = null) {
  editingTask = t;
  const f = $('#taskForm');
  f.category.replaceChildren(el('option', '', 'None'), ...state.categories.map(c => { const o = el('option', '', esc(c)); o.value = c; return o; }));
  f.category.options[0].value = '';
  f.title.value = t?.title || '';
  f.notes.value = t?.notes || '';
  f.due.value = t ? (t.due || '') : (currentView === 'schedule' ? selDate : todayISO());
  f.time.value = t?.time || '';
  setPrio(t?.priority || 'med');
  f.category.value = t?.category || catFilter || '';
  $('#taskDialogTitle').textContent = t ? 'Edit task' : 'New task';
  $('#taskDelete').hidden = !t;
  $('#taskDialog').showModal();
  if (!t) f.title.focus();
}
$('#taskForm').addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const f = e.target;
  const data = { title: f.title.value.trim(), notes: f.notes.value.trim(), due: f.due.value, time: f.time.value, priority: pickedPrio, category: f.category.value };
  if (!data.title) return;
  if (editingTask) Object.assign(state.tasks.find(x => x.id === editingTask.id), data);
  else { state.tasks.push({ id: uid(), done: false, createdAt: Date.now(), ...data }); toast('Task added 🎯'); }
  save(); render();
});
$('#taskDelete').onclick = () => {
  const t = editingTask, i = state.tasks.findIndex(x => x.id === t.id);
  state.tasks.splice(i, 1); save(); $('#taskDialog').close(); render();
  toast('Task deleted', () => { state.tasks.splice(i, 0, t); save(); render(); });
};

const CHEERS = ['Nice work!', 'Boom! Done.', 'Crushing it!', 'One more down!', 'Keep it rolling!', 'You’re on fire!', 'Productive legend!', 'Way to go!'];
function toggleTask(id, ev) {
  const t = state.tasks.find(x => x.id === id);
  t.done = !t.done;
  const gain = XP_FOR[t.priority] || 10;
  // XP + history count toward the day it was completed
  if (t.done) {
    t.doneAt = Date.now(); state.xp += gain; bumpLog('t', 1); justDone = id;
  } else {
    const k = t.doneAt ? iso(new Date(t.doneAt)) : todayISO();
    if (state.log[k]) state.log[k].t = Math.max(0, state.log[k].t - 1);
    state.xp = Math.max(0, state.xp - gain); t.doneAt = null;
  }
  const before = levelInfo(state.xp - (t.done ? gain : 0)).L;
  save(); render();
  if (!t.done) return;

  const r = ev?.target?.getBoundingClientRect?.();
  confetti(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null, 60);
  const lv = levelInfo(state.xp);
  const doneToday = logOf(todayISO()).t;
  if (lv.L > before) {
    celebrate('🚀', `Level ${lv.L} unlocked!`, `You're now a ${lv.title}. Keep stacking those wins.`);
  } else if (doneToday >= state.goal && state.celebrated !== todayISO()) {
    state.celebrated = todayISO(); save();
    celebrate('🏆', 'Daily goal reached!', `${plural(doneToday, 'task')} done today${streak() > 1 ? ` · ${streak()}-day streak 🔥` : ''}. You showed up and delivered.`);
  } else {
    toast(`${CHEERS[Math.floor(Math.random() * CHEERS.length)]} <span class="xp">+${gain} XP</span>`, () => toggleTask(id), true);
  }
}
function celebrate(emoji, title, text) {
  $('#celEmoji').textContent = emoji;
  $('#celTitle').textContent = title;
  $('#celText').textContent = text;
  $('#celebrate').showModal();
  confetti(null, 180);
  beep(1);
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
  else { state.events.push({ id: uid(), ...data }); toast('Event added 🗓️'); }
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
  if (currentView === 'focus') return openTask();
  $('#addChoice').showModal();
};
$('#addTaskBtn').onclick = () => { $('#addChoice').close(); openTask(); };
$('#addEventBtn').onclick = () => { $('#addChoice').close(); openEvent(); };

let toastTimer;
function toast(msg, undo, html) {
  const t = $('#toast');
  t.innerHTML = `<span>${html ? msg : esc(msg)}</span>`;
  if (undo) { const b = el('button', '', 'Undo'); b.onclick = () => { t.hidden = true; undo(); }; t.append(b); }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 3500);
}

/* ========= Confetti ========= */
const cv = $('#confetti'), cx = cv.getContext('2d');
let parts = [], raf = null;
const CONF_COLORS = ['#7c3aed', '#db2777', '#f59e0b', '#10b981', '#0ea5e9', '#f43f5e', '#facc15'];
function confetti(origin, n = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const o = origin || { x: innerWidth / 2, y: innerHeight * .35 };
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * (origin ? 7 : 11);
    parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (origin ? 4 : 6), r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: CONF_COLORS[i % CONF_COLORS.length], life: 1 });
  }
  if (!raf) raf = requestAnimationFrame(step);
}
function step() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 20);
  for (const p of parts) {
    p.vy += .25; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .008;
    cx.save(); cx.globalAlpha = Math.min(1, p.life * 2); cx.translate(p.x, p.y); cx.rotate(p.r);
    cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(step) : (cx.clearRect(0, 0, innerWidth, innerHeight), null);
}

/* ========= Navigation ========= */
const TITLES = { today: 'Today', tasks: 'Tasks', schedule: 'Schedule', focus: 'Focus', settings: 'Settings' };
let currentView = 'today';
function setView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === `view-${v}`));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#viewTitle').textContent = TITLES[v];
  $('#fab').hidden = v === 'settings' || v === 'focus';
  try { sessionStorage.setItem('lo-view', v); } catch (e) { /* */ }
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => setView(b.dataset.view));
document.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => setView(b.dataset.goto));

function renderHeader() {
  const d = new Date();
  $('#viewSub').textContent = fmtDay.format(d) + (fmtHijri ? ` · ${fmtHijri.format(d)}` : '');
  const lv = levelInfo(state.xp);
  $('#levelPill').textContent = `Lv ${lv.L} · ${lv.title}`;
}
function render() {
  renderHeader();
  ({ today: renderToday, tasks: renderTasks, schedule: renderSchedule, focus: renderFocus, settings: renderSettings })[currentView]();
}

/* ========= Dark mode ========= */
function applyTheme() {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = dark ? '#0b0a16' : '#f4f3fb';
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
}
$('#themeBtn').onclick = () => {
  state.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  save(); applyTheme();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ========= Startup ========= */
let state = load();
save();
applyTheme();
let saved; try { saved = sessionStorage.getItem('lo-view'); } catch (e) { /* */ }
setView(TITLES[saved] ? saved : 'today');
setInterval(() => { if (timer.endsAt) tickTimer(); }, 500);
setInterval(() => { if (currentView === 'today' || currentView === 'schedule') render(); }, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
