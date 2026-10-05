// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The minimal parser of git config files and the author of a new scenario (RF-STU-01, S11: read
// as files, never with `git config`).
import { describe, expect, it } from "vitest";
import { parseGitConfig, readGitHubUser } from "./git-config.js";

describe("parseGitConfig", () => {
  it("reads sections, subsections and keys as git does", () => {
    const config = parseGitConfig(
      [
        "# global config",
        "[user]",
        "\tname = octo-cat",
        "\temail = octo@example.com ; a comment",
        '[remote "origin"]',
        "\turl = https://example.com/repo.git",
        "[Core]",
        "\tAutoCRLF = false",
        "\tbare",
        "[branch.Main]",
        "\tremote = origin",
      ].join("\n"),
    );
    expect(Object.fromEntries(config)).toEqual({
      "user.name": "octo-cat",
      "user.email": "octo@example.com",
      "remote.origin.url": "https://example.com/repo.git",
      "core.autocrlf": "false",
      "core.bare": "true",
      "branch.main.remote": "origin",
    });
  });

  it("handles quotes, escapes, comments, continuation lines, CRLF and a BOM", () => {
    const config = parseGitConfig(
      "\uFEFF[user]\r\n" +
        '  name = "  Ada  Lovelace # not a comment " # a comment\r\n' +
        '  title = say \\"hi\\"\\tthere\r\n' +
        "  long = first \\\r\n" +
        "    second\r\n" +
        '[section "sub \\"quoted\\""] key = value on the header line\r\n',
    );
    expect(config.get("user.name")).toBe("  Ada  Lovelace # not a comment ");
    expect(config.get("user.title")).toBe('say "hi"\tthere');
    expect(config.get("user.long")).toBe("first     second");
    expect(config.get('section.sub "quoted".key')).toBe("value on the header line");
  });

  it("the last value wins and invalid lines are skipped", () => {
    const config = parseGitConfig(
      [
        "name = outside any section",
        "[user]",
        "name = first",
        "name = second",
        "= no name",
        "1name = starts with a digit",
        'broken = "unclosed',
        "bad = unknown \\q escape",
        "[not closed",
        "name = after a broken header",
      ].join("\n"),
    );
    expect(Object.fromEntries(config)).toEqual({ "user.name": "second" });
  });

  it("does not follow include nor includeIf: they are keys like any other", () => {
    const config = parseGitConfig(
      [
        "[include]",
        "  path = ~/other.gitconfig",
        '[includeIf "gitdir:~/work/"]',
        "  path = ~/work.gitconfig",
      ].join("\n"),
    );
    expect(Object.fromEntries(config)).toEqual({
      "include.path": "~/other.gitconfig",
      "includeif.gitdir:~/work/.path": "~/work.gitconfig",
    });
  });
});

describe("readGitHubUser", () => {
  const files = (contents: Record<string, string>) => {
    const read: string[] = [];
    const readFile = (file: string) => {
      read.push(file);
      const text = contents[file];
      return text === undefined
        ? Promise.reject(Object.assign(new Error("missing"), { code: "ENOENT" }))
        : Promise.resolve(text);
    };
    return { read, readFile };
  };

  it("takes user.name when it is a GitHub user, the repo overriding the global file", async () => {
    const { readFile } = files({
      global: "[user]\n  name = global-user\n",
      repo: "[user]\n  name = repo-user\n",
    });
    expect(await readGitHubUser(readFile, ["global", "repo"])).toBe("repo-user");
    expect(await readGitHubUser(readFile, ["global", "missing"])).toBe("global-user");
  });

  it("prefers github.user, and skips a user.name that is not a GitHub user", async () => {
    const { readFile } = files({
      both: "[user]\n  name = octo-cat\n[github]\n  user = the-handle\n",
      fullName: "[user]\n  name = Ada Lovelace\n",
      fullNameAndHandle: "[user]\n  name = Ada Lovelace\n[github]\n  user = ada\n",
    });
    expect(await readGitHubUser(readFile, ["both"])).toBe("the-handle");
    expect(await readGitHubUser(readFile, ["fullName"])).toBeUndefined();
    expect(await readGitHubUser(readFile, ["fullNameAndHandle"])).toBe("ada");
  });

  it("without user.name, or without files, there is no author", async () => {
    const { readFile } = files({ noUser: "[core]\n  bare = false\n[user]\n  email = a@b.c\n" });
    expect(await readGitHubUser(readFile, ["noUser"])).toBeUndefined();
    expect(await readGitHubUser(readFile, [])).toBeUndefined();
    expect(await readGitHubUser(readFile, ["missing"])).toBeUndefined();
  });

  it("ignores includes: the included file is never read", async () => {
    const { read, readFile } = files({
      global: "[include]\n  path = included\n",
      included: "[user]\n  name = from-include\n",
    });
    expect(await readGitHubUser(readFile, ["global"])).toBeUndefined();
    expect(read).toEqual(["global"]);
  });
});
