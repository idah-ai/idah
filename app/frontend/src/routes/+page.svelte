<script lang='ts'>
	import type { AnnotationMetadata, AnnotationObj, AnnotationShape, AnnotationValue } from "$lib/context/AnnotationContext";
    import VideoPlayer, { type VideoBoundingBox, type VideoBoundingPolygon } from "$lib/video_player.svelte";

    let annotations: Array<AnnotationObj<VideoBoundingBox | VideoBoundingPolygon, AnnotationValue, AnnotationMetadata>> = [
        {
            shape: {
                type: 'VideoBoundingBox',
                selections: [
                    {
                        frame: 4200,
                        points: [
                            [0.11160714285714286 ,0.25],
                            [0.11160714285714286,0.5],
                            [0.22321428571428573,0.5],
                            [0.22321428571428573,0.25]
                        ],
                    },
                    {
                        frame: 4201,
                        points: [
                            [0.11160714285714286 ,0.25],
                            [0.11160714285714286,0.5],
                            [0.22321428571428573,0.5],
                            [0.22321428571428573,0.25]
                        ],
                    },
                ]                
            },
            value: {
                // AnnotationValue 
            },
            metadata: {
                id: '0',
                createdAt: new Date(Date.now()),
                updatedAt: new Date(Date.now())
            }
        },{
            shape: {
                type: 'VideoBoundingPolygon',
                selections: [
                    {
                        frame: 4200,
                        points: [
                            [ 0.7439024390243902, 0.5804878048780489 ],
                            [ 0.7682926829268293, 0.6780487804878048 ],
                            [ 0.8414634146341464, 0.6780487804878048 ],
                            [ 0.7926829268292683, 0.7268292682926829 ],
                            [ 0.8170731707317074, 0.8 ],
                            [ 0.7439024390243902, 0.751219512195122 ],
                            [ 0.6707317073170732, 0.8 ],
                            [ 0.6951219512195121, 0.7268292682926829 ],
                            [ 0.6463414634146342, 0.6780487804878048 ],
                            [ 0.7195121951219512, 0.6780487804878048 ]
                        ],
                    }
                ]
            },
            value: {
                // AnnotationValue 
            },
            metadata: {
                id: '0',
                createdAt: new Date(Date.now()),
                updatedAt: new Date(Date.now())
            }
        }
    ]
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>


<VideoPlayer/>