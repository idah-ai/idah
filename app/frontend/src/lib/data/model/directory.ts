import { building } from "$app/environment";

import { RecordFactory } from "@/data/model/Record";

/**
 * Register the different record types, so they can be created from a JsonApiRecord
 */

if (!building) {
  RecordFactory.registerTypes(
  );
}
