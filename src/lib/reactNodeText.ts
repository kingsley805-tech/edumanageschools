import { isValidElement, type ReactNode } from "react";

/** Plain text extracted from React children (for Radix menu/select typeahead). */
export function textFromReactNode(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join(" ").replace(/\s+/g, " ").trim();
  if (isValidElement(node)) return textFromReactNode(node.props.children);
  return "";
}
