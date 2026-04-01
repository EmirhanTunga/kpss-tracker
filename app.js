// ===== KPSS Başarı Rehberi - Ana Uygulama Dosyası =====

/* --- SABİTLER VE VERİ YAPISI --- */
const STORAGE_KEY = 'kpss_tracker_v2';
const HISTORY_KEY = 'kpss_tracker_history';
const DRAFT_KEY = 'kpss_tracker_drafts';
const EXAM_DATE = new Date(2026, 9, 4); // 4 Ekim 2026

const DAYS = [
    { key: 'pazartesi', label: 'Pazartesi', short: 'Pzt', jsDay: 1 },
    { key: 'sali', label: 'Salı', short: 'Sal', jsDay: 2 },
    { key: 'carsamba', label: 'Çarşamba', short: 'Çar', jsDay: 3 },
    { key: 'persembe', label: 'Perşembe', short: 'Per', jsDay: 4 },
    { key: 'cuma', label: 'Cuma', short: 'Cum', jsDay: 5 },
    { key: 'cumartesi', label: 'Cumartesi', short: 'Cmt', jsDay: 6 },
    { key: 'pazar', label: 'Pazar', short: 'Paz', jsDay: 0 }
];

// Kazanılabilir rozetlerin tanımları
const BADGES_DEFS = {
    'first_blood': { icon: '🎯', name: 'İlk Adım', desc: 'Sistemde ilk konunu başarıyla tamamladın.' },
    'pomo_starter': { icon: '🍅', name: 'Pomodoro Çaylağı', desc: 'İlk Pomodoro seansını tamamladın.' },
    'pomo_master': { icon: '🕰️', name: 'Odak Ustası', desc: 'Toplam 10 Pomodoro seansı tamamladın.' },
    'streak_3': { icon: '🔥', name: 'Alev Aldın', desc: 'Üst üste 3 gün çalıştın.' },
    'streak_7': { icon: '🚀', name: 'Roket', desc: 'Üst üste 7 gün çalıştın.' },
    'night_owl': { icon: '🦉', name: 'Gece Kuşu', desc: 'Gece 23:00\'ten sonra ders çalıştın.' },
    'note_taker': { icon: '📝', name: 'Kâtip', desc: 'Sisteme ilk notunu ekledin.' },
    'half_way': { icon: '🎢', name: 'Yarı Yol', desc: 'Haftalık programın %50\'sini tamamladın.' }
};

let appData = null;
let selectedDay = null;

// Pomodoro State
let pomoInterval = null;
let pomoTimeRemaining = 25 * 60;
let pomoTotalTime = 25 * 60;
let pomoMode = 'work'; // work, shortBreak, longBreak
let pomoIsRunning = false;

/* --- BAŞLANGIÇ (INIT) --- */
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupBasicUI();
    setupTabs();
    setupDaySelector();
    buildWeeklyForm();
    setupAutoSaveDrafts();
    setupFormActions();
    setupPomodoro();
    setupModals();
    setupSettings();
    
    // Initial Renders
    renderToday();
    renderNotes();
    renderStats();
});

/* --- VERİ YÖNETİMİ --- */
function loadData() {
    appData = null;
    
    // Geçmiş tüm anahtarları tarayarak en dolu olanını (kaybolan veriyi) kurtar
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
        // Hiçbirinde veri yoksa boş başlat
        let raw = localStorage.getItem(STORAGE_KEY);
        appData = raw ? JSON.parse(raw) : { weekLabel: getCurrentWeekLabel(), days: {} };
    }

    // Yeni model default değerleri
    if (!appData.notes) appData.notes = {};
    if (!appData.pomodoro) appData.pomodoro = { totalCompleted: 0, totalMins: 0, history: [] };
    if (!appData.badges) appData.badges = [];
    if (!appData.streak) appData.streak = { current: 0, lastDate: null };
    if (!appData.points) appData.points = 0;
    if (!appData.settings) appData.settings = { goalPct: 80 };

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
    
    // Geri Sayım
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

function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 nota
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 400);
    } catch(e) {} // Fallback yok, ses veremiyoruz
}

/* --- TAB YÖNETİMİ --- */
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
                
                // Eğer pomodoro çalışıyorsa ve tab pomodoro değilse mini timeri göster
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

/* --- RENDER TODAY (DRAG & DROP DESTEKLİ) --- */
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
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🏖️</span><p>Bugün için plan yok.</p></div>`;
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
                    <button class="task-action-btn ${hasNote ? 'has-note' : ''}" onclick="openNoteModal('${task.id}', '${escapeHtml(task.subject || task.text)}')" title="Not Ekle/Düzenle">📝</button>
                    ${!task.completed ? `<button class="task-action-btn" onclick="focusPomo('${task.id}')" title="Bu konuya odaklan">🍅</button>` : ''}
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
    } else {
        addPoints(-10);
    }

    saveData();
    checkBadges(); // Gamification check
    renderToday(); // re-render
}

/* --- DRAG & DROP YAPISI (SÜRÜKLE BIRAK) --- */
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

            // Veriyi dizide yer değiştirme algoritması
            const list = appData.days[selectedDay][type];
            const itemToMove = list.splice(dragIndex, 1)[0];
            list.splice(dropIndex, 0, itemToMove);
            
            saveData();
            renderToday(); // Yeniden çiz
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

    // 1. İlk Görev "first_blood"
    if (!earned.includes('first_blood')) {
        let totalDone = 0;
        DAYS.forEach(d => {
            totalDone += appData.days[d.key].tekrar.filter(t=>t.completed).length;
            totalDone += appData.days[d.key].yeniKonular.filter(t=>t.completed).length;
        });
        if (totalDone >= 1) { earned.push('first_blood'); newBadge = 'first_blood'; }
    }

    // 2. Gece Kuşu "night_owl"
    if (!earned.includes('night_owl')) {
        const h = new Date().getHours();
        if (h >= 23 || h <= 3) { earned.push('night_owl'); newBadge = 'night_owl'; }
    }

    // 3. Yarı Yol "half_way"
    if (!earned.includes('half_way')) {
        let allTasks = 0, doneTasks = 0;
        DAYS.forEach(d => {
            const arr = [...appData.days[d.key].tekrar, ...appData.days[d.key].yeniKonular];
            allTasks += arr.length;
            doneTasks += arr.filter(t=>t.completed).length;
        });
        if (allTasks > 0 && (doneTasks / allTasks >= 0.5)) { earned.push('half_way'); newBadge = 'half_way'; }
    }

    // Günlük seri hesabı
    updateStreakData();

    if (!earned.includes('streak_3') && appData.streak.current >= 3) { earned.push('streak_3'); newBadge = 'streak_3'; }
    if (!earned.includes('streak_7') && appData.streak.current >= 7) { earned.push('streak_7'); newBadge = 'streak_7'; }

    saveData();

    if (newBadge) {
        playBeep();
        confetti(100);
        showToast(`🏆 Yeni Başarı: ${BADGES_DEFS[newBadge].name}`, true);
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
                s.current = 1; // Seri kırıldı, baştan
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
        document.getElementById('miniTimer').innerHTML = `🍅 <span>${timeDisplay.textContent}</span>`;
        // Circle calculation
        const offset = circumference - (pomoTimeRemaining / pomoTotalTime) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    document.querySelectorAll('.pomo-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            if(pomoIsRunning) return showToast("Zamanlayıcı çalışırken mod değiştiremezsiniz.");
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
            // Başlat
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
                    btnStart.textContent = "Başlat";
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
        btnStart.textContent = "Başlat";
        btnStart.classList.remove('running');
        const activeModeTime = parseInt(document.querySelector('.pomo-mode.active').dataset.time);
        setTime(activeModeTime);
    });

    renderPomoStats();
}

function handlePomodoroComplete() {
    confetti(50);
    showToast("✨ Süre Doldu! Odaklanma Başarılı.");
    
    if (pomoMode === 'work') {
        appData.pomodoro.totalCompleted++;
        const mins = parseInt(document.querySelector('.pomo-mode[data-mode="work"]').dataset.time);
        appData.pomodoro.totalMins += mins;
        
        // Puan
        addPoints(15);
        
        // Görevi otomatik tamamlama opsiyonu
        const select = document.getElementById('pomoTaskSelect');
        const taskId = select.value;
        if(taskId) {
            // Görevi today tabsından bulup bitir
            const list = [...appData.days[selectedDay].tekrar, ...appData.days[selectedDay].yeniKonular];
            const task = list.find(t=>t.id === taskId);
            if(task && !task.completed) {
                appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - ${task.subject || ''} (${task.text}) çalışıldı.`);
                if(confirm(`"${task.text}" konusunu tamamlandı olarak işaretleyelim mi?`)) {
                    task.completed = true;
                    task.completedAt = new Date().toISOString();
                }
            }
        } else {
            appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - Serbest Pomodoro`);
        }

        // Gamification Rozet Check (Pomo bazlı)
        let earned = appData.badges;
        if(appData.pomodoro.totalCompleted >= 1 && !earned.includes('pomo_starter')) {
            earned.push('pomo_starter'); showToast(`🏆 Yeni Rozet: Pomodoro Çaylağı!`, true); playBeep();
        }
        if(appData.pomodoro.totalCompleted >= 10 && !earned.includes('pomo_master')) {
            earned.push('pomo_master'); showToast(`🏆 Yeni Rozet: Odak Ustası!`, true); playBeep();
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
    select.innerHTML = '<option value="">-- Serbest Çalışma --</option>';
    
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
    // Otomatik modu çalışmaya al
    document.querySelector('.pomo-mode[data-mode="work"]').click();
}

/* --- YARDIMCI GÖRSELLEŞTİRMELER (OVERVIEW) --- */
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
            <div class="day-progress ${barClass}">${total > 0 ? done + '/' + total : '–'}</div>
            <div class="day-bar"><div class="day-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
}


/* --- NOT DEFTERİ MODÜLÜ --- */
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
        container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><span class="empty-icon">📓</span><p>Henüz alınmış bir ders notu yok. Konuların yanındaki 📝 ikonuna tıklayarak not alabilirsiniz.</p></div>`;
        filters.style.display = 'none';
        return;
    }

    filters.style.display = 'flex';
    // Update Filter Buttons (Keep "all" but update subjects)
    filters.innerHTML = `<button class="filter-btn active" data-subject="all" onclick="filterNotes('all', this)">Tümü</button>` + 
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


/* --- İSTATİSTİK & DASHBOARD --- */
function renderStats() {
    // 1. Seriler ve Puanlar
    document.getElementById('dashStreak').textContent = appData.streak?.current || 0;
    
    // 2. Tamamlama Oranı (Donut)
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

    // 3. Rozet Önizleme
    const previewContainer = document.getElementById('badgesPreview');
    previewContainer.innerHTML = '';
    
    const badgeKeys = Object.keys(BADGES_DEFS);
    // Rastgele veya ilk 4 rozeti göster
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
            showToast("🏆 Yeni Rozet: Kâtip", true); playBeep();
        }
        
        noteModal.classList.remove('show');
        showToast("Not kaydedildi 📝");
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
            showToast("Hedef güncellendi.");
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
                    showToast("Yedek başarıyla geri yüklendi! Sayfa yenileniyor...");
                    setTimeout(() => location.reload(), 1500);
                } else { alert("Geçersiz yedek dosyası!"); }
            } catch(err) { alert("Dosya okuma hatası!"); }
        };
        reader.readAsText(file);
    });

    document.getElementById('btnHardReset').addEventListener('click', () => {
        if(confirm("DİKKAT! Tüm verileriniz kalıcı olarak silinecek. Emin misiniz?")) {
            if(confirm("Son Kararın mı? (İstersen önce üstten yedeğini al)")) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(HISTORY_KEY);
                location.reload();
            }
        }
    });
}

/* --- BASİT CONFETTİ ANİMASYONU --- */
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

/* --- HAFTALIK PROGRAM GİRİŞİ (MEVCUT MANTIK) --- */
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
        showToast('Program başarıyla kaydedildi! 🎉');
        document.getElementById('tabToday').click();
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Mevcut haftanın TÜM programını silmek istediğine emin misin?')) {
            document.getElementById('inputBulkTekrar').value = '';
            document.getElementById('inputBulkYeni').value = '';
            DAYS.forEach(d => { appData.days[d.key] = { tekrar: [], yeniKonular: [] }; });
            saveData();
            renderToday();
        }
    });

    document.getElementById('btnResetWeek').addEventListener('click', () => {
        if (!confirm('Yeni haftaya geçilecek:\n\n✅ Mevcut hafta arşivlenecek\n🔄 Tamamlanan konular sıfırlanacak\n📋 Program yapısı korunacak\n\nDevam?')) return;
        
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
        showToast('Yeni hafta başlatıldı! Başarılar 🚀');
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

        const topicMatch = trimmed.match(/^[-*•]\s*(.*)/);
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
