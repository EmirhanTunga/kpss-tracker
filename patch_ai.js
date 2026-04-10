const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const startTarget = "function renderAIAdvice() {";
const endTarget = "/* --- SORU TAKİBİ (QUESTIONS TRACKER) --- */";

const startIdx = content.indexOf(startTarget);
const endIdx = content.indexOf(endTarget);

if (startIdx === -1 || endIdx === -1) {
    console.error("Index not found.");
    process.exit(1);
}

const newLogic = \`function renderAIAdvice() {
    const container = document.getElementById('aiAdviceContent');
    if (!container) return;

    const tips = [];
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
            if (stats.total >= 15) {
                const acc = Math.round((stats.correct / stats.total) * 100);
                if (acc < 50) {
                    tips.push({ icon: '⚠️', type: 'warning', title: 'Dikkat! Yanlış Oranı Yüksek', text: \`Son 3 günde <strong>\${subj}</strong> dersinden \${stats.total} soru çözdün fakat başarı oranın %\${acc}. Müfredat sekmesinden zayıf olduğun konuları tespit edip tekrar etmelisin.\` });
                } else if (acc >= 85) {
                    tips.push({ icon: '🌟', type: 'success', title: 'Harika Gidiyorsun', text: \`Son 3 günde <strong>\${subj}</strong> sorularında %\${acc} başarı yakaladın! Bu dersin mantığını oturtmuşsun.\` });
                }
            }
        }
        
        if (totalQ > 150) {
             tips.push({ icon: '🚀', type: 'success', title: 'Tempo Muazzam!', text: \`Son 3 günde toplam \${totalQ} soru çözdün. Sınav maratonunda bu hız sana derece getirir.\` });
        }
    } else {
         tips.push({ icon: '❓', type: 'info', title: 'Soru Çözümü Eksik', text: 'Son 3 gündür sisteme hiç soru çözümü girmemişsin. Pratik yapmak, KPSS\\'de konuyu bilmek kadar önemlidir.' });
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
            tips.push({ icon: '📚', type: 'warning', title: 'İhmal Edilen Ders', text: \`Müfredat listene göre <strong>\${minSubj}</strong> dersine neredeyse hiç başlamamışsın. Haftalık programına acilen eklemelisin.\` });
        }
        if (maxDone > 10) {
            tips.push({ icon: '🏆', type: 'success', title: 'Müfredat Fatihi', text: \`<strong>\${maxSubj}</strong> dersindeki konuların büyük çoğunluğunu bitirmişsin. Artık bol bol branş denemesi çözme vakti.\` });
        }
    } else {
        tips.push({ icon: '📋', type: 'info', title: 'Müfredat Takibi', text: 'Hangi derslerde ilerlediğini yapay zekanın analiz edebilmesi için "Müfredat" sekmesinden bitirdiğin konuları işaretle.' });
    }

    // 3. Deneme Analizi
    const exams = appData.exams || [];
    if (exams.length >= 2) {
        const last = exams[exams.length - 1];
        const prev = exams[exams.length - 2];
        const diff = last.totalNet - prev.totalNet;
        if (diff > 0) {
            tips.push({ icon: '📈', type: 'success', title: 'Deneme Neti Yükseliyor!', text: \`Son denemen öncekine göre <strong>+\${diff.toFixed(1)} net</strong> daha iyi. Yükselen ivmeyi koru!\` });
        } else if (diff <= -5) {
            tips.push({ icon: '📉', type: 'warning', title: 'Deneme Netinde Düşüş', text: \`Son denemede <strong>\${Math.abs(diff).toFixed(1)} net</strong> geriledin. Sınanda stres yönetimini veya süre kullanımını gözden geçirmelisin.\` });
        }
    } else if (exams.length === 0) {
        tips.push({ icon: '📝', type: 'info', title: 'Deneme Sınavı Eksikliği', text: 'Haftalık programına en az 1 deneme eklemelisin ki gelişimini veriyle ölçebilelim.' });
    }

    // 4. Pomodoro Analizi
    const pomo = appData.pomodoro?.totalMins || 0;
    if (pomo > 0 && pomo < 50) {
        tips.push({ icon: '🍅', type: 'info', title: 'Odaklanma Süresi', text: 'Kısa süreli pomodoro yapmışsın. Günlük 3-4 seans hedefine ulaşmak beynini kalıcı öğrenmeye zorlar.' });
    }

    // 5. Seri (Streak)
    const streak = appData.streak?.current || 0;
    if (streak >= 7) {
        tips.push({ icon: '🔥', type: 'success', title: \`\${streak} Günlük Kesintisiz Çalışma!\`, text: 'Muazzam bir istikrar. KPSS\\'yi kazananlar son güne kadar pes etmeyenlerdir.' });
    }

    // Render
    if (tips.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">Yeterli veri toplandığında Sanal Koç tavsiyeleri burada görünecek.</p>';
        return;
    }

    // Biraz karıştır (eğer çok tip varsa rastgele sırayla 3 tane göster)
    const displayTips = tips.sort(() => 0.5 - Math.random()).slice(0, 4);

    container.innerHTML = displayTips.map(tip => \`
        <div class="ai-tip ai-tip-\${tip.type}">
            <div class="ai-tip-icon">\${tip.icon}</div>
            <div class="ai-tip-content">
                <h4>\${tip.title}</h4>
                <p>\${tip.text}</p>
            </div>
        </div>
    \`).join('');
}

\`;

content = content.substring(0, startIdx) + newLogic + content.substring(endIdx);
fs.writeFileSync('app.js', content, 'utf8');
console.log('Successfully patched app.js');
