import { logResourceTypes } from "@/data/model/audit/logs/constants";
import { LogRecord } from "@/data/model/audit/logs/record";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";
import { EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import { AccountRecord } from "@/data/model/iam/accounts/record";
import { OrganizationRecord } from "@/data/model/iam/organizations/record";
import { mediaBasePath, MediaRecord } from "@/data/model/media/medias/medias-record";

import type { Hash } from "@/utils/types";

interface LogResourceDetail {
  ids: Array<string | number>;
  displayUrl: string;
  resourceUrl: string;
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
  const { action, resource_type, resource_id, project_id, dataset_id, entry_id } = logRecord;
  const { accounts, organizations, projects, projectMembers, datasets, entries, medias } = opts;

  /** 1. Construct resource hash */
  const resourceHash = logResourceTypes.reduce((acc, resourceType) => {
    acc[resourceType.value] = {
      ids: [],
      displayUrl: `/${resourceType.value}`,
      resourceUrl: `/${resourceType.value}`,
      name: undefined,
    };
    return acc;
  }, {} as Hash<LogResourceDetail>);

  /** 2. Populate resource hash */
  const resource = resourceHash[resource_type];
  switch (resource_type) {
    case "accounts": {
      resource.name = accounts.find((account) => account.id === resource_id)?.email;
      resource.resourceUrl = "/accounts";

      switch (action) {
        case "logged_in": {
          resource.displayUrl = "/accounts";
          break;
        }
        default: {
          resource.displayUrl = `/accounts/${resource_id}`;
          break;
        }
      }

      break;
    }
    case "account_sessions": {
      resource.name = resource_id;
      resource.displayUrl = "/accounts";
      resource.resourceUrl = "/accounts";
      break;
    }
    case "organizations": {
      switch (action) {
        case "deleted": {
          resource.displayUrl = `/organizations`;
          break;
        }
        default: {
          resource.displayUrl = `/organizations/${resource_id}`;
          break;
        }
      }

      resource.name = organizations.find((organization) => organization.id == String(resource_id))?.name;
      break;
    }
    case "projects": {
      switch (action) {
        case "deleted": {
          resource.displayUrl = "/projects";
          resource.resourceUrl = "/projects";
          break;
        }
        default: {
          resource.displayUrl = `/projects/${resource_id}`;
          resource.resourceUrl = `/projects/${resource_id}/datasets`;
          break;
        }
      }

      resource.name = projects.find((project) => project.id == String(resource_id))?.name;
      break;
    }
    case "project_members": {
      resource.displayUrl = `/projects/${project_id}/members`;
      resource.resourceUrl = `/projects/${project_id}/members`;
      resource.name = projectMembers.find((projectMember) => projectMember.id == String(resource_id))?.email;
      break;
    }
    case "datasets": {
      switch (action) {
        case "deleted": {
          resource.displayUrl = `/projects/${project_id}/datasets`;
          resource.resourceUrl = `/projects/${project_id}/datasets`;
          break;
        }
        default: {
          resource.displayUrl = `/projects/${project_id}/datasets/${resource_id}`;
          resource.resourceUrl = `/projects/${project_id}/datasets/${resource_id}/entries`;
          break;
        }
      }

      resource.name = datasets.find((dataset) => dataset.id == String(resource_id))?.name;
      break;
    }
    case "entries": {
      resource.displayUrl = `/projects/${project_id}/datasets/${dataset_id}/entries/${entry_id}`;
      resource.resourceUrl = `/projects/${project_id}/datasets/${dataset_id}/entries`;
      resource.name = entries.find((entry) => entry.id == String(resource_id))?.resource;
      break;
    }
    case "medias": {
      resource.displayUrl = `/medias/${resource_id}`;
      resource.resourceUrl = `${mediaBasePath}/files/${resource_id}`;
      resource.name = medias.find((media) => media.id == String(resource_id))?.filename;
      break;
    }
    default: {
      break;
    }
  }

  return resourceHash;
}
