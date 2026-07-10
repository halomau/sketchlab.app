import { describe, expect, it } from "vitest";
import { highlightCode, tokensFromHljsHtml } from "../src/render/codeHighlight";

describe("highlightCode", () => {
  it("returns plaintext for empty input", () => {
    const result = highlightCode("");
    expect(result.language).toBe("plaintext");
    expect(result.tokens).toEqual([]);
  });

  it("returns plaintext tokens for whitespace-only input", () => {
    const result = highlightCode("   \n  ");
    expect(result.language).toBe("plaintext");
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.tokens.every((t) => t.color)).toBe(true);
  });

  it("highlights a JS-like function with non-empty tokens", () => {
    const src = "function foo() {\n  return 42;\n}";
    const result = highlightCode(src);
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.tokens.some((t) => /function|foo|return|42/.test(t.text))).toBe(true);
    expect(["javascript", "typescript", "java", "php"].includes(result.language)).toBe(true);
  });

  it("detects python-ish snippets", () => {
    const src = "def greet(name):\n    print(f'hello {name}')\n";
    const result = highlightCode(src);
    expect(result.language).toBe("python");
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it("round-trips source text through tokens", () => {
    const src = "const x = 1;\n";
    const result = highlightCode(src);
    const joined = result.tokens.map((t) => t.text).join("");
    expect(joined).toBe(src);
  });
});

describe("tokensFromHljsHtml", () => {
  it("parses nested spans into colored tokens", () => {
    const html =
      '<span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>;';
    const tokens = tokensFromHljsHtml(html);
    expect(tokens.map((t) => t.text).join("")).toBe("const x = 1;");
    expect(tokens[0].text).toBe("const");
    expect(tokens[0].color).not.toBe(tokens[1].color);
  });

  it("decodes HTML entities", () => {
    const tokens = tokensFromHljsHtml("&lt;div&gt;");
    expect(tokens).toEqual([{ text: "<div>", color: expect.any(String) }]);
  });
});
