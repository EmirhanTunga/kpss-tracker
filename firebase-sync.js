// Firebase Cloud Sync Modülü - KPSS Başarı Rehberi
// Son güncelleme: 11 Nisan 2026
// Firestore API: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=kpss-tracker

const firebaseConfig = {
    apiKey: "AIzaSyA88xSweyh7b3J6tymeB8s84R_G0Y2YLMs",
    authDomain: "kpss-tracker.firebaseapp.com",
    projectId: "kpss-tracker",
    storageBucket: "kpss-tracker.firebasestorage.app",
    messagingSenderId: "747182913175",
    appId: "1:747182913175:web:88302e37f2f58642365bd2",
    measurementId: "G-YWN7TV72BW"
};

let db = null;
window.firebaseSyncActive = false;

// Firebase Başlatma (İlk yüklemede tetiklenir)
try {
    if (firebaseConfig.apiKey !== "BURAYA_API_KEY_GELECEK") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        window.firebaseSyncActive = true;
        window.firebaseDb = db;
        console.log("🔥 Firebase Senkronizasyonu Aktif!");
    } else {
        console.warn("⚠️ Firebase bağlanmadı! Lütfen firebase-sync.js dosyasındaki ayarları doldurun. Sistem çevrimdışı (LocalStorage) çalışıyor.");
    }
} catch (error) {
    console.error("Firebase hata:", error);
}

// Global Firebase Veri Yükleme Fonksiyonu
window.loadFromFirebase = async function (email) {
    if (!db) return false;

    // Yükleniyor durumunu göster
    document.getElementById('loginScreen').querySelector('h1').textContent = "Bulut Eşitleniyor ☁️...";

    try {
        const docRef = db.collection("users").doc(email);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            // Firebase'ten gelen tabloyu LocalStorage'a yaz ve appData'ya geçir
            let cloudData = docSnap.data();
            // Local de var mı? Kontrol yapmıyoruz, her zaman Bulut ezsin çünkü tek doğru o.
            localStorage.setItem(`kpss_tracker_v2_${email}`, JSON.stringify(cloudData));
            console.log("☁ Firebase'den veriler çekildi.");
        } else {
            console.log("☁ Bu e-posta için yeni kayıt oluşturuluyor...");
            // Kullanıcı ilk defa girdiyse boş verisini buluta bas
            setTimeout(() => {
                window.syncToFirebase(email, appData);
            }, 2000);
        }
        return true;
    } catch (error) {
        console.error("Firebase veri çekme başarısız:", error);
        return false;
    }
};

// Global Firebase Veri Gönderme Fonksiyonu
window.syncToFirebase = function (email, updatedData) {
    if (!db || !updatedData) return;

    // Her işlemde Firebase'e yazar
    db.collection("users").doc(email).set(updatedData)
        .then(() => {
            console.log("☁ Bulut güncellendi.");
        })
        .catch((error) => {
            console.error("Bulut güncellenemedi:", error);
        });
};
