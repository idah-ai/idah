import CommandManager from "@/command/CommandManager";
import type { AnnotationContext, AnnotationMetadata, AnnotationObj, AnnotationShape, AnnotationValue } from "../../context/AnnotationContext";

export type Point = [number, number]

export type VideoShapeType = 'bounding-box' | 'bounding-polygon'
export type VideoMode = 'view' | VideoShapeType

export type VideoAnnotation = AnnotationObj<VideoShape, AnnotationValue, AnnotationMetadata>
export type VideoFrameSelection = {
    frame :number;
    points :Point[]
}

export const ORIGIN:[0,0] = [0,0]
export const X:0 = 0
export const Y:1 = 1
export const WIDTH = X
export const HEIGHT = Y


export interface VideoShape extends AnnotationShape {
    type: VideoShapeType,
    start: number,
    end: number,
    frames: VideoFrameSelection[]
}

export interface VideoAnnotationContext extends AnnotationContext{
    listAnnotations(filter: Record<string, any>) :Promise<Array<VideoAnnotation>>;
    addAnnotation(annotation: VideoAnnotation): Promise<void>;
    removeAnnotation(id: string): Promise<void>;
    getAnnotationInfo(id: string): Promise<VideoAnnotation>

    addSelection(id:string, selection: VideoFrameSelection): Promise<VideoAnnotation>
}

// test
let annotations: Array<VideoAnnotation> = []
let id = 0 // ..
export let testVideoAnnotationContext :VideoAnnotationContext = {
    listAnnotations(filter: Record<string, any>) :Promise<Array<VideoAnnotation>> {
        return new Promise((resolve, reject) => {
            resolve(annotations)
        })
    },
    addAnnotation(annotation: VideoAnnotation): Promise<void> {
        return new Promise((resolve, reject) => {
            if (annotations.length + 1 == annotations.push(annotation))
                resolve()
            else
                reject()
        })
    },
    removeAnnotation(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let removed = false

            annotations = annotations.filter((v) => {
                if (v.metadata.id == id) { removed = true }

                console.log(v, v.metadata.id, id, v.metadata.id != id)
                return v.metadata.id != id
            })

            return removed ? resolve() : reject()
        })

    },
    getAnnotationInfo(id: string) {
        return new Promise((resolve, reject) => {
            let found = annotations.find((v) => v.metadata.id == id)
            return found ? resolve(found) : reject()
        })
    },

    addSelection(id: string, selection: VideoFrameSelection) {
        return new Promise((resolve, reject) => {
            this.getAnnotationInfo(id).then((v) => {
                const found = v.shape.frames.findIndex(f => f.frame == selection.frame)

                let from : VideoFrameSelection
                if (found > -1) {
                    console.log('updating')
                    from = v.shape.frames[found]
                    CommandManager.add({
                        name: 'update bounding box',
                        apply() {
                           v.shape.frames[found] = selection
                        },
                        undo()
                        {
                            v.shape.frames[found] = from
                        },
                        isCombinable: () => false,
                        combine: (c)=> c
                    })

                } else {
                    console.log('upserting')
                    let start_from = v.shape.start
                    let end_from = v.shape.end
                    CommandManager.add({
                        name: 'insert bounding box selection',
                        apply() {
                            v.shape = {
                            ...v.shape,
                            start: v.shape.start <= selection.frame ? v.shape.start : selection.frame,
                            end: v.shape.end >= selection.frame ? v.shape.end :selection.frame,
                            frames: [
                                ...v.shape.frames,
                                selection
                            ]
                        }
                        },
                        undo()
                        {
                            v.shape.frames = v.shape.frames.filter(v => v.frame != selection.frame)
                            v.shape.start = start_from
                            v.shape.end = end_from
                        },
                        isCombinable: () => false,
                        combine: (c)=> c
                    })
                }

            }).catch((e) => {
                console.error({e})
                reject()
            })
        })

    }
}