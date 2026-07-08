import { RULER_HEIGHT, PITCHES } from "../utils/Constants.js";

export default class InputManager {
  constructor(stateManager, uiManager, playbackManager, projectManager) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.playbackManager = playbackManager;
    this.projectManager = projectManager;
    this.data = this.stateManager.data;

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  registerGlobalEvents() {
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  cleanup() {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  handleMouseMove(e) {
    const ds = this.data.dragState;
    if (!ds || !ds.active) return;

    if (ds.type === "scrub") {
      e.preventDefault();
      const el = ds.isPlaylist
        ? this.uiManager.elements.playlistGridEl
        : this.uiManager.elements.editorGridEl;
      this.playbackManager.handleScrub(e, ds.isPlaylist, el);
      return;
    }

    if (ds.type === "tempo_drag") {
      const delta = ds.startY - e.clientY;
      this.data.tempo = Math.max(
        10,
        Math.min(999, ds.startVal + Math.floor(delta / 2)),
      );
      if (
        this.uiManager.elements.tempoInput &&
        this.uiManager.elements.tempoInput.elm
      ) {
        this.uiManager.elements.tempoInput.val(this.data.tempo);
      }
      return;
    }

    if (ds.type === "splitter_main") {
      const rect =
        this.uiManager.elements.workspace.elm.getBoundingClientRect();
      const newHeight = Math.max(
        150,
        Math.min(e.clientY - rect.top, rect.height - 150),
      );
      this.uiManager.elements.topPane.styleJs({
        flex: "none",
        height: `${newHeight}px`,
      });
      return;
    }

    if (ds.type === "splitter_pr") {
      const delta = ds.startY - e.clientY;
      const newHeight = Math.max(
        50,
        Math.min(
          this.uiManager.elements.editorArea.elm.clientHeight - 80,
          ds.startHeight + delta,
        ),
      );
      if (this.uiManager.elements.controlContainer.elm) {
        this.uiManager.elements.controlContainer.styleJs({
          height: `${newHeight}px`,
        });
      }
      return;
    }

    if (
      (ds.type === "select" || ds.type === "select_blocks") &&
      this.uiManager.elements.selBox &&
      ds.rect
    ) {
      ds.hasMoved = true;
      const currentX = e.clientX - ds.rect.left;
      const currentY = e.clientY - ds.rect.top;
      const startBoxX = ds.startX - ds.rect.left;
      const startBoxY = ds.startY - ds.rect.top;

      const x = Math.min(startBoxX, currentX);
      const y = Math.min(startBoxY, currentY);
      const w = Math.abs(currentX - startBoxX);
      const h = Math.abs(currentY - startBoxY);

      this.uiManager.elements.selBox.styleJs({
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
      });
      return;
    }

    if (ds.type === "move_block") {
      ds.hasMoved = true;
      const deltaX = e.clientX - ds.startX;
      const deltaY = e.clientY - ds.startY;
      const deltaTicks =
        Math.round(deltaX / this.data.playlistZoomX / this.data.playlistSnap) *
        this.data.playlistSnap;
      const deltaTrack = Math.round(deltaY / this.data.playlistZoomY);

      let maxRightPx = 0;
      ds.selectedBlocksStart.forEach((item) => {
        const newTick = Math.max(0, item.startTick + deltaTicks);
        const newTrack = Math.max(0, Math.min(9, item.startTrack + deltaTrack));
        item.block.startTick = newTick;
        item.block.trackIndex = newTrack;

        if (item.block._el) {
          const leftPx = newTick * this.data.playlistZoomX;
          item.block._el.style.left = `${leftPx}px`;
          item.block._el.style.top = `${newTrack * this.data.playlistZoomY + RULER_HEIGHT + 1}px`;
          const rightPx =
            leftPx +
            this.stateManager.getPatternLength(item.block.patternId) *
              this.data.playlistZoomX;
          if (rightPx > maxRightPx) maxRightPx = rightPx;
        }
      });

      if (maxRightPx > this.uiManager.elements.playlistGridEl.elm.clientWidth) {
        this.uiManager.elements.playlistGridEl.styleJs({
          width: `${maxRightPx + 1000}px`,
        });
      }
    } else if (ds.type === "move_note") {
      ds.hasMoved = true;
      const deltaX = e.clientX - ds.startX;
      const deltaY = e.clientY - ds.startY;
      const deltaTicks =
        Math.round(deltaX / this.data.zoomX / this.data.snapTicks) *
        this.data.snapTicks;
      const deltaRow = Math.round(deltaY / this.data.zoomY);

      let maxRightPx = 0;
      ds.selectedNotesStart.forEach((item) => {
        const newTick = Math.max(0, item.startTick + deltaTicks);
        const newRow = Math.max(
          0,
          Math.min(PITCHES.length - 1, item.startRow + deltaRow),
        );
        item.note.startTick = newTick;
        item.note.pitch = PITCHES[newRow];

        if (item.note._el) {
          const leftPx = newTick * this.data.zoomX;
          item.note._el.style.left = `${leftPx}px`;
          item.note._el.style.top = `${newRow * this.data.zoomY + RULER_HEIGHT + 1}px`;
          const rightPx = leftPx + item.note.durationTicks * this.data.zoomX;
          if (rightPx > maxRightPx) maxRightPx = rightPx;
        }
      });

      if (maxRightPx > this.uiManager.elements.editorGridEl.elm.clientWidth) {
        this.uiManager.elements.editorGridEl.styleJs({
          width: `${maxRightPx + 1000}px`,
        });
      }
    } else if (ds.type === "resize_note") {
      ds.hasMoved = true;
      const deltaX = e.clientX - ds.startX;
      const deltaTicks =
        Math.round(deltaX / this.data.zoomX / this.data.snapTicks) *
        this.data.snapTicks;

      let maxRightPx = 0;
      ds.selectedNotesStart.forEach((item) => {
        const newDur = Math.max(
          this.data.snapTicks,
          item.startDur + deltaTicks,
        );
        item.note.durationTicks = newDur;

        if (item.note._el) {
          item.note._el.style.width = `${newDur * this.data.zoomX}px`;
          const rightPx = (item.note.startTick + newDur) * this.data.zoomX;
          if (rightPx > maxRightPx) maxRightPx = rightPx;
        }
      });

      if (maxRightPx > this.uiManager.elements.editorGridEl.elm.clientWidth) {
        this.uiManager.elements.editorGridEl.styleJs({
          width: `${maxRightPx + 1000}px`,
        });
      }
    } else if (
      ds.type === "draw_control" &&
      this.uiManager.elements.controlGridEl
    ) {
      const rect =
        this.uiManager.elements.controlGridEl.elm.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const tick = Math.max(0, x / this.data.zoomX);
      const valPercent = Math.max(0, Math.min(1, 1 - y / rect.height));

      const affected = this.applyControlValue(tick, valPercent, ds);
      ds.lastTick = tick;
      ds.hasMoved = true;
      if (affected) this.uiManager.renderControlGrid();
    }
  }

  handleMouseUp(e) {
    const ds = this.data.dragState;
    if (!ds || !ds.active) return;

    document.body.style.cursor = "";
    if (ds.type === "splitter_main" && this.uiManager.elements.splitter)
      this.uiManager.elements.splitter.classOff("active");
    if (ds.type === "splitter_pr" && this.uiManager.elements.prSplitter)
      this.uiManager.elements.prSplitter.classOff("active");

    if (ds.type === "tempo_drag") {
      if (this.data.tempo !== ds.startVal) this.stateManager.pushHistory();
    }

    let requiresGridLock = false;

    if (
      (ds.type === "select" || ds.type === "select_blocks") &&
      this.uiManager.elements.selBox &&
      ds.rect
    ) {
      const currentX = e.clientX - ds.rect.left;
      const currentY = e.clientY - ds.rect.top;
      const startBoxX = ds.startX - ds.rect.left;
      const startBoxY = ds.startY - ds.rect.top;

      const x = Math.min(startBoxX, currentX);
      const y = Math.min(startBoxY, currentY);
      const w = Math.abs(currentX - startBoxX);
      const h = Math.abs(currentY - startBoxY);

      if (ds.type === "select") {
        const startTick = x / this.data.zoomX;
        const endTick = (x + w) / this.data.zoomX;
        const startRow = (y - RULER_HEIGHT) / this.data.zoomY;
        const endRow = (y - RULER_HEIGHT + h) / this.data.zoomY;

        const activePat = this.data.patterns.find(
          (p) => p.id === this.data.activePatternId,
        );
        const activeCh = this.data.channels.find(
          (c) => c.id === this.data.activeChannelId,
        );

        if (activePat && activeCh && activePat.data[activeCh.id]) {
          this.data.selectedNotes = activePat.data[activeCh.id].filter((n) => {
            const noteRow = PITCHES.indexOf(n.pitch);
            const noteStart = n.startTick;
            const noteEnd = n.startTick + n.durationTicks;
            return (
              noteRow >= startRow &&
              noteRow <= endRow &&
              noteStart < endTick &&
              noteEnd > startTick
            );
          });
        }
        this.uiManager.renderEditorData();
      } else {
        const startTick = x / this.data.playlistZoomX;
        const endTick = (x + w) / this.data.playlistZoomX;
        const startTrack = (y - RULER_HEIGHT) / this.data.playlistZoomY;
        const endTrack = (y - RULER_HEIGHT + h) / this.data.playlistZoomY;

        this.data.selectedBlocks = this.data.playlist.filter((b) => {
          const pat = this.data.patterns.find((p) => p.id === b.patternId);
          const len = pat ? this.stateManager.getPatternLength(pat.id) : 512;
          return (
            b.trackIndex >= startTrack &&
            b.trackIndex <= endTrack &&
            b.startTick < endTick &&
            b.startTick + len > startTick
          );
        });
        this.uiManager.renderPlaylistBlocks();
      }

      this.uiManager.elements.selBox.cleanup();
      this.uiManager.elements.selBox = null;
      requiresGridLock = true;
    } else if (
      (ds.type === "move_block" ||
        ds.type === "move_note" ||
        ds.type === "resize_note" ||
        ds.type === "draw_control") &&
      ds.hasMoved
    ) {
      if (ds.type === "resize_note" && this.data.selectedNotes.length > 0) {
        this.data.lastNoteDuration[this.data.activeChannelId] =
          this.data.selectedNotes[0].durationTicks;
      }
      this.stateManager.pushHistory();
      requiresGridLock = true;
    }

    ds.active = false;

    if (requiresGridLock) {
      this.uiManager.renderPlaylistGrid();
      this.uiManager.renderPianoRollGrid();
    }
  }

  handleKeyDown(e) {
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.getAttribute("contenteditable") === "true"
    ) {
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.code) {
        case "KeyA":
          e.preventDefault();
          this.selectAll();
          break;
        case "KeyB":
          e.preventDefault();
          this.duplicateSelected();
          break;
        case "ArrowUp":
          e.preventDefault();
          this.shiftSelectedPitch(e.shiftKey ? -1 : -12);
          break;
        case "ArrowDown":
          e.preventDefault();
          this.shiftSelectedPitch(e.shiftKey ? 1 : 12);
          break;
        case "KeyZ":
          e.preventDefault();
          if (e.shiftKey) this.stateManager.redo();
          else this.stateManager.undo();
          break;
        case "KeyY":
          e.preventDefault();
          this.stateManager.redo();
          break;
      }
    } else if (e.code === "Space") {
      e.preventDefault();
      this.playbackManager.togglePlayback();
    }
  }

  applyControlValue(tick, valPercent, ds) {
    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (!activePat || !activeCh) return false;

    const snappedTick =
      Math.floor(tick / this.data.snapTicks) * this.data.snapTicks;
    const snappedLastTick =
      Math.floor(ds.lastTick / this.data.snapTicks) * this.data.snapTicks;
    const minT = Math.min(snappedLastTick, snappedTick);
    const maxT = Math.max(snappedLastTick, snappedTick);
    const step = this.data.snapTicks || 32;

    if (this.data.activeControl === "velocity") {
      const val = Math.round(valPercent * 100);
      const notes = activePat.data[activeCh.id] || [];
      let affected = false;
      notes.forEach((n) => {
        if (n.startTick >= minT - step / 2 && n.startTick <= maxT + step / 2) {
          n.velocity = val;
          affected = true;
        }
      });
      return affected;
    } else {
      const val = Math.round(valPercent * 127);
      const cc = this.data.activeControl;
      if (!activePat.automation) activePat.automation = {};
      if (!activePat.automation[activeCh.id])
        activePat.automation[activeCh.id] = {};
      if (!activePat.automation[activeCh.id][cc])
        activePat.automation[activeCh.id][cc] = [];

      const arr = activePat.automation[activeCh.id][cc];
      let affected = false;
      for (let t = minT; t <= maxT; t += step) {
        let existing = arr.find((e) => e.startTick === t);
        if (existing) existing.value = val;
        else arr.push({ startTick: t, value: val });
        affected = true;
      }
      return affected;
    }
  }

  selectAll() {
    if (this.data.playMode === "song") {
      this.data.selectedBlocks = [...this.data.playlist];
      this.uiManager.renderPlaylistBlocks();
    } else {
      const pat = this.data.patterns.find(
        (p) => p.id === this.data.activePatternId,
      );
      if (pat && pat.data[this.data.activeChannelId]) {
        this.data.selectedNotes = [...pat.data[this.data.activeChannelId]];
        this.uiManager.renderEditorData();
      }
    }
  }

  duplicateSelected() {
    if (this.data.playMode === "song") {
      if (!this.data.selectedBlocks || this.data.selectedBlocks.length === 0)
        return;

      const maxTick = Math.max(
        ...this.data.selectedBlocks.map(
          (b) => b.startTick + this.stateManager.getPatternLength(b.patternId),
        ),
      );
      const minTick = Math.min(
        ...this.data.selectedBlocks.map((b) => b.startTick),
      );
      const offset = maxTick - minTick || this.data.playlistSnap;

      const newBlocks = this.data.selectedBlocks.map((b) => ({
        id: this.data.nextBlockId++,
        patternId: b.patternId,
        trackIndex: b.trackIndex,
        startTick: b.startTick + offset,
      }));
      this.data.playlist.push(...newBlocks);
      this.data.selectedBlocks = newBlocks;
      this.uiManager.renderPlaylistBlocks();
      this.stateManager.pushHistory();
    } else {
      if (!this.data.selectedNotes || this.data.selectedNotes.length === 0)
        return;
      const activePat = this.data.patterns.find(
        (p) => p.id === this.data.activePatternId,
      );
      const activeCh = this.data.channels.find(
        (c) => c.id === this.data.activeChannelId,
      );
      if (!activePat || !activeCh || activeCh.isDrum) return;

      const maxTick = Math.max(
        ...this.data.selectedNotes.map((n) => n.startTick + n.durationTicks),
      );
      const minTick = Math.min(
        ...this.data.selectedNotes.map((n) => n.startTick),
      );
      const offset = maxTick - minTick || this.data.snapTicks;

      const newNotes = this.data.selectedNotes.map((n) => ({
        pitch: n.pitch,
        startTick: n.startTick + offset,
        durationTicks: n.durationTicks,
        lyric: n.lyric,
        velocity: n.velocity,
      }));

      activePat.data[activeCh.id].push(...newNotes);
      this.data.selectedNotes = newNotes;
      this.uiManager.renderEditorData();
      this.uiManager.renderPlaylistBlocks();
      this.stateManager.pushHistory();
    }
  }

  shiftSelectedPitch(amount) {
    if (
      this.data.playMode === "song" ||
      !this.data.selectedNotes ||
      this.data.selectedNotes.length === 0
    )
      return;

    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (activeCh && activeCh.isDrum) return;

    const chVol =
      activeCh && activeCh.volume !== undefined ? activeCh.volume : 100;
    const chPan = activeCh && activeCh.pan !== undefined ? activeCh.pan : 64;

    let changed = false;
    this.data.selectedNotes.forEach((n) => {
      const idx = PITCHES.indexOf(n.pitch);
      if (idx > -1) {
        const newIdx = Math.max(0, Math.min(PITCHES.length - 1, idx + amount));
        if (newIdx !== idx) {
          n.pitch = PITCHES[newIdx];
          changed = true;
        }
      }
    });

    if (changed) {
      this.uiManager.renderEditorData();
      this.playbackManager.playNotePreview(
        this.data.selectedNotes[0].pitch,
        false,
        chVol,
        chPan,
      );
      this.stateManager.pushHistory();
    }
  }
}
