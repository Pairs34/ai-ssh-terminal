import test from "node:test";
import assert from "node:assert/strict";
import { buildVisibleExecutionCommand, parseVisibleExecutionOutput } from "../electron/main/ssh/visibleExecution";

test("görünür SSH komutu hedef komutu bir kez çalıştırıp exit code işareti üretir", () => {
  const marker = "__AI_SSH_DONE_TEST__";
  const wireCommand = buildVisibleExecutionCommand("test -w /mnt/backup && echo WRITABLE", marker);

  assert.match(wireCommand, /^\( test -w \/mnt\/backup && echo WRITABLE \)/);
  assert.match(wireCommand, /printf/);
  assert.equal((wireCommand.match(/test -w/g) || []).length, 1);
});

test("terminal çıktısındaki gerçek bitiş işareti ayrıştırılır, komut echo'sundaki placeholder sayılmaz", () => {
  const marker = "__AI_SSH_DONE_TEST__";
  const output = `( echo ok ); printf '${marker}:%s\\n' "$?"\r\nok\r\n${marker}:0\r\nroot@host:~# `;
  const parsed = parseVisibleExecutionOutput(output, marker);

  assert.equal(parsed.complete, true);
  assert.equal(parsed.exitCode, 0);
  assert.match(parsed.output, /ok/);
  assert.doesNotMatch(parsed.output, new RegExp(`${marker}:0`));
});

test("bitiş işareti gelmeden komut tamamlanmış sayılmaz", () => {
  const parsed = parseVisibleExecutionOutput("uzun işlem sürüyor...", "__AI_SSH_DONE_TEST__");
  assert.deepEqual(parsed, { complete: false, exitCode: null, output: "uzun işlem sürüyor..." });
});
