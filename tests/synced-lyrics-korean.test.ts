import { expect, test } from '@playwright/test';

import { toKoreanPronunciation } from '../src/plugins/synced-lyrics/renderer/korean';
import { detectPronunciationContext } from '../src/plugins/synced-lyrics/renderer/korean/context';
import {
  arpabetToHangul,
  englishLineToHangul,
} from '../src/plugins/synced-lyrics/renderer/korean/english';
import {
  lookupWord,
  parseDictionary,
} from '../src/plugins/synced-lyrics/renderer/korean/english-dictionary';
import {
  type JapaneseToken,
  japaneseTokensToHangul,
  kanaToHangul,
} from '../src/plugins/synced-lyrics/renderer/korean/kana';
import { pinyinToHangul } from '../src/plugins/synced-lyrics/renderer/korean/pinyin';

const expectAll = (
  convert: (input: string) => string | null,
  cases: Record<string, string | null>,
) => {
  for (const [input, expected] of Object.entries(cases)) {
    expect(convert(input), input).toBe(expected);
  }
};

test.describe('Japanese', () => {
  test('kana to Hangul', () => {
    expectAll(kanaToHangul, {
      さくら: '사쿠라',
      すし: '스시',
      つなみ: '츠나미',
      ふじさん: '후지산',
      // っ and ん close the syllable before them
      きって: '킷테',
      しんぶん: '신분',
      ちょっと: '춋토',
      // Small kana change the sound of the one before
      きゃく: '캬쿠',
      ファイト: '파이토',
      ヴァイオリン: '바이오린',
      ウィンドウ: '윈도우',
      トゥモロー: '투모로-',
      // Long vowels are marked with "-", ン closes the syllable over it
      コーヒー: '코-히-',
      ティーン: '틴',
      ねぇ: '네-',
    });
  });

  const token = (
    surface_form: string,
    pos: string,
    pos_detail_1: string,
    pronunciation: string,
  ): JapaneseToken => ({
    surface_form,
    pos,
    pos_detail_1,
    reading: pronunciation,
    pronunciation,
  });

  test('particles and auxiliaries stay with their word', () => {
    expect(
      japaneseTokensToHangul([
        token('私', '名詞', '代名詞', 'ワタシ'),
        // は is read わ
        token('は', '助詞', '係助詞', 'ワ'),
        token('学生', '名詞', '一般', 'ガクセー'),
        token('です', '助動詞', '*', 'デス'),
      ]),
    ).toBe('와타시와 가쿠세-데스');

    expect(
      japaneseTokensToHangul([
        token('猫', '名詞', '一般', 'ネコ'),
        token('が', '助詞', '格助詞', 'ガ'),
        token('好き', '名詞', '形容動詞語幹', 'スキ'),
        token('な', '助動詞', '*', 'ナ'),
        token('ん', '名詞', '非自立', 'ン'),
        token('だ', '助動詞', '*', 'ダ'),
        token('。', '記号', '句点', '。'),
      ]),
    ).toBe('네코가 스키난다.');
  });

  test('the volitional う lengthens the vowel', () => {
    expect(
      japaneseTokensToHangul([
        token('行こ', '動詞', '自立', 'イコ'),
        token('う', '助動詞', '*', 'ウ'),
      ]),
    ).toBe('이코-');
  });
});

test('Chinese pinyin to Hangul', () => {
  expectAll(pinyinToHangul, {
    zhong: '중',
    guo: '궈',
    bei: '베이',
    jing: '징',
    shang: '상',
    hai: '하이',
    zhou: '저우',
    jie: '제',
    lun: '룬',
    xie: '셰',
    zhi: '즈',
    si: '쓰',
    shi: '스',
    ri: '르',
    jun: '쥔',
    wei: '웨이',
    wen: '원',
    yue: '웨',
    er: '얼',
    zuo: '쭤',
    lv: '뤼',
    lü: '뤼',
    // Not pinyin
    xyz: null,
    constructor: null,
  });
});

test.describe('English', () => {
  // As the dictionary stores them: stress dropped, except for AH0 and ER0
  const phones = (arpabet: string) => arpabet.split(' ');

  test('ARPAbet to Hangul', () => {
    const words: Record<string, [arpabet: string, expected: string]> = {
      cat: ['K AE T', '캣'],
      cats: ['K AE T S', '캣츠'],
      cake: ['K EY K', '케이크'],
      love: ['L AH V', '러브'],
      family: ['F AE M AH0 L IY', '패밀리'],
      memory: ['M EH M ER0 IY', '메모리'],
      power: ['P AW ER0', '파워'],
      cute: ['K Y UW T', '큐트'],
      queen: ['K W IY N', '퀸'],
      sweet: ['S W IY T', '스위트'],
      film: ['F IH L M', '필름'],
      kids: ['K IH D Z', '키즈'],
      here: ['HH IY R', '히어'],
      car: ['K AA R', '카'],
      seventeen: ['S EH V AH0 N T IY N', '세븐틴'],
      today: ['T AH0 D EY', '투데이'],
      beautiful: ['B Y UW T AH0 F AH0 L', '뷰티풀'],
      little: ['L IH T AH0 L', '리틀'],
      people: ['P IY P AH0 L', '피플'],
      open: ['OW P AH0 N', '오픈'],
      moment: ['M OW M AH0 N T', '모먼트'],
      about: ['AH0 B AW T', '어바웃'],
      play: ['P L EY', '플레이'],
      world: ['W ER L D', '월드'],
      music: ['M Y UW Z IH K', '뮤직'],
      computer: ['K AH0 M P Y UW T ER0', '컴퓨터'],
      morning: ['M AO R N IH NG', '모닝'],
      shine: ['SH AY N', '샤인'],
      think: ['TH IH NG K', '싱크'],
      sky: ['S K AY', '스카이'],
    };

    for (const [word, [arpabet, expected]] of Object.entries(words)) {
      expect(arpabetToHangul(word, phones(arpabet)), word).toBe(expected);
    }
  });

  test('lines keep the words the dictionary does not know', () => {
    const dictionary = new Map(
      Object.entries({
        happy: 'HH AE P IY',
        cats: 'K AE T S',
        play: 'P L EY',
        loving: 'L AH V IH NG',
      }),
    );
    const lookup = (word: string) => dictionary.get(word)?.split(' ') ?? null;

    expect(englishLineToHangul('Happy cats play, Pear!', lookup)).toBe(
      '해피 캣츠 플레이, Pear!',
    );
    // lovin' is looked up as loving
    expect(englishLineToHangul("Lovin'", lookup)).toBe('러빙');
    // Common words have their usual spelling
    expect(englishLineToHangul('Hello coffee', lookup)).toBe('헬로 커피');
    // Not a property of Object.prototype
    expect(englishLineToHangul('constructor', lookup)).toBe('constructor');
  });

  test('the pronouncing dictionary', async () => {
    const source = `module.exports = {
  "hello": "HH AH0 L OW1",
  "hello(2)": "HH EH0 L OW1",
  "world": "W ER1 L D",
  "worlds": "W ER1 L D Z",
  "zebra": "Z IY1 B R AH0"
};`;
    const dictionary = await parseDictionary(source, () => Promise.resolve());

    expect(lookupWord(dictionary, 'hello')).toEqual(['HH', 'AH0', 'L', 'OW']);
    expect(lookupWord(dictionary, 'world')).toEqual(['W', 'ER', 'L', 'D']);
    expect(lookupWord(dictionary, 'worlds')).toEqual([
      'W',
      'ER',
      'L',
      'D',
      'Z',
    ]);
    expect(lookupWord(dictionary, 'zebra')).toEqual([
      'Z',
      'IY',
      'B',
      'R',
      'AH0',
    ]);
    expect(lookupWord(dictionary, 'worl')).toBeNull();
    expect(lookupWord(dictionary, 'hello(2)')).toBeNull();
    expect(lookupWord(dictionary, 'aardvark')).toBeNull();
  });
});

test('the song context', () => {
  expect(
    detectPronunciationContext(['東京', 'さよなら', 'Good morning']),
  ).toEqual({ japanese: true, english: true });
  expect(detectPronunciationContext(['你好', '谢谢'])).toEqual({
    japanese: false,
    english: true,
  });
  expect(
    detectPronunciationContext([
      'Buenos días, mi amigo',
      'Vamos a la playa esta tarde',
      'Me gusta mucho la música',
    ]).english,
  ).toBe(false);
});

test('whole lines', async () => {
  const context = { japanese: false, english: false };

  expect(await toKoreanPronunciation('我爱你', context)).toBe('워 아이 니');
  // Hanja in Korean lyrics are read in Korean
  expect(await toKoreanPronunciation('사랑 愛', context)).toBe('사랑 애');
  // Korean stays as it is
  expect(await toKoreanPronunciation('안녕하세요', context)).toBe('안녕하세요');
});
