// ===== KPSS Haftalık Çalışma Takip Uygulaması =====

const DAYS = [
    { key: 'pazartesi', label: 'Pazartesi', short: 'Pzt', jsDay: 1 },
    { key: 'sali', label: 'Salı', short: 'Sal', jsDay: 2 },
    { key: 'carsamba', label: 'Çarşamba', short: 'Çar', jsDay: 3 },
    { key: 'persembe', label: 'Perşembe', short: 'Per', jsDay: 4 },
    { key: 'cuma', label: 'Cuma', short: 'Cum', jsDay: 5 },
    { key: 'cumartesi', label: 'Cumartesi', short: 'Cmt', jsDay: 6 },
    { key: 'pazar', label: 'Pazar', short: 'Paz', jsDay: 0 }
];

const STORAGE_KEY = 'kpss_tracker_v2';
const DRAFT_KEY = 'kpss_tracker_drafts';
const HISTORY_KEY = 'kpss_tracker_history';
const EXAM_DATE = new Date(2026, 9, 4); // 4 Ekim 2026
let appData = null;
let selectedDay = null;

// ===== DAY NAME LOOKUP =====
const DAY_LOOKUP = {};
const DAY_NAMES_SORTED = [];
(function buildDayLookup() {
    const aliases = {
        pazartesi: 'pazartesi', pzt: 'pazartesi',
        'salı': 'sali', sali: 'sali', sal: 'sali',
        'çarşamba': 'carsamba', carsamba: 'carsamba', 'çar': 'carsamba', car: 'carsamba',
        'çarsamba': 'carsamba', 'carşamba': 'carsamba',
        'perşembe': 'persembe', persembe: 'persembe', per: 'persembe',
        'persembe': 'persembe', 'perşembe': 'persembe',
        cuma: 'cuma', cum: 'cuma',
        cumartesi: 'cumartesi', cmt: 'cumartesi',
        pazar: 'pazar', paz: 'pazar'
    };
    Object.assign(DAY_LOOKUP, aliases);
    DAYS.forEach(d => {
        DAY_LOOKUP[d.key] = d.key;
        DAY_LOOKUP[d.label.toLowerCase()] = d.key;
        DAY_LOOKUP[d.short.toLowerCase()] = d.key;
    });
    Object.keys(DAY_LOOKUP).sort((a, b) => b.length - a.length).forEach(k => {
        DAY_NAMES_SORTED.push({ name: k, key: DAY_LOOKUP[k] });
    });
})();

function turkishLower(s) {
    return s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
}

function detectDayHeader(rawLine) {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;
    if (/^[-*•]/.test(trimmed)) return null;

    const stripped = turkishLower(trimmed).replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '').trim();
    if (DAY_LOOKUP[stripped]) return DAY_LOOKUP[stripped];

    const normalized = turkishLower(trimmed)
        .replace(/[\d\.\,\;\:\!\?\(\)\[\]\{\}\*\#\>\<\=\+\_\"\'\/ \\@\&\|\~\^`]/g, '')
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}]/gu, '')
        .replace(/[–—―‐‑‒…·•▪▸►→←↑↓«»""''⟨⟩📅📌📍✅❌☐☑]/g, '')
        .trim();
    if (DAY_LOOKUP[normalized]) return DAY_LOOKUP[normalized];

    const lower = turkishLower(trimmed);
    for (const entry of DAY_NAMES_SORTED) {
        if (entry.name.length <= 3 && lower.length > 10) continue;
        if (lower.includes(entry.name)) {
            if (/^[-*•]/.test(trimmed)) return null;
            return entry.key;
        }
    }

    return null;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setHeaderDate();
    setCountdown();
    setupTabs();
    setupDaySelector();
    buildWeeklyForm();
    setupFormActions();
    renderToday();
    renderDone();
    renderHistory();
    setupAutoSaveDrafts();
});

// ===== DATA =====
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        appData = raw ? JSON.parse(raw) : { days: {}, weekLabel: getCurrentWeekLabel() };
    } catch {
        appData = { days: {}, weekLabel: getCurrentWeekLabel() };
    }
    if (!appData.weekLabel) appData.weekLabel = getCurrentWeekLabel();
    DAYS.forEach(d => {
        if (!appData.days[d.key]) {
            appData.days[d.key] = { tekrar: [], yeniKonular: [] };
        }
    });
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ===== WEEK LABEL HELPERS =====
function getCurrentWeekLabel() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-H${weekNumber}`;
}

function getWeekDateRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = d => `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'short' })}`;
    return `${fmt(monday)} – ${fmt(sunday)}`;
}

// ===== DRAFT AUTO-SAVE =====
function setupAutoSaveDrafts() {
    const yeniEl = document.getElementById('inputBulkYeni');
    const tekrarEl = document.getElementById('inputBulkTekrar');
    
    // Restore drafts
    try {
        const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        if (drafts.yeni && yeniEl && !yeniEl.value.trim()) yeniEl.value = drafts.yeni;
        if (drafts.tekrar && tekrarEl && !tekrarEl.value.trim()) tekrarEl.value = drafts.tekrar;
    } catch {}

    // Auto-save as user types (debounced)
    let saveTimeout = null;
    const autoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const drafts = {
                yeni: yeniEl ? yeniEl.value : '',
                tekrar: tekrarEl ? tekrarEl.value : ''
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
        }, 500);
    };

    if (yeniEl) yeniEl.addEventListener('input', autoSave);
    if (tekrarEl) tekrarEl.addEventListener('input', autoSave);
}

// ===== HISTORY =====
function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function archiveCurrentWeek() {
    // Calculate stats
    let totalTasks = 0, completedTasks = 0;
    const daySummaries = {};
    
    DAYS.forEach(d => {
        const dd = appData.days[d.key];
        let dayTotal = 0, dayDone = 0;
        const subjects = new Set();
        
        ['tekrar', 'yeniKonular'].forEach(type => {
            const items = dd[type] || [];
            dayTotal += items.length;
            dayDone += items.filter(t => t.completed).length;
            items.forEach(t => { if (t.subject) subjects.add(t.subject); });
        });
        
        totalTasks += dayTotal;
        completedTasks += dayDone;
        
        if (dayTotal > 0) {
            daySummaries[d.key] = {
                label: d.label,
                total: dayTotal,
                completed: dayDone,
                subjects: [...subjects]
            };
        }
    });

    if (totalTasks === 0) return; // Nothing to archive

    const entry = {
        id: genId(),
        weekLabel: appData.weekLabel || getCurrentWeekLabel(),
        dateRange: getWeekDateRange(),
        archivedAt: new Date().toISOString(),
        totalTasks,
        completedTasks,
        percentage: Math.round((completedTasks / totalTasks) * 100),
        daySummaries
    };

    const history = loadHistory();
    history.unshift(entry);
    // Keep last 52 weeks max
    if (history.length > 52) history.pop();
    saveHistory(history);
}

function renderHistory() {
    const container = document.getElementById('historyContent');
    if (!container) return;

    const history = loadHistory();

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📊</span>
                <p>Henüz geçmiş hafta kaydı yok</p>
                <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
                    "Yeni Hafta" butonuna bastığında mevcut hafta otomatik arşivlenir.
                </p>
            </div>`;
        return;
    }

    // Summary stats
    const totalWeeks = history.length;
    const avgProgress = Math.round(history.reduce((sum, h) => sum + h.percentage, 0) / totalWeeks);
    const totalCompleted = history.reduce((sum, h) => sum + h.completedTasks, 0);

    let html = `
        <div class="history-stats">
            <div class="history-stat-card">
                <span class="history-stat-number">${totalWeeks}</span>
                <span class="history-stat-label">Hafta</span>
            </div>
            <div class="history-stat-card">
                <span class="history-stat-number">${avgProgress}%</span>
                <span class="history-stat-label">Ort. İlerleme</span>
            </div>
            <div class="history-stat-card">
                <span class="history-stat-number">${totalCompleted}</span>
                <span class="history-stat-label">Toplam Konu</span>
            </div>
        </div>

        <div class="history-chart">
            <div class="chart-title">📈 Haftalık İlerleme Grafiği</div>
            <div class="chart-bars">
                ${history.slice().reverse().map(h => `
                    <div class="chart-bar-wrapper" title="${h.weekLabel}: %${h.percentage}">
                        <div class="chart-bar" style="height: ${Math.max(h.percentage, 4)}%">
                            <span class="chart-bar-value">${h.percentage}%</span>
                        </div>
                        <span class="chart-bar-label">${h.weekLabel.split('-')[1] || h.weekLabel}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="history-list">
    `;

    history.forEach(entry => {
        const pctClass = entry.percentage >= 80 ? 'excellent' : entry.percentage >= 50 ? 'good' : 'low';
        const dayCards = DAYS
            .filter(d => entry.daySummaries[d.key])
            .map(d => {
                const ds = entry.daySummaries[d.key];
                const dsPercent = ds.total > 0 ? Math.round((ds.completed / ds.total) * 100) : 0;
                return `
                    <div class="history-day-mini">
                        <span class="history-day-name">${d.short}</span>
                        <div class="history-day-bar">
                            <div class="history-day-bar-fill" style="width:${dsPercent}%"></div>
                        </div>
                        <span class="history-day-stat">${ds.completed}/${ds.total}</span>
                    </div>
                `;
            }).join('');

        html += `
            <div class="history-card">
                <div class="history-card-header">
                    <div class="history-card-left">
                        <div class="history-week-label">${entry.weekLabel}</div>
                        <div class="history-date-range">${entry.dateRange}</div>
                    </div>
                    <div class="history-card-right">
                        <div class="history-pct ${pctClass}">${entry.percentage}%</div>
                        <div class="history-task-count">${entry.completedTasks}/${entry.totalTasks} konu</div>
                    </div>
                </div>
                <div class="history-card-body">
                    ${dayCards}
                </div>
                <div class="history-progress-bar">
                    <div class="history-progress-fill ${pctClass}" style="width:${entry.percentage}%"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ===== HEADER =====
function setHeaderDate() {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('headerDate').textContent = now.toLocaleDateString('tr-TR', opts);
}

function setCountdown() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = EXAM_DATE - today;
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    document.getElementById('countdownNumber').textContent = daysLeft;
}

function updateStats() {
    const dayData = appData.days[selectedDay];
    if (!dayData) return;
    const countItems = list => (list || []).filter(t => !t.completed).length;
    const countDone = list => (list || []).filter(t => t.completed).length;
    const remaining = countItems(dayData.tekrar) + countItems(dayData.yeniKonular);
    const done = countDone(dayData.tekrar) + countDone(dayData.yeniKonular);
    document.querySelector('#statToday .stat-number').textContent = remaining;
    document.querySelector('#statDone .stat-number').textContent = done;
    
    let totalAll = 0, totalDone = 0;
    DAYS.forEach(d => {
        const dd = appData.days[d.key];
        ['tekrar', 'yeniKonular'].forEach(type => {
            totalAll += (dd[type] || []).length;
            totalDone += (dd[type] || []).filter(t => t.completed).length;
        });
    });
    const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
    document.querySelector('#statStreak .stat-number').textContent = pct + '%';
}

// ===== TABS =====
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const panel = document.getElementById('panel' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1));
            if (panel) { void panel.offsetWidth; panel.classList.add('active'); }
        });
    });
}

// ===== DAY SELECTOR =====
function setupDaySelector() {
    const jsDay = new Date().getDay();
    const todayObj = DAYS.find(d => d.jsDay === jsDay) || DAYS[0];
    selectedDay = todayObj.key;

    document.querySelectorAll('.day-btn').forEach(btn => {
        const dayKey = btn.dataset.day;
        const dayObj = DAYS.find(d => d.key === dayKey);
        if (dayObj && dayObj.jsDay === jsDay) btn.classList.add('today');
        if (dayKey === selectedDay) btn.classList.add('active');
        btn.addEventListener('click', () => {
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDay = dayKey;
            renderToday();
        });
    });
}

// ===== RENDER TODAY =====
function renderToday() {
    const dayData = appData.days[selectedDay];
    if (!dayData) return;

    renderTaskList('lessonsList', dayData.yeniKonular, 'yeniKonular');
    renderTaskList('reviewList', dayData.tekrar, 'tekrar');

    const count = list => (list || []).filter(t => !t.completed).length;
    document.getElementById('lessonsCount').textContent = count(dayData.yeniKonular);
    document.getElementById('reviewCount').textContent = count(dayData.tekrar);
    updateStats();
    renderWeeklyOverview();
}

function renderTaskList(containerId, tasks, type) {
    const container = document.getElementById(containerId);
    const pending = (tasks || []).filter(t => !t.completed);

    if (pending.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><p>${type === 'tekrar' ? 'Tekrar programı yok' : 'Yeni konu yok'}</p></div>`;
        return;
    }

    let html = '';
    let currentSubject = null;

    pending.forEach(task => {
        if (task.subject && task.subject !== currentSubject) {
            currentSubject = task.subject;
            html += `<div class="subject-header">${escapeHtml(currentSubject)}</div>`;
        }
        html += `
            <div class="task-item" data-id="${task.id}" data-type="${type}">
                <label class="task-checkbox">
                    <input type="checkbox">
                    <span class="checkmark"></span>
                </label>
                <span class="task-text">${escapeHtml(task.text)}</span>
            </div>
        `;
    });

    const all = tasks || [];
    const doneCount = all.filter(t => t.completed).length;
    const pct = all.length > 0 ? Math.round((doneCount / all.length) * 100) : 0;
    if (all.length > 0) {
        html += `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('.task-item').forEach(item => {
        item.querySelector('input[type="checkbox"]').addEventListener('change', () => {
            handleComplete(item, item.dataset.id, item.dataset.type);
        });
    });
}

function handleComplete(el, taskId, type) {
    const list = appData.days[selectedDay][type];
    const task = list.find(t => t.id === taskId);
    if (!task) return;
    task.completed = true;
    task.completedAt = new Date().toISOString();
    saveData();
    el.classList.add('completing');
    showToast('Konu tamamlandı! ✨');
    setTimeout(() => { renderToday(); renderDone(); }, 450);
}

// ===== WEEKLY FORM =====
function buildWeeklyForm() {
    const tekrarEl = document.getElementById('inputBulkTekrar');
    const yeniEl = document.getElementById('inputBulkYeni');
    
    // First try to load from saved program data, then check drafts
    const tekrarFromData = reconstructBulk('tekrar');
    const yeniFromData = reconstructBulk('yeniKonular');
    
    try {
        const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        // Use program data if available, otherwise use drafts
        if (tekrarEl) tekrarEl.value = tekrarFromData || drafts.tekrar || '';
        if (yeniEl) yeniEl.value = yeniFromData || drafts.yeni || '';
    } catch {
        if (tekrarEl) tekrarEl.value = tekrarFromData;
        if (yeniEl) yeniEl.value = yeniFromData;
    }
}

function reconstructBulk(type) {
    let lines = [];
    DAYS.forEach(day => {
        const items = appData.days[day.key][type] || [];
        if (items.length === 0) return;
        lines.push(day.label);
        let lastSubject = null;
        items.forEach(t => {
            if (t.subject && t.subject !== lastSubject) {
                lastSubject = t.subject;
                lines.push(t.subject);
            }
            lines.push('-' + t.text);
        });
        lines.push('');
    });
    return lines.join('\n').trim();
}

// ===== FORM ACTIONS =====
function setupFormActions() {
    document.getElementById('btnSave').addEventListener('click', saveProgram);
    document.getElementById('btnClear').addEventListener('click', clearAll);
    document.getElementById('btnResetWeek').addEventListener('click', resetWeek);
}

function saveProgram() {
    const tekrarText = document.getElementById('inputBulkTekrar').value;
    const yeniText = document.getElementById('inputBulkYeni').value;

    const tekrarByDay = parseBulkText(tekrarText);
    const yeniByDay = parseBulkText(yeniText);

    DAYS.forEach(day => {
        const oldT = appData.days[day.key].tekrar || [];
        const oldY = appData.days[day.key].yeniKonular || [];
        appData.days[day.key].tekrar = mapToTasks(tekrarByDay[day.key] || [], oldT);
        appData.days[day.key].yeniKonular = mapToTasks(yeniByDay[day.key] || [], oldY);
    });

    appData.weekLabel = getCurrentWeekLabel();
    saveData();
    
    // Clear drafts since we saved
    localStorage.removeItem(DRAFT_KEY);
    
    renderToday();
    renderDone();
    showToast('Haftalık program kaydedildi! 🎉');
    document.querySelector('[data-tab="today"]').click();
}

// ===== PARSER =====
function parseBulkText(text) {
    const result = {};
    DAYS.forEach(d => { result[d.key] = []; });
    if (!text || !text.trim()) return result;

    const lines = text.split('\n');
    let currentDay = null;
    let currentSubject = null;
    let subjectHasTopics = false;

    function flushPendingSubject() {
        if (currentDay && currentSubject && !subjectHasTopics) {
            const cleanText = currentSubject.replace(/^[-*•]\s*/, '').trim();
            if (cleanText) {
                result[currentDay].push({ subject: null, text: cleanText });
            }
        }
    }

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        const detectedDay = detectDayHeader(trimmed);
        if (detectedDay) {
            flushPendingSubject();
            currentDay = detectedDay;
            currentSubject = null;
            subjectHasTopics = false;
            continue;
        }

        if (!currentDay) continue;

        const topicMatch = trimmed.match(/^[-*•]\s*(.*)/);
        if (topicMatch) {
            const topicText = topicMatch[1].trim();
            if (topicText) {
                subjectHasTopics = true;
                result[currentDay].push({ subject: currentSubject, text: topicText });
            }
        } else {
            flushPendingSubject();
            currentSubject = trimmed;
            subjectHasTopics = false;
        }
    }

    flushPendingSubject();
    return result;
}

function mapToTasks(parsed, oldItems) {
    if (!parsed || parsed.length === 0) return [];
    return parsed.map(p => {
        const existing = oldItems.find(item => item.text === p.text && item.subject === p.subject);
        if (existing) return existing;
        return {
            id: genId(),
            text: p.text,
            subject: p.subject || null,
            completed: false,
            completedAt: null
        };
    });
}

function clearAll() {
    if (!confirm('Tüm programı silmek istediğinize emin misiniz?')) return;
    appData = { days: {}, weekLabel: getCurrentWeekLabel() };
    DAYS.forEach(d => { appData.days[d.key] = { tekrar: [], yeniKonular: [] }; });
    saveData();
    localStorage.removeItem(DRAFT_KEY);
    buildWeeklyForm();
    renderToday();
    renderDone();
    showToast('Program temizlendi');
}

function resetWeek() {
    if (!confirm('Yeni haftaya geçilecek:\n\n✅ Mevcut hafta arşivlenecek\n🔄 Tamamlanan konular sıfırlanacak\n📋 Program yapısı korunacak\n\nDevam?')) return;
    
    // Archive current week first
    archiveCurrentWeek();
    
    // Reset completions
    DAYS.forEach(d => {
        const dd = appData.days[d.key];
        ['tekrar', 'yeniKonular'].forEach(type => {
            (dd[type] || []).forEach(t => {
                t.completed = false;
                t.completedAt = null;
            });
        });
    });
    
    appData.weekLabel = getCurrentWeekLabel();
    saveData();
    renderToday();
    renderDone();
    renderHistory();
    showToast('Yeni hafta başlatıldı! Geçmiş arşivlendi 🚀');
}

// ===== DONE =====
function renderDone() {
    const container = document.getElementById('doneContent');
    let allDone = [];

    DAYS.forEach(day => {
        const dd = appData.days[day.key];
        ['tekrar', 'yeniKonular'].forEach(type => {
            (dd[type] || []).forEach(t => {
                if (t.completed) {
                    allDone.push({ ...t, dayKey: day.key, dayLabel: day.label, type });
                }
            });
        });
    });

    if (allDone.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="empty-icon">🏆</span><p>Henüz tamamlanan konu yok</p></div>';
        return;
    }

    const grouped = {};
    allDone.forEach(item => {
        if (!grouped[item.dayKey]) grouped[item.dayKey] = { label: item.dayLabel, items: [] };
        grouped[item.dayKey].items.push(item);
    });

    let html = '<div class="done-grid">';
    html += DAYS.filter(d => grouped[d.key]).map(d => {
        const g = grouped[d.key];
        return `<div class="done-day-card">
            <div class="done-day-title">📅 ${g.label} <span class="done-day-count">${g.items.length}</span></div>
            <div class="done-day-items">
                ${g.items.map(item => `
                    <div class="done-item">
                        <div class="done-item-top">
                            <span class="done-badge ${item.type === 'tekrar' ? 'review' : 'lessons'}">${item.type === 'tekrar' ? 'Tekrar' : 'Yeni'}</span>
                            ${item.subject ? `<span class="done-subject">${escapeHtml(item.subject)}</span>` : ''}
                        </div>
                        <div class="done-item-bottom">
                            <span class="done-text">${escapeHtml(item.text)}</span>
                            <div class="done-item-actions">
                                <span class="done-time">${fmtTime(item.completedAt)}</span>
                                <button class="done-undo-btn" onclick="undoTask('${item.dayKey}','${item.type}','${item.id}')">Geri Al</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }).join('');
    html += '</div>';
    container.innerHTML = html;
}

function undoTask(dayKey, type, taskId) {
    const list = appData.days[dayKey][type];
    const task = list.find(t => t.id === taskId);
    if (!task) return;
    task.completed = false;
    task.completedAt = null;
    saveData();
    renderToday();
    renderDone();
    showToast('Konu geri alındı');
}

// ===== UTILS =====
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastText').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== WEEKLY OVERVIEW =====
function renderWeeklyOverview() {
    const container = document.getElementById('weeklyOverview');
    const jsDay = new Date().getDay();
    const todayObj = DAYS.find(d => d.jsDay === jsDay) || DAYS[0];

    const hasAnyTasks = DAYS.some(d => {
        const dd = appData.days[d.key];
        return (dd.tekrar || []).length > 0 || (dd.yeniKonular || []).length > 0;
    });

    if (!hasAnyTasks) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = DAYS.map(d => {
        const dd = appData.days[d.key];
        let total = 0, done = 0;
        ['tekrar', 'yeniKonular'].forEach(type => {
            total += (dd[type] || []).length;
            done += (dd[type] || []).filter(t => t.completed).length;
        });
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const isToday = d.key === todayObj.key;
        const isActive = d.key === selectedDay;
        let progressClass = 'none';
        if (total > 0 && done === total) progressClass = 'all-done';
        else if (done > 0) progressClass = 'partial';

        return `<div class="week-day-card ${isToday ? 'is-today' : ''} ${isActive ? 'active' : ''}" data-overview-day="${d.key}">
            <div class="day-name">${d.short}</div>
            <div class="day-progress ${progressClass}">${total > 0 ? (pct === 100 ? '✓' : done + '/' + total) : '–'}</div>
            <div class="day-bar"><div class="day-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');

    container.querySelectorAll('.week-day-card').forEach(card => {
        card.addEventListener('click', () => {
            const dayKey = card.dataset.overviewDay;
            selectedDay = dayKey;
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            const dayBtn = document.querySelector(`.day-btn[data-day="${dayKey}"]`);
            if (dayBtn) dayBtn.classList.add('active');
            renderToday();
        });
    });
}
