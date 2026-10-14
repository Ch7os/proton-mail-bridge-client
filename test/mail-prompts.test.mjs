import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/index.js";
import { slugifyAccountAddress } from "../dist/utils/helpers.js";
import { closeTrackedIndexes } from "./helpers/close-indexes.mjs";


function accountConfig(dataDir, address) {
  return {
    address, slug: slugifyAccountAddress(address),
    imap: { host: "127.0.0.1", port: 9, secure: false, username: address, password: "x" },
    smtp: { host: "127.0.0.1", port: 9, secure: false, username: address, password: "x" },
    dataDir,
  };
}

async function withServer(addresses, fn) {
  const dirs = await Promise.all(addresses.map(() => mkdtemp(join(tmpdir(), "folder-account-"))));
  const accounts = addresses.map((address, i) => accountConfig(dirs[i], address));
  const config = {
    smtp: accounts[0].smtp, imap: accounts[0].imap, dataDir: dirs[0], debug: false, cacheEnabled: true,
    analyticsEnabled: true, autoSync: false, syncInterval: 5,
    runtime: { readOnly: false, allowSend: true, allowRemoteDraftSync: true, allowedActions: ["delete"], startupSync: false,
      autoSyncFolder: "INBOX", autoSyncFull: false, autoSyncLimitPerFolder: 25, idleWatchEnabled: false, idleMaxSeconds: 30,
      confirmDestructive: false, allowEmptyFolder: true, restrictOutboundToSelf: false, maxInlineBytes: 40960, opDelayMs: 0 },
    accounts,
  };
  const { server, accountManager } = createServer(config, { startBackgroundSync: false });
  const bundles = accountManager.all();
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  try { await fn({ client, bundles }); } finally {
    await client.close(); await server.close(); await closeTrackedIndexes();
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })));
  }
}



// The server offers ready-made workflows as MCP prompts. Each only instructs the assistant; each names tools that
// exist; each says to ask before sending or changing anything.

import { MAIL_PROMPTS } from "../dist/utils/mail-prompts.js";

test("the server declares prompts and lists every workflow", async () => {
  await withServer(["owner@example.com"], async ({ client }) => {
    assert.ok(client.getServerCapabilities()?.prompts, "prompts capability missing");
    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map((prompt) => prompt.name).sort(), MAIL_PROMPTS.map((prompt) => prompt.name).sort());
    assert.ok(prompts.length >= 6);
    for (const prompt of prompts) assert.ok(prompt.description, `${prompt.name} has no description`);
  });
});

test("every prompt names only tools that exist, mentions them, and asks before changing anything", async () => {
  await withServer(["owner@example.com"], async ({ client }) => {
    const { tools } = await client.listTools();
    const known = new Set(tools.map((tool) => tool.name));
    for (const prompt of MAIL_PROMPTS) {
      const args = Object.fromEntries((prompt.arguments ?? []).filter((a) => a.required).map((a) => [a.name, "Anna"]));
      const result = await client.getPrompt({ name: prompt.name, arguments: args });
      const text = result.messages.map((message) => message.content.text).join("\n");
      for (const tool of prompt.tools) {
        assert.ok(known.has(tool), `${prompt.name} names ${tool}, which is not a tool`);
        assert.ok(text.includes(tool), `${prompt.name} does not mention ${tool}`);
      }
      assert.match(text, /without asking me first/, `${prompt.name} does not ask first`);
    }
  });
});

test("a required argument is checked and used; an unknown prompt is an error that lists the valid ones", async () => {
  await withServer(["owner@example.com"], async ({ client }) => {
    await assert.rejects(client.getPrompt({ name: "prepare-for-meeting", arguments: {} }), /needs the argument "who"/);
    await assert.rejects(client.getPrompt({ name: "prepare-for-meeting", arguments: { who: "   " } }), /needs the argument/);
    const ok = await client.getPrompt({ name: "prepare-for-meeting", arguments: { who: "anna@example.com" } });
    assert.match(ok.messages[0].content.text, /anna@example\.com/);
    await assert.rejects(client.getPrompt({ name: "nope" }), /Unknown prompt "nope"\. Available: morning-brief/);
  });
});
