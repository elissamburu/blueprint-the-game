// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The inline subset of markdown that scenario texts use (`context`, `rationale`): **bold**,
// *italic*, `code` and [links](https://…). It builds React elements, never HTML, so a scenario
// cannot inject markup; anything else stays as written.
import { Fragment, type ReactNode } from "react";

const TOKEN =
  /\*\*([^*]+)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;

export const renderInlineMarkdown = (text: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, bold, italic, code, label, href] = match;
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = match.index;
    if (bold !== undefined) out.push(<strong key={key}>{bold}</strong>);
    else if (italic !== undefined) out.push(<em key={key}>{italic}</em>);
    else if (code !== undefined) out.push(<code key={key}>{code}</code>);
    else if (label !== undefined && href !== undefined) {
      out.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {label}
        </a>,
      );
    }
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

export function InlineMarkdown({ text }: { text: string }) {
  return <Fragment>{renderInlineMarkdown(text)}</Fragment>;
}
