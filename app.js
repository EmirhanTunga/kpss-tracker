// ===== KPSS Başarı Rehberi - Ana Uygulama Dosyası =====

/* --- SABİTLER VE VERİ YAPISI --- */
let STORAGE_KEY = 'kpss_tracker_v2';
const HISTORY_KEY = 'kpss_tracker_history';
const DRAFT_KEY = 'kpss_tracker_drafts';

const VALID_USERS = {
    'emirhan@kpss.com': '1234',
    'test@kpss.com': '123'
};
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
    // Hide main app container initially
    const appContainer = document.querySelector('.app-container');
    const loginScreen = document.getElementById('loginScreen');
    if(appContainer) appContainer.style.display = 'none';

    // Auto login check
    const savedUser = localStorage.getItem('kpss_current_user');
    if (savedUser && VALID_USERS[savedUser]) {
        handleLoginSuccess(savedUser);
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
    }

    // Login logic
    const btnLogin = document.getElementById('btnLogin');
    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();
            const err = document.getElementById('loginError');
            
            if (VALID_USERS[email] && VALID_USERS[email] === pass) {
                err.style.display = 'none';
                localStorage.setItem('kpss_current_user', email);
                handleLoginSuccess(email);
            } else {
                err.style.display = 'block';
            }
        });
    }
    
    // Logout logic
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('kpss_current_user');
            location.reload();
        });
    }
});

function handleLoginSuccess(email) {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.querySelector('.app-container');
    if(loginScreen) loginScreen.style.display = 'none';
    if(appContainer) appContainer.style.display = 'block';
    
    // Set dynamic storage key
    STORAGE_KEY = `kpss_tracker_v2_${email}`;

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
    renderStats();
    renderSpacedRepetition();
    renderExams();
    setupDailyChallenge();
    setupQuestions();
    setupSyllabus();
    setupFlashcards();
}

/* --- VERİ YÖNETİMİ --- */
function loadData() {
    appData = null;

    let raw = localStorage.getItem(STORAGE_KEY);
    appData = raw ? JSON.parse(raw) : null;

    if (!appData) {
        // Hiçbirinde veri yoksa boş başlat
        let raw = localStorage.getItem(STORAGE_KEY);
        appData = raw ? JSON.parse(raw) : { weekLabel: getCurrentWeekLabel(), days: {} };
    }

    // Yeni model default değerleri
    if (!appData.pomodoro) appData.pomodoro = { totalCompleted: 0, totalMins: 0, history: [] };
    if (!appData.badges) appData.badges = [];
    if (!appData.streak) appData.streak = { current: 0, lastDate: null };
    if (!appData.points) appData.points = 0;
    if (!appData.settings) appData.settings = { goalPct: 80 };
    if (!appData.spacedRep) appData.spacedRep = [];
    if (!appData.exams) appData.exams = [];
    if (!appData.heatmap) appData.heatmap = {};
    if (!appData.questions) appData.questions = {};
    if (!appData.syllabus) appData.syllabus = {};

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

/* --- GELİŞMİŞ SESLİ BİLDİRİMLER --- */
function playSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        switch (type) {
            case 'complete': // Görev tamamlama - kısa tiz bip
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
            case 'badge': // Rozet kazanma - özel jingle
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
    } catch (e) { }
}

// Eski playBeep'i yeni sisteme yönlendir
function playBeep() { playSound('default'); }

/* --- TEMA GEÇİŞİ (KARANLIK/AYDINLIK) --- */
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
    if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
    // PWA theme-color güncelle
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f0f2f5' : '#06080f';
}

/* --- KLAVYE KISAYOLLARI --- */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Input veya textarea içindeyse jönlendir
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        switch (e.key) {
            case ' ': // Space = Pomodoro başlat/durdur
                e.preventDefault();
                document.getElementById('btnPomoStart').click();
                break;
            case 'r': case 'R': // R = Pomodoro sıfırla
                document.getElementById('btnPomoReset').click();
                break;
            case 't': case 'T': // T = Tema değiştir
                toggleTheme();
                break;
            case 's': case 'S': // S = Programı kaydet (sadece program sekmesindeyse)
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
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
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
                if (btn.dataset.tab === 'questions') renderQuestions();
                if (btn.dataset.tab === 'syllabus') renderSyllabus();
                if (btn.dataset.tab === 'cards') renderFlashcards();

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
    if (all.length > 0) {
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

    if (task.completed) {
        addPoints(10);
        confetti(30);
        playSound('complete');
        checkDailyGoalCompletion();
        recordHeatmap(task.text, true);
        scheduleSpacedRepetition(task);
    } else {
        addPoints(-10);
        recordHeatmap(task.text, false);
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
        showToast(`🎯 Günlük hedefine ulaştın! (${doneCount}/${all.length})`, true);
    }
}

/* --- DRAG & DROP YAPISI (SÜRÜKLE BIRAK) --- */
let draggedTaskHTML = null;
let draggedTaskData = null;

function setupDragAndDrop(container, type) {
    const items = container.querySelectorAll('.task-item');

    items.forEach(item => {
        item.addEventListener('dragstart', function (e) {
            this.classList.add('dragging');
            draggedTaskData = {
                id: this.dataset.id,
                type: this.dataset.type,
                index: parseInt(this.dataset.index)
            };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        item.addEventListener('dragend', function () {
            this.classList.remove('dragging');
            container.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', function (e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        item.addEventListener('dragleave', function () {
            this.classList.remove('drag-over');
        });

        item.addEventListener('drop', function (e) {
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
            totalDone += appData.days[d.key].tekrar.filter(t => t.completed).length;
            totalDone += appData.days[d.key].yeniKonular.filter(t => t.completed).length;
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
            doneTasks += arr.filter(t => t.completed).length;
        });
        if (allTasks > 0 && (doneTasks / allTasks >= 0.5)) { earned.push('half_way'); newBadge = 'half_way'; }
    }

    // Günlük seri hesabı
    updateStreakData();

    if (!earned.includes('streak_3') && appData.streak.current >= 3) { earned.push('streak_3'); newBadge = 'streak_3'; }
    if (!earned.includes('streak_7') && appData.streak.current >= 7) { earned.push('streak_7'); newBadge = 'streak_7'; }

    saveData();

    if (newBadge) {
        playSound('badge');
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
            if (pomoIsRunning) return showToast("Zamanlayıcı çalışırken mod değiştiremezsiniz.");
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
                if (pomoTimeRemaining > 0) {
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
    playSound('pomodoro');
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
        if (taskId) {
            // Görevi today tabsından bulup bitir
            const list = [...appData.days[selectedDay].tekrar, ...appData.days[selectedDay].yeniKonular];
            const task = list.find(t => t.id === taskId);
            if (task && !task.completed) {
                appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - ${task.subject || ''} (${task.text}) çalışıldı.`);
                if (confirm(`"${task.text}" konusunu tamamlandı olarak işaretleyelim mi?`)) {
                    task.completed = true;
                    task.completedAt = new Date().toISOString();
                }
            }
        } else {
            appData.pomodoro.history.push(`${new Date().toLocaleTimeString('tr-TR')} - Serbest Pomodoro`);
        }

        // Gamification Rozet Check (Pomo bazlı)
        let earned = appData.badges;
        if (appData.pomodoro.totalCompleted >= 1 && !earned.includes('pomo_starter')) {
            earned.push('pomo_starter'); showToast(`🏆 Yeni Rozet: Pomodoro Çaylağı!`, true); playBeep();
        }
        if (appData.pomodoro.totalCompleted >= 10 && !earned.includes('pomo_master')) {
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
    if (histArr.length > 0) {
        histList.innerHTML = histArr.slice(-10).reverse().map(log => `<div class="pomo-h-item">${log}</div>`).join('');
    }
}

function updatePomoTaskSelect(dayData) {
    const select = document.getElementById('pomoTaskSelect');
    select.innerHTML = '<option value="">-- Serbest Çalışma --</option>';

    const tasks = [...(dayData.tekrar || []), ...(dayData.yeniKonular || [])].filter(t => !t.completed);
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

        let barClass = total === 0 ? 'none' : (done === total ? 'all-done' : 'partial');

        return `<div class="week-day-card ${isToday ? 'is-today' : ''} ${isActive ? 'active' : ''}" data-day="${d.key}" onclick="document.querySelector('.day-btn[data-day=\\'${d.key}\\']').click()">
            <div class="day-name">${d.short}</div>
            <div class="day-progress ${barClass}">${total > 0 ? done + '/' + total : '–'}</div>
            <div class="day-bar"><div class="day-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
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
            totalDone += (appData.days[d.key][type] || []).filter(t => t.completed).length;
        });
    });
    const pct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;
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
        if (val >= 1 && val <= 100) {
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
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed && parsed.days) {
                    appData = parsed;
                    saveData();
                    showToast("Yedek başarıyla geri yüklendi! Sayfa yenileniyor...");
                    setTimeout(() => location.reload(), 1500);
                } else { alert("Geçersiz yedek dosyası!"); }
            } catch (err) { alert("Dosya okuma hatası!"); }
        };
        reader.readAsText(file);
    });

    document.getElementById('btnHardReset').addEventListener('click', () => {
        if (confirm("DİKKAT! Tüm verileriniz kalıcı olarak silinecek. Emin misiniz?")) {
            if (confirm("Son Kararın mı? (İstersen önce üstten yedeğini al)")) {
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

    for (let i = 0; i < amount; i++) {
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            if (p.y < canvas.height) active = true;
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
            p.x += p.dx; p.y += p.dy; p.dy += 0.2; // gravity
            p.tilt += 0.1; // spin
        });
        if (active) requestAnimationFrame(draw);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
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

        if (tItems.length > 0) {
            tekrarLines.push(day.label);
            let s = null;
            tItems.forEach(i => {
                if (i.subject && i.subject !== s) { s = i.subject; tekrarLines.push(s); }
                tekrarLines.push('-' + i.text);
            });
            tekrarLines.push('');
        }

        if (yItems.length > 0) {
            yeniLines.push(day.label);
            let s = null;
            yItems.forEach(i => {
                if (i.subject && i.subject !== s) { s = i.subject; yeniLines.push(s); }
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
        if (confirm('Mevcut haftanın TÜM programını silmek istediğine emin misin?')) {
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

/* ========================================
   YENI MODÜLLER
   ======================================== */

const EXAM_SUBJECTS = [
    { key: 'turkce', label: 'Türkçe', maxQ: 30 },
    { key: 'matematik', label: 'Matematik', maxQ: 30 },
    { key: 'tarih', label: 'Tarih', maxQ: 27 },
    { key: 'cografya', label: 'Coğrafya', maxQ: 18 },
    { key: 'vatandaslik', label: 'Vatandaşlık', maxQ: 9 },
    { key: 'guncel', label: 'Güncel Bilgiler', maxQ: 6 }
];

/* --- 1. ARALIKLI TEKRAR (SPACED REPETITION) --- */
const SR_INTERVALS = [1, 3, 7, 21]; // gün

function scheduleSpacedRepetition(task) {
    // Zaten planlanmış mı kontrol et
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
                <span class="sr-interval">${item.interval} gün aralıklı tekrar</span>
            </div>
            <button class="btn btn-sm btn-success" onclick="markSrDone('${item.id}')">✓ Tekrar Ettim</button>
        </div>
    `).join('');
}

function markSrDone(srId) {
    const item = appData.spacedRep.find(s => s.id === srId);
    if (item) { item.done = true; addPoints(5); }
    saveData();
    renderSpacedRepetition();
    showToast('Tekrar tamamlandı! 🧠');
}

/* --- 2. ISI HARİTASI (HEATMAP) --- */
function recordHeatmap(taskText = "", isAdd = true) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Eski sayacı array'e çevir
    if (typeof appData.heatmap[todayStr] === 'number') {
        const count = appData.heatmap[todayStr];
        appData.heatmap[todayStr] = Array(count).fill("Toplu görev");
    }

    if (!appData.heatmap[todayStr]) appData.heatmap[todayStr] = [];

    if (isAdd) {
        if (taskText) appData.heatmap[todayStr].push(taskText);
    } else {
        // Çıkarma işlemi (uncheck)
        if (taskText) {
            const idx = appData.heatmap[todayStr].indexOf(taskText);
            if (idx > -1) appData.heatmap[todayStr].splice(idx, 1);
        }
    }

    saveData();
}

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    const today = new Date();
    let html = '';

    // Max val bulmak için (hem eski sayı hem yeni array formatını destekler)
    let maxVal = 1;
    Object.values(appData.heatmap || {}).forEach(v => {
        const count = Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
        if (count > maxVal) maxVal = count;
    });

    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const rawVal = (appData.heatmap || {})[dateStr] || 0;

        let count = 0;
        let tasksHtml = '';
        if (Array.isArray(rawVal)) {
            count = rawVal.length;
            tasksHtml = rawVal.map(t => `<li>${escapeHtml(t)}</li>`).join('');
        } else if (typeof rawVal === 'number') {
            count = rawVal;
            tasksHtml = `<li>${count} görev tamamlandı (Eski kayıt)</li>`;
        }

        const opacity = count === 0 ? 0.06 : Math.max(0.2, count / maxVal);

        html += `
            <div class="hm-cell-wrapper">
                <div class="hm-cell" style="opacity:${opacity}"></div>
                <div class="hm-tooltip">
                    <strong>${dateStr}</strong>
                    ${count > 0 ? `<ul>${tasksHtml}</ul>` : '<p>Görev yok</p>'}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

/* --- 3. DERS BAZLI ANALİZ --- */
function renderSubjectAnalysis() {
    const container = document.getElementById('subjectBars');
    if (!container) return;

    const subjects = {};
    DAYS.forEach(d => {
        ['tekrar', 'yeniKonular'].forEach(type => {
            (appData.days[d.key][type] || []).forEach(t => {
                const subj = t.subject || 'Diğer';
                if (!subjects[subj]) subjects[subj] = { total: 0, done: 0 };
                subjects[subj].total++;
                if (t.completed) subjects[subj].done++;
            });
        });
    });

    const entries = Object.entries(subjects);
    if (entries.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Henüz program girilmedi.</p>';
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

/* --- 4. DENEME SINAVI TAKİBİ --- */
function setupExams() {
    // Tarih alanını bugünle doldur
    const dateInput = document.getElementById('examDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Ders giriş alanlarını oluştur
    const grid = document.getElementById('examSubjectsGrid');
    if (grid) {
        grid.innerHTML = EXAM_SUBJECTS.map(s => `
            <div class="exam-subj-input">
                <label>${s.label}</label>
                <div class="exam-net-row">
                    <input type="number" id="examD_${s.key}" placeholder="Doğru" min="0" max="${s.maxQ}">
                    <input type="number" id="examY_${s.key}" placeholder="Yanlış" min="0" max="${s.maxQ}">
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
        const name = document.getElementById('examName').value || 'İsimsiz Deneme';
        if (!date) return showToast('Lütfen tarih girin.');

        const results = {};
        let totalNet = 0;
        let gyNet = 0;
        let gkNet = 0;

        EXAM_SUBJECTS.forEach(s => {
            const d = parseFloat(document.getElementById(`examD_${s.key}`).value) || 0;
            const y = parseFloat(document.getElementById(`examY_${s.key}`).value) || 0;
            const net = Math.max(0, d - (y * 0.25));
            results[s.key] = { dogru: d, yanlis: y, net: parseFloat(net.toFixed(1)) };
            totalNet += net;

            if (s.key === 'turkce' || s.key === 'matematik') {
                gyNet += net;
            } else {
                gkNet += net;
            }
        });

        // KPSS P93 (Ön Lisans) Puan Tahminleri
        const p2024 = Math.min(100, totalNet === 0 ? 0 : 50.5 + (gyNet * 0.43) + (gkNet * 0.40));
        const p2022 = Math.min(100, totalNet === 0 ? 0 : 51.5 + (gyNet * 0.46) + (gkNet * 0.38));
        const p2020 = Math.min(100, totalNet === 0 ? 0 : 49.0 + (gyNet * 0.45) + (gkNet * 0.42));

        appData.exams.push({
            id: genId(), date, name,
            results, totalNet: parseFloat(totalNet.toFixed(1)),
            scores: {
                y2024: parseFloat(p2024.toFixed(3)),
                y2022: parseFloat(p2022.toFixed(3)),
                y2020: parseFloat(p2020.toFixed(3))
            }
        });

        saveData();
        renderExams();
        showToast('Deneme sonucu kaydedildi! 📊');
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
        if (cardsEl) cardsEl.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><p>Henüz deneme sonucu eklenmedi.</p></div>';
        if (chartEl) chartEl.innerHTML = '';
        return;
    }

    // Gelişim Çizgi Grafiği (SVG)
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

    // Sonuç Kartları (Son 5)
    if (cardsEl) {
        cardsEl.innerHTML = exams.slice(-5).reverse().map((exam, i) => {
            const prevExam = exams.length > 1 && i === 0 ? exams[exams.length - 2] : null;
            const diff = prevExam ? (exam.totalNet - prevExam.totalNet).toFixed(1) : null;
            const diffStr = diff !== null ? (diff > 0 ? `<span class="exam-up">▲ +${diff}</span>` : diff < 0 ? `<span class="exam-down">▼ ${diff}</span>` : `<span class="exam-same">= 0</span>`) : '';

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
                    
                    ${exam.scores ? `
                    <div class="exam-score-explanation" style="font-size:0.8rem; color:var(--text-secondary); margin-bottom: 8px;">
                        💡 Yaptığınız <strong>${exam.totalNet.toFixed(1)} toplam net</strong> üzerinden (Ön Lisans formatında) geçmiş yıllardaki katsayılara göre alabileceğiniz tahmini KPSS puanları:
                    </div>
                    <div class="exam-scores-pill-group">
                        <div class="score-pill current">
                            <span class="score-year">2024 Puan:</span>
                            <span class="score-val">${exam.scores.y2024.toFixed(3)}</span>
                        </div>
                        <div class="score-pill">
                            <span class="score-year">2022 Puan:</span>
                            <span class="score-val">${exam.scores.y2022.toFixed(3)}</span>
                        </div>
                        <div class="score-pill">
                            <span class="score-year">2020 Puan:</span>
                            <span class="score-val">${exam.scores.y2020.toFixed(3)}</span>
                        </div>
                    </div>
                    ` : ''}

                    <table class="exam-table">
                        <tr>${EXAM_SUBJECTS.map(s => `<th>${s.label}</th>`).join('')}</tr>
                        <tr>${subjectCells}</tr>
                    </table>
                    <button class="btn-link" style="color:var(--accent-red);font-size:0.75rem" onclick="deleteExam('${exam.id}')">Sil</button>
                </div>
            `;
        }).join('');
    }

    // Zayıf Ders Analizi
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

    // Son 3 denemenin ortalamasını al
    const recent = exams.slice(-3);
    const avgNets = {};
    EXAM_SUBJECTS.forEach(s => {
        let sum = 0, count = 0;
        recent.forEach(e => {
            if (e.results[s.key]) { sum += e.results[s.key].net; count++; }
        });
        if (count > 0) avgNets[s.key] = { label: s.label, avg: sum / count, maxQ: s.maxQ, pct: ((sum / count) / s.maxQ) * 100 };
    });

    // En düşük yüzdelileri bul
    const sorted = Object.values(avgNets).sort((a, b) => a.pct - b.pct);
    const weak = sorted.filter(s => s.pct < 50).slice(0, 3);

    if (weak.length === 0) { box.classList.add('hidden'); return; }

    box.classList.remove('hidden');
    list.innerHTML = weak.map(s => `
        <div class="weak-item">
            <span class="weak-name">⚠️ ${s.label}</span>
            <span class="weak-detail">Ort: ${s.avg.toFixed(1)} / ${s.maxQ} net (%${s.pct.toFixed(0)})</span>
            <div class="subj-bar-track"><div class="subj-bar-fill weak-fill" style="width:${s.pct}%"></div></div>
        </div>
    `).join('');
}

/* --- 5. BİLDİRİM SİSTEMİ --- */
function setupNotifications() {
    const btn = document.getElementById('btnEnableNotif');
    const status = document.getElementById('notifStatus');

    if (!('Notification' in window)) {
        if (status) status.textContent = 'Bu tarayıcı bildirimleri desteklemiyor.';
        if (btn) btn.disabled = true;
        return;
    }

    updateNotifStatus();

    btn?.addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        updateNotifStatus();
        if (perm === 'granted') {
            showToast('Bildirimler açıldı! 🔔');
            scheduleReminders();
        }
    });

    // Eğer izin varsa hatırlatıcıları başlat
    if (Notification.permission === 'granted') {
        scheduleReminders();
    }
}

function updateNotifStatus() {
    const status = document.getElementById('notifStatus');
    if (!status) return;
    const perm = Notification.permission;
    if (perm === 'granted') status.innerHTML = '<span style="color:var(--accent-green)">✅ Bildirimler aktif</span>';
    else if (perm === 'denied') status.innerHTML = '<span style="color:var(--accent-red)">❌ Bildirimler engellenmiş. Tarayıcı ayarlarından açın.</span>';
    else status.innerHTML = '<span style="color:var(--text-muted)">Henüz izin verilmemiş.</span>';
}

function scheduleReminders() {
    // Her 2 saatte bir kontrol et
    setInterval(() => {
        const h = new Date().getHours();

        // Sabah 9, Öğle 13, Akşam 19 hatırlatma
        if (h === 9 || h === 13 || h === 19) {
            const dueReps = (appData.spacedRep || []).filter(s => s.reviewDate <= new Date().toISOString().split('T')[0] && !s.done);
            if (dueReps.length > 0) {
                new Notification('🧠 Tekrar Zamanı!', { body: `${dueReps.length} konu tekrar bekliyor.`, icon: '🎓' });
            }

            // Bugün çalışma kontrolü
            const todayStr = new Date().toISOString().split('T')[0];
            if (!appData.heatmap[todayStr] && h >= 19) {
                new Notification('📚 Bugün henüz çalışmadın!', { body: 'Hadi bir Pomodoro ile başla!', icon: '🍅' });
            }
        }
    }, 60 * 60 * 1000); // Saatte bir kontrol
}

/* --- 6. RENDER STATS GÜNCELLEME (HEATMAP + DERS ANALİZİ EKLENDİ) --- */
const _origRenderStats = typeof renderStats === 'function' ? renderStats : null;
// renderStats fonksiyonunu override etmeden, onun çağrıldığı yerlerde ek render ekleyelim
(function () {
    const origSetupTabs = setupTabs;
    // renderStats çağrıldığında heatmap ve subject analysis da render edilsin
    const origFn = window.renderStats;
    if (origFn) {
        window._baseRenderStats = origFn;
    }
})();

// renderStats içine hook ekle - mevcut renderStats'ın sonuna ek render
const _patchedRenderStatsOnce = (() => {
    const origBody = renderStats;
    renderStats = function () {
        origBody.call(this);
        renderHeatmap();
        renderSubjectAnalysis();
        renderAIAdvice();
    };
    return true;
})();

/* --- 7. GÜNLÜK MEYDAN OKUMA --- */
const CHALLENGE_TEMPLATES = [
    { text: 'Bugün {n} Pomodoro seansı tamamla', check: (n) => (appData.pomodoro?.totalCompleted || 0) >= n, args: [2, 3, 4] },
    { text: 'Bugün en az {n} konu tamamla', check: (n) => getTodayCompletedCount() >= n, args: [3, 5, 7] },
    { text: 'Bugün bir ders notu yaz', check: () => { const t = new Date().toISOString().split('T')[0]; return Object.keys(appData.notes || {}).length > 0; }, args: [null] },
    { text: 'Bugün {n} farklı dersten çalış', check: (n) => getTodaySubjectCount() >= n, args: [2, 3] },
    { text: 'Bugün tüm yeni konuları tamamla', check: () => { const d = appData.days[selectedDay]; return d.yeniKonular.length > 0 && d.yeniKonular.every(t => t.completed); }, args: [null] },
    { text: 'Bugün tüm tekrar konularını tamamla', check: () => { const d = appData.days[selectedDay]; return d.tekrar.length > 0 && d.tekrar.every(t => t.completed); }, args: [null] },
    { text: 'Bugün en az {n} aralıklı tekrar tamamla', check: (n) => (appData.spacedRep || []).filter(s => s.done).length >= n, args: [1, 2] },
];

function getTodayCompletedCount() {
    const d = appData.days[selectedDay];
    return [...d.yeniKonular, ...d.tekrar].filter(t => t.completed).length;
}

function getTodaySubjectCount() {
    const d = appData.days[selectedDay];
    const subjects = new Set();
    [...d.yeniKonular, ...d.tekrar].filter(t => t.completed).forEach(t => { if (t.subject) subjects.add(t.subject); });
    return subjects.size;
}

function setupDailyChallenge() {
    const CHALLENGE_STORAGE = 'kpss_daily_challenge';
    const todayStr = new Date().toISOString().split('T')[0];
    let stored = null;

    try { stored = JSON.parse(localStorage.getItem(CHALLENGE_STORAGE)); } catch (e) { }

    if (!stored || stored.date !== todayStr) {
        // Yeni gün = yeni meydan okuma seç
        const template = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
        const argOptions = template.args.filter(a => a !== null);
        const arg = argOptions.length > 0 ? argOptions[Math.floor(Math.random() * argOptions.length)] : null;
        const text = arg !== null ? template.text.replace('{n}', arg) : template.text;

        stored = { date: todayStr, text, templateIdx: CHALLENGE_TEMPLATES.indexOf(template), arg, claimed: false };
        localStorage.setItem(CHALLENGE_STORAGE, JSON.stringify(stored));
    }

    const dcText = document.getElementById('dcText');
    const claimBtn = document.getElementById('btnClaimChallenge');

    dcText.textContent = stored.text;

    // Tamamlanmış mı kontrol et
    function checkChallenge() {
        const template = CHALLENGE_TEMPLATES[stored.templateIdx];
        if (!template) return false;
        try { return template.check(stored.arg); } catch (e) { return false; }
    }

    function updateChallengeUI() {
        if (stored.claimed) {
            claimBtn.textContent = '✓ Kazanıldı!';
            claimBtn.disabled = true;
            claimBtn.classList.add('dc-claimed');
            document.getElementById('dailyChallengeBox').classList.add('dc-completed');
        } else if (checkChallenge()) {
            claimBtn.disabled = false;
            claimBtn.textContent = '🎁 Ödülü Al!';
        } else {
            claimBtn.disabled = true;
            claimBtn.textContent = 'Devam Et...';
        }
    }

    updateChallengeUI();

    // Her 5 saniyede kontrol et
    setInterval(updateChallengeUI, 5000);

    claimBtn.addEventListener('click', () => {
        if (stored.claimed || !checkChallenge()) return;
        stored.claimed = true;
        localStorage.setItem(CHALLENGE_STORAGE, JSON.stringify(stored));
        addPoints(25);
        playSound('badge');
        confetti(80);
        showToast('🎉 Meydan okuma tamamlandı! +25 puan kazandın!', true);
        updateChallengeUI();
    });
}

/* --- 8. AKILLI TAVSİYE (AI ADVICE) --- */
function renderAIAdvice() {
    const container = document.getElementById('aiAdviceContent');
    if (!container) return;

    let tips = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Soru Çözüm Analizi (Son 3 Gün)
    let totalQ = 0, totalCorrect = 0, totalWrong = 0;
    const qBySubj = {};
    const dDate = new Date();
    
    for (let i = 0; i < 3; i++) {
        const dStr = new Date(dDate).toISOString().split('T')[0];
        const dayQ = appData.questions[dStr] || [];
        dayQ.forEach(q => {
            totalQ += q.total;
            totalCorrect += q.correct;
            totalWrong += q.wrong;
            if (!qBySubj[q.subject]) qBySubj[q.subject] = { total: 0, correct: 0, wrong: 0 };
            qBySubj[q.subject].total += q.total;
            qBySubj[q.subject].correct += q.correct;
            qBySubj[q.subject].wrong += q.wrong;
        });
        dDate.setDate(dDate.getDate() - 1);
    }

    if (totalQ > 0) {
        for (const [subj, stats] of Object.entries(qBySubj)) {
            if (stats.total >= 10) {
                const acc = Math.round((stats.correct / stats.total) * 100);
                if (acc < 50) {
                    tips.push({ icon: '⚠️', type: 'warning', title: 'Dikkat! Yanlış Oranı Yüksek', text: `Son 3 günde <strong>${subj}</strong> dersinden ${stats.total} soru çözdün fakat başarı oranın %${acc}. Müfredat sekmesinden zayıf olduğun konuları tespit edip tekrar etmelisin.` });
                } else if (acc >= 85) {
                    tips.push({ icon: '🌟', type: 'success', title: 'Harika Gidiyorsun', text: `Son 3 günde <strong>${subj}</strong> sorularında %${acc} başarı yakaladın! Bu dersin mantığını oturtmuşsun.` });
                }
            }
        }
        
        if (totalQ > 150) {
             tips.push({ icon: '🚀', type: 'success', title: 'Tempo Muazzam!', text: `Son 3 günde toplam ${totalQ} soru çözdün. Sınav maratonunda bu hız sana derece getirir.` });
        }
    } else {
         tips.push({ icon: '❓', type: 'warning', title: 'Soru Çözümü Eksik', text: 'Son 3 gündür sisteme hiç soru çözümü girmemişsin. Pratik yapmak, öğrenmeyi kalıcı kılar.' });
    }

    // 2. Müfredat Takibi Analizi
    if (appData.syllabus && Object.keys(appData.syllabus).length > 0) {
        let maxDone = 0, minDone = 999, maxSubj = '', minSubj = '';
        Object.keys(appData.syllabus).forEach(subj => {
            const doneCnt = Object.values(appData.syllabus[subj]).filter(Boolean).length;
            if(doneCnt > maxDone) { maxDone = doneCnt; maxSubj = subj; }
            if(doneCnt < minDone) { minDone = doneCnt; minSubj = subj; }
        });
        
        if (minDone === 0 && minSubj !== '') {
            tips.push({ icon: '📚', type: 'warning', title: 'İhmal Edilen Ders', text: `Müfredat listene göre <strong>${minSubj}</strong> dersine neredeyse hiç başlamamışsın. Programına eklemelisin.` });
        }
        if (maxDone > 10) {
            tips.push({ icon: '🏆', type: 'success', title: 'Müfredat Fatihi', text: `<strong>${maxSubj}</strong> dersindeki konuların büyük çoğunluğunu bitirmişsin. Artık branş denemesi çözme vakti.` });
        }
    } else {
        tips.push({ icon: '📋', type: 'info', title: 'Müfredat Takibi', text: 'Konulardaki ilerlemeni analiz edebilmem için "Müfredat" sekmesinden bitirdiğin konuları işaretle.' });
    }

    // 3. Deneme Analizi
    const exams = appData.exams || [];
    if (exams.length >= 2) {
        const last = exams[exams.length - 1];
        const prev = exams[exams.length - 2];
        const diff = last.totalNet - prev.totalNet;
        if (diff > 0) {
            tips.push({ icon: '📈', type: 'success', title: 'Deneme Neti Yükseliyor!', text: `Son denemen öncekine göre <strong>+${diff.toFixed(1)} net</strong> daha iyi. Yükselen ivmeyi koru!` });
        } else if (diff <= -5) {
            tips.push({ icon: '📉', type: 'warning', title: 'Deneme Netinde Düşüş', text: `Son denemede <strong>${Math.abs(diff).toFixed(1)} net</strong> geriledin. Sınavda zaman yönetimini veya eksiklerini gözden geçir.` });
        }
    } else if (exams.length === 0) {
        tips.push({ icon: '📝', type: 'info', title: 'Deneme Sınavı Eksikliği', text: 'Programına en az 1 deneme eklemelisin ki gelişimini puan bazlı ölçebilelim.' });
    }

    // 4. Pomodoro Analizi
    const pomo = appData.pomodoro?.totalMins || 0;
    if (pomo > 0 && pomo < 50) {
        tips.push({ icon: '🍅', type: 'info', title: 'Odaklanma Süresi', text: 'Kısa süreli pomodoro yapmışsın. Günlük daha uzun süre odaklanmak kalıcı öğrenmeye yardımcı olur.' });
    }

    // 5. Seri (Streak)
    const streak = appData.streak?.current || 0;
    if (streak >= 7) {
        tips.push({ icon: '🔥', type: 'success', title: `${streak} Günlük Kesintisiz Çalışma!`, text: 'Muazzam bir istikrar. Hayallerine adım adım yaklaşıyorsun!' });
    } else if (streak === 0) {
        tips.push({ icon: '⏰', type: 'warning', title: 'Seri Kırıldı', text: 'Çalışma serin sıfırlandı. Bugün küçük de olsa bir konu tamamlayarak zinciri tekrar kur.' });
    }

    // Render
    if (tips.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Yeterli veri toplandığında Sanal Koç tavsiyeleri burada görünecek.</p>';
        return;
    }

    // Önceliklendirme
    tips.sort((a,b) => {
        const w = { 'warning':3, 'info':2, 'success':1 };
        return w[b.type] - w[a.type];
    });
    
    // max 5 limit
    const displayTips = tips.slice(0, 5);

    container.innerHTML = displayTips.map(tip => `
        <div class="ai-tip ai-tip-${tip.type}">
            <div class="ai-tip-icon">${tip.icon}</div>
            <div class="ai-tip-body">
                <strong>${tip.title}</strong>
                <p>${tip.text}</p>
            </div>
        </div>
    `).join('');
}

/* --- SORU TAKİBİ (QUESTIONS TRACKER) --- */
function setupQuestions() {
    const btnSave = document.getElementById('btnSaveQuestion');
    console.log("Setting up questions, btn is: ", btnSave);
    if (!btnSave) return;

    btnSave.addEventListener('click', () => {
        const subject = document.getElementById('qSubject').value;
        const correct = parseInt(document.getElementById('qCorrect').value) || 0;
        const wrong = parseInt(document.getElementById('qWrong').value) || 0;


        if (correct === 0 && wrong === 0) {
            showToast('Lütfen en az bir soru sayısı girin.');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        
        if (!appData.questions[todayStr]) {
            appData.questions[todayStr] = [];
        }

        appData.questions[todayStr].push({
            id: genId(),
            subject,
            correct,
            wrong,

            total: correct + wrong,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });

        saveData();
        addPoints(5); // 5 points for solving questions
        showToast('🎯 Soru çözümü kaydedildi!', true);
        playSound('complete');
        
        // Reset form
        document.getElementById('qCorrect').value = '';
        document.getElementById('qWrong').value = '';


        renderQuestions();
    });

    renderQuestions();
}

function renderQuestions() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayQ = appData.questions[todayStr] || [];
    const listContainer = document.getElementById('qTodayList');
    
    if (!listContainer) return;
    
    if (todayQ.length === 0) {
        listContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span><p>Bugün henüz soru çözümü girmediniz.</p></div>`;
        document.getElementById('qTotalToday').textContent = '0';
    } else {
        let total = 0;
        let html = '';
        todayQ.forEach(q => {
            total += q.total;
            const successRate = q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0;
            html += `
                <div class="q-item" style="background:var(--bg-secondary); margin-bottom:10px; padding:15px; border-radius:12px; border-left:4px solid var(--primary); display:flex; justify-content:space-between; align-items:center;">
                    <div class="q-item-header" style="display:flex; flex-direction:column;">
                        <strong class="q-subj" style="font-size:1.1rem; color:var(--text-color);">${escapeHtml(q.subject)}</strong>
                        <span class="q-time" style="font-size:0.8rem; color:var(--text-muted);">${q.time}</span>
                    </div>
                    <div class="q-item-stats" style="display:flex; gap:15px; font-size:0.95rem; text-align:center;">
                        <div class="q-stat q-correct" title="Doğru"><span style="color:#2ecc71; font-weight:bold;">✓ ${q.correct}</span></div>
                        <div class="q-stat q-wrong" title="Yanlış"><span style="color:#e74c3c; font-weight:bold;">✗ ${q.wrong}</span></div>
                        ${q.empty !== undefined ? `<div class="q-stat q-empty" title="Boş"><span style="color:#95a5a6; font-weight:bold;">○ ${q.empty}</span></div>` : ''}
                        <div class="q-stat q-rate" title="Başarı Oranı" style="font-weight:bold; color:var(--primary);">%${successRate}</div>
                    </div>
                    <button class="btn-link" onclick="deleteQuestion('${q.id}')" style="color:#e74c3c; background:none; border:none; cursor:pointer;" title="Sil">🗑️</button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
        document.getElementById('qTotalToday').textContent = total;
    }

    renderQuestionChart();
}

function deleteQuestion(id) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayQ = appData.questions[todayStr];
    if (todayQ) {
        if(confirm("Bu soru kaydını silmek istediğine emin misin?")){
            appData.questions[todayStr] = todayQ.filter(q => q.id !== id);
            saveData();
            renderQuestions();
        }
    }
}

function renderQuestionChart() {
    const chartArea = document.getElementById('qChartArea');
    if (!chartArea) return;
    
    // Son 7 günün tarihlerini bul
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }
    
    let maxTotal = 0;
    const chartData = last7Days.map(dateStr => {
        const dayQs = appData.questions[dateStr] || [];
        let t = 0;
        dayQs.forEach(q => t += q.total);
        if (t > maxTotal) maxTotal = t;
        
        // short date formatting for x-axis
        const splitDate = dateStr.split('-');
        const shortDate = `${splitDate[2]}/${splitDate[1]}`;
        
        return { date: shortDate, total: t };
    });
    
    if (maxTotal === 0) {
        chartArea.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><p>Son 7 güne ait veri yok.</p></div>`;
        return;
    }
    
    let html = `<div class="q-chart-bars" style="display:flex; justify-content:space-between; align-items:flex-end; height:200px; padding:15px 0 0 0; border-bottom:1px solid var(--border-color); margin-top:20px;">`;
    
    chartData.forEach(d => {
        const heightPct = (d.total / maxTotal) * 100;
        html += `
            <div class="q-bar-wrapper" style="display:flex; flex-direction:column; align-items:center; width: 12%; height:100%; justify-content:flex-end;">
                <span style="font-size:0.8rem; color:var(--text-color); font-weight:bold; margin-bottom:6px;">${d.total > 0 ? d.total : ''}</span>
                <div class="q-bar" style="width:100%; height:${heightPct}%; background:linear-gradient(to top, var(--primary), #5a75ff); border-radius:6px 6px 0 0; min-height:${d.total > 0 ? '4px' : '0'}; transition: height 0.5s ease;"></div>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${d.date}</span>
            </div>
        `;
    });
    
    html += `</div>`;
    chartArea.innerHTML = html;
}

/* --- KPSS MÜFREDAT KONTROLÜ (SYLLABUS TRACKER) --- */

const KPSS_SYLLABUS = [
    {
        subject: "Tarih",
        icon: "🏺",
        topics: [
            "İslam Öncesi Türk Tarihi",
            "İlk Türk İslam Devletleri",
            "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri",
            "Osmanlı Devleti Duraklama ve Gerileme Dönemleri",
            "Osmanlı Kültür ve Medeniyeti",
            "20. Yüzyıl Başlarında Osmanlı Devleti",
            "Milli Mücadele Hazırlık Dönemi",
            "Kurtuluş Savaşı Muharebeler",
            "Atatürk İlke ve İnkılapları",
            "Atatürk Dönemi Türk Dış Politikası",
            "Çağdaş Türk ve Dünya Tarihi"
        ]
    },
    {
        subject: "Coğrafya",
        icon: "🌍",
        topics: [
            "Türkiye'nin Coğrafi Konumu",
            "Türkiye'nin Yer Şekilleri ve Su Örtüsü",
            "Türkiye'nin İklimi ve Bitki Örtüsü",
            "Türkiye'de Nüfus ve Yerleşme",
            "Türkiye'de Tarım ve Hayvancılık",
            "Türkiye'de Ormancılık ve Madenler",
            "Türkiye'de Enerji Kaynakları",
            "Türkiye'de Sanayi",
            "Türkiye'de Ulaşım, Turizm ve Ticaret",
            "Türkiye'nin Bölgesel Coğrafyası"
        ]
    },
    {
        subject: "Vatandaşlık",
        icon: "⚖️",
        topics: [
            "Hukukun Temel Kavramları",
            "Devlet Biçimleri ve Demokrasi",
            "Anayasa Hukukuna Giriş",
            "Temel Hak ve Ödevler",
            "Yasama",
            "Yürütme",
            "Yargı",
            "İdare Hukuku",
            "Ulusal ve Uluslararası Kuruluşlar"
        ]
    },
    {
        subject: "Türkçe",
        icon: "📖",
        topics: [
            "Sözcükte Anlam",
            "Cümlede Anlam",
            "Paragrafta Anlam",
            "Ses Bilgisi",
            "Sözcük Türleri",
            "Sözcükte Yapı ve Ekler",
            "Cümlenin Ögeleri",
            "Cümle Türleri",
            "Yazım Kuralları",
            "Noktalama İşaretleri",
            "Sözel Mantık"
        ]
    },
    {
        subject: "Matematik",
        icon: "🔢",
        topics: [
            "Temel Kavramlar ve Sayılar",
            "Bölme - Bölünebilme",
            "Rasyonel Sayılar",
            "Üslü Sayılar",
            "Köklü Sayılar",
            "Çarpanlara Ayırma",
            "Birinci Dereceden Denklemler",
            "Basit Eşitsizlikler ve Mutlak Değer",
            "Oran - Orantı",
            "Problemler",
            "Kümeler",
            "Fonksiyonlar",
            "Permütasyon, Kombinasyon, Olasılık",
            "Sayısal Mantık",
            "Geometri"
        ]
    }
];

function setupSyllabus() {
    renderSyllabus();
}

function renderSyllabus() {
    const dashboard = document.querySelector('.syllabus-dashboard');
    const content = document.getElementById('syllabusContent');
    
    if (!dashboard || !content) return;
    
    if (!appData.syllabus) appData.syllabus = {};
    
    let dashHtml = '';
    let contentHtml = '';
    
    let totalTopics = 0;
    let completedTotal = 0;

    KPSS_SYLLABUS.forEach(category => {
        const subj = category.subject;
        const topics = category.topics;
        
        let completedInSubj = 0;
        
        if (!appData.syllabus[subj]) {
            appData.syllabus[subj] = {};
        }

        let topicHtml = `<div class="syllabus-category" style="margin-bottom: 20px; background: var(--bg-secondary); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color);">
            <div class="syllabus-cat-header" style="padding: 15px 20px; background: rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <h3 style="margin: 0; font-size: 1.1rem; align-items:center; display:flex; gap:10px;"><span>${category.icon}</span> ${subj}</h3>
                <span class="subj-progress-text" style="font-weight: bold; color: var(--primary); font-size: 1.2rem;"></span>
            </div>
            <div class="syllabus-cat-body" style="padding: 5px 20px 15px 20px;">`;
            
        topics.forEach((topic, idx) => {
            totalTopics++;
            const isCompleted = appData.syllabus[subj][topic] || false;
            if (isCompleted) {
                completedInSubj++;
                completedTotal++;
            }
            
            const checkId = `syl_${subj}_${idx}`;
            
            topicHtml += `
                <div class="syl-topic-item" style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); transition: opacity 0.3s;">
                    <label class="task-checkbox">
                        <input type="checkbox" id="${checkId}" ${isCompleted ? 'checked' : ''} onchange="toggleSyllabusTopic('${subj}', '${topic}', this.checked)">
                        <span class="checkmark"></span>
                    </label>
                    <label for="${checkId}" style="cursor:pointer; margin-left:12px; flex:1; ${isCompleted ? 'text-decoration: line-through; opacity:0.4;' : ''}">${topic}</label>
                </div>
            `;
        });
        
        topicHtml += `</div></div>`;
        contentHtml += topicHtml;
        
        const pct = Math.round((completedInSubj / topics.length) * 100);
        dashHtml += `
            <div class="syl-dash-card" style="background: var(--bg-secondary); padding: 15px; border-radius: 12px; display:flex; flex-direction:column; gap:8px; border: 1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--text-color);">${category.icon} ${subj}</strong>
                    <span style="font-size:0.85rem; color:var(--text-muted);">${completedInSubj}/${topics.length}</span>
                </div>
                <div class="progress-bar" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill" style="width: ${pct}%; height: 100%; background: var(--primary); transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    });
    
    const overallPct = totalTopics > 0 ? Math.round((completedTotal / totalTopics) * 100) : 0;
    
    dashboard.innerHTML = `
        <div class="syl-overall" style="text-align:center; padding: 25px; background: linear-gradient(135deg, var(--primary) 0%, #1e40af 100%); border-radius: 12px; color: white; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            <p style="margin:0; opacity:0.9; font-size:0.95rem; text-transform: uppercase; letter-spacing:1px;">Genel KPSS İlerlemeniz</p>
            <h2 style="margin:10px 0 0 0; font-size:2.8rem; font-weight:900; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">%${overallPct}</h2>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px;">
            ${dashHtml}
        </div>
    `;
    
    content.innerHTML = contentHtml;
    
    setTimeout(() => {
        const headers = document.querySelectorAll('.syllabus-cat-header');
        let i = 0;
        KPSS_SYLLABUS.forEach(cat => {
            if(headers[i]) {
                const cpt = Object.values(appData.syllabus[cat.subject] || {}).filter(Boolean).length;
                const pct = Math.round((cpt / cat.topics.length) * 100);
                headers[i].querySelector('.subj-progress-text').textContent = `%${pct}`;
            }
            i++;
        });
    }, 50);
}

window.toggleSyllabusTopic = function(subj, topic, isChecked) {
    if (!appData.syllabus[subj]) appData.syllabus[subj] = {};
    appData.syllabus[subj][topic] = isChecked;
    
    saveData();
    renderSyllabus(); 
    
    if (isChecked) {
        playSound('complete');
        addPoints(5); 
        showToast(`Tebrikler! "${topic}" konusu tamamlandı.`, true);
        if (Math.random() > 0.7) confetti(40); // Rastgele konfeti
    } else {
        addPoints(-5); // İptal ederse puanı geri al
    }
};

/* --- 9. FLASHCARDS (BİLGİ KARTLARI) --- */
let currentCardIndex = 0;
let dueCards = [];

function setupFlashcards() {
    const btnSave = document.getElementById('btnSaveCard');
    if (!btnSave) return;

    if (!appData.flashcards) appData.flashcards = [];

    btnSave.addEventListener('click', () => {
        const subj = document.getElementById('cardSubject').value;
        const front = document.getElementById('cardFront').value.trim();
        const back = document.getElementById('cardBack').value.trim();

        if (!front || !back) {
            showToast('Lütfen ön ve arka yüzü doldurun.', false);
            return;
        }

        appData.flashcards.push({
            id: genId(),
            subject: subj,
            front: front,
            back: back,
            level: 0,
            nextReview: new Date().toISOString().split('T')[0] // Bugün başlasın
        });

        saveData();
        addPoints(2);
        showToast('🃏 Kart eklendi!', true);
        playSound('complete');

        document.getElementById('cardFront').value = '';
        document.getElementById('cardBack').value = '';
        document.getElementById('cardFront').focus();

        renderFlashcards();
    });

    const fcCard = document.getElementById('fcCard');
    if (fcCard) {
        fcCard.addEventListener('click', () => {
            fcCard.classList.toggle('fc-flipped');
            const actions = document.getElementById('fcActions');
            if (fcCard.classList.contains('fc-flipped')) {
                actions.style.opacity = '1';
                actions.style.pointerEvents = 'all';
            } else {
                actions.style.opacity = '0';
                actions.style.pointerEvents = 'none';
            }
        });
    }

    document.getElementById('btnCardFail')?.addEventListener('click', () => handleCardAction(0));
    document.getElementById('btnCardSemi')?.addEventListener('click', () => handleCardAction(1));
    document.getElementById('btnCardPass')?.addEventListener('click', () => handleCardAction(2));
}

function renderFlashcards() {
    if (!appData.flashcards) appData.flashcards = [];
    document.getElementById('fcTotalStat').textContent = appData.flashcards.length;

    const today = new Date().toISOString().split('T')[0];
    dueCards = appData.flashcards.filter(c => c.nextReview <= today);

    const activeContainer = document.getElementById('activeCardContainer');
    const emptyState = document.getElementById('fcEmptyState');

    if (dueCards.length > 0) {
        activeContainer.style.display = 'block';
        emptyState.style.display = 'none';
        currentCardIndex = 0;
        showCurrentCard();
    } else {
        activeContainer.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

function showCurrentCard() {
    if (currentCardIndex >= dueCards.length) {
        renderFlashcards(); // Yeniden kontrol et, bitmiş mi
        return;
    }

    const card = dueCards[currentCardIndex];
    document.getElementById('fcSubj').textContent = card.subject;
    document.getElementById('fcQuestion').textContent = card.front;
    document.getElementById('fcAnswer').textContent = card.back;

    const fcCard = document.getElementById('fcCard');
    fcCard.classList.remove('fc-flipped');
    
    const actions = document.getElementById('fcActions');
    actions.style.opacity = '0';
    actions.style.pointerEvents = 'none';
}

function handleCardAction(status) {
    // status: 0 (Failed), 1 (Hard), 2 (Easy)
    if (currentCardIndex >= dueCards.length) return;
    const cardId = dueCards[currentCardIndex].id;
    const card = appData.flashcards.find(c => c.id === cardId);
    
    if (status === 0) {
        card.level = 0;
    } else if (status === 1) {
        card.level = Math.max(1, card.level);
    } else if (status === 2) {
        card.level += 1;
    }

    // Calculate next review (Aralıklı Tekrar Mantığı)
    const nextDate = new Date();
    let addDays = 1; // Default
    if (card.level === 1) addDays = 2;
    else if (card.level === 2) addDays = 4;
    else if (card.level === 3) addDays = 8;
    else if (card.level >= 4) addDays = 30; // Çok iyi öğrenilmiş

    nextDate.setDate(nextDate.getDate() + addDays);
    card.nextReview = nextDate.toISOString().split('T')[0];

    saveData();
    
    if (status > 0) addPoints(1); // Bildiği zaman Puan ver
    if (status === 2 && Math.random() > 0.8) confetti(20);

    // Karta animasyon efekti (Silinme ya da sağa/sola)
    const fcCard = document.getElementById('fcCard');
    fcCard.style.transform = status === 0 ? 'translateX(-100px) rotateY(180deg) opacity(0)' : 'translateX(100px) rotateY(180deg) opacity(0)';
    
    setTimeout(() => {
        fcCard.style.transition = 'none';
        fcCard.style.transform = 'translateX(0) rotateY(0) opacity(1)';
        
        currentCardIndex++;
        setTimeout(() => {
            fcCard.style.transition = 'transform 0.6s';
            showCurrentCard();
        }, 50);
    }, 300);
}
