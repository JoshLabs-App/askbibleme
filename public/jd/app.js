import { appAssetPath, getAppBasePath } from './base-path.js';

const STORAGE_KEY = 'sermon-progress-v2';
const LISTENED_KEY = 'sermon-listened-v2';
const CURRENT_KEY = 'sermon-current-v2';
const DIRECTORY_KEY = 'sermon-directory-v2';
const CATEGORY_KEY = 'sermon-category-v2';
const CATEGORY_SELECT_KEY = 'sermon-category-select-v1';
const RATE_KEY = 'sermon-rate-v2';
const FAVORITES_KEY = 'sermon-favorites-v2';
const NOTES_KEY = 'sermon-notes-v2';
const SESSION_KEY = 'sermon-session-v1';
const SHARE_QUERY_KEY = 'p';

const CATEGORY_ORDER = ['主日', '新约', '旧约', '系列'];
const DEFAULT_CATEGORY = '新约';
const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

const state = {
  data: null,
  books: [],
  tracks: [],
  progress: loadJSON(STORAGE_KEY, {}),
  listened: loadJSON(LISTENED_KEY, {}),
  favorites: loadJSON(FAVORITES_KEY, {}),
  notes: loadJSON(NOTES_KEY, {}),
  currentTrack: null,
  selectedBookTitle: loadStoredString(DIRECTORY_KEY),
  selectedCategory: loadSelectedCategory() || DEFAULT_CATEGORY,
  categorySelections: normalizeCategorySelections(loadJSON(CATEGORY_SELECT_KEY, {})),
  searchQuery: '',
  playbackRate: loadPlaybackRate(),
  sleepTimerId: null,
  sleepTimerLabel: '',
  audioAliases: new Map(),
};

const $audio = document.querySelector('#audio');
const $playToggle = document.querySelector('#play-toggle');
const $progressSlider = document.querySelector('#progress-slider');
const $trackTitle = document.querySelector('#track-title');
const $trackBook = document.querySelector('#track-book');
const $trackDate = document.querySelector('#track-date');
const $timeCurrent = document.querySelector('#time-current');
const $timeTotal = document.querySelector('#time-total');
const $categoryBookList = document.querySelector('#category-book-list');
const $categoryTabs = document.querySelectorAll('.category-tab');
const $selectedBookTracks = document.querySelector('#selected-book-tracks');
const $skipBackButton = document.querySelector('#skip-back-button');
const $skipForwardButton = document.querySelector('#skip-forward-button');
const $prevButton = document.querySelector('#prev-button');
const $nextButton = document.querySelector('#next-button');
const $shareButton = document.querySelector('#share-button');
const $speedButton = document.querySelector('#speed-button');

let saveSessionTimer = null;
let pendingScrollTop = 0;
let shareToastTimer = null;
let shareIdByKey = new Map();
let shareKeyById = new Map();

function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function saveCategorySelections() {
  saveJSON(CATEGORY_SELECT_KEY, state.categorySelections);
  scheduleSaveSession();
}

function loadStoredString(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function loadPlaybackRate() {
  const rate = Number(loadStoredString(RATE_KEY));
  return SPEEDS.includes(rate) ? rate : 1;
}

function normalizeCategory(category) {
  if (category === '其他' || category === '其它') return '系列';
  return CATEGORY_ORDER.includes(category) ? category : '';
}

function normalizeCategorySelections(selections) {
  const next = {};
  for (const [category, title] of Object.entries(selections || {})) {
    const normalized = normalizeCategory(category);
    if (normalized) next[normalized] = title;
  }
  return next;
}

function loadSelectedCategory() {
  return normalizeCategory(loadStoredString(CATEGORY_KEY));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildArtDataUrl(title, subtitle, accent = '#FFB100') {
  const safeTitle = escapeHtml(title || '讲道集');
  const safeSubtitle = escapeHtml(subtitle || 'Sunday');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" fill="none">
      <defs>
        <radialGradient id="fade" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="320" height="320" fill="#FFFBF3"/>
      <circle cx="160" cy="120" r="100" fill="url(#fade)"/>
      <rect x="48" y="48" width="224" height="224" rx="12" fill="#FFFFFF" stroke="#EAEAEA" stroke-width="1"/>
      <rect x="72" y="88" width="176" height="2" rx="1" fill="${accent}" fill-opacity="0.35"/>
      <rect x="72" y="230" width="176" height="2" rx="1" fill="${accent}" fill-opacity="0.15"/>
      <text x="160" y="158" text-anchor="middle" fill="#2A2826" font-family="Noto Serif SC, Songti SC, STSong, serif" font-size="26" font-weight="600">${safeTitle}</text>
      <text x="160" y="186" text-anchor="middle" fill="#7A7570" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="13" font-weight="500" letter-spacing="0.5">${safeSubtitle}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function primaryBookTitle(title) {
  return String(title || '')
    .split(/[、，,\/]/)
    .map((part) => part.trim())
    .find(Boolean) || '';
}

function cleanRemoteAudioUrl(url) {
  return String(url || '').split('#')[0].trim();
}

function resolveAudioSrc(lesson) {
  return cleanRemoteAudioUrl(lesson.audioUrl) || lesson.localAudioUrl || '';
}

function resolveLessonDisplayLabel(lesson, index = 0) {
  const direct = String(lesson.lesson || '').trim();
  if (direct) {
    const compact = direct.match(/^第?\s*(\d{1,3})\s*(?:课|講|讲)?$/);
    if (compact) return compact[1];
    if (/^\d{1,3}$/.test(direct)) return direct;
    return String(index + 1);
  }

  return String(index + 1);
}

function formatSundaySermonTitle(lesson) {
  const raw = String(lesson?.lesson || lesson?.displayLabel || '').trim();
  return raw || '未命名讲道';
}

function getSundaySermons() {
  const query = normalize(state.searchQuery);
  return state.books
    .filter((book) => book.category === '主日')
    .flatMap((book) =>
      book.lessons.map((lesson) => ({
        ...lesson,
        bookTitle: book.title,
        displayTitle: formatSundaySermonTitle(lesson),
      })),
    )
    .filter((sermon) => {
      if (!query) return true;
      const haystack = [sermon.displayTitle, sermon.lessonDate, sermon.bookTitle, sermon.teacher].join(' ');
      return normalize(haystack).includes(query);
    })
    .sort((a, b) => {
      const delta = new Date(b.lessonDate || 0).getTime() - new Date(a.lessonDate || 0).getTime();
      if (delta !== 0) return delta;
      return a.displayTitle.localeCompare(b.displayTitle, 'zh-Hans');
    });
}

function isGaoTeacher(teacher) {
  return normalize(teacher).includes('高路');
}

function isExcludedBookTitle(title) {
  return normalize(title).includes('慕道班');
}

function isUnnamedOtherBook(book) {
  const category = normalizeCategory(book.category);
  return (
    category === '系列' &&
    (book.lessons || []).length > 0 &&
    (book.lessons || []).every((lesson) => !normalize(lesson.teacher))
  );
}

function bookOrder(book) {
  const order = [
    '马太福音',
    '马可福音',
    '路加福音',
    '约翰福音',
    '使徒行传',
    '罗马书',
    '哥林多前书',
    '哥林多后书',
    '加拉太书',
    '以弗所书',
    '腓立比书',
    '歌罗西书',
    '帖撒罗尼迦前书',
    '帖撒罗尼迦后书',
    '提摩太前书',
    '提摩太后书',
    '提多书',
    '腓利门书',
    '希伯来书',
    '雅各书',
    '彼得前书',
    '彼得后书',
    '约翰一书',
    '约翰二书',
    '约翰三书',
    '犹大书',
    '启示录',
    '创世记',
    '出埃及记',
    '利未记',
    '民数记',
    '申命记',
    '约书亚记',
    '士师记',
    '路得记',
    '撒母耳记上',
    '撒母耳记下',
    '列王纪上',
    '列王纪下',
    '历代志上',
    '历代志下',
    '以斯拉记',
    '尼希米记',
    '以斯帖记',
    '约伯记',
    '诗篇',
    '箴言',
    '传道书',
    '雅歌',
    '以赛亚书',
    '耶利米书',
    '耶利米哀歌',
    '以西结书',
    '但以理书',
    '何西阿书',
    '约珥书',
    '阿摩司书',
    '俄巴底亚书',
    '约拿书',
    '弥迦书',
    '那鸿书',
    '哈巴谷书',
    '西番雅书',
    '哈该书',
    '撒迦利亚书',
    '玛拉基书',
  ];

  const index = order.findIndex((title) => normalize(book.title).includes(normalize(title)));
  return index >= 0 ? index : 1000 + normalize(book.title).charCodeAt(0);
}

function sundayBookOrder(book) {
  const year = Number(String(book.title || '').match(/(20\d{2})/)?.[1] || 0);
  return year > 0 ? -year : 0;
}

function compareBooks(a, b) {
  const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) return categoryDelta;
  if (a.category === '主日' && b.category === '主日') {
    return sundayBookOrder(a) - sundayBookOrder(b);
  }
  return bookOrder(a) - bookOrder(b);
}

function isGaoLuLesson(lesson) {
  return Boolean(lesson.isGaoLu) || isGaoTeacher(lesson.teacher);
}

function isGaoLuPrimaryBook(book) {
  const withAudio = (book.lessons || []).filter((lesson) => resolveAudioSrc(lesson));
  if (withAudio.length === 0) return false;
  const gaoCount = withAudio.filter(isGaoLuLesson).length;
  return gaoCount > 0 && gaoCount / withAudio.length > 0.5;
}

function shouldKeepBook(book) {
  if (isExcludedBookTitle(book.title)) return false;
  if (book.category === '主日') {
    return (book.lessons || []).some((lesson) => resolveAudioSrc(lesson) && isGaoLuLesson(lesson));
  }
  return isGaoLuPrimaryBook(book);
}

function normalizeBook(book) {
  const unnamedOtherBook = isUnnamedOtherBook(book);
  const lessons = (book.lessons || [])
    .filter((lesson) => unnamedOtherBook || isGaoLuLesson(lesson))
    .map((lesson, index) => ({
      ...lesson,
      audioSrc: resolveAudioSrc(lesson),
      lessonDate: lesson.date || '',
      lessonFileUrl: lesson.fileUrl || '',
      videoUrl: lesson.videoUrl || '',
      teacher: lesson.teacher || book.latestTeacher || '讲员',
      displayLabel:
        book.category === '主日'
          ? formatSundaySermonTitle(lesson)
          : resolveLessonDisplayLabel(lesson, index),
      trackNo: index + 1,
    }))
    .filter((lesson) => Boolean(lesson.audioSrc));

  return {
    ...book,
    category: normalizeCategory(book.category) || book.category,
    lessonCount: lessons.length,
    lessons,
  };
}

function loadProgress() {
  return loadJSON(STORAGE_KEY, {});
}

function loadListened() {
  return loadJSON(LISTENED_KEY, {});
}

function loadFavorites() {
  return loadJSON(FAVORITES_KEY, {});
}

function loadNotes() {
  return loadJSON(NOTES_KEY, {});
}

function saveProgress() {
  saveJSON(STORAGE_KEY, state.progress);
}

function saveListened() {
  saveJSON(LISTENED_KEY, state.listened);
}

function saveFavorites() {
  saveJSON(FAVORITES_KEY, state.favorites);
}

function saveNotes() {
  saveJSON(NOTES_KEY, state.notes);
}

function registerAudioAlias(alias, storageKey) {
  if (!alias || !storageKey) return;
  state.audioAliases.set(alias, storageKey);
}

function trackStorageKey(bookTitle, trackNo) {
  return `${bookTitle}::${trackNo}`;
}

function buildAudioAliasIndex(books) {
  state.audioAliases = new Map();
  for (const book of books) {
    for (const lesson of book.lessons) {
      const storageKey = trackStorageKey(book.title, lesson.trackNo);
      registerAudioAlias(storageKey, storageKey);
      registerAudioAlias(lesson.audioSrc, storageKey);
      registerAudioAlias(lesson.localAudioUrl, storageKey);
      registerAudioAlias(cleanRemoteAudioUrl(lesson.audioUrl), storageKey);
    }
  }
}

function remapStoredRecordMap(source) {
  const next = {};
  for (const [key, value] of Object.entries(source || {})) {
    const canonical = audioKey(key);
    const existing = next[canonical];
    const nextStamp = value?.updatedAt || value?.heardAt || value?.favoritedAt || 0;
    const existingStamp = existing?.updatedAt || existing?.heardAt || existing?.favoritedAt || 0;
    if (!existing || nextStamp >= existingStamp) {
      next[canonical] = value;
    }
  }
  return next;
}

function migrateLegacyStorage() {
  state.progress = remapStoredRecordMap(state.progress);
  state.listened = remapStoredRecordMap(state.listened);
  state.favorites = remapStoredRecordMap(state.favorites);
  state.notes = remapStoredRecordMap(state.notes);
  saveProgress();
  saveListened();
  saveFavorites();
  saveNotes();

  const savedCurrent = loadStoredString(CURRENT_KEY);
  if (savedCurrent) {
    try {
      window.localStorage.setItem(CURRENT_KEY, audioKey(savedCurrent));
    } catch {}
  }

  const savedCategory = normalizeCategory(loadStoredString(CATEGORY_KEY));
  if (savedCategory) {
    try {
      window.localStorage.setItem(CATEGORY_KEY, savedCategory);
    } catch {}
  }

  const savedSelections = normalizeCategorySelections(loadJSON(CATEGORY_SELECT_KEY, {}));
  saveJSON(CATEGORY_SELECT_KEY, savedSelections);
  state.categorySelections = savedSelections;

  const session = loadJSON(SESSION_KEY, null);
  if (session?.category) {
    const normalizedCategory = normalizeCategory(session.category);
    const normalizedSession = {
      ...session,
      category: normalizedCategory || session.category,
      categorySelections: normalizeCategorySelections(session.categorySelections),
    };
    if (normalizedCategory !== session.category || session.categorySelections) {
      saveJSON(SESSION_KEY, normalizedSession);
    }
  }
}

function buildShareIndex(tracks) {
  shareIdByKey = new Map();
  shareKeyById = new Map();
  const sorted = [...tracks].sort((a, b) => a.storageKey.localeCompare(b.storageKey, 'zh-Hans'));
  sorted.forEach((track, index) => {
    const id = index + 1;
    shareIdByKey.set(track.storageKey, id);
    shareKeyById.set(id, track.storageKey);
  });
}

function resolveShareReference(ref) {
  const trimmed = String(ref || '').trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    return shareKeyById.get(Number(trimmed)) || '';
  }
  return trimmed;
}

function getShareBaseUrl() {
  return `${window.location.origin}${getAppBasePath()}/`;
}
function findTrackByReference(ref) {
  if (!ref) return null;
  const resolved = resolveShareReference(ref);
  const storageKey = audioKey(resolved || ref);
  return (
    state.tracks.find(
      (track) =>
        track.storageKey === storageKey ||
        track.storageKey === ref ||
        track.storageKey === resolved ||
        track.audioSrc === ref ||
        track.audioSrc === storageKey,
    ) || null
  );
}

function parseSharePath(pathname) {
  const base = getAppBasePath();
  let rest = String(pathname || '');
  if (base && rest.startsWith(base)) {
    rest = rest.slice(base.length) || '/';
  }

  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return '';

  const first = parts[0] === 'index.html' ? parts[1] : parts[0];
  const id = Number(first);
  if (!Number.isInteger(id) || id <= 0) return '';

  return shareKeyById.get(id) || '';
}

function parseShareFromUrl() {
  const url = new URL(window.location.href);
  const fromPath = parseSharePath(url.pathname);
  if (fromPath) return fromPath;

  const raw = url.searchParams.get(SHARE_QUERY_KEY) || '';
  return resolveShareReference(raw);
}

function buildShareUrl(track = state.currentTrack) {
  const shareId = shareIdByKey.get(track?.storageKey || '');
  if (!shareId) {
    return getShareBaseUrl();
  }

  return `${window.location.origin}${getAppBasePath()}/${shareId}`;
}

function clearShareFromUrl() {
  const url = new URL(window.location.href);
  const hadPathShare = Boolean(parseSharePath(url.pathname));
  const hadQueryShare = url.searchParams.has(SHARE_QUERY_KEY);

  if (!hadPathShare && !hadQueryShare) return;

  url.pathname = getAppBasePath() || '/';
  url.searchParams.delete(SHARE_QUERY_KEY);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function showShareToast(message) {
  if (!$shareButton) return;
  const originalLabel = $shareButton.getAttribute('aria-label') || '复制分享链接';
  $shareButton.setAttribute('aria-label', message);
  $shareButton.title = message;
  window.clearTimeout(shareToastTimer);
  shareToastTimer = window.setTimeout(() => {
    $shareButton.setAttribute('aria-label', originalLabel);
    $shareButton.title = '复制分享链接';
  }, 1800);
}

async function copyShareLink() {
  if (!state.currentTrack) {
    showShareToast('请先选择讲道');
    return;
  }

  const url = buildShareUrl(state.currentTrack);

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.writeText(url);
    showShareToast('已复制');
  } catch {
    showShareToast('复制失败');
  }
}

function getPageScrollElement() {
  return document.querySelector('.page-scroll');
}

function saveSession() {
  const scrollTop = getPageScrollElement()?.scrollTop || pendingScrollTop || 0;
  pendingScrollTop = scrollTop;
  saveJSON(SESSION_KEY, {
    category: state.selectedCategory,
    bookTitle: state.selectedBookTitle,
    categorySelections: state.categorySelections,
    currentStorageKey: state.currentTrack?.storageKey || audioKey(state.currentTrack?.audioSrc || ''),
    scrollTop,
    updatedAt: Date.now(),
  });
}

function scheduleSaveSession() {
  window.clearTimeout(saveSessionTimer);
  saveSessionTimer = window.setTimeout(saveSession, 350);
}

function applyStoredSession() {
  const session = loadJSON(SESSION_KEY, null);
  if (!session) return null;

  if (CATEGORY_ORDER.includes(normalizeCategory(session.category))) {
    setSelectedCategory(session.category);
  }
  if (session.bookTitle) {
    setSelectedBookTitle(session.bookTitle);
  }
  if (session.categorySelections && typeof session.categorySelections === 'object') {
    state.categorySelections = normalizeCategorySelections({
      ...state.categorySelections,
      ...session.categorySelections,
    });
    saveCategorySelections();
  }
  pendingScrollTop = Number(session.scrollTop) || 0;
  return session;
}

function restoreScrollPosition() {
  const scrollTop = pendingScrollTop;
  if (!scrollTop) return;
  requestAnimationFrame(() => {
    const scrollEl = getPageScrollElement();
    if (scrollEl) scrollEl.scrollTop = scrollTop;
    pendingScrollTop = 0;
  });
}

function persistPlaybackSnapshot() {
  if (!$audio.src && !state.currentTrack) return;
  const src = $audio.currentSrc || $audio.src || state.currentTrack?.audioSrc || '';
  if (!src) return;
  setSavedPosition(src, $audio.currentTime || 0, $audio.duration);
  if (state.currentTrack?.storageKey) {
    try {
      window.localStorage.setItem(CURRENT_KEY, state.currentTrack.storageKey);
    } catch {}
  }
  saveSession();
}

function bindSessionPersistence() {
  const scrollEl = getPageScrollElement();
  scrollEl?.addEventListener(
    'scroll',
    () => {
      pendingScrollTop = scrollEl.scrollTop;
      scheduleSaveSession();
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistPlaybackSnapshot();
    }
  });

  window.addEventListener('pagehide', persistPlaybackSnapshot);
  window.addEventListener('beforeunload', persistPlaybackSnapshot);
}

function setSelectedBookTitle(title) {
  state.selectedBookTitle = title || '';
  try {
    if (title) {
      window.localStorage.setItem(DIRECTORY_KEY, title);
    } else {
      window.localStorage.removeItem(DIRECTORY_KEY);
    }
  } catch {}
  scheduleSaveSession();
}

function isFirstVisit() {
  if (loadJSON(SESSION_KEY, null)) return false;
  if (loadSelectedCategory()) return false;
  if (loadStoredString(CURRENT_KEY)) return false;
  if (loadStoredString(DIRECTORY_KEY)) return false;
  return true;
}

function restoreTrack(track, { autoplay = false } = {}) {
  if (!track) return;
  state.currentTrack = track;
  $audio.src = track.audioSrc;
  $audio.playbackRate = state.playbackRate;
  $audio.load();
  try {
    window.localStorage.setItem(CURRENT_KEY, track.storageKey || audioKey(track.audioSrc));
  } catch {}
  scheduleSaveSession();
  if (autoplay) {
    void $audio.play().catch(() => {});
  }
}

function applyFirstVisitDefaults() {
  setSelectedCategory(DEFAULT_CATEGORY);
  const book = getSelectedBookForCategory(DEFAULT_CATEGORY);
  if (!book) return;
  setSelectedBookTitle(book.title);
  setCategorySelection(DEFAULT_CATEGORY, book.title);
  const track =
    state.tracks.find((item) => item.bookTitle === book.title && item.trackNo === 1) ||
    state.tracks.find((item) => item.bookTitle === book.title);
  if (track) restoreTrack(track);
}

function setSelectedCategory(category) {
  state.selectedCategory = normalizeCategory(category) || DEFAULT_CATEGORY;
  try {
    window.localStorage.setItem(CATEGORY_KEY, state.selectedCategory);
  } catch {}
  scheduleSaveSession();
}

function setCategorySelection(category, title) {
  const normalized = normalizeCategory(category);
  if (!normalized) return;
  if (title) {
    state.categorySelections[normalized] = title;
  } else {
    delete state.categorySelections[normalized];
  }
  saveCategorySelections();
}

function setPlaybackRate(rate) {
  state.playbackRate = rate;
  $audio.playbackRate = rate;
  try {
    window.localStorage.setItem(RATE_KEY, String(rate));
  } catch {}
  syncControlLabels();
}

function getBookByTitle(title) {
  return state.books.find((book) => book.title === title) || null;
}

function getSelectedCategory() {
  if (CATEGORY_ORDER.includes(state.selectedCategory) && state.books.some((book) => book.category === state.selectedCategory)) {
    return state.selectedCategory;
  }
  const fallback =
    state.books.find((book) => book.category === DEFAULT_CATEGORY)?.category ||
    state.books.find((book) => CATEGORY_ORDER.includes(book.category))?.category ||
    DEFAULT_CATEGORY;
  setSelectedCategory(fallback);
  return fallback;
}

function getBooksByCategory(category) {
  const query = normalize(state.searchQuery);
  return state.books.filter((book) => {
    const categoryMatch = book.category === category;
    if (!categoryMatch) return false;
    if (!query) return true;
    const haystack = [
      book.title,
      book.category,
      book.latestTeacher,
      book.latestLesson,
      ...(book.lessons || []).slice(0, 8).map((lesson) => `${lesson.displayLabel} ${lesson.teacher} ${lesson.lessonDate}`),
    ].join(' ');
    return normalize(haystack).includes(query);
  });
}

function getVisibleBooks() {
  return getBooksByCategory(getSelectedCategory());
}

function getSelectedBookForCategory(category) {
  const books = getBooksByCategory(category);
  if (books.length === 0) return null;
  const stored = state.categorySelections[category];
  const known = books.find((book) => book.title === stored);
  if (known) return known;
  return books[0];
}

function getSelectedBook() {
  const visible = getVisibleBooks();
  const known = visible.find((book) => book.title === state.selectedBookTitle);
  if (known) return known;

  const byCurrent = state.currentTrack ? getBookByTitle(state.currentTrack.bookTitle) : null;
  if (byCurrent && byCurrent.category === getSelectedCategory()) {
    setSelectedBookTitle(byCurrent.title);
    return byCurrent;
  }

  const selected = visible[0] || state.books.find((book) => book.category === getSelectedCategory()) || state.books[0] || null;
  if (selected) setSelectedBookTitle(selected.title);
  return selected;
}

function audioKey(src) {
  if (!src) return '';
  return state.audioAliases.get(src) || src;
}

function getSavedPosition(src) {
  return state.progress[audioKey(src)] || null;
}

function setSavedPosition(src, currentTime, duration) {
  const key = audioKey(src);
  if (!key || !Number.isFinite(currentTime) || currentTime < 0) return;
  state.progress[key] = {
    currentTime,
    duration: Number.isFinite(duration) ? duration : null,
    updatedAt: Date.now(),
  };
  saveProgress();
}

function clearSavedPosition(src) {
  const key = audioKey(src);
  if (!key || !state.progress[key]) return;
  delete state.progress[key];
  saveProgress();
}

function markListened(src) {
  const key = audioKey(src);
  if (!key || state.listened[key]) return false;
  state.listened[key] = { heardAt: Date.now() };
  saveListened();
  return true;
}

function hasListened(src) {
  return Boolean(state.listened[audioKey(src)]);
}

function isFavorite(src) {
  return Boolean(state.favorites[audioKey(src)]);
}

function toggleFavorite(src) {
  const key = audioKey(src);
  if (!key) return;
  if (state.favorites[key]) {
    delete state.favorites[key];
  } else {
    state.favorites[key] = { favoritedAt: Date.now() };
  }
  saveFavorites();
}

function getNote(src) {
  return state.notes[audioKey(src)] || '';
}

function setNote(src, note) {
  const key = audioKey(src);
  if (!key) return;
  if (!note) {
    delete state.notes[key];
  } else {
    state.notes[key] = note;
  }
  saveNotes();
}

function getRecentTracks() {
  const seen = new Map();
  for (const track of state.tracks) {
    const key = track.storageKey || audioKey(track.audioSrc);
    const progress = state.progress[key];
    const listened = state.listened[key];
    const marker = Math.max(progress?.updatedAt || 0, listened?.heardAt || 0);
    if (marker) {
      seen.set(key, { ...track, marker });
    }
  }
  return [...seen.values()].sort((a, b) => b.marker - a.marker);
}

function getCurrentTrackIndex() {
  if (!state.currentTrack) return -1;
  return state.tracks.findIndex((track) => track.audioSrc === state.currentTrack.audioSrc);
}

function getTrackLabel(track) {
  if (track.bookCategory === '主日') {
    const title = String(track.lesson || '').trim();
    if (title) return title.length > 42 ? `${title.slice(0, 42)}…` : title;
  }
  return String(track.trackNo || track.lesson || 1);
}

function getTrackSubtitle(track) {
  return `${track.bookTitle} · ${track.teacher}`;
}

function getCurrentBookProgress(book) {
  const listenedCount = book.lessons.filter((lesson) => hasListened(lesson.audioSrc)).length;
  const percent = book.lessons.length ? Math.round((listenedCount / book.lessons.length) * 100) : 0;
  return { listenedCount, percent };
}

function renderCategoryTabs() {
  const activeCategory = getSelectedCategory();

  $categoryTabs.forEach((tab) => {
    const category = tab.dataset.category || '';
    const isActive = category === activeCategory;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
  });

  if (!$categoryBookList) return;

  if (activeCategory === '主日') {
    const sermons = getSundaySermons();
    if (sermons.length === 0) {
      $categoryBookList.innerHTML = `
        <div class="category-book-empty">没有找到主日讲道</div>
      `;
      return;
    }

    const currentSrc = state.currentTrack?.audioSrc || '';
    $categoryBookList.innerHTML = sermons
      .map((sermon, index) => {
        const active = sermon.audioSrc === currentSrc;
        const heard = hasListened(sermon.audioSrc);
        const number = sermons.length - index;
        return `
          <button
            class="category-book-item category-book-item--sermon ${heard ? 'is-heard' : ''} ${active ? 'is-active' : ''}"
            type="button"
            data-action="play-track"
            data-src="${escapeHtml(sermon.audioSrc)}"
            aria-pressed="${active ? 'true' : 'false'}"
            aria-label="播放 ${number} ${escapeHtml(sermon.displayTitle)}"
          >
            <span class="category-book-index">${number}</span>
            <span class="category-book-title">${escapeHtml(sermon.displayTitle)}</span>
            <span class="category-book-meta">${escapeHtml(formatDate(sermon.lessonDate))}</span>
          </button>
        `;
      })
      .join('');
    return;
  }

  const books = getBooksByCategory(activeCategory);
  if (books.length === 0) {
    $categoryBookList.innerHTML = `
      <div class="category-book-empty">没有找到${escapeHtml(activeCategory === '系列' ? '系列' : activeCategory === '主日' ? '主日讲道' : `${activeCategory}书卷`)}</div>
    `;
    return;
  }

  const selectedTitle = getSelectedBook()?.title || '';
  $categoryBookList.innerHTML = books
    .map((book) => {
      const { percent } = getCurrentBookProgress(book);
      const active = book.title === selectedTitle ? 'is-active' : '';
      return `
        <button
          class="category-book-item ${active}"
          type="button"
          data-action="select-book"
          data-title="${escapeHtml(book.title)}"
          aria-pressed="${active ? 'true' : 'false'}"
        >
          <span class="category-book-title">${escapeHtml(book.title)}</span>
          <span class="category-book-meta">${escapeHtml(String(book.lessonCount))}篇 · ${percent}%</span>
        </button>
      `;
    })
    .join('');
}

function renderSelectedBookPanel() {
  const book = getSelectedBook();
  const $trackPanel = document.querySelector('.track-panel');
  if ($trackPanel) {
    $trackPanel.hidden = getSelectedCategory() === '主日';
  }

  if (!book || getSelectedCategory() === '主日') {
    if ($selectedBookTracks) $selectedBookTracks.innerHTML = '';
    return;
  }

  const currentSrc = state.currentTrack?.audioSrc || '';
  $selectedBookTracks.innerHTML = book.lessons
    .map((lesson, index) => {
      const active = lesson.audioSrc === currentSrc;
      const heard = hasListened(lesson.audioSrc);
      const note = getNote(lesson.audioSrc);
      const favorite = isFavorite(lesson.audioSrc);
      const label = String(lesson.trackNo || index + 1);
      return `
        <button
          class="track-pill ${active ? 'is-active' : ''} ${heard ? 'is-heard' : ''} ${favorite ? 'is-favorite' : ''}"
          type="button"
          data-action="play-track"
          data-src="${escapeHtml(lesson.audioSrc)}"
          aria-pressed="${active ? 'true' : 'false'}"
          aria-label="播放 ${escapeHtml(book.title)} ${escapeHtml(label)}"
        >
          <span class="track-pill-label">${escapeHtml(label)}</span>
          ${note ? '<span class="track-pill-note">笔记</span>' : ''}
        </button>
      `;
    })
    .join('');
}

function renderSummary() {
  return;
}

function updateTrackRefs(track) {
  if (!track) {
    $trackTitle.textContent = '未选择讲道';
    $trackBook.textContent = '';
    $trackBook.hidden = true;
    $trackDate.textContent = '--';
    $trackDate.hidden = false;
    return;
  }

  $trackTitle.textContent =
    track.bookCategory === '主日' ? getTrackLabel(track) : `${track.bookTitle} · ${getTrackLabel(track)}`;
  $trackBook.textContent = track.teacher || '';
  $trackBook.hidden = !track.teacher;
  $trackDate.textContent = track.date ? formatDate(track.date) : '--';
  $trackDate.hidden = !track.date;
}

function syncControlLabels() {
  if ($playToggle) {
    const playing = Boolean(state.currentTrack) && !$audio.paused;
    $playToggle.textContent = playing ? '❚❚' : '▶';
    $playToggle.setAttribute('aria-label', playing ? '暂停' : '播放');
  }

  if ($speedButton) {
    const rateLabel = Number.isInteger(state.playbackRate)
      ? `${state.playbackRate}x`
      : `${state.playbackRate}x`;
    $speedButton.textContent = rateLabel;
    $speedButton.setAttribute('aria-label', `播放速度 ${rateLabel}`);
  }

  if ($shareButton) {
    $shareButton.disabled = !state.currentTrack;
  }
}

function syncSelectedBookStyles() {
  document.querySelectorAll('.track-pill').forEach((pill) => {
    const active = pill.dataset.src === state.currentTrack?.audioSrc;
    pill.classList.toggle('is-active', active);
    pill.classList.toggle('is-heard', hasListened(pill.dataset.src));
    pill.classList.toggle('is-favorite', isFavorite(pill.dataset.src));
    pill.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  syncCategoryBookList();
}

function syncCategoryBookList() {
  if (!$categoryBookList) return;

  if (getSelectedCategory() === '主日') {
    const currentSrc = state.currentTrack?.audioSrc || '';
    $categoryBookList.querySelectorAll('.category-book-item').forEach((item) => {
      const active = item.dataset.src === currentSrc;
      item.classList.toggle('is-active', active);
      item.classList.toggle('is-heard', hasListened(item.dataset.src));
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    return;
  }

  const selectedTitle = getSelectedBook()?.title || '';
  $categoryBookList.querySelectorAll('.category-book-item').forEach((item) => {
    const active = item.dataset.title === selectedTitle;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updatePlaybackUI() {
  const currentTime = Number.isFinite($audio.currentTime) ? $audio.currentTime : 0;
  const saved = getSavedPosition($audio.currentSrc || $audio.src || '');
  const duration = Number.isFinite($audio.duration) && $audio.duration > 0 ? $audio.duration : saved?.duration || 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  if ($progressSlider) {
    const max = Number($progressSlider.max || 1000);
    $progressSlider.value = `${Math.round(progress * max)}`;
    $progressSlider.style.setProperty('--progress', `${progress * 100}%`);
  }
  $timeCurrent.textContent = formatTime(currentTime);
  $timeTotal.textContent = formatTime(duration);
  syncCategoryBookList();
  updateTrackRefs(state.currentTrack);
  syncSelectedBookStyles();
  syncControlLabels();
}

function renderAll() {
  renderCategoryTabs();
  renderSelectedBookPanel();
  renderSummary();
  updatePlaybackUI();
}

function selectTrack(track, { autoplay = false } = {}) {
  if (!track) return;
  state.currentTrack = track;
  setSelectedBookTitle(track.bookTitle);
  setSelectedCategory(track.bookCategory);
  setCategorySelection(track.bookCategory, track.bookTitle);
  try {
    window.localStorage.setItem(CURRENT_KEY, track.storageKey || audioKey(track.audioSrc));
  } catch {}
  $audio.src = track.audioSrc;
  $audio.playbackRate = state.playbackRate;
  $audio.load();
  renderAll();
  scheduleSaveSession();
  if (autoplay) {
    void $audio.play().catch(() => {});
  }
}

function selectBook(title, { autoplay = false } = {}) {
  const book = getBookByTitle(title);
  if (!book) return;
  setSelectedBookTitle(book.title);
  setSelectedCategory(book.category);
  const currentInBook = state.currentTrack?.bookTitle === book.title
    ? state.currentTrack
    : null;
  const track = currentInBook || book.lessons[0];
  if (track) {
    selectTrack(
      {
        ...track,
        bookTitle: book.title,
        bookCategory: book.category,
      },
      { autoplay }
    );
  } else {
    renderAll();
  }
}

function playTrackBySrc(src, { autoplay = true } = {}) {
  const track = state.tracks.find((item) => item.audioSrc === src);
  if (track) selectTrack(track, { autoplay });
}

function playRelativeTrack(delta) {
  if (!state.currentTrack) return;

  if (state.currentTrack.bookCategory === '主日') {
    const sermons = getSundaySermons();
    const currentIndex = sermons.findIndex((sermon) => sermon.audioSrc === state.currentTrack.audioSrc);
    if (currentIndex < 0) return;
    const nextSermon = sermons[currentIndex + delta];
    if (nextSermon) {
      playTrackBySrc(nextSermon.audioSrc, { autoplay: true });
    }
    return;
  }

  if (!state.tracks.length) return;
  const currentIndex = getCurrentTrackIndex();
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + state.tracks.length) % state.tracks.length;
  selectTrack(state.tracks[nextIndex], { autoplay: true });
}

function seekBy(deltaSeconds) {
  if (!$audio.src) return;
  const next = Math.max(0, ($audio.currentTime || 0) + deltaSeconds);
  try {
    $audio.currentTime = next;
  } catch {}
  setSavedPosition($audio.currentSrc || $audio.src || '', $audio.currentTime, $audio.duration);
  updatePlaybackUI();
}

function seekToProgress(progress) {
  const saved = getSavedPosition($audio.currentSrc || $audio.src || '');
  const duration = Number.isFinite($audio.duration) && $audio.duration > 0 ? $audio.duration : saved?.duration || 0;
  if (!duration) return;
  const clamped = Math.max(0, Math.min(1, progress));
  const nextTime = clamped >= 0.99 ? duration : duration * clamped;
  $audio.currentTime = nextTime;
  setSavedPosition($audio.currentSrc || $audio.src || '', $audio.currentTime, $audio.duration);
  updatePlaybackUI();
}

function cyclePlaybackRate() {
  const current = SPEEDS.indexOf(state.playbackRate);
  const next = SPEEDS[(current + 1) % SPEEDS.length];
  setPlaybackRate(next);
}

function toggleSleepTimer() {
  if (state.sleepTimerId) {
    window.clearTimeout(state.sleepTimerId);
    state.sleepTimerId = null;
    state.sleepTimerLabel = '';
    syncControlLabels();
    return;
  }

  state.sleepTimerLabel = '睡眠 15m';
  state.sleepTimerId = window.setTimeout(() => {
    $audio.pause();
    state.sleepTimerId = null;
    state.sleepTimerLabel = '';
    syncControlLabels();
  }, 15 * 60 * 1000);
  syncControlLabels();
}

function openCurrentScripture() {
  const track = state.currentTrack;
  if (!track) return;
  const book = getBookByTitle(track.bookTitle);
  const current = book?.lessons.find((lesson) => lesson.audioSrc === track.audioSrc) || null;
  const url = current?.lessonFileUrl || current?.videoUrl || book?.slug || book?.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openMore() {
  const track = state.currentTrack;
  if (!track) return;
  const book = getBookByTitle(track.bookTitle);
  const current = book?.lessons.find((lesson) => lesson.audioSrc === track.audioSrc) || null;
  const url = current?.videoUrl || current?.lessonFileUrl || book?.url;
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function addOrEditNote() {
  const track = state.currentTrack;
  if (!track) return;
  const existing = getNote(track.audioSrc);
  const next = window.prompt(`为「${track.bookTitle} · ${track.lesson}」写一条笔记`, existing);
  if (next === null) return;
  setNote(track.audioSrc, next.trim());
  renderAll();
}

function toggleFavoriteCurrent() {
  const track = state.currentTrack;
  if (!track) return;
  toggleFavorite(track.audioSrc);
  renderAll();
}

function openSearch() {
  const next = window.prompt('搜索讲道、系列或讲员', state.searchQuery || '');
  if (next === null) return;
  state.searchQuery = next.trim();
  renderAll();
}

function scrollToPlaylist() {
  document.querySelector('.hero-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearSearchAndShowAll() {
  state.searchQuery = '';
  renderAll();
  document.querySelector('.page-scroll')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindAudio() {
  $audio.addEventListener('loadedmetadata', () => {
    const saved = getSavedPosition($audio.currentSrc || $audio.src || '');
    if (saved && Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
      try {
        if (!Number.isFinite($audio.duration) || saved.currentTime < $audio.duration - 2) {
          $audio.currentTime = saved.currentTime;
        }
      } catch {}
    }
    updatePlaybackUI();
  });

  $audio.addEventListener('timeupdate', () => {
    setSavedPosition($audio.currentSrc || $audio.src || '', $audio.currentTime, $audio.duration);
    if (Number.isFinite($audio.currentTime) && $audio.currentTime >= Math.min(5, Math.max(($audio.duration || 0) * 0.1, 2))) {
      if (markListened($audio.currentSrc || $audio.src || '')) {
        renderAll();
      }
    }
    scheduleSaveSession();
    updatePlaybackUI();
  });

  $audio.addEventListener('play', () => {
    $audio.playbackRate = state.playbackRate;
    updatePlaybackUI();
  });

  $audio.addEventListener('pause', () => {
    setSavedPosition($audio.currentSrc || $audio.src || '', $audio.currentTime, $audio.duration);
    scheduleSaveSession();
    updatePlaybackUI();
  });

  $audio.addEventListener('ended', () => {
    const src = $audio.currentSrc || $audio.src || '';
    clearSavedPosition(src);
    if (markListened(src)) {
      renderAll();
    }
    updatePlaybackUI();
  });
}

function bindControls() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'select-book') {
      const title = button.dataset.title || '';
      if (!title) return;
      const book = getBookByTitle(title);
      if (!book) return;
      setSelectedCategory(book.category);
      setSelectedBookTitle(title);
      setCategorySelection(book.category, title);
      selectBook(title, { autoplay: false });
      return;
    }

    if (action === 'play-track') {
      playTrackBySrc(button.dataset.src || '', { autoplay: true });
      return;
    }
  });

  $playToggle.addEventListener('click', () => {
    if (!state.currentTrack) {
      const track = state.tracks[0];
      if (track) selectTrack(track, { autoplay: true });
      return;
    }
    if ($audio.paused) {
      void $audio.play().catch(() => {});
    } else {
      $audio.pause();
    }
  });

  $skipBackButton.addEventListener('click', () => seekBy(-15));
  $skipForwardButton.addEventListener('click', () => seekBy(15));
  $prevButton.addEventListener('click', () => playRelativeTrack(-1));
  $nextButton.addEventListener('click', () => playRelativeTrack(1));
  $shareButton?.addEventListener('click', () => {
    void copyShareLink();
  });
  $speedButton?.addEventListener('click', () => cyclePlaybackRate());

  if ($progressSlider) {
    $progressSlider.addEventListener('input', () => {
      const max = Number($progressSlider.max || 1000);
      const progress = max > 0 ? Number($progressSlider.value || 0) / max : 0;
      seekToProgress(progress);
    });
  }

  $categoryTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const category = tab.dataset.category || '';
      if (!category || category === getSelectedCategory()) return;
      setSelectedCategory(category);
      const book = getSelectedBookForCategory(category);
      if (book) {
        setSelectedBookTitle(book.title);
        setCategorySelection(category, book.title);
      }
      renderAll();
      scheduleSaveSession();
    });
  });
}

function prepareCatalog() {
  const books = state.data.books
    .filter(shouldKeepBook)
    .map(normalizeBook)
    .filter((book) => book.lessons.length > 0)
    .sort(compareBooks);
  state.books = books;
  buildAudioAliasIndex(books);
  migrateLegacyStorage();

  state.tracks = books.flatMap((book) =>
    book.lessons.map((lesson) => ({
      bookTitle: book.title,
      bookCategory: book.category,
      trackNo: lesson.trackNo,
      storageKey: trackStorageKey(book.title, lesson.trackNo),
      lesson:
        book.category === '主日'
          ? lesson.lesson || lesson.displayLabel || `第${lesson.trackNo}课`
          : lesson.displayLabel || lesson.lesson || `第${lesson.trackNo}课`,
      teacher: lesson.teacher || book.latestTeacher || '讲员',
      audioSrc: lesson.audioSrc,
      date: lesson.lessonDate,
      fileUrl: lesson.lessonFileUrl,
      videoUrl: lesson.videoUrl,
      note: getNote(lesson.audioSrc),
    }))
  );
  buildShareIndex(state.tracks);
}

async function loadData() {
  for (const candidate of [appAssetPath('/data/books-final.json'), appAssetPath('/data/books.json')]) {
    const response = await fetch(candidate);
    if (response.ok) return response.json();
  }
  throw new Error('加载数据失败');
}

function updateInitialSelection() {
  const shareKey = parseShareFromUrl();
  const sharedTrack = shareKey ? findTrackByReference(shareKey) : null;

  if (sharedTrack) {
    selectTrack(sharedTrack, { autoplay: true });
    clearShareFromUrl();
    return;
  }

  if (isFirstVisit()) {
    applyFirstVisitDefaults();
    return;
  }

  applyStoredSession();

  const category = getSelectedCategory();
  const book = getSelectedBookForCategory(category);
  if (book) {
    setSelectedBookTitle(book.title);
  }

  const session = loadJSON(SESSION_KEY, null);
  const savedCurrent = loadStoredString(CURRENT_KEY) || session?.currentStorageKey || '';
  const savedTrack = findTrackByReference(savedCurrent);
  if (savedTrack) {
    restoreTrack(savedTrack);
    return;
  }

  const recent = getRecentTracks()[0];
  if (recent) {
    restoreTrack(recent);
    return;
  }

  const fallbackBook = book || getSelectedBookForCategory(category);
  if (fallbackBook) {
    const track =
      state.tracks.find((item) => item.bookTitle === fallbackBook.title && item.trackNo === 1) ||
      state.tracks.find((item) => item.bookTitle === fallbackBook.title);
    if (track) restoreTrack(track);
  }
}

function init() {
  bindAudio();
  bindControls();
  bindSessionPersistence();
  $audio.playbackRate = state.playbackRate;
  void loadData()
    .then((data) => {
      state.data = data;
      prepareCatalog();
      updateInitialSelection();
      renderAll();
      restoreScrollPosition();
      saveSession();
    })
    .catch((error) => {
      console.error(error);
      if ($categoryBookList) {
        $categoryBookList.innerHTML = `
          <div class="category-book-empty">${escapeHtml(error.message || '加载失败')}</div>
        `;
      }
      renderAll();
    });
}

init();
