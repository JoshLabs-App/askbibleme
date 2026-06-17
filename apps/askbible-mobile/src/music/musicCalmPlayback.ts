export type { CalmLoopProfile } from "./musicCalmLoopProfile";
export {
  shouldUseCalmAlbumFade,
  resolveCalmLoopProfile,
} from "./musicCalmLoopProfile";
export { fadeSoundVolume, restartCalmLoopWithCrossfade } from "./musicCalmFade";
export {
  shouldAdvanceMusicOnEnd,
  pickRandomNextTrackIndex,
  pickRandomNextTrackIndexInAlbum,
} from "./musicCalmTrackAdvance";
