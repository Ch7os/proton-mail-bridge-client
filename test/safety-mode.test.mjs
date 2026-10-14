import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigFromEnv } from "../dist/index.js";
import { ensureDestructiveConfirmed, ensureEmailActionAllowed, ensureMailboxWriteAllowed, ensureSendAllowed, sanitizeRuntimeConfig } from "../dist/utils/runtime-policy.js";

// PROTONMAIL_MODE is one switch for the safety flags. It sets where they start; a flag set explicitly still wins.

const FLAGS = ["PROTONMAIL_MODE", "PROTONMAIL_READ_ONLY", "PROTONMAIL_ALLOW_SEND", "PROTONMAIL_ALLOWED_ACTIONS", "PROTONMAIL_CONFIRM_DESTRUCTIVE"];

function withEnv(env, fn) {
  const saved = Object.fromEntries(["PROTONMAIL_USERNAME", "PROTONMAIL_PASSWORD", ...FLAGS].map((key) => [key, process.env[key]]));
  for (const key of FLAGS) delete process.env[key];
  process.env.PROTONMAIL_USERNAME = "owner@example.com";
  process.env.PROTONMAIL_PASSWORD = "x";
  Object.assign(process.env, env);
  try { return fn(buildConfigFromEnv().runtime); } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
const refuses = (fn) => assert.throws(fn, Error);

test("no mode: nothing changes", () => {
  withEnv({}, (runtime) => {
    assert.equal(runtime.mode, undefined);
    assert.equal(runtime.readOnly, false);
    assert.equal(runtime.allowSend, true);
    assert.equal(runtime.confirmDestructive, false);
    assert.equal(runtime.allowedActions.includes("delete"), true);
  });
});

test("read-only: nothing is written and nothing is sent", () => {
  withEnv({ PROTONMAIL_MODE: "read-only" }, (runtime) => {
    assert.equal(runtime.mode, "read-only");
    refuses(() => ensureSendAllowed(runtime));
    refuses(() => ensureMailboxWriteAllowed(runtime));
    refuses(() => ensureEmailActionAllowed(runtime, "mark_read"));
  });
});

test("drafts: flags yes; sending, archiving, trashing and deleting no", () => {
  withEnv({ PROTONMAIL_MODE: "drafts" }, (runtime) => {
    refuses(() => ensureSendAllowed(runtime));
    for (const action of ["archive", "trash", "move", "restore", "delete"]) refuses(() => ensureEmailActionAllowed(runtime, action));
    for (const action of ["mark_read", "mark_unread", "star", "unstar"]) ensureEmailActionAllowed(runtime, action);
  });
});

test("assisted: everything but permanent deletion, and a send or delete needs confirmed:true", () => {
  withEnv({ PROTONMAIL_MODE: "assisted" }, (runtime) => {
    ensureSendAllowed(runtime);
    ensureEmailActionAllowed(runtime, "archive");
    ensureEmailActionAllowed(runtime, "trash");
    refuses(() => ensureEmailActionAllowed(runtime, "delete"));
    refuses(() => ensureDestructiveConfirmed(runtime, false, "send"));
    ensureDestructiveConfirmed(runtime, true, "send");
  });
});

test("full is the default behaviour", () => {
  withEnv({ PROTONMAIL_MODE: "full" }, (runtime) => {
    ensureSendAllowed(runtime);
    ensureEmailActionAllowed(runtime, "delete");
    ensureDestructiveConfirmed(runtime, false, "send");
  });
});

test("a flag set explicitly wins over the mode", () => {
  withEnv({ PROTONMAIL_MODE: "assisted", PROTONMAIL_CONFIRM_DESTRUCTIVE: "false", PROTONMAIL_ALLOWED_ACTIONS: "mark_read,delete" }, (runtime) => {
    assert.equal(runtime.confirmDestructive, false);
    assert.deepEqual(runtime.allowedActions, ["mark_read", "delete"]);
  });
  withEnv({ PROTONMAIL_MODE: "drafts", PROTONMAIL_ALLOW_SEND: "true" }, (runtime) => {
    ensureSendAllowed(runtime);
  });
});

test("an unknown mode is an error that lists the valid ones, and the case does not matter", () => {
  assert.throws(() => withEnv({ PROTONMAIL_MODE: "yolo" }, () => {}), /read-only, drafts, assisted, full/);
  assert.throws(() => withEnv({ PROTONMAIL_MODE: "constructor" }, () => {}), /must be one of/);
  withEnv({ PROTONMAIL_MODE: " Read-Only " }, (runtime) => assert.equal(runtime.mode, "read-only"));
});

test("the mode in force is part of the runtime status", () => {
  withEnv({ PROTONMAIL_MODE: "assisted" }, (runtime) => assert.equal(sanitizeRuntimeConfig(runtime).mode, "assisted"));
  withEnv({}, (runtime) => assert.equal(sanitizeRuntimeConfig(runtime).mode, null));
});
