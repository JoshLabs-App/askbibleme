import me.askbible.native_.data.*;
class PanoramaCheck {
 public static void main(String[] args) {
  var map=BiblePanorama.INSTANCE;
  if(map.getActs().size()!=6) throw new AssertionError("six acts");
  int chapters=0;
  for(var b: BibleCatalog.INSTANCE.getAll()) {
   var intro=BibleBookIntroductions.INSTANCE.get(b.getId());
   if(intro.getZh().isBlank() || intro.getEn().isBlank() || intro.getReferences().isBlank()) throw new AssertionError(b.getId());
  }
  for(var b: BibleCatalog.INSTANCE.getAll()) for(int c=1;c<=b.getChapterCount();c++) {
   if(map.location(b.getId(),c)==null) throw new AssertionError(b.getId()+" "+c);
   chapters++;
  }
  for(var a:map.getActs()) for(var s:a.getSections()) for(var r:s.getSpans()) {
   var b=BibleCatalog.INSTANCE.book(r.getBookId());
   if(b==null || r.getFirst()<1 || r.getLast()>b.getChapterCount() || r.getFirst()>r.getLast()) throw new AssertionError(s.getId());
  }
  if(!map.location("GEN",2).getFirst().equals(0) || !map.location("GEN",3).getFirst().equals(1) || !map.location("GEN",12).getFirst().equals(2)) throw new AssertionError("Genesis boundaries");
  if(!map.location("RUT",1).getSecond().getId().equals("judges")) throw new AssertionError("Ruth");
  if(!map.location("REV",20).getFirst().equals(4) || !map.location("REV",21).getFirst().equals(5)) throw new AssertionError("Revelation contexts");
  System.out.println("PASS: 6 acts, 66 books, "+chapters+" chapters, valid spans and narrative boundaries");
 }
}
