/* =============================================
   MY MEMO - 메인 앱
   ============================================= */

// =============================================
// 상수
// =============================================
const STORAGE_KEY      = 'my-memo-data';
const SETTINGS_KEY     = 'my-memo-settings';

// =============================================
// 상태 (State)
// =============================================
const state = {
  memos: [],
  currentMemoId: null,   // null = 새 메모, string = 수정 중인 메모 ID
  filterStarOnly: false,
  searchKeyword: '',
  currentImages: [],     // 에디터에서 편집 중인 이미지 배열 [{ id, base64 }]
};

// =============================================
// DOM 요소
// =============================================
const elViewList       = document.getElementById('view-list');
const elViewEditor     = document.getElementById('view-editor');
const elMemoList       = document.getElementById('memo-list');
const elEmptyState     = document.getElementById('empty-state');
const elSearchInput    = document.getElementById('search-input');
const elBtnNew         = document.getElementById('btn-new');
const elBtnMore        = document.getElementById('btn-more');
const elMoreMenu       = document.getElementById('more-menu');
const elBtnStarFilter  = document.getElementById('btn-star-filter');
const elBtnImportant   = document.getElementById('btn-important');
const elBtnDelete      = document.getElementById('btn-delete');
const elBtnShare       = document.getElementById('btn-share');
const elBtnCopy        = document.getElementById('btn-copy');
const elBtnSave        = document.getElementById('btn-save');
const elEditorTextarea = document.getElementById('editor-textarea');
const elHeaderLogo     = document.querySelector('.header__logo');
const elImportInput       = document.getElementById('import-input');
const elDarkmodeIndicator = document.getElementById('darkmode-indicator');
const elBtnImage          = document.getElementById('btn-image');
const elImagePickerMenu   = document.getElementById('image-picker-menu');
const elImageGalleryInput = document.getElementById('image-gallery-input');
const elImageCameraInput  = document.getElementById('image-camera-input');
const elImagePreviewList  = document.getElementById('image-preview-list');
const elBtnRecordToggle   = document.getElementById('btn-record');
const elRecordStatus      = document.getElementById('record-status');
const elRecordTime        = document.getElementById('record-time');
const elBtnRecordStop     = document.getElementById('btn-record-stop');
const elBtnInstall        = document.getElementById('btn-install');

// =============================================
// LocalStorage — 메모 불러오기 / 저장
// =============================================
function loadMemos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.memos = raw ? JSON.parse(raw) : [];
  } catch {
    state.memos = [];
  }
}

function saveMemos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.memos));
}

// =============================================
// LocalStorage — 설정 불러오기 / 저장
// =============================================
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { darkMode: false, fontSize: 'medium' };
  } catch {
    return { darkMode: false, fontSize: 'medium' };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// =============================================
// 고유 ID 생성
// =============================================
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// =============================================
// CRUD
// =============================================
function createMemo(content, important, images = []) {
  const now = new Date().toISOString();
  const memo = {
    id: generateId(),
    content,
    important,
    images,
    createdAt: now,
    updatedAt: now,
  };
  state.memos.unshift(memo);
  saveMemos();
  return memo;
}

function updateMemo(id, content, important, images = []) {
  const memo = state.memos.find(m => m.id === id);
  if (!memo) return;
  memo.content   = content;
  memo.important = important;
  memo.images    = images;
  memo.updatedAt = new Date().toISOString();
  saveMemos();
}

function deleteMemo(id) {
  state.memos = state.memos.filter(m => m.id !== id);
  saveMemos();
}

function toggleImportant(id) {
  const memo = state.memos.find(m => m.id === id);
  if (!memo) return;
  memo.important = !memo.important;
  memo.updatedAt = new Date().toISOString();
  saveMemos();
  renderMemoList();
}

// =============================================
// 저장 / 삭제 처리
// =============================================
function handleSave() {
  const content   = elEditorTextarea.value.trim();
  const important = elBtnImportant.classList.contains('active');

  if (!content) {
    showToast('메모 내용을 입력해 주세요.');
    elEditorTextarea.focus();
    return;
  }

  if (state.currentMemoId) {
    updateMemo(state.currentMemoId, content, important, [...state.currentImages]);
  } else {
    createMemo(content, important, [...state.currentImages]);
  }

  vibrateOnSave();
  showListView();
  renderMemoList();
}

function handleDelete() {
  if (!state.currentMemoId) return;
  if (!confirm('이 메모를 삭제할까요?')) return;
  vibrateOnDelete();
  deleteMemo(state.currentMemoId);
  showListView();
  renderMemoList();
}

// =============================================
// 공유 (Web Share API)
// =============================================
async function handleShare() {
  const content = elEditorTextarea.value.trim();
  if (!content) return;

  if (navigator.share) {
    try {
      await navigator.share({ text: content });
    } catch (err) {
      /* 사용자가 공유 취소한 경우 무시 */
      if (err.name !== 'AbortError') showToast('공유에 실패했습니다.');
    }
  } else {
    /* Web Share API 미지원 환경 — 복사로 대체 */
    await handleCopy();
    showToast('공유 기능이 지원되지 않아 클립보드에 복사했습니다.');
  }
}

// =============================================
// 복사 (Clipboard API)
// =============================================
async function handleCopy() {
  const content = elEditorTextarea.value.trim();
  if (!content) return;

  try {
    await navigator.clipboard.writeText(content);
    showToast('클립보드에 복사됐습니다.');
  } catch {
    showToast('복사에 실패했습니다.');
  }
}

// =============================================
// 이미지 첨부
// =============================================

/* 이미지 선택 메뉴 토글 */
function toggleImagePickerMenu(e) {
  e.stopPropagation();
  elImagePickerMenu.hidden = !elImagePickerMenu.hidden;
}

function closeImagePickerMenu() {
  elImagePickerMenu.hidden = true;
}

/* FileReader로 File → Base64 변환 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

/* 이미지 파일 처리 (갤러리 / 카메라 공통) */
async function processImageFiles(files) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    /* 이미지 파일 검증 */
    if (!file.type.startsWith('image/')) continue;

    try {
      const base64 = await readFileAsBase64(file);
      state.currentImages.push({ id: generateId(), base64 });
    } catch {
      showToast('이미지를 불러오지 못했습니다.');
    }
  }

  renderImagePreviews();
  closeImagePickerMenu();
}

/* 에디터 이미지 미리보기 렌더링 */
function renderImagePreviews() {
  elImagePreviewList.hidden = state.currentImages.length === 0;
  elImagePreviewList.innerHTML = '';

  state.currentImages.forEach(({ id, base64, type }) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';

    const content = type === 'audio'
      ? `<audio src="${base64}" controls style="width:100%;height:100%;object-fit:contain"></audio>`
      : `<img src="${base64}" alt="첨부 이미지">`;

    item.innerHTML = `
      ${content}
      <button class="image-preview-item__delete" data-id="${id}" aria-label="첨부 삭제">✕</button>
    `;
    elImagePreviewList.appendChild(item);
  });
}

/* 이미지 미리보기에서 삭제 */
function removePreviewImage(id) {
  state.currentImages = state.currentImages.filter(img => img.id !== id);
  renderImagePreviews();
}

// =============================================
// 앱 설치 유도 (beforeinstallprompt)
// =============================================
let deferredInstallPrompt = null;

/* beforeinstallprompt 이벤트 캐치 — 설치 버튼 표시 */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  elBtnInstall.hidden = false;
});

/* 설치 버튼 클릭 → 설치 프롬프트 실행 */
function handleInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then((result) => {
    if (result.outcome === 'accepted') {
      elBtnInstall.hidden = true;
    }
    deferredInstallPrompt = null;
  });
}

/* 설치 완료 후 버튼 자동 숨김 */
window.addEventListener('appinstalled', () => {
  elBtnInstall.hidden = true;
  deferredInstallPrompt = null;
});

// =============================================
// 햅틱 피드백 (Vibration API)
// =============================================

/* 저장 시 진동 1회 (100ms) */
function vibrateOnSave() {
  if ('vibrate' in navigator) navigator.vibrate(100);
}

/* 삭제 시 진동 2회 (100-50-100ms) */
function vibrateOnDelete() {
  if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
}

// =============================================
// 화면 꺼짐 방지 (Screen Wake Lock API)
// =============================================
let wakeLock = null;

/* Wake Lock 요청 */
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    /* 권한 거부 또는 미지원 — 무시 */
  }
}

/* Wake Lock 해제 */
async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
    wakeLock = null;
  } catch {
    /* 무시 */
  }
}

/* 앱 백그라운드 복귀 시 Wake Lock 재요청 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !elViewEditor.hidden) {
    requestWakeLock();
  }
});

// =============================================
// 녹음 (MediaRecorder API)
// =============================================
let mediaRecorder   = null;
let recordedChunks  = [];
let recordTimerInterval = null;
let recordSeconds   = 0;

/* 녹음 시작 */
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder  = new MediaRecorder(stream);
    recordedChunks = [];
    recordSeconds  = 0;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      /* 스트림 트랙 종료 */
      stream.getTracks().forEach(t => t.stop());
      processRecording();
    };

    mediaRecorder.start();

    /* UI 업데이트 */
    elBtnRecordToggle.classList.add('recording');
    elBtnRecordToggle.textContent = '녹음중';
    elRecordStatus.hidden = false;

    /* 타이머 */
    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      const mm  = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
      const ss  = String(recordSeconds % 60).padStart(2, '0');
      elRecordTime.textContent = `${mm}:${ss}`;
    }, 1000);

  } catch {
    showToast('마이크 접근 권한이 필요합니다.');
  }
}

/* 녹음 중지 */
function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  clearInterval(recordTimerInterval);

  /* UI 초기화 */
  elBtnRecordToggle.classList.remove('recording');
  elBtnRecordToggle.textContent = '녹음';
  elRecordStatus.hidden = true;
  elRecordTime.textContent = '00:00';
}

/* 녹음 결과 → Base64 변환 후 이미지 목록에 추가 */
function processRecording() {
  if (recordedChunks.length === 0) return;

  const blob   = new Blob(recordedChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  reader.onload = (e) => {
    state.currentImages.push({ id: generateId(), base64: e.target.result, type: 'audio' });
    renderImagePreviews();
    showToast('녹음이 첨부됐습니다.');
  };
  reader.readAsDataURL(blob);
}

// =============================================
// 내보내기 (Export JSON)
// =============================================
function handleExport() {
  if (state.memos.length === 0) {
    showToast('내보낼 메모가 없습니다.');
    return;
  }

  const data     = JSON.stringify(state.memos, null, 2);
  const blob     = new Blob([data], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const dateStr  = formatDateForFile(new Date());
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `my-memo-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeMoreMenu();
  showToast('메모를 내보냈습니다.');
}

// =============================================
// 가져오기 (Import JSON)
// =============================================
function handleImport() {
  elImportInput.value = '';
  elImportInput.click();
  closeMoreMenu();
}

function processImportFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      /* 형식 검증 */
      if (!Array.isArray(imported)) throw new Error('올바른 형식이 아닙니다.');

      const isValid = imported.every(m =>
        m.id && typeof m.content === 'string' && m.createdAt
      );
      if (!isValid) throw new Error('메모 데이터 형식이 올바르지 않습니다.');

      /* 기존 ID 중복 제거 후 추가 */
      const existingIds = new Set(state.memos.map(m => m.id));
      const newMemos    = imported.filter(m => !existingIds.has(m.id));

      state.memos = [...newMemos, ...state.memos];
      saveMemos();
      renderMemoList();
      showToast(`${newMemos.length}개의 메모를 가져왔습니다.`);
    } catch (err) {
      showToast(`가져오기 실패: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// =============================================
// 다크모드
// =============================================
function applyDarkMode(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  elDarkmodeIndicator.classList.toggle('on', isDark);
}

function toggleDarkMode() {
  const settings  = loadSettings();
  settings.darkMode = !settings.darkMode;
  saveSettings(settings);
  applyDarkMode(settings.darkMode);
  closeMoreMenu();
}

// =============================================
// 글자크기
// =============================================
const FONT_SIZE_MAP = {
  small:  '14px',
  medium: '16px',
  large:  '18px',
};

function applyFontSize(size) {
  document.documentElement.style.setProperty(
    '--font-size-current',
    FONT_SIZE_MAP[size] || FONT_SIZE_MAP.medium
  );

  /* 활성 버튼 표시 */
  document.querySelectorAll('.font-size-group button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

function handleFontSize(size) {
  const settings  = loadSettings();
  settings.fontSize = size;
  saveSettings(settings);
  applyFontSize(size);
  closeMoreMenu();
}

// =============================================
// 화면 전환
// =============================================
function showListView() {
  elViewList.hidden   = false;
  elViewEditor.hidden = true;
  elHeaderLogo.style.cursor = '';

  /* 에디터 초기화 */
  elEditorTextarea.value = '';
  elBtnImportant.classList.remove('active');
  elBtnImportant.setAttribute('aria-pressed', 'false');
  elBtnSave.textContent = '저장';
  state.currentMemoId = null;
  state.currentImages = [];

  /* 수정 전용 버튼 숨김 */
  elBtnDelete.hidden = true;
  elBtnShare.hidden  = true;
  elBtnCopy.hidden   = true;

  /* 이미지 선택 메뉴 닫기 */
  closeImagePickerMenu();

  /* 녹음 중이면 중지 */
  stopRecording();

  closeMoreMenu();
}

function showEditorView(memo = null) {
  elViewList.hidden   = true;
  elViewEditor.hidden = false;
  elHeaderLogo.style.cursor = 'pointer';

  if (memo) {
    /* 수정 모드 */
    state.currentMemoId    = memo.id;
    state.currentImages    = memo.images ? [...memo.images] : [];
    elEditorTextarea.value = memo.content;
    elBtnImportant.classList.toggle('active', memo.important);
    elBtnImportant.setAttribute('aria-pressed', String(memo.important));
    elBtnSave.textContent = '수정';

    /* 수정 전용 버튼 표시 */
    elBtnDelete.hidden = false;
    elBtnShare.hidden  = false;
    elBtnCopy.hidden   = false;
  } else {
    /* 새 메모 모드 */
    state.currentMemoId = null;
    state.currentImages = [];
    elEditorTextarea.value = '';
    elBtnImportant.classList.remove('active');
    elBtnImportant.setAttribute('aria-pressed', 'false');
    elBtnSave.textContent = '저장';

    elBtnDelete.hidden = true;
    elBtnShare.hidden  = true;
    elBtnCopy.hidden   = true;
  }

  renderImagePreviews();

  elEditorTextarea.focus();
  closeMoreMenu();
}

// =============================================
// 더보기 메뉴
// =============================================
function openMoreMenu() {
  elMoreMenu.hidden = false;
}

function closeMoreMenu() {
  elMoreMenu.hidden = true;
}

function toggleMoreMenu() {
  elMoreMenu.hidden ? openMoreMenu() : closeMoreMenu();
}

// =============================================
// 메모 목록 렌더링
// =============================================
function renderMemoList() {
  const filtered = state.memos.filter(memo => {
    const matchSearch = memo.content
      .toLowerCase()
      .includes(state.searchKeyword.toLowerCase());
    const matchStar = state.filterStarOnly ? memo.important : true;
    return matchSearch && matchStar;
  });

  elMemoList.innerHTML = '';
  filtered.forEach(memo => {
    const li = document.createElement('li');
    li.innerHTML = createMemoCardHTML(memo);
    elMemoList.appendChild(li);
  });

  elEmptyState.hidden = filtered.length > 0;
}

/* 메모 카드 HTML 생성 */
function createMemoCardHTML(memo) {
  const title     = memo.content.split('\n')[0] || '(내용 없음)';
  const dateStr   = formatDate(memo.updatedAt);
  const starClass = memo.important ? 'active' : '';
  const starFill  = memo.important ? 'currentColor' : 'none';

  /* 첫 번째 이미지 썸네일 */
  const hasImages  = memo.images && memo.images.length > 0;
  const thumbHTML  = hasImages
    ? `<img class="memo-card__image-thumb" src="${memo.images[0].base64}" alt="첨부 이미지">`
    : '';

  return `
    <article class="memo-card" data-id="${memo.id}" role="button" tabindex="0" aria-label="메모: ${escapeHTML(title)}">
      ${thumbHTML}
      <div class="memo-card__body">
        <p class="memo-card__title">${escapeHTML(title)}</p>
        <p class="memo-card__date">${dateStr}</p>
      </div>
      <button
        class="memo-card__star ${starClass}"
        data-id="${memo.id}"
        aria-label="중요 토글"
        aria-pressed="${memo.important}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
          fill="${starFill}" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </article>
  `;
}

// =============================================
// 토스트 알림
// =============================================
let toastTimer = null;

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// =============================================
// 유틸리티
// =============================================
function formatDate(isoString) {
  const d    = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function formatDateForFile(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// 이벤트 바인딩
// =============================================
function bindEvents() {
  /* 새 메모 버튼 */
  elBtnNew.addEventListener('click', () => showEditorView());

  /* 헤더 로고 — 에디터에서 뒤로가기 */
  elHeaderLogo.addEventListener('click', () => {
    if (!elViewEditor.hidden) showListView();
  });

  /* 더보기 메뉴 토글 */
  elBtnMore.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMoreMenu();
  });

  /* 더보기 메뉴 외부 클릭 시 닫기 */
  document.addEventListener('click', (e) => {
    if (!elMoreMenu.hidden && !elMoreMenu.contains(e.target)) {
      closeMoreMenu();
    }
  });

  /* 중요 필터 토글 */
  elBtnStarFilter.addEventListener('click', () => {
    state.filterStarOnly = !state.filterStarOnly;
    elBtnStarFilter.classList.toggle('active', state.filterStarOnly);
    elBtnStarFilter.setAttribute('aria-pressed', String(state.filterStarOnly));
    renderMemoList();
  });

  /* 실시간 검색 */
  elSearchInput.addEventListener('input', (e) => {
    state.searchKeyword = e.target.value;
    renderMemoList();
  });

  /* 에디터 — 중요 토글 */
  elBtnImportant.addEventListener('click', () => {
    const isActive = elBtnImportant.classList.toggle('active');
    elBtnImportant.setAttribute('aria-pressed', String(isActive));
  });

  /* 에디터 — 삭제 */
  elBtnDelete.addEventListener('click', handleDelete);

  /* 에디터 — 공유 */
  elBtnShare.addEventListener('click', handleShare);

  /* 에디터 — 복사 */
  elBtnCopy.addEventListener('click', handleCopy);

  /* 에디터 — 저장/수정 */
  elBtnSave.addEventListener('click', handleSave);

  /* 메모 목록 — 카드 클릭 & 별 클릭 */
  elMemoList.addEventListener('click', (e) => {
    const starBtn = e.target.closest('.memo-card__star');
    if (starBtn) {
      e.stopPropagation();
      toggleImportant(starBtn.dataset.id);
      return;
    }

    const card = e.target.closest('.memo-card');
    if (card) {
      const memo = state.memos.find(m => m.id === card.dataset.id);
      if (memo) showEditorView(memo);
    }
  });

  /* 키보드 접근성 */
  elMemoList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.memo-card');
      if (card) { e.preventDefault(); card.click(); }
    }
  });

  /* 앱 설치 버튼 */
  elBtnInstall.addEventListener('click', handleInstall);

  /* Wake Lock — textarea focus 시 ON, blur 시 OFF */
  elEditorTextarea.addEventListener('focus', requestWakeLock);
  elEditorTextarea.addEventListener('blur',  releaseWakeLock);

  /* 녹음 버튼 토글 */
  elBtnRecordToggle.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  });

  /* 녹음 중지 버튼 */
  elBtnRecordStop.addEventListener('click', stopRecording);

  /* 이미지 버튼 — 선택 메뉴 토글 */
  elBtnImage.addEventListener('click', toggleImagePickerMenu);

  /* 이미지 선택 메뉴 — 갤러리 */
  document.getElementById('btn-pick-gallery').addEventListener('click', () => {
    elImageGalleryInput.value = '';
    elImageGalleryInput.click();
  });

  /* 이미지 선택 메뉴 — 카메라 */
  document.getElementById('btn-pick-camera').addEventListener('click', () => {
    elImageCameraInput.value = '';
    elImageCameraInput.click();
  });

  /* 갤러리 파일 선택 완료 */
  elImageGalleryInput.addEventListener('change', (e) => {
    processImageFiles(e.target.files);
  });

  /* 카메라 촬영 완료 */
  elImageCameraInput.addEventListener('change', (e) => {
    processImageFiles(e.target.files);
  });

  /* 이미지 미리보기 — 삭제 버튼 */
  elImagePreviewList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.image-preview-item__delete');
    if (deleteBtn) removePreviewImage(deleteBtn.dataset.id);
  });

  /* 이미지 선택 메뉴 외부 클릭 시 닫기 */
  document.addEventListener('click', (e) => {
    if (
      !elImagePickerMenu.hidden &&
      !elImagePickerMenu.contains(e.target) &&
      e.target !== elBtnImage
    ) {
      closeImagePickerMenu();
    }
  });

  /* 더보기 메뉴 — 내보내기 */
  document.getElementById('menu-export').addEventListener('click', handleExport);

  /* 더보기 메뉴 — 가져오기 */
  document.getElementById('menu-import').addEventListener('click', handleImport);

  /* 파일 선택 완료 */
  elImportInput.addEventListener('change', (e) => {
    processImportFile(e.target.files[0]);
  });

  /* 더보기 메뉴 — 글자크기 */
  document.querySelectorAll('.font-size-group button').forEach(btn => {
    btn.addEventListener('click', () => handleFontSize(btn.dataset.size));
  });

  /* 더보기 메뉴 — 다크모드 */
  document.getElementById('menu-darkmode').addEventListener('click', toggleDarkMode);
}

// =============================================
// 초기화
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  /* 저장된 설정 적용 */
  const settings = loadSettings();
  applyDarkMode(settings.darkMode);
  applyFontSize(settings.fontSize);

  /* 메모 불러오기 */
  loadMemos();

  /* 이벤트 바인딩 */
  bindEvents();

  /* 목록 렌더링 */
  renderMemoList();
});
