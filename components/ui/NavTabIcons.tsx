/**
 * 底栏主导航：与 `HomeBottomNav` 四项对应。
 * - 未选中：`currentColor` 细线描边（与底栏 muted 文字联动）。
 * - 选中：内置金铜渐变（`active`），略加粗描边 / 点缀，贴近「安静高级」而非玩具感。
 */
import { useId } from "react";

export type NavTabIconProps = {
  className?: string;
  /** 当前路由选中：启用金属渐变与 Journey 路径点缀 */
  active?: boolean;
};

function NavGoldGradient({ gradId }: { gradId: string }) {
  return (
    <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stopColor="#f3e8c4" />
      <stop offset="42%" stopColor="#d4af37" />
      <stop offset="100%" stopColor="#8a6d2e" />
    </linearGradient>
  );
}

export function IconNavHome({ className, active }: NavTabIconProps) {
  const gid = useId().replace(/:/g, "");
  const g = `navHomeGold${gid}`;
  const stroke = active ? `url(#${g})` : "currentColor";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {active ? (
        <defs>
          <NavGoldGradient gradId={g} />
        </defs>
      ) : null}
      <path
        d="M4 10.25 12 3.75l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.75Z"
        stroke={stroke}
        strokeWidth={active ? 1.65 : 1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Journey：蜿蜒路径 + 端点小菱形（选中态更接近参考图） */
export function IconNavJourney({ className, active }: NavTabIconProps) {
  const gid = useId().replace(/:/g, "");
  const g = `navJourneyGold${gid}`;
  const stroke = active ? `url(#${g})` : "currentColor";
  const fill = active ? `url(#${g})` : "none";

  if (!active) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M5 17.5c3-4 6.5-7.5 11.5-9.5S21 9 19 11.5c-1.6 2-4 2.2-6 .5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 17.5h3M16 13l3 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <NavGoldGradient gradId={g} />
      </defs>
      {/* 主路径：S 形旅程感 */}
      <path
        d="M4.25 18.25C6.5 16.25 8 14.25 9.75 12.5c1.85-1.85 3.35-3.1 5.6-4.35C17.6 6.9 19.35 6 20.75 5.15"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 起点 / 拐点 / 终点菱形 */}
      <path d="M4.25 16.35 6.15 18.25 4.25 20.15 2.35 18.25Z" fill={fill} opacity={0.95} />
      <path d="M9.35 10.85 11.25 12.75 9.35 14.65 7.45 12.75Z" fill={fill} opacity={0.88} />
      <path d="M20.75 3.25 22.65 5.15 20.75 7.05 18.85 5.15Z" fill={fill} opacity={0.95} />
    </svg>
  );
}

export function IconNavRead({ className, active }: NavTabIconProps) {
  const gid = useId().replace(/:/g, "");
  const g = `navReadGold${gid}`;
  const stroke = active ? `url(#${g})` : "currentColor";

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {active ? (
        <defs>
          <NavGoldGradient gradId={g} />
        </defs>
      ) : null}
      <path
        d="M6 4.75h5a2 2 0 0 1 2 2v14.5H6a1.25 1.25 0 0 1-1.25-1.25V6A1.25 1.25 0 0 1 6 4.75Z"
        stroke={stroke}
        strokeWidth={active ? 1.65 : 1.5}
        strokeLinejoin="round"
      />
      <path
        d="M18 4.75h-5a2 2 0 0 0-2 2v14.5h5A1.25 1.25 0 0 0 19.25 20V6A1.25 1.25 0 0 0 18 4.75Z"
        stroke={stroke}
        strokeWidth={active ? 1.65 : 1.5}
        strokeLinejoin="round"
      />
      <path d="M12 6.75v11" stroke={stroke} strokeWidth={active ? 1.65 : 1.5} strokeLinecap="round" />
    </svg>
  );
}

export function IconNavExplore({ className, active }: NavTabIconProps) {
  const gid = useId().replace(/:/g, "");
  const g = `navExploreGold${gid}`;
  const stroke = active ? `url(#${g})` : "currentColor";

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {active ? (
        <defs>
          <NavGoldGradient gradId={g} />
        </defs>
      ) : null}
      <circle cx="12" cy="12" r="7.25" stroke={stroke} strokeWidth={active ? 1.65 : 1.5} />
      <path
        d="M12 6.25 15.5 12 12 17.75 8.5 12Z"
        stroke={stroke}
        strokeWidth={active ? 1.65 : 1.5}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1" fill={active ? stroke : "currentColor"} />
    </svg>
  );
}
