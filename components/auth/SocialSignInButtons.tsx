import { AuthMethodDivider } from "@/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export { AuthMethodDivider };

type Props = {
  nextPath?: string;
  className?: string;
};

export function SocialSignInButtons({ nextPath = "/", className }: Props) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <GoogleSignInButton nextPath={nextPath} />
      <AppleSignInButton nextPath={nextPath} />
    </div>
  );
}
