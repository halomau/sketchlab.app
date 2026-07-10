import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/** GitHub-dark-inspired token colors for canvas painting. */
const THEME: Record<string, string> = {
  default: "#e6edf3",
  comment: "#8b949e",
  keyword: "#ff7b72",
  string: "#a5d6ff",
  number: "#79c0ff",
  literal: "#79c0ff",
  built_in: "#ffa657",
  type: "#ffa657",
  title: "#d2a8ff",
  "title.function": "#d2a8ff",
  "title.class": "#ffa657",
  params: "#e6edf3",
  meta: "#8b949e",
  attr: "#79c0ff",
  attribute: "#79c0ff",
  name: "#7ee787",
  tag: "#7ee787",
  selector: "#7ee787",
  "selector-tag": "#7ee787",
  "selector-class": "#7ee787",
  "selector-id": "#79c0ff",
  variable: "#ffa657",
  "template-variable": "#ffa657",
  regexp: "#a5d6ff",
  symbol: "#79c0ff",
  bullet: "#ffa657",
  code: "#e6edf3",
  formula: "#e6edf3",
  link: "#a5d6ff",
  quote: "#8b949e",
  addition: "#7ee787",
  deletion: "#ffa198",
  section: "#d2a8ff",
  "meta.keyword": "#ff7b72",
  "meta.string": "#a5d6ff",
  "property": "#79c0ff",
  "punctuation": "#e6edf3",
  "operator": "#ff7b72",
};

export interface CodeToken {
  text: string;
  color: string;
}

export interface HighlightedCode {
  language: string;
  tokens: CodeToken[];
}

let registered = false;

function ensureRegistered(): void {
  if (registered) return;
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("go", go);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("shell", bash);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("html", xml);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("sql", sql);
  hljs.registerLanguage("yaml", yaml);
  hljs.registerLanguage("yml", yaml);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("csharp", csharp);
  hljs.registerLanguage("cs", csharp);
  hljs.registerLanguage("ruby", ruby);
  hljs.registerLanguage("php", php);
  hljs.registerLanguage("markdown", markdown);
  hljs.registerLanguage("md", markdown);
  registered = true;
}

function colorForClass(className: string): string {
  if (!className) return THEME.default;
  // hljs emits "hljs-keyword", "hljs-title function_", etc.
  const parts = className
    .split(/\s+/)
    .map((p) => p.replace(/^hljs-/, "").replace(/_+$/, ""))
    .filter(Boolean);
  for (const part of parts) {
    if (THEME[part]) return THEME[part];
  }
  // try compound like "title.function"
  if (parts.length >= 2) {
    const compound = `${parts[0]}.${parts[1]}`;
    if (THEME[compound]) return THEME[compound];
  }
  return THEME.default;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Walk highlight.js HTML into flat colored tokens for canvas drawing. */
export function tokensFromHljsHtml(html: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const stack: string[] = [];
  const re = /<\/?span\b[^>]*>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const chunk = m[0];
    if (chunk.startsWith("</span")) {
      stack.pop();
      continue;
    }
    if (chunk.startsWith("<span")) {
      const cls = /class="([^"]*)"/.exec(chunk)?.[1] ?? "";
      stack.push(cls);
      continue;
    }
    const text = decodeEntities(chunk);
    if (!text) continue;
    const cls = stack[stack.length - 1] ?? "";
    tokens.push({ text, color: colorForClass(cls) });
  }
  return tokens;
}

/**
 * Auto-detect language and return flat colored tokens for the source.
 * Empty / undetectable input becomes plaintext in the default color.
 */
export function highlightCode(source: string): HighlightedCode {
  ensureRegistered();
  if (!source.trim()) {
    return {
      language: "plaintext",
      tokens: source ? [{ text: source, color: THEME.default }] : [],
    };
  }
  try {
    const result = hljs.highlightAuto(source);
    const language = result.language || "plaintext";
    const tokens = tokensFromHljsHtml(result.value);
    if (!tokens.length) {
      return { language, tokens: [{ text: source, color: THEME.default }] };
    }
    return { language, tokens };
  } catch {
    return {
      language: "plaintext",
      tokens: [{ text: source, color: THEME.default }],
    };
  }
}

export const CODE_THEME_DEFAULT = THEME.default;
