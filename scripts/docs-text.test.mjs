import assert from "node:assert/strict";
import { test } from "node:test";
import { plainText, scriptJson } from "./docs-text.mjs";

test("FAQ extraction preserves inline text, Unicode and single entity decoding", () => {
  assert.equal(plainText('<code>âm lịch</code>\n<strong>🧑‍💻</strong> &amp;lt;title&amp;gt; &nbsp; &quot;x&quot; &#39;y&#39;'), 'âm lịch 🧑‍💻 &lt;title&gt; "x" \'y\'');
  assert.equal(plainText("3 > 2"), "3 > 2");
  assert.equal(plainText("2 &lt; 3 &amp; 4 &gt; 1"), "2 < 3 & 4 > 1");
});
test("nested, repeated and incomplete tag delimiters cannot survive removal", () => {
  for (const input of ["<<script>>", "<scr<script>ipt>", "<<<img src=x onerror=x>>>", "<script", "<><><>"]) {
    assert.equal(plainText(input), "");
  }
  assert.equal(plainText("before <<tag>nested> after"), "before after");
  assert.equal(plainText("safe <unfinished"), "safe");
  assert.equal(plainText("<".repeat(200_000) + "x" + ">".repeat(200_000)), "");
  assert.equal(plainText("<".repeat(200_000)), "");
});
test("JSON-LD encoding prevents script termination even after entity decoding", () => {
  const value = { text: plainText("Literal &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;") };
  const json = scriptJson(value);
  assert.ok(!json.includes("<"));
  assert.deepEqual(JSON.parse(json), value);
});
