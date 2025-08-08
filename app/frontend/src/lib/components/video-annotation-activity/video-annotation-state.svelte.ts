import type { AnnotationValue } from "@/context/AnnotationContext"
import type { VideoAnnotation } from "./VideoAnnotationContext"
import { AnnotationRecord } from "@/data/model/annotations/annotationRecord"
import { createMemoryDataSource } from "@/data/MemoryDataSource"
import type { DataParams } from "@/data/DataSource"
import { sleep } from "@/utils/delayed"



export class VideoAnnotationsState {
    videoAnnotations: VideoAnnotation[] = $state([])


    videoAnnotationsSource = createMemoryDataSource(AnnotationRecord, {
        delay: 0,
        initialData: this.videoAnnotations,
        error: false,
        customMethods: {
            async create(data: DataParams<AnnotationRecord>): Promise<string> {
                await sleep(this.delay);

                if (this.error) throw "error";

                const findMaxId = () => {
                    let maxId = 0;
                    this.data.forEach((record) => {
                    if (Number.parseInt(record.id) > maxId) {
                        maxId = Number.parseInt(record.id);
                    }
                    });
                    return maxId.toString();
                };

                const id = `${parseInt(findMaxId()) + 1}`;
                data.attributes = {
                    id,
                    metadata: {
                        id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    ...data.attributes
                };

                this.data.push(data.attributes);
                return id;
                },
        }
    });


}