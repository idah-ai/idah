import type { AccountAuthRecord } from "@/data/model/iam/accounts/auth/records";
import type { RecordResponse } from "@/data/model/types";

export type AuthBackend = {
  login: (account: string, password: string) => Promise<RecordResponse<AccountAuthRecord>>;
};
