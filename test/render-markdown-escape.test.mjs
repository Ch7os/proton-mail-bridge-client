import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../dist/utils/helpers.js";

// escHtml left quotes alone and only the link handler escaped a quote in the URL. Every piece of text that can end up
// inside an attribute now goes through the same escape, so a new attribute context cannot reopen the hole.

const attributes = (html) => [...html.matchAll(/<a href="([^"]*)">/g)].map((match) => match[1]);

test("a quote in a link cannot close the href or add an attribute", () => {
  for (const markdown of [
    '[x](https://example.com/a"onmouseover="alert(1))',
    '[x](https://example.com/a" onclick="x)',
    "[x](https://example.com/a' onfocus='x)",
    '[a"b](https://example.com/?q="x")',
  ]) {
    const { html } = renderMarkdown(markdown);
    // The whole opening tag is `<a href="…">` with nothing after the href: no second attribute can exist.
    const tags = html.match(/<a\b[^>]*>/g) ?? [];
    assert.ok(tags.length >= 1, `the link is still rendered: ${markdown}`);
    for (const tag of tags) assert.match(tag, /^<a href="[^"]*">$/, `unexpected attributes in ${tag}`);
    for (const href of attributes(html)) assert.doesNotMatch(href, /["']/, `a raw quote in the href of ${markdown}`);
  }
});

test("quotes and ampersands in ordinary text are entities, not markup", () => {
  const { html } = renderMarkdown("He said \"hi\" & it's <b>fine</b>");
  assert.equal(html, "<p>He said &quot;hi&quot; &amp; it&#39;s &lt;b&gt;fine&lt;/b&gt;</p>");
});

test("legitimate output is unchanged: emphasis, a link with a query string, code", () => {
  const { html } = renderMarkdown("**bold** [site](https://example.com/?a=1&b=2) `x < y`");
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=2">site<\/a>/);
  assert.match(html, /<code>x &lt; y<\/code>/);
});
