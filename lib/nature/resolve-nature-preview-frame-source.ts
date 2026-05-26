import path from "node:path";

/** 从 nature 视频配置解析截预览帧用的本地绝对路径（优先 4K 母片） */
export function resolveNaturePreviewFrameSourcePaths(
  cwd: string,
  entry: { src?: string; src1080?: string; src4k?: string },
): string[] {
  const candidates: string[] = [];
  const pushRel = (rel: string | undefined) => {
    const u = typeof rel === "string" ? rel.trim() : "";
    if (!u.startsWith("/nature/uploads/")) return;
    candidates.push(path.join(cwd, "public", u));
  };

  pushRel(entry.src4k);
  pushRel(entry.src1080);
  pushRel(entry.src);

  const seen = new Set<string>();
  return candidates.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}
