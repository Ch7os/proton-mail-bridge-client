import test from "node:test";
import assert from "node:assert/strict";
import { SimpleIMAPService } from "../dist/services/simple-imap-service.js";

// A malformed message can give a parsed attachment an object or an array where mailparser's types say string.
// The two mappers reduce those once, so what is stored, listed and filtered later is always a string or undefined.

function service() {
  return new SimpleIMAPService({
    smtp: { host: "127.0.0.1", port: 1025, secure: false, username: "o@example.com", password: "x" },
    imap: { host: "127.0.0.1", port: 1143, secure: false, username: "o@example.com", password: "x" },
    dataDir: "/tmp/attachment-header-normalisation-test", debug: false, runtime: {},
  });
}

const odd = {
  filename: { value: "Photo.JPG" },
  contentType: { value: "text/calendar", params: { method: "REQUEST" } },
  contentDisposition: ["inline"],
  cid: { value: "cid-1" },
  size: 12,
  checksum: undefined,
  content: Buffer.from("x"),
  headers: new Map(),
};

test("attachment summaries hold strings even when the parsed values are objects or arrays", () => {
  const [summary] = service().mapParsedAttachments({ attachments: [odd] });
  assert.equal(summary.filename, "Photo.JPG");
  assert.equal(summary.contentType, "text/calendar");
  assert.equal(summary.disposition, "inline");
  assert.equal(summary.isInline, true);
  assert.equal(summary.cid, "cid-1");
  assert.equal(summary.id, "cid-1", "the id falls back to the normalised cid, not to an object");
  assert.equal(summary.isCalendarInvite, true);
  for (const field of ["filename", "contentType", "disposition", "cid", "id"]) assert.equal(typeof summary[field], "string", field);
});

test("the mapper that keeps the content does the same", () => {
  const [summary] = service().mapParsedAttachmentsWithContent({ attachments: [odd] });
  assert.equal(summary.contentType, "text/calendar");
  assert.equal(summary.filename, "Photo.JPG");
  assert.equal(summary.cid, "cid-1");
  assert.equal(summary.isInline, true);
});

test("absent or unusable values become undefined, and ordinary strings are untouched", () => {
  const [empty] = service().mapParsedAttachments({ attachments: [{ filename: 42, contentType: {}, contentDisposition: null, cid: undefined, size: 1, checksum: "abc" }] });
  assert.equal(empty.filename, undefined);
  assert.equal(empty.contentType, undefined);
  assert.equal(empty.disposition, undefined);
  assert.equal(empty.cid, undefined);
  assert.equal(empty.id, "abc");
  assert.equal(empty.isInline, false);

  const [plain] = service().mapParsedAttachments({ attachments: [{ filename: "a.pdf", contentType: "application/pdf", contentDisposition: "attachment", cid: "c", size: 5, checksum: "k" }] });
  assert.deepEqual(
    { filename: plain.filename, contentType: plain.contentType, disposition: plain.disposition, cid: plain.cid, id: plain.id, isInline: plain.isInline },
    { filename: "a.pdf", contentType: "application/pdf", disposition: "attachment", cid: "c", id: "k", isInline: false },
  );
});
