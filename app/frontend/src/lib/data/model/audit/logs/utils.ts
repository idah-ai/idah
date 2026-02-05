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
  const { action, resource_type, resource_id, project_id, dataset_id } = logRecord;
  const { accounts, organizations, projects, projectMembers, datasets, entries, medias } = opts;

  /** 1. Construct resource hash */
  const resourceHash = logResourceTypes.reduce((acc, resourceType) => {
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
      /**
       * For all actions on accounts,
       * the `resource_id` is the email of the account
       */
      resource.name = accounts.find((account) => account.id === resource_id)?.email;

      switch (action) {
        case "logged_in": {
          resource.url = `/accounts?filters[email__match]=${resource_id}`;
          break;
        }
        case "failed_log_in_attempt": {
          const foundAccount = accounts.find((account) => account.email == String(resource_id));
          resource.url = foundAccount ? `/accounts?filters[email__match]=${foundAccount.email}` : "/accounts";
          break;
        }
        default: {
          const foundAccount = accounts.find((account) => account.id == String(resource_id));
          resource.url = foundAccount ? `/accounts?filters[email__match]=${foundAccount.email}` : "/accounts";
          break;
        }
      }

      break;
    }
    case "account_sessions": {
      /**
       * For resource_type = account_sessions (Logged out action)
       * the `resource_id` is the email of the account
       */
      resource.name = resource_id;
      resource.url = `/accounts?filters[email__match]=${resource_id}`;
      break;
    }
    case "organizations": {
      switch (action) {
        case "deleted": {
          resource.url = `/organizations`;
          break;
        }
        default: {
          resource.url = `/organizations/${resource_id}`;
          break;
        }
      }

      resource.name = organizations.find((organization) => organization.id == String(resource_id))?.name;
      break;
    }
    case "projects": {
      switch (action) {
        case "deleted": {
          resource.url = "/projects";
          break;
        }
        default: {
          resource.url = `/projects/${resource_id}/datasets`;
          break;
        }
      }

      resource.name = projects.find((project) => project.id == String(resource_id))?.name;
      break;
    }
    case "project_members": {
      const foundProjectMember = projectMembers.find((projectMember) => projectMember.id == String(resource_id));
      resource.url = foundProjectMember
        ? `/projects/${project_id}/members?filters[email__match]=${foundProjectMember.email}`
        : `/projects/${project_id}/members`;
      resource.name = foundProjectMember?.email || String(resource_id);
      break;
    }
    case "datasets": {
      switch (action) {
        case "deleted": {
          resource.url = `/projects/${project_id}/datasets`;
          break;
        }
        default: {
          resource.url = `/projects/${project_id}/datasets/${resource_id}/entries`;
          break;
        }
      }

      resource.name = datasets.find((dataset) => dataset.id == String(resource_id))?.name;
      break;
    }
    case "entries": {
      const foundEntry = entries.find((entry) => entry.id == String(resource_id));
      resource.url = `/projects/${project_id}/datasets/${dataset_id}/entries`;
      resource.name = foundEntry?.resource;

      switch (action) {
        case "deleted": {
          // Do not add filter for deleted entries
          break;
        }
        default: {
          resource.url += `?filters[resource__match]=${foundEntry?.resource}`;
          break;
        }
      }
      break;
    }
    case "medias": {
      /**
       * As we don't have the pages for medias,
       * we will use the api endpoint to show the files of medias instead.
       */
      resource.url = `${mediaBasePath}/files/${resource_id}`;
      resource.name = medias.find((media) => media.id == String(resource_id))?.filename;
      break;
    }
    default: {
      break;
    }
  }

  return resourceHash;
}
