import { test } from "node:test";
import assert from "node:assert/strict";
import { isPhoneLogin, normalizeLogin } from "./login";

test("Ghanaian phone numbers in any common form become +233...", () => {
  for (const raw of ["0241234567", "024 123 4567", "024-123-4567", "+233241234567", "233241234567", "+233 24 123 4567", "00233241234567"]) {
    assert.equal(normalizeLogin(raw), "+233241234567", raw);
  }
  assert.equal(isPhoneLogin("+233241234567"), true);
});

test("other international numbers are kept", () => {
  assert.equal(normalizeLogin("+44 7700 900123"), "+447700900123");
});

test("emails are lower-cased; junk is rejected", () => {
  assert.equal(normalizeLogin("  Rep@Example.COM "), "rep@example.com");
  assert.equal(isPhoneLogin("rep@example.com"), false);
  for (const bad of ["", "hello", "024123", "rep@", "12345678901234567", "+23324abc4567"]) {
    assert.equal(normalizeLogin(bad), null, bad);
  }
});
