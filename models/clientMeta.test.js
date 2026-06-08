import { describe, it, expect } from "vitest";
import Permission from "./Permission.js";
import PermissionArchive from "./PermissionArchive.js";

const META_FIELDS = [
  "ip",
  "ua",
  "sid",
  "acceptLanguage",
  "referer",
  "origin",
  "forwardedFor",
  "realIp",
  "cfIp",
  "cfCountry",
  "secChUa",
  "secChUaPlatform",
  "secChUaMobile",
  "dnt",
];

const metaPaths = (model) =>
  Object.keys(model.schema.path("meta").schema.paths).sort();

describe("client meta sub-schema", () => {
  it("Permission.meta exposes exactly the expected fields", () => {
    expect(metaPaths(Permission)).toEqual([...META_FIELDS].sort());
  });

  it("Permission and PermissionArchive share an identical meta shape", () => {
    expect(metaPaths(Permission)).toEqual(metaPaths(PermissionArchive));
  });
});
