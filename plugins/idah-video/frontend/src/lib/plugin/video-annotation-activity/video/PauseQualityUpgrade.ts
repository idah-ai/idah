/**
 * PauseQualityUpgrade
 *
 * A mountable/unmountable module for Video.js that automatically loads
 * 1080p segments when the video is paused, then restores normal ABR
 * on play. Designed for annotation platforms where paused frames need
 * to be high quality.
 *
 * Usage:
 *   import { PauseQualityUpgrade } from "./PauseQualityUpgrade";
 *
 *   const upgrade = new PauseQualityUpgrade(player, { segmentDuration: 2.002 });
 *   upgrade.mount();   // start listening for pause/play
 *   upgrade.unmount(); // stop and clean everything up
 */

import type Player from "video.js/dist/types/player";

// ─── Types ───

export interface PauseQualityUpgradeOptions {
  /** Duration of each HLS segment in seconds (from manifest). Default: 2.002 */
  segmentDuration?: number;
  /** Delay (ms) after pause event before starting upgrade (filters seek-pauses). Default: 200 */
  pauseDelay?: number;
  /** Interval (ms) to keep the segment loader alive while paused. Default: 1000 */
  keepAliveInterval?: number;
  /** Called when the upgrade status changes */
  onStatusChange?: (status: UpgradeStatus) => void;
  getCurrentFrame?: () => number;
  getCurrentTime?: () => number;
  onSeekToFrame?: (frame: number) => void;
}

export type UpgradeStatus =
  | { state: "idle" }
  | { state: "loading"; segmentsLoaded: number }
  | { state: "ready"; segmentsLoaded: number }
  | { state: "error"; message: string };

interface InternalState {
  active: boolean;
  originalSelectPlaylist: (() => any) | null;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  appendHandler: (() => void) | null;
  savedEnabled: boolean[];
  segmentsLoaded: number;
}

// ─── Module ───

export class PauseQualityUpgrade {
  private player: Player;
  private opts: Required<PauseQualityUpgradeOptions>;
  private mounted = false;

  private state: InternalState = {
    active: false,
    originalSelectPlaylist: null,
    keepAliveTimer: null,
    appendHandler: null,
    savedEnabled: [],
    segmentsLoaded: 0,
  };

  // Bound event handlers (so we can remove them on unmount)
  private onPause: () => void;
  private onPlay: () => void;

  constructor(player: Player, options: PauseQualityUpgradeOptions = {}) {
    this.player = player;
    this.opts = {
      segmentDuration: options.segmentDuration ?? 2.002,
      pauseDelay: options.pauseDelay ?? 200,
      keepAliveInterval: options.keepAliveInterval ?? 1000,
      onStatusChange: options.onStatusChange ?? (() => {}),
      getCurrentFrame: options.getCurrentFrame ?? (() => 0),
      getCurrentTime: options.getCurrentTime ?? (() => 0),
      onSeekToFrame: options.onSeekToFrame ?? (() => {}),
    };

    this.onPause = this.handlePause.bind(this);
    this.onPlay = this.handlePlay.bind(this);
  }

  // ─── Public API ───

  /** Start listening for pause/play events and enable the upgrade behavior. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.player.on("pause", this.onPause);
    this.player.on("play", this.onPlay);
    console.log("[PauseQualityUpgrade] Mounted");
  }

  /** Stop listening, tear down any in-progress upgrade, restore ABR. */
  unmount(): void {
    if (!this.mounted) return;
    this.stopUpgrade();
    this.player.off("pause", this.onPause);
    this.player.off("play", this.onPlay);
    this.mounted = false;
    console.log("[PauseQualityUpgrade] Unmounted");
  }

  /** Whether the module is currently mounted. */
  get isMounted(): boolean {
    return this.mounted;
  }

  /** Whether a 1080p upgrade is currently in progress. */
  get isUpgrading(): boolean {
    return this.state.active;
  }

  // ─── Event Handlers ───

  private handlePause(): void {
    // Wait to confirm this is a real pause, not a seek-induced transient
    setTimeout(() => {
      if (this.player.paused() && !(this.player as any).seeking()) {
        this.startUpgrade();
      }
    }, this.opts.pauseDelay);
  }

  private handlePlay(): void {
    this.stopUpgrade();
  }

  // ─── VHS Access ───

  private getVhs() {
    try {
      const tech = (this.player as any).tech({ IWillNotUseThisInPlugins: true });
      const vhs = tech?.vhs;
      if (!vhs) return null;

      const pc = vhs.playlistController_;
      if (!pc) return null;

      const playlists: any[] = vhs.playlists?.main?.playlists || [];
      return { vhs, pc, playlists, tech };
    } catch {
      return null;
    }
  }

  private getHighestPlaylist(playlists: any[]): any {
    return playlists.reduce(
      (best: any, pl: any) => ((pl.attributes?.BANDWIDTH || 0) > (best.attributes?.BANDWIDTH || 0) ? pl : best),
      playlists[0],
    );
  }

  // ─── Upgrade Logic ───

  private startUpgrade(): void {
    if (this.state.active) return;

    const ctx = this.getVhs();
    if (!ctx || ctx.playlists.length < 2) {
      this.emitStatus({ state: "error", message: "VHS not available or single quality" });
      return;
    }

    const { vhs, pc, playlists, tech } = ctx;
    const highest = this.getHighestPlaylist(playlists);
    const mainLoader = pc.mainSegmentLoader_;
    const current = vhs.playlists.media();

    const savedTime = this.opts.getCurrentTime();

    this.state.active = true;
    this.state.segmentsLoaded = 0;

    const cRes = current?.attributes?.RESOLUTION;
    const hRes = highest.attributes?.RESOLUTION;
    console.log(
      `[PauseQualityUpgrade] ${cRes?.width}x${cRes?.height} → ${hRes?.width}x${hRes?.height} @ ${savedTime.toFixed(3)}s`,
    );
    this.emitStatus({ state: "loading", segmentsLoaded: 0 });

    // 1. Override ABR
    this.state.originalSelectPlaylist = pc.selectPlaylist;
    pc.selectPlaylist = () => highest;

    // 2. Disable lower quality levels
    // Use the highest level height as the cutoff for "high quality"
    const ql = (this.player as any).qualityLevels?.();
    const maxHeightfromQl = Math.max(...(ql?.levels_.map((l: any) => l.height) || []));

    this.state.savedEnabled = [];
    if (ql) {
      for (let i = 0; i < ql.length; i++) {
        this.state.savedEnabled.push(ql[i].enabled);
        ql[i].enabled = ql[i].height >= maxHeightfromQl;
      }
    }

    // 3. Appended handler — seek to exact time after first 1080p segment loads
    this.state.appendHandler = () => {
      if (!this.state.active) return;
      this.state.segmentsLoaded++;

      console.log(`[PauseQualityUpgrade] 1080p segment #${this.state.segmentsLoaded} appended`);

      if (this.state.segmentsLoaded === 1) {
        this.emitStatus({ state: "ready", segmentsLoaded: this.state.segmentsLoaded });

        const videoEl = tech.el() as HTMLVideoElement;
        if (videoEl) {
          this.opts.onSeekToFrame?.(this.opts.getCurrentFrame());
        }
      }
    };
    mainLoader?.on("appended", this.state.appendHandler);

    // 4. Switch playlist
    if (current !== highest) {
      vhs.playlists.media(highest);
    }

    // 5. Partial buffer removal — preserve sync/timestampOffset
    mainLoader.pause();
    mainLoader.resyncLoader();
    mainLoader.ended_ = false;
    mainLoader.activeInitSegmentId_ = null;
    mainLoader.appendInitSegment_ = { audio: true, video: true };

    const segStart = Math.floor(savedTime / this.opts.segmentDuration) * this.opts.segmentDuration;
    mainLoader.remove(segStart, Infinity, () => {
      if (!this.state.active) return;
      mainLoader.load();
    });

    // 6. Keep loader alive while paused
    this.state.keepAliveTimer = setInterval(() => {
      if (!this.state.active || !this.player.paused()) {
        if (this.state.keepAliveTimer) clearInterval(this.state.keepAliveTimer);
        this.state.keepAliveTimer = null;
        return;
      }
      mainLoader?.load();
    }, this.opts.keepAliveInterval);
  }

  private stopUpgrade(): void {
    if (!this.state.active) return;

    const ctx = this.getVhs();
    if (ctx) {
      const { pc } = ctx;

      if (this.state.originalSelectPlaylist) {
        pc.selectPlaylist = this.state.originalSelectPlaylist;
      }

      const ql = (this.player as any).qualityLevels?.();
      if (ql) {
        for (let i = 0; i < ql.length && i < this.state.savedEnabled.length; i++) {
          ql[i].enabled = this.state.savedEnabled[i];
        }
      }

      const mainLoader = pc.mainSegmentLoader_;
      if (mainLoader && this.state.appendHandler) {
        mainLoader.off("appended", this.state.appendHandler);
      }
    }

    if (this.state.keepAliveTimer) {
      clearInterval(this.state.keepAliveTimer);
    }

    this.state = {
      active: false,
      originalSelectPlaylist: null,
      keepAliveTimer: null,
      appendHandler: null,
      savedEnabled: [],
      segmentsLoaded: 0,
    };

    this.emitStatus({ state: "idle" });
    console.log("[PauseQualityUpgrade] Restored normal ABR");
  }

  private emitStatus(status: UpgradeStatus): void {
    this.opts.onStatusChange(status);
  }
}
