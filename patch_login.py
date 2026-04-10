import sys

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update STORAGE_KEY
text = text.replace("const STORAGE_KEY = 'kpss_tracker_v2';", "let STORAGE_KEY = 'kpss_tracker_v2';\\nconst VALID_USERS = { 'emirhan@kpss.com': '1234', 'test@kpss.com': '123' };")

# 2. Update DOMContentLoaded
start_init = text.find("document.addEventListener('DOMContentLoaded', () => {")
end_init = text.find("});\\n\\n/* --- VERİ YÖNETİMİ --- */")

if start_init == -1 or end_init == -1:
    print("DOMContentLoaded not found")
    sys.exit(1)

new_init = """document.addEventListener('DOMContentLoaded', () => {
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
    setupFlashcards();"""

text = text[:start_init] + new_init + text[end_init:]

# Wait, loadData still searches keysToCheck. I need to update loadData as well to NOT pull from 'kpss_tracker_v2' unless it is empty and maybe we WANT to migrate. But if we migrate, user 1 and user 2 will both get the same old local data.
# Better to just look at STORAGE_KEY only.
loadData_start = text.find("function loadData() {")
loadData_end = text.find("    // Yeni model default değerleri")

new_loadData = """function loadData() {
    appData = null;

    let raw = localStorage.getItem(STORAGE_KEY);
    appData = raw ? JSON.parse(raw) : null;

    if (!appData) {
        appData = { weekLabel: getCurrentWeekLabel(), days: {} };
    }
"""

text = text[:loadData_start] + new_loadData + text[loadData_end:]

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied")
