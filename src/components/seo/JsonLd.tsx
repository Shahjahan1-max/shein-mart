/**
 * JSON-LD structured-data injection component.
 * Renders one or more <script type="application/ld+json"> tags into <head>
 * via a portal so crawlers see valid structured data regardless of position
 * in the component tree.
 */

import { createPortal } from "react-dom";
import { useMemo } from "react";
import type { JsonLdNode } from "../../lib/seo/jsonld";

export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const markup = useMemo(() => {
    const nodes = Array.isArray(data) ? data : [data];
    return nodes
      .filter(Boolean)
      .map(node => JSON.stringify(node))
      .join("\n");
  }, [data]);

  const script = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: markup }} />;
  return typeof document !== "undefined" ? createPortal(script, document.head) : null;
}
