// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The author of a new scenario (RF-STU-01): the GitHub user of the local git config, read as a
// file. The server runs no processes (S11), so it does not ask `git config`: a minimal parser of
// the git config syntax reads the global file and the repo's .git/config, in that order, the later
// overriding the earlier as git does. `include` and `includeIf` are not followed: they are
// ignored like any other key.
//
// `authors` holds GitHub users, so the value has to be one: `github.user` (the convention of
// several git tools) if it is set, otherwise `user.name` when it looks like a GitHub user (a full
// name with spaces does not). Without one, `authors` stays empty and the UI asks for it.
import { PersonSchema } from "@blueprint/scenario-schema";

/**
 * Parses a git config file into `section.key` (or `section.subsection.key`) → value. Section and
 * key names are case-insensitive (lowercased), subsections are not, as in git. The last value of a
 * key wins; a key without `=` is a boolean `true`. Lines that do not follow the syntax are skipped.
 */
export const parseGitConfig = (text: string): Map<string, string> => {
  const values = new Map<string, string>();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let section: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    let line = (lines[index] ?? "").trimStart();
    if (line.startsWith("[")) {
      const header = parseHeader(line);
      section = header?.name;
      line = header?.rest.trimStart() ?? "";
    }
    if (line === "" || line.startsWith("#") || line.startsWith(";") || section === undefined) {
      continue;
    }
    const name = /^[A-Za-z][A-Za-z0-9-]*/.exec(line)?.[0];
    if (name === undefined) continue;
    const afterName = line.slice(name.length).trimStart();
    const key = `${section}.${name.toLowerCase()}`;
    if (afterName === "" || afterName.startsWith("#") || afterName.startsWith(";")) {
      values.set(key, "true");
      continue;
    }
    if (!afterName.startsWith("=")) continue;
    const value = parseValue(afterName.slice(1), () => lines[++index]);
    if (value !== undefined) values.set(key, value);
  }
  return values;
};

/** `[section]`, `[section "subsection"]` or the old `[section.subsection]`, and what follows. */
const parseHeader = (line: string): { name: string; rest: string } | undefined => {
  const simple = /^\[([A-Za-z0-9.-]+)\]/.exec(line);
  if (simple?.[1] !== undefined) {
    return { name: simple[1].toLowerCase(), rest: line.slice(simple[0].length) };
  }
  const quoted = /^\[([A-Za-z0-9.-]+)\s+"/.exec(line);
  if (quoted?.[1] === undefined) return undefined;
  let subsection = "";
  for (let i = quoted[0].length; i < line.length; i++) {
    const char = line[i];
    if (char === "\\") {
      // Inside a subsection a backslash escapes any character (and is dropped).
      subsection += line[++i] ?? "";
    } else if (char === '"') {
      if (line[i + 1] !== "]") return undefined;
      return { name: `${quoted[1].toLowerCase()}.${subsection}`, rest: line.slice(i + 2) };
    } else {
      subsection += char;
    }
  }
  return undefined;
};

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", b: "\b", '"': '"', "\\": "\\" };

/**
 * The value after `=`: double quotes keep spaces and comment characters, `#` or `;` outside them
 * start a comment, a backslash escapes (`\n`, `\t`, `\b`, `\"`, `\\`) or, at the end of the line,
 * continues the value on the next one. Whitespace around the value is trimmed. `undefined` for an
 * unknown escape or an unclosed quote, which git rejects.
 */
const parseValue = (start: string, nextLine: () => string | undefined): string | undefined => {
  let line = start;
  let value = "";
  /** Length of `value` up to its last character that is not unquoted whitespace. */
  let kept = 0;
  let quoted = false;
  for (let i = 0; ; i++) {
    if (i >= line.length) {
      if (quoted) return undefined;
      return value.slice(0, kept);
    }
    const char = line[i] ?? "";
    if (char === "\\") {
      if (i === line.length - 1) {
        const next = nextLine();
        if (next === undefined) return value.slice(0, kept);
        line = next;
        i = -1;
        continue;
      }
      const escaped = ESCAPES[line[++i] ?? ""];
      if (escaped === undefined) return undefined;
      value += escaped;
      kept = value.length;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "#" || char === ";")) {
      return value.slice(0, kept);
    } else if (!quoted && /\s/.test(char)) {
      // Leading whitespace is dropped; inner whitespace is kept once something follows it.
      if (value !== "") value += char;
    } else {
      value += char;
      kept = value.length;
    }
  }
};

const isGitHubUser = (value: string | undefined): value is string =>
  value !== undefined && PersonSchema.safeParse({ github: value }).success;

/**
 * The GitHub user of the git config `files` (global first, then the repo's), or `undefined`.
 * A file that is missing or cannot be read is skipped.
 */
export const readGitHubUser = async (
  readFile: (file: string) => Promise<string>,
  files: readonly string[],
): Promise<string | undefined> => {
  const merged = new Map<string, string>();
  for (const file of files) {
    let text: string;
    try {
      text = await readFile(file);
    } catch {
      continue;
    }
    for (const [key, value] of parseGitConfig(text)) merged.set(key, value);
  }
  return [merged.get("github.user"), merged.get("user.name")].find(isGitHubUser);
};
