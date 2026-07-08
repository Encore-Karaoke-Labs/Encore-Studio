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

  injectStyles() {
    this.styleTag = document.createElement("style");
    this.styleTag.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Radio+Canada:wght@400;500;600;700&family=Rajdhani:wght@500;600;700&display=swap');
      @keyframes st-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes st-pop-in { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      
      :root { --encore-blue: #89CFF0; --encore-gold: #FFD700; --encore-orange: #FFA53F; --bg-dark: #0a0a14; --bg-panel: rgba(20, 20, 30, 0.9); --bg-light: rgba(255, 255, 255, 0.05); --border-color: rgba(137, 207, 240, 0.3); }
      * { box-sizing: border-box; user-select: none; }
      
      .st-wrap { background: var(--bg-dark); color: #fff; font-family: 'Radio Canada', sans-serif; overflow: hidden; display: flex; flex-direction: column; }
      .st-toolbar { display: flex; align-items: center; gap: 15px; padding: 10px 20px; background: var(--bg-panel); border-bottom: 2px solid var(--border-color); flex-shrink: 0; z-index: 50; }
      .st-toolbar h1 { font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: var(--encore-blue); margin: 0; letter-spacing: 2px; text-transform: uppercase; margin-right: 20px;}
      
      .st-btn { display: inline-flex; align-items: center; justify-content: center; min-width: unset !important; height: auto !important; line-height: 1.2 !important; background: var(--bg-light) !important; color: #fff !important; border: 1px solid var(--encore-blue) !important; padding: 6px 12px !important; border-radius: 4px !important; cursor: pointer; font-weight: 600 !important; font-family: 'Rajdhani', sans-serif !important; font-size: 0.9rem !important; letter-spacing: 1px !important; white-space: nowrap !important; transition: all 0.15s !important; }
      .st-btn:hover { background: var(--encore-blue) !important; color: #000 !important; box-shadow: 0 0 10px rgba(137,207,240,0.5) !important; }
      .st-btn:active { transform: scale(0.96) !important; }
      .st-btn-small { padding: 4px 8px !important; font-size: 0.8rem !important; flex-shrink: 0 !important; }
      .st-btn.gold { border-color: var(--encore-gold) !important; }
      .st-btn.gold:hover { background: var(--encore-gold) !important; color: #000 !important; box-shadow: 0 0 10px rgba(255,215,0,0.5) !important; }
      .st-btn.play-active { background: var(--encore-gold) !important; color: #000 !important; border-color: var(--encore-gold) !important; box-shadow: 0 0 15px rgba(255,215,0,0.4) !important; }
      
      .st-btn-delete { display: inline-flex; align-items: center; justify-content: center; width: 22px !important; height: 22px !important; padding: 0 !important; background: rgba(255,255,255,0.05) !important; color: #fff !important; border: 1px solid transparent !important; cursor: pointer !important; font-weight: bold !important; opacity: 0.7; transition: 0.15s; border-radius: 4px; flex-shrink: 0; font-family: sans-serif; font-size: 12px; }
      .st-btn-delete:hover { opacity: 1; color: #ff5555 !important; background: rgba(255,85,85,0.15) !important; border-color: rgba(255,85,85,0.5) !important; }
      
      .st-select, .st-input { min-width: unset !important; height: 28px !important; background: rgba(0,0,0,0.5) !important; color: #fff !important; border: 1px solid var(--border-color) !important; padding: 0 6px !important; border-radius: 4px !important; font-family: inherit !important; outline: none !important; font-size: 0.9rem !important; line-height: 1.2 !important; box-sizing: border-box; transition: border-color 0.2s; }
      .st-select:focus, .st-input:focus { border-color: var(--encore-blue) !important; }
      .st-tempo-input { width: 50px !important; text-align: center !important; cursor: ns-resize; border-color: var(--encore-gold) !important; color: var(--encore-gold) !important; font-weight: bold; }
      .st-search-input { width: 100% !important; max-width: none !important; font-size: 1.2rem !important; padding: 12px 15px !important; height: auto !important; margin-bottom: 15px !important; background: rgba(0,0,0,0.5) !important; border: 2px solid var(--encore-blue) !important; border-radius: 6px !important; }

      .st-floating-dropdown { position: fixed; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 6px; z-index: 999999; display: flex; flex-direction: column; min-width: 150px; box-shadow: 0 5px 20px rgba(0,0,0,0.8); overflow: hidden; animation: st-fade-in 0.15s ease-out; }
      .st-floating-dropdown-item { padding: 10px 15px; color: #fff; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: 600; font-size: 0.95rem; font-family: 'Rajdhani', sans-serif; transition: 0.1s; }
      .st-floating-dropdown-item:hover { background: var(--encore-blue); color: #000 !important; }
      .st-floating-dropdown-item:last-child { border-bottom: none; }
      
      .st-workspace { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
      .st-pane { display: flex; flex: 1; overflow: hidden; position: relative; }
      .st-splitter { height: 6px; background: rgba(137, 207, 240, 0.1); cursor: ns-resize; z-index: 100; flex-shrink: 0; transition: background 0.2s; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
      .st-splitter:hover, .st-splitter.active { background: var(--encore-blue); }
      
      .st-sidebar { width: 250px; background: #0f0f18; border-right: 2px solid var(--border-color); display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0; }
      .st-sidebar-header { padding: 8px 10px; background: rgba(255,255,255,0.05); font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;}
      .st-right-sidebar { width: 250px; background: #0f0f18; border-left: 2px solid var(--border-color); display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0; z-index: 20; }
      
      .st-lyric-preview { padding: 15px; font-size: 1.1rem; line-height: 1.8; color: #fff; font-family: 'Radio Canada', sans-serif; white-space: pre-wrap; }
      .st-lyric-preview-syl { cursor: pointer; padding: 2px 0; transition: color 0.15s, background 0.15s; border-radius: 3px; }
      .st-lyric-preview-syl:hover { background: rgba(137, 207, 240, 0.3); color: var(--encore-gold); }
      .st-lyric-preview-syl.selected { background: var(--encore-blue); color: #000; box-shadow: 0 0 5px var(--encore-blue); }
      .st-lyric-preview-syl.playing { background: var(--encore-blue); color: #000; box-shadow: 0 0 8px var(--encore-blue); border-radius: 3px; z-index: 5; position: relative; }

      .st-list-item { display: flex; flex-direction: column; gap: 8px; padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; border-left: 4px solid transparent; transition: background 0.15s, border-color 0.15s; }
      .st-list-item:hover { background: rgba(255,255,255,0.05); }
      .st-list-item.active { background: rgba(137,207,240,0.15); border-left: 4px solid var(--encore-blue); }
      .st-list-item.dragging { opacity: 0.5; border: 1px dashed var(--encore-blue); }
      .st-list-item.drag-over { border-top: 2px solid var(--encore-gold); background: rgba(255,215,0,0.1); }
      
      .st-list-top { display: flex; justify-content: space-between; width: 100%; align-items: center; pointer-events: none; }
      .st-list-left { display: flex; align-items: center; flex: 1; min-width: 0; pointer-events: auto; }
      .st-list-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; outline: none; padding: 2px 4px; border-radius: 3px; border: 1px solid transparent; user-select: text; cursor: text; transition: background 0.2s; }
      .st-list-name[contenteditable="true"] { background: rgba(0,0,0,0.5); border: 1px solid var(--encore-blue); }
      .st-right-grp { display: flex; gap: 5px; align-items: center; flex-shrink: 0; pointer-events: auto; }
      .st-color-swatch { width: 12px; height: 12px; border-radius: 3px; margin-right: 10px; flex-shrink: 0; box-shadow: 0 0 5px rgba(0,0,0,0.5);}

      .st-vol-slider { width: 100%; height: 6px; -webkit-appearance: none; background: rgba(255,255,255,0.1); border-radius: 3px; outline: none; margin: 0; pointer-events: auto; transition: background 0.2s;}
      .st-vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--encore-blue); cursor: pointer; border: 2px solid #000; box-shadow: 0 0 5px rgba(0,0,0,0.5); transition: background 0.15s, transform 0.15s; }
      .st-vol-slider:hover::-webkit-slider-thumb { background: var(--encore-gold); transform: scale(1.1); }

      .st-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); animation: st-fade-in 0.2s ease-out; }
      .st-modal-content { background: var(--bg-dark); border: 1px solid var(--encore-blue); border-radius: 8px; padding: 25px; width: 600px; max-width: 90vw; height: 70vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.8); animation: st-pop-in 0.2s; }
      .st-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
      .st-modal-header h2 { margin: 0; font-family: 'Rajdhani', sans-serif; color: var(--encore-blue); font-size: 1.8rem; }
      .st-inst-list { flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-right: 5px; }
      .st-inst-item { padding: 10px; background: rgba(255,255,255,0.05); cursor: pointer; border-radius: 4px; font-size: 0.9rem; border: 1px solid transparent; font-weight: 500; transition: background 0.1s, border-color 0.1s;}
      .st-inst-item:hover { background: rgba(137,207,240,0.2); border-color: var(--encore-blue); }
      
      .st-grid-area { flex: 1; overflow: auto; background: #0c0c11; position: relative; display: flex; }
      .st-grid-scroll { flex: 1; position: relative; overflow: auto; }
      .st-grid { position: relative; min-height: 100%; transform-origin: top left; }
      .st-grid-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
      
      .st-col-line { position: absolute; top: 0; bottom: 0; border-right: 1px solid rgba(255,255,255,0.05); pointer-events: none; }
      .st-col-line.beat { border-right: 1px solid rgba(255,255,255,0.2); }
      .st-col-line.bar { border-right: 2px solid rgba(255,255,255,0.4); }

      .st-timeline { position: sticky; top: 0; height: 24px; background: rgba(137, 207, 240, 0.15); border-bottom: 1px solid var(--encore-blue); z-index: 90; pointer-events: auto; cursor: ew-resize; backdrop-filter: blur(2px); }
      .st-timeline-corner { position: sticky; top: 0; height: 24px; background: rgba(137, 207, 240, 0.15); border-bottom: 1px solid var(--encore-blue); z-index: 95; backdrop-filter: blur(2px); }

      .st-track-row { position: absolute; left: 0; right: 0; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); }
      .st-pattern-block { position: absolute; height: 38px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5); cursor: move; overflow: hidden; display: block; padding: 2px 4px; font-weight: bold; font-size: 11px; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); z-index: 5; transition: filter 0.15s, outline 0.15s; }
      .st-pattern-name { position: relative; z-index: 2; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .st-pattern-notes { position: absolute; inset: 0; top: 14px; pointer-events: none; opacity: 0.6; }
      .st-pattern-note { position: absolute; background: #000; border-radius: 1px; box-shadow: 0 0 1px rgba(255,255,255,0.3); }

      .st-pattern-block.selected { outline: 2px solid var(--encore-gold); outline-offset: -2px; filter: brightness(1.3); z-index: 10; }
      .st-pattern-block:hover { filter: brightness(1.2); }

      .st-keys { width: 80px; background: #1a1a24; flex-shrink: 0; overflow-y: hidden; position: relative; border-right: 2px solid #000; z-index: 10; box-shadow: 5px 0 15px rgba(0,0,0,0.5); }
      .st-key { position: absolute; height: 24px; width: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; font-size: 11px; font-weight: bold; border-bottom: 1px solid rgba(0,0,0,0.5); cursor: pointer; transition: background 0.1s, color 0.1s;}
      .st-key:hover { filter: brightness(1.2); }
      .st-key.white { background: #e0e0e0; color: #333; z-index: 1; }
      .st-key.white.is-c { background: #b0b0b0; color: #000; }
      .st-key.black { background: transparent; color: #aaa; z-index: 2; border: none; }
      .st-key.black::before { content: ''; position: absolute; left: 0; top: 0; height: 100%; width: 60%; background: #222; border: 1px solid #000; border-left: none; border-radius: 0 3px 3px 0; z-index: -1; }
      .st-row { position: absolute; left: 0; right: 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .st-row.in-scale { background: rgba(255,255,255,0.05); }
      .st-row.root { background: rgba(137,207,240,0.15); }
      
      .st-note { position: absolute; border: 1px solid #fff; border-radius: 3px; cursor: move; box-shadow: 0 2px 5px rgba(0,0,0,0.5); z-index: 5; transition: filter 0.15s, border-color 0.15s, box-shadow 0.15s; }
      .st-note-resize { position: absolute; right: 0; top: 0; width: 10px; height: 100%; cursor: ew-resize; z-index: 6; }
      .st-note.selected { border: 2px solid var(--encore-gold) !important; box-shadow: 0 0 10px var(--encore-gold); z-index: 10; filter: brightness(1.2); }
      .st-note-lyric { position: absolute; top: -14px; left: 0; color: #fff; font-size: 11px; font-weight: bold; text-shadow: 1px 1px 2px #000, -1px -1px 2px #000; pointer-events: none; white-space: pre; z-index: 20; background: rgba(0,0,0,0.4); padding: 0 2px; border-radius: 2px; }
      .st-selection-box { position: absolute; background: rgba(137,207,240,0.3); border: 1px solid var(--encore-blue); z-index: 50; pointer-events: none; transition: opacity 0.1s; }

      .st-drum-seq-container { padding: 15px; overflow-x: auto; flex: 1; background: #0c0c11; min-height: 100%; }
      .st-step-row { display: flex; align-items: center; margin-bottom: 10px; width: max-content;}
      .st-step-label { width: 120px; position: sticky; left: 0; background: #14141e; padding: 10px; color: #fff; text-align: right; margin-right: 20px; border-radius: 4px; font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); z-index: 5; transition: background 0.15s, border-color 0.15s;}
      .st-step-label:hover { background: rgba(137,207,240,0.1); border-color: var(--encore-blue); }
      .st-step-btn { width: 40px; height: 40px; background: #1a1a24; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; margin-right: 5px; display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; transition: background 0.15s, transform 0.1s, box-shadow 0.15s; }
      .st-step-btn:hover { background: #2a2a35; }
      .st-step-btn:active { transform: scale(0.95); }
      .st-step-btn.beat { background: #222230; }
      .st-step-btn.active { background: var(--encore-orange); border-color: #fff; box-shadow: 0 0 10px rgba(255, 165, 63, 0.5); transform: scale(1.05); z-index: 2;}
      .st-step-btn.playing::after { content: ''; position: absolute; inset: -3px; border: 2px solid var(--encore-gold); border-radius: 6px; pointer-events: none; }

      .st-playhead { position: absolute; top: 0; width: 2px; height: 100%; background: var(--encore-gold); z-index: 100; pointer-events: none; box-shadow: 0 0 8px rgba(255, 215, 0, 0.5); }
      .st-playhead::before { content: ''; position: sticky; top: 0; display: block; width: 14px; height: 14px; background: var(--encore-gold); transform: translateX(-6px); clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%); z-index: 101; }

      .st-lyric-popup { position: absolute; background: var(--bg-panel); border: 1px solid var(--encore-blue); padding: 8px 12px; border-radius: 6px; z-index: 1000; display: flex; gap: 12px; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.8); animation: st-pop-in 0.1s ease-out; }
      .st-custom-check { width: 16px; height: 16px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); border-radius: 3px; cursor: pointer; position: relative; transition: 0.15s; flex-shrink: 0; }
      .st-custom-check.checked { background: var(--encore-blue); border-color: var(--encore-blue); box-shadow: 0 0 5px var(--encore-blue); }
      .st-custom-check.checked::after { content: ''; position: absolute; left: 5px; top: 1px; width: 4px; height: 8px; border: solid #000; border-width: 0 2px 2px 0; transform: rotate(45deg); }
      
      .st-control-sidebar { width: 80px; flex-shrink: 0; background: #1a1a24; border-right: 2px solid #000; display: flex; align-items: flex-start; justify-content: center; padding-top: 5px; }
      .st-control-dropdown { width: 70px; font-size: 11px; padding: 2px 4px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: inherit; transition: border-color 0.2s;}
      .st-control-dropdown:focus { border-color: var(--encore-blue); }
      .st-lollipop { position: absolute; bottom: 0; width: 6px; transform: translateX(-3px); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; cursor: ns-resize; z-index: 5; }
      .st-lollipop-stem { width: 2px; background: var(--encore-blue); flex-shrink: 0; box-shadow: 0 0 2px #000; }
      .st-lollipop-head { width: 6px; height: 6px; border-radius: 50%; background: var(--encore-blue); flex-shrink: 0; margin-bottom: -1px; box-shadow: 0 0 3px #000; transition: filter 0.15s; }
    `;
    document.head.appendChild(this.styleTag);
  }
}
