type Props = {
  line1: string;
  line2: string;
  pending?: boolean;
  pendingText?: string;
};

export function OAuthButtonLabel({ line1, line2, pending, pendingText }: Props) {
  if (pending && pendingText) {
    return <span>{pendingText}</span>;
  }

  return (
    <span className="flex flex-col items-center gap-0 leading-[1.15]">
      <span className="text-[13px]">{line1}</span>
      <span className="text-[13px]">{line2}</span>
    </span>
  );
}
