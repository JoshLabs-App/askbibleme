import { MusicHomeScreenView } from "./MusicHomeScreenView";
import { useMusicHomeScreenController } from "./useMusicHomeScreenController";

type Props = {
  layout?: "tab" | "stack";
};

export function MusicHomeScreen({ layout = "tab" }: Props) {
  const controller = useMusicHomeScreenController(layout);
  return <MusicHomeScreenView {...controller} />;
}
