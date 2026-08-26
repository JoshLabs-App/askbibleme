"use client";

import type { CSSProperties } from "react";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  musicAlbumIconIsCommunity,
  musicAlbumIconName,
} from "@/lib/music/music-album-catalog-ui";

type Props = {
  album: string;
  size: number;
  color: string;
  className?: string;
  style?: CSSProperties;
};

export function MusicAlbumGlyph({ album, size, color, className, style }: Props) {
  const name = musicAlbumIconName(album);
  if (musicAlbumIconIsCommunity(album)) {
    return (
      <ShellMaterialCommunityIcon
        name={name}
        size={size}
        color={color}
        className={className}
        style={style}
      />
    );
  }
  return (
    <ShellMaterialIcon name={name} size={size} color={color} className={className} style={style} />
  );
}
