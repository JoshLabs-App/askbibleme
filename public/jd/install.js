import { appAssetPath, getAppBasePath } from './base-path.js';

const INSTALL_DISMISS_KEY = 'sermon-install-dismiss-v2';
const INSTALL_SHOW_DELAY_MS = 10000;

const $guide = document.querySelector('#install-guide');
const $steps = document.querySelector('#install-guide-steps');
const $primary = document.querySelector('#install-guide-primary');
const $dismiss = document.querySelector('#install-guide-dismiss');
const $lead = document.querySelector('#install-guide-lead');
const $updateBanner = document.querySelector('#app-update-banner');
const $updateRefresh = document.querySelector('#app-update-refresh');

let deferredInstallPrompt = null;
let installPromptWaiters = [];
let waitingServiceWorker = null;
let updateRefreshPending = false;
let serviceWorkerRegistration = null;
let installGuideScheduled = false;

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

function canDirectInstall() {
  return Boolean(deferredInstallPrompt);
}

function notifyInstallPromptReady() {
  for (const resolve of installPromptWaiters) {
    resolve(true);
  }
  installPromptWaiters = [];
  syncInstallGuide();
  maybeOpenInstallGuide();
}

function waitForInstallPrompt(timeoutMs = 8000) {
  if (deferredInstallPrompt) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      installPromptWaiters = installPromptWaiters.filter((item) => item !== resolve);
      resolve(Boolean(deferredInstallPrompt));
    }, timeoutMs);
    installPromptWaiters.push((ready) => {
      window.clearTimeout(timer);
      resolve(ready);
    });
  });
}

function shouldOfferInstallGuide() {
  if (isStandalone() || isDismissed()) return false;

  const platform = getInstallPlatform();
  if (platform === 'ios') return true;
  if (platform === 'android' && canDirectInstall()) return true;
  return false;
}

function renderIosSteps() {
  if (!$steps) return;
  $steps.hidden = false;
  $steps.innerHTML = `
    <li>点 Safari 底部 <strong>分享</strong> 按钮</li>
    <li>选择 <strong>添加到主屏幕</strong></li>
    <li>点右上角 <strong>添加</strong></li>
  `;
}

function syncInstallGuide() {
  const platform = getInstallPlatform();

  if ($lead) {
    if (platform === 'ios') {
      $lead.textContent = '像 App 一样从桌面打开，随时收听讲道';
    } else {
      $lead.textContent = '安装后可从桌面快速打开讲道集';
    }
  }

  if ($primary) {
    const showAndroidButton = platform === 'android' && canDirectInstall();
    $primary.hidden = !showAndroidButton;
    $primary.disabled = false;
    $primary.textContent = '添加';
  }

  if ($steps) {
    if (platform === 'ios') {
      renderIosSteps();
    } else {
      $steps.hidden = true;
      $steps.innerHTML = '';
    }
  }

  if ($guide && !$guide.hidden) {
    syncInstallBannerOffset();
  }
}

function syncInstallBannerOffset() {
  if (!$guide || $guide.hidden) {
    document.body.style.removeProperty('--install-banner-offset');
    return;
  }

  const height = Math.ceil($guide.getBoundingClientRect().height);
  document.body.style.setProperty('--install-banner-offset', `${height}px`);
}

function openInstallGuide() {
  if (!$guide || !shouldOfferInstallGuide()) return;
  syncInstallGuide();
  $guide.hidden = false;
  $guide.setAttribute('aria-hidden', 'false');
  document.body.classList.add('install-banner-open');
  window.requestAnimationFrame(() => {
    syncInstallBannerOffset();
  });
}

function closeInstallGuide({ dismiss = false } = {}) {
  if (!$guide) return;
  $guide.hidden = true;
  $guide.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('install-banner-open');
  document.body.style.removeProperty('--install-banner-offset');
  if (dismiss) setDismissed();
}

async function triggerDirectInstall() {
  if (!deferredInstallPrompt) return false;

  deferredInstallPrompt.prompt();
  try {
    await deferredInstallPrompt.userChoice;
  } catch {}
  deferredInstallPrompt = null;
  closeInstallGuide({ dismiss: true });
  return true;
}

async function handleInstallClick() {
  if (getInstallPlatform() !== 'android' || !canDirectInstall()) return;
  await triggerDirectInstall();
}

function bindInstallGuide() {
  $primary?.addEventListener('click', () => {
    void handleInstallClick();
  });

  $dismiss?.addEventListener('click', () => {
    closeInstallGuide({ dismiss: true });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notifyInstallPromptReady();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    closeInstallGuide({ dismiss: true });
  });

  window.addEventListener('resize', () => {
    syncInstallBannerOffset();
  });
}

function maybeOpenInstallGuide() {
  if (!installGuideScheduled || !shouldOfferInstallGuide() || !$guide?.hidden) return;
  openInstallGuide();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const base = getAppBasePath();
  const scope = base ? `${base}/` : '/';
  void navigator.serviceWorker
    .register(appAssetPath('/sw.js'), { scope })
    .then((registration) => {
      serviceWorkerRegistration = registration;
      bindAppUpdate(registration);
      void registration.update();
    })
    .catch(() => {});
}

function showUpdateBanner() {
  if (!$updateBanner) return;
  $updateBanner.hidden = false;
  document.body.classList.add('app-update-open');
}

function hideUpdateBanner() {
  if (!$updateBanner) return;
  $updateBanner.hidden = true;
  document.body.classList.remove('app-update-open');
}

function markWaitingServiceWorker(worker) {
  if (!worker) return;
  waitingServiceWorker = worker;
  showUpdateBanner();
}

function bindAppUpdate(registration) {
  if (registration.waiting) {
    markWaitingServiceWorker(registration.waiting);
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;
    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state !== 'installed') return;
      if (!navigator.serviceWorker.controller) return;
      markWaitingServiceWorker(installingWorker);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRefreshPending) return;
    window.location.reload();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void registration.update();
  });

  window.setInterval(() => {
    void registration.update();
  }, 60 * 60 * 1000);
}

function applyAppUpdate() {
  updateRefreshPending = true;
  hideUpdateBanner();

  if (waitingServiceWorker) {
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(() => {
      if (updateRefreshPending) {
        window.location.reload();
      }
    }, 2500);
    return;
  }

  void serviceWorkerRegistration?.update().finally(() => {
    window.location.reload();
  });
}

function bindAppUpdateUi() {
  $updateRefresh?.addEventListener('click', () => {
    applyAppUpdate();
  });
}

async function scheduleInstallGuide() {
  installGuideScheduled = false;

  await new Promise((resolve) => window.setTimeout(resolve, INSTALL_SHOW_DELAY_MS));
  installGuideScheduled = true;

  if (isStandalone() || isDismissed()) return;

  const platform = getInstallPlatform();
  if (platform === 'android') {
    if (!canDirectInstall()) {
      await waitForInstallPrompt(4000);
    }
    if (!canDirectInstall()) return;
  } else if (platform !== 'ios') {
    return;
  }

  maybeOpenInstallGuide();
}

export function initInstallGuide() {
  registerServiceWorker();
  bindAppUpdateUi();
  bindInstallGuide();
  void scheduleInstallGuide();
}

initInstallGuide();
