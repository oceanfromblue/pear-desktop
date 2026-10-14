// The CMU pronouncing dictionary (134k words, ~4.7 MB) is fetched the first time
// an English line needs it, like the Japanese dictionary, rather than bundled:
// the renderer bundle stays in memory for the app's whole life.
const DICTIONARY_URL =
  'https://cdn.jsdelivr.net/npm/cmu-pronouncing-dictionary@3.0.0/index.js';
const RETRY_AFTER_MS = 10 * 60 * 1000;

// Each phoneme is stored as one character (stress dropped, except for the
// reduced AH0/ER0), which keeps the whole dictionary in a ~2 MB string
const PHONES = [
  'AA',
  'AE',
  'AH',
  'AH0',
  'AO',
  'AW',
  'AY',
  'B',
  'CH',
  'D',
  'DH',
  'EH',
  'ER',
  'ER0',
  'EY',
  'F',
  'G',
  'HH',
  'IH',
  'IY',
  'JH',
  'K',
  'L',
  'M',
  'N',
  'NG',
  'OW',
  'OY',
  'P',
  'R',
  'S',
  'SH',
  'T',
  'TH',
  'UH',
  'UW',
  'V',
  'W',
  'Y',
  'Z',
  'ZH',
];
const CODE_BASE = 0x41;
/** `AH1` -> the code of AH, `AH0` -> the code of AH0 */
const codeOf = new Map<string, string>();
for (const [index, phone] of PHONES.entries()) {
  const code = String.fromCharCode(CODE_BASE + index);
  codeOf.set(phone, code);
  if (phone.endsWith('0')) continue;
  for (const stress of ['0', '1', '2']) {
    if (!codeOf.has(phone + stress)) codeOf.set(phone + stress, code);
  }
}
const TAB = 9;
// Parsing all the words takes a few hundred ms: done in slices so that the
// page (and the lyrics' animations) don't freeze meanwhile
const ENTRIES_PER_SLICE = 10000;

export interface Dictionary {
  /** `word\tphonemes` entries sorted by word, one per line */
  blob: string;
  /** Where each entry starts in `blob` */
  offsets: Uint32Array;
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const parseDictionary = async (
  source: string,
  yieldToPage = nextTask,
): Promise<Dictionary> => {
  const entries: string[] = [];
  // `  "word": "W ER1 D",`, alternative pronunciations ("word(2)") are skipped
  const entryRegex = /^\s*"([^"(]+)": "([^"]+)",?$/gm;

  for (let match; (match = entryRegex.exec(source)); ) {
    let phones = '';
    for (const phone of match[2].split(' ')) phones += codeOf.get(phone) ?? '';
    entries.push(`${match[1]}\t${phones}`);

    if (entries.length % ENTRIES_PER_SLICE === 0) await yieldToPage();
  }
  // `\t` sorts before every letter, so this sorts by word
  entries.sort();

  const offsets = new Uint32Array(entries.length);
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    offsets[index] = offset;
    offset += entry.length + 1;
  }

  return { blob: entries.join('\n'), offsets };
};

/** Compares the word of the entry at `start` with `word` */
const compareAt = (blob: string, start: number, word: string) => {
  for (let index = 0; ; index++) {
    const entryEnded = blob.charCodeAt(start + index) === TAB;
    const wordEnded = index === word.length;
    if (entryEnded || wordEnded) {
      if (entryEnded && wordEnded) return 0;
      return entryEnded ? -1 : 1;
    }

    const delta = blob.charCodeAt(start + index) - word.charCodeAt(index);
    if (delta !== 0) return delta;
  }
};

export const lookupWord = (
  { blob, offsets }: Dictionary,
  word: string,
): string[] | null => {
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const middle = (low + high) >>> 1;
    const start = offsets[middle];
    const comparison = compareAt(blob, start, word);

    if (comparison === 0) {
      const phonesStart = start + word.length + 1;
      const end = blob.indexOf('\n', phonesStart);
      return Array.from(
        blob.slice(phonesStart, end === -1 ? undefined : end),
        (code) => PHONES[code.charCodeAt(0) - CODE_BASE],
      );
    }
    if (comparison < 0) low = middle + 1;
    else high = middle - 1;
  }

  return null;
};

let dictionary: Promise<Dictionary | null> | undefined;
let failedAt = 0;

const loadDictionary = async (): Promise<Dictionary | null> => {
  try {
    const response = await fetch(DICTIONARY_URL, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await parseDictionary(await response.text());
  } catch (error) {
    console.warn(
      '[synced-lyrics] could not load the English dictionary',
      error,
    );
    failedAt = Date.now();
    dictionary = undefined;
    return null;
  }
};

/** The dictionary, or `null` while it can't be downloaded */
export const getEnglishDictionary = () => {
  if (!dictionary && Date.now() - failedAt < RETRY_AFTER_MS) {
    return Promise.resolve(null);
  }
  dictionary ??= loadDictionary();
  return dictionary;
};
