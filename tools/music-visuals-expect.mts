// TS 侧期望值：RN 里能纯净导入的模块直接调（去掉 import / require 后 tsx 载入）；鱼群 / 星 / 流星的种子与帧按 RN 公式照抄。
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "musicvis-ts-"));
function pureModule(rel: string, header: string): string {
  const stripped = readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
    .replace(/^export const \w+ = require\([^\n]*\n/gm, "");
  const out = path.join(dir, path.basename(rel).replace(/\.ts$/, ".mts"));
  writeFileSync(out, header + "\n" + stripped);
  return out;
}
const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
const constMod = pureModule("apps/askbible-mobile/src/music/musicAlbumVisualConstants.ts", "");
const C: any = unwrap(await import(constMod));
const constHeader = `import * as cc from "${constMod}"; const __c: any = (cc as any).default && typeof (cc as any).default === "object" && Object.keys(cc).length <= 2 ? (cc as any).default : cc;\n` +
  `const { COFFEE_CUP_ICON_SIZE, COFFEE_ORBIT_MIN_RADIUS, COFFEE_ORBIT_VISIBLE_PADDING, coffeeVisualCenterY, COFFEE_BEAN_COUNT, FOLLOW_WHITE_COFFEE_BEAN_INDICES, WHITE_COFFEE_BEAN_INDEX, pseudoRandom01 } = __c;`;
const orbitMod = pureModule("apps/askbible-mobile/src/music/coffeeOrbitLayout.ts", constHeader);
const beanMod = pureModule("apps/askbible-mobile/src/music/coffeeBeanNodeLayout.ts", constHeader);
const catMod = pureModule("apps/askbible-mobile/src/music/musicAlbumCatalog.ts", "");
const O: any = unwrap(await import(orbitMod));
const B: any = unwrap(await import(beanMod));
const K: any = unwrap(await import(catMod));
const pr = (s: number) => C.pseudoRandom01(s);
const n = (v: number) => v.toFixed(4);
const TAU = Math.PI * 2;
// ---- fishSwarmNativeMotion 的种子（照抄） ----
const ORBIT_PERIOD_MS = 168_000, HARMONICS = [1, 2, 3, 4, 5, 6, 7, 8, 9], SHIMMER = 8_400, SWIM = [2600, 3120, 3640, 4160, 4680, 5200];
const nearest = (t: number, c: number[]) => { let b = 0; for (let i = 1; i < c.length; i++) if (Math.abs(c[i] - t) < Math.abs(c[b] - t)) b = i; return b; };
const HP = HARMONICS.map((h) => ORBIT_PERIOD_MS / h);
const fishSeed = (i: number) => {
  const ring = Math.floor(i / 12), slot = i % 12;
  const angleJitter = (pr(i * 19 + 7) - 0.5) * 44;
  const randomSpeed = 0.45 + pr(i * 41 + 9) * 1.7;
  const speedFactor = (0.7 + ring * 0.14) * randomSpeed * 0.58;
  const swimPeriodMs = 2600 + pr(i * 73 + 33) * 2600;
  return {
    baseAngleDeg: slot * 30 + angleJitter + ring * 2.5 + pr(i * 67 + 21) * 360,
    radius: 132 + ring * 13.5 + pr(i * 23 + 11) * 20,
    size: 0.55 + pr(i * 31 + 17) * 0.68,
    opacity: 0.34 + pr(i * 37 + 3) * 0.28,
    orbitHarmonic: HARMONICS[nearest(42_000 / Math.max(speedFactor, 0.0001), HP)],
    shimmerOffset: i / 100,
    swimBucket: nearest(swimPeriodMs, SWIM),
    swimOffset: (i * 0.21) % 1,
    tangentialAmp: 1.6 + pr(i * 79 + 27) * 2.2,
    radialAmp: 1.6 + pr(i * 83 + 31) * 3.2,
    headingAmp: 1.2 + pr(i * 89 + 37) * 2.6,
  };
};
const clock = (t: number, p: number) => (((t / p) % 1) + 1) % 1;
const tri = (u: number, a: number, b: number) => (u <= 0.5 ? a + (b - a) * (u * 2) : b + (a - b) * ((u - 0.5) * 2));
const fishFrame = (i: number, t: number) => {
  const s = fishSeed(i);
  const orbitDeg = 360 * s.orbitHarmonic * clock(t, ORBIT_PERIOD_MS);
  const swimU = (clock(t, SWIM[s.swimBucket]) + s.swimOffset) % 1;
  const shimU = (clock(t, SHIMMER) + s.shimmerOffset) % 1;
  const tx = s.radius + Math.cos(swimU * TAU) * s.radialAmp;
  const ty = Math.sin(swimU * TAU) * s.tangentialAmp + tri(shimU, -2.4, 2.4);
  const heading = 90 + Math.sin(swimU * TAU) * s.headingAmp;
  const a = ((orbitDeg + s.baseAngleDeg) * Math.PI) / 180;
  return [Math.cos(a) * tx - Math.sin(a) * ty, Math.sin(a) * tx + Math.cos(a) * ty, orbitDeg + s.baseAngleDeg + heading, s.size, s.opacity * tri(shimU, 0.88, 1)];
};
const lines = readFileSync(0, "utf8").split("\n"); if (lines[lines.length - 1] === "") lines.pop();
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "prand": out.push(n(pr(Number(f[1])))); break;
    case "scene": {
      const a = f[1];
      const flags = [a === "睡眠" || a === "钢琴" || a === "赞美诗", a !== "安静" && a !== "睡眠" && a !== "专注工作", a === "下午茶", a !== "安静" && a !== "专注工作",
        a === "安静", a === "安静", a === "下午茶", a === "睡眠", a === "专注工作"].map((x) => (x ? "1" : "0")).join("");
      out.push(flags + "|" + K.musicAlbumGlowColors(a).map((c: string) => c.slice(1).toLowerCase()).join(",")); break;
    }
    case "fishseed": { const s = fishSeed(Number(f[1])); out.push([n(s.baseAngleDeg), n(s.radius), n(s.size), n(s.opacity), String(s.orbitHarmonic), n(s.shimmerOffset), String(s.swimBucket), n(s.swimOffset), n(s.tangentialAmp), n(s.radialAmp), n(s.headingAmp)].join(",")); break; }
    case "fishframe": out.push(fishFrame(Number(f[1]), Number(f[2])).map(n).join(",")); break;
    case "orbit": { const l = O.resolveCoffeeOrbitLayout({ width: Number(f[1]), height: Number(f[2]), viewportHeight: Number(f[3]), viewportTop: Number(f[4]), centered: false }); out.push([l.cx, l.cy, l.orbitInnerRadius, l.orbitOuterRadius].map(n).join(",")); break; }
    case "bean": {
      const i = Number(f[1]);
      const l = O.resolveCoffeeOrbitLayout({ width: Number(f[2]), height: Number(f[3]), viewportHeight: Number(f[3]), viewportTop: 0, centered: false });
      const b = B.resolveCoffeeBeanNodeLayout(i, l);
      const isLeader = i === 0, followIndex = [1, 2, 3].indexOf(i), isFollower = followIndex >= 0;
      const baseDuration = isLeader ? 24500 : isFollower ? 27200 : 29400;
      out.push([b.reverseDark ? "L" : b.isFollower ? `F${b.followIndex}` : "-", n(b.direction), n(b.angle), n(b.radius), n(b.beanW), n(b.beanH), n(b.orbitPhaseDeg), n(b.followerBaseDeg), n(b.beanOpacity),
        n(baseDuration + Math.floor(pr(i * 31 + 7) * 9000)), n(120 + Math.floor(pr(i * 53 + 11) * 1200)), n(5200 + Math.floor(pr(i * 43 + 5) * 2800)), n(5200 + Math.floor(pr(i * 47 + 3) * 2800))].join(","));
      break;
    }
    default: out.push("skip");
  }
}
console.log(JSON.stringify(out));
