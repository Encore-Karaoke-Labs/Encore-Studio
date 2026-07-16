import Html from "/libs/html.js";
import {
  showDropdown,
  triggerRename,
  triggerColorPicker,
  makeListDraggableScoped,
} from "../utils/UIUtils.js";
import {
  RULER_HEIGHT,
  GM_INSTRUMENTS,
  PITCHES,
  DRUMS,
  CHROMA,
  SCALES,
  COLORS,
} from "../utils/Constants.js";

export default class UIManager {
  constructor(stateManager, playbackManager) {
    this.stateManager = stateManager;
    this.playbackManager = playbackManager;
    this.data = this.stateManager.data;

    this.elements = {};
    this.hasSnappedToC5 = false;
  }

  buildLayout(wrapper, projectManager) {
    this.buildToolbar(wrapper, projectManager);

    const workspace = new Html("div").classOn("st-workspace").appendTo(wrapper);
    this.elements.workspace = workspace;

    this.buildTopPane(workspace);

    this.elements.splitter = new Html("div")
      .classOn("st-splitter")
      .appendTo(workspace);
    this.elements.splitter.on("mousedown", (e) => {
      e.preventDefault();
      this.data.dragState = { active: true, type: "splitter_main" };
      this.elements.splitter.classOn("active");
      document.body.style.cursor = "ns-resize";
    });

    this.buildBottomPane(workspace);
  }

  buildToolbar(wrapper, projectManager) {
    const toolbar = new Html("div").classOn("st-toolbar").appendTo(wrapper);
    new Html("h1").text("Encore Studio").appendTo(toolbar);

    this.elements.playToggleBtn = new Html("div")
      .classOn("st-btn", "gold")
      .appendTo(toolbar)
      .on("click", () => this.playbackManager.togglePlayback());

    this.elements.modeToggleBtn = new Html("div")
      .classOn("st-btn")
      .appendTo(toolbar)
      .on("click", () =>
        this.playbackManager.setPlayMode(
          this.data.playMode === "song" ? "pat" : "song",
        ),
      );

    this.updatePlayBtnText();

    new Html("span").text("Tempo:").appendTo(toolbar);
    this.elements.tempoInput = new Html("input")
      .classOn("st-input", "st-tempo-input")
      .attr({
        type: "text",
        readonly: "true",
        title: "Drag up/down, or Scroll Wheel",
      })
      .val(this.data.tempo)
      .appendTo(toolbar);

    this.elements.tempoInput.on("mousedown", (e) => {
      e.preventDefault();
      this.data.dragState = {
        active: true,
        type: "tempo_drag",
        startY: e.clientY,
        startVal: this.data.tempo,
      };
    });

    let tempoWheelTimer;
    this.elements.tempoInput.on("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      this.data.tempo = Math.max(10, Math.min(999, this.data.tempo + dir));
      this.elements.tempoInput.val(this.data.tempo);
      clearTimeout(tempoWheelTimer);
      tempoWheelTimer = setTimeout(() => this.stateManager.pushHistory(), 400);
    });

    this.buildSnapAndScale(toolbar);

    new Html("div")
      .classOn("st-btn")
      .text("Insert Lyrics")
      .attr({ title: "Apply lyrics to selected notes" })
      .appendTo(toolbar)
      .on("click", () => this.promptBulkLyrics());

    const historyGroup = new Html("div")
      .styleJs({ display: "flex", gap: "5px", marginLeft: "10px" })
      .appendTo(toolbar);
    this.elements.undoBtn = new Html("div")
      .html("↶")
      .classOn("st-btn", "st-btn-small")
      .appendTo(historyGroup)
      .on("click", () => this.stateManager.undo());
    this.elements.redoBtn = new Html("div")
      .html("↷")
      .classOn("st-btn", "st-btn-small")
      .appendTo(historyGroup)
      .on("click", () => this.stateManager.redo());

    const fileDropdown = new Html("div")
      .classOn("st-dropdown")
      .styleJs({ marginLeft: "auto" })
      .appendTo(toolbar);
    new Html("div")
      .text("File Options...")
      .classOn("st-btn")
      .appendTo(fileDropdown)
      .on("mousedown", (e) => {
        showDropdown(e, [
          { label: "Load JSON", action: () => projectManager.loadProject() },
          { label: "Save JSON", action: () => projectManager.saveProject() },
          { label: "Export MIDI", action: () => projectManager.exportMidi() },
        ]);
      });
  }

  buildSnapAndScale(toolbar) {
    new Html("span").text("Snap:").appendTo(toolbar);
    const snapSelect = new Html("select")
      .classOn("st-select")
      .appendTo(toolbar);
    [
      { l: "1/4 (Beat)", v: 128 },
      { l: "1/8", v: 64 },
      { l: "1/16", v: 32 },
      { l: "None", v: 1 },
    ].forEach((opt) => {
      const el = new Html("option")
        .attr({ value: opt.v })
        .text(opt.l)
        .appendTo(snapSelect);
      if (opt.v === this.data.snapTicks) el.attr({ selected: true });
    });
    snapSelect.on("change", (e) => {
      this.data.snapTicks = parseInt(e.target.value);
      this.renderPianoRollGrid();
    });

    new Html("span").text("Scale:").appendTo(toolbar);
    const rootSelect = new Html("select")
      .classOn("st-select")
      .appendTo(toolbar);
    CHROMA.forEach((n) =>
      new Html("option").attr({ value: n }).text(n).appendTo(rootSelect),
    );
    rootSelect.on("change", (e) => {
      this.data.scaleRoot = e.target.value;
      this.renderPianoRollGrid();
    });

    const scaleSelect = new Html("select")
      .classOn("st-select")
      .appendTo(toolbar);
    Object.keys(SCALES).forEach((s) =>
      new Html("option").attr({ value: s }).text(s).appendTo(scaleSelect),
    );
    scaleSelect.on("change", (e) => {
      this.data.scaleType = e.target.value;
      this.renderPianoRollGrid();
    });
  }

  buildTopPane(workspace) {
    this.elements.topPane = new Html("div")
      .classOn("st-pane")
      .appendTo(workspace);
    this.elements.topPane.elm.addEventListener(
      "mousedown",
      () => {
        if (!this.data.isPlaying) this.playbackManager.setPlayMode("song");
      },
      true,
    );

    const patternSidebar = new Html("div")
      .classOn("st-sidebar")
      .appendTo(this.elements.topPane);
    const patHeader = new Html("div")
      .classOn("st-sidebar-header")
      .text("Patterns")
      .appendTo(patternSidebar);

    new Html("div")
      .text("+ Pat")
      .classOn("st-btn", "st-btn-small")
      .appendTo(patHeader)
      .on("click", () => {
        this.data.patterns.push({
          id: this.data.nextPatternId++,
          name: `Pattern ${this.data.nextPatternId - 1}`,
          color: COLORS[this.data.nextPatternId % COLORS.length],
          data: {},
          automation: {},
        });
        this.renderPatternList();
        this.stateManager.pushHistory();
      });

    this.elements.patListEl = new Html("div").appendTo(patternSidebar);

    const playlistArea = new Html("div")
      .classOn("st-grid-area")
      .appendTo(this.elements.topPane);
    this.elements.playlistScroll = new Html("div")
      .classOn("st-grid-scroll")
      .appendTo(playlistArea);
    this.elements.playlistGridEl = new Html("div")
      .classOn("st-grid")
      .appendTo(this.elements.playlistScroll);
    this.elements.playlistBg = new Html("div")
      .classOn("st-grid-bg")
      .appendTo(this.elements.playlistGridEl);
    this.elements.playheadPlaylist = new Html("div")
      .classOn("st-playhead")
      .appendTo(this.elements.playlistGridEl);

    this.elements.playlistGridEl.on("mousedown", (e) =>
      this.handlePlaylistMouseDown(e),
    );
  }

  buildBottomPane(workspace) {
    this.elements.bottomPane = new Html("div")
      .classOn("st-pane", "bottom")
      .appendTo(workspace);
    this.elements.bottomPane.elm.addEventListener(
      "mousedown",
      () => {
        if (!this.data.isPlaying) this.playbackManager.setPlayMode("pat");
      },
      true,
    );

    const channelSidebar = new Html("div")
      .classOn("st-sidebar")
      .appendTo(this.elements.bottomPane);
    const chHeader = new Html("div")
      .classOn("st-sidebar-header")
      .text("Instruments")
      .appendTo(channelSidebar);

    new Html("div")
      .text("+ Add")
      .classOn("st-btn", "st-btn-small")
      .appendTo(chHeader)
      .on("mousedown", (e) => {
        showDropdown(e, [
          { label: "Instrument", action: () => this.addChannel(false) },
          { label: "Drums", action: () => this.addChannel(true) },
        ]);
      });

    this.elements.chListEl = new Html("div").appendTo(channelSidebar);

    this.buildEditorArea(this.elements.bottomPane);
    this.buildLyricSidebar(this.elements.bottomPane);
  }

  buildEditorArea(bottomPane) {
    const editorArea = new Html("div")
      .classOn("st-grid-area")
      .styleJs({ flexDirection: "column" })
      .appendTo(bottomPane);
    this.elements.editorArea = editorArea;

    const prContainer = new Html("div")
      .styleJs({ display: "flex", flex: 1, overflow: "hidden" })
      .appendTo(editorArea);
    this.elements.prKeys = new Html("div")
      .classOn("st-keys")
      .appendTo(prContainer);
    this.elements.prScroll = new Html("div")
      .classOn("st-grid-scroll")
      .appendTo(prContainer);
    this.elements.editorGridEl = new Html("div")
      .classOn("st-grid")
      .appendTo(this.elements.prScroll);
    this.elements.prBg = new Html("div")
      .classOn("st-grid-bg")
      .appendTo(this.elements.editorGridEl);
    this.elements.playheadEditor = new Html("div")
      .classOn("st-playhead")
      .appendTo(this.elements.editorGridEl);

    this.elements.editorGridEl.on("mousedown", (e) =>
      this.handleEditorMouseDown(e),
    );

    this.elements.prSplitter = new Html("div")
      .classOn("st-splitter")
      .styleJs({ height: "4px", cursor: "ns-resize" })
      .appendTo(editorArea);
    this.elements.prSplitter.on("mousedown", (e) => {
      e.preventDefault();
      this.data.dragState = {
        active: true,
        type: "splitter_pr",
        startY: e.clientY,
        startHeight: this.elements.controlContainer.elm.clientHeight,
      };
      this.elements.prSplitter.classOn("active");
      document.body.style.cursor = "ns-resize";
    });

    this.elements.controlContainer = new Html("div")
      .styleJs({
        display: "flex",
        height: "120px",
        flexShrink: 0,
        background: "#0c0c11",
      })
      .appendTo(editorArea);

    const controlSidebar = new Html("div")
      .classOn("st-control-sidebar")
      .appendTo(this.elements.controlContainer);
    const controlDropdown = new Html("select")
      .classOn("st-control-dropdown")
      .appendTo(controlSidebar);

    [
      { l: "Velocity", v: "velocity" },
      { l: "Pan (10)", v: "10" },
      { l: "Volume (7)", v: "7" },
      { l: "Modulation (1)", v: "1" },
      { l: "Expression (11)", v: "11" },
      { l: "Sustain (64)", v: "64" },
    ].forEach((opt) =>
      new Html("option")
        .attr({ value: opt.v })
        .text(opt.l)
        .appendTo(controlDropdown),
    );
    controlDropdown.on("change", (e) => {
      this.data.activeControl = e.target.value;
      this.renderControlGrid();
    });

    this.elements.controlScroll = new Html("div")
      .classOn("st-grid-scroll")
      .styleJs({ overflowY: "hidden" })
      .appendTo(this.elements.controlContainer);
    this.elements.controlGridEl = new Html("div")
      .classOn("st-grid")
      .appendTo(this.elements.controlScroll);
    this.elements.controlBg = new Html("div")
      .classOn("st-grid-bg")
      .appendTo(this.elements.controlGridEl);

    this.elements.prScroll.on("scroll", (e) => {
      if (this.elements.prKeys.elm)
        this.elements.prKeys.elm.scrollTop = e.target.scrollTop;
      if (this.elements.controlScroll.elm)
        this.elements.controlScroll.elm.scrollLeft = e.target.scrollLeft;
    });
    this.elements.controlScroll.on("scroll", (e) => {
      if (this.elements.prScroll.elm)
        this.elements.prScroll.elm.scrollLeft = e.target.scrollLeft;
    });

    this.elements.controlGridEl.on("mousedown", (e) =>
      this.handleControlMouseDown(e),
    );
  }

  buildLyricSidebar(bottomPane) {
    const lyricSidebar = new Html("div")
      .classOn("st-right-sidebar")
      .appendTo(bottomPane);
    new Html("div")
      .classOn("st-sidebar-header")
      .text("Lyric Preview")
      .appendTo(lyricSidebar);
    this.elements.lyricPreviewContent = new Html("div")
      .classOn("st-lyric-preview")
      .appendTo(lyricSidebar);
  }

  fullRender() {
    this.renderPatternList();
    this.renderChannelList();
    this.renderPlaylistGrid();
    this.renderPianoRollGrid();
  }

  updateHistoryButtons() {
    if (!this.elements.undoBtn || !this.elements.redoBtn) return;
    const { history, historyIndex } = this.stateManager;

    if (historyIndex <= 0)
      this.elements.undoBtn.styleJs({ opacity: "0.3", pointerEvents: "none" });
    else this.elements.undoBtn.styleJs({ opacity: "1", pointerEvents: "auto" });

    if (historyIndex >= history.length - 1)
      this.elements.redoBtn.styleJs({ opacity: "0.3", pointerEvents: "none" });
    else this.elements.redoBtn.styleJs({ opacity: "1", pointerEvents: "auto" });
  }

  updatePlayBtnText() {
    if (!this.elements.modeToggleBtn) return;
    this.elements.modeToggleBtn.text(
      this.data.playMode === "song" ? "🎵 Song" : "🧩 Pat",
    );
    if (this.data.playMode === "song") {
      this.elements.modeToggleBtn.styleJs({
        borderColor: "var(--encore-blue)",
        color: "var(--encore-blue)",
      });
    } else {
      this.elements.modeToggleBtn.styleJs({
        borderColor: "var(--encore-orange)",
        color: "var(--encore-orange)",
      });
    }

    if (this.data.isPlaying)
      this.elements.playToggleBtn.html(`■ Stop`).classOn("play-active");
    else this.elements.playToggleBtn.html(`▶ Play`).classOff("play-active");
  }

  renderPatternList() {
    const parent = this.elements.patListEl.elm.parentElement;
    const prevTop = parent ? parent.scrollTop : 0;
    this.elements.patListEl.clear();

    this.data.patterns.forEach((pat) => {
      const item = new Html("div")
        .classOn("st-list-item")
        .appendTo(this.elements.patListEl);
      if (this.data.activePatternId === pat.id) item.classOn("active");

      const top = new Html("div").classOn("st-list-top").appendTo(item);
      const left = new Html("div").classOn("st-list-left").appendTo(top);
      new Html("div")
        .classOn("st-color-swatch")
        .styleJs({ background: pat.color })
        .appendTo(left);
      const nameSpan = new Html("span")
        .classOn("st-list-name")
        .text(pat.name)
        .appendTo(left);

      item.on("mousedown", (e) => {
        if (
          e.target.closest(".st-btn") ||
          e.target.getAttribute("contenteditable") === "true"
        )
          return;
        this.data.activePatternId = pat.id;
        this.data.selectedNotes = [];
        this.renderPatternList();
        this.renderEditorData();
      });

      item.on("contextmenu", (e) => {
        showDropdown(
          e,
          [
            {
              label: "Rename",
              action: () =>
                triggerRename(
                  nameSpan,
                  pat,
                  "name",
                  () => this.renderPatternList(),
                  () => this.stateManager.pushHistory(),
                ),
            },
            {
              label: "Change Color",
              action: () => {
                triggerColorPicker(pat.color, (c) => {
                  pat.color = c;
                  this.renderPatternList();
                  this.renderPlaylistBlocks();
                  this.renderEditorData();
                  this.stateManager.pushHistory();
                });
              },
            },
            {
              label: "Duplicate",
              action: () => {
                const newId = this.data.nextPatternId++;
                const newData = {};
                for (let ch in pat.data)
                  newData[ch] = pat.data[ch].map((n) => ({ ...n }));
                const newAuto = {};
                if (pat.automation) {
                  for (let ch in pat.automation) {
                    newAuto[ch] = {};
                    for (let cc in pat.automation[ch]) {
                      newAuto[ch][cc] = pat.automation[ch][cc].map((ev) => ({
                        ...ev,
                      }));
                    }
                  }
                }
                this.data.patterns.push({
                  id: newId,
                  name: `${pat.name} (copy)`,
                  color: pat.color,
                  data: newData,
                  automation: newAuto,
                });
                this.renderPatternList();
                this.stateManager.pushHistory();
              },
            },
            {
              label: "Delete",
              color: "#ff5555",
              action: () => {
                if (this.data.patterns.length <= 1)
                  return alert("Must have at least one pattern.");
                this.data.patterns = this.data.patterns.filter(
                  (p) => p.id !== pat.id,
                );
                if (this.data.activePatternId === pat.id)
                  this.data.activePatternId = this.data.patterns[0].id;
                this.data.playlist = this.data.playlist.filter(
                  (b) => b.patternId !== pat.id,
                );
                this.fullRender();
                this.stateManager.pushHistory();
              },
            },
          ],
          true,
        );
      });
      makeListDraggableScoped(
        item,
        this.data.patterns,
        pat,
        this.data,
        () => this.renderPatternList(),
        () => this.stateManager.pushHistory(),
      );
    });
    if (parent) parent.scrollTop = prevTop;
  }

  renderChannelList() {
    const parent = this.elements.chListEl.elm.parentElement;
    const prevTop = parent ? parent.scrollTop : 0;
    this.elements.chListEl.clear();

    this.data.channels.forEach((ch) => {
      const item = new Html("div")
        .classOn("st-list-item")
        .appendTo(this.elements.chListEl);
      if (this.data.activeChannelId === ch.id) item.classOn("active");

      const top = new Html("div").classOn("st-list-top").appendTo(item);
      const left = new Html("div").classOn("st-list-left").appendTo(top);
      new Html("div")
        .classOn("st-color-swatch")
        .styleJs({ background: ch.color || COLORS[ch.id % COLORS.length] })
        .appendTo(left);
      const nameSpan = new Html("span")
        .classOn("st-list-name")
        .text(ch.name)
        .appendTo(left);

      const rightGrp = new Html("div").classOn("st-right-grp").appendTo(top);
      if (ch.isDrum)
        new Html("span")
          .text("DRUMS")
          .styleJs({
            fontSize: "0.7rem",
            color: "var(--encore-orange)",
            fontWeight: "bold",
          })
          .appendTo(rightGrp);

      const btm = new Html("div")
        .styleJs({
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: "10px",
          marginTop: "4px",
        })
        .appendTo(item);

      if (!ch.isDrum) {
        new Html("div")
          .classOn("st-btn")
          .styleJs({
            width: "100%",
            padding: "6px 10px",
            fontSize: "0.85rem",
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(137,207,240,0.5)",
          })
          .text(`🎹 ${GM_INSTRUMENTS[ch.instrument]}`)
          .appendTo(btm)
          .on("mousedown", (e) => {
            e.stopPropagation();
            this.data.activeChannelId = ch.id;
            this.data.selectedNotes = [];
            this.openInstrumentModal(ch);
            this.renderChannelList();
            this.renderPianoRollGrid();
          });
      }

      this.createSlider(btm, "🔈", ch, "volume", 100, 100);
      this.createSlider(btm, "LR", ch, "pan", 64, 127);

      item.on("mousedown", (e) => {
        if (
          e.target.closest(".st-btn") ||
          e.target.getAttribute("contenteditable") === "true" ||
          e.target.closest("input")
        )
          return;
        this.data.activeChannelId = ch.id;
        this.data.selectedNotes = [];
        this.renderChannelList();
        this.renderPianoRollGrid();
      });

      item.on("contextmenu", (e) => {
        showDropdown(
          e,
          [
            {
              label: "Rename",
              action: () =>
                triggerRename(
                  nameSpan,
                  ch,
                  "name",
                  () => this.renderChannelList(),
                  () => this.stateManager.pushHistory(),
                ),
            },
            {
              label: "Change Color",
              action: () => {
                triggerColorPicker(
                  ch.color || COLORS[ch.id % COLORS.length],
                  (c) => {
                    ch.color = c;
                    this.renderChannelList();
                    this.stateManager.pushHistory();
                  },
                );
              },
            },
            {
              label: "Duplicate",
              action: () => {
                const newId = this.data.nextChannelId++;
                this.data.channels.push({
                  id: newId,
                  name: `${ch.name} (copy)`,
                  color: ch.color,
                  instrument: ch.instrument,
                  isDrum: ch.isDrum,
                  volume: ch.volume !== undefined ? ch.volume : 100,
                  pan: ch.pan !== undefined ? ch.pan : 64,
                });
                this.data.patterns.forEach((p) => {
                  if (p.data[ch.id])
                    p.data[newId] = p.data[ch.id].map((n) => ({ ...n }));
                  if (p.automation && p.automation[ch.id]) {
                    if (!p.automation[newId]) p.automation[newId] = {};
                    for (let cc in p.automation[ch.id]) {
                      p.automation[newId][cc] = p.automation[ch.id][cc].map(
                        (ev) => ({ ...ev }),
                      );
                    }
                  }
                });
                this.renderChannelList();
                this.stateManager.pushHistory();
              },
            },
            {
              label: "Delete",
              color: "#ff5555",
              action: () => {
                if (this.data.channels.length <= 1)
                  return alert("Must have at least one channel.");
                this.data.channels = this.data.channels.filter(
                  (c) => c.id !== ch.id,
                );
                this.data.patterns.forEach((p) => {
                  delete p.data[ch.id];
                  if (p.automation) delete p.automation[ch.id];
                });
                if (this.data.activeChannelId === ch.id)
                  this.data.activeChannelId = this.data.channels[0].id;
                this.renderChannelList();
                this.renderPianoRollGrid();
                this.stateManager.pushHistory();
              },
            },
          ],
          true,
        );
      });

      makeListDraggableScoped(
        item,
        this.data.channels,
        ch,
        this.data,
        () => this.renderChannelList(),
        () => this.stateManager.pushHistory(),
      );
    });
    if (parent) parent.scrollTop = prevTop;
  }

  createSlider(parent, label, ch, key, defaultVal, maxVal) {
    const container = new Html("div")
      .styleJs({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
      })
      .appendTo(parent);
    new Html("span")
      .text(label)
      .styleJs({
        fontSize: "0.9rem",
        opacity: "0.7",
        width: "16px",
        textAlign: "center",
      })
      .appendTo(container);
    const slider = new Html("input")
      .classOn("st-vol-slider")
      .attr({ type: "range", min: "0", max: maxVal.toString() })
      .val(ch[key] !== undefined ? ch[key] : defaultVal)
      .appendTo(container);

    slider.on("mousedown", (e) => e.stopPropagation());
    slider.on("input", (e) => (ch[key] = parseInt(e.target.value)));
    slider.on("change", () => this.stateManager.pushHistory());
  }

  renderPlaylistGrid() {
    const prevTop = this.elements.playlistScroll.elm
      ? this.elements.playlistScroll.elm.scrollTop
      : 0;
    const prevLeft = this.elements.playlistScroll.elm
      ? this.elements.playlistScroll.elm.scrollLeft
      : 0;
    this.elements.playlistBg.clear();

    const numTracks = 10;
    let maxPlTick = 0;
    this.data.playlist.forEach((b) => {
      const len = this.stateManager.getPatternLength(b.patternId);
      if (b.startTick + len > maxPlTick) maxPlTick = b.startTick + len;
    });

    const requiredPlWidthPx = (maxPlTick + 128 * 16) * this.data.playlistZoomX;
    const finalPlWidthPx = Math.max(8000, requiredPlWidthPx);
    const finalPlMaxTicks = finalPlWidthPx / this.data.playlistZoomX;

    this.elements.playlistGridEl.styleJs({
      height: `${numTracks * this.data.playlistZoomY + RULER_HEIGHT}px`,
      width: `${finalPlWidthPx}px`,
    });

    new Html("div").classOn("st-timeline").appendTo(this.elements.playlistBg);

    for (let i = 0; i < numTracks; i++) {
      new Html("div")
        .classOn("st-track-row")
        .styleJs({
          top: `${i * this.data.playlistZoomY + RULER_HEIGHT}px`,
          height: `${this.data.playlistZoomY}px`,
        })
        .appendTo(this.elements.playlistBg);
    }

    for (let t = 0; t < finalPlMaxTicks; t += this.data.playlistSnap) {
      const col = new Html("div")
        .classOn("st-col-line")
        .styleJs({ left: `${t * this.data.playlistZoomX}px` })
        .appendTo(this.elements.playlistBg);
      if (t % (512 * 4) === 0) col.classOn("bar");
      else col.classOn("beat");
    }

    this.renderPlaylistBlocks();

    if (this.elements.playlistScroll.elm) {
      this.elements.playlistScroll.elm.scrollTop = prevTop;
      this.elements.playlistScroll.elm.scrollLeft = prevLeft;
    }
  }

  renderPlaylistBlocks() {
    Array.from(
      this.elements.playlistGridEl.elm.querySelectorAll(".st-pattern-block"),
    ).forEach((el) => el.remove());

    this.data.playlist.forEach((block) => {
      const pat = this.data.patterns.find((p) => p.id === block.patternId);
      if (!pat) return;
      const len = this.stateManager.getPatternLength(pat.id);

      const el = new Html("div")
        .classOn("st-pattern-block")
        .appendTo(this.elements.playlistGridEl);
      el.styleJs({
        top: `${block.trackIndex * this.data.playlistZoomY + RULER_HEIGHT + 1}px`,
        left: `${block.startTick * this.data.playlistZoomX}px`,
        width: `${len * this.data.playlistZoomX}px`,
        background: pat.color,
      });

      new Html("div").classOn("st-pattern-name").text(pat.name).appendTo(el);

      const notesContainer = new Html("div")
        .classOn("st-pattern-notes")
        .appendTo(el);

      let minRow = PITCHES.length;
      let maxRow = -1;
      Object.values(pat.data).forEach((notes) => {
        notes.forEach((n) => {
          const r = PITCHES.indexOf(n.pitch);
          if (r > -1) {
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
          }
        });
      });

      if (maxRow >= minRow) {
        const rowRange = Math.max(12, maxRow - minRow + 4);
        const startR = minRow - 2;
        const heightPx = Math.max(2, 24 / rowRange);

        Object.values(pat.data).forEach((notes) => {
          notes.forEach((n) => {
            const r = PITCHES.indexOf(n.pitch);
            if (r > -1) {
              const topPct = ((r - startR) / rowRange) * 100;
              const leftPx = n.startTick * this.data.playlistZoomX;
              const widthPx = Math.max(
                1,
                n.durationTicks * this.data.playlistZoomX,
              );

              new Html("div")
                .classOn("st-pattern-note")
                .styleJs({
                  top: `${topPct}%`,
                  left: `${leftPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                })
                .appendTo(notesContainer);
            }
          });
        });
      }

      if (this.data.selectedBlocks && this.data.selectedBlocks.includes(block))
        el.classOn("selected");

      Object.defineProperty(block, "_el", {
        value: el.elm,
        writable: true,
        configurable: true,
        enumerable: false,
      });

      el.on("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.data.selectedBlocks.includes(block)) {
          this.data.playlist = this.data.playlist.filter(
            (b) => !this.data.selectedBlocks.includes(b),
          );
          this.data.selectedBlocks = [];
        } else {
          this.data.playlist = this.data.playlist.filter(
            (b) => b.id !== block.id,
          );
        }
        this.renderPlaylistBlocks();
        this.stateManager.pushHistory();
      });

      el.on("mousedown", (e) => this.handleBlockMouseDown(e, block, el));
    });
  }

  renderPianoRollGrid() {
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (!activeCh) return;

    const prevTop = this.elements.prScroll.elm
      ? this.elements.prScroll.elm.scrollTop
      : 0;
    const prevLeft = this.elements.prScroll.elm
      ? this.elements.prScroll.elm.scrollLeft
      : 0;
    const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
    const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;

    if (activeCh.isDrum) {
      this.elements.prKeys.styleJs({ display: "none" });
      this.elements.prBg.styleJs({ display: "none" });
      this.elements.playheadEditor.styleJs({ display: "none" });
      this.elements.editorGridEl.styleJs({ height: "100%", width: "100%" });
      this.renderEditorData();
      if (this.elements.prScroll.elm) {
        this.elements.prScroll.elm.scrollTop = prevTop;
        this.elements.prScroll.elm.scrollLeft = prevLeft;
      }
      return;
    }

    this.elements.prKeys.styleJs({ display: "block" });
    this.elements.prBg.styleJs({ display: "block" });
    this.elements.playheadEditor.styleJs({ display: "block" });
    this.elements.prBg.clear();
    this.elements.prKeys.clear();

    let maxPrTick = 0;
    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    if (activePat) {
      Object.values(activePat.data).forEach((notes) => {
        notes.forEach((n) => {
          if (n.startTick + n.durationTicks > maxPrTick)
            maxPrTick = n.startTick + n.durationTicks;
        });
      });
    }

    const requiredPrWidthPx = (maxPrTick + 128 * 16) * this.data.zoomX;
    const finalPrWidthPx = Math.max(8000, requiredPrWidthPx);
    const finalPrMaxTicks = finalPrWidthPx / this.data.zoomX;

    this.elements.editorGridEl.styleJs({
      height: `${PITCHES.length * this.data.zoomY + RULER_HEIGHT}px`,
      width: `${finalPrWidthPx}px`,
    });

    new Html("div")
      .classOn("st-timeline-corner")
      .appendTo(this.elements.prKeys);

    for (let i = 0; i < PITCHES.length; i++) {
      const pitch = PITCHES[i];
      const isBlack = pitch.includes("#");
      const isC = pitch.startsWith("C") && !isBlack;
      const key = new Html("div")
        .classOn("st-key", isBlack ? "black" : "white")
        .text(isC ? pitch : "")
        .styleJs({ top: `${i * this.data.zoomY + RULER_HEIGHT}px` })
        .appendTo(this.elements.prKeys);

      if (isC) key.classOn("is-c");
      key.on("mousedown", () =>
        this.playbackManager.playNotePreview(pitch, false, chVol, chPan),
      );
    }

    const rootIndex = CHROMA.indexOf(this.data.scaleRoot);
    const scaleIntervals = SCALES[this.data.scaleType];

    new Html("div").classOn("st-timeline").appendTo(this.elements.prBg);

    for (let i = 0; i < PITCHES.length; i++) {
      const row = new Html("div")
        .classOn("st-row")
        .styleJs({
          top: `${i * this.data.zoomY + RULER_HEIGHT}px`,
          height: `${this.data.zoomY}px`,
        })
        .appendTo(this.elements.prBg);

      const pitchIdx = CHROMA.indexOf(PITCHES[i].replace(/[0-9]/g, ""));
      const relativeDiff = (pitchIdx - rootIndex + 12) % 12;
      if (relativeDiff === 0) row.classOn("root");
      else if (scaleIntervals.includes(relativeDiff)) row.classOn("in-scale");
    }

    for (let t = 0; t < finalPrMaxTicks; t += this.data.snapTicks) {
      const col = new Html("div")
        .classOn("st-col-line")
        .styleJs({ left: `${t * this.data.zoomX}px` })
        .appendTo(this.elements.prBg);
      if (t % 128 === 0) col.classOn("beat");
      if (t % 512 === 0) col.classOn("bar");
    }

    this.renderEditorData();

    setTimeout(() => {
      if (!this.hasSnappedToC5) {
        const c5 = PITCHES.indexOf("C5");
        if (c5 > -1 && this.elements.prScroll.elm) {
          this.elements.prScroll.elm.scrollTop =
            c5 * this.data.zoomY +
            RULER_HEIGHT -
            this.elements.prScroll.elm.clientHeight / 2;
          this.hasSnappedToC5 = true;
        }
      } else {
        if (this.elements.prScroll.elm) {
          this.elements.prScroll.elm.scrollTop = prevTop;
          this.elements.prScroll.elm.scrollLeft = prevLeft;
        }
      }
    }, 0);
  }

  renderEditorData() {
    Array.from(
      this.elements.editorGridEl.elm.querySelectorAll(
        ".st-note, .st-drum-seq-container, .st-selection-box",
      ),
    ).forEach((el) => el.remove());

    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (!activePat || !activeCh) return;

    if (!activePat.data[activeCh.id]) activePat.data[activeCh.id] = [];
    const notes = activePat.data[activeCh.id];

    if (activeCh.isDrum) {
      this.renderDrumSequencer(activePat, activeCh);
      this.renderLyricPreview();
      this.renderControlGrid();
      return;
    }

    notes.forEach((note) => {
      const row = PITCHES.indexOf(note.pitch);
      if (row === -1) return;

      const noteEl = new Html("div")
        .classOn("st-note")
        .appendTo(this.elements.editorGridEl);
      noteEl.styleJs({
        top: `${row * this.data.zoomY + RULER_HEIGHT + 1}px`,
        left: `${note.startTick * this.data.zoomX}px`,
        width: `${note.durationTicks * this.data.zoomX}px`,
        height: `${this.data.zoomY - 2}px`,
        background: activePat.color,
      });

      if (note.lyric)
        new Html("div")
          .classOn("st-note-lyric")
          .text(note.lyric)
          .appendTo(noteEl);
      if (this.data.selectedNotes && this.data.selectedNotes.includes(note))
        noteEl.classOn("selected");

      Object.defineProperty(note, "_el", {
        value: noteEl.elm,
        writable: true,
        configurable: true,
        enumerable: false,
      });
      new Html("div").classOn("st-note-resize").appendTo(noteEl);

      noteEl.on("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.data.selectedNotes.includes(note)) {
          activePat.data[activeCh.id] = activePat.data[activeCh.id].filter(
            (n) => !this.data.selectedNotes.includes(n),
          );
          this.data.selectedNotes = [];
        } else {
          activePat.data[activeCh.id] = activePat.data[activeCh.id].filter(
            (n) => n !== note,
          );
        }
        this.renderEditorData();
        this.renderPlaylistBlocks();
        this.stateManager.pushHistory();
      });

      noteEl.on("mousedown", (e) =>
        this.handleNoteMouseDown(e, note, noteEl, activeCh),
      );
      noteEl.on("dblclick", (e) => this.handleNoteDoubleClick(e, note, noteEl));
    });

    this.renderLyricPreview();
    this.renderControlGrid();
  }

  renderDrumSequencer(activePat, activeCh) {
    const seqContainer = new Html("div")
      .classOn("st-drum-seq-container")
      .appendTo(this.elements.editorGridEl);
    const lenTicks = this.stateManager.getPatternLength(activePat.id);
    const totalSteps = Math.max(32, lenTicks / 32);
    const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
    const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;

    DRUMS.forEach((drum) => {
      const row = new Html("div").classOn("st-step-row").appendTo(seqContainer);
      const label = new Html("div")
        .classOn("st-step-label")
        .text(drum.name)
        .appendTo(row);
      label.on("mousedown", () =>
        this.playbackManager.playNotePreview(drum.pitch, true, chVol, chPan),
      );

      for (let i = 0; i < totalSteps; i++) {
        const btn = new Html("div")
          .classOn("st-step-btn")
          .attr({ "data-step": i })
          .appendTo(row);
        if (Math.floor(i / 4) % 2 === 0) btn.classOn("beat");

        const tick = i * 32;
        const notes = activePat.data[activeCh.id];
        const exists = notes.find(
          (n) => n.pitch === drum.pitch && n.startTick === tick,
        );

        if (exists) btn.classOn("active");

        btn.on("mousedown", () => {
          const tkNotes = activePat.data[activeCh.id];
          const idx = tkNotes.findIndex(
            (n) => n.pitch === drum.pitch && n.startTick === tick,
          );
          if (idx > -1) {
            tkNotes.splice(idx, 1);
            btn.classOff("active");
          } else {
            tkNotes.push({
              pitch: drum.pitch,
              startTick: tick,
              durationTicks: 32,
              velocity: 100,
            });
            btn.classOn("active");
            this.playbackManager.playNotePreview(
              drum.pitch,
              true,
              chVol,
              chPan,
            );
          }
          this.renderPlaylistBlocks();
          this.renderControlGrid();
          this.stateManager.pushHistory();
        });
      }
    });
  }

  renderControlGrid() {
    if (!this.elements.controlGridEl || !this.elements.controlGridEl.elm)
      return;
    Array.from(
      this.elements.controlGridEl.elm.querySelectorAll(".st-lollipop"),
    ).forEach((el) => el.remove());
    this.elements.controlBg.clear();

    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (!activePat || !activeCh) return;

    let maxPrTick = 0;
    Object.values(activePat.data).forEach((notes) => {
      notes.forEach((n) => {
        if (n.startTick + n.durationTicks > maxPrTick)
          maxPrTick = n.startTick + n.durationTicks;
      });
    });

    const requiredPrWidthPx = (maxPrTick + 128 * 16) * this.data.zoomX;
    const finalPrWidthPx = Math.max(8000, requiredPrWidthPx);
    this.elements.controlGridEl.styleJs({ width: `${finalPrWidthPx}px` });

    const finalPrMaxTicks = finalPrWidthPx / this.data.zoomX;
    for (let t = 0; t < finalPrMaxTicks; t += this.data.snapTicks) {
      const col = new Html("div")
        .classOn("st-col-line")
        .styleJs({ left: `${t * this.data.zoomX}px` })
        .appendTo(this.elements.controlBg);
      if (t % 128 === 0) col.classOn("beat");
      if (t % 512 === 0) col.classOn("bar");
    }

    const drawLollipop = (tick, percent, color, dataObj) => {
      const px = tick * this.data.zoomX;
      const isSelected =
        this.data.selectedNotes && this.data.selectedNotes.includes(dataObj);
      const container = new Html("div")
        .classOn("st-lollipop")
        .styleJs({ left: `${px}px`, height: "100%" })
        .appendTo(this.elements.controlGridEl);

      new Html("div")
        .classOn("st-lollipop-head")
        .styleJs({
          background: color,
          filter: isSelected ? "brightness(1.5) drop-shadow(0 0 3px #fff)" : "",
        })
        .appendTo(container);
      new Html("div")
        .classOn("st-lollipop-stem")
        .styleJs({
          background: color,
          height: `${Math.max(0, Math.min(100, percent * 100))}%`,
        })
        .appendTo(container);
    };

    if (this.data.activeControl === "velocity") {
      const notes = activePat.data[activeCh.id] || [];
      notes.forEach((n) =>
        drawLollipop(
          n.startTick,
          (n.velocity !== undefined ? n.velocity : 100) / 100,
          activePat.color,
          n,
        ),
      );
    } else {
      const cc = this.data.activeControl;
      if (
        activePat.automation &&
        activePat.automation[activeCh.id] &&
        activePat.automation[activeCh.id][cc]
      ) {
        activePat.automation[activeCh.id][cc].forEach((ev) =>
          drawLollipop(ev.startTick, ev.value / 127, activePat.color, ev),
        );
      }
    }
  }

  renderLyricPreview() {
    if (!this.elements.lyricPreviewContent) return;
    this.elements.lyricPreviewContent.clear();

    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );

    if (
      !activePat ||
      !activeCh ||
      activeCh.isDrum ||
      !activePat.data[activeCh.id]
    ) {
      this.elements.lyricPreviewContent.text("No lyrics available.");
      return;
    }

    const notes = [...activePat.data[activeCh.id]].sort(
      (a, b) => a.startTick - b.startTick,
    );
    const lyricNotes = notes.filter((n) => n.lyric);

    if (lyricNotes.length === 0) {
      this.elements.lyricPreviewContent.text("No lyrics in this pattern.");
      return;
    }

    let displayableIndex = 0;
    lyricNotes.forEach((n) => {
      let textToRender = n.lyric;
      const cleanText = textToRender.replace(/[\r\n\/\\]/g, "");
      if (!cleanText || cleanText.startsWith("@")) return;

      if (
        (textToRender.startsWith("/") || textToRender.startsWith("\\")) &&
        displayableIndex > 0
      ) {
        new Html("br").appendTo(this.elements.lyricPreviewContent);
        new Html("br").appendTo(this.elements.lyricPreviewContent);
      }

      const span = new Html("span")
        .classOn("st-lyric-preview-syl")
        .text(cleanText)
        .attr({ "data-lyric-index": displayableIndex })
        .appendTo(this.elements.lyricPreviewContent);

      if (this.data.selectedNotes && this.data.selectedNotes.includes(n))
        span.classOn("selected");

      span.on("mousedown", (e) => {
        e.stopPropagation();
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (!this.data.selectedNotes.includes(n))
            this.data.selectedNotes.push(n);
          else
            this.data.selectedNotes = this.data.selectedNotes.filter(
              (sn) => sn !== n,
            );
        } else this.data.selectedNotes = [n];
        this.renderEditorData();
      });
      displayableIndex++;
    });
  }

  handleBlockMouseDown(e, block, el) {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (this.data.activePatternId !== block.patternId) {
      this.data.activePatternId = block.patternId;
      this.data.selectedNotes = [];
      this.renderPatternList();
      this.renderEditorData();
    }

    if (!this.data.selectedBlocks.includes(block)) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        this.data.selectedBlocks = [block];
        document
          .querySelectorAll(".st-pattern-block")
          .forEach((node) => node.classList.remove("selected"));
      } else this.data.selectedBlocks.push(block);
      el.classOn("selected");
    }

    this.data.dragState = {
      active: true,
      hasMoved: false,
      type: "move_block",
      startX: e.clientX,
      startY: e.clientY,
      selectedBlocksStart: this.data.selectedBlocks.map((b) => ({
        block: b,
        startTick: b.startTick,
        startTrack: b.trackIndex,
      })),
    };
  }

  handleNoteMouseDown(e, note, noteEl, activeCh) {
    if (e.button !== 0) return;
    e.stopPropagation();

    this.data.lastNoteDuration[activeCh.id] = note.durationTicks;
    if (!this.data.selectedNotes.includes(note)) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        this.data.selectedNotes = [note];
        document
          .querySelectorAll(".st-note")
          .forEach((el) => el.classList.remove("selected"));
      } else this.data.selectedNotes.push(note);
      noteEl.classOn("selected");
    }

    this.data.dragState = {
      active: true,
      hasMoved: false,
      type: e.target.classList.contains("st-note-resize")
        ? "resize_note"
        : "move_note",
      startX: e.clientX,
      startY: e.clientY,
      selectedNotesStart: this.data.selectedNotes.map((n) => ({
        note: n,
        startTick: n.startTick,
        startRow: PITCHES.indexOf(n.pitch),
        startDur: n.durationTicks,
      })),
    };

    const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
    const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;
    this.playbackManager.playNotePreview(note.pitch, false, chVol, chPan);
    this.renderControlGrid();
  }

  handleNoteDoubleClick(e, note, noteEl) {
    e.stopPropagation();
    document.querySelectorAll(".st-lyric-popup").forEach((el) => el.remove());

    const current = note.lyric || "";
    const isNewLine = current.startsWith("/") || current.startsWith("\\");
    const cleanText = current.replace(/^[\/\\]/, "");

    const popup = new Html("div")
      .classOn("st-lyric-popup")
      .appendTo(this.elements.editorGridEl);
    popup.on("mousedown", (ev) => ev.stopPropagation());
    popup.on("dblclick", (ev) => ev.stopPropagation());
    popup.styleJs({
      left: noteEl.elm.style.left,
      top: parseFloat(noteEl.elm.style.top) - 45 + "px",
    });

    const input = new Html("input")
      .classOn("st-input")
      .attr({ type: "text", placeholder: "Syllable..." })
      .styleJs({ width: "120px" })
      .val(cleanText)
      .appendTo(popup);
    const label = new Html("div")
      .styleJs({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        fontWeight: "bold",
        cursor: "pointer",
        color: "#fff",
      })
      .appendTo(popup);
    const check = new Html("div").classOn("st-custom-check").appendTo(label);

    if (isNewLine) check.classOn("checked");
    new Html("span").text("New Line").appendTo(label);

    label.on("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      check.class("checked");
    });

    setTimeout(() => {
      if (input.elm) {
        input.elm.focus();
        input.elm.select();
      }
    }, 10);

    const save = () => {
      let val = input.getValue();
      if (val) {
        const hasSlash = val.startsWith("/") || val.startsWith("\\");
        const isChecked = check.elm.classList.contains("checked");
        if (isChecked && !hasSlash) val = "/" + val;
        else if (!isChecked && hasSlash) val = val.substring(1);
        note.lyric = val;
      } else delete note.lyric;

      popup.cleanup();
      this.renderEditorData();
      this.stateManager.pushHistory();
    };

    input.on("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        save();
      } else if (ev.key === "Escape") popup.cleanup();
    });

    const outsideClick = (ev) => {
      if (
        popup.elm &&
        !popup.elm.contains(ev.target) &&
        ev.target !== noteEl.elm
      ) {
        save();
        window.removeEventListener("mousedown", outsideClick);
      }
    };
    setTimeout(() => window.addEventListener("mousedown", outsideClick), 10);
  }

  handlePlaylistMouseDown(e) {
    if (e.button !== 0 || e.target.closest(".st-pattern-block")) return;

    const scrollRect =
      this.elements.playlistGridEl.elm.parentElement.getBoundingClientRect();
    const viewportY = e.clientY - scrollRect.top;

    if (viewportY <= RULER_HEIGHT) {
      e.preventDefault();
      this.data.dragState = { active: true, type: "scrub", isPlaylist: true };
      document.body.style.cursor = "ew-resize";
      this.playbackManager.handleScrub(e, true, this.elements.playlistGridEl);
      return;
    }

    const rect = this.elements.playlistGridEl.elm.getBoundingClientRect();
    const y = e.clientY - rect.top;

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      this.data.dragState = {
        active: true,
        type: "select_blocks",
        hasMoved: false,
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };

      this.elements.selBox = new Html("div")
        .classOn("st-selection-box")
        .appendTo(this.elements.playlistGridEl);
      this.elements.selBox.styleJs({
        left: `${e.clientX - rect.left}px`,
        top: `${y}px`,
        width: "0px",
        height: "0px",
      });
      return;
    }

    this.data.selectedBlocks = [];

    const x = e.clientX - rect.left;
    const startTick =
      Math.floor(x / this.data.playlistZoomX / this.data.playlistSnap) *
      this.data.playlistSnap;
    const trackIndex = Math.floor((y - RULER_HEIGHT) / this.data.playlistZoomY);

    this.data.playlist.push({
      id: this.data.nextBlockId++,
      patternId: this.data.activePatternId,
      trackIndex,
      startTick,
    });
    this.renderPlaylistBlocks();
    this.stateManager.pushHistory();
  }

  handleEditorMouseDown(e) {
    if (
      e.button !== 0 ||
      e.target.classList.contains("st-note") ||
      e.target.classList.contains("st-note-resize")
    )
      return;

    const activePat = this.data.patterns.find(
      (p) => p.id === this.data.activePatternId,
    );
    const activeCh = this.data.channels.find(
      (c) => c.id === this.data.activeChannelId,
    );
    if (!activePat || !activeCh || activeCh.isDrum) return;

    const scrollRect =
      this.elements.editorGridEl.elm.parentElement.getBoundingClientRect();
    const viewportY = e.clientY - scrollRect.top;

    if (viewportY <= RULER_HEIGHT) {
      e.preventDefault();
      this.data.dragState = { active: true, type: "scrub", isPlaylist: false };
      document.body.style.cursor = "ew-resize";
      this.playbackManager.handleScrub(e, false, this.elements.editorGridEl);
      return;
    }

    const rect = this.elements.editorGridEl.elm.getBoundingClientRect();
    const y = e.clientY - rect.top;

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      this.data.dragState = {
        active: true,
        type: "select",
        hasMoved: false,
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };

      this.elements.selBox = new Html("div")
        .classOn("st-selection-box")
        .appendTo(this.elements.editorGridEl);
      this.elements.selBox.styleJs({
        left: `${e.clientX - rect.left}px`,
        top: `${y}px`,
        width: "0px",
        height: "0px",
      });
      return;
    }

    this.data.selectedNotes = [];
    const startTick =
      Math.floor(
        (e.clientX - rect.left) / this.data.zoomX / this.data.snapTicks,
      ) * this.data.snapTicks;
    const row = Math.floor((y - RULER_HEIGHT) / this.data.zoomY);
    const pitch = PITCHES[row];
    if (!pitch) return;

    const resolvedDuration =
      this.data.lastNoteDuration[activeCh.id] || this.data.snapTicks;
    if (!activePat.data[activeCh.id]) activePat.data[activeCh.id] = [];

    activePat.data[activeCh.id].push({
      pitch,
      startTick,
      durationTicks: resolvedDuration,
      velocity: 100,
    });
    this.data.lastNoteDuration[activeCh.id] = resolvedDuration;

    const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
    const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;
    this.playbackManager.playNotePreview(pitch, false, chVol, chPan);

    this.renderEditorData();
    this.renderPlaylistBlocks();
    this.stateManager.pushHistory();
  }

  handleControlMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = this.elements.controlGridEl.elm.getBoundingClientRect();
    const tick = Math.max(0, (e.clientX - rect.left) / this.data.zoomX);

    this.data.dragState = {
      active: true,
      type: "draw_control",
      lastTick: tick,
      hasMoved: false,
    };

    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: e.clientX, clientY: e.clientY }),
    );
  }

  addChannel(isDrum) {
    this.data.channels.push({
      id: this.data.nextChannelId++,
      name: isDrum ? "Drums" : `Inst ${this.data.nextChannelId - 1}`,
      instrument: 0,
      isDrum,
      color: COLORS[this.data.nextChannelId % COLORS.length],
      volume: 100,
      pan: 64,
    });
    this.renderChannelList();
    this.stateManager.pushHistory();
  }

  openInstrumentModal(ch) {
    const overlay = new Html("div")
      .classOn("st-modal-overlay")
      .appendTo("body");
    const content = new Html("div")
      .classOn("st-modal-content")
      .appendTo(overlay);
    const header = new Html("div").classOn("st-modal-header").appendTo(content);

    new Html("h2").text("Select Instrument").appendTo(header);
    new Html("div")
      .text("X")
      .classOn("st-btn-delete")
      .styleJs({ pointerEvents: "auto" })
      .appendTo(header)
      .on("click", () => overlay.cleanup());

    const searchInput = new Html("input")
      .classOn("st-input", "st-search-input")
      .attr({ placeholder: "Search instruments...", type: "text" })
      .appendTo(content);
    const listContainer = new Html("div")
      .classOn("st-inst-list")
      .appendTo(content);

    const renderList = (filter = "") => {
      listContainer.clear();
      GM_INSTRUMENTS.forEach((inst, i) => {
        if (inst.toLowerCase().includes(filter.toLowerCase())) {
          new Html("div")
            .classOn("st-inst-item")
            .text(`${i + 1}: ${inst}`)
            .appendTo(listContainer)
            .on("click", () => {
              ch.instrument = i;
              overlay.cleanup();
              this.renderChannelList();
              this.renderPianoRollGrid();
              this.stateManager.pushHistory();
            });
        }
      });
    };

    renderList();
    searchInput.on("input", (e) => renderList(e.target.value));
    setTimeout(() => {
      if (searchInput.elm) searchInput.elm.focus();
    }, 10);
    overlay.on("mousedown", (e) => {
      if (e.target === overlay.elm) overlay.cleanup();
    });
  }

  promptBulkLyrics() {
    if (!this.data.selectedNotes || this.data.selectedNotes.length === 0)
      return alert("Please select some notes in the pattern editor first.");
    const val = prompt(
      "Enter lyrics for selected notes.\nUse hyphens (-) to split syllables within a word.\nExample: Ne-ver gon-na give you up",
    );

    if (val) {
      let text = val.replace(/\n/g, " / ");
      let words = text.split(/\s+/).filter((w) => w.length > 0);
      let syllables = [];

      words.forEach((word) => {
        if (word === "/" || word === "\\") {
          if (syllables.length > 0) syllables[syllables.length - 1] += word;
          else syllables.push(word);
          return;
        }
        let parts = word.split("-");
        parts.forEach((part, i) => {
          if (i === parts.length - 1) syllables.push(part + " ");
          else syllables.push(part);
        });
      });

      this.data.selectedNotes.sort((a, b) => a.startTick - b.startTick);
      syllables.forEach((syl, i) => {
        if (i < this.data.selectedNotes.length)
          this.data.selectedNotes[i].lyric = syl;
      });

      this.renderEditorData();
      this.stateManager.pushHistory();
    }
  }
}
