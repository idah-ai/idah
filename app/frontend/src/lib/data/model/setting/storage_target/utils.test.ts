// ---------------------------------------------------------------------------
// utils.test.ts — storage target payloads and messages
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  connectionErrorMessage,
  connectionErrorMessages,
  maskedSecret,
  normalizePrefix,
  projectStorageLabel,
  secretRequiredForUpdate,
  storageTargetCreateAttributes,
  storageTargetIdFromChoice,
  storageTargetLocation,
  storageTargetSaveErrorMessage,
  storageTargetUpdateAttributes,
} from "./utils";

const draft = {
  name: "  Acme bucket ",
  endpoint: " https://s3.example.com ",
  region: "",
  bucket: "acme-bucket",
  prefix: "/idah/files/",
  path_style: true,
  access_key_id: "AKIAEXAMPLE",
  secret_access_key: " secret-1234 ",
  organization_ids: ["3", 7, "3", "x"],
  enabled: true,
};

describe("connectionErrorMessage", () => {
  it("explains each code the backend sends", () => {
    expect(connectionErrorMessage("access_denied")).toBe(connectionErrorMessages.access_denied);
    expect(connectionErrorMessage("https_required")).toBe("The endpoint must use https.");
  });

  it("falls back to the generic failure for an unknown code", () => {
    expect(connectionErrorMessage("teapot")).toBe(connectionErrorMessages.connection_failed);
  });

  it("is empty without a code", () => {
    expect(connectionErrorMessage(null)).toBe("");
  });
});

describe("storageTargetSaveErrorMessage", () => {
  it("explains a failed connection test", () => {
    const error = { status: 422, errors: [{ detail: "connection test failed: bucket_not_found" }] };

    expect(storageTargetSaveErrorMessage(error)).toBe(connectionErrorMessages.bucket_not_found);
  });

  it("shows the backend's message for other refusals", () => {
    const error = { status: 422, errors: [{ detail: "disable the target before archiving it" }] };

    expect(storageTargetSaveErrorMessage(error)).toBe("disable the target before archiving it");
  });

  it("has a fallback when there is no message", () => {
    expect(storageTargetSaveErrorMessage(new Error("network"))).toMatch(/couldn't be saved/);
  });
});

describe("normalizePrefix", () => {
  it("drops slashes at either end and spaces", () => {
    expect(normalizePrefix(" //idah/files// ")).toBe("idah/files");
    expect(normalizePrefix(null)).toBe("");
  });
});

describe("storageTargetCreateAttributes", () => {
  it("trims the values, cleans the prefix and keeps valid organization ids once", () => {
    expect(storageTargetCreateAttributes(draft)).toEqual({
      name: "Acme bucket",
      endpoint: "https://s3.example.com",
      region: null,
      bucket: "acme-bucket",
      prefix: "idah/files",
      path_style: true,
      access_key_id: "AKIAEXAMPLE",
      secret_access_key: "secret-1234",
      organization_ids: [3, 7],
      enabled: true,
    });
  });
});

describe("storageTargetUpdateAttributes", () => {
  it("never sends the location, which can't change", () => {
    const attributes = storageTargetUpdateAttributes(draft);

    expect(attributes).not.toHaveProperty("endpoint");
    expect(attributes).not.toHaveProperty("bucket");
    expect(attributes).not.toHaveProperty("prefix");
    expect(attributes).not.toHaveProperty("region");
  });

  it("sends the addressing, which can change", () => {
    expect(storageTargetUpdateAttributes(draft).path_style).toBe(true);
  });

  it("sends a new secret", () => {
    expect(storageTargetUpdateAttributes(draft).secret_access_key).toBe("secret-1234");
  });

  it("leaves an empty secret out, which keeps the stored one", () => {
    expect(storageTargetUpdateAttributes({ ...draft, secret_access_key: "  " })).not.toHaveProperty(
      "secret_access_key",
    );
  });
});

describe("secretRequiredForUpdate", () => {
  it("asks for the secret that goes with a new access key id", () => {
    expect(
      secretRequiredForUpdate({ access_key_id: "AKIANEW", secret_access_key: "" }, { access_key_id: "AKIAOLD" }),
    ).toBe(true);
  });

  it("doesn't when the key id is unchanged or the secret is given", () => {
    expect(secretRequiredForUpdate({ access_key_id: "AKIAOLD" }, { access_key_id: "AKIAOLD" })).toBe(false);
    expect(
      secretRequiredForUpdate({ access_key_id: "AKIANEW", secret_access_key: "s" }, { access_key_id: "AKIAOLD" }),
    ).toBe(false);
  });
});

describe("storageTargetLocation", () => {
  it("joins the bucket and the prefix", () => {
    expect(storageTargetLocation({ bucket: "acme-bucket", prefix: "/idah/" })).toBe("acme-bucket/idah");
    expect(storageTargetLocation({ bucket: "acme-bucket", prefix: "" })).toBe("acme-bucket");
  });
});

describe("maskedSecret", () => {
  it("shows only the last characters", () => {
    expect(maskedSecret("1a2b")).toBe("••••1a2b");
    expect(maskedSecret(null)).toBe("••••");
  });
});

describe("projectStorageLabel", () => {
  it("names the target and its bucket", () => {
    expect(projectStorageLabel({ id: "t", name: "Acme bucket", bucket: "acme-bucket" })).toBe(
      "Acme bucket (acme-bucket)",
    );
  });

  it("says when the project uses the platform default", () => {
    expect(projectStorageLabel(null)).toBe("Default platform storage");
  });

  it("says when the target was archived", () => {
    expect(projectStorageLabel({ id: "t", archived: true })).toBe("An archived storage target");
  });
});

describe("storageTargetIdFromChoice", () => {
  it("sends no target for the default choice", () => {
    expect(storageTargetIdFromChoice("default")).toBeNull();
    expect(storageTargetIdFromChoice(null)).toBeNull();
  });

  it("sends the chosen target's id", () => {
    expect(storageTargetIdFromChoice("0194f5a2")).toBe("0194f5a2");
  });
});
