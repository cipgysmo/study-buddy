import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-admin-auth-"));
process.env.DATA_DIR = dir;

import {
  adminCookieValue,
  adminPasswordEnabled,
  checkAdminPassword,
  clearAdminPassword,
  isAdminAuthed,
  setAdminPassword,
} from "@/lib/admin-auth";

beforeAll(() => {
  clearAdminPassword();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("admin auth", () => {
  it("is disabled by default", () => {
    expect(adminPasswordEnabled()).toBe(false);
    expect(isAdminAuthed(undefined)).toBe(true);
  });

  it("protects admin routes once a password is set", () => {
    setAdminPassword("secret");
    expect(adminPasswordEnabled()).toBe(true);
    expect(checkAdminPassword("secret")).toBe(true);
    expect(checkAdminPassword("wrong")).toBe(false);
    expect(isAdminAuthed(undefined)).toBe(false);
    expect(isAdminAuthed(adminCookieValue("secret"))).toBe(true);
  });

  it("can be disabled again", () => {
    clearAdminPassword();
    expect(adminPasswordEnabled()).toBe(false);
    expect(isAdminAuthed(undefined)).toBe(true);
  });
});
