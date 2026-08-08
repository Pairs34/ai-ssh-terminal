import test from "node:test";
import assert from "node:assert/strict";
import { toUserFacingError } from "../src/lib/errors";

test("Electron IPC hata sarmalayıcısı kullanıcı mesajından çıkarılır", () => {
  const error = new Error("Error invoking remote method 'ai:ask': Error: Güvenlik kontrolünden geçemedi.");
  assert.equal(toUserFacingError(error), "Güvenlik kontrolünden geçemedi.");
});

