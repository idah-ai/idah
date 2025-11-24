import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";
import { humanize } from "@/utils/string";

import { auditActions, type AuditAction, type IAuditAction } from "@/data/model/audit/audits/constants";

@type("audit:audits")
export class AuditRecord extends Record {
  @field() public readonly action!: AuditAction;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;

  public get actionBadge(): IAuditAction {
    const foundAction = auditActions.find((action) => action.value === this.action);

    if (!foundAction) {
      return { label: humanize(this.action), value: this.action, badgeVariant: "secondary" };
    }

    return foundAction;
  }
}

RecordFactory.registerTypes(AuditRecord);

const auditBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/audit/audits`;

export const auditsBackendDataSource = createBackendDataSource(AuditRecord, auditBasePath);
