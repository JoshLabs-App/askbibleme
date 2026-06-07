import { appAssetPath, getAppBasePath } from './base-path.js';

const INSTALL_DISMISS_KEY = 'sermon-install-dismiss-v1';

const $guide = document.querySelector('#install-guide');
const $steps = document.querySelector('#install-guide-steps');
const $primary = document.querySelector('#install-guide-primary');
const $dismiss = document.querySelector('#install-guide-dismiss');

let deferredInstallPrompt = null;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function isDismissed() {
  try {
    return window.localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, '1');
  } catch {}
}

function getInstallPlatform() {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function shouldOfferInstallGuide() {
  if (isStandalone() || isDismissed()) return false;
  if (getInstallPlatform() === 'other' && !deferredInstallPrompt) return false;
  return true;
}

function renderSteps(platform) {
  if (!$steps) return;

  if (platform === 'ios') {
    $steps.innerHTML = `
      <li>点击 Safari 底部或顶部的 <strong>分享</strong> 按钮</li>
      <li>向下滑动，选择 <strong>添加到主屏幕</strong></li>
      <li>确认名称后，点击 <strong>添加</strong></li>
    `;
    return;
  }

  if (platform === 'android' && deferredInstallPrompt) {
    $steps.innerHTML = `
      <li>点击下方 <strong>立即安装</strong>，将讲道集添加到主屏幕</li>
      <li>安装后可像 App 一样从桌面图标直接打开</li>
    `;
    return;
  }

  $steps.innerHTML = `
    <li>打开浏览器菜单 <strong>⋮</strong></li>
    <li>选择 <strong>添加到主屏幕</strong> 或 <strong>安装应用</strong></li>
    <li>确认后，即可从桌面图标打开</li>
  `;
}

function syncPrimaryAction(platform) {
  if (!$primary) return;

  if (platform === 'android' && deferredInstallPrompt) {
    $primary.hidden = false;
    $primary.textContent = '立即安装';
    return;
  }

  $primary.hidden = true;
}

function openInstallGuide() {
  if (!$guide || !shouldOfferInstallGuide()) return;
  const platform = getInstallPlatform();
  renderSteps(platform);
  syncPrimaryAction(platform);
  $guide.hidden = false;
  $guide.setAttribute('aria-hidden', 'false');
  document.body.classList.add('install-guide-open');
}

function closeInstallGuide({ dismiss = false } = {}) {
  if (!$guide) return;
  $guide.hidden = true;
  $guide.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('install-guide-open');
  if (dismiss) setDismissed();
}

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try {
    await deferredInstallPrompt.userChoice;
  } catch {}
  deferredInstallPrompt = null;
  closeInstallGuide({ dismiss: true });
}

function bindInstallGuide() {
  $guide?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-action="dismiss-install"]')) {
      closeInstallGuide();
    }
  });

  $primary?.addEventListener('click', () => {
    void triggerInstall();
  });

  $dismiss?.addEventListener('click', () => {
    closeInstallGuide({ dismiss: true });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    syncPrimaryAction(getInstallPlatform());
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    closeInstallGuide({ dismiss: true });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const base = getAppBasePath();
  const scope = base ? `${base}/` : '/';
  void navigator.serviceWorker.register(appAssetPath('/sw.js'), { scope }).catch(() => {});
}

function scheduleInstallGuide() {
  if (!shouldOfferInstallGuide()) return;
  window.setTimeout(openInstallGuide, 1800);
}

export function initInstallGuide() {
  registerServiceWorker();
  bindInstallGuide();
  scheduleInstallGuide();
}

initInstallGuide();
