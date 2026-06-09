const BIBLE_BOOK_RULES = [
  { book: '帖撒罗尼迦后书', test: (title) => /帖撒罗尼迦后书|帖撒罗尼迦後書/.test(title) },
  { book: '帖撒罗尼迦前书', test: (title) => /帖撒罗尼迦前书|帖撒罗尼迦前書/.test(title) },
  { book: '哥林多后书', test: (title) => /哥林多后书|哥林多後書/.test(title) },
  { book: '哥林多前书', test: (title) => /哥林多前书|哥林多前書|林前\d+[:：]/.test(title) },
  { book: '提摩太后书', test: (title) => /提摩太后书|提摩太后書/.test(title) },
  { book: '提摩太前书', test: (title) => /提摩太前书|提摩太前書|提前\d+[:：]/.test(title) },
  { book: '约翰一书', test: (title) => /约翰一书|約翰一書/.test(title) },
  { book: '约翰二书', test: (title) => /约翰二书|約翰二書/.test(title) },
  { book: '约翰三书', test: (title) => /约翰三书|約翰三書/.test(title) },
  { book: '撒母耳记下', test: (title) => /撒母耳记下|撒母耳記下/.test(title) },
  { book: '撒母耳记上', test: (title) => /撒母耳记上|撒母耳記上/.test(title) },
  { book: '列王纪下', test: (title) => /列王纪下|列王紀下/.test(title) },
  { book: '列王纪上', test: (title) => /列王纪上|列王紀上/.test(title) },
  { book: '历代志下', test: (title) => /历代志下|歷代志下/.test(title) },
  { book: '历代志上', test: (title) => /历代志上|歷代志上/.test(title) },
  { book: '马太福音', test: (title) => /马太福音|馬太福音|太\d+[:：]/.test(title) },
  { book: '马可福音', test: (title) => /马可福音|馬可福音/.test(title) },
  { book: '路加福音', test: (title) => /路加福音|路\d+[:：]/.test(title) },
  { book: '约翰福音', test: (title) => /约翰福音|約翰福音/.test(title) },
  { book: '使徒行传', test: (title) => /使徒行传|使徒行傳|徒\d+[:：]/.test(title) },
  { book: '腓利门书', test: (title) => /腓利门书|腓利門書/.test(title) },
  { book: '希伯来书', test: (title) => /希伯来书|希伯來書|来\d+[:：]/.test(title) },
  { book: '创世记', test: (title) => /创世记|創世記|创世纪/.test(title) },
  { book: '出埃及记', test: (title) => /出埃及记|出埃及記/.test(title) },
  { book: '利未记', test: (title) => /利未记|利未記/.test(title) },
  { book: '民数记', test: (title) => /民数记|民數記/.test(title) },
  { book: '申命记', test: (title) => /申命记|申命記/.test(title) },
  { book: '约书亚记', test: (title) => /约书亚记|約書亞記/.test(title) },
  { book: '士师记', test: (title) => /士师记|士師記/.test(title) },
  { book: '路得记', test: (title) => /路得记|路得記/.test(title) },
  { book: '以斯拉记', test: (title) => /以斯拉记|以斯拉記/.test(title) },
  { book: '尼希米记', test: (title) => /尼希米记|尼希米記/.test(title) },
  { book: '以斯帖记', test: (title) => /以斯帖记|以斯帖記/.test(title) },
  { book: '约伯记', test: (title) => /约伯记|約伯記/.test(title) },
  { book: '传道书', test: (title) => /传道书|傳道書/.test(title) },
  { book: '雅歌', test: (title) => /雅歌/.test(title) },
  { book: '以赛亚书', test: (title) => /以赛亚书|以賽亞書/.test(title) },
  { book: '耶利米书', test: (title) => /耶利米书|耶利米書/.test(title) },
  { book: '耶利米哀歌', test: (title) => /耶利米哀歌/.test(title) },
  { book: '以西结书', test: (title) => /以西结书|以西結書/.test(title) },
  { book: '但以理书', test: (title) => /但以理书|但以理書/.test(title) },
  { book: '何西阿书', test: (title) => /何西阿书|何西阿書/.test(title) },
  { book: '约珥书', test: (title) => /约珥书|約珥書/.test(title) },
  { book: '阿摩司书', test: (title) => /阿摩司书|阿摩司書/.test(title) },
  { book: '俄巴底亚书', test: (title) => /俄巴底亚书/.test(title) },
  { book: '约拿书', test: (title) => /约拿书|約拿書/.test(title) },
  { book: '弥迦书', test: (title) => /弥迦书|彌迦書/.test(title) },
  { book: '那鸿书', test: (title) => /那鸿书|那鴻書/.test(title) },
  { book: '哈巴谷书', test: (title) => /哈巴谷书|哈巴谷書/.test(title) },
  { book: '西番雅书', test: (title) => /西番雅书|西番雅書/.test(title) },
  { book: '哈该书', test: (title) => /哈该书|哈該書/.test(title) },
  { book: '撒迦利亚书', test: (title) => /撒迦利亚书|撒迦利亞書/.test(title) },
  { book: '玛拉基书', test: (title) => /玛拉基书|瑪拉基書/.test(title) },
  { book: '罗马书', test: (title) => /罗马书|羅馬書|罗\d+[:：]/.test(title) },
  { book: '加拉太书', test: (title) => /加拉太书|加拉太書/.test(title) },
  { book: '以弗所书', test: (title) => /以弗所书|以弗所書|弗\d+[:：]/.test(title) },
  { book: '腓立比书', test: (title) => /腓立比书|腓立比書|腓\d+[:：]/.test(title) },
  { book: '歌罗西书', test: (title) => /歌罗西书|歌羅西書|西\d+[:：]/.test(title) },
  { book: '提多书', test: (title) => /提多书|提多書/.test(title) },
  { book: '雅各书', test: (title) => /雅各书|雅各書/.test(title) },
  { book: '彼得前书', test: (title) => /彼得前书|彼得前書|彼前\d+[:：]/.test(title) },
  { book: '彼得后书', test: (title) => /彼得后书|彼得後書|彼后\d+[:：]/.test(title) },
  { book: '犹大书', test: (title) => /犹大书|猶大書/.test(title) },
  { book: '启示录', test: (title) => /启示录|啟示錄/.test(title) },
  { book: '诗篇', test: (title) => /诗篇|詩篇|诗\d+[:：]/.test(title) },
  { book: '箴言', test: (title) => /箴言/.test(title) },
];

export const SUNDAY_OCCASION_FILTERS = [
  { id: 'easter', label: '复活节' },
  { id: 'christmas', label: '圣诞节' },
  { id: 'mothers', label: '母亲节' },
  { id: 'fathers', label: '父亲节' },
];

export function extractSundayBibleBook(title) {
  const raw = String(title || '').trim();
  if (!raw) return null;
  for (const rule of BIBLE_BOOK_RULES) {
    if (rule.test(raw)) return rule.book;
  }
  return null;
}

export function detectSundayOccasions(sermon) {
  const title = String(sermon?.displayTitle || sermon?.lesson || '').trim();
  const date = String(sermon?.lessonDate || sermon?.date || '').trim();
  const occasions = [];

  if (/复活|復活/.test(title)) occasions.push('easter');
  if (/圣诞|聖誕|大喜的信息/.test(title)) occasions.push('christmas');
  if (/母亲|母親|母爱|母愛/.test(title)) occasions.push('mothers');
  if (/父亲|父親/.test(title)) occasions.push('fathers');

  if (date) {
    const monthDay = date.slice(5, 10);
    if (monthDay >= '12-15' || monthDay <= '01-02') {
      if (!occasions.includes('christmas') && /圣诞|聖誕|大喜|主降|降生|马槽|馬槽/i.test(title)) {
        occasions.push('christmas');
      }
    }
    if (monthDay >= '03-20' && monthDay <= '04-30' && /复活|復活/.test(title)) {
      if (!occasions.includes('easter')) occasions.push('easter');
    }
  }

  return occasions;
}

export function matchesSundayBookFilter(sermon, bookFilter) {
  if (!bookFilter || bookFilter === 'all') return true;
  if (bookFilter === 'theme') return !sermon.bibleBook;
  return sermon.bibleBook === bookFilter;
}

export function matchesSundayOccasionFilter(sermon, occasionFilter) {
  if (!occasionFilter || occasionFilter === 'all') return true;
  return (sermon.occasions || []).includes(occasionFilter);
}
