/**
 * 重新生成 data/youversion-language-names.json。
 * 只在 YouVersion 上新语言时才需要跑：node tools/gen-language-names.mjs（需 YVP_APP_KEY）
 * /languages 不支持按语言码过滤，只能翻完 60 页再挑出目录里用到的码。
 */
import fs from "node:fs";
import path from "node:path";
const key = (process.env.YVP_APP_KEY || process.env.K || "").trim();
if (!key) { console.error("需要 YVP_APP_KEY"); process.exit(1); }
const BASE = "https://api.youversion.com/v1";
async function get(url){ const r = await fetch(url,{headers:{"X-YVP-App-Key":key,Accept:"application/json"}}); if(!r.ok) throw new Error(r.status+" "+url); return r.json(); }
// 1. 目录里实际用到的语言码
const used = new Set(); let tok="";
for(let p=0;p<100;p++){
  const u = new URL(BASE+"/bibles"); u.searchParams.append("language_ranges[]","*"); if(tok) u.searchParams.set("page_token",tok);
  const b = await get(u);
  for(const it of b.data??[]) used.add(String(it.language_tag??""));
  tok = b.next_page_token || ""; if(!tok) break;
}
console.error("versions langs:", used.size);
// 2. 语言名
const out = {}; tok="";
for(let p=0;p<120;p++){
  const u = new URL(BASE+"/languages"); u.searchParams.set("page_size","99"); if(tok) u.searchParams.set("page_token",tok);
  const b = await get(u);
  for(const it of b.data??[]){
    const codes = [String(it.id??""), String(it.language??""), ...(it.aliases??[]).map(String)].filter(Boolean);
    const dn = it.display_names ?? {};
    const local = dn[it.language] ?? it.name ?? "";
    const zh = dn["zh"] ?? dn["zh-Hans"] ?? dn["en"] ?? local;
    const en = dn["en"] ?? local ?? zh;
    for(const c of codes){ if(used.has(c) && !out[c]) out[c] = {zh:String(zh||c), en:String(en||c)}; }
  }
  tok = b.next_page_token || ""; if(!tok) break;
  process.stderr.write(".");
}
console.error("\nnamed:", Object.keys(out).length);
const missing=[...used].filter(c=>!out[c]); console.error("missing:", missing.length, missing.slice(0,20).join(","));
const target = path.join(process.cwd(), "data", "youversion-language-names.json");
const prev = JSON.parse(fs.readFileSync(target, "utf8"));
const merged = { ...prev.names, ...out };
const speakers = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "language-speakers.json"), "utf8")).languages;
for (const [code, v] of Object.entries(speakers)) if (merged[code]) merged[code] = { zh: v.zh, en: v.en };
const names = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(target, JSON.stringify({ _note: prev._note, names }, null, 1) + "\n");
console.error("written", Object.keys(names).length, "codes ->", target);
