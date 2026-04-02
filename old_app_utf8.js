// ===== KPSS Ba┼şar─▒ Rehberi - Ana Uygulama Dosyas─▒ =====

/* --- SAB─░TLER VE VER─░ YAPISI --- */
const STORAGE_KEY = 'kpss_tracker_v2';
const HISTORY_KEY = 'kpss_tracker_history';
const DRAFT_KEY = 'kpss_tracker_drafts';
const EXAM_DATE = new Date(2026, 9, 4); // 4 Ekim 2026

const DAYS = [
    { key: 'pazartesi', label: 'Pazartesi', short: 'Pzt', jsDay: 1 },
    { key: 'sali', label: 'Sal─▒', short: 'Sal', jsDay: 2 },
    { key: 'carsamba', label: '├çar┼şamba', short: '├çar', jsDay: 3 },
    { key: 'persembe', label: 'Per┼şembe', short: 'Per', jsDay: 4 },
    { key: 'cuma', label: 'Cuma', short: 'Cum', jsDay: 5 },
    { key: 'cumartesi', label: 'Cumartesi', short: 'Cmt', jsDay: 6 },
    { key: 'pazar', label: 'Pazar', short: 'Paz', jsDay: 0 }
];

// Kazan─▒labilir rozetlerin tan─▒mlar─▒
const BADGES_DEFS = {
    'first_blood': { icon: '­şÄ»', name: '─░lk Ad─▒m', desc: 'Sistemde ilk konunu ba┼şar─▒yla tamamlad─▒n.' },
    'pomo_starter': { icon: '­şıà', name: 'Pomodoro ├çayla─ş─▒', desc: '─░lk Pomodoro seans─▒n─▒ tamamlad─▒n.' },
    'pomo_master': { icon: '­şò░´©Å', name: 'Odak Ustas─▒', desc: 'Toplam 10 Pomodoro seans─▒ tamamlad─▒n.' },
    'streak_3': { icon: '­şöÑ', name: 'Alev Ald─▒n', desc: '├£st ├╝ste 3 g├╝n ├ğal─▒┼şt─▒n.' },
    'streak_7': { icon: '­şÜÇ', name: 'Roket', desc: '├£st ├╝ste 7 g├╝n ├ğal─▒┼şt─▒n.' },
    'night_owl': { icon: '­şĞë', name: 'Gece Ku┼şu', desc: 'Gece 23:00\'ten sonra ders ├ğal─▒┼şt─▒n.' },
    'note_taker': { icon: '­şôØ', name: 'K├ótip', desc: 'Sisteme ilk notunu ekledin.' },
    'half_way': { icon: '­şÄó', name: 'Yar─▒ Yol', desc: 'Haftal─▒k program─▒n %50\'sini tamamlad─▒n.' }
};

let appData = null;
let selectedDay = null;

// Pomodoro State
let pomoInterval = null;
let pomoTimeRemaining = 25 * 60;
let pomoTotalTime = 25 * 60;
let pomoMode = 'work'; // work, shortBreak, longBreak
let pomoIsRunning = false;

/* --- BA┼ŞLANGI├ç (INIT) --- */
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupBasicUI();
    setupTheme();
    setupTabs();
    setupDaySelector();
    buildWeeklyForm();
    setupAutoSaveDrafts();
    setupFormActions();
    setupPomodoro();
    setupModals();
    setupSettings();
    setupKeyboardShortcuts();
    setupExams();
    setupNotifications();
    registerServiceWorker();
    
    // Initial Renders
    renderToday();
    renderNotes();
    renderStats();
    renderSpacedRepetition();
    renderExams();
});

/* --- VER─░ Y├ûNET─░M─░ --- */
function loadData() {
    appData = null;
    
    // Ge├ğmi┼ş t├╝m anahtarlar─▒ tarayarak en dolu olan─▒n─▒ (kaybolan veriyi) kurtar
    const keysToCheck = ['kpss_tracker_v2', 'kpss_tracker_v3', 'kpss_tracker'];
    
    for (const key of keysToCheck) {
        if (!appData) {
            try {
                let raw = localStorage.getItem(key);
                if (raw) {
                    let parsed = JSON.parse(raw);
                    let hasTask = false;
                    for (let d of Object.values(parsed.days || {})) {
                        if (((d.tekrar || []).length > 0) || ((d.yeniKonular || []).length > 0)) hasTask = true;
                    }
                    if (hasTask) appData = parsed;
                }
            } catch(e) {}
        }
    }
    
    if (!appData) {
        // Hi├ğbirinde veri yoksa bo┼ş ba┼şlat
        let raw = localStorage.getItem(STORAGE_KEY);
        appData = raw ? JSON.parse(raw) : { weekLabel: getCurrentWeekLabel(), days: {} };
    }

    // Yeni model default de─şerleri
    if (!appData.notes) appData.notes = {};
    if (!appData.pomodoro) appData.pomodoro = { totalCompleted: 0, totalMins: 0, history: [] };
    if (!appData.badges) appData.badges = [];
    if (!appData.streak) appData.streak = { current: 0, lastDate: null };
    if (!appData.points) appData.points = 0;
    if (!appData.settings) appData.settings = { goalPct: 80 };
    if (!appData.spacedRep) appData.spacedRep = [];
    if (!appData.exams) appData.exams = [];
    if (!appData.heatmap) appData.heatmap = {};

    DAYS.forEach(d => {
        if (!appData.days[d.key]) appData.days[d.key] = { tekrar: [], yeniKonular: [] };
    });

    saveData();
    updateHeaderStats();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

/* --- TEMEL UI YARDIMCILARI --- */
function setupBasicUI() {
    // Tarih Set
    const now = new Date();
    document.getElementById('headerDate').textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Geri Say─▒m
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = EXAM_DATE - today;
    document.getElementById('countdownNumber').textContent = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function updateHeaderStats() {
    document.getElementById('headerStreak').textContent = appData.streak?.current || 0;
    document.getElementById('headerPoints').textContent = appData.points || 0;
}

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function showToast(msg, isAchievement = false) {
    const t = document.getElementById('toast');
    document.getElementById('toastText').textContent = msg;
    t.className = `toast ${isAchievement ? 'toast-achievement' : ''}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

/* --- GEL─░┼ŞM─░┼Ş SESL─░ B─░LD─░R─░MLER --- */
function playSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        switch(type) {
            case 'complete': // G├Ârev tamamlama - k─▒sa tiz bip
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                oscillator.start(); setTimeout(() => oscillator.stop(), 150);
                break;
            case 'pomodoro': // Pomodoro bitti - melodi
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(523, audioCtx.currentTime);      // C5
                oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.2); // E5
                oscillator.frequency.setValueAtTime(784, audioCtx.currentTime + 0.4); // G5
                oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.6);// C6
                oscillator.start(); setTimeout(() => oscillator.stop(), 800);
                break;
            case 'badge': // Rozet kazanma - ├Âzel jingle
                oscillator.type = 'triangle';
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(554, audioCtx.currentTime + 0.15);
                oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.3);
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.5);
                oscillator.start(); setTimeout(() => oscillator.stop(), 700);
                break;
            case 'goal': // Hedef tamamlama - uzun zafer
                oscillator.type = 'square';
                gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(392, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(523, audioCtx.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.4);
                oscillator.frequency.setValueAtTime(784, audioCtx.currentTime + 0.6);
                oscillator.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.8);
                oscillator.start(); setTimeout(() => oscillator.stop(), 1200);
                break;
            default: // Basit bip
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start(); setTimeout(() => oscillator.stop(), 400);
        }
    } catch(e) {}
}

// Eski playBeep'i yeni sisteme y├Ânlendir
function playBeep() { playSound('default'); }

/* --- TEMA GE├ç─░┼Ş─░ (KARANLIK/AYDINLIK) --- */
function setupTheme() {
    const saved = localStorage.getItem('kpss_theme') || 'dark';
    applyTheme(saved);

    document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('kpss_theme', next);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = theme === 'light' ? 'ÔİÇ´©Å' : '­şîÖ';
    // PWA theme-color g├╝ncelle
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f0f2f5' : '#06080f';
}

/* --- KLAVYE KISAYOLLARI --- */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Input veya textarea i├ğindeyse j├Ânlendir
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        switch(e.key) {
            case ' ': // Space = Pomodoro ba┼şlat/durdur
                e.preventDefault();
                document.getElementById('btnPomoStart').click();
                break;
            case 'r': case 'R': // R = Pomodoro s─▒f─▒rla
                document.getElementById('btnPomoReset').click();
                break;
            case 't': case 'T': // T = Tema de─şi┼ştir
                toggleTheme();
                break;
            case 's': case 'S': // S = Program─▒ kaydet (sadece program sekmesindeyse)
                if (document.getElementById('panelWeekly').classList.contains('active')) {
                    e.preventDefault();
                    document.getElementById('btnSave').click();
                }
                break;
            case '1': case '2': case '3': case '4': case '5': case '6': case '7':
                const dayIndex = parseInt(e.key) - 1;
                const dayBtns = document.querySelectorAll('.day-btn');
                if (dayBtns[dayIndex]) dayBtns[dayIndex].click();
                break;
        }
    });
}

/* --- PWA SERVICE WORKER KAYDI --- */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
}

/* --- TAB Y├ûNET─░M─░ --- */
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const panelName = 'panel' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1);
            const panel = document.getElementById(panelName);
            if (panel) { 
                panel.classList.add('active'); 
                if (btn.dataset.tab === 'stats') renderStats();
                if (btn.dataset.tab === 'notes') renderNotes();
                
                // E─şer pomodoro ├ğal─▒┼ş─▒yorsa ve tab pomodoro de─şilse mini timeri g├Âster
                const miniT = document.getElementById('miniTimer');
                if (pomoIsRunning && btn.dataset.tab !== 'pomodoro') {
                    miniT.classList.remove('hidden');
                } else {
                    miniT.classList.add('hidden');
                }
            }
        });
    });
}

function setupDaySelector() {
    const jsDay = new Date().getDay();
    const todayObj = DAYS.find(d => d.jsDay === jsDay) || DAYS[0];
    selectedDay = todayObj.key;

    const container = document.getElementById('daySelector');
    container.innerHTML = DAYS.map(d => {
        const isToday = d.jsDay === jsDay ? 'today' : '';
        const isActive = d.key === selectedDay ? 'active' : '';
        return `<button class="day-btn ${isActive} ${isToday}" data-day="${d.key}">${d.label}</button>`;
    }).join('');

    container.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDay = btn.dataset.day;
            renderToday();
        });
    });
}

/* --- RENDER TODAY (DRAG & DROP DESTEKL─░) --- */
function renderToday() {
    const dayData = appData.days[selectedDay];
    if (!dayData) return;

    renderTaskList('lessonsList', dayData.yeniKonular, 'yeniKonular');
    renderTaskList('reviewList', dayData.tekrar, 'tekrar');

    const countItems = list => (list || []).filter(t => !t.completed).length;
    document.getElementById('lessonsCount').textContent = countItems(dayData.yeniKonular);
    document.getElementById('reviewCount').textContent = countItems(dayData.tekrar);

    renderWeeklyOverview();
    updatePomoTaskSelect(dayData);
    
    // Hedef render
    const all = [...dayData.yeniKonular, ...dayData.tekrar];
    if(all.length > 0) {
        document.getElementById('dailyGoalDisplay').classList.remove('hidden');
        const req = Math.ceil(all.length * (appData.settings.goalPct / 100));
        document.getElementById('dailyGoalText').textContent = `En az ${req} konu bitir (%${appData.settings.goalPct})`;
    } else {
        document.getElementById('dailyGoalDisplay').classList.add('hidden');
    }
}

function renderTaskList(containerId, tasks, type) {
    const container = document.getElementById(containerId);
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">­şÅû´©Å</span><p>Bug├╝n i├ğin plan yok.</p></div>`;
        return;
    }

    let html = '';
    let currentSubject = null;

    tasks.forEach((task, index) => {
        if (task.subject && task.subject !== currentSubject) {
            currentSubject = task.subject;
            html += `<div class="subject-header">${escapeHtml(currentSubject)}</div>`;
        }
        
        const hasNote = appData.notes[task.id] && appData.notes[task.id].trim() !== '';
        
        let checkedAttr = task.completed ? 'checked' : '';
        let opacityStyle = task.completed ? 'opacity: 0.5; filter: grayscale(1);' : '';

        html += `
            <div class="task-item" draggable="true" data-id="${task.id}" data-type="${type}" data-index="${index}" style="${opacityStyle}">
                <label class="task-checkbox">
                    <input type="checkbox" ${checkedAttr} onchange="toggleTaskComplete(this, '${task.id}', '${type}')">
                    <span class="checkmark"></span>
                </label>
                <span class="task-text" style="${task.completed ? 'text-decoration: line-through;' : ''}">${escapeHtml(task.text)}</span>
                <div class="task-actions">
                    <button class="task-action-btn ${hasNote ? 'has-note' : ''}" onclick="openNoteModal('${task.id}', '${escapeHtml(task.subject || task.text)}')" title="Not Ekle/D├╝zenle">­şôØ</button>
                    ${!task.completed ? `<button class="task-action-btn" onclick="focusPomo('${task.id}')" title="Bu konuya odaklan">­şıà</button>` : ''}
                </div>
            </div>
        `;
    });

    const doneCount = tasks.filter(t => t.completed).length;
    const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
    if (tasks.length > 0) {
        html += `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    }

    container.innerHTML = html;
    setupDragAndDrop(container, type);
}

function toggleTaskComplete(cb, taskId, type) {
    const list = appData.days[selectedDay][type];
    const task = list.find(t => t.id === taskId);
    if (!task) return;
    
    task.completed = cb.checked;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    
    if(task.completed) {
        addPoints(10);
        confetti(30);
        playSound('complete');
        checkDailyGoalCompletion();
        recordHeatmap();
        scheduleSpacedRepetition(task);
    } else {
        addPoints(-10);
    }

    saveData();
    checkBadges(); // Gamification check
    renderToday(); // re-render
}

function checkDailyGoalCompletion() {
    const dayData = appData.days[selectedDay];
    const all = [...dayData.yeniKonular, ...dayData.tekrar];
    if (all.length === 0) return;
    const doneCount = all.filter(t => t.completed).length;
    const req = Math.ceil(all.length * (appData.settings.goalPct / 100));
    if (doneCount >= req) {
        playSound('goal');
        showToast(`­şÄ» G├╝nl├╝k hedefine ula┼şt─▒n! (${doneCount}/${all.length})`, true);
    }
}

/* --- DRAG & DROP YAPISI (S├£R├£KLE BIRAK) --- */
let draggedTaskHTML = null;
let draggedTaskData = null;

function setupDragAndDrop(container, type) {
    const items = container.querySelectorAll('.task-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            this.classList.add('dragging');
            draggedTaskData = {
                id: this.dataset.id,
                type: this.dataset.type,
                index: parseInt(this.dataset.index)
            };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        item.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            container.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        item.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });

        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            const dropIndex = parseInt(this.dataset.index);
            const dragIndex = draggedTaskData.index;

            if (dragIndex === dropIndex) return;

            // Veriyi dizide yer de─şi┼ştirme algoritmas─▒
            const list = appData.days[selectedDay][type];
            const itemToMove = list.splice(dragIndex, 1)[0];
            list.splice(dropIndex, 0, itemToMove);
            
            saveData();
            renderToday(); // Yeniden ├ğiz
        });
    });
}

/* --- GAMIFICATION (PUAN, YAPRAK & ROZETLER) --- */
function addPoints(pts) {
    appData.points = Math.max(0, (appData.points || 0) + pts);
    updateHeaderStats();
}

function checkBadges() {
    let newBadge = null;
    let earned = appData.badges;

    // 1. ─░lk G├Ârev "first_blood"
    if (!earned.includes('first_blood')) {
        let totalDone = 0;
        DAYS.forEach(d => {
            totalDone += appData.days[d.key].tekrar.filter(t=>t.completed).length;
            totalDone += appData.days[d.key].yeniKonular.filter(t=>t.completed).length;
        });
        if (totalDone >= 1) { earned.push('first_blood'); newBadge = 'first_blood'; }
    }

    // 2. Gece Ku┼şu "night_owl"
    if (!earned.includes('night_owl')) {
        const h = new Date().getHours();
        if (h >= 23 || h <= 3) { earned.push('night_owl'); newBadge = 'night_owl'; }
    }

    // 3. Yar─▒ Yol "half_way"
    if (!earned.includes('half_way')) {
        let allTasks = 0, doneTasks = 0;
        DAYS.forEach(d => {
            const arr = [...appData.days[d.key].tekrar, ...appData.days[d.key].yeniKonular];
            allTasks += arr.length;
            doneTasks += arr.filter(t=>t.completed).length;
        });
        if (allTasks > 0 && (doneTasks / allTasks >= 0.5)) { earned.push('half_way'); newBadge = 'half_way'; }
    }

    // G├╝nl├╝k seri hesab─▒
    updateStreakData();

    if (!earned.includes('streak_3') && appData.streak.current >= 3) { earned.push('streak_3'); newBadge = 'streak_3'; }
    if (!earned.includes('streak_7') && appData.streak.current >= 7) { earned.push('streak_7'); newBadge = 'streak_7'; }

    saveData();

    if (newBadge) {
        playSound('badge');
        confetti(100);
        showToast(`­şÅå Yeni Ba┼şar─▒: ${BADGES_DEFS[newBadge].name}`, true);
        addPoints(50); // Rozet kazanana 50 puan bonus
    }
}

function updateStreakData() {
    const todayStr = new Date().toISOString().split('T')[0];
    const s = appData.streak;
    
    // Check if user did any tasks today
    let didTaskToday = false;
    DAYS.forEach(d => {
        const arr = [...appData.days[d.key].tekrar, ...appData.days[d.key].yeniKonular];
        if (arr.some(t => t.completedAt && t.completedAt.startsWith(todayStr))) {
            didTaskToday = true;
        }
    });

    if (didTaskToday) {
        if (s.lastDate !== todayStr) {
            // Check if yesterday
            let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            let yStr = yesterday.toISOString().split('T')[0];
            
            if (s.lastDate === yStr) {
                s.current += 1; // Seri devam ediyor
            } else {
                s.current = 1; // Seri k─▒r─▒ld─▒, ba┼ştan
            }
            s.lastDate = todayStr;
            updateHeaderStats();
        }
    }
}

/* --- POMODORO --- */
function setupPomodoro() {
    const timeDisplay = document.getElementById('pomoTimeDisplay');
    const circle = document.getElementById('pomoProgress');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.transition = 'stroke-dashoffset 1s linear';

    function setTime(mins) {
        pomoTotalTime = mins * 60;
        pomoTimeRemaining = pomoTotalTime;
        updateTimerVisuals();
    }

    function updateTimerVisuals() {
        const m = Math.floor(pomoTimeRemaining / 60);
        const s = pomoTimeRemaining % 60;
        timeDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        document.getElementById('miniTimer').innerHTML = `­şıà <span>${timeDisplay.textContent}</span>`;
        // Circle calculation
        const offset = circumference - (pomoTimeRemaining / pomoTotalTime) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    document.querySelectorAll('.pomo-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            if(pomoIsRunning) return showToast("Zamanlay─▒c─▒ ├ğal─▒┼ş─▒rken mod de─şi┼ştiremezsiniz.");
            document.querySelectorAll('.pomo-mode').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            pomoMode = btn.dataset.mode;
            setTime(parseInt(btn.dataset.time));
        });
    });

    const btnStart = document.getElementById('btnPomoStart');
    const btnReset = document.getElementById('btnPomoReset');

    btnStart.addEventListener('click', () => {
        if (pomoIsRunning) {
            // Durdur
            clearInterval(pomoInterval);
            pomoIsRunning = false;
            btnStart.textContent = "Devam Et";
            btnStart.classList.remove('running');
        } else {
            // Ba┼şlat
            pomoIsRunning = true;
            btnStart.textContent = "Duraklat";
            btnStart.classList.add('running');
            pomoInterval = setInterval(() => {
                if(pomoTimeRemaining > 0) {
                    pomoTimeRemaining--;
                    updateTimerVisuals();
                } else {
                    // Pomodoro Bitti!
                    clearInterval(pomoInterval);
                    pomoIsRunning = false;
                    btnStart.textContent = "Ba┼şlat";
                    btnStart.classList.remove('running');
                    playBeep();
                    handlePomodoroComplete();
                }
            }, 1000);
        }
    });

    btnReset.addEventListener('click', () => {
        clearInterval(pomoInterval);
        pomoIsRunning = false;
        btnStart.textContent = "Ba┼şlat";
        btnStart.classList.remove('running');
        const activeModeTime = parseInt(document.querySelector('.pomo-mode.active').dataset.time);
        setTime(activeModeTime);
    });

    renderPomoStats();
}

function handlePomodoroComplete() {
    confetti(50);
    playSound('pomodoro');
    showToast("Ô£¿ S├╝re Doldu! Odaklanma Ba┼şar─▒l─▒.");
    
    if (pomoMode === 'work') {
        appData.pomodoro.totalCompleted++;
        const mins = parseInt(document.querySelector('.pomo-mode[data-mode="work"]').dataset.time);
        appData.pomodoro.totalMins += mins;
        
        // Puan
        addPoints(15);
        
        // G├Ârevi otomatik tamamlama opsiyonu
        const select = document.getElementById('pomoTaskSelect');
        const taskId = select.value;
        if(taskId) {
            // G├Ârevi today tabs─▒ndan bulup bitir
            const list = [...appData.days[selectedDay].tekrar, ...appData.days[selectedDay].yeniKonular];
            const task = list.find(t=>t.id === taskId);
            if(task && !task.completed) {
                appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - ${task.subject || ''} (${task.text}) ├ğal─▒┼ş─▒ld─▒.`);
                if(confirm(`"${task.text}" konusunu tamamland─▒ olarak i┼şaretleyelim mi?`)) {
                    task.completed = true;
                    task.completedAt = new Date().toISOString();
                }
            }
        } else {
            appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - Serbest Pomodoro`);
        }

        // Gamification Rozet Check (Pomo bazl─▒)
        let earned = appData.badges;
        if(appData.pomodoro.totalCompleted >= 1 && !earned.includes('pomo_starter')) {
            earned.push('pomo_starter'); showToast(`­şÅå Yeni Rozet: Pomodoro ├çayla─ş─▒!`, true); playBeep();
        }
        if(appData.pomodoro.totalCompleted >= 10 && !earned.includes('pomo_master')) {
            earned.push('pomo_master'); showToast(`­şÅå Yeni Rozet: Odak Ustas─▒!`, true); playBeep();
        }

        saveData();
        renderPomoStats();
        renderToday();
    }
}

function renderPomoStats() {
    document.getElementById('pomoCompletedCount').textContent = appData.pomodoro?.totalCompleted || 0;
    document.getElementById('pomoTotalTime').textContent = appData.pomodoro?.totalMins || 0;

    const histList = document.getElementById('pomoHistoryList');
    const histArr = appData.pomodoro?.history || [];
    if(histArr.length > 0) {
        histList.innerHTML = histArr.slice(-10).reverse().map(log => `<div class="pomo-h-item">${log}</div>`).join('');
    }
}

function updatePomoTaskSelect(dayData) {
    const select = document.getElementById('pomoTaskSelect');
    select.innerHTML = '<option value="">-- Serbest ├çal─▒┼şma --</option>';
    
    const tasks = [...(dayData.tekrar||[]), ...(dayData.yeniKonular||[])].filter(t=>!t.completed);
    tasks.forEach(t => {
        const title = t.subject ? `${t.subject} - ${t.text}` : t.text;
        select.innerHTML += `<option value="${t.id}">${title}</option>`;
    });
}

function focusPomo(taskId) {
    document.getElementById('tabPomodoro').click();
    const select = document.getElementById('pomoTaskSelect');
    select.value = taskId;
    // Otomatik modu ├ğal─▒┼şmaya al
    document.querySelector('.pomo-mode[data-mode="work"]').click();
}

/* --- YARDIMCI G├ûRSELLE┼ŞT─░RMELER (OVERVIEW) --- */
function renderWeeklyOverview() {
    const container = document.getElementById('weeklyOverview');
    const jsDay = new Date().getDay();
    const todayObj = DAYS.find(d => d.jsDay === jsDay) || DAYS[0];

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
        
        let barClass = total===0 ? 'none' : (done===total ? 'all-done' : 'partial');

        return `<div class="week-day-card ${isToday ? 'is-today' : ''} ${isActive ? 'active' : ''}" data-day="${d.key}" onclick="document.querySelector('.day-btn[data-day=\\'${d.key}\\']').click()">
            <div class="day-name">${d.short}</div>
            <div class="day-progress ${barClass}">${total > 0 ? done + '/' + total : 'ÔÇô'}</div>
            <div class="day-bar"><div class="day-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
}


/* --- NOT DEFTER─░ MOD├£L├£ --- */
function openNoteModal(taskId, title) {
    currentNoteTargetId = taskId;
    document.getElementById('noteModalSubject').textContent = title;
    document.getElementById('noteModalText').value = appData.notes[taskId] || '';
    document.getElementById('noteModalOverlay').classList.add('show');
}

let currentNoteTargetId = null;

function renderNotes() {
    const container = document.getElementById('notesGrid');
    const filters = document.getElementById('notesFilters');
    
    let allTasksWithNotes = [];
    const subjects = new Set();

    DAYS.forEach(d => {
        const dayData = appData.days[d.key];
        ['tekrar', 'yeniKonular'].forEach(type => {
            (dayData[type] || []).forEach(t => {
                if (appData.notes[t.id] && appData.notes[t.id].trim() !== '') {
                    allTasksWithNotes.push({...t, note: appData.notes[t.id]});
                    if(t.subject) subjects.add(t.subject);
                }
            });
        });
    });

    if (allTasksWithNotes.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><span class="empty-icon">­şôô</span><p>Hen├╝z al─▒nm─▒┼ş bir ders notu yok. Konular─▒n yan─▒ndaki ­şôØ ikonuna t─▒klayarak not alabilirsiniz.</p></div>`;
        filters.style.display = 'none';
        return;
    }

    filters.style.display = 'flex';
    // Update Filter Buttons (Keep "all" but update subjects)
    filters.innerHTML = `<button class="filter-btn active" data-subject="all" onclick="filterNotes('all', this)">T├╝m├╝</button>` + 
                        Array.from(subjects).map(s => `<button class="filter-btn" data-subject="${s}" onclick="filterNotes('${s}', this)">${s}</button>`).join('');

    renderNotesItems(allTasksWithNotes, container);
}

function filterNotes(subjPattern, btnEl) {
    document.querySelectorAll('#notesFilters .filter-btn').forEach(b=>b.classList.remove('active'));
    btnEl.classList.add('active');
    
    let allTasksWithNotes = [];
    DAYS.forEach(d => {
        const dayData = appData.days[d.key];
        ['tekrar', 'yeniKonular'].forEach(type => {
            (dayData[type] || []).forEach(t => {
                if (appData.notes[t.id] && appData.notes[t.id].trim() !== '') {
                    if(subjPattern === 'all' || t.subject === subjPattern) {
                        allTasksWithNotes.push({...t, note: appData.notes[t.id]});
                    }
                }
            });
        });
    });
    
    renderNotesItems(allTasksWithNotes, document.getElementById('notesGrid'));
}

function renderNotesItems(items, container) {
    container.innerHTML = items.map(t => `
        <div class="note-card" onclick="openNoteModal('${t.id}', '${escapeHtml(t.subject || t.text)}')">
            <div class="note-subj">${t.subject ? escapeHtml(t.subject) : 'Genel'}</div>
            <div class="note-task">${escapeHtml(t.text)}</div>
            <div class="note-excerpt">${escapeHtml(t.note)}</div>
        </div>
    `).join('');
}


/* --- ─░STAT─░ST─░K & DASHBOARD --- */
function renderStats() {
    // 1. Seriler ve Puanlar
    document.getElementById('dashStreak').textContent = appData.streak?.current || 0;
    
    // 2. Tamamlama Oran─▒ (Donut)
    let totalItems = 0, totalDone = 0;
    DAYS.forEach(d => {
        ['tekrar', 'yeniKonular'].forEach(type => {
            totalItems += (appData.days[d.key][type] || []).length;
            totalDone += (appData.days[d.key][type] || []).filter(t=>t.completed).length;
        });
    });
    const pct = totalItems > 0 ? Math.round((totalDone/totalItems)*100) : 0;
    document.getElementById('dashCompletionText').textContent = pct + '%';
    document.getElementById('dashCompletionDonut').style.strokeDasharray = `${pct}, 100`;

    // 3. Rozet ├ûnizleme
    const previewContainer = document.getElementById('badgesPreview');
    previewContainer.innerHTML = '';
    
    const badgeKeys = Object.keys(BADGES_DEFS);
    // Rastgele veya ilk 4 rozeti g├Âster
    badgeKeys.slice(0, 4).forEach(bKey => {
        const isUnlocked = appData.badges.includes(bKey);
        previewContainer.innerHTML += `<div class="mini-badge ${isUnlocked ? 'unlocked' : ''}" title="${BADGES_DEFS[bKey].name}"> ${BADGES_DEFS[bKey].icon}</div>`;
    });
}

function populateFullBadges() {
    const grid = document.getElementById('fullBadgesGrid');
    grid.innerHTML = '';
    Object.keys(BADGES_DEFS).forEach(k => {
        const b = BADGES_DEFS[k];
        const isUnlocked = appData.badges.includes(k);
        grid.innerHTML += `
            <div class="badge-item ${isUnlocked ? 'unlocked' : ''}">
                <span class="badge-icon">${b.icon}</span>
                <div class="badge-name">${b.name}</div>
                <div class="badge-desc">${b.desc}</div>
            </div>
        `;
    });
}

/* --- MODALLAR --- */
function setupModals() {
    // Note Modal
    const noteModal = document.getElementById('noteModalOverlay');
    document.getElementById('btnCloseNote').addEventListener('click', () => noteModal.classList.remove('show'));
    document.getElementById('btnSaveNote').addEventListener('click', () => {
        const text = document.getElementById('noteModalText').value;
        if(text.trim() === '') delete appData.notes[currentNoteTargetId];
        else appData.notes[currentNoteTargetId] = text;
        saveData();
        
        if(appData.notes[currentNoteTargetId] && !appData.badges.includes('note_taker')) {
            appData.badges.push('note_taker');
            showToast("­şÅå Yeni Rozet: K├ótip", true); playBeep();
        }
        
        noteModal.classList.remove('show');
        showToast("Not kaydedildi ­şôØ");
        renderToday();
        if(document.querySelector('.tab-btn[data-tab="notes"]').classList.contains('active')) renderNotes();
    });

    // Badges Modal
    const badgesModal = document.getElementById('badgesModalOverlay');
    const openBadges = () => { populateFullBadges(); badgesModal.classList.add('show'); };
    
    document.getElementById('btnCloseBadges').addEventListener('click', () => badgesModal.classList.remove('show'));
    document.getElementById('headerStreakBadge').addEventListener('click', openBadges);
    document.getElementById('headerPointsBadge').addEventListener('click', openBadges);
    document.getElementById('btnShowAllBadges').addEventListener('click', openBadges);
}


/* --- YEDEKLEME VE AYARLAR --- */
function setupSettings() {
    const inputGoal = document.getElementById('settingGoalPct');
    inputGoal.value = appData.settings.goalPct || 80;

    document.getElementById('btnSaveGoal').addEventListener('click', () => {
        const val = parseInt(inputGoal.value);
        if(val >= 1 && val <= 100) {
            appData.settings.goalPct = val;
            saveData();
            showToast("Hedef g├╝ncellendi.");
            renderToday(); // update UI Goal display
        }
    });

    document.getElementById('btnExportData').addEventListener('click', () => {
        const dataStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kpss_takip_yedek_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if(parsed && parsed.days) {
                    appData = parsed;
                    saveData();
                    showToast("Yedek ba┼şar─▒yla geri y├╝klendi! Sayfa yenileniyor...");
                    setTimeout(() => location.reload(), 1500);
                } else { alert("Ge├ğersiz yedek dosyas─▒!"); }
            } catch(err) { alert("Dosya okuma hatas─▒!"); }
        };
        reader.readAsText(file);
    });

    document.getElementById('btnHardReset').addEventListener('click', () => {
        if(confirm("D─░KKAT! T├╝m verileriniz kal─▒c─▒ olarak silinecek. Emin misiniz?")) {
            if(confirm("Son Karar─▒n m─▒? (─░stersen ├Ânce ├╝stten yede─şini al)")) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(HISTORY_KEY);
                location.reload();
            }
        }
    });
}

/* --- BAS─░T CONFETT─░ AN─░MASYONU --- */
function confetti(amount = 50) {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#f85149', '#3fb950', '#58a6ff', '#bc8cff', '#fbbf24'];

    for(let i=0; i<amount; i++) {
        particles.push({
            x: canvas.width / 2, y: canvas.height / 2 + 100,
            r: Math.random() * 6 + 2,
            dx: Math.random() * 10 - 5,
            dy: Math.random() * -10 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10
        });
    }

    function draw() {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            if(p.y < canvas.height) active = true;
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
            p.x += p.dx; p.y += p.dy; p.dy += 0.2; // gravity
            p.tilt += 0.1; // spin
        });
        if(active) requestAnimationFrame(draw);
        else ctx.clearRect(0,0, canvas.width, canvas.height);
    }
    draw();
}

/* --- HAFTALIK PROGRAM G─░R─░┼Ş─░ (MEVCUT MANTIK) --- */
function getCurrentWeekLabel() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-H${weekNumber}`;
}

function buildWeeklyForm() {
    let tekrarLines = [], yeniLines = [];
    DAYS.forEach(day => {
        const tItems = appData.days[day.key].tekrar || [];
        const yItems = appData.days[day.key].yeniKonular || [];
        
        if(tItems.length > 0) {
            tekrarLines.push(day.label);
            let s = null;
            tItems.forEach(i => {
                if(i.subject && i.subject !== s) { s=i.subject; tekrarLines.push(s); }
                tekrarLines.push('-' + i.text);
            });
            tekrarLines.push('');
        }
        
        if(yItems.length > 0) {
            yeniLines.push(day.label);
            let s = null;
            yItems.forEach(i => {
                if(i.subject && i.subject !== s) { s=i.subject; yeniLines.push(s); }
                yeniLines.push('-' + i.text);
            });
            yeniLines.push('');
        }
    });

    const tekrarEl = document.getElementById('inputBulkTekrar');
    const yeniEl = document.getElementById('inputBulkYeni');

    const tekrarFromData = tekrarLines.join('\n').trim();
    const yeniFromData = yeniLines.join('\n').trim();

    try {
        const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        tekrarEl.value = tekrarFromData || drafts.tekrar || '';
        yeniEl.value = yeniFromData || drafts.yeni || '';
    } catch {
        tekrarEl.value = tekrarFromData;
        yeniEl.value = yeniFromData;
    }
}

function setupAutoSaveDrafts() {
    const yeniEl = document.getElementById('inputBulkYeni');
    const tekrarEl = document.getElementById('inputBulkTekrar');
    
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

function setupFormActions() {
    document.getElementById('btnSave').addEventListener('click', () => {
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

        saveData();
        renderToday();
        showToast('Program ba┼şar─▒yla kaydedildi! ­şÄë');
        document.getElementById('tabToday').click();
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Mevcut haftan─▒n T├£M program─▒n─▒ silmek istedi─şine emin misin?')) {
            document.getElementById('inputBulkTekrar').value = '';
            document.getElementById('inputBulkYeni').value = '';
            DAYS.forEach(d => { appData.days[d.key] = { tekrar: [], yeniKonular: [] }; });
            saveData();
            renderToday();
        }
    });

    document.getElementById('btnResetWeek').addEventListener('click', () => {
        if (!confirm('Yeni haftaya ge├ğilecek:\n\nÔ£à Mevcut hafta ar┼şivlenecek\n­şöä Tamamlanan konular s─▒f─▒rlanacak\n­şôï Program yap─▒s─▒ korunacak\n\nDevam?')) return;
        
        // Reset completions
        DAYS.forEach(d => {
            const dd = appData.days[d.key];
            ['tekrar', 'yeniKonular'].forEach(type => {
                (dd[type] || []).forEach(t => { t.completed = false; t.completedAt = null; });
            });
        });
        
        appData.weekLabel = getCurrentWeekLabel();
        saveData();
        renderToday();
        showToast('Yeni hafta ba┼şlat─▒ld─▒! Ba┼şar─▒lar ­şÜÇ');
    });
}

function detectDayHeader(rawLine) {
    const trimmed = rawLine.trim().toLowerCase();
    for (const d of DAYS) {
        if (d.key === trimmed || d.label.toLowerCase() === trimmed || d.short.toLowerCase() === trimmed) return d.key;
    }
    return null;
}

function parseBulkText(text) {
    const result = {}; DAYS.forEach(d => { result[d.key] = []; });
    if (!text || !text.trim()) return result;

    const lines = text.split('\n');
    let currentDay = null, currentSubject = null;

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const detectedDay = detectDayHeader(trimmed);
        if (detectedDay) { currentDay = detectedDay; currentSubject = null; continue; }
        if (!currentDay) continue;

        const topicMatch = trimmed.match(/^[-*ÔÇó]\s*(.*)/);
        if (topicMatch) { result[currentDay].push({ subject: currentSubject, text: topicMatch[1].trim() }); } 
        else { currentSubject = trimmed; }
    }
    return result;
}

function mapToTasks(parsed, oldItems) {
    return parsed.map(p => {
        const exist = oldItems.find(item => item.text === p.text && item.subject === p.subject);
        return exist || { id: genId(), text: p.text, subject: p.subject || null, completed: false, completedAt: null };
    });
}

/* ========================================
   YENI MOD├£LLER
   ======================================== */

const EXAM_SUBJECTS = [
    { key: 'turkce', label: 'T├╝rk├ğe', maxQ: 40 },
    { key: 'matematik', label: 'Matematik', maxQ: 40 },
    { key: 'tarih', label: 'Tarih', maxQ: 27 },
    { key: 'cografya', label: 'Co─şrafya', maxQ: 17 },
    { key: 'vatandaslik', label: 'Vatanda┼şl─▒k', maxQ: 15 },
    { key: 'anayasa', label: 'Anayasa', maxQ: 5 },
    { key: 'egitim', label: 'E─şitim Bil.', maxQ: 16 }
];

/* --- 1. ARALIKLI TEKRAR (SPACED REPETITION) --- */
const SR_INTERVALS = [1, 3, 7, 21]; // g├╝n

function scheduleSpacedRepetition(task) {
    // Zaten planlanm─▒┼ş m─▒ kontrol et
    const exists = appData.spacedRep.find(s => s.taskId === task.id && !s.done);
    if (exists) return;

    const today = new Date();
    SR_INTERVALS.forEach(days => {
        const reviewDate = new Date(today);
        reviewDate.setDate(reviewDate.getDate() + days);
        appData.spacedRep.push({
            id: genId(),
            taskId: task.id,
            text: task.text,
            subject: task.subject || 'Genel',
            reviewDate: reviewDate.toISOString().split('T')[0],
            interval: days,
            done: false
        });
    });
    saveData();
}

function renderSpacedRepetition() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dueItems = (appData.spacedRep || []).filter(s => s.reviewDate <= todayStr && !s.done);

    const box = document.getElementById('spacedRepBox');
    const list = document.getElementById('spacedRepList');
    const count = document.getElementById('spacedRepCount');

    if (dueItems.length === 0) { box.classList.add('hidden'); return; }

    box.classList.remove('hidden');
    count.textContent = dueItems.length;

    list.innerHTML = dueItems.map(item => `
        <div class="sr-item">
            <div class="sr-info">
                <span class="sr-subject">${escapeHtml(item.subject)}</span>
                <span class="sr-text">${escapeHtml(item.text)}</span>
                <span class="sr-interval">${item.interval} g├╝n aral─▒kl─▒ tekrar</span>
            </div>
            <button class="btn btn-sm btn-success" onclick="markSrDone('${item.id}')">Ô£ô Tekrar Ettim</button>
        </div>
    `).join('');
}

function markSrDone(srId) {
    const item = appData.spacedRep.find(s => s.id === srId);
    if (item) { item.done = true; addPoints(5); }
    saveData();
    renderSpacedRepetition();
    showToast('Tekrar tamamland─▒! ­şğá');
}

/* --- 2. ISI HAR─░TASI (HEATMAP) --- */
function recordHeatmap() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!appData.heatmap[todayStr]) appData.heatmap[todayStr] = 0;
    appData.heatmap[todayStr]++;
    saveData();
}

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    const today = new Date();
    let html = '';
    const maxVal = Math.max(1, ...Object.values(appData.heatmap || {}));

    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const val = (appData.heatmap || {})[dateStr] || 0;
        const opacity = val === 0 ? 0.06 : Math.max(0.2, val / maxVal);
        const title = `${dateStr}: ${val} g├Ârev`;
        html += `<div class="hm-cell" style="opacity:${opacity}" title="${title}"></div>`;
    }
    container.innerHTML = html;
}

/* --- 3. DERS BAZLI ANAL─░Z --- */
function renderSubjectAnalysis() {
    const container = document.getElementById('subjectBars');
    if (!container) return;

    const subjects = {};
    DAYS.forEach(d => {
        ['tekrar', 'yeniKonular'].forEach(type => {
            (appData.days[d.key][type] || []).forEach(t => {
                const subj = t.subject || 'Di─şer';
                if (!subjects[subj]) subjects[subj] = { total: 0, done: 0 };
                subjects[subj].total++;
                if (t.completed) subjects[subj].done++;
            });
        });
    });

    const entries = Object.entries(subjects);
    if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Hen├╝z program girilmedi.</p>';
        return;
    }

    container.innerHTML = entries.map(([name, data]) => {
        const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
        return `
            <div class="subj-bar-item">
                <div class="subj-bar-label">
                    <span>${escapeHtml(name)}</span>
                    <span>${data.done}/${data.total} (${pct}%)</span>
                </div>
                <div class="subj-bar-track">
                    <div class="subj-bar-fill" style="width:${pct}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

/* --- 4. DENEME SINAVI TAK─░B─░ --- */
function setupExams() {
    // Tarih alan─▒n─▒ bug├╝nle doldur
    const dateInput = document.getElementById('examDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Ders giri┼ş alanlar─▒n─▒ olu┼ştur
    const grid = document.getElementById('examSubjectsGrid');
    if (grid) {
        grid.innerHTML = EXAM_SUBJECTS.map(s => `
            <div class="exam-subj-input">
                <label>${s.label}</label>
                <div class="exam-net-row">
                    <input type="number" id="examD_${s.key}" placeholder="Do─şru" min="0" max="${s.maxQ}">
                    <input type="number" id="examY_${s.key}" placeholder="Yanl─▒┼ş" min="0" max="${s.maxQ}">
                    <span class="exam-net-val" id="examN_${s.key}">0 net</span>
                </div>
            </div>
        `).join('');

        // Otomatik net hesapla
        EXAM_SUBJECTS.forEach(s => {
            const dEl = document.getElementById(`examD_${s.key}`);
            const yEl = document.getElementById(`examY_${s.key}`);
            const nEl = document.getElementById(`examN_${s.key}`);
            const calc = () => {
                const d = parseFloat(dEl.value) || 0;
                const y = parseFloat(yEl.value) || 0;
                const net = Math.max(0, d - (y * 0.25));
                nEl.textContent = net.toFixed(1) + ' net';
            };
            dEl.addEventListener('input', calc);
            yEl.addEventListener('input', calc);
        });
    }

    // Kaydet
    document.getElementById('btnSaveExam')?.addEventListener('click', () => {
        const date = document.getElementById('examDate').value;
        const name = document.getElementById('examName').value || '─░simsiz Deneme';
        if (!date) return showToast('L├╝tfen tarih girin.');

        const results = {};
        let totalNet = 0;
        EXAM_SUBJECTS.forEach(s => {
            const d = parseFloat(document.getElementById(`examD_${s.key}`).value) || 0;
            const y = parseFloat(document.getElementById(`examY_${s.key}`).value) || 0;
            const net = Math.max(0, d - (y * 0.25));
            results[s.key] = { dogru: d, yanlis: y, net: parseFloat(net.toFixed(1)) };
            totalNet += net;
        });

        appData.exams.push({
            id: genId(), date, name,
            results, totalNet: parseFloat(totalNet.toFixed(1))
        });

        saveData();
        renderExams();
        showToast('Deneme sonucu kaydedildi! ­şôè');
        playSound('complete');

        // Formu temizle
        EXAM_SUBJECTS.forEach(s => {
            document.getElementById(`examD_${s.key}`).value = '';
            document.getElementById(`examY_${s.key}`).value = '';
            document.getElementById(`examN_${s.key}`).textContent = '0 net';
        });
        document.getElementById('examName').value = '';
    });
}

function renderExams() {
    const exams = (appData.exams || []).sort((a, b) => a.date.localeCompare(b.date));
    const cardsEl = document.getElementById('examCards');
    const chartEl = document.getElementById('examChartArea');

    if (exams.length === 0) {
        if (cardsEl) cardsEl.innerHTML = '<div class="empty-state"><span class="empty-icon">­şôØ</span><p>Hen├╝z deneme sonucu eklenmedi.</p></div>';
        if (chartEl) chartEl.innerHTML = '';
        return;
    }

    // Geli┼şim ├çizgi Grafi─şi (SVG)
    if (chartEl && exams.length >= 2) {
        const w = 600, h = 200, pad = 40;
        const maxNet = Math.max(...exams.map(e => e.totalNet), 1);
        const points = exams.map((e, i) => {
            const x = pad + (i / (exams.length - 1)) * (w - pad * 2);
            const y = h - pad - ((e.totalNet / maxNet) * (h - pad * 2));
            return { x, y, net: e.totalNet, name: e.name };
        });
        const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

        chartEl.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" class="exam-svg">
                <polyline points="${polyline}" fill="none" stroke="var(--accent-blue)" stroke-width="2.5" stroke-linejoin="round"/>
                ${points.map(p => `
                    <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--accent-blue)" stroke="var(--bg-primary)" stroke-width="2"/>
                    <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-weight="700">${p.net.toFixed(1)}</text>
                `).join('')}
            </svg>
        `;
    }

    // Sonu├ğ Kartlar─▒ (Son 5)
    if (cardsEl) {
        cardsEl.innerHTML = exams.slice(-5).reverse().map((exam, i) => {
            const prevExam = exams.length > 1 && i === 0 ? exams[exams.length - 2] : null;
            const diff = prevExam ? (exam.totalNet - prevExam.totalNet).toFixed(1) : null;
            const diffStr = diff !== null ? (diff > 0 ? `<span class="exam-up">Ôû▓ +${diff}</span>` : diff < 0 ? `<span class="exam-down">Ôû╝ ${diff}</span>` : `<span class="exam-same">= 0</span>`) : '';

            const subjectCells = EXAM_SUBJECTS.map(s => {
                const r = exam.results[s.key];
                return r ? `<td>${r.net.toFixed(1)}</td>` : `<td>-</td>`;
            }).join('');

            return `
                <div class="exam-result-card">
                    <div class="exam-card-header">
                        <div>
                            <strong>${escapeHtml(exam.name)}</strong>
                            <small>${exam.date}</small>
                        </div>
                        <div class="exam-total">
                            <span class="exam-total-net">${exam.totalNet.toFixed(1)}</span>
                            <small>Toplam Net</small>
                            ${diffStr}
                        </div>
                    </div>
                    <table class="exam-table">
                        <tr>${EXAM_SUBJECTS.map(s => `<th>${s.label}</th>`).join('')}</tr>
                        <tr>${subjectCells}</tr>
                    </table>
                    <button class="btn-link" style="color:var(--accent-red);font-size:0.75rem" onclick="deleteExam('${exam.id}')">Sil</button>
                </div>
            `;
        }).join('');
    }

    // Zay─▒f Ders Analizi
    analyzeWeakSubjects(exams);
}

function deleteExam(examId) {
    appData.exams = appData.exams.filter(e => e.id !== examId);
    saveData();
    renderExams();
}

function analyzeWeakSubjects(exams) {
    const box = document.getElementById('weakSubjectsBox');
    const list = document.getElementById('weakSubjectsList');
    if (!box || !list || exams.length < 1) { box?.classList.add('hidden'); return; }

    // Son 3 denemenin ortalamas─▒n─▒ al
    const recent = exams.slice(-3);
    const avgNets = {};
    EXAM_SUBJECTS.forEach(s => {
        let sum = 0, count = 0;
        recent.forEach(e => {
            if (e.results[s.key]) { sum += e.results[s.key].net; count++; }
        });
        if (count > 0) avgNets[s.key] = { label: s.label, avg: sum / count, maxQ: s.maxQ, pct: ((sum / count) / s.maxQ) * 100 };
    });

    // En d├╝┼ş├╝k y├╝zdelileri bul
    const sorted = Object.values(avgNets).sort((a, b) => a.pct - b.pct);
    const weak = sorted.filter(s => s.pct < 50).slice(0, 3);

    if (weak.length === 0) { box.classList.add('hidden'); return; }

    box.classList.remove('hidden');
    list.innerHTML = weak.map(s => `
        <div class="weak-item">
            <span class="weak-name">ÔÜá´©Å ${s.label}</span>
            <span class="weak-detail">Ort: ${s.avg.toFixed(1)} / ${s.maxQ} net (%${s.pct.toFixed(0)})</span>
            <div class="subj-bar-track"><div class="subj-bar-fill weak-fill" style="width:${s.pct}%"></div></div>
        </div>
    `).join('');
}

/* --- 5. B─░LD─░R─░M S─░STEM─░ --- */
function setupNotifications() {
    const btn = document.getElementById('btnEnableNotif');
    const status = document.getElementById('notifStatus');

    if (!('Notification' in window)) {
        if (status) status.textContent = 'Bu taray─▒c─▒ bildirimleri desteklemiyor.';
        if (btn) btn.disabled = true;
        return;
    }

    updateNotifStatus();

    btn?.addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        updateNotifStatus();
        if (perm === 'granted') {
            showToast('Bildirimler a├ğ─▒ld─▒! ­şöö');
            scheduleReminders();
        }
    });

    // E─şer izin varsa hat─▒rlat─▒c─▒lar─▒ ba┼şlat
    if (Notification.permission === 'granted') {
        scheduleReminders();
    }
}

function updateNotifStatus() {
    const status = document.getElementById('notifStatus');
    if (!status) return;
    const perm = Notification.permission;
    if (perm === 'granted') status.innerHTML = '<span style="color:var(--accent-green)">Ô£à Bildirimler aktif</span>';
    else if (perm === 'denied') status.innerHTML = '<span style="color:var(--accent-red)">ÔØî Bildirimler engellenmi┼ş. Taray─▒c─▒ ayarlar─▒ndan a├ğ─▒n.</span>';
    else status.innerHTML = '<span style="color:var(--text-muted)">Hen├╝z izin verilmemi┼ş.</span>';
}

function scheduleReminders() {
    // Her 2 saatte bir kontrol et
    setInterval(() => {
        const h = new Date().getHours();

        // Sabah 9, ├û─şle 13, Ak┼şam 19 hat─▒rlatma
        if (h === 9 || h === 13 || h === 19) {
            const dueReps = (appData.spacedRep || []).filter(s => s.reviewDate <= new Date().toISOString().split('T')[0] && !s.done);
            if (dueReps.length > 0) {
                new Notification('­şğá Tekrar Zaman─▒!', { body: `${dueReps.length} konu tekrar bekliyor.`, icon: '­şÄô' });
            }

            // Bug├╝n ├ğal─▒┼şma kontrol├╝
            const todayStr = new Date().toISOString().split('T')[0];
            if (!appData.heatmap[todayStr] && h >= 19) {
                new Notification('­şôÜ Bug├╝n hen├╝z ├ğal─▒┼şmad─▒n!', { body: 'Hadi bir Pomodoro ile ba┼şla!', icon: '­şıà' });
            }
        }
    }, 60 * 60 * 1000); // Saatte bir kontrol
}

/* --- 6. RENDER STATS G├£NCELLEME (HEATMAP + DERS ANAL─░Z─░ EKLEND─░) --- */
const _origRenderStats = typeof renderStats === 'function' ? renderStats : null;
// renderStats fonksiyonunu override etmeden, onun ├ğa─şr─▒ld─▒─ş─▒ yerlerde ek render ekleyelim
(function() {
    const origSetupTabs = setupTabs;
    // renderStats ├ğa─şr─▒ld─▒─ş─▒nda heatmap ve subject analysis da render edilsin
    const origFn = window.renderStats;
    if (origFn) {
        window._baseRenderStats = origFn;
    }
})();

// renderStats i├ğine hook ekle - mevcut renderStats'─▒n sonuna ek render
const _patchedRenderStatsOnce = (() => {
    const origBody = renderStats;
    renderStats = function() {
        origBody.call(this);
        renderHeatmap();
        renderSubjectAnalysis();
    };
    return true;
})();

