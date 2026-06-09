import { appAssetPath, getAppBasePath } from './base-path.js';

const INSTALL_DISMISS_KEY = 'sermon-install-dismiss-v1';

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

function isMobileInstallTarget() {
  const platform = getInstallPlatform();
  return platform === 'ios' || platform === 'android';
}

function getInstallUrl() {
  const base = getAppBasePath();
  return `${window.location.origin}${base}/index.html`;
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
  if (!isMobileInstallTarget() && !canDirectInstall()) return false;
  return true;
}

function renderSteps(platform, { showInstructions = false } = {}) {
  if (!$steps) return;

  if (canDirectInstall() && !showInstructions) {
    $steps.hidden = true;
    $steps.innerHTML = '';
    return;
  }

  $steps.hidden = false;

  if (platform === 'ios') {
    $steps.innerHTML = `
      <li>点击上方 <strong>立即安装</strong>，打开系统分享菜单</li>
      <li>选择 <strong>添加到主屏幕</strong></li>
      <li>确认后点击 <strong>添加</strong></li>
    `;
    return;
  }

  $steps.innerHTML = `
    <li>请使用 Chrome 打开本页</li>
    <li>点击 <strong>立即安装</strong> 或浏览器菜单中的 <strong>安装应用</strong></li>
    <li>确认后即可从桌面图标打开</li>
  `;
}

function syncInstallGuide() {
  const platform = getInstallPlatform();

  if ($lead) {
    if (canDirectInstall()) {
      $lead.textContent = '点击下方按钮，一键安装到主屏幕';
    } else if (platform === 'ios') {
      $lead.textContent = '点击安装按钮，在分享菜单中选择「添加到主屏幕」';
    } else {
      $lead.textContent = '安装后可像 App 一样，从桌面图标快速打开讲道集';
    }
  }

  if ($primary) {
    $primary.hidden = false;
    $primary.disabled = false;
    if (canDirectInstall()) {
      $primary.textContent = '立即安装';
    } else if (platform === 'ios') {
      $primary.textContent = '立即安装';
    } else {
      $primary.textContent = '立即安装';
    }
  }

  renderSteps(platform);
}

function openInstallGuide() {
  if (!$guide || !shouldOfferInstallGuide()) return;
  syncInstallGuide();
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

async function triggerIosInstall() {
  const url = getInstallUrl();
  if (navigator.share) {
    try {
      await navigator.share({
        title: '讲道集',
        text: '添加到主屏幕，随时收听讲道',
        url,
      });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
  }

  renderSteps('ios', { showInstructions: true });
  return false;
}

async function handleInstallClick() {
  if (canDirectInstall()) {
    await triggerDirectInstall();
    return;
  }

  const platform = getInstallPlatform();
  if (platform === 'ios') {
    await triggerIosInstall();
    return;
  }

  if (platform === 'android') {
    const ready = await waitForInstallPrompt(1200);
    if (ready && canDirectInstall()) {
      await triggerDirectInstall();
      return;
    }
    renderSteps('android', { showInstructions: true });
  }
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
    void handleInstallClick();
  });

  $dismiss?.addEventListener('click', () => {
    closeInstallGuide({ dismiss: true });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notifyInstallPromptReady();
    if (shouldOfferInstallGuide() && $guide?.hidden) {
      openInstallGuide();
    }
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
  if (!shouldOfferInstallGuide()) return;

  const platform = getInstallPlatform();
  if (platform === 'android' || platform === 'other') {
    await waitForInstallPrompt(platform === 'android' ? 2500 : 1200);
  } else {
    await new Promise((resolve) => window.setTimeout(resolve, 1200));
  }

  if (!shouldOfferInstallGuide()) return;
  openInstallGuide();
}

export function initInstallGuide() {
  registerServiceWorker();
  bindAppUpdateUi();
  bindInstallGuide();
  void scheduleInstallGuide();
}

initInstallGuide();
