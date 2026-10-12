import test from "node:test";
import assert from "node:assert/strict";
import { SimpleIMAPService } from "../dist/services/simple-imap-service.js";

// A nested create_folder whose last level the server refuses (a name that is too long) used to leave the parents it
// had just created behind. Parents that already existed, and the Folders/Labels containers, are never touched.

function service({ existing, failWith }) {
  const svc = new SimpleIMAPService({
    smtp: { host: "127.0.0.1", port: 1025, secure: false, username: "o@example.com", password: "x" },
    imap: { host: "127.0.0.1", port: 1143, secure: false, username: "o@example.com", password: "x" },
    dataDir: "/tmp/create-folder-rollback-test", debug: false, runtime: {},
  });
  const server = new Set(existing);
  const deleted = [];
  svc.getFolders = async () => [...server].map((path) => ({ path }));
  svc.mutateFolderWithReconnectCheck = async (action) => {
    if (failWith) {
      // The server made the parents, then refused the folder itself.
      server.add("Folders/a");
      server.add("Folders/a/b");
      throw new Error(failWith);
    }
    return { path: "Folders/a/b/c", created: true };
  };
  svc.deleteFolder = async (path) => { deleted.push(path); server.delete(path); return { path, deleted: true }; };
  return { svc, deleted, server };
}

test("parents created for a folder the server then refused are removed, deepest first", async () => {
  const { svc, deleted, server } = service({ existing: ["INBOX", "Folders"], failWith: "Name too long" });
  await assert.rejects(svc.createFolder("Folders/a/b/c"), /Name too long/);
  assert.deepEqual(deleted, ["Folders/a/b", "Folders/a"]);
  assert.equal(server.has("Folders"), true, "the Folders container is never removed");
});

test("parents that already existed are left alone", async () => {
  const { svc, deleted } = service({ existing: ["INBOX", "Folders", "Folders/a"], failWith: "Name too long" });
  await assert.rejects(svc.createFolder("Folders/a/b/c"), /Name too long/);
  assert.deepEqual(deleted, ["Folders/a/b"], "Folders/a was there before and stays");
});

test("a successful create removes nothing", async () => {
  const { svc, deleted } = service({ existing: ["INBOX", "Folders"] });
  const result = await svc.createFolder("Folders/a/b/c");
  assert.equal(result.created, true);
  assert.deepEqual(deleted, []);
});
