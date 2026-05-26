"use client";

import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";

type Props = {
  iconSrc: string;
  canvasHex: string;
};

/**
 * 后台预览：放大图标条 + 两个手机主屏幕模拟。
 */
export function AdminMobileAppIconPreview({ iconSrc, canvasHex }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium text-adminFg">手机安装预览</p>
        <p className="mt-1 text-[10px] leading-relaxed text-adminMuted">
          上方为放大图标；下方为 Android / iPhone 主屏幕模拟。重新打包安装 App 后真机与此一致。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-8 rounded-md border border-adminLine/60 bg-adminPanel/30 px-4 py-3">
        <LargeIconChip label="Android · 自适应" maskClassName="rounded-full" iconSrc={iconSrc} />
        <LargeIconChip label="iPhone · 主屏幕" maskClassName="rounded-[22%]" iconSrc={iconSrc} />
      </div>

      <div className="flex flex-wrap items-end justify-center gap-10 rounded-lg border border-adminLine/80 bg-adminBg/60 px-5 py-5 sm:gap-14">
        <PhoneHomeMock platform="android" iconSrc={iconSrc} maskClassName="rounded-full" />
        <PhoneHomeMock platform="ios" iconSrc={iconSrc} maskClassName="rounded-[22%]" />
      </div>

      <p className="text-[10px] text-adminMuted">
        应用名称：<span className="font-medium text-adminFg">{ASKBIBLE_PRODUCT_NAME}</span>
      </p>
    </div>
  );
}

function LargeIconChip({
  iconSrc,
  maskClassName,
  label,
}: {
  iconSrc: string;
  maskClassName: string;
  label: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <IconGraphic
        iconSrc={iconSrc}
        sizeClassName="h-16 w-16 shadow-md ring-1 ring-adminLine/80"
        maskClassName={maskClassName}
      />
      <figcaption className="text-[10px] text-adminMuted">{label}</figcaption>
    </figure>
  );
}

function PhoneHomeMock({
  platform,
  iconSrc,
  maskClassName,
}: {
  platform: "android" | "ios";
  iconSrc: string;
  maskClassName: string;
}) {
  const isAndroid = platform === "android";
  const label = isAndroid ? "Android" : "iPhone";
  const hint = isAndroid ? "自适应图标" : "主屏幕";
  const placeholderShape = isAndroid ? "rounded-full" : "rounded-[22%]";

  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        className="relative w-[8.5rem] rounded-[1.4rem] border-[2.5px] border-adminFg/14 bg-adminFg/[0.04] p-[5px] shadow-[0_10px_28px_rgba(0,0,0,0.1)]"
        aria-hidden
      >
        {isAndroid ? (
          <div className="absolute left-1/2 top-[7px] z-10 h-[3px] w-8 -translate-x-1/2 rounded-full bg-adminFg/20" />
        ) : (
          <div className="absolute left-1/2 top-[6px] z-10 h-[10px] w-[2.25rem] -translate-x-1/2 rounded-full bg-adminFg/16" />
        )}

        <div className="relative aspect-[9/17] w-full overflow-hidden rounded-[1.05rem] bg-gradient-to-b from-[#b8c9de] via-[#a8bdd6] to-[#8fa6c4]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(255,255,255,0.4),transparent_55%)]" />

          <div className="relative flex items-end justify-between px-3 pb-0.5 pt-1.5 text-[7px] font-semibold text-white/90">
            <span>9:41</span>
            <span aria-hidden>▮▮</span>
          </div>

          <div className="relative px-2.5 pb-14 pt-2">
            <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">
              <PlaceholderIcon className={placeholderShape} />
              <PlaceholderIcon className={placeholderShape} />
              <PlaceholderIcon className={placeholderShape} />
              <div className="flex justify-center">
                <IconGraphic
                  iconSrc={iconSrc}
                  sizeClassName="h-9 w-9 shadow ring-1 ring-white/80"
                  maskClassName={maskClassName}
                  highlight
                />
              </div>
              <PlaceholderIcon className={placeholderShape} />
              <PlaceholderIcon className={placeholderShape} />
              <PlaceholderIcon className={placeholderShape} />
              <PlaceholderIcon className={placeholderShape} />
            </div>
            <p className="pointer-events-none absolute left-[66%] top-[2.65rem] w-[2.1rem] -translate-x-1/2 truncate text-center text-[6.5px] font-medium leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
              {ASKBIBLE_PRODUCT_NAME}
            </p>
          </div>

          <div className="absolute inset-x-2.5 bottom-2.5 rounded-2xl border border-white/20 bg-white/30 px-2 py-1.5 backdrop-blur-[1px]">
            <div className="grid grid-cols-4 gap-2">
              <PlaceholderIcon className={`${placeholderShape} !h-[0.9rem] !w-[0.9rem]`} />
              <PlaceholderIcon className={`${placeholderShape} !h-[0.9rem] !w-[0.9rem]`} />
              <PlaceholderIcon className={`${placeholderShape} !h-[0.9rem] !w-[0.9rem]`} />
              <PlaceholderIcon className={`${placeholderShape} !h-[0.9rem] !w-[0.9rem]`} />
            </div>
          </div>
        </div>
      </div>

      <figcaption className="text-center">
        <p className="text-[11px] font-medium text-adminFg">{label}</p>
        <p className="text-[9px] text-adminMuted">{hint}</p>
      </figcaption>
    </figure>
  );
}

function IconGraphic({
  iconSrc,
  sizeClassName,
  maskClassName,
  highlight,
}: {
  iconSrc: string;
  sizeClassName: string;
  maskClassName: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`shrink-0 overflow-hidden bg-cover bg-center bg-no-repeat ${sizeClassName} ${maskClassName} ${
        highlight ? "ring-2 ring-white/90" : ""
      }`}
      style={{
        backgroundImage: `url(${JSON.stringify(iconSrc)})`,
      }}
      role="img"
      aria-label={ASKBIBLE_PRODUCT_NAME}
    />
  );
}

function PlaceholderIcon({ className }: { className: string }) {
  return <div className={`h-9 w-9 shrink-0 bg-white/35 shadow-sm ${className}`} aria-hidden />;
}
