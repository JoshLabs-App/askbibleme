/**
 * 底栏主导航：与 `HomeBottomNav` 四项对应。
 * 图标始终同一套描边，颜色随父级 `currentColor`（与标签一致），贴近 iOS Tab Bar 的模板着色。
 */
export type NavTabIconProps = {
  className?: string;
};

export function IconNavHome({ className }: NavTabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 10.25 12 3.75l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconNavJourney({ className }: NavTabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 17.5c3-4 6.5-7.5 11.5-9.5S21 9 19 11.5c-1.6 2-4 2.2-6 .5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17.5h3M16 13l3 4.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconNavRead({ className }: NavTabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 4.75h5a2 2 0 0 1 2 2v14.5H6a1.25 1.25 0 0 1-1.25-1.25V6A1.25 1.25 0 0 1 6 4.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M18 4.75h-5a2 2 0 0 0-2 2v14.5h5A1.25 1.25 0 0 0 19.25 20V6A1.25 1.25 0 0 0 18 4.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M12 6.75v11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function IconNavExplore({ className }: NavTabIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M12 6.25 15.5 12 12 17.75 8.5 12Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
