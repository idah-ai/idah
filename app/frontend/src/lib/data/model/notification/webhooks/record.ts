import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { filtersToHash } from "@/data/filtering";
import { parseCollectionReturn, parseSingleElementError } from "@/data/model/json_api";
import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";
import { WebhookEventRecord } from "@/data/model/notification/webhooks/event/record";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { ListOptions } from "@/data/DataSource";
import type { TestWebhookResponse } from "@/data/model/notification/webhooks/types";
import type { Hash } from "@/utils/types";

export const webhookResource = "notification:webhooks" as const;

@type(webhookResource)
export class WebhookRecord extends Record {
  @field() public name!: string;
  @field() public url!: string;
  @field() public events!: string[];
  @field() public secret!: string;
  @field() public enabled!: boolean;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(WebhookRecord);

export const webhooksBasePath: string = `/api/v1/notification/webhooks`;
export const webhooksBackendDataSource = createBackendDataSource(WebhookRecord, webhooksBasePath, {
  test: async (id: string) => {
    const response = await fetch(`${webhooksBasePath}/${id}/test`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to test webhook");
    }

    const result: TestWebhookResponse = await response.json();
    if (!result.success) {
      const status = result.http_code ? ` (HTTP ${result.http_code})` : "";
      throw new Error(`Webhook delivery failed${status}: ${result.response || "No response received."}`);
    }

    return result;
  },
  event: async () => {
    const response = await fetch(`${webhooksBasePath}/events`, {
      method: "GET",
    });
    const body = await response.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error fetching webhook events: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseCollectionReturn<WebhookEventRecord>(body));
    }

    throw "No data returned";
  },
  jobs: async (id: string, options: ListOptions = {}) => {
    const params: Hash = {};

    if (options.filters) params["filter"] = filtersToHash(options.filters);
    if (options.fields) params["fields"] = options.fields;
    if (options.included) params["included"] = options.included;
    if (options.sort) params["sort"] = options.sort.join(",");
    if (options.pagination) {
      params["page"] = {
        number: options.pagination.page,
        size: options.pagination.itemsPerPage,
      };
    }
    if (options.count) params["count"] = options.count;

    const response = await fetch(resourcePath(`${webhooksBasePath}/${id}/jobs`, null, params), {
      method: "GET",
    });
    const body = await response.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error fetching webhook job: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseCollectionReturn<WebhookCallRecord>(body));
    }

    throw "No data returned";
  },
});
