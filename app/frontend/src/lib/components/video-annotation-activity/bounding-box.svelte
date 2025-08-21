<script lang=ts>
	import { X, Y, type Point } from "./VideoAnnotationContext"

    let {
        ratio = [1, 1],
        offset = [0, 0],
        points,
        editable = false,
        cursor,
        color = 'deeppink',
        onChange,
        onmousedown
    } : {
        ratio:Point,
        offset: Point,
        points: Point[],
        editable?: boolean,
        cursor?: Point,
        color: string,
        onmousedown?: (e: MouseEvent) => void,
        onChange?: (bb: BoundingBox) => void
    } = $props()

    export function isEditing():Boolean {
        return bounding_box.length != 4 || panStart != undefined
    }

    export interface ToolSelection {
        startSelection: (start:Point) => void,
        endSelection: (end:Point) => void,
        isEditing: () => Boolean,
    }

    let panStart: Point|undefined = $state() // bb pan
    type BoundingBox = []|[Point]|[Point, Point]|[Point, Point, Point, Point]

    let bounding_box: BoundingBox = $derived.by(() => {
        return panStart && cursor ? pan(boundingBox(points), panStart, cursor): boundingBox(points)
    })

    function draw_cmd(path: Point[]) {
        if (path.length == 0) return

        return [
            ...path.map((p, i) => `${i == 0 ? 'M' : 'L'}${p[X]} ${p[Y]}`),
            'Z' // closingpath ?
        ].join(' ')
    }

    function boundingBox(p: Point[], target?: Point): BoundingBox{
        if (p.length == 1 && target) {
            return orderPointsClockwise([
                p[0],
                [target[X], p[0][Y]],
                [target[X], target[Y]],
                [p[0][X], target[Y]],
            ]) as BoundingBox
        }

        if (p.length == 2 && target) {
            if (!target) return p as BoundingBox

            if (p[0][Y] == p[1][Y])
                return orderPointsClockwise(
                    [
                        ...p,
                        [p[1][X], target[Y]],
                        [p[0][X], target[Y]],
                    ]
                ) as BoundingBox
            else if (p[0][X] == p[1][X])
                return orderPointsClockwise(
                    [
                    ...p,
                    [target[X], p[0][Y]],
                    [target[X], p[1][Y]],
                    ]
                ) as BoundingBox
        }
        if (p.length == 4) return orderPointsClockwise([...p]) as BoundingBox

        return [] // \_0_/ error
    }
    function getCentroid(pts: Point[]) :Point {
        return pts.reduce((acc, p) => [acc[X] + p[X], acc[Y] + p[Y]], [0,0])
        .map(c => (c / pts.length)) as Point
    }

    function orderPointsClockwise(points: Point[]): Point[] {
        const centroid = getCentroid(points);

        return points.sort((a, b) => {
            const angleA = Math.atan2(a[Y] - centroid[Y], a[X] - centroid[X]);
            const angleB = Math.atan2(b[Y] - centroid[Y], b[X] - centroid[X]);
            return angleA - angleB;
        });
    }

    function pan(points: BoundingBox, from: Point, to:Point): BoundingBox {
        const delta = [to[X] - from[X], to[Y] - from[Y]]
        console.log(delta)
        return points.map(p => [p[X] + delta[X], p[Y] + delta[Y]]) as BoundingBox
    }



    export function startSelection(start:Point) {

        switch (bounding_box.length) {
            case 0:
                bounding_box = [start]
                break
            default:
                // console.debug({startSelection, points: $state.snapshot(points)})
        }
    }

    export function endSelection(end:Point) {
        switch (bounding_box.length) {
            case 1:
            case 2:
                bounding_box = boundingBox(bounding_box, end)
                onChange?.(bounding_box)
                break
            case 4:
                if (panStart){
                    onChange?.(bounding_box)
                    panStart = undefined
                }
                break
            default:
            // console.debug({endSelection, points: $state.snapshot(points)})
        }
    }

    const BB_TOP_LEFT:0=0
    const BB_TOP_RIGHT:1=1
    const BB_BOTTOM_RIGHT:2=2
    const BB_BOTTOM_LEFT:3=3

    const BB_HANDLE_POINTS = [
        [BB_BOTTOM_RIGHT],
        [BB_BOTTOM_LEFT, BB_BOTTOM_RIGHT],
        [BB_BOTTOM_LEFT],
        [BB_BOTTOM_LEFT, BB_TOP_LEFT],
        [BB_TOP_LEFT],
        [BB_TOP_LEFT, BB_TOP_RIGHT],
        [BB_TOP_RIGHT],
        [BB_BOTTOM_RIGHT, BB_TOP_RIGHT]
    ]

    function boundingBoxHandle(p: Point[]): Point[]{
        if (p.length != 4)
            return []

        return BB_HANDLE_POINTS.map((v, i) => {
            let p_i = Math.floor(i/2)

            if (((i - 1) % 4) == 0) {// horizontal handle
                return [
                    p[p_i][X] + (p[(p_i + 1) % 4][X] - p[p_i][X]) / 2,
                    p[p_i][Y]
                ]
            } else if (((i - 3) % 4) == 0) {// vertical handle
                return [
                    p[p_i][X],
                    p[p_i][Y] + (p[(p_i + 1) % 4][Y] - p[p_i][Y]) / 2
                ]
            } else { return p[p_i] } // corner handle
        })
    }

    function remove_resizeable_points(bb: BoundingBox, handle_index: number) {
        if (bounding_box.length != 4) return console.warn('already resizing ?')

        bounding_box = BB_HANDLE_POINTS[handle_index].map(i => bb[i]) as BoundingBox
    }

</script>

{#snippet BoundingBoxHandle(bb: BoundingBox)}
    {#each boundingBoxHandle(bb) as point, handle}
        <circle
            onmousedown={(e) => {
                e.stopPropagation()
                remove_resizeable_points(bb, handle)
            }}
            onkeypress={console.log}
            cx={point[X] * ratio[X]} cy={point[Y] * ratio[Y]} r={5}
            style:transform-origin={'top left'}
            style:transform={`translate(${offset[X]}px, ${offset[Y]}px)`}
            vector-effect= "non-scaling-stroke"
            style:stroke ={'blue'}
            style:stroke-width= {1}
            style:fill ={'blue'}
            fill-opacity={0.3}
        />
        {/each}
{/snippet}

{#snippet bb(path?: string)}
    {#if path}
        <path
            d={path}
            style:transform-origin={'top left'}
            style:transform={`translate(${offset[X]}px, ${offset[Y]}px) scale(${ratio[X]}, ${ratio[Y]})`}
            vector-effect= "non-scaling-stroke"
            fill-opacity={0.25}
            style:fill={color}
            style:stroke={color}
            style:stroke-width={'1'}
            onmousedown={(e) => {
                console.log({e, editable, editing: isEditing()})
                if (editable && !panStart && !isEditing()) {
                    e.stopPropagation()
                    panStart = cursor
                }
                onmousedown?.(e)
            }}
            />
    {/if}
{/snippet}

{@render bb(draw_cmd(boundingBox(bounding_box, cursor)))}

{#if editable && !isEditing()}
    {@render BoundingBoxHandle(boundingBox(bounding_box, cursor))}
{/if}