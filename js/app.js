
// constants & storage keys
// ATARAXIE s4 
// Themes: cyberneon · galaxypixel · midnightgold · hellokitty

const STORAGE_KEY      = 'qcm_med_scores';
const EXAM_STORAGE_KEY = 'ataraxie_exam_history';
const BOOKMARK_KEY     = 'qcm_bookmarks';

function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY)) || []; } catch { return []; }
}
function saveBookmarks(bk) {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bk));
}
function getBookmarkId(mi, smi, ci, qi) {
  return `${mi}_${smi ?? 'n'}_${ci}_${qi}`;
}
function isBookmarked(mi, smi, ci, qi) {
  return getBookmarks().some(b => b.id === getBookmarkId(mi, smi, ci, qi));
}
function toggleBookmark(mi, smi, ci, qi) {
  const bk = getBookmarks();
  const id = getBookmarkId(mi, smi, ci, qi);
  const idx = bk.findIndex(b => b.id === id);
  if (idx >= 0) {
    bk.splice(idx, 1);
  } else {
    const ch = getChapitres(mi, smi)[ci];
    const q  = ch.questions[qi];
    bk.push({ id, mi, smi, ci, qi,
      matiere: getContextNom(mi, smi),
      chapitre: ch.titre,
      question: q.question,
      type: q.type || 'mcq' });
  }
  saveBookmarks(bk);
  const btn = document.getElementById(`bk-btn-${qi}`);
  if (btn) btn.classList.toggle('active', idx < 0);
  updateBookmarkCounter();
}
function updateBookmarkCounter() {
  const count = getBookmarks().length;
  const counter = document.getElementById('bk-float-count');
  if (counter) {
    counter.textContent = count > 0 ? count : '';
    counter.style.display = count > 0 ? 'flex' : 'none';
  }
}


// exam history

function getExamHistory() {
  try { return JSON.parse(localStorage.getItem(EXAM_STORAGE_KEY)) || []; } catch { return []; }
}
function saveExamResult(entry) {
  const h = getExamHistory();
  h.push(entry);
  if (h.length > 200) h.splice(0, h.length - 200);
  localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(h));
}
// global state

let DATA = null;
let currentMatiere = null, currentSousMatiere = null, currentChapitre = null;
let submitted = false;

const THEMES = ['onyx', 'saphir', 'ivoire', 'poudre'];
const LIGHT_THEMES = ['ivoire', 'poudre']; 

// data can go 3 levels deep: matiere → sous-matiere → sous-sous-matiere → chapitres
let currentSubSousMatiere = null;


// data accessors (sous-matières, chapitres, contexte)

function getSousMatiere(mi, smi) {
  return DATA[mi].sous_matieres?.[smi];
}
function getSubSousMatiere(mi, smi, ssmi) {
  return DATA[mi].sous_matieres?.[smi]?.sous_matieres?.[ssmi];
}
function getChapitres(mi, smi) {
  const m = DATA[mi];
  if (!m.sous_matieres) return m.chapitres;
  const sm = m.sous_matieres[smi];
  // 3rd level: sous-sous-matiere
  if (sm.sous_matieres && currentSubSousMatiere !== null) {
    return sm.sous_matieres[currentSubSousMatiere].chapitres;
  }
  return sm.chapitres;
}
function getContextNom(mi, smi) {
  const m = DATA[mi];
  if (!m.sous_matieres) return m.nom;
  const sm = m.sous_matieres[smi];
  if (sm.sous_matieres && currentSubSousMatiere !== null) {
    return sm.sous_matieres[currentSubSousMatiere].nom;
  }
  return sm.nom;
}
function getContextIcon(mi, smi) {
  const m = DATA[mi];
  if (!m.sous_matieres) return m.icon;
  const sm = m.sous_matieres[smi];
  if (sm.sous_matieres && currentSubSousMatiere !== null) {
    return sm.sous_matieres[currentSubSousMatiere].icon || sm.icon || m.icon;
  }
  return sm.icon || m.icon;
}
function getScoreKey(mi, smi, ci) {
  const m = DATA[mi];
  if (!m.sous_matieres) return `${m.nom}__${ci}`;
  const sm = m.sous_matieres[smi];
  if (sm.sous_matieres && currentSubSousMatiere !== null) {
    return `${m.nom}__${sm.nom}__${sm.sous_matieres[currentSubSousMatiere].nom}__${ci}`;
  }
  return `${m.nom}__${sm.nom}__${ci}`;
}


// score storage
function getScores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveScore(key, score, total) {
  const s = getScores();
  if (!s[key]) s[key] = [];
  s[key].push({ score, total, date: new Date().toLocaleDateString('fr-FR') });
  if (s[key].length > 10) s[key] = s[key].slice(-10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
function getBestByKey(key) {
  const s = getScores();
  if (!s[key]?.length) return null;
  return s[key].reduce((b, e) => e.score / e.total > b.score / b.total ? e : b);
}
function getMatiereNbChap(mi) {
  const m = DATA[mi];
  if (!m.sous_matieres) return m.chapitres.length;
  let total = 0;
  m.sous_matieres.forEach(sm => {
    if (sm.sous_matieres) sm.sous_matieres.forEach(ssm => { total += ssm.chapitres.length; });
    else total += sm.chapitres.length;
  });
  return total;
}

// home & navigation

function getMatiereGlobalPct(mi) {
  const m = DATA[mi]; let total = 0, done = 0;
  const addScore = (key) => {
    const b = getBestByKey(key);
    if (b) { total += b.total; done += b.score; }
  };
  if (!m.sous_matieres) {
    m.chapitres.forEach((_, ci) => addScore(`${m.nom}__${ci}`));
  } else {
    m.sous_matieres.forEach((sm, smi) => {
      if (sm.sous_matieres) {
        sm.sous_matieres.forEach((ssm, ssmi) => {
          ssm.chapitres.forEach((_, ci) => addScore(`${m.nom}__${sm.nom}__${ssm.nom}__${ci}`));
        });
      } else {
        sm.chapitres.forEach((_, ci) => addScore(`${m.nom}__${sm.nom}__${ci}`));
      }
    });
  }
  return total > 0 ? Math.round(done / total * 100) : null;
}
// data loading — lazy par matière

async function loadData() {
  try {
    const res = await fetch('data/index.json');
    const idx = await res.json();
    DATA = idx.matieres.map(m => ({ ...m, _loaded: false }));
    buildHome();
    document.body.dataset.page = 'screen-home';
  } catch {
    document.getElementById('screen-home').innerHTML =
      '<p style="padding:60px 32px;color:#e03040;font-family:monospace">Impossible de charger index.json — utilise Live Server</p>';
  }
}

async function loadMatiere(mi) {
  if (!DATA || DATA[mi]._loaded) return;
  const card = document.querySelector(`.subject-card:nth-child(${mi + 1})`);
  if (card) card.classList.add('loading-card');
  try {
    const res  = await fetch(DATA[mi].file);
    const full = await res.json();
    Object.assign(DATA[mi], full, { _loaded: true });
  } finally {
    if (card) card.classList.remove('loading-card');
  }
}
function buildHome() {
  document.body.dataset.page = 'screen-home';
  const grid = document.getElementById('subjects-grid');
  grid.innerHTML = '';
  const countEl = document.getElementById('modules-count');
  if (countEl) countEl.textContent = DATA.length + ' modules';
  DATA.forEach((m, mi) => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-icon-wrap">${String(mi+1).padStart(2,'0')}</div>
      <div class="subject-body">
        <div class="subject-name">${m.nom}</div>
      </div>
      <div class="subject-right"><span class="subject-arrow">→</span></div>`;
    card.addEventListener('click', () => openMatiere(mi));
    grid.appendChild(card);
  });
}

async function openMatiere(mi) {
  currentMatiere = mi; currentSubSousMatiere = null;
  await loadMatiere(mi);
  const m = DATA[mi];
  if (m.sous_matieres) openSousMatieresScreen(mi);
  else { currentSousMatiere = null; openSommaire(mi, null); }
}


function openSousMatieresScreen(mi) {
  const m = DATA[mi];
  document.getElementById('sm-matiere-icon').textContent = '';
  document.getElementById('sm-matiere-titre').textContent = m.nom;
  const grid = document.getElementById('sm-grid');
  grid.innerHTML = '';
  m.sous_matieres.forEach((sm, smi) => {
    // Compute progress
    let t = 0, d = 0;
    const addScore = (key) => { const b = getBestByKey(key); if (b) { t += b.total; d += b.score; } };
    if (sm.sous_matieres) {
      sm.sous_matieres.forEach(ssm => ssm.chapitres.forEach((_, ci) => addScore(`${m.nom}__${sm.nom}__${ssm.nom}__${ci}`)));
    } else {
      sm.chapitres.forEach((_, ci) => addScore(getScoreKeyRaw(m.nom, sm.nom, null, ci)));
    }
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-icon-wrap">${String(smi+1).padStart(2,'0')}</div>
      <div class="subject-body">
        <div class="subject-name">${sm.nom}</div>
      </div>
      <div class="subject-right"><span class="subject-arrow">→</span></div>`;
    card.addEventListener('click', () => {
      currentSousMatiere = smi;
      // If 3-level: open sub-sous-matieres screen
      if (sm.sous_matieres) openSubSousMatieresScreen(mi, smi);
      else { currentSubSousMatiere = null; openSommaire(mi, smi); }
    });
    grid.appendChild(card);
  });
  showScreen('screen-sous-matieres');
}

// (3rd level)
function openSubSousMatieresScreen(mi, smi) {
  const m = DATA[mi];
  const sm = m.sous_matieres[smi];
  document.getElementById('ssm-icon').textContent = '';
  document.getElementById('ssm-titre').textContent = sm.nom;
  document.getElementById('ssm-sub').textContent = `${sm.sous_matieres.length} sous-modules`;
  const grid = document.getElementById('ssm-grid');
  grid.innerHTML = '';
  sm.sous_matieres.forEach((ssm, ssmi) => {
    let t = 0, d = 0;
    ssm.chapitres.forEach((_, ci) => {
      const key = `${m.nom}__${sm.nom}__${ssm.nom}__${ci}`;
      const b = getBestByKey(key); if (b) { t += b.total; d += b.score; }
    });
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <div class="subject-icon-wrap">${String(ssmi+1).padStart(2,'0')}</div>
      <div class="subject-body">
        <div class="subject-name">${ssm.nom}</div>
      </div>
      <div class="subject-right"><span class="subject-arrow">→</span></div>`;
    card.addEventListener('click', () => { currentSubSousMatiere = ssmi; openSommaire(mi, smi); });
    grid.appendChild(card);
  });
  showScreen('screen-sub-sous-matieres');
}

// Helper for score key without currentSubSousMatiere context
function getScoreKeyRaw(mNom, smNom, ssmNom, ci) {
  if (ssmNom) return `${mNom}__${smNom}__${ssmNom}__${ci}`;
  return `${mNom}__${smNom}__${ci}`;
}


// sommaire (chapter list)
function openSommaire(mi, smi) {
  currentMatiere = mi; currentSousMatiere = smi;
  const chapitres = getChapitres(mi, smi);
  document.getElementById('sommaire-icon').textContent = '';
  document.getElementById('sommaire-titre').textContent = getContextNom(mi, smi);
  document.getElementById('sommaire-sub').textContent = `${chapitres.length} chapitres`;
  const list = document.getElementById('chapitres-list');
  list.innerHTML = '';
  chapitres.forEach((ch, ci) => {
    const key = getScoreKey(mi, smi, ci);
    const best = getBestByKey(key);
    const pct = best ? Math.round(best.score / best.total * 100) : null;
    const cls = pct === null ? 'none' : pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low';
    const item = document.createElement('div');
    item.className = `chapitre-item ${best ? 'done' : ''}`;
    item.innerHTML = `
      <div class="chapitre-num">${ci + 1}</div>
      <div class="chapitre-info">
        <div class="chapitre-titre">${ch.titre}</div>
        <div class="chapitre-sub">${ch.questions.length} questions${best ? ' · ' + best.date : ''}</div>
      </div>

      <div class="chapitre-arrow">→</div>`;
    item.addEventListener('click', () => openQuiz(mi, smi, ci));
    list.appendChild(item);
  });
  showScreen('screen-sommaire');
}


// quiz — build & render questions
function openQuiz(mi, smi, ci) {
  currentMatiere = mi; currentSousMatiere = smi; currentChapitre = ci;
  submitted = false;
  const ch = getChapitres(mi, smi)[ci];
  document.getElementById('bc-matiere').textContent = getContextNom(mi, smi);
  document.getElementById('bc-chapitre').textContent = ch.titre;
  buildQuestions(mi, smi, ci);
  showScreen('screen-quiz');
}

function buildQuestions(mi, smi, ci) {
  const ch = getChapitres(mi, smi)[ci];
  const container = document.getElementById('questions-container');
  container.innerHTML = '';
  let lastImg = null;
  let lastCasClinic = null;

  ch.questions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'question-card'; card.id = `card-${qi}`;

    // Cas clinique: full header if new, suite badge if same as previous
    let ccBlock = '';
    const enonce = q.enonce || q.cas_clinique || '';
    if (enonce.startsWith('Cas clinique')) {
      ccBlock = `<div class="cc-header">${enonce}</div>`;
      lastCasClinic = enonce;
    } else if (enonce.startsWith('Appartient')) {
      ccBlock = `<div class="cc-suite">↳ Suite du même cas clinique</div>`;
    } else if (enonce && enonce !== '') {
      if (enonce !== lastCasClinic) {
        ccBlock = `<div class="cc-header">${enonce}</div>`;
        lastCasClinic = enonce;
      } else {
        ccBlock = `<div class="cc-suite">↳ Suite du même cas clinique</div>`;
      }
    } else {
      lastCasClinic = null;
    }

    const imgBlock = (q.image && q.image !== lastImg)
      ? `<div class="q-img-wrap"><img class="q-img" src="${q.image}" alt="Image clinique" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : '';
    if (q.image) lastImg = q.image;

    // Extra images block (array of {src, alt, legende})
    const extraImgsBlock = (q.images && q.images.length)
      ? `<div class="q-extra-imgs">${q.images.map(img =>
          `<figure class="q-figure">
            <img class="q-img" src="${img.src}" alt="${img.alt}" loading="lazy">
            ${img.legende ? `<figcaption class="q-figcaption">${img.legende}</figcaption>` : ''}
          </figure>`).join('')}</div>` : '';

    // Schema block (preformatted ASCII)
    const schemaBlock = q.schema
      ? `<div class="q-schema-wrap"><pre class="q-schema">${q.schema}</pre></div>` : '';

    if (q.type === 'open') {
      // Open / rédactionnel question — AI-corrected
      const bkActive = isBookmarked(mi, smi, ci, qi);
      card.innerHTML = `
        ${ccBlock}${imgBlock}
        <div class="q-num">Question ${qi + 1} / ${ch.questions.length}</div>
        <button class="q-bookmark-btn ${bkActive ? 'active' : ''}" id="bk-btn-${qi}" onclick="toggleBookmark(${mi},${smi ?? null},${ci},${qi})" title="Marque-page"><svg class="bk-icon-svg" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 0 H9 V13 L5 9.5 L1 13 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/></svg></button>
        <div class="q-text">${q.question}</div>
        ${schemaBlock}${extraImgsBlock}
        <div class="ai-input-zone" id="ai-zone-${qi}">
          <textarea
            class="ai-textarea"
            id="ai-textarea-${qi}"
            placeholder="Rédigez votre réponse ici…"
            rows="5"
          ></textarea>
          <div class="ai-btn-row">
            <button class="ai-correct-btn" id="ai-btn-${qi}" onclick="aiCorrectQuestion(${qi})">
              <div class="ai-btn-spinner"></div>
              <span class="ai-btn-text">Corriger avec IA</span>
            </button>
            <button class="btn-reveal ai-reveal-btn" id="ai-reveal-btn-${qi}" onclick="toggleAiModelAnswer(${qi})">
              Réponse modèle
            </button>
          </div>
          <div class="ai-model-answer-inline" id="ai-model-inline-${qi}">${q.reponse || ''}</div>
          <div class="ai-error" id="ai-error-${qi}"></div>
          <div class="ai-result" id="ai-result-${qi}"></div>
        </div>`;
    } else {
      // Standard MCQ question
      const bkActive = isBookmarked(mi, smi, ci, qi);
      const getLetter = i => { const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return i<26?a[i]:a[i%26].repeat(Math.floor(i/26)+1); };
      const opts = q.options.map((opt, oi) => `
        <label class="opt-label" id="opt-${qi}-${oi}">
          <input type="checkbox" name="q-${qi}" value="${oi}">
          <span class="opt-letter">${getLetter(oi)}</span>
          <span class="opt-text">${opt}</span>
        </label>`).join('');
      card.innerHTML = `
        ${ccBlock}${imgBlock}
        <div class="q-num">Question ${qi + 1} / ${ch.questions.length}</div>
        <button class="q-bookmark-btn ${bkActive ? 'active' : ''}" id="bk-btn-${qi}" onclick="toggleBookmark(${mi},${smi ?? null},${ci},${qi})" title="Marque-page"><svg class="bk-icon-svg" viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 0 H9 V13 L5 9.5 L1 13 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/></svg></button>
        <div class="q-text">${q.question}</div>
        <div class="q-hint">Cochez toutes les bonnes réponses</div>
        <div class="options">${opts}</div>
        <div class="q-actions">
          <button class="q-validate-btn" onclick="validateQuestion(${qi})">[ Valider ]</button>
          <button class="q-restart-btn" onclick="restartQuestion(${qi})" title="Recommencer cette question">↺</button>
        </div>
        <div class="q-justification" id="justif-${qi}" style="display:none">
          <div class="q-justif-label">Justification</div>
          <div class="q-justif-text">${q.justification || '<span class="q-justif-empty">Justification à venir.</span>'}</div>
        </div>`;
    }
    container.appendChild(card);
  });
  document.getElementById('score-box').classList.remove('visible');
  document.getElementById('btn-submit').disabled = false;
  updateProgress(0, ch.questions.length);
}

// quiz: open questions
function toggleAnswer(qi) {
  const answerDiv = document.getElementById(`open-answer-${qi}`);
  const btn = document.getElementById(`btn-reveal-${qi}`);
  if (!answerDiv) return;
  const isVisible = answerDiv.classList.contains('open-answer-visible');
  if (isVisible) {
    answerDiv.classList.remove('open-answer-visible');
    if (btn) btn.textContent = 'Voir la réponse';
  } else {
    answerDiv.classList.add('open-answer-visible');
    if (btn) btn.textContent = 'Cacher la réponse';
  }
}

// Keep revealAnswer as alias for submitAll fallback
function revealAnswer(qi) {
  const answerDiv = document.getElementById(`open-answer-${qi}`);
  const btn = document.getElementById(`btn-reveal-${qi}`);
  if (answerDiv) answerDiv.classList.add('open-answer-visible');
  if (btn) btn.textContent = 'Cacher la réponse';
}

function validateOpenQuestion(qi, isCorrect) {
  if (submitted) return;
  const ch = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const card = document.getElementById(`card-${qi}`);
  if (card.classList.contains('validated')) return;
  card.classList.add(isCorrect ? 'correct' : 'wrong', 'validated');
  card.querySelectorAll('.assess-btn').forEach(b => b.disabled = true);
  let badge = card.querySelector('.result-badge');
  if (!badge) { badge = document.createElement('div'); card.appendChild(badge); }
  badge.className = isCorrect ? 'result-badge ok' : 'result-badge err';
  badge.textContent = isCorrect ? 'Bonne réponse' : 'À réviser';
  const total = ch.questions.length;
  const done = ch.questions.filter((_, i) => document.getElementById(`card-${i}`)?.classList.contains('validated')).length;
  updateProgress(done, total);
  if (done === total) submitAll(true);
}

function getLetter2(i) { const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return i<26?a[i]:a[i%26].repeat(Math.floor(i/26)+1); }

function validateQuestion(qi) {
  if (submitted) return;
  const ch = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const q = ch.questions[qi];
  const card = document.getElementById(`card-${qi}`);
  const btn = card.querySelector('.q-validate-btn');
  if (btn.disabled) return;
  const checked = [...document.querySelectorAll(`input[name="q-${qi}"]:checked`)].map(i => parseInt(i.value));
  const corrects = q.reponses;
  q.options.forEach((_, oi) => {
    const lbl = document.getElementById(`opt-${qi}-${oi}`);
    lbl.classList.add('disabled');
    if (corrects.includes(oi)) lbl.classList.add('correct-answer');
    if (checked.includes(oi) && !corrects.includes(oi)) lbl.classList.add('wrong-answer');
  });
  const isCorrect = corrects.length === checked.length && corrects.every(r => checked.includes(r));
  card.classList.add(isCorrect ? 'correct' : 'wrong', 'validated');
  let badge = card.querySelector('.result-badge');
  if (!badge) { badge = document.createElement('div'); card.appendChild(badge); }
  if (isCorrect) {
    badge.className = 'result-badge ok'; badge.textContent = 'Bonne réponse — ' + corrects.map(i => getLetter2(i)).join(', ');
  } else {
    badge.className = 'result-badge err';
    badge.textContent = checked.length === 0
      ? `Sans réponse — Bonne(s) : ${corrects.map(i => getLetter2(i)).join(', ')}`
      : `Incorrect — Bonne(s) : ${corrects.map(i => getLetter2(i)).join(', ')}`;
  }
  btn.disabled = true;
  // Show justification if available
  const justifEl = document.getElementById(`justif-${qi}`);
  if (justifEl) justifEl.style.display = '';
  const total = ch.questions.length;
  const done = ch.questions.filter((_, i) => document.getElementById(`card-${i}`).classList.contains('validated')).length;
  updateProgress(done, total);
  if (done === total) submitAll(true);
}

function restartQuestion(qi) {
  const ch = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const q  = ch.questions[qi];
  const card = document.getElementById(`card-${qi}`);
  card.classList.remove('correct', 'wrong', 'validated');
  const badge = card.querySelector('.result-badge');
  if (badge) badge.remove();
  if (q.type === 'open') {
    // Reset AI open question
    const textarea = document.getElementById(`ai-textarea-${qi}`);
    const btn = document.getElementById(`ai-btn-${qi}`);
    const result = document.getElementById(`ai-result-${qi}`);
    const error = document.getElementById(`ai-error-${qi}`);
    if (textarea) textarea.value = '';
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    if (result) { result.innerHTML = ''; result.classList.remove('visible'); }
    if (error) { error.textContent = ''; error.classList.remove('visible'); }
    card.querySelectorAll('.assess-btn').forEach(b => b.disabled = false);
  } else {
    // Reset MCQ question
    q.options.forEach((_, oi) => {
      const lbl = document.getElementById(`opt-${qi}-${oi}`);
      lbl.classList.remove('disabled', 'correct-answer', 'wrong-answer');
      const cb = lbl.querySelector('input');
      if (cb) cb.checked = false;
    });
    const btn = card.querySelector('.q-validate-btn');
    if (btn) btn.disabled = false;
    const justifEl = document.getElementById(`justif-${qi}`);
    if (justifEl) justifEl.style.display = 'none';
  }
  const total = ch.questions.length;
  const done  = ch.questions.filter((_, i) => document.getElementById(`card-${i}`)?.classList.contains('validated')).length;
  updateProgress(done, total);
  if (submitted) {
    submitted = false;
    document.getElementById('btn-submit').disabled = false;
    document.getElementById('score-box').classList.remove('visible');
  }
}

function submitAll(auto = false) {
  if (submitted) return;
  submitted = true;
  const ch = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const key = getScoreKey(currentMatiere, currentSousMatiere, currentChapitre);
  let score = 0;
  ch.questions.forEach((q, qi) => {
    const card = document.getElementById(`card-${qi}`);
    if (!card.classList.contains('validated')) {
      if (q.type === 'open') {
        // Mark as wrong if not AI-corrected
        validateOpenQuestion(qi, false);
      } else {
        validateQuestion(qi);
      }
    }
    if (card.classList.contains('correct')) score++;
  });
  saveScore(key, score, ch.questions.length);
  const pct = Math.round(score / ch.questions.length * 100);
  document.getElementById('score-num').textContent = `${score} / ${ch.questions.length}`;
  document.getElementById('score-pct').textContent = `Score : ${pct}%`;
  document.getElementById('score-emoji').textContent = getScoreLabel(score, ch.questions.length);
  document.getElementById('score-box').classList.add('visible');
  document.getElementById('btn-submit').disabled = true;
  updateProgress(ch.questions.length, ch.questions.length);
  if (auto) setTimeout(() => document.getElementById('score-box').scrollIntoView({ behavior: 'smooth' }), 300);
}

function resetQuiz() {
  submitted = false;
  buildQuestions(currentMatiere, currentSousMatiere, currentChapitre);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateProgress(answered, total) {
  document.getElementById('progress-fill').style.width = Math.round(answered / total * 100) + '%';
  document.getElementById('progress-text').textContent = `${answered} / ${total}`;
}

// navigation
function goHome()    { buildHome(); showScreen('screen-home'); }
function goBack()    {
  const m = DATA[currentMatiere];
  if (m.sous_matieres) {
    const sm = m.sous_matieres[currentSousMatiere];
    if (sm?.sous_matieres && currentSubSousMatiere !== null) {
      // From sommaire (3rd level) → go back to sub-sous-matieres screen
      currentSubSousMatiere = null;
      openSubSousMatieresScreen(currentMatiere, currentSousMatiere);
    } else {
      openSousMatieresScreen(currentMatiere);
    }
  } else goHome();
}
function goSommaire(){ openSommaire(currentMatiere, currentSousMatiere); }

// stats screen
function openStats() {
  const history = getExamHistory();

  // KPIs
  const total     = history.length;
  const avgScore  = total > 0 ? Math.round(history.reduce((a, e) => a + e.pct, 0) / total) : null;
  const bestScore = total > 0 ? Math.max(...history.map(e => e.pct)) : null;

  document.getElementById('stat-tentatives').textContent = total;
  document.getElementById('stat-global').textContent     = avgScore !== null ? avgScore + '%' : '—';
  document.getElementById('stat-chapitres').textContent  = bestScore !== null ? bestScore + '%' : '—';

  // List: one card per theme used
  const list = document.getElementById('stats-modules-list');
  list.innerHTML = '';

  if (total === 0) {
    list.innerHTML = '<p style="color:var(--text2);font-family:DM Mono,monospace;padding:24px 0">Aucun examen effectué — lance un Exam Mode pour voir tes stats ici.</p>';
    showScreen('screen-stats');
    return;
  }

  // Group by themeId
  const byTheme = {};
  history.forEach(e => {
    if (!byTheme[e.themeId]) byTheme[e.themeId] = [];
    byTheme[e.themeId].push(e);
  });

  Object.entries(byTheme).forEach(([themeId, entries]) => {
    const theme    = EXAM_THEMES.find(t => t.id === themeId);
    const name     = theme?.name || themeId;
    const avgPct   = Math.round(entries.reduce((a, e) => a + e.pct, 0) / entries.length);
    const bestPct  = Math.max(...entries.map(e => e.pct));
    const lastDate = entries[entries.length - 1].date;
    const cls      = bestPct >= 80 ? 'high' : bestPct >= 50 ? 'mid' : 'low';

    const card = document.createElement('div');
    card.className = 'stats-module-card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="smc-icon">—</div>
      <div class="smc-body">
        <div class="smc-name">${name}</div>
        <div class="smc-sub" style="font-family:DM Mono,monospace;font-size:.65rem;color:var(--text2);margin-bottom:4px">
          ${entries.length} examen${entries.length > 1 ? 's' : ''} · dernier : ${lastDate}
        </div>
        <div class="smc-bar-wrap"><div class="smc-bar ${cls}" style="width:${avgPct}%"></div></div>
      </div>
      <div class="smc-right">
        <div class="smc-pct ${cls}">${avgPct}%</div>
        <div class="smc-arrow">→ Détail</div>
      </div>`;
    card.addEventListener('click', () => openStatsDetailExam(themeId));
    list.appendChild(card);
  });

  showScreen('screen-stats');
}

function openStatsDetailExam(themeId) {
  const history = getExamHistory().filter(e => e.themeId === themeId);
  const theme   = EXAM_THEMES.find(t => t.id === themeId);
  const name    = theme?.name || themeId;
  const avgPct  = Math.round(history.reduce((a, e) => a + e.pct, 0) / history.length);

  document.getElementById('stats-detail-title').textContent = name;
  document.getElementById('stats-detail-sub').textContent   = `${history.length} examen${history.length > 1 ? 's' : ''} · Score moyen : ${avgPct}%`;

  const container = document.getElementById('stats-detail-container');
  container.innerHTML = '';

  // History table
  const table = document.createElement('div');
  table.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:8px';

  history.slice().reverse().forEach((e, i) => {
    const cls = e.pct >= 80 ? 'high' : e.pct >= 50 ? 'mid' : 'low';
    const row = document.createElement('div');
    row.className = 'stats-ch-row';
    row.innerHTML = `
      <div class="stats-ch-info">
        <div class="stats-ch-name">Examen #${history.length - i}</div>
        <div class="stats-ch-sub">${e.date} · ${e.correct}/${e.total} correctes ·  ${e.time}</div>
        <div class="stats-ch-mini"><div class="stats-ch-mini-fill ${cls}" style="width:${e.pct}%"></div></div>
      </div>
      <div class="stats-ch-pct ${cls}">${e.pct}%</div>`;
    table.appendChild(row);
  });

  container.appendChild(table);
  showScreen('screen-stats-detail');
}

function openStatsDetail(mi) {
  const m = DATA[mi]; const s = getScores();
  const pct = getMatiereGlobalPct(mi);
  document.getElementById('stats-detail-title').textContent = m.nom;
  document.getElementById('stats-detail-sub').textContent = pct !== null ? `Score moyen : ${pct}%` : 'Aucune tentative';
  const container = document.getElementById('stats-detail-container');
  container.innerHTML = '';
  function addRow(ch, key, parentEl) {
    const best = getBestByKey(key);
    const p = best ? Math.round(best.score / best.total * 100) : null;
    const tries = s[key] ? s[key].length : 0;
    const cls = p === null ? 'none' : p >= 80 ? 'high' : p >= 50 ? 'mid' : 'low';
    const row = document.createElement('div'); row.className = 'stats-ch-row';
    row.innerHTML = `
      <div class="stats-ch-info">
        <div class="stats-ch-name">${ch.titre}</div>
        <div class="stats-ch-sub">${tries} tentative${tries !== 1 ? 's' : ''}${best ? ' · ' + best.date : ''}</div>
        <div class="stats-ch-mini"><div class="stats-ch-mini-fill ${cls}" style="width:${p ?? 0}%"></div></div>
      </div>
      <div class="stats-ch-pct ${cls}">${p !== null ? p + '%' : '—'}</div>`;
    parentEl.appendChild(row);
  }
  if (m.sous_matieres) {
    m.sous_matieres.forEach((sm, smi) => {
      if (sm.sous_matieres) {
        // 3-level: show each sous-sous-matière as a block
        sm.sous_matieres.forEach((ssm, ssmi) => {
          let smT = 0, smD = 0;
          ssm.chapitres.forEach((_, ci) => {
            const key = `${m.nom}__${sm.nom}__${ssm.nom}__${ci}`;
            const b = getBestByKey(key); if (b) { smT += b.total; smD += b.score; }
          });
          const smPct = smT > 0 ? Math.round(smD / smT * 100) : null;
          const block = document.createElement('div'); block.className = 'stats-detail-block';
          const hdr = document.createElement('div'); hdr.className = 'stats-detail-header';
          hdr.innerHTML = `<span>${ssm.icon || sm.icon || ''} ${sm.nom} — ${ssm.nom}</span><span>${smPct !== null ? smPct + '%' : '—'}</span>`;
          block.appendChild(hdr);
          const sec = document.createElement('div'); sec.className = 'stats-sm-section';
          ssm.chapitres.forEach((ch, ci) => addRow(ch, `${m.nom}__${sm.nom}__${ssm.nom}__${ci}`, sec));
          block.appendChild(sec); container.appendChild(block);
        });
      } else {
        let smT = 0, smD = 0;
        sm.chapitres.forEach((_, ci) => { const b = getBestByKey(`${m.nom}__${sm.nom}__${ci}`); if (b) { smT += b.total; smD += b.score; } });
        const smPct = smT > 0 ? Math.round(smD / smT * 100) : null;
        const block = document.createElement('div'); block.className = 'stats-detail-block';
        const hdr = document.createElement('div'); hdr.className = 'stats-detail-header';
        hdr.innerHTML = `<span>${sm.icon || ''} ${sm.nom}</span><span>${smPct !== null ? smPct + '%' : '—'}</span>`;
        block.appendChild(hdr);
        const sec = document.createElement('div'); sec.className = 'stats-sm-section';
        sm.chapitres.forEach((ch, ci) => addRow(ch, `${m.nom}__${sm.nom}__${ci}`, sec));
        block.appendChild(sec); container.appendChild(block);
      }
    });
  } else {
    const block = document.createElement('div'); block.className = 'stats-detail-block';
    const hdr = document.createElement('div'); hdr.className = 'stats-detail-header';
    hdr.innerHTML = `<span>${m.icon || ''} ${m.nom}</span><span>${pct !== null ? pct + '%' : '—'}</span>`;
    block.appendChild(hdr);
    const sec = document.createElement('div'); sec.className = 'stats-sm-section';
    m.chapitres.forEach((ch, ci) => addRow(ch, getScoreKey(mi, null, ci), sec));
    block.appendChild(sec); container.appendChild(block);
  }
  showScreen('screen-stats-detail');
}

function clearStats() {
  if (confirm("Effacer tout l'historique des examens ?")) {
    localStorage.removeItem(EXAM_STORAGE_KEY);
    openStats();
  }
}


// bookmarks screen
function openBookmarksScreen() {
  const bk = getBookmarks();
  const container = document.getElementById('bookmarks-list');
  const countEl   = document.getElementById('bk-count');
  if (countEl) countEl.textContent = bk.length + ' question' + (bk.length !== 1 ? 's' : '');
  container.innerHTML = '';

  if (bk.length === 0) {
    container.innerHTML = `<div class="bk-empty">
      <div class="bk-empty-icon"></div>
      <p>Aucune question bookmarkée.<br>Clique sur l'icône marque-page dans une question pour la sauvegarder ici.</p>
    </div>`;
    showScreen('screen-bookmarks');
    return;
  }

  // Group by matière + chapitre
  const groups = {};
  bk.forEach(b => {
    const key = `${b.matiere} › ${b.chapitre}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  });

  Object.entries(groups).forEach(([label, items]) => {
    const group = document.createElement('div');
    group.className = 'bk-group';
    group.innerHTML = `<div class="bk-group-label">${label}</div>`;
    items.forEach(b => {
      const card = document.createElement('div');
      card.className = 'bk-card';
      card.innerHTML = `
        <div class="bk-card-text">${b.question}</div>
        <div class="bk-card-actions">
          <button class="bk-goto-btn" onclick="goToBookmark('${b.id}')">→ Aller à la question</button>
          <button class="bk-remove-btn" onclick="removeBookmark('${b.id}', this)">Retirer</button>
        </div>`;
      group.appendChild(card);
    });
    container.appendChild(group);
  });

  showScreen('screen-bookmarks');
}

function goToBookmark(id) {
  const bk = getBookmarks().find(b => b.id === id);
  if (!bk) return;
  openQuiz(bk.mi, bk.smi, bk.ci);
  // Scroll to question after render
  setTimeout(() => {
    const card = document.getElementById(`card-${bk.qi}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

function removeBookmark(id, btnEl) {
  const bk = getBookmarks().filter(b => b.id !== id);
  saveBookmarks(bk);
  updateBookmarkCounter();
  const card = btnEl.closest('.bk-card');
  if (card) {
    card.style.animation = 'bkFadeOut .2s steps(4) forwards';
    setTimeout(() => {
      const group = card.closest('.bk-group');
      card.remove();
      if (group && group.querySelectorAll('.bk-card').length === 0) group.remove();
      const countEl = document.getElementById('bk-count');
      const remaining = getBookmarks().length;
      if (countEl) countEl.textContent = remaining + ' question' + (remaining !== 1 ? 's' : '');
      if (remaining === 0) openBookmarksScreen();
    }, 250);
  }
}

function clearBookmarks() {
  if (confirm('Supprimer tous les marque-pages ?')) {
    localStorage.removeItem(BOOKMARK_KEY);
    updateBookmarkCounter();
    openBookmarksScreen();
  }
}

// screen helpers
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.body.dataset.page = id;
  // Pac-man strip only on home screen
  const strip = document.querySelector('.pacman-strip');
  if (strip) strip.style.display = (id === 'screen-home') ? '' : 'none';
  // Bookmark float btn only on home screen
  const bkBtn = document.getElementById('bk-float-btn');
  if (bkBtn) bkBtn.style.display = (id === 'screen-exam-q' || id === 'screen-exam-setup' || id === 'screen-exam-results') ? 'none' : '';
  // Nav: hide in quiz and exam question screens
  const nav = document.querySelector('.nav-wrapper');
  const noNav = id === 'screen-quiz' || id === 'screen-exam-q';
  if (nav) nav.classList.toggle('quiz-mode', noNav);
  // Float sommaire only in regular quiz
  const floatSomm = document.getElementById('float-sommaire');
  if (floatSomm) floatSomm.style.display = (id === 'screen-quiz') ? 'block' : 'none';
  // Feedback float: hide during exam question
  const feedbackFloat = document.getElementById('feedback-float');
  if (feedbackFloat) feedbackFloat.style.display = (id === 'screen-exam-q') ? 'none' : '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function getScoreLabel(s, t) {
  const r = s / t;
  if (r === 1)  return '[ PERFECT ]';
  if (r >= .8)  return '[ EXCELLENT ]';
  if (r >= .6)  return '[ BIEN ]';
  if (r >= .4)  return '[ PASSABLE ]';
  return '[ CONTINUE ]';
}

// font size
const FS_STEPS = [
  { key:'XS', qText:'.85rem',  opt:'.82rem', lineH:'1.75' },
  { key:'S',  qText:'.95rem',  opt:'.88rem', lineH:'1.82' },
  { key:'M',  qText:'1.05rem', opt:'.95rem', lineH:'1.90' },
  { key:'L',  qText:'1.18rem', opt:'1.04rem',lineH:'1.96' },
  { key:'XL', qText:'1.32rem', opt:'1.14rem',lineH:'2.05' },
];
let fsIndex = parseInt(localStorage.getItem('qcm_fs') || '2');
function applyFontSize() {
  const step = FS_STEPS[fsIndex];
  document.documentElement.style.setProperty('--quiz-q-size',   step.qText);
  document.documentElement.style.setProperty('--quiz-opt-size', step.opt);
  document.documentElement.style.setProperty('--quiz-line-h',   step.lineH);
  const el = document.getElementById('fs-val'); if (el) el.textContent = step.key;
  const fd = document.getElementById('fs-down'); if (fd) fd.disabled = (fsIndex === 0);
  const fu = document.getElementById('fs-up');   if (fu) fu.disabled = (fsIndex === FS_STEPS.length - 1);
  localStorage.setItem('qcm_fs', fsIndex);
}
function changeFontSize(dir) { fsIndex = Math.max(0, Math.min(FS_STEPS.length - 1, fsIndex + dir)); applyFontSize(); }

// theme
function setTheme(t) {
  if (!THEMES.includes(t)) t = 'onyx';
  document.body.setAttribute('data-theme', t);
  localStorage.setItem('qcm_theme', t);
  document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  const rabbit = document.querySelector('.hero-rabbit');
  if (rabbit) {
    const img = new Image();
    img.onload  = () => { rabbit.src = `img/rabbit_${t}.png`; };
    img.onerror = () => { rabbit.src = `img/rabbit_cyberneon.png`; };
    img.src = `img/rabbit_${t}.png`;
  }
}

// pac-man strip animation
// Candy dimensions
const CANDY_W  = 72;    
const CANDY_H  = 50;    
const CANDY_TW = 11;    
const CANDY_GAP = 38; 

// Pac-man state
let _pacX    = -320;
let _pacRAF  = null;
let _pacTime = 0;

function getCSSVar(v) {
  return getComputedStyle(document.body).getPropertyValue(v).trim();
}

function drawCandy(ctx, cx, cy, cw, ch, tw, accent, accent2, accent3, surface, border, isLight) {
  const hw = cw / 2, hh = ch / 2;

  // Wrapper twist LEFT
  const wlx = cx - hw;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(wlx,      cy - 4);
  ctx.lineTo(wlx - tw, cy - hh + 6);
  ctx.lineTo(wlx - tw, cy + hh - 6);
  ctx.lineTo(wlx,      cy + 4);
  ctx.closePath();
  ctx.fill();
  // Stripe on wrapper
  ctx.fillStyle = accent2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(wlx - 2,       cy - 2);
  ctx.lineTo(wlx - tw * .6, cy - hh + 10);
  ctx.lineTo(wlx - tw * .6 - 4, cy - hh + 10);
  ctx.lineTo(wlx - 6,       cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // Twist knot (dark dot)
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(wlx, cy, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Wrapper twist RIGHT
  const wrx = cx + hw;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(wrx,      cy - 4);
  ctx.lineTo(wrx + tw, cy - hh + 6);
  ctx.lineTo(wrx + tw, cy + hh - 6);
  ctx.lineTo(wrx,      cy + 4);
  ctx.closePath();
  ctx.fill();
  // Stripe on wrapper
  ctx.fillStyle = accent2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(wrx + 2,       cy - 2);
  ctx.lineTo(wrx + tw * .6, cy - hh + 10);
  ctx.lineTo(wrx + tw * .6 + 4, cy - hh + 10);
  ctx.lineTo(wrx + 6,       cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // Twist knot
  ctx.fillStyle = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(wrx, cy, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Oval candy body
  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  const shine = ctx.createRadialGradient(cx - hw * .3, cy - hh * .35, 2, cx, cy, hw);
  shine.addColorStop(0, isLight ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.12)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
  ctx.fill();

  // Border ellipse stroke
  ctx.strokeStyle = border;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, hw - 1, hh - 1, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = isLight ? 0.12 : 0.08;
  ctx.fillStyle = accent2;
  for (let sx = cx - hw - hh; sx < cx + hw + hh; sx += 18) {
    ctx.beginPath();
    ctx.moveTo(sx,          cy - hh);
    ctx.lineTo(sx + hh * 2, cy + hh);
    ctx.lineTo(sx + hh * 2 + 8, cy + hh);
    ctx.lineTo(sx + 8,      cy - hh);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // TEXT
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '7px "Press Start 2P", monospace';
  // Top line "SEMESTRE"
  ctx.fillStyle = isLight ? accent : accent2;
  ctx.fillText('SEMESTRE', cx, cy - 9);
  // Bottom line "VALIDÉ"
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = isLight ? border : accent3;
  ctx.fillText('VALID\u00C9', cx, cy + 10);
}

function initPacCanvas() {
  const canvas = document.getElementById('pac-canvas');
  if (!canvas) return;
  if (_pacRAF) { cancelAnimationFrame(_pacRAF); _pacRAF = null; }

  const SH    = 100;
  const GY    = SH - 10;   
  const R     = 36;          // pac-man radius
  const SPEED = 2.0;

  function resize() {
    canvas.width  = canvas.parentElement ? canvas.parentElement.offsetWidth : window.innerWidth;
    canvas.height = SH;
  }
  resize();
  window.addEventListener('resize', resize);

  // Total x-width of candy including wrappers
  const TOTAL_CANDY_W = CANDY_W + CANDY_TW * 2;

  function frame(t) {
    _pacTime = t;
    const W = canvas.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) { _pacRAF = requestAnimationFrame(frame); return; }

    _pacX += SPEED;
    const resetAt = W + TOTAL_CANDY_W + CANDY_GAP + R * 2 + 60;
    if (_pacX > resetAt) _pacX = -(TOTAL_CANDY_W + CANDY_GAP + R * 2 + 60);

    // Colors
    const theme   = document.body.getAttribute('data-theme') || 'cyberneon';
    const isLight = LIGHT_THEMES.includes(theme);
    const bg2     = getCSSVar('--bg2');
    const accent  = getCSSVar('--accent');
    const accent2 = getCSSVar('--accent2');
    const accent3 = getCSSVar('--accent3');
    const border  = getCSSVar('--border');
    const surface = getCSSVar('--surface');
    const ground  = getCSSVar('--strip-ground');
    const pacCol  = getCSSVar('--pac-color');
    const pacEye  = getCSSVar('--pac-eye');

    const dot = getCSSVar('--dot');

    // Clear
    ctx.fillStyle = bg2;
    ctx.fillRect(0, 0, W, SH);

    // Pixel grid
    ctx.fillStyle = dot;
    for (let gx = 0; gx < W; gx += 8)
      for (let gy = 0; gy < SH; gy += 8)
        ctx.fillRect(gx, gy, 1, 1);

    // Scanlines
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.055)';
    for (let ly = 0; ly < SH; ly += 4) ctx.fillRect(0, ly, W, 1);

    // STARS (pixel art, static positions based on canvas width)
    const starPositions = [
      [0.07, 0.12], [0.18, 0.28], [0.29, 0.10], [0.41, 0.22], [0.53, 0.08],
      [0.62, 0.30], [0.74, 0.14], [0.85, 0.25], [0.93, 0.10], [0.36, 0.35],
      [0.14, 0.38], [0.58, 0.36], [0.78, 0.38], [0.47, 0.18], [0.22, 0.16]
    ];
    ctx.fillStyle = accent2;
    const skyH = GY - 4;
    starPositions.forEach(([fx, fy]) => {
      const sx = Math.round(fx * W);
      const sy = Math.round(fy * skyH);
      if (sy < skyH - 2) {
        // 2px pixel star
        ctx.globalAlpha = 0.55;
        ctx.fillRect(sx, sy, 2, 2);
        // Cross sparkle
        ctx.globalAlpha = 0.25;
        ctx.fillRect(sx - 1, sy + 1, 1, 1);
        ctx.fillRect(sx + 2, sy + 1, 1, 1);
        ctx.fillRect(sx + 1, sy - 1, 1, 1);
        ctx.fillRect(sx + 1, sy + 2, 1, 1);
        ctx.globalAlpha = 1;
      }
    });

    // MOON n stars
    const mx = W - 44, my = 8, mr = 9;
    ctx.fillStyle = accent3;
    ctx.globalAlpha = 0.75;
    for (let dy = -mr; dy <= mr; dy++) {
      for (let dx = -mr; dx <= mr; dx++) {
        if (dx*dx + dy*dy <= mr*mr) {
          const cx2 = dx - 4, cy2 = dy - 2;
          if (cx2*cx2 + cy2*cy2 > (mr-3)*(mr-3)) {
            ctx.fillRect(Math.round(mx + dx), Math.round(my + dy), 1, 1);
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    //GROUND
    ctx.fillStyle = ground;
    ctx.fillRect(0, GY, W, 2);
    for (let gx = 0; gx < W; gx += 20) {
      ctx.fillRect(gx,      GY + 4, 7, 2);
      ctx.fillRect(gx + 12, GY + 7, 4, 1);
    }

    // CANDY
    const candyCX = Math.round(_pacX + R + CANDY_GAP + CANDY_TW + CANDY_W / 2);
    const candyCY = GY - R;   // candy center at same height as pac-man center (mouth level)
    const candyTop = candyCY - CANDY_H / 2;

    const candyVisible = candyCX + CANDY_W / 2 + CANDY_TW > -10 && candyCX - CANDY_W / 2 - CANDY_TW < W + 10;
    if (candyVisible) {
      drawCandy(ctx, candyCX, candyCY, CANDY_W, CANDY_H, CANDY_TW, accent, accent2, accent3, surface, border, isLight);
    }

    // PAC-MAN
    const PX = Math.round(_pacX);
    const PY = GY - R;

    if (PX + R > -10 && PX - R < W + 10) {
      const mouthAngle = Math.max(0.04, Math.abs(Math.cos(_pacTime * 0.006)) * 0.38 * Math.PI);

      ctx.save();
      ctx.beginPath();
      ctx.arc(PX, PY, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = pacCol;
      ctx.beginPath();
      ctx.moveTo(PX, PY);
      ctx.arc(PX, PY, R, mouthAngle, Math.PI * 2 - mouthAngle, false);
      ctx.closePath();
      ctx.fill();
      const eyeAngle = -Math.PI * 0.62;  // ≈ -112° = upper-left quadrant
      const eyeR     = R * 0.46;
      const eyeX = Math.round(PX + Math.cos(eyeAngle) * eyeR);
      const eyeY = Math.round(PY + Math.sin(eyeAngle) * eyeR);
      ctx.fillStyle = pacEye;
      ctx.fillRect(eyeX - 3, eyeY - 3, 6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(eyeX + 1, eyeY - 2, 2, 2);

      ctx.restore(); 
    }

    _pacRAF = requestAnimationFrame(frame);
  }

  _pacRAF = requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', () => {
  let saved = localStorage.getItem('qcm_theme') || 'onyx';
  // Migrate old theme name
  if (saved === 'icemedical' || saved === 'cyberneon' || saved === 'noir') saved = 'onyx';
  if (saved === 'galaxypixel' || saved === 'minuit') saved = 'saphir';
  if (saved === 'midnightgold' || saved === 'ivoire_old') saved = 'ivoire';
  if (saved === 'sakura' || saved === 'bordeaux') saved = 'poudre';
  if (saved === 'bw' || saved === 'earth') saved = 'onyx';
  setTheme(saved);
  fsIndex = parseInt(localStorage.getItem('qcm_fs') ?? '2');
  applyFontSize();

  document.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.t);
    if (_pacRAF) cancelAnimationFrame(_pacRAF);
    _pacX = -320;
    initPacCanvas();
    document.getElementById('theme-dropdown-panel')?.classList.remove('open');
  }));

  // Theme dropdown toggle (mobile < 480px)
  const dropBtn   = document.getElementById('theme-dropdown-btn');
  const dropPanel = document.getElementById('theme-dropdown-panel');
  if (dropBtn && dropPanel) {
    dropBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropPanel.classList.toggle('open');
    });
    document.addEventListener('click', () => dropPanel.classList.remove('open'));
    dropPanel.addEventListener('click', e => e.stopPropagation());
  }


  loadData();
  initPacCanvas();
  updateBookmarkCounter();

  // Keyboard shortcut: Enter → valider en exam mode
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const examScreen = document.getElementById('screen-exam-q');
    if (!examScreen?.classList.contains('active')) return;
    if (document.activeElement?.tagName === 'TEXTAREA') return;
    const btn = document.getElementById('exam-validate-btn');
    if (btn && !btn.disabled) {
      btn.classList.add('key-flash');
      btn.addEventListener('animationend', () => btn.classList.remove('key-flash'), { once: true });
      validateExamQuestion();
    }
  });
});

// feedback panel

let _feedbackOpen = false;
let _feedbackImages = []; // { file, dataUrl }

function toggleFeedbackPanel() {
  _feedbackOpen = !_feedbackOpen;
  const panel = document.getElementById('feedback-panel');
  const float = document.getElementById('feedback-float');
  if (_feedbackOpen) {
    panel.classList.add('open');
    float.classList.add('panel-open');
    updateFeedbackContext();
  } else {
    panel.classList.remove('open');
    float.classList.remove('panel-open');
  }
}

function updateFeedbackContext() {
  const ctx = document.getElementById('feedback-context');
  if (!ctx) return;

  // Detect active screen
  const screens = document.querySelectorAll('.screen.active');
  let screenId = screens.length ? screens[screens.length - 1].id : 'screen-home';

  let pageLabel = 'Accueil';
  let questionLabel = '';

  if (screenId === 'screen-quiz') {
    // Get chapter title
    const chTitre = document.getElementById('bc-chapitre')?.textContent || '';
    const matTitre = document.getElementById('bc-matiere')?.textContent || '';
    pageLabel = `Quiz › ${matTitre} › ${chTitre}`;
    // Try to detect last focused/visible question card
    const cards = document.querySelectorAll('.question-card');
    let lastVisible = null;
    cards.forEach(c => {
      const rect = c.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) lastVisible = c;
    });
    if (lastVisible) {
      const qnum = lastVisible.querySelector('.q-num')?.textContent || '';
      const qtext = lastVisible.querySelector('.q-text')?.textContent?.slice(0, 60) || '';
      questionLabel = `${qnum} — ${qtext}${qtext.length >= 60 ? '…' : ''}`;
    }
  } else if (screenId === 'screen-sommaire') {
    const titre = document.getElementById('sommaire-titre')?.textContent || '';
    pageLabel = `Chapitres › ${titre}`;
  } else if (screenId === 'screen-sous-matieres') {
    const titre = document.getElementById('sm-matiere-titre')?.textContent || '';
    pageLabel = `Sous-modules › ${titre}`;
  } else if (screenId === 'screen-stats') {
    pageLabel = 'Statistiques';
  }

  ctx.innerHTML = `<span>Page :</span> ${pageLabel}`
    + (questionLabel ? `<br><span>Question :</span> ${questionLabel}` : '');
}

function previewFeedbackImages(input) {
  const preview = document.getElementById('fb-img-preview');
  const files = Array.from(input.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const idx = _feedbackImages.push({ file, dataUrl }) - 1;
      const wrap = document.createElement('div');
      wrap.className = 'img-thumb-wrap';
      wrap.dataset.idx = idx;
      wrap.innerHTML = `<img src="${dataUrl}" alt=""><button class="img-remove" onclick="removeFeedbackImage(${idx})"></button>`;
      preview.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
  input.value = ''; // reset so same file can be re-added
}

function removeFeedbackImage(idx) {
  _feedbackImages[idx] = null;
  const wrap = document.querySelector(`.img-thumb-wrap[data-idx="${idx}"]`);
  if (wrap) wrap.remove();
}

async function submitFeedback() {
  const nom     = document.getElementById('fb-nom').value.trim() || 'Anonyme';
  const message = document.getElementById('fb-message').value.trim();
  const ctx     = document.getElementById('feedback-context').textContent;
  const btn     = document.getElementById('fb-submit-btn');
  const success = document.getElementById('fb-success');

  if (!message) {
    document.getElementById('fb-message').focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = '[ Envoi… ]';

  // Multi-webhook round-robin (ajoute autant de webhooks que tu veux)
  const WEBHOOKS = [
    'https://discord.com/api/webhooks/1481632946258579598/ePAtM1pr9zo52up3Bg9c664IEnPABdgX5557ETJKDAMsK4rZ2lydvITDxCYSLr9D_583',
  ].filter(w => !w.includes('_ICI')); // ignore les placeholders

  if (WEBHOOKS.length === 0) {
    console.warn('Aucun webhook Discord configuré.');
    document.getElementById('fb-success').style.display = 'block';
    btn.disabled = false; btn.textContent = '[ Envoyer ]';
    return;
  }

  // Round-robin : alterne entre les webhooks à chaque envoi
  const wIdx = parseInt(localStorage.getItem('_whi') || '0') % WEBHOOKS.length;
  localStorage.setItem('_whi', wIdx + 1);
  const WEBHOOK = WEBHOOKS[wIdx];

  const discordContent = `**Nom :** ${nom}\n**Contexte :** ${ctx.replace(/\n/g, ' | ')}\n**Feedback :** ${message}`;

  // Build multipart form (supports images for Discord)
  const imgs = _feedbackImages.filter(Boolean);
  try {
    if (imgs.length > 0) {
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify({ content: discordContent }));
      imgs.forEach((item, i) => fd.append(`files[${i}]`, item.file, item.file.name));
      await fetch(WEBHOOK, { method: 'POST', body: fd });
    } else {
      await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: discordContent })
      });
    }
  } catch (err) {
    btn.textContent = '[ Envoyer ]';
    btn.disabled = false;
    alert('Erreur lors de l\'envoi — vérifie ta connexion ou le webhook Discord.');
    return;
  }

  // Reset
  document.getElementById('fb-nom').value = '';
  document.getElementById('fb-message').value = '';
  document.getElementById('fb-img-preview').innerHTML = '';
  _feedbackImages = [];
  success.classList.add('visible');
  btn.textContent = '[ Envoyer ]';
  btn.disabled = false;
  setTimeout(() => {
    success.classList.remove('visible');
    toggleFeedbackPanel();
  }, 2200);
}

// cursor glow trail
(function () {
  const trail = document.getElementById('px-trail');
  if (!trail) return;

  let mx = -100, my = -100;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
  });

  // Trail follows with slight delay via rAF
  function animTrail() {
    trail.style.left = mx + 'px';
    trail.style.top  = my + 'px';
    requestAnimationFrame(animTrail);
  }
  animTrail();

  // Click spark effect
  document.addEventListener('mousedown', e => {
    const spark = document.createElement('div');
    spark.style.cssText = `
      position:fixed; left:${e.clientX}px; top:${e.clientY}px;
      width:4px; height:4px;
      background:var(--accent);
      box-shadow: 0 0 8px var(--accent), 0 0 16px var(--accent2);
      pointer-events:none; z-index:99997;
      border-radius:50%;
      transform:translate(-50%,-50%);
      animation: pxSpark .35s steps(4) forwards;
    `;
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 380);
  });

  // Inject spark keyframe once
  if (!document.getElementById('pxSparkStyle')) {
    const s = document.createElement('style');
    s.id = 'pxSparkStyle';
    s.textContent = `
      @keyframes pxSpark {
        0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        50%  { opacity:.6; transform:translate(-50%,-50%) scale(4); }
        100% { opacity:0; transform:translate(-50%,-50%) scale(7); }
      }
    `;
    document.head.appendChild(s);
  }
})();


// exam mode

// question quotas per sous-matière — how many MCQ + open per subject
const EXAM_QUOTAS = {
  // Sémiologie
  'Psychiatrie':    { total: 8,  ccCount: 1 },
  'Neurologie':     { total: 5,  ccCount: 0, openCount: 5 },  // 5 MCQ + 5 QR
  'Dermatologie':   { total: 8,  ccCount: 0 },
  'Endocrinologie': { total: 8,  ccCount: 1 },
  'Néphrologie':    { total: 8,  ccCount: 1 },
  'Gynécologie':    { total: 8,  ccCount: 0 },
  'Urologie':       { total: 8,  ccCount: 0 },
  // Radiologie
  'Sémiologie Fondamentale':              { total: 5,  ccCount: 0 },
  'Sémiologie Neurologique':              { total: 9,  ccCount: 1 },
  "Sémiologie de l'Appareil Locomoteur":  { total: 4,  ccCount: 1 },
  'Sémiologie Urogénitale':               { total: 5,  ccCount: 1 },
  'Sémiologie Digestive':                 { total: 10, ccCount: 1 },
  'Sémiologie Thoracique':                { total: 10, ccCount: 1 },
  // Pharmacologie & Toxicologie
  'Pharmacologie Générale':     { total: 25, ccCount: 0 },
  'Pharmacologie Systématique': { total: 15, ccCount: 0 },
  'Toxicologie':                { total: 0, ccCount: 0, openCount: 10 },
  // Parasito-Myco-MI
  'Parasitologie':          { total: 25, ccCount: 0 },
  'Mycologie':              { total: 5,  ccCount: 0 },
  'Maladies Infectieuses':  { total: 10, ccCount: 0 },
  // Anatomie Pathologique
  'I. Pathologies Inflammatoires':  { total: 5,  ccCount: 0, openCount: 4 },
  'II. Pathologies Vasculaires':    { total: 5,  ccCount: 1, openCount: 4 },
  'III. Pathologies de Surcharge':  { total: 3,  ccCount: 0, openCount: 3 },
  'IV. Pathologies Tumorales':      { total: 7,  ccCount: 1, openCount: 4 },
};

// available exam subjects and their theme groupings
const EXAM_SUBJECTS = {
  semio: {
    label: 'Sémiologie',
    matiere: 'Sémiologie',
    themes: [
      { id: 'neuro_psycho',  name: 'Système Nerveux',      sub: 'Neurologie · Psychiatrie',             modules: ['Neurologie', 'Psychiatrie'] },
      { id: 'dermo_endocri', name: 'Revêtement & Glandes', sub: 'Dermatologie · Endocrinologie',         modules: ['Dermatologie', 'Endocrinologie'] },
      { id: 'uro_gyneco',    name: 'Uro-Génital',          sub: 'Gynécologie · Urologie · Néphrologie',  modules: ['Gynécologie', 'Urologie', 'Néphrologie'] },
    ],
  },
  radio: {
    label: 'Radiologie',
    matiere: 'Radiologie',
    themes: [
      {
        id: 'radio_complet',
        name: 'Radiologie',
        sub: 'Fondamentale · Neuro · Locomoteur · Uro · Digestif · Thoracique',
        modules: [
          'Sémiologie Fondamentale',
          'Sémiologie Neurologique',
          "Sémiologie de l'Appareil Locomoteur",
          'Sémiologie Urogénitale',
          'Sémiologie Digestive',
          'Sémiologie Thoracique',
        ],
      },
    ],
  },
  pharmatoxico: {
    label: 'Pharma & Toxico',
    matiere: 'Pharmacologie & Toxicologie',
    themes: [
      { id: 'pharma_complet', name: 'Pharmacologie', sub: 'Pharmacologie Générale (25) · Systématique (15)', modules: ['Pharmacologie Générale', 'Pharmacologie Systématique'] },
      { id: 'toxico_complet', name: 'Toxicologie',   sub: 'Intoxications · cas cliniques · 10 questions',   modules: ['Toxicologie'] },
    ],
  },
  parasitomi: {
    label: 'Parasito-Myco-MI',
    matiere: 'Parasito-Myco-MI',
    themes: [
      { id: 'parasito_myco', name: 'Parasito-Myco', sub: 'Parasitologie (25) · Mycologie (5)',        modules: ['Parasitologie', 'Mycologie'] },
      { id: 'mi_module',     name: 'Maladies Inf.',  sub: 'Maladies Infectieuses · 10 QCMs',           modules: ['Maladies Infectieuses'] },
    ],
  },
  anatpath: {
    label: 'Anat. Pathologique',
    matiere: 'Anatomie Pathologique',
    themes: [
      {
        id: 'anatpath_complet',
        name: 'Anat. Pathologique',
        sub: 'Inflammatoire · Vasculaire · Surcharge · Tumoral · 15 QR + 5 MCQ',
        modules: ['I. Pathologies Inflammatoires', 'II. Pathologies Vasculaires', 'III. Pathologies de Surcharge', 'IV. Pathologies Tumorales'],
      },
    ],
  },
};

// Flat list for lookup
const EXAM_THEMES = Object.values(EXAM_SUBJECTS).flatMap(s =>
  s.themes.map(t => ({ ...t, matiere: s.matiere }))
);

// exam session state — wiped between exams
let examState = {
  themeId: null,
  timerMin: null,
  groups: [],         // array of groups: {questions[], isCasClinic, ccText}
  currentGroup: 0,
  answers: [],        // {groupIdx, chosen[], corrects[], isCorrect[]} per question
  timerInterval: null,
  secondsLeft: 0,
  startTime: null,
};

// exam setup
function onExamTimerInput(input) {
  const val = parseInt(input.value);
  // Deselect "sans limite"
  document.getElementById('exam-timer-unlimited-btn').classList.remove('selected');
  input.classList.toggle('set', !isNaN(val) && val > 0);
  examState.timerMin = (!isNaN(val) && val > 0) ? val : null;
  const hint = document.getElementById('exam-timer-hint');
  if (!isNaN(val) && val > 0) {
    hint.textContent = `→ ${val} minute${val > 1 ? 's' : ''}`;
  } else {
    hint.textContent = '';
  }
  updateExamSummary();
}
function setExamTimerUnlimited() {
  const input = document.getElementById('exam-timer-input');
  input.value = '';
  input.classList.remove('set');
  document.getElementById('exam-timer-unlimited-btn').classList.add('selected');
  document.getElementById('exam-timer-hint').textContent = '→ Sans limite de temps';
  examState.timerMin = 0;
  updateExamSummary();
}

// exam question collection
function collectExamQuestionsForTheme(themeId) {
  const theme = EXAM_THEMES.find(t => t.id === themeId);
  if (!theme || !DATA) return [];

  const matiere = DATA.find(m => m.nom === theme.matiere);
  if (!matiere) return [];

  const allGroups = [];

  theme.modules.forEach(smNom => {
    const quota = EXAM_QUOTAS[smNom];
    if (!quota) return;

    // Find sous-matière (direct ou 3 niveaux)
    let sm = matiere.sous_matieres?.find(s => s.nom === smNom);
    if (!sm) {
      for (const parentSm of (matiere.sous_matieres || [])) {
        if (parentSm.sous_matieres) {
          sm = parentSm.sous_matieres.find(s => s.nom === smNom);
          if (sm) break;
        }
      }
    }
    if (!sm) return;

    // Collect chapitres (1 ou 2 niveaux)
    const chapitres = [];
    if (sm.chapitres) {
      chapitres.push(...sm.chapitres);
    } else if (sm.sous_matieres) {
      sm.sous_matieres.forEach(ssm => chapitres.push(...(ssm.chapitres || [])));
    }

    // Separate by type and CC grouping
    const byCCOpen = {};     // cc_text → open questions
    const byCCMcq  = {};     // cc_text → mcq questions
    const standaloneOpen = [];
    const standaloneMcq  = [];

    chapitres.forEach(ch => {
      // Per-chapter state for text-based CC detection (no enonce/cas_clinique fields).
      // Pattern: a question whose text contains "Cas clinique N" starts a new group;
      // every following question in the same chapter belongs to that group until
      // the next "Cas clinique" marker or a true standalone question.
      let textCCKey = null;

      ch.questions.forEach(q => {
        const isOpen = q.type === 'open';
        const isMcq  = q.options && q.options.length > 0 && q.reponses && q.reponses.length > 0;
        if (!isOpen && !isMcq) return;
        const item = { q, chapTitre: ch.titre, sousMat: smNom };

        // Detect CC using enonce (new) or cas_clinique (legacy)
        const enonce = q.enonce || q.cas_clinique || '';
        const isCCFirst = enonce.startsWith('Cas clinique');
        const isCCSuite = enonce.startsWith('Appartient');
        const legacyCC  = !isCCFirst && !isCCSuite && !!q.cas_clinique;

        // Text-based CC detection: question has no metadata fields and its text
        // contains a "Cas clinique N" marker (e.g. 🩺 <strong>Cas clinique 1 :</strong>...)
        const hasNoMeta   = !q.enonce && !q.cas_clinique;
        const textCCStart = hasNoMeta && /Cas clinique\s+\d+/i.test(q.question);
        const textCCSuite = hasNoMeta && !textCCStart && textCCKey !== null;

        if (textCCStart) {
          const m = q.question.match(/Cas clinique\s+\d+/i);
          textCCKey = '__txt__' + ch.titre + '__' + (m ? m[0] : q.question.slice(0, 60));
          if (isOpen) {
            if (!byCCOpen[textCCKey]) byCCOpen[textCCKey] = [];
            byCCOpen[textCCKey].push(item);
          } else {
            if (!byCCMcq[textCCKey]) byCCMcq[textCCKey] = [];
            byCCMcq[textCCKey].push(item);
          }
        } else if (textCCSuite) {
          if (isOpen) {
            if (!byCCOpen[textCCKey]) byCCOpen[textCCKey] = [];
            byCCOpen[textCCKey].push(item);
          } else {
            if (!byCCMcq[textCCKey]) byCCMcq[textCCKey] = [];
            byCCMcq[textCCKey].push(item);
          }
        } else if (isCCFirst) {
          textCCKey = null;
          if (isOpen) {
            if (!byCCOpen[enonce]) byCCOpen[enonce] = [];
            byCCOpen[enonce].push(item);
          } else {
            if (!byCCMcq[enonce]) byCCMcq[enonce] = [];
            byCCMcq[enonce].push(item);
          }
        } else if (isCCSuite) {
          textCCKey = null;
          const mcqKeys  = Object.keys(byCCMcq);
          const openKeys = Object.keys(byCCOpen);
          if (!isOpen && mcqKeys.length > 0) {
            byCCMcq[mcqKeys[mcqKeys.length - 1]].push(item);
          } else if (isOpen && openKeys.length > 0) {
            byCCOpen[openKeys[openKeys.length - 1]].push(item);
          } else {
            if (isOpen) standaloneOpen.push(item);
            else        standaloneMcq.push(item);
          }
        } else if (legacyCC) {
          textCCKey = null;
          const key = q.cas_clinique;
          if (isOpen) {
            if (!byCCOpen[key]) byCCOpen[key] = [];
            byCCOpen[key].push(item);
          } else {
            if (!byCCMcq[key]) byCCMcq[key] = [];
            byCCMcq[key].push(item);
          }
        } else {
          textCCKey = null;
          if (isOpen) standaloneOpen.push(item);
          else        standaloneMcq.push(item);
        }
      });
    });

    const ccMcqGroups  = Object.entries(byCCMcq).map(([ccText, qs]) =>
      ({ isCasClinic: true, ccText, questions: qs, sousMat: smNom }));
    const ccOpenGroups = Object.entries(byCCOpen).map(([ccText, qs]) =>
      ({ isCasClinic: true, ccText, questions: qs, sousMat: smNom }));

    // Shuffle everything
    ccMcqGroups.sort(() => Math.random() - .5);
    ccOpenGroups.sort(() => Math.random() - .5);
    standaloneOpen.sort(() => Math.random() - .5);
    standaloneMcq.sort(() => Math.random() - .5);

    const chosen = [];
    let mcqRemaining  = quota.total;
    const openTarget  = quota.openCount || 0;

    // 1. Pick CC MCQ groups
    for (let i = 0; i < quota.ccCount && i < ccMcqGroups.length; i++) {
      chosen.push(ccMcqGroups[i]);
      mcqRemaining -= ccMcqGroups[i].questions.length;
    }

    // 2. Fill remaining MCQ with standalone
    let mcqFilled = 0;
    for (const item of standaloneMcq) {
      if (mcqFilled >= Math.max(0, mcqRemaining)) break;
      chosen.push({ isCasClinic: false, ccText: null, questions: [item], sousMat: smNom });
      mcqFilled++;
    }

    // 3. Pick open questions (CC first, then standalone)
    let openFilled = 0;
    for (let i = 0; i < ccOpenGroups.length && openFilled < openTarget; i++) {
      chosen.push(ccOpenGroups[i]);
      openFilled += ccOpenGroups[i].questions.length;
    }
    for (const item of standaloneOpen) {
      if (openFilled >= openTarget) break;
      chosen.push({ isCasClinic: false, ccText: null, questions: [item], sousMat: smNom });
      openFilled++;
    }

    allGroups.push(...chosen);
  });

  return allGroups;
}

function countExamQuestions(themeId) {
  const theme = EXAM_THEMES.find(t => t.id === themeId);
  if (!theme || !DATA) return 0;
  let total = 0;
  theme.modules.forEach(smNom => {
    const q = EXAM_QUOTAS[smNom];
    if (q) total += q.total + (q.openCount || 0);
  });
  return total;
}

function openExamSetup() {
  if (!DATA) { alert('Données non chargées'); return; }
  // Reset state
  examState.themeId = null;
  examState.timerMin = null;
  // Reset radio buttons
  document.querySelectorAll('input[name="exam-subject"]').forEach(r => r.checked = false);
  document.querySelectorAll('input[name="exam-module"]').forEach(r => r.checked = false);
  const timerInput = document.getElementById('exam-timer-input');
  const unlimitedBtn = document.getElementById('exam-timer-unlimited-btn');
  const hint = document.getElementById('exam-timer-hint');
  if (timerInput) timerInput.value = '';
  if (unlimitedBtn) unlimitedBtn.classList.remove('selected');
  if (hint) hint.textContent = '';
  // Hide steps 2 & 3
  const modStep   = document.getElementById('exam-step-module');
  const timerStep = document.getElementById('exam-step-timer');
  if (modStep)   modStep.style.display   = 'none';
  if (timerStep) timerStep.style.display = 'none';
  updateExamSummary();
  showScreen('screen-exam-setup');
}

function buildExamThemeCards() {
  // Deprecated — now handled by onSubjectChange + buildModuleRadios
}

// Called when user picks Sémiologie or Radiologie
async function onSubjectChange(subjectKey) {
  const subject = EXAM_SUBJECTS[subjectKey];
  if (!subject) return;
  examState.themeId = null;

  const mi = DATA.findIndex(m => m.nom === subject.matiere);
  if (mi >= 0) await loadMatiere(mi);

  const modStep   = document.getElementById('exam-step-module');
  const timerStep = document.getElementById('exam-step-timer');

  // Si un seul module → sélection automatique, on saute l'étape
  if (subject.themes.length === 1) {
    modStep.style.display = 'none';
    examState.themeId = subject.themes[0].id;
    timerStep.style.display = '';
    updateExamSummary();
    return;
  }

  // Plusieurs modules → afficher la liste
  timerStep.style.display = 'none';
  modStep.style.display = '';

  const container = document.getElementById('exam-module-radios');
  container.innerHTML = '';
  subject.themes.forEach(theme => {
    const count = countExamQuestions(theme.id);
    const label = document.createElement('label');
    label.className = 'exam-module-radio';
    label.dataset.themeId = theme.id;
    label.innerHTML = `
      <input type="radio" name="exam-module" value="${theme.id}" onchange="selectExamTheme('${theme.id}')">
      <span class="exam-module-dot"></span>
      <span class="exam-module-info">
        <span class="exam-module-name">${theme.name}</span>
        <span class="exam-module-sub">${theme.sub}</span>
      </span>
      <span class="exam-module-count">~${count} q</span>
    `;
    container.appendChild(label);
  });
  updateExamSummary();
}

function selectExamTheme(themeId) {
  examState.themeId = themeId;
  // Show timer step
  document.getElementById('exam-step-timer').style.display = '';
  updateExamSummary();
}

function updateExamSummary() {
  const theme = EXAM_THEMES.find(t => t.id === examState.themeId);
  const themeName = theme ? theme.name : '— Thème non sélectionné';
  const count = theme ? countExamQuestions(examState.themeId) : 0;
  const timerMin = examState.timerMin;
  const timerLabel = timerMin === null ? '— Durée non sélectionnée'
    : timerMin === 0 ? 'Sans limite'
    : `${timerMin} min`;

  document.getElementById('exam-summary-theme').textContent = themeName;
  document.getElementById('exam-summary-timer').textContent = timerLabel;
  document.getElementById('exam-summary-count').textContent = `~${count} questions`;

  const btn = document.getElementById('exam-start-btn');
  btn.disabled = !(examState.themeId !== null && examState.timerMin !== null);
}

// exam: start & timer
function startExam() {
  const groups = collectExamQuestionsForTheme(examState.themeId);
  // Shuffle group order
  examState.groups      = groups.sort(() => Math.random() - .5);
  examState.currentGroup = 0;
  examState.answers     = [];
  examState.startTime   = Date.now();

  showScreen('screen-exam-q');

  // Timer
  if (examState.timerMin > 0) {
    examState.secondsLeft = examState.timerMin * 60;
    updateTimerDisplay();
    examState.timerInterval = setInterval(() => {
      examState.secondsLeft--;
      updateTimerDisplay();
      if (examState.secondsLeft <= 0) finishExam(true);
    }, 1000);
  } else {
    document.getElementById('exam-timer-display').textContent = '∞';
  }

  renderExamGroup();
}

function updateTimerDisplay() {
  const el = document.getElementById('exam-timer-display');
  if (!el) return;
  const m = Math.floor(examState.secondsLeft / 60);
  const s = examState.secondsLeft % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = 'exam-timer-display';
  if (examState.secondsLeft <= 60) el.classList.add('danger');
  else if (examState.secondsLeft <= 180) el.classList.add('warn');
}

// exam: render & validate
function renderExamGroup() {
  const totalGroups = examState.groups.length;
  const gi = examState.currentGroup;
  const group = examState.groups[gi];

  // Progress: count questions done
  const totalQs = examState.groups.reduce((a, g) => a + g.questions.length, 0);
  const doneQs  = examState.answers.length;
  const currQStart = doneQs + 1;

  const isCasClinic = group.isCasClinic;
  const qCount = group.questions.length;
  const labelText = isCasClinic
    ? `Cas Clinique · Q${currQStart}–${currQStart + qCount - 1} / ${totalQs}`
    : `Q ${currQStart} / ${totalQs}`;

  document.getElementById('exam-q-label').textContent = labelText;
  document.getElementById('exam-progress-fill').style.width = (doneQs / totalQs * 100) + '%';

  const wrap = document.getElementById('exam-q-wrap');

  // CC header once at top
  // Strip internal __txt__chapTitre__key prefix used for text-based CC detection
  const rawCCText = (group.ccText || '').replace(/^__txt__.*?__(Cas clinique\s+\d+)$/i, '$1').replace(/^__txt__[^_]+__[^_]+__/, '');
  const ccHtml = isCasClinic
    ? `<div class="cc-header"> ${rawCCText || group.ccText}</div>` : '';

  // Render all questions in group
  const qsHtml = group.questions.map((item, idx) => {
    const q = item.q;
    const isOpen = q.type === 'open';
    const qLabel = isCasClinic ? `Question ${idx + 1} du cas` : '';

    let content;
    if (isOpen) {
      content = `
        <div class="q-hint exam-open-hint">Question rédactionnelle — rédigez votre réponse :</div>
        <textarea class="exam-open-textarea" id="exam-textarea-${gi}-${idx}" placeholder="Écrivez votre réponse ici…" rows="4"></textarea>
        <div class="exam-self-assess" id="exam-self-${gi}-${idx}">
          <button class="exam-know-btn" onclick="examSelfAssess(${gi},${idx},true)">Oui, je connais la réponse</button>
          <button class="exam-dontknow-btn" onclick="examSelfAssess(${gi},${idx},false)">Non, à revoir</button>
        </div>
      `;
    } else {
      const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const opts = q.options.map((opt, oi) => `
        <label class="opt-label" id="exam-opt-${gi}-${idx}-${oi}">
          <input type="checkbox" name="exam-q-${gi}-${idx}" value="${oi}">
          <span class="opt-letter">${LETTERS[oi]}</span>
          <span class="opt-text">${opt}</span>
        </label>`).join('');
      content = `
        <div class="q-hint">Cochez toutes les bonnes réponses</div>
        <div class="options">${opts}</div>
      `;
    }

    return `
      <div class="exam-single-q ${isCasClinic ? 'exam-cc-q' : ''}" id="exam-qcard-${gi}-${idx}" data-open="${isOpen}">
        ${qLabel ? `<div class="exam-cc-qnum">${qLabel}</div>` : ''}
        <div class="q-text">${q.question}</div>
        ${content}
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    ${ccHtml}
    <div class="exam-q-source">
      <span>${group.sousMat}</span>${isCasClinic ? '' : ` › <span>${group.questions[0].chapTitre}</span>`}
    </div>
    ${qsHtml}
  `;

  const btn = document.getElementById('exam-validate-btn');
  const hasOpenQ = group.questions.some(item => item.q.type === 'open');
  btn.disabled = hasOpenQ; // will be enabled after self-assess
  const isLast = gi + 1 >= totalGroups;
  btn.textContent = isLast ? '[ Valider & Terminer ]' : '[ Valider & Suivant ]';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateExamQuestion() {
  const gi    = examState.currentGroup;
  const group = examState.groups[gi];

  group.questions.forEach((item, idx) => {
    const q = item.q;
    if (q.type === 'open') return; // already stored by examSelfAssess
    const chosen   = [...document.querySelectorAll(`input[name="exam-q-${gi}-${idx}"]:checked`)].map(i => parseInt(i.value));
    const corrects = q.reponses;
    const isCorrect = corrects.length === chosen.length && corrects.every(r => chosen.includes(r));
    examState.answers.push({ gi, idx, chosen, corrects, isCorrect, q, source: item, isOpen: false });
    q.options.forEach((_, oi) => {
      const lbl = document.getElementById(`exam-opt-${gi}-${idx}-${oi}`);
      if (lbl) { lbl.classList.add('disabled'); lbl.style.opacity = chosen.includes(oi) ? '1' : '0.5'; }
    });
  });

  document.getElementById('exam-validate-btn').disabled = true;

  setTimeout(() => {
    examState.currentGroup++;
    if (examState.currentGroup < examState.groups.length) renderExamGroup();
    else finishExam(false);
  }, 400);
}

function examSelfAssess(gi, idx, knows) {
  const card     = document.getElementById(`exam-qcard-${gi}-${idx}`);
  const btns     = document.getElementById(`exam-self-${gi}-${idx}`);
  const textarea = document.getElementById(`exam-textarea-${gi}-${idx}`);
  if (!btns || card?.dataset.assessed === 'true') return;

  card.dataset.assessed = 'true';

  // Capture user's written answer
  const userWritten = textarea?.value?.trim() || '';
  if (textarea) {
    textarea.disabled = true;
    textarea.style.opacity = '.7';
  }

  // Visual feedback on buttons
  btns.querySelectorAll('button').forEach(b => b.disabled = true);
  const badge = document.createElement('div');
  badge.className = `exam-open-badge ${knows ? 'know' : 'dontknow'}`;
  badge.textContent = knows ? 'Oui, je connais' : ' À revoir';
  btns.appendChild(badge);

  // Store answer with user's written text
  const group = examState.groups[gi];
  const item  = group.questions[idx];
  const already = examState.answers.find(a => a.gi === gi && a.idx === idx);
  if (!already) {
    examState.answers.push({
      gi, idx,
      chosen: [], corrects: [],
      isCorrect: knows,
      userWritten,
      modelAnswer: item.q.reponse || '',
      q: item.q,
      source: item,
      isOpen: true,
    });
  }

  // Enable validate once all open questions in group are assessed
  const allDone = group.questions.every((it, i) => {
    if (it.q.type !== 'open') return true;
    return document.getElementById(`exam-qcard-${gi}-${i}`)?.dataset.assessed === 'true';
  });
  if (allDone) {
    document.getElementById('exam-validate-btn').disabled = false;
  }
}

function toggleExamOpenAnswer(gi, idx) {
  const ans = document.getElementById(`exam-open-ans-${gi}-${idx}`);
  const btn = document.querySelector(`#exam-open-reveal-${gi}-${idx} .btn-reveal`);
  if (!ans) return;
  const open = ans.classList.toggle('exam-open-answer-visible');
  if (btn) btn.textContent = open ? 'Masquer la réponse' : ' Voir la réponse modèle';
}

// exam: finish & review
function finishExam(timeout = false) {
  if (examState.timerInterval) clearInterval(examState.timerInterval);

  const elapsed = Math.floor((Date.now() - examState.startTime) / 1000);
  const em = Math.floor(elapsed / 60);
  const es = elapsed % 60;

  const correct = examState.answers.filter(a => a.isCorrect).length;
  const total   = examState.answers.length;
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;

  const theme = EXAM_THEMES.find(t => t.id === examState.themeId);

  document.getElementById('exam-results-sub').textContent =
    `${theme?.name || ''} · ${timeout ? 'Temps écoulé' : 'Terminé'}`;
  document.getElementById('exam-res-score').textContent   = `${pct}%`;
  document.getElementById('exam-res-correct').textContent = correct;
  document.getElementById('exam-res-wrong').textContent   = total - correct;
  document.getElementById('exam-res-time').textContent    = `${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`;

  buildExamReview();

  // Save to exam history
  saveExamResult({
    themeId: examState.themeId,
    pct, correct, total,
    time: `${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`,
    date: new Date().toLocaleDateString('fr-FR'),
    timeout,
  });

  showScreen('screen-exam-results');
}

function buildExamReview() {
  const list = document.getElementById('exam-review-list');
  list.innerHTML = '';

  // Group answers back by gi
  const byGroup = {};
  examState.answers.forEach(ans => {
    if (!byGroup[ans.gi]) byGroup[ans.gi] = [];
    byGroup[ans.gi].push(ans);
  });

  Object.entries(byGroup).forEach(([gi, answers]) => {
    const group = examState.groups[parseInt(gi)];
    const allCorrect = answers.every(a => a.isCorrect);

    const wrap = document.createElement('div');
    wrap.className = `exam-review-item ${allCorrect ? 'correct' : 'wrong'}`;

    // CC header if needed
    const rawCCTextRev = (group.ccText || '').replace(/^__txt__.*?__(Cas clinique\s+\d+)$/i, '$1').replace(/^__txt__[^_]+__[^_]+__/, '');
    const ccHead = group.isCasClinic
      ? `<div class="cc-header" style="font-size:.72rem;margin-bottom:12px">${rawCCTextRev || group.ccText}</div>` : '';

    const qsHtml = answers.map((ans, idx) => {
      const q = ans.q;

      let bodyHtml;
      if (ans.isOpen) {
        // Open question: show user's written answer + model answer
        bodyHtml = `
          <div class="exam-review-open">
            <div class="exam-review-open-section">
              <div class="exam-review-open-label">Votre réponse</div>
              <div class="exam-review-open-text ${ans.userWritten ? '' : 'empty'}">
                ${ans.userWritten || '<em>Aucune réponse écrite</em>'}
              </div>
            </div>
            <div class="exam-review-open-section">
              <div class="exam-review-open-label model">Réponse modèle</div>
              <div class="exam-review-open-text model-text">${ans.modelAnswer || '—'}</div>
            </div>
          </div>
        `;
      } else {
        const opts = q.options.map((opt, oi) => {
          let cls = '';
          if (ans.corrects.includes(oi)) cls += ' correct-answer';
          if (ans.chosen.includes(oi) && !ans.corrects.includes(oi)) cls += ' user-wrong';
          const icon = cls.includes('correct-answer') ? '' : cls.includes('user-wrong') ? '' : '';
          return `<div class="exam-review-opt${cls}">${icon}${opt}</div>`;
        }).join('');
        bodyHtml = `<div class="exam-review-opts">${opts}</div>`;
      }

      return `
        <div class="exam-review-single ${ans.isCorrect ? 'r-correct' : 'r-wrong'}">
          <div class="exam-review-badge">${ans.isCorrect ? 'Juste' : 'Faux'}</div>
          <div class="exam-review-qnum">${group.sousMat}${group.isCasClinic ? ' · Q' + (idx+1) + ' du cas' : ''}</div>
          <div class="exam-review-qtext">${q.question}</div>
          ${bodyHtml}
        </div>
      `;
    }).join('');

    wrap.innerHTML = ccHead + qsHtml;
    list.appendChild(wrap);
  });
}

// exam: abandon modal
function confirmAbandonExam() {
  document.getElementById('exam-modal-overlay').classList.add('open');
}
function closeAbandonModal() {
  document.getElementById('exam-modal-overlay').classList.remove('open');
}
function abandonExam() {
  closeAbandonModal();
  if (examState.timerInterval) clearInterval(examState.timerInterval);
  examState = { themeId: null, timerMin: null, groups: [], currentGroup: 0, answers: [], timerInterval: null, secondsLeft: 0, startTime: null };
  openExamSetup();
}

// inject inline styles for exam-specific elements
(function injectExamSourceStyle() {
  if (document.getElementById('examExtraStyle')) return;
  const s = document.createElement('style');
  s.id = 'examExtraStyle';
  s.textContent = `
    .exam-q-source {
      font-family: 'DM Mono', monospace;
      font-size: 0.52rem;
      color: var(--text2);
      margin-bottom: 14px;
      opacity: .7;
    }
    .exam-q-source span { color: var(--accent2); }
    .exam-single-q { margin-bottom: 28px; }
    .exam-single-q:last-child { margin-bottom: 0; }
    .exam-cc-q {
      border-left: 2px solid var(--accent3);
      padding-left: 14px;
    }
    .exam-cc-qnum {
      font-family: 'Press Start 2P', monospace;
      font-size: 0.38rem;
      color: var(--accent3);
      letter-spacing: .08em;
      margin-bottom: 8px;
    }
    .exam-review-single {
      margin-bottom: 18px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border-dim);
      position: relative;
    }
    .exam-review-single:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .exam-review-single .exam-review-badge {
      position: static;
      display: inline-block;
      margin-bottom: 6px;
    }
    .r-correct .exam-review-badge { background: var(--correct-bg); color: var(--correct); border: 1px solid var(--correct); }
    .r-wrong   .exam-review-badge { background: var(--wrong-bg);   color: var(--wrong);   border: 1px solid var(--wrong); }
  `;
  document.head.appendChild(s);
})();

// ai correction (Groq)

const GROQ_CONFIG = {
  workerUrl: 'https://ataraxie-groq.rihabx11rh.workers.dev',
  model: 'llama-3.1-8b-instant',
};

async function aiCorrectQuestion(qi) {
  const ch = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const q  = ch.questions[qi];

  const textarea = document.getElementById(`ai-textarea-${qi}`);
  const btn      = document.getElementById(`ai-btn-${qi}`);
  const resultEl = document.getElementById(`ai-result-${qi}`);
  const errorEl  = document.getElementById(`ai-error-${qi}`);

  const userAnswer = textarea?.value?.trim();
  if (!userAnswer) {
    textarea.focus();
    textarea.style.borderColor = 'var(--wrong)';
    setTimeout(() => (textarea.style.borderColor = ''), 1000);
    return;
  }

  btn.disabled = true;
  btn.classList.add('loading');
  resultEl.classList.remove('visible');
  errorEl.classList.remove('visible');

  const prompt = `Tu es un correcteur médical expert. Évalue la réponse d'un étudiant en médecine.

QUESTION: ${q.question || ''}

RÉPONSE MODÈLE: ${q.reponse || ''}

RÉPONSE ÉTUDIANT: ${userAnswer}

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ni après:
{
  "similarite": <entier 0-100>,
  "score_global": <entier 0-100, calcul: 40% similarite + 60% moyenne_concepts>,
  "niveau": "<excellent|bon|partiel|insuffisant>",
  "concepts": [{"nom": "<concept clé>", "present": <true/false>}],
  "feedback": "<2-3 phrases constructives en français>",
  "resume_manquant": "<points manquants, vide si score >= 85>"
}
Règles: 4-7 concepts, niveau excellent>=85 bon>=65 partiel>=40 insuffisant<40`;

  try {
    const res = await fetch(GROQ_CONFIG.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw  = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse non-JSON reçue.');

    const result = JSON.parse(jsonMatch[0]);
    renderAiResult(qi, result, q.reponse || '');
    validateOpenQuestion(qi, (result.score_global ?? 0) >= 65);

  } catch (err) {
    let msg = err.message;
    if (msg.includes('401') || msg.includes('api_key')) msg = 'Clé API invalide.';
    else if (msg.includes('429')) msg = 'Quota dépassé — réessaie dans quelques secondes.';
    else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) msg = 'Pas de connexion internet.';
    errorEl.innerHTML = `<strong>Erreur IA :</strong> ${msg}`;
    errorEl.classList.add('visible');
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function renderAiResult(qi, result, modelAnswer) {
  const btn      = document.getElementById(`ai-btn-${qi}`);
  const resultEl = document.getElementById(`ai-result-${qi}`);
  btn.classList.remove('loading');

  const score  = Math.max(0, Math.min(100, Math.round(result.score_global ?? 0)));
  const sim    = Math.max(0, Math.min(100, Math.round(result.similarite  ?? 0)));
  const niveau = result.niveau ||
    (score >= 85 ? 'excellent' : score >= 65 ? 'bon' : score >= 40 ? 'partiel' : 'insuffisant');

  const nv = {
    excellent:   { label: 'Excellent',   cls: 'excellent', color: 'var(--correct)' },
    bon:         { label: 'Bien',        cls: 'good',      color: '#00c878'       },
    partiel:     { label: 'Partiel',     cls: 'partial',   color: 'var(--warn)'   },
    insuffisant: { label: 'Insuffisant', cls: 'poor',      color: 'var(--wrong)'  },
  }[niveau] || { label: 'Partiel', cls: 'partial', color: 'var(--warn)' };

  const circ   = 2 * Math.PI * 20;
  const offset = circ * (1 - score / 100);
  const simClr = sim >= 70 ? 'var(--correct)' : sim >= 45 ? 'var(--warn)' : 'var(--wrong)';

  const chips = (result.concepts || []).map(c =>
    `<span class="ai-concept-chip ${c.present ? 'present' : 'absent'}">${c.present ? '+' : '−'} ${c.nom}</span>`
  ).join('');

  resultEl.innerHTML = `
    <div class="ai-result-header ${nv.cls}">
      <div class="ai-score-wrap">
        <div class="ai-score-ring">
          <svg viewBox="0 0 44 44" width="52" height="52">
            <circle class="ring-bg"   cx="22" cy="22" r="20"/>
            <circle class="ring-fill" cx="22" cy="22" r="20"
              stroke="${nv.color}"
              stroke-dasharray="${circ}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="ring-text">${score}%</div>
        </div>
        <div>
          <div class="ai-score-label">${nv.label}</div>
          <div class="ai-score-sublabel">Score global</div>
        </div>
      </div>
      <button class="ai-retry-btn" onclick="aiRetry(${qi})">↺ Réessayer</button>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">Ressemblance sémantique</div>
      <div class="ai-sim-bar-wrap">
        <div class="ai-sim-bar-track">
          <div class="ai-sim-bar-fill" style="width:${sim}%;background:${simClr};color:${simClr}"></div>
        </div>
        <span class="ai-sim-val">${sim}%</span>
      </div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">Concepts clés</div>
      <div class="ai-concepts-row">${chips || '<span style="color:var(--muted);font-size:.7rem">—</span>'}</div>
    </div>

    <div class="ai-section">
      <div class="ai-section-title">Feedback</div>
      <div class="ai-feedback-text">${result.feedback || '—'}</div>
      ${result.resume_manquant
        ? `<div style="margin-top:8px;font-family:'DM Mono',monospace;font-size:.7rem;color:var(--warn)">! Manquant : ${result.resume_manquant}</div>`
        : ''}
      <button class="ai-model-toggle" id="ai-model-toggle-${qi}" onclick="toggleModelAnswer(${qi})">
        Voir la réponse modèle
      </button>
      <div class="ai-model-answer" id="ai-model-answer-${qi}">${modelAnswer}</div>
    </div>
  `;
  resultEl.classList.add('visible');

  const ta = document.getElementById(`ai-textarea-${qi}`);
  if (ta) ta.disabled = true;
  btn.disabled    = true;
  btn.style.display = 'none';
}

function toggleModelAnswer(qi) {
  const a = document.getElementById(`ai-model-answer-${qi}`);
  const t = document.getElementById(`ai-model-toggle-${qi}`);
  if (!a) return;
  t.textContent = a.classList.toggle('open')
    ? 'Masquer la réponse modèle'
    : 'Voir la réponse modèle';
}

function aiRetry(qi) {
  const ta  = document.getElementById(`ai-textarea-${qi}`);
  const btn = document.getElementById(`ai-btn-${qi}`);
  const res = document.getElementById(`ai-result-${qi}`);
  const err = document.getElementById(`ai-error-${qi}`);
  const crd = document.getElementById(`card-${qi}`);

  if (ta)  { ta.disabled = false; ta.value = ''; ta.focus(); }
  if (btn) { btn.disabled = false; btn.style.display = ''; btn.classList.remove('loading'); }
  if (res) { res.innerHTML = ''; res.classList.remove('visible'); }
  if (err) { err.textContent = ''; err.classList.remove('visible'); }
  if (crd) { crd.classList.remove('correct','wrong','validated'); crd.querySelector('.result-badge')?.remove(); }

  const ch   = getChapitres(currentMatiere, currentSousMatiere)[currentChapitre];
  const done = ch.questions.filter((_,i) => document.getElementById(`card-${i}`)?.classList.contains('validated')).length;
  updateProgress(done, ch.questions.length);
  if (submitted) {
    submitted = false;
    document.getElementById('btn-submit').disabled = false;
    document.getElementById('score-box').classList.remove('visible');
  }
}

function toggleAiModelAnswer(qi) {
  const el  = document.getElementById(`ai-model-inline-${qi}`);
  const btn = document.getElementById(`ai-reveal-btn-${qi}`);
  if (!el) return;
  const open = el.classList.toggle('open');
  btn.textContent = open ? 'Masquer la réponse' : 'Réponse modèle';
}
