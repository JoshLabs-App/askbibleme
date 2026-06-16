import { AuthParchmentChrome } from "@/components/shell/AuthParchmentChrome";

export function AuthParchmentFallback() {
  return (
    <AuthParchmentChrome>
      <div className="narrow-parchment-root flex w-full justify-center py-8">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[rgba(43,29,21,0.12)] dark:bg-stone-50/12" aria-hidden />
      </div>
    </AuthParchmentChrome>
  );
}
