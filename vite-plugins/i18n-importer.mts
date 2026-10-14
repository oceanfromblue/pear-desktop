import { readFileSync } from 'node:fs';
import { basename, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'glob';
import { Project } from 'ts-morph';

const __dirname = dirname(fileURLToPath(import.meta.url));
const globalProject = new Project({
  tsConfigFilePath: resolve(__dirname, '..', 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  skipFileDependencyResolution: true,
});

export const i18nImporter = () => {
  const srcPath = resolve(__dirname, '..', 'src');
  const languages = globSync(['src/i18n/resources/*.json']).map((path) => {
    const nameWithExt = basename(path);
    const name = nameWithExt.replace(extname(nameWithExt), '');
    const absolutePath = resolve(srcPath, '..', path);
    const { language } = JSON.parse(readFileSync(absolutePath, 'utf-8')) as {
      language?: { 'name'?: string; 'local-name'?: string };
    };

    return {
      name,
      absolutePath: absolutePath.replace(/\\/g, '/'),
      displayName: language?.name,
      localName: language?.['local-name'],
    };
  });

  const src = globalProject.createSourceFile(
    'vm:i18n',
    (writer) => {
      // Only the metadata of every language is bundled eagerly,
      // the translations themselves are loaded on demand
      writer.writeLine(
        `export const languageNames = ${JSON.stringify(
          Object.fromEntries(
            languages.map(({ name, displayName, localName }) => [
              name,
              { name: displayName, localName },
            ]),
          ),
        )};`,
      );
      writer.blankLine();
      writer.writeLine('const languageLoaders = {');
      for (const { name, absolutePath } of languages) {
        writer.writeLine(
          `  "${name}": () => import('${absolutePath}').then((mod) => mod.default),`,
        );
      }
      writer.writeLine('};');
      writer.blankLine();
      writer.writeLine(
        'export const availableLanguages = Object.keys(languageLoaders);',
      );
      writer.blankLine();
      writer.writeLine(
        'export const loadLanguageResource = async (language) => {',
      );
      writer.writeLine(
        '  if (!Object.hasOwn(languageLoaders, language)) return undefined;',
      );
      writer.writeLine('  return await languageLoaders[language]();');
      writer.writeLine('};');
      writer.blankLine();
    },
    { overwrite: true },
  );

  return src.getText();
};
