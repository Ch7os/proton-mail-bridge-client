import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { buildSchedule, defaultSchedulerSystem, parseTimeOfDay, SCHEDULER_SYSTEMS } from "../dist/utils/schedule-templates.js";

// `schedule` prints the definition that runs `digest` every day. It builds text only; the password is never in it.

const base = { hour: 7, minute: 5, node: "/usr/local/bin/node", script: "/opt/pmbc/dist/cli.js", output: "/home/me/brief.txt", username: "me@proton.me", passwordFile: "/home/me/.bridge-pw" };

test("a time of day is validated", () => {
  assert.deepEqual(parseTimeOfDay("08:00"), { hour: 8, minute: 0 });
  assert.deepEqual(parseTimeOfDay(" 7:05 "), { hour: 7, minute: 5 });
  for (const bad of ["24:00", "12:60", "8", "08:0", "noon", "", "08:00:00"]) assert.throws(() => parseTimeOfDay(bad), /--at must be a time of day/, JSON.stringify(bad));
});

test("each system gets the time, the command, the output file and a way to switch it off", () => {
  for (const system of SCHEDULER_SYSTEMS) {
    const result = buildSchedule({ ...base, system });
    const everything = JSON.stringify(result);
    assert.match(everything, /digest/, system);
    assert.ok(everything.includes("/home/me/brief.txt"), `${system}: output file`);
    assert.ok(everything.includes("/opt/pmbc/dist/cli.js"), `${system}: absolute script path`);
    assert.ok(result.enable.length > 0 && result.disable.length > 0, `${system}: on and off`);
  }
  const launchd = buildSchedule({ ...base, system: "launchd" });
  assert.match(launchd.file.content, /<key>Hour<\/key><integer>7<\/integer>/);
  assert.match(launchd.file.content, /<key>Minute<\/key><integer>5<\/integer>/);
  assert.match(buildSchedule({ ...base, system: "systemd" }).file.content, /OnCalendar=\*-\*-\* 07:05:00/);
  assert.match(buildSchedule({ ...base, system: "cron" }).body, /^5 7 \* \* \*/m);
  assert.match(buildSchedule({ ...base, system: "schtasks" }).enable[0], /\/ST 07:05/);
});

test("the password is only ever a file path, and the username and paths are escaped where they land", () => {
  const hostile = { ...base, output: "/tmp/a&b <c>.txt", username: "o'neil@proton.me", passwordFile: "/home/me/it's here" };
  for (const system of SCHEDULER_SYSTEMS) assert.doesNotMatch(JSON.stringify(buildSchedule({ ...hostile, system })), /PROTONMAIL_PASSWORD=/, system);
  const plist = buildSchedule({ ...hostile, system: "launchd" }).file.content;
  assert.ok(plist.includes("/tmp/a&amp;b &lt;c&gt;.txt"), "xml escaped");
  const cron = buildSchedule({ ...hostile, system: "cron" }).body;
  assert.ok(cron.includes(`'o'\\''neil@proton.me'`), "single quote in a cron word is closed and reopened");
});

test("the default system follows the platform", () => {
  assert.equal(defaultSchedulerSystem("darwin"), "launchd");
  assert.equal(defaultSchedulerSystem("win32"), "schtasks");
  assert.equal(defaultSchedulerSystem("linux"), "systemd");
});

test("the CLI command prints, exits 0, writes nothing of its own and refuses a bad time or system", async () => {
  const run = (args) => new Promise((resolve) => {
    const child = spawn(process.execPath, ["dist/cli.js", "schedule", ...args], { env: { ...process.env, PROTONMAIL_USERNAME: "", PROTONMAIL_PASSWORD: "" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("close", (code) => resolve({ code, out, err }));
  });
  const ok = await run(["--system", "cron", "--at", "06:45"]);
  assert.equal(ok.code, 0, ok.err);
  assert.match(ok.out, /^45 6 \* \* \*/m);
  assert.match(ok.out, /Switch on:/);
  const badTime = await run(["--at", "25:00"]);
  assert.notEqual(badTime.code, 0);
  assert.match(badTime.err, /--at must be a time of day/);
  const badSystem = await run(["--system", "yolo"]);
  assert.equal(badSystem.code, 2);
  assert.match(badSystem.err, /--system must be one of/);
});
