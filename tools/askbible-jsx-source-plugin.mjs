import { relative } from "node:path";
import ts from "typescript";

const HOST_TAGS = new Set([
  "div",
  "section",
  "aside",
  "header",
  "footer",
  "nav",
  "main",
  "dialog",
  "form",
  "button",
  "summary",
  "canvas",
  "svg",
  "fieldset",
  "label",
  "select",
  "input",
  "textarea",
  "article",
  "details",
  "table",
  "ul",
  "ol",
  "li",
  "span",
  "img",
  "a",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "time",
]);

function resolveEnclosingComponentName(node) {
  let cur = node.parent;
  while (cur) {
    if (ts.isFunctionDeclaration(cur) && cur.name && /^[A-Z]/.test(cur.name.text)) {
      return cur.name.text;
    }
    if (
      (ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) &&
      cur.parent &&
      ts.isVariableDeclaration(cur.parent) &&
      ts.isIdentifier(cur.parent.name) &&
      /^[A-Z]/.test(cur.parent.name.text)
    ) {
      return cur.parent.name.text;
    }
    cur = cur.parent;
  }
  return "";
}

/**
 * 纯函数：为单个 TSX 源码注入 `data-ab-src="rel/path.tsx:line"` 与 `data-ab-comp="ComponentName"`。
 * 使用 TypeScript AST 精确定位 JSX 标签名末尾，零行号偏移、RSC/SSR/Client 100% 同构。
 */
export function injectJsxSourceAttributes(code, absFilename, repoRoot) {
  const cleanId = absFilename.replace(/\?.*$/, "").replaceAll("\\", "/");
  if (!cleanId.endsWith(".tsx")) return null;
  if (cleanId.includes("/node_modules/") || /\.(?:test|spec)\.tsx$/.test(cleanId)) return null;

  const rel = relative(repoRoot, cleanId).replaceAll("\\", "/");
  if (!rel || rel.startsWith("..")) return null;
  if (!/^(?:app|components|hooks|lib)\//.test(rel)) return null;

  const sf = ts.createSourceFile(cleanId, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagNameNode = node.tagName;
      if (ts.isIdentifier(tagNameNode) && HOST_TAGS.has(tagNameNode.text)) {
        const hasExisting = node.attributes.properties.some(
          (prop) =>
            ts.isJsxAttribute(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === "data-ab-src",
        );
        if (!hasExisting) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          const oneBasedLine = line + 1;
          const comp = resolveEnclosingComponentName(node);
          const compAttr = comp ? ` data-ab-comp="${comp}"` : "";
          edits.push({
            pos: tagNameNode.getEnd(),
            insert: ` data-ab-src="${rel}:${oneBasedLine}"${compAttr}`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  if (edits.length === 0) return null;

  edits.sort((a, b) => b.pos - a.pos);
  let out = code;
  for (const edit of edits) {
    out = out.slice(0, edit.pos) + edit.insert + out.slice(edit.pos);
  }
  return out;
}

export function askbibleJsxSourcePlugin(repoRoot) {
  return {
    name: "askbible-jsx-source",
    enforce: "pre",
    transform(code, id) {
      if (process.env.VITEST) return null;
      const cleanId = id.replace(/\?.*$/, "");
      if (!cleanId.endsWith(".tsx") || cleanId.includes("node_modules")) return null;
      const next = injectJsxSourceAttributes(code, cleanId, repoRoot);
      if (!next) return null;
      return { code: next, map: null };
    },
  };
}
