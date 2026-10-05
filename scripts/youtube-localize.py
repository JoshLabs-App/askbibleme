#!/usr/bin/env python3
"""YouTube 金句视频（英文版 epNN-en-dual）的标题 / 说明 17 种语言本地化（D-35、D-31）。
标题结构照 D-31：需要开头 | 当地人真会搜的说法 | 时长 · Be Still Series（系列名不翻，是品牌）。
各语言搜索词 2026-10-05 让 ChatGPT 联网查过各语言头部基督教频道的标题（结论记在 D-35 补）；
第 5 集「Be Still and Know」引的是诗 46:10，用该语言字幕所用译本的原句。

用法：
  python3 scripts/youtube-localize.py preview 1 es     # 看第 1 集西语标题 + 说明
  python3 scripts/youtube-localize.py check            # 全部标题 ≤100 字、说明 ≤5000 字节
  python3 scripts/youtube-localize.py apply all [--wait]   # 写进 YouTube（每集一次 videos.update = 50 额度），做过的记在 series-state.json 的 localized
"""
import importlib.util, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
Y = ROOT / "00/youtube"
STATE = Y / "series-state.json"
spec = importlib.util.spec_from_file_location("ms", ROOT / "scripts/youtube-multilang-subs.py")
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

# 每种语言：时长写法、9 集 (开头, 搜索词)、说明栏各句、字幕所用译本名
L = {
    "es": dict(
        hours="{h} Horas", dec=",",
        titles=[("Duerme en la Paz de Dios", "Versículos Bíblicos para Dormir y Piano Suave"),
                ("Suelta la Ansiedad", "Versículos para la Ansiedad y la Paz Mental"),
                ("Descanso para el Alma Cansada", "Palabras de Consuelo de Dios y Piano Suave"),
                ("Renueva tus Fuerzas", "Devocional de la Mañana con Versículos y Piano"),
                ("Estad Quietos, y Conoced", "Versículos para la Paz, el Descanso y la Meditación"),
                ("Descansa con Dios esta Noche", "Versículos para la Noche y Piano Cristiano"),
                ("Concéntrate en la Palabra", "Versículos para Orar, Meditar y Estudiar"),
                ("Calma tu Mente", "Palabra de Dios para Descansar en Paz"),
                ("Duerme en Paz esta Noche", "Salmos y Versículos para Dormir Profundo")],
        bible="Reina-Valera 1909",
        subs="Subtítulos en español: toca CC o ⚙️ → Subtítulos → Español. Texto bíblico: {bible}.",
        audio="Solo piano por defecto; para escuchar la lectura en inglés o chino, cambia la pista de audio en ⚙️ Configuración.",
        body="{count} de los versículos más citados de la Biblia aparecen uno a uno sobre paisajes naturales en 4K, para leer despacio y meditar. Para dormir, orar, el tiempo devocional, trabajar o estudiar. Sin anuncios insertados.",
        listen="🎧 Escucha cualquier versículo en voz alta", chapters="Capítulos",
        tags="#Biblia #VersículosBíblicos #PalabraDeDios #Dormir #Oración"),
    "pt": dict(
        hours="{h} Horas", dec=",",
        titles=[("Durma na Paz de Deus", "Versículos Bíblicos para Dormir e Piano Suave"),
                ("Liberte-se da Ansiedade", "Palavra de Deus contra a Ansiedade"),
                ("Descanso para a Alma Cansada", "Versículos Bíblicos de Conforto e Piano Suave"),
                ("Renove suas Forças", "Devocional da Manhã com Versículos e Piano"),
                ("Ficai Quietos, e Sabei", "Versículos para Paz, Descanso e Meditação"),
                ("Descanse com Deus esta Noite", "Versículos para a Noite e Piano Cristão"),
                ("Foco na Palavra", "Versículos para Oração, Meditação e Estudo Bíblico"),
                ("Acalme sua Mente", "Palavra de Deus para Descansar em Paz"),
                ("Durma em Paz esta Noite", "Salmos e Versículos para Dormir Profundamente")],
        bible="Bíblia Livre",
        subs="Legendas em português: toque em CC ou ⚙️ → Legendas → Português. Texto bíblico: {bible}.",
        audio="Só piano por padrão; para ouvir a leitura em inglês ou chinês, troque a faixa de áudio em ⚙️ Configurações.",
        body="{count} dos versículos mais citados da Bíblia aparecem um a um sobre paisagens naturais em 4K, para ler devagar e meditar. Para dormir, orar, o devocional, trabalhar ou estudar. Sem anúncios inseridos.",
        listen="🎧 Ouça qualquer versículo em voz alta", chapters="Capítulos",
        tags="#Bíblia #VersículosBíblicos #PalavraDeDeus #Dormir #Oração"),
    "fr": dict(
        hours="{h} Heures", dec=",",
        titles=[("S'endormir dans la Paix de Dieu", "Versets Bibliques pour Dormir et Piano Doux"),
                ("Lâcher Prise sur l'Anxiété", "Versets Bibliques contre l'Anxiété et pour la Paix"),
                ("Repos pour l'Âme Fatiguée", "Versets Bibliques de Réconfort et Piano Doux"),
                ("Renouvelle tes Forces", "Méditation Biblique du Matin et Piano"),
                ("Arrêtez, et Sachez", "Versets Bibliques pour la Paix et la Méditation"),
                ("Se Reposer avec Dieu ce Soir", "Versets Bibliques pour la Nuit et Musique Douce"),
                ("Se Concentrer sur la Parole", "Versets Bibliques pour Prier et Méditer"),
                ("Apaise ton Esprit", "Paroles de Réconfort de Dieu pour le Repos"),
                ("Dormir en Paix ce Soir", "Versets Bibliques avant de Dormir et Piano Doux")],
        bible="Louis Segond 1910",
        subs="Sous-titres en français : touchez CC ou ⚙️ → Sous-titres → Français. Texte biblique : {bible}.",
        audio="Piano seul par défaut ; pour entendre la lecture en anglais ou en chinois, changez la piste audio dans ⚙️ Paramètres.",
        body="{count} des versets bibliques les plus cités apparaissent un à un sur des paysages naturels en 4K, pour lire lentement et méditer. Pour dormir, prier, le temps avec Dieu, travailler ou étudier. Sans publicités insérées.",
        listen="🎧 Écoutez n'importe quel verset à voix haute", chapters="Chapitres",
        tags="#Bible #VersetsBibliques #ParoleDeDieu #Dormir #Prière"),
    "de": dict(
        hours="{h} Stunden", dec=",",
        titles=[("In Gottes Frieden einschlafen", "Bibelverse zum Einschlafen & sanfte Klaviermusik"),
                ("Angst loslassen", "Bibelverse gegen Angst und Sorgen"),
                ("Ruhe für die müde Seele", "Bibelverse zum Trost & sanfte Klaviermusik"),
                ("Neue Kraft schöpfen", "Bibelverse für die Stille Zeit am Morgen"),
                ("Seid stille und erkennet", "Bibelverse für Frieden, Ruhe & Besinnung"),
                ("Den Abend mit Gott ausklingen lassen", "Bibelverse für die Nacht & sanfte Klaviermusik"),
                ("Konzentriert mit Gottes Wort", "Bibelverse zum Beten, Meditieren & Lernen"),
                ("Komm zur Ruhe", "Tröstende Bibelverse für Ruhe & Frieden"),
                ("Heute Nacht friedlich einschlafen", "Bibelverse zum Einschlafen & tiefe Ruhe")],
        bible="Lutherbibel 1912",
        subs="Deutsche Untertitel: auf CC oder ⚙️ → Untertitel → Deutsch tippen. Bibeltext: {bible}.",
        audio="Standardmäßig nur Klavier; für die Lesung auf Englisch oder Chinesisch die Audiospur unter ⚙️ Einstellungen wechseln.",
        body="{count} der meistzitierten Bibelverse erscheinen nacheinander über 4K-Naturlandschaften – zum langsamen Lesen und Nachdenken. Zum Einschlafen, Beten, für die Stille Zeit, zum Arbeiten oder Lernen. Keine eingefügte Werbung.",
        listen="🎧 Jeden Vers vorlesen lassen", chapters="Kapitel",
        tags="#Bibel #Bibelverse #GottesWort #Einschlafen #Gebet"),
    "ru": dict(
        hours="{h} часа", dec=",",
        titles=[("Засыпай в Божьем мире", "Библейские стихи для сна и нежное фортепиано"),
                ("Отпусти тревогу", "Библейские стихи против тревоги и для мира"),
                ("Покой для уставшей души", "Библейские стихи для утешения и фортепиано"),
                ("Обнови свои силы", "Утреннее время с Богом и библейские стихи"),
                ("Остановитесь и познайте", "Библейские стихи для мира, покоя и размышления"),
                ("Вечер с Богом", "Библейские стихи на ночь и спокойное фортепиано"),
                ("Сосредоточься на Слове", "Библейские стихи для молитвы и размышления"),
                ("Успокой свой разум", "Слово Божье для утешения и покоя"),
                ("Спокойной ночи с Богом", "Библейские стихи перед сном и глубокий покой")],
        bible="Синодальный перевод",
        subs="Русские субтитры: нажмите CC или ⚙️ → Субтитры → Русский. Текст Библии: {bible}.",
        audio="По умолчанию только фортепиано; чтобы слушать чтение на английском или китайском, смените звуковую дорожку в ⚙️ Настройках.",
        body="{count} самых цитируемых стихов Библии появляются один за другим на фоне природы в 4K — чтобы читать медленно и размышлять. Для сна, молитвы, тихого времени с Богом, работы или учёбы. Без вставленной рекламы.",
        listen="🎧 Любой стих можно послушать вслух", chapters="Главы",
        tags="#Библия #БиблейскиеСтихи #СловоБожье #Сон #Молитва"),
    "it": dict(
        hours="{h} Ore", dec=",",
        titles=[("Addormentati nella Pace di Dio", "Versetti Biblici per Dormire e Pianoforte Rilassante"),
                ("Lascia Andare l'Ansia", "Versetti Biblici contro l'Ansia e per la Pace"),
                ("Riposo per l'Anima Stanca", "Versetti Biblici di Conforto e Pianoforte"),
                ("Rinnova le tue Forze", "Devozionale del Mattino con Versetti Biblici"),
                ("Fermatevi, Riconoscete", "Versetti Biblici per Pace, Riposo e Meditazione"),
                ("Rilassati con Dio Stasera", "Versetti Biblici per la Sera e Pianoforte"),
                ("Concentrati sulla Parola", "Versetti per Pregare, Meditare e Studiare la Bibbia"),
                ("Calma la tua Mente", "Parola di Dio per il Riposo e la Pace"),
                ("Dormi in Pace Stanotte", "Versetti Biblici prima di Dormire e Riposo Profondo")],
        bible="Riveduta 1927",
        subs="Sottotitoli in italiano: tocca CC o ⚙️ → Sottotitoli → Italiano. Testo biblico: {bible}.",
        audio="Solo pianoforte di default; per ascoltare la lettura in inglese o cinese, cambia la traccia audio in ⚙️ Impostazioni.",
        body="{count} dei versetti biblici più citati appaiono uno alla volta su paesaggi naturali in 4K, per leggere lentamente e meditare. Per dormire, pregare, il tempo con Dio, lavorare o studiare. Nessuna pubblicità inserita.",
        listen="🎧 Ascolta qualsiasi versetto ad alta voce", chapters="Capitoli",
        tags="#Bibbia #VersettiBiblici #ParolaDiDio #Dormire #Preghiera"),
    "ar": dict(
        hours="{h} ساعات", dec=".", hours2="ساعتان",
        titles=[("نم في سلام الله", "آيات من الكتاب المقدس للنوم مع بيانو هادئ"),
                ("تحرّر من القلق", "آيات الكتاب المقدس عن القلق والسلام"),
                ("راحة للنفس المتعبة", "آيات الكتاب المقدس للتعزية مع بيانو هادئ"),
                ("جدّد قوتك", "تأمل صباحي ووقت هادئ مع كلمة الله"),
                ("كفّوا واعلموا", "آيات للسلام والراحة والتأمل"),
                ("استرح مع الله الليلة", "آيات الكتاب المقدس قبل النوم مع بيانو هادئ"),
                ("ركّز مع كلمة الله", "آيات للصلاة والتأمل ودراسة الكتاب المقدس"),
                ("هدّئ ذهنك", "كلمة الله المعزية للراحة والسكينة"),
                ("نم بسلام الليلة", "آيات من الكتاب المقدس للنوم العميق")],
        bible="ترجمة فاندايك",
        subs="الترجمة العربية: اضغط CC أو ⚙️ ← الترجمة ← العربية. نص الكتاب المقدس: {bible}.",
        audio="بيانو فقط افتراضيًا؛ لسماع القراءة بالإنجليزية أو الصينية غيّر المسار الصوتي من ⚙️ الإعدادات.",
        body="{count} من أكثر آيات الكتاب المقدس اقتباسًا تظهر واحدة تلو الأخرى فوق مناظر طبيعية بدقة 4K، لتقرأ ببطء وتتأمل. للنوم والصلاة والخلوة مع الله والعمل والدراسة. بلا إعلانات مُدرجة.",
        listen="🎧 استمع إلى أي آية بصوت مسموع", chapters="الفصول",
        tags="#الكتاب_المقدس #آيات #كلمة_الله #صلاة"),
    "vi": dict(
        hours="{h} giờ", dec=",",
        titles=[("Ngủ trong sự bình an của Chúa", "Câu Kinh Thánh để ngủ & nhạc piano nhẹ nhàng"),
                ("Buông bỏ lo âu", "Câu Kinh Thánh về lo âu và bình an"),
                ("Nghỉ ngơi cho tâm hồn mệt mỏi", "Lời Chúa an ủi & nhạc piano nhẹ nhàng"),
                ("Được sức mới", "Tĩnh nguyện buổi sáng với Lời Chúa"),
                ("Hãy yên lặng và biết", "Câu Kinh Thánh cho bình an và suy ngẫm"),
                ("Nghỉ ngơi với Chúa tối nay", "Lời Chúa buổi tối & nhạc piano nhẹ nhàng"),
                ("Tập trung với Lời Chúa", "Câu Kinh Thánh để cầu nguyện và suy ngẫm"),
                ("Lặng yên tâm trí", "Lời Chúa an ủi để nghỉ ngơi bình an"),
                ("Ngủ ngon đêm nay", "Lời Chúa trước khi ngủ & nghỉ ngơi sâu")],
        bible="Kinh Thánh bản 1934 (Truyền Thống)",
        subs="Phụ đề tiếng Việt: chạm CC hoặc ⚙️ → Phụ đề → Tiếng Việt. Bản Kinh Thánh: {bible}.",
        audio="Mặc định chỉ có piano; muốn nghe đọc tiếng Anh hoặc tiếng Trung, đổi bản âm thanh trong ⚙️ Cài đặt.",
        body="{count} câu Kinh Thánh được trích dẫn nhiều nhất lần lượt hiện lên trên cảnh thiên nhiên 4K, để đọc chậm và suy ngẫm. Dùng khi ngủ, cầu nguyện, tĩnh nguyện, làm việc hay học tập. Không chèn quảng cáo.",
        listen="🎧 Nghe đọc bất kỳ câu Kinh Thánh nào", chapters="Chương",
        tags="#KinhThánh #LờiChúa #CầuNguyện #NgủNgon"),
    "fil": dict(
        hours="{h} Oras", dec=".",
        titles=[("Matulog sa Kapayapaan ng Diyos", "Mga Talata sa Bibliya para Matulog at Piano"),
                ("Bitawan ang Pagkabalisa", "Mga Talata para sa Pagkabalisa at Kapayapaan"),
                ("Pahinga sa Pagal na Kaluluwa", "Mga Talata ng Kaaliwan at Banayad na Piano"),
                ("Panibaguhin ang Lakas", "Debosyon sa Umaga at Salita ng Diyos"),
                ("Kayo'y Magsitigil at Kilalanin", "Mga Talata para sa Kapayapaan at Pagninilay"),
                ("Magpahinga sa Diyos Ngayong Gabi", "Mga Talata sa Bibliya Bago Matulog"),
                ("Ituon ang Isip sa Salita", "Mga Talata para sa Panalangin at Pagninilay"),
                ("Patahimikin ang Isip", "Salita ng Diyos para sa Pahinga at Kapayapaan"),
                ("Matulog nang Payapa Ngayong Gabi", "Mga Talata para sa Mahimbing na Tulog")],
        bible="Ang Dating Biblia (1905)",
        subs="Tagalog na subtitle: pindutin ang CC o ⚙️ → Subtitles → Filipino. Teksto ng Bibliya: {bible}.",
        audio="Piano lang bilang default; para marinig ang pagbasa sa Ingles o Tsino, palitan ang audio track sa ⚙️ Settings.",
        body="{count} sa mga pinakamadalas banggiting talata ng Bibliya ang lumalabas isa-isa sa ibabaw ng 4K na tanawin ng kalikasan, para dahan-dahang basahin at pagnilayan. Para sa pagtulog, panalangin, debosyon, trabaho o pag-aaral. Walang isinisingit na ads.",
        listen="🎧 Pakinggan ang anumang talata", chapters="Mga Kabanata",
        tags="#Bibliya #MgaTalataSaBibliya #SalitaNgDiyos #Panalangin"),
    "hi": dict(
        hours="{h} घंटे", dec=".",
        titles=[("परमेश्वर की शांति में सो जाइए", "सोने से पहले बाइबल के वचन और शांत पियानो"),
                ("चिंता को छोड़ दीजिए", "चिंता के समय शांति के लिए बाइबल वचन"),
                ("थकी हुई आत्मा के लिए विश्राम", "सांत्वना के लिए बाइबल के वचन और शांत पियानो"),
                ("नई शक्ति पाइए", "सुबह का भक्ति समय और बाइबल के वचन"),
                ("चुप हो जाओ, और जान लो", "शांति और मनन के लिए बाइबल के वचन"),
                ("आज रात परमेश्वर के साथ विश्राम", "रात को सोने से पहले बाइबल के वचन"),
                ("वचन पर ध्यान लगाइए", "प्रार्थना और मनन के लिए बाइबल वचन"),
                ("अपने मन को शांत कीजिए", "विश्राम के लिए परमेश्वर के सांत्वना भरे वचन"),
                ("आज रात चैन से सोइए", "सोते समय बाइबल के वचन और गहरा विश्राम")],
        bible="इंडियन रिवाइज्ड वर्जन (IRV)",
        subs="हिंदी उपशीर्षक: CC या ⚙️ → उपशीर्षक → हिंदी चुनें। बाइबल पाठ: {bible}।",
        audio="डिफ़ॉल्ट रूप से केवल पियानो; अंग्रेज़ी या चीनी में पाठ सुनने के लिए ⚙️ सेटिंग्स में ऑडियो ट्रैक बदलें।",
        body="बाइबल के {count} सबसे अधिक उद्धृत वचन 4K प्राकृतिक दृश्यों पर एक-एक करके दिखाई देते हैं, ताकि आप धीरे पढ़ें और मनन करें। सोने, प्रार्थना, भक्ति समय, काम या पढ़ाई के लिए। बीच में कोई विज्ञापन नहीं डाला गया।",
        listen="🎧 कोई भी वचन सुनिए", chapters="अध्याय",
        tags="#बाइबल #बाइबलवचन #परमेश्वरकावचन #प्रार्थना"),
    "sw": dict(
        hours="Saa {h}", dec=".",
        titles=[("Lala katika Amani ya Mungu", "Mistari ya Biblia ya Kulala na Piano Laini"),
                ("Achilia Wasiwasi", "Mistari ya Biblia kuhusu Wasiwasi na Amani"),
                ("Pumziko kwa Nafsi Iliyochoka", "Mistari ya Biblia ya Faraja na Piano Laini"),
                ("Pata Nguvu Mpya", "Ibada ya Asubuhi na Neno la Mungu"),
                ("Mkae Kimya na Mjue", "Mistari ya Biblia ya Amani na Kutafakari"),
                ("Pumzika na Mungu Usiku Huu", "Mistari ya Biblia Kabla ya Kulala"),
                ("Tafakari Neno la Mungu", "Mistari ya Biblia kwa Maombi na Kutafakari"),
                ("Tuliza Akili Yako", "Neno la Mungu la Faraja na Pumziko"),
                ("Lala kwa Amani Usiku Huu", "Mistari ya Biblia ya Kulala Usingizi Mzito")],
        bible="Unlocked Literal Bible (ULB)",
        subs="Manukuu ya Kiswahili: gusa CC au ⚙️ → Manukuu → Kiswahili. Maandiko: {bible}.",
        audio="Kwa kawaida ni piano tu; kusikia usomaji kwa Kiingereza au Kichina, badilisha wimbo wa sauti kwenye ⚙️ Mipangilio.",
        body="Mistari {count} ya Biblia inayonukuliwa zaidi inaonekana mmoja baada ya mwingine juu ya mandhari ya asili ya 4K, ili usome polepole na kutafakari. Kwa kulala, maombi, ibada, kazi au masomo. Hakuna matangazo yaliyoingizwa.",
        listen="🎧 Sikiliza mstari wowote ukisomwa", chapters="Sura",
        tags="#Biblia #MistariYaBiblia #NenoLaMungu #Maombi"),
    "ko": dict(
        hours="{h}시간", dec=".",
        titles=[("하나님의 평안 안에서 잠들기", "잠들기 전 성경말씀 & 잔잔한 피아노"),
                ("불안을 내려놓으세요", "불안할 때 듣는 성경말씀"),
                ("지친 영혼을 위한 쉼", "위로가 되는 성경말씀 & 잔잔한 피아노"),
                ("새 힘을 얻으라", "아침 묵상 성경말씀 & 피아노"),
                ("가만히 있어 내가 하나님 됨을 알지어다", "평안과 묵상을 위한 성경말씀"),
                ("오늘 밤 하나님과 함께 쉼", "밤에 듣는 성경말씀 & 잔잔한 피아노"),
                ("말씀에 집중하는 시간", "기도와 묵상을 위한 성경말씀"),
                ("마음을 고요하게", "평안을 주는 위로의 성경말씀"),
                ("오늘 밤 평안히 잠드세요", "잠잘 때 듣는 성경말씀 & 깊은 쉼")],
        bible="개역한글",
        subs="한국어 자막: CC 또는 ⚙️ → 자막 → 한국어를 선택하세요. 성경 본문: {bible}.",
        audio="기본은 피아노만 나옵니다. 영어나 중국어 낭독을 들으려면 ⚙️ 설정에서 오디오 트랙을 바꾸세요.",
        body="가장 많이 인용되는 성경말씀 {count}구절이 4K 자연 풍경 위에 한 구절씩 나타납니다. 천천히 읽고 묵상하세요. 잠들 때, 기도, 큐티, 일하거나 공부할 때. 중간 광고를 넣지 않았습니다.",
        listen="🎧 어떤 구절이든 낭독으로 들어 보세요", chapters="챕터",
        tags="#성경말씀 #성경 #말씀묵상 #기도"),
    "ja": dict(
        hours="{h}時間", dec=".",
        titles=[("神の平安の中で眠る", "眠る前に聴く聖書の言葉と穏やかなピアノ"),
                ("不安を手放して", "不安なときに聴く聖書の言葉"),
                ("疲れた心に休みを", "慰めの聖書の言葉と癒しのピアノ"),
                ("新しい力を得る", "朝の聖書の言葉とピアノ・デボーション"),
                ("静まって、わたしこそ神であることを知れ", "平安と黙想のための聖書の言葉"),
                ("今夜、神と共に休む", "夜に聴く聖書の言葉と穏やかなピアノ"),
                ("御言葉に集中する時間", "祈りと黙想のための聖書の言葉"),
                ("心を静めて", "平安を与える慰めの聖書の言葉"),
                ("今夜、安らかに眠る", "眠る前の聖書の言葉と深い休息")],
        bible="口語訳（1955年）",
        subs="日本語字幕：CC または ⚙️ → 字幕 → 日本語 を選んでください。聖書本文：{bible}。",
        audio="初期設定はピアノのみです。英語・中国語の朗読を聴くには ⚙️ 設定で音声トラックを切り替えてください。",
        body="よく引用される聖書の言葉 {count} 節が、4K の自然の風景の上に一節ずつ現れます。ゆっくり読み、黙想するために。眠る前、祈り、デボーション、仕事や勉強のお供に。途中広告は入れていません。",
        listen="🎧 どの聖句も朗読で聴けます", chapters="チャプター",
        tags="#聖書 #聖書の言葉 #御言葉 #祈り"),
    "id": dict(
        hours="{h} Jam", dec=",",
        titles=[("Tidur dalam Damai Tuhan", "Ayat Alkitab Pengantar Tidur & Piano Lembut"),
                ("Lepaskan Kecemasan", "Ayat Alkitab untuk Kecemasan dan Ketenangan"),
                ("Istirahat bagi Jiwa yang Lelah", "Ayat Alkitab Penghiburan & Piano Lembut"),
                ("Kekuatan Baru", "Saat Teduh Pagi dengan Firman Tuhan"),
                ("Diam dan Ketahuilah", "Ayat Alkitab untuk Damai dan Renungan"),
                ("Beristirahat Bersama Tuhan Malam Ini", "Ayat Alkitab Sebelum Tidur & Renungan Malam"),
                ("Fokus pada Firman", "Ayat Alkitab untuk Doa dan Renungan"),
                ("Tenangkan Pikiranmu", "Firman Tuhan yang Menguatkan untuk Istirahat"),
                ("Tidur Nyenyak Malam Ini", "Ayat Alkitab Sebelum Tidur & Istirahat Dalam")],
        bible="Alkitab Yang Terbuka (AYT)",
        subs="Subtitle bahasa Indonesia: ketuk CC atau ⚙️ → Subtitle → Indonesia. Teks Alkitab: {bible}.",
        audio="Bawaan hanya piano; untuk mendengar pembacaan dalam bahasa Inggris atau Mandarin, ganti trek audio di ⚙️ Setelan.",
        body="{count} ayat Alkitab yang paling sering dikutip muncul satu per satu di atas pemandangan alam 4K, untuk dibaca perlahan dan direnungkan. Untuk tidur, berdoa, saat teduh, bekerja, atau belajar. Tanpa iklan sisipan.",
        listen="🎧 Dengarkan ayat mana pun dibacakan", chapters="Bab",
        tags="#Alkitab #AyatAlkitab #FirmanTuhan #SaatTeduh #Doa"),
    "uk": dict(
        hours="{h} години", dec=",",
        titles=[("Засинай у Божому мирі", "Біблійні вірші для сну і тиха фортепіанна музика"),
                ("Відпусти тривогу", "Біблійні вірші від тривоги та про мир"),
                ("Спочинок для втомленої душі", "Біблійні вірші для втіхи і тиха музика"),
                ("Віднови свої сили", "Тихий час з Богом: ранкові біблійні вірші"),
                ("Вгамуйтесь і пізнайте", "Біблійні вірші для миру й роздумів"),
                ("Вечір з Богом", "Біблійні вірші на ніч і тиха музика"),
                ("Зосередься на Слові", "Біблійні вірші для молитви й роздумів"),
                ("Заспокой свій розум", "Слово Боже для втіхи та спокою"),
                ("Спокійної ночі з Богом", "Біблійні вірші перед сном і глибокий спокій")],
        bible="переклад Куліша — Пулюя",
        subs="Українські субтитри: натисніть CC або ⚙️ → Субтитри → Українська. Текст Біблії: {bible}.",
        audio="За замовчуванням лише фортепіано; щоб слухати читання англійською чи китайською, змініть аудіодоріжку в ⚙️ Налаштуваннях.",
        body="{count} найчастіше цитованих біблійних віршів з'являються один за одним на тлі природи в 4K — щоб читати повільно й роздумувати. Для сну, молитви, тихого часу з Богом, роботи чи навчання. Без вставленої реклами.",
        listen="🎧 Будь-який вірш можна послухати", chapters="Розділи",
        tags="#Біблія #БіблійніВірші #СловоБоже #Молитва"),
    "pl": dict(
        hours="{h} godziny", dec=",",
        titles=[("Zaśnij w Bożym pokoju", "Wersety biblijne na sen i delikatny fortepian"),
                ("Uwolnij się od lęku", "Wersety biblijne na lęk i niepokój"),
                ("Odpoczynek dla zmęczonej duszy", "Wersety biblijne na pocieszenie i fortepian"),
                ("Odnów swoje siły", "Poranny czas z Bogiem i wersety biblijne"),
                ("Uspokójcie się i uznajcie", "Wersety biblijne o pokoju i do rozważania"),
                ("Wieczór z Bogiem", "Wersety biblijne na noc i delikatny fortepian"),
                ("Skup się na Słowie", "Wersety biblijne do modlitwy i rozważania"),
                ("Wycisz swój umysł", "Słowo Boże na pocieszenie i odpoczynek"),
                ("Spokojnej nocy z Bogiem", "Wersety biblijne przed snem i głęboki odpoczynek")],
        bible="Uwspółcześniona Biblia Gdańska",
        subs="Polskie napisy: dotknij CC lub ⚙️ → Napisy → Polski. Tekst Biblii: {bible}.",
        audio="Domyślnie tylko fortepian; aby słuchać czytania po angielsku lub chińsku, zmień ścieżkę dźwiękową w ⚙️ Ustawieniach.",
        body="{count} najczęściej cytowanych wersetów biblijnych pojawia się jeden po drugim na tle przyrody w 4K – do powolnego czytania i rozważania. Do snu, modlitwy, czasu z Bogiem, pracy lub nauki. Bez wstawionych reklam.",
        listen="🎧 Posłuchaj dowolnego wersetu", chapters="Rozdziały",
        tags="#Biblia #WersetyBiblijne #SłowoBoże #Modlitwa"),
    "ro": dict(
        hours="{h} ore", dec=",",
        titles=[("Adormi în pacea lui Dumnezeu", "Versete biblice pentru somn și pian liniștit"),
                ("Lasă îngrijorarea", "Versete biblice pentru anxietate și pace"),
                ("Odihnă pentru sufletul obosit", "Versete biblice de mângâiere și pian liniștit"),
                ("Înnoiește-ți puterea", "Devoțional de dimineață cu versete biblice"),
                ("Opriți-vă, și să știți", "Versete biblice pentru pace și meditație"),
                ("Odihnă cu Dumnezeu în seara asta", "Versete biblice pentru seară și pian liniștit"),
                ("Concentrează-te pe Cuvânt", "Versete biblice pentru rugăciune și meditație"),
                ("Liniștește-ți mintea", "Cuvântul lui Dumnezeu pentru odihnă și pace"),
                ("Dormi în pace în noaptea asta", "Versete biblice înainte de culcare")],
        bible="Cornilescu 1924",
        subs="Subtitrări în română: atinge CC sau ⚙️ → Subtitrări → Română. Textul biblic: {bible}.",
        audio="Implicit doar pian; ca să asculți citirea în engleză sau chineză, schimbă pista audio din ⚙️ Setări.",
        body="{count} dintre cele mai citate versete biblice apar unul câte unul peste peisaje naturale în 4K, ca să citești încet și să meditezi. Pentru somn, rugăciune, timp cu Dumnezeu, lucru sau studiu. Fără reclame inserate.",
        listen="🎧 Ascultă orice verset citit cu voce tare", chapters="Capitole",
        tags="#Biblia #VerseteBiblice #CuvântulLuiDumnezeu #Rugăciune"),
}
APPS = "App: iPhone https://apps.apple.com/app/id6771996188 · Android https://play.google.com/store/apps/details?id=me.askbible"


def en_meta(n):
    """英文说明取上传时的 json；标题取 series-state.json（D-31 已用 API 改过标题）。apply 时以 YouTube 上的现值为准。"""
    m = json.loads((Y / f"en-ep{n:02d}/upload-en-dual.json").read_text())
    return {**m, "title": json.loads(STATE.read_text())[f"ep{n:02d}-en-dual"]["title"]}


_G = []


def en_book_codes():
    if not _G:
        g, _ = ms.golden()  # 注意：golden() 会改写 sys.argv，命令行参数要在调用前读完
        _G.append({v: k for k, v in g.book_names().items()})
    return _G[0]


def hours(lang, en_title):
    h = re.search(r"\| ([\d.]+) Hours? ·", en_title).group(1)
    d = L[lang]
    if h == "2" and d.get("hours2"):
        return d["hours2"]
    return d["hours"].format(h=h.replace(".", d["dec"]))


def chapters(lang, n, en_desc):
    """英文说明里的章节时间戳 → 本语言书名和节号（照字幕用的同一套换算）。"""
    rev = en_book_codes()
    out = []
    for t, name, c, v in re.findall(r"^(\d:\d\d:\d\d) (.+?) (\d+):(\d+)$", en_desc, re.M):
        x = (rev[name], int(c), int(v))
        out.append(f"{t} {ms.resolve(lang, NEED)[x][1]}")
    return out


NEED = []


def build(n, lang, en_title, en_desc):
    if not NEED:
        NEED.extend(ms.need_verses())
    d = L[lang]
    hook, mid = d["titles"][n - 1]
    title = f"{hook} | {mid} | {hours(lang, en_title)} · Be Still Series"
    if len(title) > 100:  # 外语长，放不下就省掉系列名（需要开头和搜索词更要紧）
        title = f"{hook} | {mid} | {hours(lang, en_title)}"
    count = re.search(r"(\d+) of the most-quoted", en_desc).group(1)
    ch = chapters(lang, n, en_desc)
    credit = ms.LANGS[lang][3]
    desc = "\n\n".join(x for x in [
        hook + ".",
        f"{d['listen']}: https://askbible.me\n{APPS}",
        d["subs"].format(bible=d["bible"]) + "\n" + d["audio"],
        d["body"].format(count=count),
        f"{d['chapters']}:\n0:00:00 Intro\n" + "\n".join(ch) if ch else "",
        credit,
        "📖 AskBible.me\n\n" + d["tags"],
    ] if x)
    return title, desc


def all_items(n):
    m = en_meta(n)
    return {lang: build(n, lang, m["title"], m["description"]) for lang in L}


def check():
    bad = []
    for n in range(1, 10):
        m = en_meta(n)
        for lang in L:
            t, d = build(n, lang, m["title"], m["description"])
            if len(t) > 100 or len(d.encode()) > 5000 or "<" in t + d or ">" in t + d:
                bad.append((n, lang, len(t), len(d.encode()), t))
    print("全部合格" if not bad else "\n".join(map(str, bad)))
    return not bad


def apply(eps, wait=False):
    """一集一次 videos.update(part=snippet,localizations)：snippet 原样带回（只补 defaultLanguage=en），免得清掉别的字段。"""
    import datetime, time
    from zoneinfo import ZoneInfo
    from googleapiclient.errors import HttpError
    assert check()
    u_spec = importlib.util.spec_from_file_location("u", ROOT / "scripts/youtube-upload.py")
    u = importlib.util.module_from_spec(u_spec)
    u_spec.loader.exec_module(u)
    y = u.yt("still")
    for n in eps:
        k = f"ep{n:02d}-en-dual"
        st = json.loads(STATE.read_text())
        if st[k].get("localized"):
            continue
        vid = st[k]["video_id"]
        while True:
            try:
                cur = y.videos().list(part="snippet,localizations", id=vid).execute()["items"][0]
                sn = cur["snippet"]
                # 本地化以 YouTube 上现在的英文标题 / 说明为准生成（章节、时长都从这里取）
                loc = {lang: {"title": t, "description": d}
                       for lang, (t, d) in {lang: build(n, lang, sn["title"], sn["description"]) for lang in L}.items()}
                loc = {**cur.get("localizations", {}), **loc}
                body = {"id": vid, "localizations": loc,
                        "snippet": {kk: sn[kk] for kk in ("title", "description", "tags", "categoryId", "defaultAudioLanguage") if kk in sn}
                        | {"defaultLanguage": sn.get("defaultLanguage") or "en"}}
                y.videos().update(part="snippet,localizations", body=body).execute()
                break
            except HttpError as e:
                if "quota" not in str(e).lower():
                    raise
                if not wait:
                    print(f"{datetime.datetime.now():%m-%d %H:%M} 额度用完，停在 {k}", flush=True)
                    return
                now = datetime.datetime.now(ZoneInfo("America/Los_Angeles"))
                nxt = (now + datetime.timedelta(days=1)).replace(hour=0, minute=10, second=0, microsecond=0)
                time.sleep((nxt - now).total_seconds())
        st = json.loads(STATE.read_text())
        st[k]["localized"] = sorted(L)
        STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))
        print(f"{datetime.datetime.now():%m-%d %H:%M} {k}：标题 / 说明 {len(L)} 种语言已写入", flush=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "preview":
        n, lang = int(sys.argv[2]), sys.argv[3]
        m = en_meta(n)
        t, d = build(n, lang, m["title"], m["description"])
        print(t, f"（{len(t)} 字）\n")
        print(d)
    elif cmd == "check":
        check()
    elif cmd == "apply":
        apply(range(1, 10) if sys.argv[2] == "all" else [int(sys.argv[2])], wait="--wait" in sys.argv)
    else:
        sys.exit(__doc__)
