// ---------------------------------------------------------------------------
// utils.test.ts — what the audit log page shows for a log's resource
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { LogRecord } from "./record";
import { getLogResourceDetails } from "./utils";
import { StorageTargetRecord } from "@/data/model/setting/storage_target/record";

function log(resource_type: string, resource_id: string): LogRecord {
  return new LogRecord({
    type: LogRecord.type,
    id: "1",
    attributes: { action: "updated", resource_type, resource_id },
  });
}

const empty = {
  accounts: [],
  organizations: [],
  projects: [],
  projectMembers: [],
  datasets: [],
  entries: [],
  medias: [],
  exports: [],
};

describe("getLogResourceDetails", () => {
  it("names a storage target and links to it", () => {
    const target = new StorageTargetRecord({
      type: StorageTargetRecord.type,
      id: "0194f5a2-0001",
      attributes: { name: "Acme bucket" },
    });

    const details = getLogResourceDetails(log("storage_targets", "0194f5a2-0001"), {
      ...empty,
      storageTargets: [target],
    });

    expect(details.storage_targets.name).toBe("Acme bucket");
    expect(details.storage_targets.url).toBe("/storage-targets?filters[name__match]=Acme%20bucket");
  });

  it("leaves an archived storage target unnamed, so its row shows the id", () => {
    const details = getLogResourceDetails(log("storage_targets", "0194f5a2-0002"), empty);

    expect(details.storage_targets.name).toBeUndefined();
    expect(details.storage_targets.url).toBe("/storage-targets");
  });

  it("gives a resource type it doesn't know an entry instead of nothing", () => {
    const details = getLogResourceDetails(log("future_things", "42"), empty);

    expect(details.future_things).toEqual({ ids: [], url: "", name: undefined });
  });
});

describe("getLogResourceDetails organizations", () => {
  it("links an organization to its projects page, as it has no page of its own", () => {
    const details = getLogResourceDetails(log("organizations", "13"), empty);

    expect(details.organizations.url).toBe("/organizations/13/projects");
  });

  it("links a deleted organization to the organizations list", () => {
    const deleted = new LogRecord({
      type: LogRecord.type,
      id: "2",
      attributes: { action: "deleted", resource_type: "organizations", resource_id: "13" },
    });

    expect(getLogResourceDetails(deleted, empty).organizations.url).toBe("/organizations");
  });
});
