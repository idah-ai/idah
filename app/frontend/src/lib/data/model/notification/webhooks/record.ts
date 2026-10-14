import { createBackendDataSource } from "@/data/BackendDataSource";
import { parseCollectionReturn, parseSingleElementError } from "@/data/model/json_api";
import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";
import { WebhookEventRecord } from "@/data/model/notification/webhooks/event/record";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

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
    const body = await response.json();

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error testing webhook: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: response.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseCollectionReturn<WebhookRecord>(body));
    }

    throw "No data returned";
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
  jobs: async (id: string) => {
    const response = await fetch(`${webhooksBasePath}/${id}/jobs`, {
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
