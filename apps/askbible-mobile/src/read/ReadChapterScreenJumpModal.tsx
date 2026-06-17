import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ImageBackground, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { bookNameForId } from "./canonCatalog";
import type { ScriptureCanonCatalogSection } from "./canonCatalog";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import { BibleChapterPickerPanel } from "./BibleChapterPickerPanel";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_PARCHMENT_SCROLL_SOURCE } from "./ReadParchmentSurface";
import { JUMP_CATALOG_VIEWPORT_H } from "./readChapterScreenConstants";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";

type Props = {
  visible: boolean;
  insets: EdgeInsets;
  jumpPickerBookId: string | null;
  catalogSections: ScriptureCanonCatalogSection[];
  activeBookId: string;
  onClose: () => void;
  onGoReadHome: () => void;
  onPickBook: (book: { bookId: string }) => void;
  onClearPickerBook: () => void;
  onPickChapter: (bookId: string, chapter: number) => void;
  jumpTitle: string;
  backA11yLabel: string;
  closeLabel: string;
};

export function ReadChapterScreenJumpModal({
  visible,
  insets,
  jumpPickerBookId,
  catalogSections,
  activeBookId,
  onClose,
  onGoReadHome,
  onPickBook,
  onClearPickerBook,
  onPickChapter,
  jumpTitle,
  backA11yLabel,
  closeLabel,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.jumpBackdrop} onPress={onClose}>
        <Pressable style={styles.jumpSheet} onPress={(e) => e.stopPropagation()}>
          <ImageBackground
            source={READ_PARCHMENT_SCROLL_SOURCE}
            resizeMode="stretch"
            style={styles.jumpSheetImageBg}
            imageStyle={styles.jumpSheetBgImage}
          >
            <View style={[styles.jumpSheetContent, { paddingBottom: 16 + insets.bottom }]}>
              <View style={styles.jumpHeaderRow}>
                <Pressable
                  onPress={onGoReadHome}
                  style={({ pressed }) => [styles.jumpBackBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={backA11yLabel}
                >
                  <MaterialIcons name="arrow-back-ios-new" size={16} color={c.ink} />
                </Pressable>
                <Text
                  style={styles.jumpTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {jumpPickerBookId ? bookNameForId(jumpPickerBookId) : jumpTitle}
                </Text>
                <View style={styles.jumpHeaderSpacer} />
              </View>
              <View style={styles.jumpCatalogScrollWrap}>
                {jumpPickerBookId ? (
                  <BibleChapterPickerPanel
                    bookId={jumpPickerBookId}
                    viewportHeight={JUMP_CATALOG_VIEWPORT_H}
                    embedded
                    lockTextScale
                    onBack={onClearPickerBook}
                    onPickChapter={(chapter) => onPickChapter(jumpPickerBookId, chapter)}
                  />
                ) : (
                  <ScrollView
                    style={styles.jumpCatalogScroll}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                  >
                    <BibleCatalogOutline
                      sections={catalogSections}
                      activeBookId={activeBookId}
                      onPickChapter={onPickChapter}
                      onBookPress={onPickBook}
                      splitByTestamentColumns
                      bookMetaMode="none"
                      compactMode
                      showSectionTint={false}
                      sectionGapPx={8}
                      sectionStripeFullHeight
                      lockTextScale
                    />
                  </ScrollView>
                )}
              </View>
              <Pressable onPress={onClose} style={styles.jumpClose}>
                <Text style={styles.jumpCloseText}>{closeLabel}</Text>
              </Pressable>
            </View>
          </ImageBackground>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
