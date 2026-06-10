const THEME_KEY = 'sermon-theme-v1';

const $themeToggle = document.querySelector('#theme-toggle');

function readStoredTheme() {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.content = theme === 'dark' ? '#1a1816' : '#FFB100';
}

function updateToggleUi(theme) {
  const isDark = theme === 'dark';
  const label = isDark ? '切换到浅色模式' : '切换到深色模式';
  if ($themeToggle) {
    $themeToggle.setAttribute('aria-label', label);
    $themeToggle.title = label;
  }
}

export function applyTheme(mode) {
  const effective = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.dataset.themeMode = mode;
  updateThemeColor(effective);
  updateToggleUi(effective);
}

export function getEffectiveTheme() {
  return resolveTheme(readStoredTheme());
}

function toggleTheme() {
  const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
  window.localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

function bindThemeToggle() {
  $themeToggle?.addEventListener('click', toggleTheme);
}

function bindSystemThemeChanges() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (readStoredTheme() === 'system') applyTheme('system');
  };
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onChange);
  }
}

export function initTheme() {
  applyTheme(readStoredTheme());
  bindThemeToggle();
  bindSystemThemeChanges();
}

initTheme();
