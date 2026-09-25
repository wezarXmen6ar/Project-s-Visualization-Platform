import { Fragment, type ReactNode } from 'react';

/**
 * Fills a translated sentence's `{name}` placeholders with React nodes (links, spans…), so a link can sit anywhere
 * in the sentence and each language keeps its own word order. Pass the text from `t(key)` without those params: `t`
 * leaves an unknown placeholder in place.
 */
export function withNodes(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/\{(\w+)\}/);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part === '' ? null : <Fragment key={i}>{part}</Fragment>;
    return <Fragment key={i}>{part in nodes ? nodes[part] : `{${part}}`}</Fragment>;
  });
}
