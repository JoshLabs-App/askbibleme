/**
 * 音乐是否在出声——**已废弃，改读原生发布的状态**（`usePlaybackStream("music").playing`）。
 *
 * 这个 store 曾是 JS 侧对原生播放器的镜像。原生现在按流上报事实，镜像没有读者了；
 * setter 暂时保留，是为了不一次性改动十几个写入点，它们不再影响任何判断。
 * 改到某个写入点时应直接删掉调用，而不是继续写一个没人读的值。
 */
export function setShellMusicNativePlaying(_next: boolean): void {
  /* 无人读取；见文件头。 */
}
