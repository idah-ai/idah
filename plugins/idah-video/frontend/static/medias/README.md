# Mock Video Media

Download a mock video from here:

https://www.pexels.com/video/traffic-flow-in-the-highway-2103099/

## Generate HLS (m3u8 + ts segments)

Place the downloaded mp4 as `input.mp4` in this directory, then run:

```sh
./transcode.sh input.mp4
```

This produces:

```
master.m3u8                     ← adaptive streaming master playlist
240p/playlist.m3u8             ← 426×240 variant
240p/segment_*.ts
480p/playlist.m3u8             ← 854×480 variant
480p/segment_*.ts
1080p/playlist.m3u8            ← 1920×1080 variant
1080p/segment_*.ts
```

The mock driver in `idah-driver.ts` already points to `/medias/master.m3u8`.
