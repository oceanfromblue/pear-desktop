import type { PluginOption } from 'vite';

// Characters that V8 can't store in a one-byte (Latin-1) string
const NON_LATIN1_REGEX = /[^\x00-\xff]/;
// Astral characters (surrogate pairs) or any other non Latin-1 character
const NON_LATIN1_GLOBAL_REGEX = /[\ud800-\udbff][\udc00-\udfff]|[^\x00-\xff]/g;

const escapeCodeUnits = (text: string) =>
  text.replace(
    /[^\x00-\xff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

type Node = { type?: unknown; [key: string]: unknown };
type Range = [start: number, end: number];

const walk = (node: unknown, visit: (node: Node) => void) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }

  visit(node as Node);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walk(value, visit);
  }
};

/**
 * @returns the ranges of the regular expressions without the `u`/`v` flag
 * (where `\u{...}` escapes aren't supported), or `null` if the code can't be escaped safely
 */
const analyze = (ast: unknown): Range[] | null => {
  const nonUnicodeRegexRanges: Range[] = [];
  let isSafe = true;

  walk(ast, (node) => {
    // The raw text of a tagged template (e.g. String.raw) would change
    if (node.type === 'TaggedTemplateExpression') {
      const { quasi } = node as {
        quasi?: { quasis?: { value?: { raw?: string } }[] };
      };
      if (
        quasi?.quasis?.some((q) => NON_LATIN1_REGEX.test(q.value?.raw ?? ''))
      ) {
        isSafe = false;
      }
    }

    const { regex, start, end } = node as {
      regex?: { flags: string };
      start?: number;
      end?: number;
    };
    if (
      node.type === 'Literal' &&
      regex &&
      !/[uv]/.test(regex.flags) &&
      typeof start === 'number' &&
      typeof end === 'number'
    ) {
      nonUnicodeRegexRanges.push([start, end]);
    }
  });

  return isSafe ? nonUnicodeRegexRanges.sort((a, b) => a[0] - b[0]) : null;
};

const escapeNonLatin1 = (code: string, nonUnicodeRegexRanges: Range[]) => {
  let rangeIndex = 0;

  // `replace` goes through the matches in order, like the sorted ranges
  return code.replace(NON_LATIN1_GLOBAL_REGEX, (char, offset: number) => {
    if (char.length === 1) return escapeCodeUnits(char);

    while (
      rangeIndex < nonUnicodeRegexRanges.length &&
      nonUnicodeRegexRanges[rangeIndex][1] <= offset
    ) {
      rangeIndex++;
    }
    const range = nonUnicodeRegexRanges[rangeIndex];
    const isInNonUnicodeRegex = range && range[0] <= offset;

    // Surrogate pairs are only valid in strings and regular expressions, `\u{...}` everywhere else
    return isInNonUnicodeRegex
      ? escapeCodeUnits(char)
      : `\\u{${char.codePointAt(0)!.toString(16)}}`;
  });
};

/**
 * Escapes every non Latin-1 character of the output.
 *
 * The renderer bundle is injected into the page as a script, and V8 keeps the
 * source of every script in memory: a single character above U+00FF makes it store
 * the whole (multi MB) source as a two-byte string. Escaping them halves its size.
 */
export default function latin1Output(): PluginOption {
  return {
    name: 'latin1-output',
    apply: 'build',
    // After the minification (the minifier prints the characters as is)
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !NON_LATIN1_REGEX.test(chunk.code)) {
          continue;
        }

        // An escape sequence before such a character would change meaning
        const nonUnicodeRegexRanges = /\\[^\x00-\xff]/.test(chunk.code)
          ? null
          : analyze(this.parse(chunk.code));
        if (!nonUnicodeRegexRanges) {
          this.warn(
            `${chunk.fileName} kept as is: it cannot be escaped safely`,
          );
          continue;
        }

        const escaped = escapeNonLatin1(chunk.code, nonUnicodeRegexRanges);

        try {
          this.parse(escaped);
        } catch {
          this.warn(
            `${chunk.fileName} kept as is: the escaped code is not valid`,
          );
          continue;
        }

        // NOTE: this shifts the columns, so it's only used without source maps
        chunk.code = escaped;
      }
    },
  };
}
