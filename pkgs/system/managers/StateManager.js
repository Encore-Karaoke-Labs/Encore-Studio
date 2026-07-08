import { COLORS } from "../utils/Constants.js";

export default class StateManager {
  constructor() {
    this.resetState();
  }

  resetState() {
    this.data = {
      tempo: 120,
      snapTicks: 64,
      playlistSnap: 512,
      scaleRoot: "C",
      scaleType: "Major",
      isPlaying: false,
      playMode: "song",

      zoomX: 2,
      zoomY: 24,
      playlistZoomX: 0.25,
      playlistZoomY: 40,

      activeControl: "velocity",

      channels: [
        {
          id: 1,
          name: "Grand Piano",
          instrument: 0,
          isDrum: false,
          color: COLORS[0],
          volume: 100,
          pan: 64,
        },
        {
          id: 2,
          name: "808 Kit",
          instrument: 0,
          isDrum: true,
          color: COLORS[1],
          volume: 100,
          pan: 64,
        },
      ],
      nextChannelId: 3,
      activeChannelId: 1,

      patterns: [
        {
          id: 1,
          name: "Pattern 1",
          color: COLORS[0],
          data: {},
          automation: {},
        },
      ],
      nextPatternId: 2,
      activePatternId: 1,

      playlist: [],
      nextBlockId: 1,

      selectedNotes: [],
      selectedBlocks: [],
      draggedItem: null,
      lastNoteDuration: {},

      dragState: { active: false, type: null, hasMoved: false },
    };

    this.history = [];
    this.historyIndex = -1;
    this.onHistoryChange = null;
  }

  getPatternLength(patId) {
    const pat = this.data.patterns.find((p) => p.id === patId);
    if (!pat || !pat.data) return 512;
    let maxTick = 0;
    Object.values(pat.data).forEach((notes) => {
      notes.forEach((n) => {
        if (n.startTick + n.durationTicks > maxTick)
          maxTick = n.startTick + n.durationTicks;
      });
    });
    return Math.max(512, Math.ceil(maxTick / 512) * 512);
  }

  pushHistory() {
    const snapshot = JSON.stringify({
      patterns: this.data.patterns,
      channels: this.data.channels,
      playlist: this.data.playlist,
      tempo: this.data.tempo,
      activeChannelId: this.data.activeChannelId,
      activePatternId: this.data.activePatternId,
      nextChannelId: this.data.nextChannelId,
      nextPatternId: this.data.nextPatternId,
      nextBlockId: this.data.nextBlockId,
    });

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snapshot);

    if (this.history.length > 50) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
    if (this.onHistoryChange) this.onHistoryChange();
  }

  applyHistory(index) {
    if (index < 0 || index >= this.history.length) return;
    const snapshot = JSON.parse(this.history[index]);

    Object.assign(this.data, snapshot);
    this.historyIndex = index;

    this.data.selectedNotes = [];
    this.data.selectedBlocks = [];
    this.data.dragState.active = false;

    if (this.onHistoryChange) this.onHistoryChange(true);
  }

  undo() {
    this.applyHistory(this.historyIndex - 1);
  }

  redo() {
    this.applyHistory(this.historyIndex + 1);
  }
}
