import me.askbible.native_.data.*;
class PanoramaGuideCheck {
 public static void main(String[] args) {
  int links=0;
  for(var e: PanoramaReadingGuide.INSTANCE.getNotes().entrySet()) {
   var n=e.getValue();
   if(n.getZh().isBlank() || n.getEn().isBlank()) throw new AssertionError(e.getKey());
   for(var l:n.getLinks()) {
    var b=BibleCatalog.INSTANCE.book(l.getBookId());
    if(b==null || l.getChapter()<1 || l.getChapter()>b.getChapterCount() || l.getReasonZh().isBlank() || l.getReasonEn().isBlank()) throw new AssertionError(l);
    links++;
   }
  }
  System.out.println("PASS: all bilingual notes and "+links+" chapter destinations valid");
 }
}
