import type { AnnotationMetadata, AnnotationShape, AnnotationValue } from "@/context/AnnotationContext"
import { field, Record, RecordFactory, relationship, type } from "../Record"
import type { JsonApiRecord } from "../types"
import type { Hash } from "@/utils/types"
import type { IncludeList } from "../includes"
import type { Point } from "@/components/video-annotation-activity/VideoAnnotationContext"
import type BoundingBox from "@/components/video-annotation-activity/bounding-box.svelte"
import { createMemoryDataSource } from "@/data/MemoryDataSource"
import type { DataParams } from "@/data/DataSource"
import { sleep } from "@/utils/delayed"

@type('annotation')
export class AnnotationRecord extends Record {
    @field() public shape!: AnnotationShape
    @field() public value!: AnnotationValue
    @field() public metadata!: AnnotationMetadata
}

RecordFactory.registerTypes(
    AnnotationRecord,
);


