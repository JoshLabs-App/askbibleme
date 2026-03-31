const FRONT_STATE_KEY = "bible_front_state_v4";
const FONT_SCALE_KEY = "bible_font_scale_v1";
const ADMIN_PASSWORD = "0777";

const state = {
  bootstrap: null,
  frontState: loadFrontState(),
  scriptureRows: [],
  studyContent: null,
};

const adminState = {
  bootstrap: null,
  currentRuleVersion: "default",
  currentRuleConfig: null,
  testResult: null,
  jobsRefreshTimer: null,
  lastJobsSnapshotKey: "",
  publishedOverview: null,
  scriptureVersions: [],
  editingScriptureVersionId: "",
};

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadFontScale() {
  const raw = Number(localStorage.getItem(FONT_SCALE_KEY));
  if (Number.isFinite(raw) && raw >= 0.85 && raw <= 1.3) return raw;
  return 1;
}

function saveFontScale() {
  localStorage.setItem(FONT_SCALE_KEY, String(state.frontState.fontScale));
}

function loadFrontState() {
  const parsed = safeJsonParse(localStorage.getItem(FRONT_STATE_KEY), null);

  const legacyScriptureIds =
    Array.isArray(parsed?.scriptureVersionIds) &&
    parsed.scriptureVersionIds.length
      ? parsed.scriptureVersionIds
      : [];

  return {
    uiLang: parsed?.uiLang || "zh",
    contentVersion: parsed?.contentVersion || "default",
    contentLang: parsed?.contentLang || "zh",
    primaryScriptureVersionId:
      parsed?.primaryScriptureVersionId || legacyScriptureIds[0] || "cuvs_zh",
    secondaryScriptureVersionIds: Array.isArray(
      parsed?.secondaryScriptureVersionIds
    )
      ? parsed.secondaryScriptureVersionIds
      : legacyScriptureIds.slice(1),
    testament: parsed?.testament || "旧约",
    bookId: parsed?.bookId || "GEN",
    chapter: Number(parsed?.chapter || 1),
    hideScripture: parsed?.hideScripture === true,
    fontScale: loadFontScale(),
  };
}

function saveFrontState() {
  localStorage.setItem(
    FRONT_STATE_KEY,
    JSON.stringify({
      uiLang: state.frontState.uiLang,
      contentVersion: state.frontState.contentVersion,
      contentLang: state.frontState.contentLang,
      primaryScriptureVersionId: state.frontState.primaryScriptureVersionId,
      secondaryScriptureVersionIds:
        state.frontState.secondaryScriptureVersionIds,
      testament: state.frontState.testament,
      bookId: state.frontState.bookId,
      chapter: state.frontState.chapter,
      hideScripture: state.frontState.hideScripture,
    })
  );
}

function applyFontScale() {
  document.documentElement.style.setProperty(
    "--font-scale",
    String(state.frontState.fontScale)
  );
}

function getBooksForCurrentTestament() {
  const allBooks = state.bootstrap?.testamentOptions || [];
  return allBooks.filter((b) => b.testamentName === state.frontState.testament);
}

function getCurrentBookMeta() {
  return (
    (state.bootstrap?.testamentOptions || []).find(
      (b) => b.bookId === state.frontState.bookId
    ) || null
  );
}

function getCurrentBookLabel() {
  const book = getCurrentBookMeta();
  if (!book) return state.frontState.bookId;

  if (state.frontState.uiLang === "en")
    return book.bookEn || book.bookCn || book.bookId;
  if (state.frontState.uiLang === "es")
    return book.bookEn || book.bookCn || book.bookId;
  return book.bookCn || book.bookEn || book.bookId;
}

function getEnabledScriptureVersions() {
  return (state.bootstrap?.scriptureVersions || []).slice().sort((a, b) => {
    return Number(a.sortOrder || 999) - Number(b.sortOrder || 999);
  });
}

function getScriptureVersionById(id) {
  return getEnabledScriptureVersions().find((x) => x.id === id) || null;
}

function getAllSelectedScriptureVersionIds() {
  const ids = [
    state.frontState.primaryScriptureVersionId,
    ...(state.frontState.secondaryScriptureVersionIds || []),
  ].filter(Boolean);

  return Array.from(new Set(ids));
}

function getSecondaryScriptureVersions() {
  return (state.frontState.secondaryScriptureVersionIds || [])
    .map((id) => getScriptureVersionById(id))
    .filter(Boolean);
}

function getPrimaryScriptureVersion() {
  return getScriptureVersionById(state.frontState.primaryScriptureVersionId);
}

function getCurrentContentVersionLabel() {
  const found = (state.bootstrap?.contentVersions || []).find(
    (x) => x.id === state.frontState.contentVersion
  );
  return found?.label || state.frontState.contentVersion || "类型";
}

function syncContentLangWithPrimaryVersion() {
  const primary = getPrimaryScriptureVersion();
  const nextLang = primary?.lang;
  if (!nextLang) return;

  const exists = (state.bootstrap?.uiLanguages || []).find(
    (x) => x.id === nextLang
  );
  if (exists) {
    state.frontState.contentLang = nextLang;
  }
}

async function init() {
  try {
    applyFontScale();
    initFontTools();
    initExportButtons();
    await loadBootstrap();
    ensureScriptureCompareUI();
    initSelectors();
    initToolbarPanels();
    initChapterNav();
    initHideScriptureToggle();
    initAdminModal();
    renderAllSelectors();
    await refreshCurrentPage();
  } catch (error) {
    console.error("初始化失败:", error);
  }
}

async function loadBootstrap() {
  const res = await fetch("/api/front/bootstrap", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "无法读取前台配置");
  state.bootstrap = data;
  normalizeFrontStateByBootstrap();
}

function normalizeFrontStateByBootstrap() {
  const uiLanguages = state.bootstrap?.uiLanguages || [];
  const scriptureVersions = getEnabledScriptureVersions();
  const contentVersions = state.bootstrap?.contentVersions || [];
  const books = state.bootstrap?.testamentOptions || [];

  if (!uiLanguages.find((x) => x.id === state.frontState.uiLang)) {
    state.frontState.uiLang = state.bootstrap?.defaultState?.uiLang || "zh";
  }

  if (!contentVersions.find((x) => x.id === state.frontState.contentVersion)) {
    state.frontState.contentVersion =
      state.bootstrap?.defaultState?.contentVersionId || "default";
  }

  if (!uiLanguages.find((x) => x.id === state.frontState.contentLang)) {
    state.frontState.contentLang =
      state.bootstrap?.defaultState?.contentLang || "zh";
  }

  const primaryExists = scriptureVersions.find(
    (x) => x.id === state.frontState.primaryScriptureVersionId
  );

  if (!primaryExists) {
    state.frontState.primaryScriptureVersionId =
      state.bootstrap?.defaultState?.primaryScriptureVersionId ||
      scriptureVersions[0]?.id ||
      "";
  }

  const validSecondary = (
    state.frontState.secondaryScriptureVersionIds || []
  ).filter(
    (id) =>
      id !== state.frontState.primaryScriptureVersionId &&
      scriptureVersions.find((x) => x.id === id)
  );

  state.frontState.secondaryScriptureVersionIds = Array.from(
    new Set(validSecondary)
  );

  const validBook = books.find((b) => b.bookId === state.frontState.bookId);
  if (!validBook) {
    state.frontState.bookId = "GEN";
  }

  const currentBook = books.find((b) => b.bookId === state.frontState.bookId);
  const maxChapters = Number(currentBook?.chapters || 1);
  if (
    !Number.isInteger(state.frontState.chapter) ||
    state.frontState.chapter < 1 ||
    state.frontState.chapter > maxChapters
  ) {
    state.frontState.chapter = 1;
  }

  syncContentLangWithPrimaryVersion();
  saveFrontState();
}

function ensureScriptureCompareUI() {
  return;
}

function initFontTools() {
  document.getElementById("fontDecreaseBtn")?.addEventListener("click", () => {
    state.frontState.fontScale = Math.max(
      0.85,
      Number((state.frontState.fontScale - 0.05).toFixed(2))
    );
    applyFontScale();
    saveFontScale();
  });

  document.getElementById("fontIncreaseBtn")?.addEventListener("click", () => {
    state.frontState.fontScale = Math.min(
      1.3,
      Number((state.frontState.fontScale + 0.05).toFixed(2))
    );
    applyFontScale();
    saveFontScale();
  });
}

function initExportButtons() {
  document
    .getElementById("exportPrettyPdfBtn")
    ?.addEventListener("click", () => {
      alert("这一步先保留按钮，后面再接导出新版内容。");
    });

  document
    .getElementById("exportPrintPdfBtn")
    ?.addEventListener("click", () => {
      window.print();
    });
}

function initHideScriptureToggle() {
  const btn = document.getElementById("hideScriptureBtn");
  if (!btn) return;

  btn.classList.toggle("active", state.frontState.hideScripture);

  btn.addEventListener("click", () => {
    state.frontState.hideScripture = !state.frontState.hideScripture;
    btn.classList.toggle("active", state.frontState.hideScripture);
    saveFrontState();
    renderStudyContent();
  });
}

function initSelectors() {
  document.getElementById("uiLang")?.addEventListener("change", async (e) => {
    state.frontState.uiLang = e.target.value;
    saveFrontState();
    renderAllSelectors();
    renderStudyContent();
    updatePageTitle();
  });

  document
    .getElementById("contentVersion")
    ?.addEventListener("change", async (e) => {
      state.frontState.contentVersion = e.target.value;
      saveFrontState();
      renderAllSelectors();
      await loadStudyContent();
      renderStudyContent();
    });

  document
    .getElementById("contentLang")
    ?.addEventListener("change", async (e) => {
      state.frontState.contentLang = e.target.value;
      saveFrontState();
      renderAllSelectors();
      await refreshCurrentPage();
    });

  document
    .getElementById("scriptureVersion")
    ?.addEventListener("change", async (e) => {
      const nextPrimary = e.target.value;
      const secondary = (
        state.frontState.secondaryScriptureVersionIds || []
      ).filter((id) => id !== nextPrimary);

      state.frontState.primaryScriptureVersionId = nextPrimary;
      state.frontState.secondaryScriptureVersionIds = secondary;
      syncContentLangWithPrimaryVersion();
      saveFrontState();
      renderAllSelectors();
      await refreshCurrentPage();
    });

  document.getElementById("bookId")?.addEventListener("change", async (e) => {
    state.frontState.bookId = e.target.value;
    state.frontState.chapter = 1;
    saveFrontState();
    renderAllSelectors();
    await refreshCurrentPage();
  });

  document.getElementById("chapter")?.addEventListener("change", async (e) => {
    state.frontState.chapter = Number(e.target.value);
    saveFrontState();
    renderAllSelectors();
    await refreshCurrentPage();
  });
}

function initToolbarPanels() {
  const triggerMap = [
    { triggerId: "bookChapterTrigger", panelId: "bookChapterPanel" },
    { triggerId: "contentTypeTrigger", panelId: "contentTypePanel" },
    { triggerId: "primaryVersionTrigger", panelId: "primaryVersionPanel" },
    { triggerId: "compareVersionTrigger", panelId: "compareVersionPanel" },
  ];

  triggerMap.forEach(({ triggerId, panelId }) => {
    const trigger = document.getElementById(triggerId);
    const panel = document.getElementById(panelId);
    if (!trigger || !panel) return;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleToolbarPanel(panelId);
    });

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.querySelectorAll("[data-close-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panelId = btn.getAttribute("data-close-panel");
      if (!panelId) return;
      closeToolbarPanel(panelId);
    });
  });

  document.addEventListener("click", () => {
    closeAllToolbarPanels();
  });
}

function toggleToolbarPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const willOpen = panel.hasAttribute("hidden");
  closeAllToolbarPanels();

  if (willOpen) {
    panel.removeAttribute("hidden");
    markToolbarTriggerActive(panelId, true);
  }
}

function closeToolbarPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.setAttribute("hidden", "");
  markToolbarTriggerActive(panelId, false);
}

function closeAllToolbarPanels() {
  [
    "bookChapterPanel",
    "contentTypePanel",
    "primaryVersionPanel",
    "compareVersionPanel",
  ].forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (panel) panel.setAttribute("hidden", "");
    markToolbarTriggerActive(panelId, false);
  });
}

function markToolbarTriggerActive(panelId, active) {
  const mapping = {
    bookChapterPanel: "bookChapterTrigger",
    contentTypePanel: "contentTypeTrigger",
    primaryVersionPanel: "primaryVersionTrigger",
    compareVersionPanel: "compareVersionTrigger",
  };

  const trigger = document.getElementById(mapping[panelId]);
  if (trigger) trigger.classList.toggle("active", !!active);
}

function renderAllSelectors() {
  renderTestamentButtons();
  renderUiLangOptions();
  renderContentVersionOptions();
  renderContentLangOptions();
  renderPrimaryScriptureVersionOptions();
  renderSecondaryScriptureVersionChecks();
  renderBookOptions();
  renderChapterOptions();
  renderToolbarTriggers();
  renderToolbarPanels();
  updatePageTitle();
}

function renderTestamentButtons() {
  return;
}

function renderUiLangOptions() {
  const el = document.getElementById("uiLang");
  if (!el) return;

  el.innerHTML = (state.bootstrap?.uiLanguages || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  el.value = state.frontState.uiLang;
}

function renderContentVersionOptions() {
  const el = document.getElementById("contentVersion");
  if (!el) return;

  el.innerHTML = (state.bootstrap?.contentVersions || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  el.value = state.frontState.contentVersion;
}

function renderContentLangOptions() {
  const el = document.getElementById("contentLang");
  if (!el) return;

  el.innerHTML = (state.bootstrap?.uiLanguages || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  el.value = state.frontState.contentLang;
}

function renderPrimaryScriptureVersionOptions() {
  const el = document.getElementById("scriptureVersion");
  if (!el) return;

  const options = getEnabledScriptureVersions();

  el.innerHTML = options
    .map((item) => {
      const langTag = item.lang ? ` [${item.lang}]` : "";
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(
        item.label + langTag
      )}</option>`;
    })
    .join("");

  const current = state.frontState.primaryScriptureVersionId;
  if (!options.find((x) => x.id === current) && options[0]) {
    state.frontState.primaryScriptureVersionId = options[0].id;
    syncContentLangWithPrimaryVersion();
    saveFrontState();
  }

  el.value = state.frontState.primaryScriptureVersionId || options[0]?.id || "";
}

function renderSecondaryScriptureVersionChecks() {
  const container = document.getElementById("secondaryScriptureVersions");
  if (!container) return;

  const primaryId = state.frontState.primaryScriptureVersionId;
  const options = getEnabledScriptureVersions().filter(
    (x) => x.id !== primaryId
  );
  const selected = new Set(state.frontState.secondaryScriptureVersionIds || []);

  container.innerHTML = options.length
    ? options
        .map((item) => {
          const checked = selected.has(item.id) ? "checked" : "";
          return `
            <label>
              <input type="checkbox" value="${escapeHtml(
                item.id
              )}" ${checked} data-secondary-scripture />
              <span>${escapeHtml(
                item.label
              )} <span style="opacity:.65;">[${escapeHtml(
            item.lang || ""
          )}]</span></span>
            </label>
          `;
        })
        .join("")
    : `<div class="empty-state">没有可选对照版本</div>`;

  container.querySelectorAll("[data-secondary-scripture]").forEach((input) => {
    input.addEventListener("change", async () => {
      const allChecked = Array.from(
        container.querySelectorAll("[data-secondary-scripture]:checked")
      ).map((x) => x.value);

      state.frontState.secondaryScriptureVersionIds = allChecked.filter(
        (id) => id !== state.frontState.primaryScriptureVersionId
      );
      saveFrontState();
      renderAllSelectors();
      await refreshCurrentPage();
    });
  });
}

function renderBookOptions() {
  const el = document.getElementById("bookId");
  if (!el) return;

  const books = getBooksForCurrentTestament();

  el.innerHTML = books
    .map((book) => {
      const label =
        state.frontState.uiLang === "en"
          ? book.bookEn || book.bookCn
          : book.bookCn || book.bookEn;
      return `<option value="${escapeHtml(book.bookId)}">${escapeHtml(
        label
      )}</option>`;
    })
    .join("");

  const stillValid = books.find((b) => b.bookId === state.frontState.bookId);
  if (!stillValid && books[0]) {
    state.frontState.bookId = books[0].bookId;
  }

  el.value = state.frontState.bookId;
}

function renderChapterOptions() {
  const el = document.getElementById("chapter");
  if (!el) return;

  const book = getCurrentBookMeta();
  const chapterCount = Number(book?.chapters || 1);

  el.innerHTML = Array.from({ length: chapterCount }, (_, i) => {
    const chapterNo = i + 1;
    return `<option value="${chapterNo}">${chapterNo}</option>`;
  }).join("");

  if (state.frontState.chapter > chapterCount) {
    state.frontState.chapter = 1;
    saveFrontState();
  }

  el.value = String(state.frontState.chapter);
}

function renderToolbarTriggers() {
  const bookChapterTriggerText = document.getElementById(
    "bookChapterTriggerText"
  );
  const contentTypeTriggerText = document.getElementById(
    "contentTypeTriggerText"
  );
  const primaryVersionTriggerText = document.getElementById(
    "primaryVersionTriggerText"
  );
  const compareVersionTriggerText = document.getElementById(
    "compareVersionTriggerText"
  );

  const bookLabel = getCurrentBookLabel();
  const contentVersion = (state.bootstrap?.contentVersions || []).find(
    (x) => x.id === state.frontState.contentVersion
  );
  const primaryVersion = getPrimaryScriptureVersion();
  const compareCount = Number(
    state.frontState.secondaryScriptureVersionIds?.length || 0
  );

  if (bookChapterTriggerText) {
    bookChapterTriggerText.textContent = `${bookLabel} ${state.frontState.chapter}章`;
  }

  if (contentTypeTriggerText) {
    contentTypeTriggerText.textContent =
      contentVersion?.label || state.frontState.contentVersion || "类型";
  }

  if (primaryVersionTriggerText) {
    primaryVersionTriggerText.textContent = primaryVersion?.label || "版本";
  }

  if (compareVersionTriggerText) {
    compareVersionTriggerText.textContent =
      compareCount > 0 ? `对照（${compareCount}）` : "对照";
  }
}

function renderToolbarPanels() {
  renderBookChapterPanel();
  renderContentTypePanel();
  renderPrimaryVersionPanel();
  renderCompareVersionPanel();
}

function renderBookChapterPanel() {
  const bookGrid = document.getElementById("bookGrid");
  const chapterGrid = document.getElementById("chapterGrid");
  if (!bookGrid || !chapterGrid) return;

  document.querySelectorAll("[data-testament-tab]").forEach((btn) => {
    const isActive =
      btn.getAttribute("data-testament-tab") === state.frontState.testament;
    btn.classList.toggle("active", isActive);

    if (!btn.dataset.boundTab) {
      btn.dataset.boundTab = "1";
      btn.addEventListener("click", async () => {
        const nextTestament = btn.getAttribute("data-testament-tab");
        if (!nextTestament || nextTestament === state.frontState.testament)
          return;

        state.frontState.testament = nextTestament;
        const books = getBooksForCurrentTestament();
        if (books[0]) {
          state.frontState.bookId = books[0].bookId;
          state.frontState.chapter = 1;
        }

        saveFrontState();
        renderAllSelectors();
        await refreshCurrentPage();
      });
    }
  });

  const books = getBooksForCurrentTestament();

  bookGrid.innerHTML = books
    .map((book) => {
      const label =
        state.frontState.uiLang === "en"
          ? book.bookEn || book.bookCn || book.bookId
          : book.bookCn || book.bookEn || book.bookId;

      const active = book.bookId === state.frontState.bookId ? "active" : "";

      return `<button type="button" class="book-item ${active}" data-book-grid-id="${escapeHtml(
        book.bookId
      )}">${escapeHtml(label)}</button>`;
    })
    .join("");

  bookGrid.querySelectorAll("[data-book-grid-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextBookId = btn.getAttribute("data-book-grid-id");
      if (!nextBookId) return;

      state.frontState.bookId = nextBookId;
      state.frontState.chapter = 1;
      saveFrontState();
      renderAllSelectors();
    });
  });

  const currentBook = getCurrentBookMeta();
  const chapterCount = Number(currentBook?.chapters || 1);

  chapterGrid.innerHTML = Array.from({ length: chapterCount }, (_, i) => {
    const chapterNo = i + 1;
    const active =
      chapterNo === Number(state.frontState.chapter) ? "active" : "";
    return `<button type="button" class="chapter-item ${active}" data-chapter-grid-no="${chapterNo}">${chapterNo}</button>`;
  }).join("");

  chapterGrid.querySelectorAll("[data-chapter-grid-no]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextChapter = Number(btn.getAttribute("data-chapter-grid-no") || 1);
      state.frontState.chapter = nextChapter;
      saveFrontState();
      renderAllSelectors();
      closeToolbarPanel("bookChapterPanel");
      await refreshCurrentPage();
    });
  });
}

function renderContentTypePanel() {
  const list = document.getElementById("contentTypeList");
  if (!list) return;

  const options = state.bootstrap?.contentVersions || [];

  list.innerHTML = options
    .map((item) => {
      const active =
        item.id === state.frontState.contentVersion ? "active" : "";
      return `<button type="button" class="option-item ${active}" data-content-type-id="${escapeHtml(
        item.id
      )}">${escapeHtml(item.label)}</button>`;
    })
    .join("");

  list.querySelectorAll("[data-content-type-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextId = btn.getAttribute("data-content-type-id");
      if (!nextId) return;

      state.frontState.contentVersion = nextId;
      saveFrontState();
      renderAllSelectors();
      closeToolbarPanel("contentTypePanel");
      await loadStudyContent();
      renderStudyContent();
    });
  });
}

function renderPrimaryVersionPanel() {
  const list = document.getElementById("primaryVersionList");
  if (!list) return;

  const options = getEnabledScriptureVersions();

  list.innerHTML = options
    .map((item) => {
      const active =
        item.id === state.frontState.primaryScriptureVersionId ? "active" : "";
      const langTag = item.lang ? ` [${item.lang}]` : "";
      return `<button type="button" class="option-item ${active}" data-primary-version-id="${escapeHtml(
        item.id
      )}">${escapeHtml(item.label + langTag)}</button>`;
    })
    .join("");

  list.querySelectorAll("[data-primary-version-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextId = btn.getAttribute("data-primary-version-id");
      if (!nextId) return;

      state.frontState.primaryScriptureVersionId = nextId;
      state.frontState.secondaryScriptureVersionIds = (
        state.frontState.secondaryScriptureVersionIds || []
      ).filter((id) => id !== nextId);

      syncContentLangWithPrimaryVersion();
      saveFrontState();
      renderAllSelectors();
      closeToolbarPanel("primaryVersionPanel");
      await refreshCurrentPage();
    });
  });
}

function renderCompareVersionPanel() {
  const list = document.getElementById("compareVersionList");
  if (!list) return;

  const primaryId = state.frontState.primaryScriptureVersionId;
  const selected = new Set(state.frontState.secondaryScriptureVersionIds || []);
  const options = getEnabledScriptureVersions().filter(
    (item) => item.id !== primaryId
  );

  list.innerHTML = options.length
    ? options
        .map((item) => {
          const checked = selected.has(item.id);
          const checkText = checked ? "✓" : "";
          const langTag = item.lang ? ` [${item.lang}]` : "";
          const active = checked ? "active" : "";
          return `<button type="button" class="option-item ${active}" data-compare-version-id="${escapeHtml(
            item.id
          )}">
              <span>${escapeHtml(item.label + langTag)}</span>
              <span class="option-item-check">${escapeHtml(checkText)}</span>
            </button>`;
        })
        .join("")
    : `<div class="empty-state">没有可选对照版本</div>`;

  list.querySelectorAll("[data-compare-version-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const versionId = btn.getAttribute("data-compare-version-id");
      if (!versionId) return;

      const next = new Set(state.frontState.secondaryScriptureVersionIds || []);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }

      state.frontState.secondaryScriptureVersionIds = Array.from(next).filter(
        (id) => id !== state.frontState.primaryScriptureVersionId
      );

      saveFrontState();
      renderAllSelectors();
      await refreshCurrentPage();
    });
  });
}

async function refreshCurrentPage() {
  await loadScripture();
  await loadStudyContent();
  renderStudyContent();
  updateChapterNavUI();
  updatePageTitle();
  renderToolbarTriggers();
}

async function loadScripture() {
  const versionIds = getAllSelectedScriptureVersionIds();

  const params = new URLSearchParams({
    bookId: state.frontState.bookId,
    chapter: String(state.frontState.chapter),
    versions: versionIds.join(","),
  });

  const res = await fetch(`/api/scripture?${params.toString()}`, {
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    state.scriptureRows = [];
    throw new Error(data.error || "读取经文失败");
  }

  state.scriptureRows = data.rows || [];
}

async function loadStudyContent() {
  const params = new URLSearchParams({
    version: state.frontState.contentVersion,
    lang: state.frontState.contentLang,
    bookId: state.frontState.bookId,
    chapter: String(state.frontState.chapter),
  });

  const res = await fetch(`/api/study-content?${params.toString()}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    state.studyContent = null;
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    state.studyContent = null;
    throw new Error(data.error || "读取查经内容失败");
  }

  state.studyContent = data;
}

function updatePageTitle() {
  const chapterNumberEl = document.getElementById("pageChapterNumber");
  const bookTitleEl = document.getElementById("pageBookTitle");
  const bottomTitleEl = document.getElementById("chapterNavTitleBottom");
  const bookChapterTriggerText = document.getElementById(
    "bookChapterTriggerText"
  );

  const bookLabel = getCurrentBookLabel();
  const chapterLabel = `${state.frontState.chapter}`;

  if (chapterNumberEl) chapterNumberEl.textContent = chapterLabel;
  if (bookTitleEl) bookTitleEl.textContent = bookLabel;
  if (bottomTitleEl) {
    bottomTitleEl.textContent = `${bookLabel}${state.frontState.chapter}章`;
  }
  if (bookChapterTriggerText) {
    bookChapterTriggerText.textContent = `${bookLabel} ${state.frontState.chapter}章`;
  }
}

function renderStudyContent() {
  const leftBlocksEl = document.getElementById("leftBlocks");
  const rightBlocksEl = document.getElementById("rightBlocks");
  const repeatedWordsEl = document.getElementById("repeatedWordsLine");

  if (!state.studyContent) {
    if (repeatedWordsEl) repeatedWordsEl.textContent = "—";
    if (leftBlocksEl) {
      leftBlocksEl.innerHTML = `
        <div class="result-box">
          <div class="empty-state">这一章还没有该版本 / 该语言的内容。</div>
        </div>
      `;
    }
    if (rightBlocksEl) rightBlocksEl.innerHTML = "";
    return;
  }

  if (repeatedWordsEl) {
    repeatedWordsEl.textContent = renderRepeatedWords(
      state.studyContent.repeatedWords || []
    );
  }

  const rendered = (state.studyContent.segments || []).map(renderSegmentCard);
  const splitIndex = Math.ceil(rendered.length / 2);

  if (leftBlocksEl)
    leftBlocksEl.innerHTML = rendered.slice(0, splitIndex).join("");
  if (rightBlocksEl)
    rightBlocksEl.innerHTML = rendered.slice(splitIndex).join("");
}

function renderRepeatedWords(items) {
  if (!items || !items.length) return "—";

  return [...items]
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
    .map((item) => {
      const word = escapeHtml(item.word || "");
      const count = Number(item.count || 0);
      return `${word}${count > 0 ? ` × ${count}` : ""}`;
    })
    .join("　");
}

function cleanSegmentTitle(title) {
  return String(title || "")
    .replace(/\s*[\(（]\s*\d+\s*[-—–~～]\s*\d+\s*节?\s*[\)）]\s*$/g, "")
    .replace(/\s*[\(（]\s*\d+\s*节?\s*[\)）]\s*$/g, "")
    .trim();
}

function getHighlightWords() {
  return (state.studyContent?.repeatedWords || [])
    .map((x) => String(x.word || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
}

function highlightText(rawText, words) {
  if (!rawText) return "";
  if (!words?.length) return escapeHtml(rawText);

  const cleanWords = words.map((w) => String(w).trim()).filter(Boolean);
  const escapedWords = cleanWords.map((w) =>
    w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  const regex = new RegExp(escapedWords.join("|"), "g");
  let result = "";
  let lastIndex = 0;

  for (const match of rawText.matchAll(regex)) {
    const found = match[0];
    const offset = match.index ?? 0;

    result += escapeHtml(rawText.slice(lastIndex, offset));

    const wordIndex = cleanWords.findIndex((w) => w === found);
    const clsIndex = wordIndex >= 0 ? Math.min(wordIndex + 1, 3) : 1;

    result += `<span class="hl-word hl-${clsIndex}">${escapeHtml(
      found
    )}</span>`;
    lastIndex = offset + found.length;
  }

  result += escapeHtml(rawText.slice(lastIndex));
  return result;
}

function getVersesByRange(start, end) {
  return (state.scriptureRows || []).filter(
    (row) => row.verse >= start && row.verse <= end
  );
}

function renderVerseRangeBlock(start, end) {
  const rows = getVersesByRange(start, end);
  const primaryId = state.frontState.primaryScriptureVersionId;
  const secondaryVersions = getSecondaryScriptureVersions();
  const highlightWords = getHighlightWords();
  const primaryVersion = getPrimaryScriptureVersion();

  if (!rows.length) {
    return `<div class="flow-scripture empty-state">暂无这段经文</div>`;
  }

  return `
    <div class="flow-scripture">
      ${rows
        .map((row) => {
          const primaryText = row.texts?.[primaryId] || "";
          const secondaryHtml = secondaryVersions
            .map((version) => {
              const text = row.texts?.[version.id] || "";
              if (!text) return "";
              return `
                <div class="flow-verse-sub" style="margin-top:4px; padding-left:26px;">
                  <span style="display:inline-block; min-width:56px; opacity:.68;">${escapeHtml(
                    version.label
                  )}</span>
                  <span>${highlightText(text, highlightWords)}</span>
                </div>
              `;
            })
            .join("");

          return `
            <div class="flow-verse">
              <div>
                <span class="verse-no">${row.verse}</span>
                <span>${highlightText(primaryText, highlightWords)}</span>
              </div>
              ${
                primaryVersion
                  ? `<div style="font-size:.78em; opacity:.62; padding-left:26px; margin-top:2px;">${escapeHtml(
                      primaryVersion.label
                    )}</div>`
                  : ""
              }
              ${secondaryHtml}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderSegmentCard(seg) {
  const title = cleanSegmentTitle(seg.title || "未命名段落");
  const start = Number(seg.rangeStart || 0);
  const end = Number(seg.rangeEnd || 0);

  const scriptureHtml =
    state.frontState.hideScripture || !start || !end
      ? ""
      : renderVerseRangeBlock(start, end);

  return `
    <article class="flow-card ${
      state.frontState.hideScripture ? "flow-card-no-scripture" : ""
    }">
      <h3>${escapeHtml(title)}</h3>
      ${scriptureHtml}
      <div class="mini-section">
        <ul class="plain-list ${
          state.frontState.hideScripture ? "plain-list-emphasis" : ""
        }">
          ${(seg.questions || [])
            .map((q) => `<li>${escapeHtml(q)}</li>`)
            .join("")}
        </ul>
      </div>
    </article>
  `;
}

function flattenBooks() {
  return state.bootstrap?.testamentOptions || [];
}

function getCurrentBookIndex() {
  const allBooks = flattenBooks();
  return allBooks.findIndex((b) => b.bookId === state.frontState.bookId);
}

function getAdjacentChapterTarget(direction) {
  const allBooks = flattenBooks();
  const idx = getCurrentBookIndex();
  if (idx < 0) return null;

  const current = allBooks[idx];
  const currentChapter = Number(state.frontState.chapter || 1);

  if (direction < 0) {
    if (currentChapter > 1) {
      return {
        testament: current.testamentName,
        bookId: current.bookId,
        chapter: currentChapter - 1,
      };
    }

    const prevBook = allBooks[idx - 1];
    if (!prevBook) return null;

    return {
      testament: prevBook.testamentName,
      bookId: prevBook.bookId,
      chapter: prevBook.chapters,
    };
  }

  if (currentChapter < Number(current.chapters || 1)) {
    return {
      testament: current.testamentName,
      bookId: current.bookId,
      chapter: currentChapter + 1,
    };
  }

  const nextBook = allBooks[idx + 1];
  if (!nextBook) return null;

  return {
    testament: nextBook.testamentName,
    bookId: nextBook.bookId,
    chapter: 1,
  };
}

function initChapterNav() {
  document
    .getElementById("prevChapterBtnTop")
    ?.addEventListener("click", () => {
      goAdjacentChapter(-1);
    });

  document
    .getElementById("nextChapterBtnTop")
    ?.addEventListener("click", () => {
      goAdjacentChapter(1);
    });

  document
    .getElementById("prevChapterBtnBottom")
    ?.addEventListener("click", () => {
      goAdjacentChapter(-1);
    });

  document
    .getElementById("nextChapterBtnBottom")
    ?.addEventListener("click", () => {
      goAdjacentChapter(1);
    });
}

async function goAdjacentChapter(direction) {
  const target = getAdjacentChapterTarget(direction);
  if (!target) return;

  state.frontState.testament = target.testament;
  state.frontState.bookId = target.bookId;
  state.frontState.chapter = target.chapter;

  saveFrontState();
  renderAllSelectors();
  await refreshCurrentPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateChapterNavUI() {
  const prevDisabled = !getAdjacentChapterTarget(-1);
  const nextDisabled = !getAdjacentChapterTarget(1);

  [
    document.getElementById("prevChapterBtnTop"),
    document.getElementById("prevChapterBtnBottom"),
  ].forEach((btn) => {
    if (btn) btn.disabled = prevDisabled;
  });

  [
    document.getElementById("nextChapterBtnTop"),
    document.getElementById("nextChapterBtnBottom"),
  ].forEach((btn) => {
    if (btn) btn.disabled = nextDisabled;
  });
}

/* =========================
   后台管理
   ========================= */
function initAdminModal() {
  const passwordModal = document.getElementById("adminPasswordModal");
  const adminModal = document.getElementById("adminModal");
  const openAdminBtn = document.getElementById("openAdminBtn");
  const closeAdminPasswordBtn = document.getElementById(
    "closeAdminPasswordBtn"
  );
  const submitAdminPasswordBtn = document.getElementById(
    "submitAdminPasswordBtn"
  );
  const closeAdminBtn = document.getElementById("closeAdminBtn");
  const adminPasswordInput = document.getElementById("adminPasswordInput");
  const adminPasswordError = document.getElementById("adminPasswordError");

  async function openPasswordModal() {
    if (adminPasswordInput) adminPasswordInput.value = "";
    if (adminPasswordError) adminPasswordError.textContent = "";
    if (passwordModal) passwordModal.style.display = "block";
  }

  async function openAdminRealModal() {
    await loadAdminBootstrap();
    bindAdminTabs();
    await initRuleEditorTab();
    await initTestGenerateTab();
    await initPublishedManagerTab();
    await initScriptureVersionManagerTab();
    startJobsAutoRefresh();
    if (adminModal) adminModal.style.display = "block";
  }

  openAdminBtn?.addEventListener("click", openPasswordModal);

  closeAdminPasswordBtn?.addEventListener("click", () => {
    if (passwordModal) passwordModal.style.display = "none";
  });

  submitAdminPasswordBtn?.addEventListener("click", async () => {
    if (adminPasswordInput?.value === ADMIN_PASSWORD) {
      if (passwordModal) passwordModal.style.display = "none";
      await openAdminRealModal();
    } else if (adminPasswordError) {
      adminPasswordError.textContent = "密码不正确";
    }
  });

  closeAdminBtn?.addEventListener("click", () => {
    if (adminModal) adminModal.style.display = "none";
    stopJobsAutoRefresh();
  });
}

async function loadAdminBootstrap() {
  const res = await fetch("/api/admin/bootstrap", { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "后台初始化失败");
  }

  adminState.bootstrap = data;
  adminState.scriptureVersions = data.scriptureVersions || [];
}

function bindAdminTabs() {
  ensurePublishedTabExists();
  ensureScriptureVersionManagerTabExists();

  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.onclick = null;
    btn.addEventListener("click", () => {
      const tab = btn.dataset.adminTab;

      document.querySelectorAll(".admin-tab-btn").forEach((x) => {
        x.classList.toggle("active", x === btn);
      });

      document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      document.getElementById(`adminTab-${tab}`)?.classList.add("active");
    });
  });
}

function ensurePublishedTabExists() {
  if (document.querySelector('.admin-tab-btn[data-admin-tab="published"]'))
    return;

  const tabsWrap = document.querySelector(".admin-tabs");
  const existingPanel = document.getElementById("adminTab-published");

  if (!existingPanel) {
    const panel = document.createElement("div");
    panel.className = "admin-tab-panel";
    panel.id = "adminTab-published";
    panel.innerHTML = `
      <div class="admin-two-col">
        <div class="admin-left-col">
          <div class="section-title">已发布内容查询</div>

          <div class="admin-grid">
            <div>
              <div class="label">内容版本</div>
              <select id="publishedVersionSelect"></select>
            </div>
            <div>
              <div class="label">内容语言</div>
              <select id="publishedLangSelect"></select>
            </div>
          </div>

          <div class="modal-actions">
            <button id="loadPublishedOverviewBtn" class="primary-btn" type="button">读取发布概览</button>
          </div>

          <div class="section-title">发布统计</div>
          <div id="publishedSummaryBox" class="result-box">尚未读取。</div>

          <div class="section-title">卷 / 章节列表</div>
          <div id="publishedBooksBox" class="admin-preview-result">
            <div class="empty-state">暂无数据。</div>
          </div>
        </div>

        <div class="admin-right-col">
          <div class="section-title">已发布章节详情</div>

          <div class="admin-grid">
            <div>
              <div class="label">书卷</div>
              <input id="publishedDetailBookInput" class="custom-textarea single-input" placeholder="例如 GEN" />
            </div>
            <div>
              <div class="label">章节</div>
              <input id="publishedDetailChapterInput" type="number" class="custom-textarea single-input" placeholder="例如 1" />
            </div>
          </div>

          <div class="modal-actions">
            <button id="loadPublishedChapterBtn" class="secondary-btn" type="button">查看已发布章节</button>
            <button id="deletePublishedChapterBtn" class="secondary-btn" type="button">删除已发布章节</button>
          </div>

          <div class="section-title">结果</div>
          <div id="publishedDetailBox" class="admin-preview-box">尚未读取。</div>
        </div>
      </div>
    `;

    const modalCard = document.querySelector(".modal-card-admin");
    const existingPanels = modalCard?.querySelectorAll(".admin-tab-panel");
    if (existingPanels?.length) {
      existingPanels[existingPanels.length - 1].after(panel);
    }
  }

  if (tabsWrap) {
    const btn = document.createElement("button");
    btn.className = "admin-tab-btn";
    btn.type = "button";
    btn.dataset.adminTab = "published";
    btn.textContent = "已发布内容";
    tabsWrap.appendChild(btn);
  }
}

function ensureScriptureVersionManagerTabExists() {
  if (
    document.querySelector(
      '.admin-tab-btn[data-admin-tab="scripture_versions"]'
    )
  ) {
    return;
  }

  const tabsWrap = document.querySelector(".admin-tabs");

  const panel = document.createElement("div");
  panel.className = "admin-tab-panel";
  panel.id = "adminTab-scripture_versions";
  panel.innerHTML = `
    <div class="admin-two-col">
      <div class="admin-left-col">
        <div class="section-title">圣经版本列表</div>
        <div class="modal-actions">
          <button id="refreshScriptureVersionsBtn" class="secondary-btn" type="button">刷新版本</button>
          <button id="newScriptureVersionBtn" class="secondary-btn" type="button">新建版本</button>
        </div>
        <div id="scriptureVersionsListBox" class="admin-preview-result">
          <div class="empty-state">暂无数据。</div>
        </div>
      </div>

      <div class="admin-right-col">
        <div class="section-title">圣经版本编辑</div>

        <div class="admin-grid">
          <div>
            <div class="label">ID</div>
            <input id="svId" class="custom-textarea single-input" placeholder="例如 web_en" />
          </div>
          <div>
            <div class="label">标签</div>
            <input id="svLabel" class="custom-textarea single-input" placeholder="例如 WEB English" />
          </div>
          <div>
            <div class="label">语言</div>
            <input id="svLang" class="custom-textarea single-input" placeholder="例如 en" />
          </div>
          <div>
            <div class="label">sourceType</div>
            <input id="svSourceType" class="custom-textarea single-input" placeholder="usfx" />
          </div>
          <div>
            <div class="label">sourceFile</div>
            <input id="svSourceFile" class="custom-textarea single-input" placeholder="data/eng-web.usfx.xml" />
          </div>
          <div>
            <div class="label">sortOrder</div>
            <input id="svSortOrder" type="number" class="custom-textarea single-input" placeholder="10" />
          </div>
          <div style="grid-column:1 / -1;">
            <div class="label">description</div>
            <input id="svDescription" class="custom-textarea single-input" placeholder="版本说明" />
          </div>
        </div>

        <div class="admin-grid" style="margin-top:10px;">
          <label><input id="svEnabled" type="checkbox" checked /> enabled</label>
          <label><input id="svUiEnabled" type="checkbox" checked /> uiEnabled</label>
          <label><input id="svContentEnabled" type="checkbox" checked /> contentEnabled</label>
          <label><input id="svScriptureEnabled" type="checkbox" checked /> scriptureEnabled</label>
        </div>

        <div class="admin-grid" style="margin-top:10px;">
          <div>
            <div class="label">contentMode</div>
            <input id="svContentMode" class="custom-textarea single-input" placeholder="native" />
          </div>
        </div>

        <div class="modal-actions">
          <button id="saveScriptureVersionBtn" class="primary-btn" type="button">保存版本</button>
          <button id="deleteScriptureVersionBtn" class="secondary-btn" type="button">删除当前版本</button>
        </div>

        <div class="section-title">结果</div>
        <div id="scriptureVersionEditorResult" class="admin-preview-box">尚未操作。</div>
      </div>
    </div>
  `;

  const modalCard = document.querySelector(".modal-card-admin");
  const existingPanels = modalCard?.querySelectorAll(".admin-tab-panel");
  if (existingPanels?.length) {
    existingPanels[existingPanels.length - 1].after(panel);
  }

  if (tabsWrap) {
    const btn = document.createElement("button");
    btn.className = "admin-tab-btn";
    btn.type = "button";
    btn.dataset.adminTab = "scripture_versions";
    btn.textContent = "圣经版本";
    tabsWrap.appendChild(btn);
  }
}

async function initRuleEditorTab() {
  const versionSelect = document.getElementById("adminRuleVersionSelect");
  if (!versionSelect) return;

  versionSelect.innerHTML = (adminState.bootstrap?.contentVersions || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  versionSelect.value = adminState.currentRuleVersion;

  versionSelect.onchange = async () => {
    adminState.currentRuleVersion = versionSelect.value;
    await loadRuleIntoEditor(adminState.currentRuleVersion);
  };

  const saveRuleBtn = document.getElementById("saveRuleBtn");
  const reloadRuleBtn = document.getElementById("reloadRuleBtn");

  if (saveRuleBtn) {
    saveRuleBtn.onclick = async () => {
      await saveRuleFromEditor();
    };
  }

  if (reloadRuleBtn) {
    reloadRuleBtn.onclick = async () => {
      await loadRuleIntoEditor(adminState.currentRuleVersion);
    };
  }

  await loadRuleIntoEditor(adminState.currentRuleVersion);
}

async function loadRuleIntoEditor(versionId) {
  const res = await fetch(
    `/api/admin/rule?version=${encodeURIComponent(versionId)}`,
    {
      cache: "no-store",
    }
  );
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "读取规则失败");
  }

  adminState.currentRuleConfig = data;
  fillRuleEditor(data);
  renderRulePreview(data);
}

function fillRuleEditor(ruleConfig) {
  const base = ruleConfig?.baseRules || {};
  const langProfiles = ruleConfig?.languageProfiles || {};

  document.getElementById("adminRuleLabel").value = ruleConfig?.label || "";
  document.getElementById("adminRuleScene").value = ruleConfig?.scene || "";
  document.getElementById("adminRuleTemplate").value =
    ruleConfig?.template || "";
  document.getElementById("adminRuleStyleTags").value = (
    ruleConfig?.styleTags || []
  ).join(", ");

  document.getElementById("adminMinQuestions").value =
    base.minQuestionsPerSegment ?? 2;
  document.getElementById("adminMaxQuestions").value =
    base.maxQuestionsPerSegment ?? 4;
  document.getElementById("adminChapterQuestionMin").value =
    base.chapterQuestionMin ?? 15;
  document.getElementById("adminChapterQuestionMax").value =
    base.chapterQuestionMax ?? 20;

  document.getElementById("adminLeaderHint").checked = !!base.leaderHint;
  document.getElementById("adminAvoidRepeat").checked = !!base.avoidRepeat;
  document.getElementById("adminAllowLightApplication").checked =
    !!base.allowLightApplication;
  document.getElementById("adminAllowGospelEmphasis").checked =
    !!base.allowGospelEmphasis;
  document.getElementById("adminAllowChildrenTone").checked =
    !!base.allowChildrenTone;
  document.getElementById("adminAllowYouthTone").checked =
    !!base.allowYouthTone;
  document.getElementById("adminAllowCoupleTone").checked =
    !!base.allowCoupleTone;
  document.getElementById("adminAllowWorkplaceTone").checked =
    !!base.allowWorkplaceTone;

  document.getElementById("adminPromptZh").value =
    langProfiles?.zh?.customPrompt || "";
  document.getElementById("adminPromptEn").value =
    langProfiles?.en?.customPrompt || "";
  document.getElementById("adminPromptEs").value =
    langProfiles?.es?.customPrompt || "";

  document.getElementById("adminSystemPromptOverride").value =
    ruleConfig?.systemPromptOverride || "";
}

function collectRuleFromEditor() {
  return {
    id: adminState.currentRuleVersion,
    label: document.getElementById("adminRuleLabel")?.value.trim() || "",
    scene: document.getElementById("adminRuleScene")?.value.trim() || "",
    template: document.getElementById("adminRuleTemplate")?.value.trim() || "",
    styleTags: (document.getElementById("adminRuleStyleTags")?.value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    baseRules: {
      leaderHint: !!document.getElementById("adminLeaderHint")?.checked,
      avoidRepeat: !!document.getElementById("adminAvoidRepeat")?.checked,
      allowLightApplication: !!document.getElementById(
        "adminAllowLightApplication"
      )?.checked,
      allowGospelEmphasis: !!document.getElementById("adminAllowGospelEmphasis")
        ?.checked,
      allowChildrenTone: !!document.getElementById("adminAllowChildrenTone")
        ?.checked,
      allowYouthTone: !!document.getElementById("adminAllowYouthTone")?.checked,
      allowCoupleTone: !!document.getElementById("adminAllowCoupleTone")
        ?.checked,
      allowWorkplaceTone: !!document.getElementById("adminAllowWorkplaceTone")
        ?.checked,
      minQuestionsPerSegment: Number(
        document.getElementById("adminMinQuestions")?.value || 2
      ),
      maxQuestionsPerSegment: Number(
        document.getElementById("adminMaxQuestions")?.value || 4
      ),
      chapterQuestionMin: Number(
        document.getElementById("adminChapterQuestionMin")?.value || 15
      ),
      chapterQuestionMax: Number(
        document.getElementById("adminChapterQuestionMax")?.value || 20
      ),
    },
    languageProfiles: {
      zh: {
        customPrompt:
          document.getElementById("adminPromptZh")?.value.trim() || "",
      },
      en: {
        customPrompt:
          document.getElementById("adminPromptEn")?.value.trim() || "",
      },
      es: {
        customPrompt:
          document.getElementById("adminPromptEs")?.value.trim() || "",
      },
    },
    systemPromptOverride:
      document.getElementById("adminSystemPromptOverride")?.value.trim() || "",
  };
}

async function saveRuleFromEditor() {
  const nextRule = collectRuleFromEditor();

  const res = await fetch("/api/admin/rule/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: adminState.currentRuleVersion,
      ruleConfig: nextRule,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "保存规则失败");
    return;
  }

  adminState.currentRuleConfig = nextRule;
  renderRulePreview(nextRule);
  alert("规则已保存。");
}

function renderRulePreview(ruleConfig) {
  const el = document.getElementById("adminRulePreview");
  if (!el) return;
  el.textContent = JSON.stringify(ruleConfig, null, 2);
}

async function initTestGenerateTab() {
  renderTestVersionOptions();
  renderTestLangOptions();
  renderTestBookOptions();
  renderTestChapterOptions();
  ensureJobPanelExists();

  const testBookSelect = document.getElementById("testBookSelect");
  const runTestGenerateBtn = document.getElementById("runTestGenerateBtn");
  const saveTestResultBtn = document.getElementById("saveTestResultBtn");
  const createBookJobBtn = document.getElementById("createBookJobBtn");
  const createOldJobBtn = document.getElementById("createOldJobBtn");
  const createNewJobBtn = document.getElementById("createNewJobBtn");
  const createBibleJobBtn = document.getElementById("createBibleJobBtn");
  const refreshJobsBtn = document.getElementById("refreshJobsBtn");

  if (testBookSelect) {
    testBookSelect.onchange = () => {
      renderTestChapterOptions();
      syncRangeInputsWithSelectedBook();
    };
  }

  if (runTestGenerateBtn) {
    runTestGenerateBtn.onclick = async () => {
      await runTestGenerate();
    };
  }

  if (saveTestResultBtn) {
    saveTestResultBtn.onclick = async () => {
      await saveTestResultToContent();
    };
  }

  if (createBookJobBtn) {
    createBookJobBtn.onclick = async () => {
      await createBulkJobFromUI("book");
    };
  }

  if (createOldJobBtn) {
    createOldJobBtn.onclick = async () => {
      await createBulkJobFromUI("old_testament");
    };
  }

  if (createNewJobBtn) {
    createNewJobBtn.onclick = async () => {
      await createBulkJobFromUI("new_testament");
    };
  }

  if (createBibleJobBtn) {
    createBibleJobBtn.onclick = async () => {
      await createBulkJobFromUI("bible");
    };
  }

  if (refreshJobsBtn) {
    refreshJobsBtn.onclick = async () => {
      await refreshJobsList();
    };
  }

  syncRangeInputsWithSelectedBook();
  await refreshJobsList();
}

function ensureJobPanelExists() {
  if (document.getElementById("jobManagerWrap")) return;

  const anchor = document.getElementById("saveTestResultStatus");
  if (!anchor) return;

  const wrap = document.createElement("div");
  wrap.id = "jobManagerWrap";
  wrap.innerHTML = `
    <div class="section-title">批量生成任务</div>

    <div class="admin-grid" style="margin-bottom:12px;">
      <div>
        <div class="label">起始章（仅整卷范围生效）</div>
        <input id="jobStartChapterInput" type="number" class="custom-textarea single-input" placeholder="例如 1" />
      </div>
      <div>
        <div class="label">结束章（仅整卷范围生效）</div>
        <input id="jobEndChapterInput" type="number" class="custom-textarea single-input" placeholder="例如 10" />
      </div>
    </div>

    <div class="modal-actions">
      <button id="createBookJobBtn" class="secondary-btn" type="button">生成整卷 / 范围</button>
      <button id="createOldJobBtn" class="secondary-btn" type="button">生成旧约</button>
      <button id="createNewJobBtn" class="secondary-btn" type="button">生成新约</button>
      <button id="createBibleJobBtn" class="secondary-btn" type="button">生成整本</button>
      <button id="refreshJobsBtn" class="secondary-btn" type="button">刷新任务</button>
    </div>

    <div class="section-title">任务状态</div>
    <div id="jobCreateStatus" class="result-box">尚未创建任务。</div>

    <div class="section-title">任务列表</div>
    <div id="jobsListBox" class="admin-preview-result">
      <div class="empty-state">暂无任务。</div>
    </div>
  `;

  anchor.parentElement?.appendChild(wrap);
}

function renderTestVersionOptions() {
  const el = document.getElementById("testVersionSelect");
  if (!el) return;

  el.innerHTML = (adminState.bootstrap?.contentVersions || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  el.value = adminState.currentRuleVersion || "default";
}

function renderTestLangOptions() {
  const el = document.getElementById("testLangSelect");
  if (!el) return;

  el.innerHTML = (adminState.bootstrap?.languages || [])
    .filter((x) => x.enabled)
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  el.value = "zh";
}

function renderTestBookOptions() {
  const el = document.getElementById("testBookSelect");
  if (!el) return;

  el.innerHTML = (adminState.bootstrap?.books || [])
    .map(
      (book) =>
        `<option value="${escapeHtml(book.bookId)}">${escapeHtml(
          book.bookCn
        )}</option>`
    )
    .join("");

  el.value = "GEN";
}

function renderTestChapterOptions() {
  const bookSelect = document.getElementById("testBookSelect");
  const chapterSelect = document.getElementById("testChapterSelect");
  if (!bookSelect || !chapterSelect) return;

  const book = (adminState.bootstrap?.books || []).find(
    (x) => x.bookId === bookSelect.value
  );

  const chapterCount = Number(book?.chapters || 1);
  chapterSelect.innerHTML = Array.from({ length: chapterCount }, (_, i) => {
    const n = i + 1;
    return `<option value="${n}">${n}</option>`;
  }).join("");

  chapterSelect.value = "1";
}

function syncRangeInputsWithSelectedBook() {
  const startInput = document.getElementById("jobStartChapterInput");
  const endInput = document.getElementById("jobEndChapterInput");
  const bookId = document.getElementById("testBookSelect")?.value;
  const book = (adminState.bootstrap?.books || []).find(
    (x) => x.bookId === bookId
  );

  if (!book || !startInput || !endInput) return;

  if (!startInput.value) startInput.value = "1";
  if (!endInput.value) endInput.value = String(book.chapters || 1);

  startInput.min = "1";
  endInput.min = "1";
  startInput.max = String(book.chapters || 1);
  endInput.max = String(book.chapters || 1);
}

async function runTestGenerate() {
  const version = document.getElementById("testVersionSelect")?.value;
  const lang = document.getElementById("testLangSelect")?.value;
  const bookId = document.getElementById("testBookSelect")?.value;
  const chapter = Number(
    document.getElementById("testChapterSelect")?.value || 1
  );

  const statusEl = document.getElementById("testGenerateStatus");
  const resultEl = document.getElementById("testGenerateResult");
  const saveStatusEl = document.getElementById("saveTestResultStatus");

  if (statusEl) statusEl.textContent = "正在生成，请稍候...";
  if (saveStatusEl) saveStatusEl.textContent = "尚未保存。";
  if (resultEl) {
    resultEl.innerHTML = `<div class="empty-state">正在请求模型生成内容...</div>`;
  }

  const res = await fetch("/api/admin/test-generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version,
      lang,
      bookId,
      chapter,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (statusEl)
      statusEl.textContent = `生成失败：${data.error || "未知错误"}`;
    if (resultEl) {
      resultEl.innerHTML = `<div class="empty-state">生成失败：${escapeHtml(
        data.error || "未知错误"
      )}</div>`;
    }
    return;
  }

  adminState.testResult = data;

  if (statusEl) {
    statusEl.textContent = `生成成功：${
      data.bookLabel || bookId
    } ${chapter} 章｜${data.versionLabel || version}｜${lang}`;
  }

  renderTestGenerateResult(data);
}

function renderTestGenerateResult(data) {
  const el = document.getElementById("testGenerateResult");
  if (!el) return;

  const repeatedWordsText = (data.repeatedWords || [])
    .map((x) => `${x.word}${x.count ? ` × ${x.count}` : ""}`)
    .join("　");

  el.innerHTML = `
    <div class="test-result-title">${escapeHtml(data.title || "测试结果")}</div>
    <div class="test-result-line"><strong>主题：</strong>${escapeHtml(
      data.theme || "—"
    )}</div>
    <div class="test-result-line"><strong>重复词：</strong>${escapeHtml(
      repeatedWordsText || "—"
    )}</div>

    ${(data.segments || [])
      .map(
        (seg) => `
          <div class="test-result-seg">
            <h4>${escapeHtml(seg.title || "未命名段落")}</h4>
            <div class="test-result-line">
              <strong>范围：</strong>${escapeHtml(
                `${seg.rangeStart || "?"}-${seg.rangeEnd || "?"}`
              )}
            </div>
            <ul>
              ${(seg.questions || [])
                .map((q) => `<li>${escapeHtml(q)}</li>`)
                .join("")}
            </ul>
          </div>
        `
      )
      .join("")}

    <div class="test-result-line"><strong>结尾：</strong>${escapeHtml(
      data.closing || "—"
    )}</div>
  `;
}

async function saveTestResultToContent() {
  const saveStatusEl = document.getElementById("saveTestResultStatus");

  if (!adminState.testResult) {
    if (saveStatusEl) saveStatusEl.textContent = "请先测试生成，再保存。";
    return;
  }

  if (saveStatusEl) saveStatusEl.textContent = "正在保存此章内容并合并发布...";

  const res = await fetch("/api/admin/save-test-result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studyContent: adminState.testResult,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (saveStatusEl) {
      saveStatusEl.textContent = `保存失败：${data.error || "未知错误"}`;
    }
    return;
  }

  if (saveStatusEl) {
    saveStatusEl.textContent = `保存成功：build = ${data.buildId}（已合并发布）`;
  }

  const sameVersion =
    state.frontState.contentVersion === adminState.testResult.version;
  const sameLang =
    state.frontState.contentLang === adminState.testResult.contentLang;
  const sameBook = state.frontState.bookId === adminState.testResult.bookId;
  const sameChapter =
    Number(state.frontState.chapter) === Number(adminState.testResult.chapter);

  if (sameVersion && sameLang && sameBook && sameChapter) {
    await loadStudyContent();
    renderStudyContent();
  }
}

function collectJobPayload(scope) {
  const version =
    document.getElementById("testVersionSelect")?.value || "default";
  const lang = document.getElementById("testLangSelect")?.value || "zh";
  const bookId = document.getElementById("testBookSelect")?.value || "GEN";
  const startChapter = Number(
    document.getElementById("jobStartChapterInput")?.value || 0
  );
  const endChapter = Number(
    document.getElementById("jobEndChapterInput")?.value || 0
  );

  const payload = {
    scope,
    versionMode: "single",
    version,
    langMode: "single",
    lang,
    bookId,
    autoPublish: true,
  };

  if (scope === "book" && startChapter > 0 && endChapter > 0) {
    payload.startChapter = startChapter;
    payload.endChapter = endChapter;
  }

  return payload;
}

async function createBulkJobFromUI(scope) {
  const statusEl = document.getElementById("jobCreateStatus");
  const payload = collectJobPayload(scope);

  if (statusEl) statusEl.textContent = "正在创建任务...";

  const res = await fetch("/api/admin/job/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    if (statusEl)
      statusEl.textContent = `创建失败：${data.error || "未知错误"}`;
    return;
  }

  const scopeLabelMap = {
    book: "整卷/范围",
    old_testament: "旧约",
    new_testament: "新约",
    bible: "整本",
  };

  const rangeText =
    payload.scope === "book" && payload.startChapter && payload.endChapter
      ? `｜范围：${payload.startChapter}-${payload.endChapter}章`
      : "";

  if (statusEl) {
    statusEl.textContent = `任务已创建：${data.job.id}｜范围：${
      scopeLabelMap[data.job.scope] || data.job.scope
    }${rangeText}｜总数：${data.job.total}`;
  }

  await refreshJobsList(true);
}

async function retryFailedJob(jobId) {
  const statusEl = document.getElementById("jobCreateStatus");
  if (statusEl) statusEl.textContent = `正在创建失败重跑任务：${jobId}`;

  const res = await fetch(
    `/api/admin/job/${encodeURIComponent(jobId)}/retry-failed`,
    {
      method: "POST",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    if (statusEl)
      statusEl.textContent = `重跑失败：${data.error || "未知错误"}`;
    return;
  }

  if (statusEl) {
    statusEl.textContent = `失败章节重跑任务已创建：${data.job.id}｜来源：${jobId}｜总数：${data.job.total}`;
  }

  await refreshJobsList(true);
}

async function refreshJobsList(forceRefreshFront = false) {
  const box = document.getElementById("jobsListBox");
  if (!box) return;

  const res = await fetch("/api/admin/jobs", { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    box.innerHTML = `<div class="empty-state">读取任务失败：${escapeHtml(
      data.error || "未知错误"
    )}</div>`;
    return;
  }

  const jobs = data.jobs || [];
  const snapshotKey = jobs
    .map(
      (job) =>
        `${job.id}:${job.status}:${job.done}:${job.progressText}:${
          job.buildId
        }:${job.completionSummary || ""}:${job.errors?.length || 0}`
    )
    .join("|");

  const snapshotChanged = snapshotKey !== adminState.lastJobsSnapshotKey;
  adminState.lastJobsSnapshotKey = snapshotKey;

  renderJobsList(jobs);

  if (snapshotChanged || forceRefreshFront) {
    await maybeRefreshFrontAfterJobs(jobs);
  }
}

function getScopeLabel(scope) {
  const map = {
    chapter: "当前章",
    book: "整卷/范围",
    old_testament: "旧约",
    new_testament: "新约",
    bible: "整本",
  };
  return map[scope] || scope;
}

function renderJobsList(jobs) {
  const box = document.getElementById("jobsListBox");
  if (!box) return;

  if (!jobs.length) {
    box.innerHTML = `<div class="empty-state">暂无任务。</div>`;
    return;
  }

  box.innerHTML = jobs
    .map((job) => {
      const canCancel = job.status === "queued" || job.status === "running";
      const mergedPublished =
        job.status === "completed" &&
        String(job.progressText || "").includes("自动合并发布");
      const errorCount = Number(job.errors?.length || 0);
      const canRetryFailed = job.status === "completed" && errorCount > 0;
      const rangeText =
        job.scope === "book" && job.startChapter && job.endChapter
          ? `（${job.startChapter}-${job.endChapter}章）`
          : "";

      const errorHtml =
        errorCount > 0
          ? `
            <details style="margin-top:10px;">
              <summary style="cursor:pointer; font-weight:700;">查看错误详情（${errorCount}）</summary>
              <div style="margin-top:8px;">
                ${job.errors
                  .map(
                    (err) => `
                      <div class="result-box" style="margin-bottom:8px;">
                        <div><strong>目标：</strong>${escapeHtml(
                          `${err.target?.versionId || ""} / ${
                            err.target?.lang || ""
                          } / ${err.target?.bookId || ""} / ${
                            err.target?.chapter || ""
                          }`
                        )}</div>
                        <div><strong>错误：</strong>${escapeHtml(
                          err.message || "未知错误"
                        )}</div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </details>
          `
          : "";

      return `
        <div class="test-result-seg">
          <h4>${escapeHtml(job.id)}</h4>
          <div class="test-result-line"><strong>状态：</strong>${escapeHtml(
            job.status || "—"
          )}</div>
          <div class="test-result-line"><strong>范围：</strong>${escapeHtml(
            getScopeLabel(job.scope || "—")
          )}${escapeHtml(rangeText)}</div>
          <div class="test-result-line"><strong>进度：</strong>${escapeHtml(
            String(job.done || 0)
          )} / ${escapeHtml(String(job.total || 0))}</div>
          <div class="test-result-line"><strong>说明：</strong>${escapeHtml(
            job.progressText || "—"
          )}</div>
          <div class="test-result-line"><strong>build：</strong>${escapeHtml(
            job.buildId || "—"
          )}</div>
          ${
            job.retryOfJobId
              ? `<div class="test-result-line"><strong>重跑来源：</strong>${escapeHtml(
                  job.retryOfJobId
                )}</div>`
              : ""
          }
          ${
            mergedPublished
              ? `<div class="test-result-line"><strong>发布：</strong>已自动合并发布</div>`
              : ""
          }
          ${
            job.completionSummary
              ? `<div class="test-result-line"><strong>完成提示：</strong>${escapeHtml(
                  job.completionSummary
                )}</div>`
              : ""
          }
          ${errorHtml}
          <div class="modal-actions" style="margin-top:10px;">
            ${
              canCancel
                ? `<button class="secondary-btn" type="button" data-cancel-job-id="${escapeHtml(
                    job.id
                  )}">取消任务</button>`
                : ""
            }
            ${
              canRetryFailed
                ? `<button class="secondary-btn" type="button" data-retry-job-id="${escapeHtml(
                    job.id
                  )}">重跑失败章节</button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");

  box.querySelectorAll("[data-cancel-job-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.getAttribute("data-cancel-job-id");
      if (!jobId) return;
      await cancelJob(jobId);
    });
  });

  box.querySelectorAll("[data-retry-job-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.getAttribute("data-retry-job-id");
      if (!jobId) return;
      await retryFailedJob(jobId);
    });
  });
}

async function cancelJob(jobId) {
  const res = await fetch(
    `/api/admin/job/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
    }
  );

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "取消任务失败");
    return;
  }

  await refreshJobsList(true);
}

function scopeCoversCurrentChapter(job) {
  if (job.scope === "bible") return true;

  const currentBook = getCurrentBookMeta();
  const isCurrentOld = currentBook?.testamentName === "旧约";
  const isCurrentNew = currentBook?.testamentName === "新约";

  if (job.scope === "old_testament") return isCurrentOld;
  if (job.scope === "new_testament") return isCurrentNew;
  if (job.scope === "book") return job.bookId === state.frontState.bookId;
  if (job.scope === "chapter") {
    return (
      job.bookId === state.frontState.bookId &&
      Number(job.chapter) === Number(state.frontState.chapter)
    );
  }

  return false;
}

async function maybeRefreshFrontAfterJobs(jobs) {
  const relevantJobs = jobs.filter((job) => {
    if (job.status !== "completed") return false;
    if (!String(job.progressText || "").includes("自动合并发布")) return false;

    const sameVersion = job.version === state.frontState.contentVersion;
    const sameLang = job.lang === state.frontState.contentLang;
    const coversCurrent = scopeCoversCurrentChapter(job);

    return sameVersion && sameLang && coversCurrent;
  });

  if (!relevantJobs.length) return;

  await loadStudyContent();
  renderStudyContent();
}

/* =========================
   已发布内容管理
   ========================= */
async function initPublishedManagerTab() {
  const versionSelect = document.getElementById("publishedVersionSelect");
  const langSelect = document.getElementById("publishedLangSelect");
  const loadBtn = document.getElementById("loadPublishedOverviewBtn");
  const loadChapterBtn = document.getElementById("loadPublishedChapterBtn");
  const deleteChapterBtn = document.getElementById("deletePublishedChapterBtn");

  if (!versionSelect || !langSelect) return;

  versionSelect.innerHTML = (adminState.bootstrap?.contentVersions || [])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  langSelect.innerHTML = (adminState.bootstrap?.languages || [])
    .filter((item) => item.enabled)
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(
          item.label
        )}</option>`
    )
    .join("");

  versionSelect.value = "default";
  langSelect.value = "zh";

  loadBtn?.addEventListener("click", async () => {
    await loadPublishedOverview();
  });

  loadChapterBtn?.addEventListener("click", async () => {
    await loadPublishedChapterDetail();
  });

  deleteChapterBtn?.addEventListener("click", async () => {
    await deletePublishedChapterAction();
  });
}

async function loadPublishedOverview() {
  const version = document.getElementById("publishedVersionSelect")?.value;
  const lang = document.getElementById("publishedLangSelect")?.value;
  const summaryBox = document.getElementById("publishedSummaryBox");
  const booksBox = document.getElementById("publishedBooksBox");

  if (summaryBox) summaryBox.textContent = "正在读取...";
  if (booksBox)
    booksBox.innerHTML = `<div class="empty-state">正在读取...</div>`;

  const params = new URLSearchParams({
    version,
    lang,
  });

  const res = await fetch(
    `/api/admin/published/overview?${params.toString()}`,
    {
      cache: "no-store",
    }
  );
  const data = await res.json();

  if (!res.ok) {
    if (summaryBox)
      summaryBox.textContent = `读取失败：${data.error || "未知错误"}`;
    if (booksBox)
      booksBox.innerHTML = `<div class="empty-state">读取失败。</div>`;
    return;
  }

  adminState.publishedOverview = data;
  renderPublishedOverview(data);
}

function renderPublishedOverview(data) {
  const summaryBox = document.getElementById("publishedSummaryBox");
  const booksBox = document.getElementById("publishedBooksBox");

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div><strong>总卷数：</strong>${escapeHtml(
        String(data.summary?.totalBooks || 0)
      )}</div>
      <div><strong>已有发布内容的卷数：</strong>${escapeHtml(
        String(data.summary?.booksWithAnyPublished || 0)
      )}</div>
      <div><strong>已发布章节总数：</strong>${escapeHtml(
        String(data.summary?.totalPublishedChapters || 0)
      )}</div>
      <div><strong>缺失章节总数：</strong>${escapeHtml(
        String(data.summary?.totalMissingChapters || 0)
      )}</div>
    `;
  }

  if (booksBox) {
    booksBox.innerHTML = (data.books || [])
      .map((book) => {
        return `
          <div class="test-result-seg">
            <h4>${escapeHtml(book.bookCn || book.bookId)} (${escapeHtml(
          book.bookId
        )})</h4>
            <div class="test-result-line"><strong>总章数：</strong>${escapeHtml(
              String(book.totalChapters || 0)
            )}</div>
            <div class="test-result-line"><strong>已发布章数：</strong>${escapeHtml(
              String(book.publishedCount || 0)
            )}</div>

            <div class="test-result-line" style="margin-top:10px;"><strong>已发布章节：</strong></div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
              ${
                (book.publishedChapters || []).length
                  ? book.publishedChapters
                      .map(
                        (chapter) => `
                          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; border:1px solid rgba(214,203,187,.72); border-radius:999px; padding:6px 10px;">
                            <span>${escapeHtml(String(chapter))}</span>
                            <button class="secondary-btn small-btn" type="button"
                              data-published-view-book="${escapeHtml(
                                book.bookId
                              )}"
                              data-published-view-chapter="${escapeHtml(
                                String(chapter)
                              )}">
                              查看
                            </button>
                            <button class="secondary-btn small-btn" type="button"
                              data-published-delete-book="${escapeHtml(
                                book.bookId
                              )}"
                              data-published-delete-chapter="${escapeHtml(
                                String(chapter)
                              )}">
                              删除
                            </button>
                          </div>
                        `
                      )
                      .join("")
                  : `<span>—</span>`
              }
            </div>

            <div class="test-result-line" style="margin-top:14px;"><strong>缺失章节：</strong></div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
              ${
                (book.missingChapters || []).length
                  ? book.missingChapters
                      .map(
                        (chapter) => `
                          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; border:1px dashed rgba(214,203,187,.72); border-radius:999px; padding:6px 10px;">
                            <span>${escapeHtml(String(chapter))}</span>
                            <button class="secondary-btn small-btn" type="button"
                              data-published-auto-book="${escapeHtml(
                                book.bookId
                              )}"
                              data-published-auto-chapter="${escapeHtml(
                                String(chapter)
                              )}">
                              自动补发
                            </button>
                          </div>
                        `
                      )
                      .join("")
                  : `<span>—</span>`
              }
            </div>
          </div>
        `;
      })
      .join("");

    bindPublishedOverviewButtons();
  }
}

function bindPublishedOverviewButtons() {
  document.querySelectorAll("[data-published-view-book]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bookId = btn.getAttribute("data-published-view-book");
      const chapter = btn.getAttribute("data-published-view-chapter");
      fillPublishedDetailInputs(bookId, chapter);
      await loadPublishedChapterDetail();
    });
  });

  document.querySelectorAll("[data-published-delete-book]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bookId = btn.getAttribute("data-published-delete-book");
      const chapter = btn.getAttribute("data-published-delete-chapter");
      fillPublishedDetailInputs(bookId, chapter);
      await deletePublishedChapterAction();
    });
  });

  document.querySelectorAll("[data-published-auto-book]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bookId = btn.getAttribute("data-published-auto-book");
      const chapter = btn.getAttribute("data-published-auto-chapter");
      await autoRepublishMissingChapter(bookId, chapter);
    });
  });
}

function fillPublishedDetailInputs(bookId, chapter) {
  const bookInput = document.getElementById("publishedDetailBookInput");
  const chapterInput = document.getElementById("publishedDetailChapterInput");
  if (bookInput) bookInput.value = bookId || "";
  if (chapterInput) chapterInput.value = chapter || "";
}

async function loadPublishedChapterDetail() {
  const version = document.getElementById("publishedVersionSelect")?.value;
  const lang = document.getElementById("publishedLangSelect")?.value;
  const bookId = document
    .getElementById("publishedDetailBookInput")
    ?.value.trim();
  const chapter = document
    .getElementById("publishedDetailChapterInput")
    ?.value.trim();
  const detailBox = document.getElementById("publishedDetailBox");

  if (!bookId || !chapter) {
    if (detailBox) detailBox.textContent = "请先输入书卷和章节。";
    return;
  }

  if (detailBox) detailBox.textContent = "正在读取章节详情...";

  const params = new URLSearchParams({
    version,
    lang,
    bookId,
    chapter,
  });

  const res = await fetch(`/api/admin/published/chapter?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await res.json();

  if (!res.ok) {
    if (detailBox)
      detailBox.textContent = `读取失败：${data.error || "未知错误"}`;
    return;
  }

  if (detailBox) {
    detailBox.textContent = JSON.stringify(data, null, 2);
  }
}

async function deletePublishedChapterAction() {
  const version = document.getElementById("publishedVersionSelect")?.value;
  const lang = document.getElementById("publishedLangSelect")?.value;
  const bookId = document
    .getElementById("publishedDetailBookInput")
    ?.value.trim();
  const chapter = document
    .getElementById("publishedDetailChapterInput")
    ?.value.trim();
  const detailBox = document.getElementById("publishedDetailBox");

  if (!bookId || !chapter) {
    if (detailBox) detailBox.textContent = "请先输入书卷和章节。";
    return;
  }

  if (!confirm(`确认删除已发布内容：${bookId} ${chapter}章？`)) return;

  if (detailBox) detailBox.textContent = "正在删除...";

  const params = new URLSearchParams({
    version,
    lang,
    bookId,
    chapter,
  });

  const res = await fetch(`/api/admin/published/chapter?${params.toString()}`, {
    method: "DELETE",
  });
  const data = await res.json();

  if (!res.ok) {
    if (detailBox)
      detailBox.textContent = `删除失败：${data.error || "未知错误"}`;
    return;
  }

  if (detailBox) {
    detailBox.textContent = `删除成功：${bookId} ${chapter}章`;
  }

  await loadPublishedOverview();
}

async function autoRepublishMissingChapter(bookId, chapter) {
  const version = document.getElementById("publishedVersionSelect")?.value;
  const lang = document.getElementById("publishedLangSelect")?.value;
  const detailBox = document.getElementById("publishedDetailBox");

  if (detailBox) {
    detailBox.textContent = `正在自动补发：${bookId} ${chapter}章...`;
  }

  const res = await fetch("/api/admin/published/auto-republish-chapter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version,
      lang,
      bookId,
      chapter: Number(chapter),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (detailBox) {
      detailBox.textContent = `自动补发失败：${data.error || "未知错误"}`;
    }
    return;
  }

  fillPublishedDetailInputs(bookId, chapter);

  if (detailBox) {
    detailBox.textContent = JSON.stringify(data, null, 2);
  }

  await loadPublishedOverview();

  const sameVersion = state.frontState.contentVersion === version;
  const sameLang = state.frontState.contentLang === lang;
  const sameBook = state.frontState.bookId === bookId;
  const sameChapter = Number(state.frontState.chapter) === Number(chapter);

  if (sameVersion && sameLang && sameBook && sameChapter) {
    await loadStudyContent();
    renderStudyContent();
  }
}

/* =========================
   圣经版本管理
   ========================= */
async function initScriptureVersionManagerTab() {
  await refreshScriptureVersionsList();

  document
    .getElementById("refreshScriptureVersionsBtn")
    ?.addEventListener("click", async () => {
      await refreshScriptureVersionsList();
    });

  document
    .getElementById("newScriptureVersionBtn")
    ?.addEventListener("click", () => {
      clearScriptureVersionEditor();
    });

  document
    .getElementById("saveScriptureVersionBtn")
    ?.addEventListener("click", async () => {
      await saveScriptureVersionFromEditor();
    });

  document
    .getElementById("deleteScriptureVersionBtn")
    ?.addEventListener("click", async () => {
      await deleteCurrentScriptureVersion();
    });
}

async function refreshScriptureVersionsList() {
  const res = await fetch("/api/admin/scripture-versions", {
    cache: "no-store",
  });
  const data = await res.json();

  if (!res.ok) {
    const listBox = document.getElementById("scriptureVersionsListBox");
    if (listBox) {
      listBox.innerHTML = `<div class="empty-state">读取失败：${escapeHtml(
        data.error || "未知错误"
      )}</div>`;
    }
    return;
  }

  adminState.scriptureVersions = data.scriptureVersions || [];
  renderScriptureVersionsList();
}

function renderScriptureVersionsList() {
  const box = document.getElementById("scriptureVersionsListBox");
  if (!box) return;

  if (!adminState.scriptureVersions.length) {
    box.innerHTML = `<div class="empty-state">暂无圣经版本。</div>`;
    return;
  }

  box.innerHTML = adminState.scriptureVersions
    .slice()
    .sort((a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999))
    .map((item) => {
      return `
        <div class="test-result-seg">
          <h4>${escapeHtml(item.label || item.id)} (${escapeHtml(item.id)})</h4>
          <div class="test-result-line"><strong>语言：</strong>${escapeHtml(
            item.lang || "—"
          )}</div>
          <div class="test-result-line"><strong>sourceType：</strong>${escapeHtml(
            item.sourceType || "—"
          )}</div>
          <div class="test-result-line"><strong>sourceFile：</strong>${escapeHtml(
            item.sourceFile || "—"
          )}</div>
          <div class="test-result-line"><strong>状态：</strong>
            enabled=${escapeHtml(String(item.enabled !== false))}
            ，uiEnabled=${escapeHtml(String(item.uiEnabled !== false))}
            ，scriptureEnabled=${escapeHtml(
              String(item.scriptureEnabled !== false)
            )}
          </div>
          <div class="modal-actions" style="margin-top:10px;">
            <button class="secondary-btn" type="button" data-edit-scripture-version="${escapeHtml(
              item.id
            )}">编辑</button>
          </div>
        </div>
      `;
    })
    .join("");

  box.querySelectorAll("[data-edit-scripture-version]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-scripture-version");
      const item = adminState.scriptureVersions.find((x) => x.id === id);
      if (item) fillScriptureVersionEditor(item);
    });
  });
}

function clearScriptureVersionEditor() {
  adminState.editingScriptureVersionId = "";

  setVal("svId", "");
  setVal("svLabel", "");
  setVal("svLang", "");
  setVal("svSourceType", "usfx");
  setVal("svSourceFile", "");
  setVal("svDescription", "");
  setVal("svSortOrder", "999");
  setVal("svContentMode", "native");

  setChecked("svEnabled", true);
  setChecked("svUiEnabled", true);
  setChecked("svContentEnabled", true);
  setChecked("svScriptureEnabled", true);

  const resultBox = document.getElementById("scriptureVersionEditorResult");
  if (resultBox) resultBox.textContent = "已切换到新建模式。";
}

function fillScriptureVersionEditor(item) {
  adminState.editingScriptureVersionId = item.id || "";

  setVal("svId", item.id || "");
  setVal("svLabel", item.label || "");
  setVal("svLang", item.lang || "");
  setVal("svSourceType", item.sourceType || "usfx");
  setVal("svSourceFile", item.sourceFile || "");
  setVal("svDescription", item.description || "");
  setVal("svSortOrder", String(item.sortOrder ?? 999));
  setVal("svContentMode", item.contentMode || "native");

  setChecked("svEnabled", item.enabled !== false);
  setChecked("svUiEnabled", item.uiEnabled !== false);
  setChecked("svContentEnabled", item.contentEnabled !== false);
  setChecked("svScriptureEnabled", item.scriptureEnabled !== false);

  const resultBox = document.getElementById("scriptureVersionEditorResult");
  if (resultBox) resultBox.textContent = `已载入版本：${item.id}`;
}

function collectScriptureVersionFromEditor() {
  return {
    id: getVal("svId"),
    label: getVal("svLabel"),
    lang: getVal("svLang"),
    sourceType: getVal("svSourceType"),
    sourceFile: getVal("svSourceFile"),
    description: getVal("svDescription"),
    sortOrder: Number(getVal("svSortOrder") || 999),
    contentMode: getVal("svContentMode") || "native",
    enabled: getChecked("svEnabled"),
    uiEnabled: getChecked("svUiEnabled"),
    contentEnabled: getChecked("svContentEnabled"),
    scriptureEnabled: getChecked("svScriptureEnabled"),
  };
}

async function saveScriptureVersionFromEditor() {
  const payload = collectScriptureVersionFromEditor();
  const resultBox = document.getElementById("scriptureVersionEditorResult");
  if (resultBox) resultBox.textContent = "正在保存圣经版本...";

  const res = await fetch("/api/admin/scripture-version/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scriptureVersion: payload,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (resultBox)
      resultBox.textContent = `保存失败：${data.error || "未知错误"}`;
    return;
  }

  if (resultBox) {
    resultBox.textContent = `保存成功：${
      data.scriptureVersion?.id || payload.id
    }`;
  }

  await reloadScriptureVersionsEverywhere();
  adminState.editingScriptureVersionId =
    data.scriptureVersion?.id || payload.id;
}

async function deleteCurrentScriptureVersion() {
  const id = getVal("svId");
  const resultBox = document.getElementById("scriptureVersionEditorResult");

  if (!id) {
    if (resultBox) resultBox.textContent = "请先载入一个版本再删除。";
    return;
  }

  if (!confirm(`确认删除圣经版本：${id}？`)) return;

  if (resultBox) resultBox.textContent = "正在删除圣经版本...";

  const params = new URLSearchParams({ id });
  const res = await fetch(`/api/admin/scripture-version?${params.toString()}`, {
    method: "DELETE",
  });

  const data = await res.json();

  if (!res.ok) {
    if (resultBox)
      resultBox.textContent = `删除失败：${data.error || "未知错误"}`;
    return;
  }

  if (resultBox) resultBox.textContent = `删除成功：${id}`;
  clearScriptureVersionEditor();
  await reloadScriptureVersionsEverywhere();
}

async function reloadScriptureVersionsEverywhere() {
  await loadBootstrap();

  if (adminState.bootstrap) {
    const adminRes = await fetch("/api/admin/bootstrap", { cache: "no-store" });
    const adminData = await adminRes.json();
    if (adminRes.ok) {
      adminState.bootstrap = adminData;
      adminState.scriptureVersions = adminData.scriptureVersions || [];
    }
  }

  renderAllSelectors();
  await refreshCurrentPage();
  renderScriptureVersionsList();
}

/* =========================
   小工具
   ========================= */
function getVal(id) {
  return document.getElementById(id)?.value?.trim?.() || "";
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getChecked(id) {
  return !!document.getElementById(id)?.checked;
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

/* =========================
   定时刷新
   ========================= */
function startJobsAutoRefresh() {
  stopJobsAutoRefresh();
  adminState.jobsRefreshTimer = setInterval(() => {
    refreshJobsList().catch((error) => {
      console.error("刷新任务失败:", error);
    });
  }, 3000);
}

function stopJobsAutoRefresh() {
  if (adminState.jobsRefreshTimer) {
    clearInterval(adminState.jobsRefreshTimer);
    adminState.jobsRefreshTimer = null;
  }
}

init();
