import { json } from "@sveltejs/kit";

import { env } from "$env/dynamic/private";

// Matches the Ruby services' /healthcheck (see common/lib/idah_version.rb):
// the CD workflow stamps IDAH_VERSION and IDAH_GIT_SHA into the image, and a
// build without them reports the development placeholders.
const DEV_VERSION = "0.0.0-dev";
const UNKNOWN_REVISION = "unknown";

// A build argument that is declared but never set arrives as an empty string.
const presence = (value: string | undefined): string | undefined =>
  value && value.trim() !== "" ? value : undefined;

export const GET = () =>
  json({
    version: presence(env.IDAH_VERSION) ?? DEV_VERSION,
    revision: presence(env.IDAH_GIT_SHA) ?? UNKNOWN_REVISION,
  });
