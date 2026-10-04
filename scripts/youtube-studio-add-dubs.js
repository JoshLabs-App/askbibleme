// 在 YouTube Studio 给一支视频加配音音轨（D-5：音乐版里的「中文朗读」「English 朗读」）。
// 用法（Claude 用 Claude in Chrome 的 javascript_tool，在 studio.youtube.com/video/<id>/translations 页面上）：
//   1. 先执行：window.__dubJob = <`python3 scripts/youtube-series-run.py dubs-pending` 输出的一行 JSON>;
//   2. 再执行本文件全文：立即返回，后台跑；
//   3. 轮询 window.__dubStatus（每条配音 "取文件…/上传中/已发布/出错: …"），全部「已发布」后跑 `finish <key>`。
// ★ Chrome 窗口必须在前台可见（document.visibilityState === 'visible'）：后台标签页 Studio 的弹窗不渲染、
//   定时器被压到一分钟一次，会卡在「添加语言」；Trusted Types 也不让建 Worker 绕开。不可见时先请 Josh 把 Chrome 切到前台。
// 配音从本机 ~/bin/serve-local-files.py 取（2026-10-03 起，不再经 R2；旧的 R2 分段地址也照样能取）。
// Chrome 154 起页面读本机要先在 Studio 页点「允许访问本地网络」一次，没点 fetch 会一直挂着。
// 加完 Studio 里该语言显示「正在处理…」，处理完变「已发布」后再跑 finish（finish 会删 R2 暂存和本地配音）。
// ★ 点「发布」后配音才开始真正上传到 YouTube（本机上行约 0.4 MB/s，308 MB 一条约 13 分钟）：上传完之前**不能离开 / 刷新这个页面**，
//   否则上传中断、Studio 永远停在「正在处理…」（ep03-en-dual 2026-09-30 就是这样）。点完可以把焦点还给 Josh，后台标签页照样上传；
//   用 nettop 看 Chrome Helper 的 bytes_out 涨够、速度降到 0 再离开。
(() => {
  const job = window.__dubJob;
  const W = ms => new Promise(r => setTimeout(r, ms));
  const txt = x => x.innerText.replace(/\s+/g, ' ');  // 页面文字里词之间常是换行，统一成空格再比（2026-10-03 卡过）
  const vis = () => [...document.querySelectorAll('tp-yt-paper-dialog, ytcp-dialog, [role=dialog]')].filter(d => d.offsetParent !== null);
  const btnIn = (root, t) => [...root.querySelectorAll('ytcp-button,button')].find(e => e.textContent.trim() === t && e.offsetParent !== null);
  const until = async (fn, ms = 30000) => { for (let t = 0; t < ms; t += 500) { const v = fn(); if (v) return v; await W(500); } throw new Error('等不到页面元素'); };
  const status = window.__dubStatus = {};
  if (!job || !location.pathname.includes(job.video_id)) { status.error = '页面不是这支视频，或没设 __dubJob'; return status; }

  async function addDub(d) {
    status[d.label] = '取文件…';
    const parts = [];
    for (const u of d.parts) parts.push(await (await fetch(u)).blob());
    const file = new File(parts, d.name, { type: 'audio/mp4' });
    status[d.label] = `取回 ${(file.size / 1e6).toFixed(0)} MB，添加语言…`;
    btnIn(document, '添加语言').click();
    const item = await until(() => [...document.querySelectorAll('tp-yt-paper-item')].find(e => e.textContent.trim() === d.label));
    if (item.hasAttribute('disabled')) throw new Error(`「${d.label}」不能选（和视频原始语言相同，或已添加）`);
    item.click();
    const row = await until(() => [...document.querySelectorAll('tr,[role=row]')].find(r => r.offsetParent !== null && r.innerText.replace(/\s+/g, ' ').trim() === '音频 添加'));
    btnIn(row, '添加').click();
    const inp = await until(() => document.getElementById('audio-file-loader'));
    const dt = new DataTransfer(); dt.items.add(file);
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    status[d.label] = '上传中…';
    const ad = await until(() => vis().filter(x => txt(x).includes('添加音轨') && txt(x).includes(d.name)).pop(), 120000);
    const pub = await until(() => { const b = btnIn(ad, '发布'); return b && b.getAttribute('aria-disabled') !== 'true' ? b : null; }, 600000);
    pub.click();
    const ld = await until(() => vis().find(x => txt(x).includes('音频 已发布')), 600000);
    btnIn(ld, '更新').click();
    await W(4000);
    status[d.label] = '已发布';
  }

  (async () => {
    try { for (const d of job.dubs) await addDub(d); status.done = true; }
    catch (e) { status.error = String(e.message || e); }
  })();
  return status;
})();
