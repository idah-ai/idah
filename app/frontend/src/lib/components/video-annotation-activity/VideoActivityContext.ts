import type { ActivityContext } from "../../context/ActivityContext";
import { testVideoAnnotationContext } from "./VideoAnnotationContext";

const videoActivityContext: ActivityContext = {
    mode: 'edit',
    medias: {
        'main': {
            // url: "src/assets/3727445-hd_1920_1080_30fps.mp4 ",
            // url: "src/assets/1263198-uhd_3840_2160_30fps.mp4",
            // url: 'http://playertest.longtailvideo.com/adaptive/wowzaid3/playlist.m3u8',
            // url: 'http://cdn-fms.rbs.com.br/vod/hls_sample1_manifest.m3u8',
            // url: 'http://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8',
            // url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
            url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
            metadata: {}
        }
    },
    tools: {
        'bounding-box': {
            shapeConfig:{
                minWidth: 10,
                minHeight: 10,
                strokeColor: '#FF0000'
            },
            allowedFields: {
                categories: {
                    vehicles: [
                        {name: 'car'},
                        {name: 'truck'},
                        {name: 'motorcycle'},
                        {name: 'bicyle'},
                    ],
                    pedestrians: [
                        {name: 'adult'},
                        {name: 'child'}
                    ],
                    traffic_signs: [
                        {name: 'stop'},
                        {name: 'yield'},
                        {name: 'speed_limit'},
                        {name: 'crosswalk'}
                    ]
                },
                label: true,
                text:  true,
                confidence: true,
                tags: true,
                attributes: false,
            },
            requiredFields: ['categories'],
        },
        'bounding-polygon': {
            shapeConfig:{
                minWidth: 10,
                minHeight: 10,
                strokeColor: '#FF0000'
            },
            allowedFields: {
                categories: {
                    object: [
                        {
                            name: 'pedestrians',
                            nestedCategories: [
                            {name: 'adult'},
                            {name: 'child'}
                            ]
                        },
                    ]
                }

            },
            requiredFields: []
        }
    },
    annotationContext: testVideoAnnotationContext
}


export default videoActivityContext