import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AskBibleCodeProbeButton,
  buildProbeSnapshotAt,
  isCodeProbeAuthorized,
  resolveCodeProbeTier,
} from "@/components/app-shell/AskBibleCodeProbe";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import {
  formatCompactBottomVersion,
  isPageSafeForSilentReload,
} from "@/lib/pwa/check-app-update";
import {
  DESKTOP_MODEL_MIN_WIDTH,
  PHONE_SHELL_OUTER_HEIGHT,
  PHONE_SHELL_OUTER_WIDTH,
  PHONE_VIEWPORT_HEIGHT,
  PHONE_VIEWPORT_WIDTH,
  computePhoneFrameScale,
} from "@/lib/shell/app-shell-portal-root";
import {
  DARK_THEME_TOKENS,
  LIGHT_THEME_TOKENS,
  PIGMENT_HIGHLIGHT_PALETTE,
  STATUS_PALETTE,
  renderTokensCss,
} from "@/lib/theme-palette";
import { injectJsxSourceAttributes } from "../../tools/askbible-jsx-source-plugin.mjs";

const REPO_ROOT = resolve(__dirname, "../..");

describe("Standard 1: Single System Color Palette & Zero Hardcoded Color Gate", () => {
  it("keeps app/tokens.css 100% synced with lib/theme-palette.ts", () => {
    const expected = renderTokensCss();
    const actual = readFileSync(resolve(REPO_ROOT, "app/tokens.css"), "utf8");
    expect(actual).toBe(expected);
  });

  it("defines paired light and dark semantic tokens plus 4 status & 4 pigment colors", () => {
    expect(Object.keys(DARK_THEME_TOKENS).length).toBeGreaterThanOrEqual(25);
    for (const key of Object.keys(DARK_THEME_TOKENS)) {
      expect(LIGHT_THEME_TOKENS).toHaveProperty(key);
    }
    expect(Object.keys(STATUS_PALETTE)).toEqual(["ok", "warn", "danger", "disabled"]);
    expect(Object.keys(PIGMENT_HIGHLIGHT_PALETTE)).toEqual([
      "lampGold",
      "oliveGreen",
      "slateBlue",
      "garnetRed",
    ]);
  });
});

describe("Standard 2: Bottom Version / Silent Auto-Update / Alt+Shift+C Code Probe", () => {
  it("injects isomorphic data-ab-src and data-ab-comp attributes with exact 1-based line numbers", () => {
    const sampleTsx = [
      "export function SampleReaderCard() {",
      "  return (",
      '    <section className="reader-card">',
      '      <button type="button">定位测试</button>',
      "    </section>",
      "  );",
      "}",
    ].join("\n");

    const transformed = injectJsxSourceAttributes(
      sampleTsx,
      resolve(REPO_ROOT, "components/bible/SampleReaderCard.tsx"),
      REPO_ROOT,
    );

    expect(transformed).toBeTruthy();
    expect(transformed).toContain(
      '<section data-ab-src="components/bible/SampleReaderCard.tsx:3" data-ab-comp="SampleReaderCard" className="reader-card">',
    );
    expect(transformed).toContain(
      '<button data-ab-src="components/bible/SampleReaderCard.tsx:4" data-ab-comp="SampleReaderCard" type="button">',
    );
    expect(transformed!.split("\n").length).toBe(sampleTsx.split("\n").length);
  });

  it("enforces admin vs ordinary visitor probe tiers and NEVER hides the visitor button", () => {
    expect(isCodeProbeAuthorized(true, false)).toBe(true);
    expect(isCodeProbeAuthorized(false, true)).toBe(true);
    expect(isCodeProbeAuthorized(false, false)).toBe(false);
    expect(resolveCodeProbeTier(true, false)).toBe("admin");
    expect(resolveCodeProbeTier(false, false)).toBe("muted");

    const visitorHtml = renderToStaticMarkup(
      createElement(LocaleProvider, {
        initialLocaleGuess: "zh-CN",
        children: createElement(AskBibleCodeProbeButton),
      }),
    );
    expect(visitorHtml).toContain('data-ab-probe-tier="muted"');
    expect(visitorHtml).toContain("管理员专属定位工具");
    expect(visitorHtml).not.toContain("display:none");
  });

  it("extracts component name and file:line chain in buildProbeSnapshotAt", () => {
    const fakeEl = {
      tagName: "BUTTON",
      className: "verse-btn primary",
      innerText: "创世记 1:1",
      textContent: "创世记 1:1",
      parentElement: {
        getAttribute: (k: string) =>
          k === "data-ab-src"
            ? "components/bible/ReadChapterView.tsx:88"
            : k === "data-ab-comp"
              ? "ReadChapterView"
              : null,
        parentElement: null,
      },
      getAttribute: (k: string) => {
        if (k === "data-ab-src") return "components/bible/VerseRow.tsx:42";
        if (k === "data-ab-comp") return "VerseRow";
        if (k === "data-verse") return "1";
        return null;
      },
      closest: (sel: string) => {
        if (sel === "[data-ab-probe-ui]") return null;
        return fakeEl;
      },
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 120, height: 32 }),
    } as unknown as Element;

    const snap = buildProbeSnapshotAt(fakeEl);
    expect(snap).not.toBeNull();
    expect(snap!.componentName).toBe("VerseRow");
    expect(snap!.lines[0]).toBe("components/bible/VerseRow.tsx:42");
    expect(snap!.copyText).toContain("组件=VerseRow");
    expect(snap!.copyText).toContain("components/bible/VerseRow.tsx:42 <- components/bible/ReadChapterView.tsx:88");
  });

  it("formats compact bottom version and blocks silent reload when audio is playing or input is focused", () => {
    expect(formatCompactBottomVersion("development")).toBe("v2.0 · dev");
    expect(formatCompactBottomVersion("1823761c99aa00bb")).toBe("v2.0 · 1823761c");

    const baseDoc = (overrides: {
      probe?: boolean;
      activeTag?: string;
      hasModal?: boolean;
      playingAudio?: boolean;
    }) =>
      ({
        documentElement: { dataset: overrides.probe ? { abCodeProbe: "1" } : {} },
        activeElement: {
          tagName: overrides.activeTag ?? "BODY",
          getAttribute: () => null,
        },
        querySelector: () => (overrides.hasModal ? {} : null),
        querySelectorAll: () =>
          overrides.playingAudio ? [{ paused: false, ended: false }] : [{ paused: true, ended: false }],
      }) as unknown as Document;

    expect(isPageSafeForSilentReload(baseDoc({}))).toBe(true);
    expect(isPageSafeForSilentReload(baseDoc({ playingAudio: true }))).toBe(false);
    expect(isPageSafeForSilentReload(baseDoc({ activeTag: "INPUT" }))).toBe(false);
    expect(isPageSafeForSilentReload(baseDoc({ hasModal: true }))).toBe(false);
    expect(isPageSafeForSilentReload(baseDoc({ probe: true }))).toBe(false);
  });
});

describe("Standard 3: Desktop ⇄ 1:1 Phone Model (390 × 844) Viewport & Scaling", () => {
  it("locks inner phone viewport to 390×844 and desktop breakpoint to >768px", () => {
    expect(PHONE_VIEWPORT_WIDTH).toBe(390);
    expect(PHONE_VIEWPORT_HEIGHT).toBe(844);
    expect(DESKTOP_MODEL_MIN_WIDTH).toBe(769);
    expect(PHONE_SHELL_OUTER_WIDTH).toBe(414);
    expect(PHONE_SHELL_OUTER_HEIGHT).toBe(896);
  });

  it("keeps 1:1 scale on tall monitors and scales proportionally on shorter laptop screens", () => {
    expect(computePhoneFrameScale(1440, 980)).toBe(1);
    const macbook13Scale = computePhoneFrameScale(1280, 720);
    expect(macbook13Scale).toBeGreaterThan(0.75);
    expect(macbook13Scale).toBeLessThan(1);
    expect(computePhoneFrameScale(500, 300)).toBe(0.48);
  });
});
