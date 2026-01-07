import { logResourceTypes } from "@/data/model/audit/logs/constants";
import { LogRecord } from "@/data/model/audit/logs/record";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";
import { EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import { AccountRecord } from "@/data/model/iam/accounts/record";
import { OrganizationRecord } from "@/data/model/iam/organizations/record";
import { MediaRecord } from "@/data/model/media/medias/medias-record";

import type { Hash } from "@/utils/types";

interface LogResourceDetail {
  ids: Array<string | number>;
  url: string;
  name: string | undefined;
}

export function getLogResourceDetails(
  logRecord: LogRecord,
  opts: {
    accounts: AccountRecord[];
    organizations: OrganizationRecord[];
    projects: ProjectRecord[];
    projectMembers: ProjectMemberRecord[];
    datasets: DatasetRecord[];
    entries: EntryRecord[];
    medias: MediaRecord[];
  },
) {
  const { action, resource_type, resource_id, project_id, entry_id } = logRecord;
  const { accounts, organizations, projects, projectMembers, datasets, entries, medias } = opts;

  /** 1. Construct resource hash */
  let resourceHash = logResourceTypes.reduce((acc, resourceType) => {
    acc[resourceType.value] = {
      ids: [],
      url: `/${resourceType.value}`,
      name: undefined,
    };
    return acc;
  }, {} as Hash<LogResourceDetail>);

  /** 2. Populate resource hash */
  const resource = resourceHash[resource_type];
  switch (resource_type) {
    case "accounts": {
      resource.name = accounts.find((account) => account.id === resource_id)?.email;

      if (action === "logged_in") {
        resource.url = "/login";
      } else {
        resource.url = `/accounts/${resource_id}`;
      }

      break;
    }
    case "account_sessions": {
      resource.url = "/logout";
      break;
    }
    case "organizations": {
      resource.url = `/organizations/${resource_id}`;
      resource.name = organizations.find((organization) => organization.id == String(resource_id))?.name;
      break;
    }
    case "projects": {
      resource.url = `/projects/${resource_id}`;
      resource.name = projects.find((project) => project.id == String(resource_id))?.name;
      break;
    }
    case "project_members": {
      resource.url = `/projects/${project_id}/members`;
      resource.name = projectMembers.find((projectMember) => projectMember.id == String(resource_id))?.email;
      break;
    }
    case "datasets": {
      resource.url = `/projects/${project_id}/datasets/${resource_id}`;
      resource.name = datasets.find((dataset) => dataset.id == String(resource_id))?.name;
      break;
    }
    case "entries": {
      resource.url = `/entries/${entry_id}`;
      resource.name = entries.find((entry) => entry.id == String(resource_id))?.resource;
      break;
    }
    case "medias": {
      resource.url = `/medias/${resource_id}`;
      resource.name = medias.find((media) => media.id == String(resource_id))?.filename;
      break;
    }
    default: {
      break;
    }
  }

  return resourceHash;
}
