export function stepFilteredTrackIndex(
  filteredTrackIndices: number[],
  currentFilteredIndex: number,
  direction: "prev" | "next",
): number | null {
  if (filteredTrackIndices.length <= 1 || currentFilteredIndex < 0) {
    return null;
  }
  if (direction === "prev") {
    return currentFilteredIndex <= 0
      ? filteredTrackIndices.length - 1
      : currentFilteredIndex - 1;
  }
  return (currentFilteredIndex + 1) % filteredTrackIndices.length;
}
