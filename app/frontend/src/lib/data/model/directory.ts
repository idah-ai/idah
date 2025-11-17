import { building } from "$app/environment";

import { RecordFactory } from "@/data/model/Record";

/** DATASET */
import { AnnotationRecord } from "@/data/model/dataset/annotations/record";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";
import { EntryRecord } from "@/data/model/dataset/entries/record";
import { NoteCommentRecord } from "@/data/model/dataset/notes/comments/record";
import { NoteFeedRecord } from "@/data/model/dataset/notes/feeds/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

/** IAM */
import { AccountRecord } from "@/data/model/iam/accounts/record";

/** MEDIA */
import { JobRecord } from "@/data/model/media/jobs/record";
import { MediaRecord } from "@/data/model/media/medias/medias-record";

/** SETTING */
import { AccountSettingRecord } from "@/data/model/setting/account_setting/record";
import { PluginRecord } from "@/data/model/setting/plugin/record";
import { SettingRecord } from "@/data/model/setting/setting/record";

/**
 * Register the different record types, so they can be created from a JsonApiRecord
 */
if (!building) {
  RecordFactory.registerTypes(
    /** DATASET */
    AnnotationRecord,
    DatasetRecord,
    EntryRecord,
    NoteFeedRecord,
    NoteCommentRecord,
    ProjectRecord,
    ProjectMemberRecord,

    /** IAM */
    AccountRecord,

    /** MEDIA */
    JobRecord,
    MediaRecord,

    /** SETTING */
    AccountSettingRecord,
    PluginRecord,
    SettingRecord,
  );
}
