/**
 * `/studio` 不在 `(app-shell)` 内：用与前台相同的顶缘出血 fixed 壳，避免 Android 顶缝露浅色。
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[1] flex min-h-0 w-full flex-col overflow-hidden bg-canvas transform-gpu">
      {children}
    </div>
  );
}
