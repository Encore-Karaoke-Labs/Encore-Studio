import Html from "/libs/html.js";
import midiWriterJs from "https://cdn.skypack.dev/midi-writer-js@2.1.4";

const RULER_HEIGHT = 24;

const GM_INSTRUMENTS = [
  "Acoustic Grand Piano",
  "Bright Acoustic Piano",
  "Electric Grand Piano",
  "Honky-tonk Piano",
  "Electric Piano 1",
  "Electric Piano 2",
  "Harpsichord",
  "Clavi",
  "Celesta",
  "Glockenspiel",
  "Music Box",
  "Vibraphone",
  "Marimba",
  "Xylophone",
  "Tubular Bells",
  "Dulcimer",
  "Drawbar Organ",
  "Percussive Organ",
  "Rock Organ",
  "Church Organ",
  "Reed Organ",
  "Accordion",
  "Harmonica",
  "Tango Accordion",
  "Acoustic Guitar (nylon)",
  "Acoustic Guitar (steel)",
  "Electric Guitar (jazz)",
  "Electric Guitar (clean)",
  "Electric Guitar (muted)",
  "Overdriven Guitar",
  "Distortion Guitar",
  "Guitar harmonics",
  "Acoustic Bass",
  "Electric Bass (finger)",
  "Electric Bass (pick)",
  "Fretless Bass",
  "Slap Bass 1",
  "Slap Bass 2",
  "Synth Bass 1",
  "Synth Bass 2",
  "Violin",
  "Viola",
  "Cello",
  "Contrabass",
  "Tremolo Strings",
  "Pizzicato Strings",
  "Orchestral Harp",
  "Timpani",
  "String Ensemble 1",
  "String Ensemble 2",
  "SynthStrings 1",
  "SynthStrings 2",
  "Choir Aahs",
  "Voice Oohs",
  "Synth Voice",
  "Orchestra Hit",
  "Trumpet",
  "Trombone",
  "Tuba",
  "Muted Trumpet",
  "French Horn",
  "Brass Section",
  "SynthBrass 1",
  "SynthBrass 2",
  "Soprano Sax",
  "Alto Sax",
  "Tenor Sax",
  "Baritone Sax",
  "Oboe",
  "English Horn",
  "Bassoon",
  "Clarinet",
  "Piccolo",
  "Flute",
  "Recorder",
  "Pan Flute",
  "Blown Bottle",
  "Shakuhachi",
  "Whistle",
  "Ocarina",
  "Lead 1 (square)",
  "Lead 2 (sawtooth)",
  "Lead 3 (calliope)",
  "Lead 4 (chiff)",
  "Lead 5 (charang)",
  "Lead 6 (voice)",
  "Lead 7 (fifths)",
  "Lead 8 (bass + lead)",
  "Pad 1 (new age)",
  "Pad 2 (warm)",
  "Pad 3 (polysynth)",
  "Pad 4 (choir)",
  "Pad 5 (bowed)",
  "Pad 6 (metallic)",
  "Pad 7 (halo)",
  "Pad 8 (sweep)",
  "FX 1 (rain)",
  "FX 2 (soundtrack)",
  "FX 3 (crystal)",
  "FX 4 (atmosphere)",
  "FX 5 (brightness)",
  "FX 6 (goblins)",
  "FX 7 (echoes)",
  "FX 8 (sci-fi)",
  "Sitar",
  "Banjo",
  "Shamisen",
  "Koto",
  "Kalimba",
  "Bag pipe",
  "Fiddle",
  "Shanai",
  "Tinkle Bell",
  "Agogo",
  "Steel Drums",
  "Woodblock",
  "Taiko Drum",
  "Melodic Tom",
  "Synth Drum",
  "Reverse Cymbal",
  "Guitar Fret Noise",
  "Breath Noise",
  "Seashore",
  "Bird Tweet",
  "Telephone Ring",
  "Helicopter",
  "Applause",
  "Gunshot",
];

const CHROMA = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTES_DESC = [
  "B",
  "A#",
  "A",
  "G#",
  "G",
  "F#",
  "F",
  "E",
  "D#",
  "D",
  "C#",
  "C",
];

const PITCHES = ["C7"];
for (let octave = 6; octave >= 2; octave--) {
  NOTES_DESC.forEach((note) => PITCHES.push(`${note}${octave}`));
}

const DRUMS = [
  { name: "Kick", pitch: "C2" },
  { name: "Snare", pitch: "D2" },
  { name: "Clap", pitch: "D#2" },
  { name: "HiHat (C)", pitch: "F#2" },
  { name: "HiHat (O)", pitch: "A#2" },
];

const SCALES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Pentatonic: [0, 2, 4, 7, 9],
  None: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const COLORS = [
  "#89CFF0",
  "#FFD700",
  "#FFA53F",
  "#ff5555",
  "#55ff55",
  "#bd93f9",
  "#ff79c6",
];

const state = {
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
    { id: 1, name: "Pattern 1", color: COLORS[0], data: {}, automation: {} },
  ],
  nextPatternId: 2,
  activePatternId: 1,

  playlist: [],
  nextBlockId: 1,

  selectedNotes: [],
  selectedBlocks: [],
  draggedItem: null,
  lastNoteDuration: {},

  history: [],
  historyIndex: -1,

  dragState: {
    active: false,
    type: null,
    hasMoved: false,
    note: null,
    element: null,
    startX: 0,
    startY: 0,
    startTick: 0,
    lastTick: 0,
    startPitchIndex: 0,
    startDuration: 0,
    selectedNotesStart: [],
    selectedBlocksStart: [],
  },
};

let wrapper, styleTag, ForteEngine;
let playlistGridEl, editorGridEl, playheadPlaylist, playheadEditor;
let topPane, bottomPane, splitter, playToggleBtn, modeToggleBtn, tempoInput;
let undoBtn, redoBtn;
let lyricPreviewContent;
let controlContainer, controlGridEl, controlBg, prSplitter, controlScroll;
let selBox = null,
  dsStartX = 0,
  dsStartY = 0,
  dsRect = null;
let isDraggingTempo = false,
  startTempoY = 0,
  startTempoVal = 120;
let isDraggingSplitter = false;
let isDraggingPrSplitter = false,
  startPrSplitterY = 0,
  startControlHeight = 120;
let isScrubbing = false;
let scrubIsPlaylist = false;

function handleScrub(e, isPlaylist) {
  const rect = (
    isPlaylist ? playlistGridEl.elm : editorGridEl.elm
  ).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const zoomX = isPlaylist ? state.playlistZoomX : state.zoomX;
  const ticks = Math.max(0, x / zoomX);
  const tps = (state.tempo / 60) * 128;
  const timeInSeconds = ticks / tps;

  if (ForteEngine && typeof ForteEngine.seekTrack === "function") {
    ForteEngine.seekTrack(timeInSeconds);
  }
}

const blockContextMenu = (e) => {
  if (
    !e.target.closest(".st-list-item") &&
    !e.target.closest(".st-lyric-preview-syl") &&
    !e.target.closest(".st-control-dropdown")
  )
    e.preventDefault();
};
const previewCtx = new (window.AudioContext || window.webkitAudioContext)();

function playNotePreview(pitchStr, isDrum, vol = 100, pan = 64) {
  if (previewCtx.state === "suspended") previewCtx.resume();
  const osc = previewCtx.createOscillator();
  const gain = previewCtx.createGain();
  const panner = previewCtx.createStereoPanner();

  const mult = vol / 100;
  panner.pan.value = (pan - 64) / 64;

  if (isDrum) {
    if (pitchStr === "C2") {
      osc.frequency.setValueAtTime(120, previewCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        0.01,
        previewCtx.currentTime + 0.3,
      );
      gain.gain.setValueAtTime(1 * mult, previewCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        previewCtx.currentTime + 0.3,
      );
    } else if (pitchStr === "D2" || pitchStr === "D#2") {
      osc.type = "square";
      osc.frequency.setValueAtTime(200, previewCtx.currentTime);
      gain.gain.setValueAtTime(0.4 * mult, previewCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        previewCtx.currentTime + 0.15,
      );
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(800, previewCtx.currentTime);
      gain.gain.setValueAtTime(0.1 * mult, previewCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        previewCtx.currentTime + 0.05,
      );
    }
  } else {
    const note = pitchStr.replace(/[0-9]/g, "");
    const octave = parseInt(pitchStr.replace(/[^0-9]/g, ""));
    const midiNumber = CHROMA.indexOf(note) + (octave + 1) * 12;
    const freq = 440 * Math.pow(2, (midiNumber - 69) / 12);

    osc.type = "sawtooth";
    const filter = previewCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, previewCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      100,
      previewCtx.currentTime + 0.5,
    );
    osc.frequency.setValueAtTime(freq, previewCtx.currentTime);
    gain.gain.setValueAtTime(0.15 * mult, previewCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, previewCtx.currentTime + 0.4);
    osc.connect(filter);
    filter.connect(gain);
  }
  gain.connect(panner);
  panner.connect(previewCtx.destination);
  osc.start();
  osc.stop(previewCtx.currentTime + 0.5);
}

const pkg = {
  name: "Encore Studio",
  type: "app",
  privs: 1,

  start: async function (Root) {
    ForteEngine = Root.Processes.getService("ForteSvc").data;
    window.addEventListener("contextmenu", blockContextMenu);

    let hasSnappedToC5 = false;

    function applyBulkLyrics(inputText, notesArray) {
      let text = inputText.replace(/\n/g, " / ");
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

      notesArray.sort((a, b) => a.startTick - b.startTick);
      syllables.forEach((syl, i) => {
        if (i < notesArray.length) notesArray[i].lyric = syl;
      });
    }

    function pushHistory() {
      const snapshot = JSON.stringify({
        patterns: state.patterns,
        channels: state.channels,
        playlist: state.playlist,
        tempo: state.tempo,
        activeChannelId: state.activeChannelId,
        activePatternId: state.activePatternId,
        nextChannelId: state.nextChannelId,
        nextPatternId: state.nextPatternId,
        nextBlockId: state.nextBlockId,
      });

      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(snapshot);
      if (state.history.length > 50) {
        state.history.shift();
      } else {
        state.historyIndex++;
      }
      updateHistoryButtons();
    }

    function applyHistory(index) {
      if (index < 0 || index >= state.history.length) return;
      const snapshot = JSON.parse(state.history[index]);

      state.patterns = snapshot.patterns;
      state.channels = snapshot.channels;
      state.playlist = snapshot.playlist;
      state.tempo = snapshot.tempo;
      state.activeChannelId = snapshot.activeChannelId;
      state.activePatternId = snapshot.activePatternId;
      state.nextChannelId = snapshot.nextChannelId;
      state.nextPatternId = snapshot.nextPatternId;
      state.nextBlockId = snapshot.nextBlockId;

      state.historyIndex = index;
      state.selectedNotes = [];
      state.selectedBlocks = [];
      state.dragState.active = false;

      if (tempoInput && tempoInput.elm) tempoInput.val(state.tempo);

      renderPatternList();
      renderChannelList();
      renderPlaylistGrid();
      renderPianoRollGrid();
      updateHistoryButtons();
    }

    function undo() {
      applyHistory(state.historyIndex - 1);
    }
    function redo() {
      applyHistory(state.historyIndex + 1);
    }

    function updateHistoryButtons() {
      if (!undoBtn || !redoBtn) return;
      if (state.historyIndex <= 0)
        undoBtn.styleJs({ opacity: "0.3", pointerEvents: "none" });
      else undoBtn.styleJs({ opacity: "1", pointerEvents: "auto" });

      if (state.historyIndex >= state.history.length - 1)
        redoBtn.styleJs({ opacity: "0.3", pointerEvents: "none" });
      else redoBtn.styleJs({ opacity: "1", pointerEvents: "auto" });
    }

    function getPatternLength(patId) {
      const pat = state.patterns.find((p) => p.id === patId);
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

    function showDropdown(e, items, isContext = false) {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
      document
        .querySelectorAll(".st-floating-dropdown")
        .forEach((el) => el.remove());

      const menu = new Html("div")
        .classOn("st-floating-dropdown")
        .appendTo("body");
      menu.style({ top: "-9999px", left: "-9999px" });

      items.forEach((item) => {
        const div = new Html("div")
          .classOn("st-floating-dropdown-item")
          .text(item.label)
          .appendTo(menu);
        if (item.color) div.style({ color: item.color });
        div.on("mousedown", (ev) => {
          ev.stopPropagation();
          item.action();
          menu.cleanup();
        });
      });

      setTimeout(() => {
        if (!menu.elm) return;
        const rect = menu.elm.getBoundingClientRect();
        let top, left;

        if (isContext) {
          top = e.clientY;
          left = e.clientX;
        } else {
          const tRect = e.target.getBoundingClientRect();
          top = tRect.bottom + 5;
          left = tRect.left;
        }

        if (top + rect.height > window.innerHeight)
          top = window.innerHeight - rect.height - 10;
        if (left + rect.width > window.innerWidth)
          left = window.innerWidth - rect.width - 10;
        menu.style({
          top: `${Math.max(10, top)}px`,
          left: `${Math.max(10, left)}px`,
        });
      }, 0);

      const closer = () => {
        if (menu.elm) menu.cleanup();
        window.removeEventListener("mousedown", closer);
      };
      setTimeout(() => window.addEventListener("mousedown", closer), 10);
    }

    function triggerRename(spanEl, obj, key, onUpdate) {
      setTimeout(() => {
        spanEl.attr({ contenteditable: "true" });
        spanEl.elm.focus();
        const range = document.createRange();
        range.selectNodeContents(spanEl.elm);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finish = () => {
          spanEl.attr({ contenteditable: null });
          const newVal = spanEl.getText();
          if (obj[key] !== newVal) {
            obj[key] = newVal;
            if (onUpdate) onUpdate();
            pushHistory();
          }
          spanEl.un("blur", finish);
        };
        spanEl.on("blur", finish);
        spanEl.on("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            spanEl.elm.blur();
          }
        });
      }, 10);
    }

    function triggerColorPicker(initialColor, onChange) {
      const input = document.createElement("input");
      input.type = "color";
      input.value = initialColor;
      input.style.position = "absolute";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      document.body.appendChild(input);

      input.addEventListener("input", (e) => onChange(e.target.value));
      input.addEventListener("change", () => input.remove());
      input.click();
    }

    function makeListDraggableScoped(itemEl, array, itemObj, onReorder) {
      itemEl.attr({ draggable: "true" });
      itemEl.on("dragstart", (e) => {
        if (
          e.target.closest(".st-btn") ||
          e.target.closest(".st-btn-delete") ||
          e.target.closest("input") ||
          e.target.getAttribute("contenteditable") === "true"
        ) {
          e.preventDefault();
          return;
        }
        state.draggedItem = itemObj;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", itemObj.id.toString());
        itemEl.classOn("dragging");
      });
      itemEl.on("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        itemEl.classOn("drag-over");
      });
      itemEl.on("dragleave", () => itemEl.classOff("drag-over"));
      itemEl.on("drop", (e) => {
        e.preventDefault();
        itemEl.classOff("drag-over");
        itemEl.classOff("dragging");
        if (state.draggedItem && state.draggedItem !== itemObj) {
          const fromIdx = array.indexOf(state.draggedItem);
          const toIdx = array.indexOf(itemObj);
          if (fromIdx > -1 && toIdx > -1) {
            array.splice(fromIdx, 1);
            array.splice(toIdx, 0, state.draggedItem);
            onReorder();
            pushHistory();
          }
        }
        state.draggedItem = null;
      });
      itemEl.on("dragend", () => {
        itemEl.classOff("dragging");
        itemEl.classOff("drag-over");
        state.draggedItem = null;
      });
    }

    styleTag = document.createElement("style");
    styleTag.innerHTML = `
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
      
      /* Control Area / Lollipops */
      .st-control-sidebar { width: 80px; flex-shrink: 0; background: #1a1a24; border-right: 2px solid #000; display: flex; align-items: flex-start; justify-content: center; padding-top: 5px; }
      .st-control-dropdown { width: 70px; font-size: 11px; padding: 2px 4px; background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: inherit; transition: border-color 0.2s;}
      .st-control-dropdown:focus { border-color: var(--encore-blue); }
      .st-lollipop { position: absolute; bottom: 0; width: 6px; transform: translateX(-3px); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; cursor: ns-resize; z-index: 5; }
      .st-lollipop-stem { width: 2px; background: var(--encore-blue); flex-shrink: 0; box-shadow: 0 0 2px #000; }
      .st-lollipop-head { width: 6px; height: 6px; border-radius: 50%; background: var(--encore-blue); flex-shrink: 0; margin-bottom: -1px; box-shadow: 0 0 3px #000; transition: filter 0.15s; }
    `;
    document.head.appendChild(styleTag);

    wrapper = new Html("div").classOn("full-ui", "st-wrap").appendTo("body");

    const toolbar = new Html("div").classOn("st-toolbar").appendTo(wrapper);
    new Html("h1").text("Encore Studio").appendTo(toolbar);

    playToggleBtn = new Html("div")
      .html("▶ Play")
      .classOn("st-btn", "gold")
      .appendTo(toolbar)
      .on("click", togglePlayback);
    modeToggleBtn = new Html("div")
      .classOn("st-btn")
      .appendTo(toolbar)
      .on("click", () => {
        setPlayMode(state.playMode === "song" ? "pat" : "song");
      });
    updatePlayBtnText();

    new Html("span").text("Tempo:").appendTo(toolbar);
    tempoInput = new Html("input")
      .classOn("st-input", "st-tempo-input")
      .attr({
        type: "text",
        readonly: "true",
        title: "Drag up/down, or Scroll Wheel",
      })
      .val(state.tempo)
      .appendTo(toolbar);

    tempoInput.on("mousedown", (e) => {
      e.preventDefault();
      isDraggingTempo = true;
      startTempoY = e.clientY;
      startTempoVal = state.tempo;
    });

    let tempoWheelTimer;
    tempoInput.on("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      state.tempo = Math.max(10, Math.min(999, state.tempo + dir));
      tempoInput.val(state.tempo);
      clearTimeout(tempoWheelTimer);
      tempoWheelTimer = setTimeout(() => pushHistory(), 400);
    });

    function applyControlValue(tick, valPercent, ds) {
      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (!activePat || !activeCh) return false;

      const snappedTick = Math.floor(tick / state.snapTicks) * state.snapTicks;
      const snappedLastTick =
        Math.floor(ds.lastTick / state.snapTicks) * state.snapTicks;
      const minT = Math.min(snappedLastTick, snappedTick);
      const maxT = Math.max(snappedLastTick, snappedTick);
      const step = state.snapTicks || 32;

      if (state.activeControl === "velocity") {
        const val = Math.round(valPercent * 100);
        const notes = activePat.data[activeCh.id] || [];
        let affected = false;
        notes.forEach((n) => {
          if (
            n.startTick >= minT - step / 2 &&
            n.startTick <= maxT + step / 2
          ) {
            n.velocity = val;
            affected = true;
          }
        });
        return affected;
      } else {
        const val = Math.round(valPercent * 127);
        const cc = state.activeControl;
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

    window.addEventListener("mousemove", (e) => {
      if (isScrubbing) {
        e.preventDefault();
        handleScrub(e, scrubIsPlaylist);
        return;
      }
      if (isDraggingTempo) {
        const delta = startTempoY - e.clientY;
        state.tempo = Math.max(
          10,
          Math.min(999, startTempoVal + Math.floor(delta / 2)),
        );
        if (tempoInput.elm) tempoInput.val(state.tempo);
      }
      if (isDraggingSplitter) {
        const rect = workspace.elm.getBoundingClientRect();
        const newHeight = Math.max(
          150,
          Math.min(e.clientY - rect.top, rect.height - 150),
        );
        topPane.styleJs({ flex: "none", height: `${newHeight}px` });
        return;
      }
      if (isDraggingPrSplitter) {
        const delta = startPrSplitterY - e.clientY;
        const newHeight = Math.max(
          50,
          Math.min(
            editorArea.elm.clientHeight - 80,
            startControlHeight + delta,
          ),
        );
        if (controlContainer.elm)
          controlContainer.styleJs({ height: `${newHeight}px` });
        return;
      }

      if (!state.dragState || !state.dragState.active) return;
      const ds = state.dragState;

      if (
        (ds.type === "select" || ds.type === "select_blocks") &&
        selBox &&
        dsRect
      ) {
        ds.hasMoved = true;
        const currentX = e.clientX - dsRect.left;
        const currentY = e.clientY - dsRect.top;
        const startBoxX = dsStartX - dsRect.left;
        const startBoxY = dsStartY - dsRect.top;

        const x = Math.min(startBoxX, currentX);
        const y = Math.min(startBoxY, currentY);
        const w = Math.abs(currentX - startBoxX);
        const h = Math.abs(currentY - startBoxY);

        selBox.styleJs({
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
        });
      } else if (ds.type === "move_block") {
        ds.hasMoved = true;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        const deltaTicks =
          Math.round(deltaX / state.playlistZoomX / state.playlistSnap) *
          state.playlistSnap;
        const deltaTrack = Math.round(deltaY / state.playlistZoomY);

        let maxRightPx = 0;
        ds.selectedBlocksStart.forEach((item) => {
          const newTick = Math.max(0, item.startTick + deltaTicks);
          const newTrack = Math.max(
            0,
            Math.min(9, item.startTrack + deltaTrack),
          );
          item.block.startTick = newTick;
          item.block.trackIndex = newTrack;
          if (item.block._el) {
            const leftPx = newTick * state.playlistZoomX;
            item.block._el.style.left = `${leftPx}px`;
            item.block._el.style.top = `${newTrack * state.playlistZoomY + RULER_HEIGHT + 1}px`;
            const rightPx =
              leftPx +
              getPatternLength(item.block.patternId) * state.playlistZoomX;
            if (rightPx > maxRightPx) maxRightPx = rightPx;
          }
        });

        if (maxRightPx > playlistGridEl.elm.clientWidth) {
          playlistGridEl.styleJs({ width: `${maxRightPx + 1000}px` });
        }
      } else if (ds.type === "move_note") {
        ds.hasMoved = true;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        const deltaTicks =
          Math.round(deltaX / state.zoomX / state.snapTicks) * state.snapTicks;
        const deltaRow = Math.round(deltaY / state.zoomY);

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
            const leftPx = newTick * state.zoomX;
            item.note._el.style.left = `${leftPx}px`;
            item.note._el.style.top = `${newRow * state.zoomY + RULER_HEIGHT + 1}px`;
            const rightPx = leftPx + item.note.durationTicks * state.zoomX;
            if (rightPx > maxRightPx) maxRightPx = rightPx;
          }
        });

        if (maxRightPx > editorGridEl.elm.clientWidth) {
          editorGridEl.styleJs({ width: `${maxRightPx + 1000}px` });
        }
      } else if (ds.type === "resize_note") {
        ds.hasMoved = true;
        const deltaX = e.clientX - ds.startX;
        const deltaTicks =
          Math.round(deltaX / state.zoomX / state.snapTicks) * state.snapTicks;

        let maxRightPx = 0;
        ds.selectedNotesStart.forEach((item) => {
          const newDur = Math.max(state.snapTicks, item.startDur + deltaTicks);
          item.note.durationTicks = newDur;
          if (item.note._el) {
            item.note._el.style.width = `${newDur * state.zoomX}px`;
            const rightPx = (item.note.startTick + newDur) * state.zoomX;
            if (rightPx > maxRightPx) maxRightPx = rightPx;
          }
        });

        if (maxRightPx > editorGridEl.elm.clientWidth) {
          editorGridEl.styleJs({ width: `${maxRightPx + 1000}px` });
        }
      } else if (
        ds.type === "draw_control" &&
        controlGridEl &&
        controlGridEl.elm
      ) {
        const rect = controlGridEl.elm.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const tick = Math.max(0, x / state.zoomX);
        const valPercent = Math.max(0, Math.min(1, 1 - y / rect.height));

        const affected = applyControlValue(tick, valPercent, ds);
        ds.lastTick = tick;
        ds.hasMoved = true;
        if (affected) renderControlGrid();
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (isScrubbing) {
        isScrubbing = false;
        document.body.style.cursor = "";
        return;
      }
      if (isDraggingTempo) {
        isDraggingTempo = false;
        if (state.tempo !== startTempoVal) pushHistory();
      }
      if (isDraggingSplitter) {
        isDraggingSplitter = false;
        if (splitter && splitter.elm) splitter.classOff("active");
        document.body.style.cursor = "";
      }
      if (isDraggingPrSplitter) {
        isDraggingPrSplitter = false;
        if (prSplitter && prSplitter.elm) prSplitter.classOff("active");
        document.body.style.cursor = "";
      }

      if (state.dragState && state.dragState.active) {
        const ds = state.dragState;
        let requiresGridLock = false;

        if (
          (ds.type === "select" || ds.type === "select_blocks") &&
          selBox &&
          dsRect
        ) {
          const currentX = e.clientX - dsRect.left;
          const currentY = e.clientY - dsRect.top;
          const startBoxX = dsStartX - dsRect.left;
          const startBoxY = dsStartY - dsRect.top;

          const x = Math.min(startBoxX, currentX);
          const y = Math.min(startBoxY, currentY);
          const w = Math.abs(currentX - startBoxX);
          const h = Math.abs(currentY - startBoxY);

          if (ds.type === "select") {
            const startTick = x / state.zoomX;
            const endTick = (x + w) / state.zoomX;
            const startRow = (y - RULER_HEIGHT) / state.zoomY;
            const endRow = (y - RULER_HEIGHT + h) / state.zoomY;

            const activePat = state.patterns.find(
              (p) => p.id === state.activePatternId,
            );
            const activeCh = state.channels.find(
              (c) => c.id === state.activeChannelId,
            );

            if (activePat && activeCh && activePat.data[activeCh.id]) {
              state.selectedNotes = activePat.data[activeCh.id].filter((n) => {
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
            renderEditorData();
          } else {
            const startTick = x / state.playlistZoomX;
            const endTick = (x + w) / state.playlistZoomX;
            const startTrack = (y - RULER_HEIGHT) / state.playlistZoomY;
            const endTrack = (y - RULER_HEIGHT + h) / state.playlistZoomY;

            state.selectedBlocks = state.playlist.filter((b) => {
              const pat = state.patterns.find((p) => p.id === b.patternId);
              const len = pat ? getPatternLength(pat.id) : 512;
              return (
                b.trackIndex >= startTrack &&
                b.trackIndex <= endTrack &&
                b.startTick < endTick &&
                b.startTick + len > startTick
              );
            });
            renderPlaylistBlocks();
          }
          if (selBox) selBox.cleanup();
          selBox = null;
          requiresGridLock = true;
        } else if (
          (ds.type === "move_block" ||
            ds.type === "move_note" ||
            ds.type === "resize_note") &&
          ds.hasMoved
        ) {
          if (ds.type === "resize_note" && state.selectedNotes.length > 0) {
            const activeCh = state.channels.find(
              (c) => c.id === state.activeChannelId,
            );
            if (activeCh)
              state.lastNoteDuration[activeCh.id] =
                state.selectedNotes[0].durationTicks;
          }
          pushHistory();
          requiresGridLock = true;
        } else if (ds.type === "draw_control" && ds.hasMoved) {
          pushHistory();
          requiresGridLock = true;
        }

        state.dragState.active = false;

        if (requiresGridLock) {
          renderPlaylistGrid();
          renderPianoRollGrid();
        }
      }
    });

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
      if (opt.v === state.snapTicks) el.attr({ selected: true });
    });
    snapSelect.on("change", (e) => {
      state.snapTicks = parseInt(e.target.value);
      renderPianoRollGrid();
    });

    new Html("span").text("Scale:").appendTo(toolbar);
    const rootSelect = new Html("select")
      .classOn("st-select")
      .appendTo(toolbar);
    CHROMA.forEach((n) =>
      new Html("option").attr({ value: n }).text(n).appendTo(rootSelect),
    );
    rootSelect.on("change", (e) => {
      state.scaleRoot = e.target.value;
      renderPianoRollGrid();
    });

    const scaleSelect = new Html("select")
      .classOn("st-select")
      .appendTo(toolbar);
    Object.keys(SCALES).forEach((s) =>
      new Html("option").attr({ value: s }).text(s).appendTo(scaleSelect),
    );
    scaleSelect.on("change", (e) => {
      state.scaleType = e.target.value;
      renderPianoRollGrid();
    });

    new Html("div")
      .classOn("st-btn")
      .text("Insert Lyrics")
      .attr({ title: "Apply lyrics to selected notes" })
      .appendTo(toolbar)
      .on("click", () => {
        if (!state.selectedNotes || state.selectedNotes.length === 0)
          return alert("Please select some notes in the pattern editor first.");
        const val = prompt(
          "Enter lyrics for selected notes.\nUse hyphens (-) to split syllables within a word.\nExample: Ne-ver gon-na give you up",
        );
        if (val) {
          applyBulkLyrics(val, state.selectedNotes);
          renderEditorData();
          pushHistory();
        }
      });

    const historyGroup = new Html("div")
      .styleJs({ display: "flex", gap: "5px", marginLeft: "10px" })
      .appendTo(toolbar);
    undoBtn = new Html("div")
      .html("↶")
      .classOn("st-btn", "st-btn-small")
      .attr({ title: "Undo (Ctrl+Z)" })
      .appendTo(historyGroup)
      .on("click", undo);
    redoBtn = new Html("div")
      .html("↷")
      .classOn("st-btn", "st-btn-small")
      .attr({ title: "Redo (Ctrl+Y)" })
      .appendTo(historyGroup)
      .on("click", redo);

    const fileDropdown = new Html("div")
      .classOn("st-dropdown")
      .styleJs({ marginLeft: "auto" })
      .appendTo(toolbar);
    const fileBtn = new Html("div")
      .text("File Options...")
      .classOn("st-btn")
      .appendTo(fileDropdown);

    fileBtn.on("mousedown", (e) => {
      showDropdown(e, [
        { label: "Load JSON", action: loadProject },
        { label: "Save JSON", action: saveProject },
        { label: "Export MIDI", action: exportMidi },
      ]);
    });

    const workspace = new Html("div").classOn("st-workspace").appendTo(wrapper);

    topPane = new Html("div").classOn("st-pane").appendTo(workspace);
    topPane.elm.addEventListener(
      "mousedown",
      () => {
        if (!state.isPlaying) setPlayMode("song");
      },
      true,
    );

    const patternSidebar = new Html("div")
      .classOn("st-sidebar")
      .appendTo(topPane);
    const patHeader = new Html("div")
      .classOn("st-sidebar-header")
      .text("Patterns")
      .appendTo(patternSidebar);

    new Html("div")
      .text("+ Pat")
      .classOn("st-btn", "st-btn-small")
      .appendTo(patHeader)
      .on("click", () => {
        state.patterns.push({
          id: state.nextPatternId++,
          name: `Pattern ${state.nextPatternId - 1}`,
          color: COLORS[state.nextPatternId % COLORS.length],
          data: {},
          automation: {},
        });
        renderPatternList();
        pushHistory();
      });

    const patListEl = new Html("div").appendTo(patternSidebar);

    const playlistArea = new Html("div")
      .classOn("st-grid-area")
      .appendTo(topPane);
    const playlistScroll = new Html("div")
      .classOn("st-grid-scroll")
      .appendTo(playlistArea);
    playlistGridEl = new Html("div")
      .classOn("st-grid")
      .appendTo(playlistScroll);
    const playlistBg = new Html("div")
      .classOn("st-grid-bg")
      .appendTo(playlistGridEl);
    playheadPlaylist = new Html("div")
      .classOn("st-playhead")
      .appendTo(playlistGridEl);

    splitter = new Html("div").classOn("st-splitter").appendTo(workspace);
    splitter.on("mousedown", (e) => {
      e.preventDefault();
      isDraggingSplitter = true;
      splitter.classOn("active");
      document.body.style.cursor = "ns-resize";
    });

    bottomPane = new Html("div")
      .classOn("st-pane", "bottom")
      .appendTo(workspace);
    bottomPane.elm.addEventListener(
      "mousedown",
      () => {
        if (!state.isPlaying) setPlayMode("pat");
      },
      true,
    );

    const channelSidebar = new Html("div")
      .classOn("st-sidebar")
      .appendTo(bottomPane);
    const chHeader = new Html("div")
      .classOn("st-sidebar-header")
      .text("Instruments")
      .appendTo(channelSidebar);

    const chAddBtn = new Html("div")
      .text("+ Add")
      .classOn("st-btn", "st-btn-small")
      .appendTo(chHeader);
    chAddBtn.on("mousedown", (e) => {
      showDropdown(e, [
        {
          label: "Instrument",
          action: () => {
            state.channels.push({
              id: state.nextChannelId++,
              name: `Inst ${state.nextChannelId - 1}`,
              instrument: 0,
              isDrum: false,
              color: COLORS[state.nextChannelId % COLORS.length],
              volume: 100,
              pan: 64,
            });
            renderChannelList();
            pushHistory();
          },
        },
        {
          label: "Drums",
          action: () => {
            state.channels.push({
              id: state.nextChannelId++,
              name: `Drums`,
              instrument: 0,
              isDrum: true,
              color: COLORS[state.nextChannelId % COLORS.length],
              volume: 100,
              pan: 64,
            });
            renderChannelList();
            pushHistory();
          },
        },
      ]);
    });

    const chListEl = new Html("div").appendTo(channelSidebar);

    const editorArea = new Html("div")
      .classOn("st-grid-area")
      .styleJs({ flexDirection: "column" })
      .appendTo(bottomPane);

    const prContainer = new Html("div")
      .styleJs({ display: "flex", flex: 1, overflow: "hidden" })
      .appendTo(editorArea);
    const prKeys = new Html("div").classOn("st-keys").appendTo(prContainer);
    const prScroll = new Html("div")
      .classOn("st-grid-scroll")
      .appendTo(prContainer);
    editorGridEl = new Html("div").classOn("st-grid").appendTo(prScroll);
    const prBg = new Html("div").classOn("st-grid-bg").appendTo(editorGridEl);
    playheadEditor = new Html("div")
      .classOn("st-playhead")
      .appendTo(editorGridEl);

    prSplitter = new Html("div")
      .classOn("st-splitter")
      .styleJs({ height: "4px", cursor: "ns-resize" })
      .appendTo(editorArea);
    prSplitter.on("mousedown", (e) => {
      e.preventDefault();
      isDraggingPrSplitter = true;
      startPrSplitterY = e.clientY;
      startControlHeight = controlContainer.elm.clientHeight;
      prSplitter.classOn("active");
      document.body.style.cursor = "ns-resize";
    });

    controlContainer = new Html("div")
      .styleJs({
        display: "flex",
        height: "120px",
        flexShrink: 0,
        background: "#0c0c11",
      })
      .appendTo(editorArea);
    const controlSidebar = new Html("div")
      .classOn("st-control-sidebar")
      .appendTo(controlContainer);
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
      state.activeControl = e.target.value;
      renderControlGrid();
    });

    controlScroll = new Html("div")
      .classOn("st-grid-scroll")
      .styleJs({ overflowY: "hidden" })
      .appendTo(controlContainer);
    controlGridEl = new Html("div").classOn("st-grid").appendTo(controlScroll);
    controlBg = new Html("div").classOn("st-grid-bg").appendTo(controlGridEl);

    prScroll.on("scroll", (e) => {
      if (prKeys.elm) prKeys.elm.scrollTop = e.target.scrollTop;
      if (controlScroll.elm) controlScroll.elm.scrollLeft = e.target.scrollLeft;
    });
    controlScroll.on("scroll", (e) => {
      if (prScroll.elm) prScroll.elm.scrollLeft = e.target.scrollLeft;
    });

    controlGridEl.on("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = controlGridEl.elm.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const tick = Math.max(0, x / state.zoomX);
      const valPercent = Math.max(0, Math.min(1, 1 - y / rect.height));

      state.dragState = {
        active: true,
        type: "draw_control",
        lastTick: tick,
        hasMoved: false,
      };

      applyControlValue(tick, valPercent, state.dragState);
      renderControlGrid();
    });

    const lyricSidebar = new Html("div")
      .classOn("st-right-sidebar")
      .appendTo(bottomPane);
    new Html("div")
      .classOn("st-sidebar-header")
      .text("Lyric Preview")
      .appendTo(lyricSidebar);
    lyricPreviewContent = new Html("div")
      .classOn("st-lyric-preview")
      .appendTo(lyricSidebar);

    function openInstrumentModal(ch) {
      const overlay = new Html("div")
        .classOn("st-modal-overlay")
        .appendTo("body");
      const content = new Html("div")
        .classOn("st-modal-content")
        .appendTo(overlay);
      const header = new Html("div")
        .classOn("st-modal-header")
        .appendTo(content);
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

      function renderList(filter = "") {
        listContainer.clear();
        GM_INSTRUMENTS.forEach((inst, i) => {
          if (inst.toLowerCase().includes(filter.toLowerCase())) {
            const item = new Html("div")
              .classOn("st-inst-item")
              .text(`${i + 1}: ${inst}`)
              .appendTo(listContainer);
            item.on("click", () => {
              ch.instrument = i;
              overlay.cleanup();
              renderChannelList();
              renderPianoRollGrid();
              pushHistory();
            });
          }
        });
      }

      renderList();
      searchInput.on("input", (e) => renderList(e.target.value));
      setTimeout(() => {
        if (searchInput.elm) searchInput.elm.focus();
      }, 10);
      overlay.on("mousedown", (e) => {
        if (e.target === overlay.elm) overlay.cleanup();
      });
    }

    function duplicateSelected() {
      if (state.playMode === "song") {
        if (!state.selectedBlocks || state.selectedBlocks.length === 0) return;
        const maxTick = Math.max(
          ...state.selectedBlocks.map(
            (b) => b.startTick + getPatternLength(b.patternId),
          ),
        );
        const minTick = Math.min(
          ...state.selectedBlocks.map((b) => b.startTick),
        );
        const offset = maxTick - minTick || state.playlistSnap;

        const newBlocks = state.selectedBlocks.map((b) => ({
          id: state.nextBlockId++,
          patternId: b.patternId,
          trackIndex: b.trackIndex,
          startTick: b.startTick + offset,
        }));
        state.playlist.push(...newBlocks);
        state.selectedBlocks = newBlocks;
        renderPlaylistBlocks();
        pushHistory();
      } else {
        if (!state.selectedNotes || state.selectedNotes.length === 0) return;
        const activePat = state.patterns.find(
          (p) => p.id === state.activePatternId,
        );
        const activeCh = state.channels.find(
          (c) => c.id === state.activeChannelId,
        );
        if (!activePat || !activeCh || activeCh.isDrum) return;

        const maxTick = Math.max(
          ...state.selectedNotes.map((n) => n.startTick + n.durationTicks),
        );
        const minTick = Math.min(
          ...state.selectedNotes.map((n) => n.startTick),
        );
        const offset = maxTick - minTick || state.snapTicks;

        const newNotes = state.selectedNotes.map((n) => ({
          pitch: n.pitch,
          startTick: n.startTick + offset,
          durationTicks: n.durationTicks,
          lyric: n.lyric,
          velocity: n.velocity,
        }));
        activePat.data[activeCh.id].push(...newNotes);
        state.selectedNotes = newNotes;
        renderEditorData();
        renderPlaylistBlocks();
        pushHistory();
      }
    }

    function shiftSelectedPitch(amount) {
      if (
        state.playMode === "song" ||
        !state.selectedNotes ||
        state.selectedNotes.length === 0
      )
        return;
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (activeCh && activeCh.isDrum) return;
      const chVol =
        activeCh && activeCh.volume !== undefined ? activeCh.volume : 100;
      const chPan = activeCh && activeCh.pan !== undefined ? activeCh.pan : 64;

      let changed = false;
      state.selectedNotes.forEach((n) => {
        const idx = PITCHES.indexOf(n.pitch);
        if (idx > -1) {
          const newIdx = Math.max(
            0,
            Math.min(PITCHES.length - 1, idx + amount),
          );
          if (newIdx !== idx) {
            n.pitch = PITCHES[newIdx];
            changed = true;
          }
        }
      });

      if (changed) {
        renderEditorData();
        playNotePreview(state.selectedNotes[0].pitch, false, chVol, chPan);
        pushHistory();
      }
    }

    window.addEventListener("keydown", (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "SELECT" ||
        e.target.getAttribute("contenteditable") === "true"
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case "KeyA":
            e.preventDefault();
            if (state.playMode === "song") {
              state.selectedBlocks = [...state.playlist];
              renderPlaylistBlocks();
            } else {
              const pat = state.patterns.find(
                (p) => p.id === state.activePatternId,
              );
              if (pat && pat.data[state.activeChannelId]) {
                state.selectedNotes = [...pat.data[state.activeChannelId]];
                renderEditorData();
              }
            }
            break;
          case "KeyB":
            e.preventDefault();
            duplicateSelected();
            break;
          case "ArrowUp":
            e.preventDefault();
            shiftSelectedPitch(e.shiftKey ? -1 : -12);
            break;
          case "ArrowDown":
            e.preventDefault();
            shiftSelectedPitch(e.shiftKey ? 1 : 12);
            break;
          case "KeyZ":
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case "KeyY":
            e.preventDefault();
            redo();
            break;
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        togglePlayback();
      }
    });

    function renderPatternList() {
      const parent = patListEl.elm.parentElement;
      const prevTop = parent ? parent.scrollTop : 0;

      patListEl.clear();
      state.patterns.forEach((pat) => {
        const item = new Html("div")
          .classOn("st-list-item")
          .appendTo(patListEl);
        if (state.activePatternId === pat.id) item.classOn("active");

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
          state.activePatternId = pat.id;
          state.selectedNotes = [];
          renderPatternList();
          renderEditorData();
        });

        item.on("contextmenu", (e) => {
          showDropdown(
            e,
            [
              {
                label: "Rename",
                action: () =>
                  triggerRename(nameSpan, pat, "name", renderPatternList),
              },
              {
                label: "Change Color",
                action: () => {
                  triggerColorPicker(pat.color, (c) => {
                    pat.color = c;
                    renderPatternList();
                    renderPlaylistBlocks();
                    renderEditorData();
                    pushHistory();
                  });
                },
              },
              {
                label: "Duplicate",
                action: () => {
                  const newId = state.nextPatternId++;
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
                  state.patterns.push({
                    id: newId,
                    name: `${pat.name} (copy)`,
                    color: pat.color,
                    data: newData,
                    automation: newAuto,
                  });
                  renderPatternList();
                  pushHistory();
                },
              },
              {
                label: "Delete",
                color: "#ff5555",
                action: () => {
                  if (state.patterns.length <= 1)
                    return alert("Must have at least one pattern.");
                  state.patterns = state.patterns.filter(
                    (p) => p.id !== pat.id,
                  );
                  if (state.activePatternId === pat.id)
                    state.activePatternId = state.patterns[0].id;
                  state.playlist = state.playlist.filter(
                    (b) => b.patternId !== pat.id,
                  );
                  renderPatternList();
                  renderPlaylistBlocks();
                  renderEditorData();
                  pushHistory();
                },
              },
            ],
            true,
          );
        });
        makeListDraggableScoped(item, state.patterns, pat, renderPatternList);
      });
      if (parent) parent.scrollTop = prevTop;
    }

    function renderChannelList() {
      const parent = chListEl.elm.parentElement;
      const prevTop = parent ? parent.scrollTop : 0;

      chListEl.clear();
      state.channels.forEach((ch) => {
        const item = new Html("div").classOn("st-list-item").appendTo(chListEl);
        if (state.activeChannelId === ch.id) item.classOn("active");

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

        let instBtn;
        if (!ch.isDrum) {
          const btnContainer = new Html("div")
            .styleJs({ width: "100%" })
            .appendTo(btm);
          instBtn = new Html("div")
            .classOn("st-btn", "st-inst-btn")
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
            .appendTo(btnContainer);
        }

        const volContainer = new Html("div")
          .styleJs({
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
          })
          .appendTo(btm);
        new Html("span")
          .text("🔈")
          .styleJs({ fontSize: "0.9rem", opacity: "0.7" })
          .appendTo(volContainer);
        const volSlider = new Html("input")
          .classOn("st-vol-slider")
          .attr({
            type: "range",
            min: "0",
            max: "100",
            title: "Channel Volume (Scroll Wheel)",
          })
          .val(ch.volume !== undefined ? ch.volume : 100)
          .appendTo(volContainer);

        volSlider.on("mousedown", (e) => e.stopPropagation());
        volSlider.on("input", (e) => {
          ch.volume = parseInt(e.target.value);
        });
        volSlider.on("change", () => pushHistory());

        const panContainer = new Html("div")
          .styleJs({
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            marginTop: "4px",
          })
          .appendTo(btm);
        new Html("span")
          .text("LR")
          .styleJs({
            fontSize: "0.8rem",
            opacity: "0.7",
            width: "16px",
            textAlign: "center",
            fontFamily: "sans-serif",
          })
          .appendTo(panContainer);
        const panSlider = new Html("input")
          .classOn("st-vol-slider")
          .attr({
            type: "range",
            min: "0",
            max: "127",
            title: "Channel Panning (0=L, 64=C, 127=R)",
          })
          .val(ch.pan !== undefined ? ch.pan : 64)
          .appendTo(panContainer);

        panSlider.on("mousedown", (e) => e.stopPropagation());
        panSlider.on("input", (e) => {
          ch.pan = parseInt(e.target.value);
        });
        panSlider.on("change", () => pushHistory());

        let wheelTimer;
        volSlider.on("wheel", (e) => {
          e.preventDefault();
          const dir = e.deltaY < 0 ? 1 : -1;
          const step = 5;
          let val = parseInt(volSlider.elm.value);
          val = Math.max(0, Math.min(100, val + dir * step));
          volSlider.val(val);
          ch.volume = val;
          clearTimeout(wheelTimer);
          wheelTimer = setTimeout(() => pushHistory(), 400);
        });

        if (instBtn) {
          instBtn.on("mousedown", (e) => {
            e.stopPropagation();
            state.activeChannelId = ch.id;
            state.selectedNotes = [];
            openInstrumentModal(ch);
            renderChannelList();
            renderPianoRollGrid();
          });
        }

        item.on("mousedown", (e) => {
          if (
            e.target.closest(".st-btn") ||
            e.target.getAttribute("contenteditable") === "true" ||
            e.target.closest("input")
          )
            return;
          state.activeChannelId = ch.id;
          state.selectedNotes = [];
          renderChannelList();
          renderPianoRollGrid();
        });

        item.on("contextmenu", (e) => {
          showDropdown(
            e,
            [
              {
                label: "Rename",
                action: () =>
                  triggerRename(nameSpan, ch, "name", renderChannelList),
              },
              {
                label: "Change Color",
                action: () => {
                  triggerColorPicker(
                    ch.color || COLORS[ch.id % COLORS.length],
                    (c) => {
                      ch.color = c;
                      renderChannelList();
                      pushHistory();
                    },
                  );
                },
              },
              {
                label: "Duplicate",
                action: () => {
                  const newId = state.nextChannelId++;
                  state.channels.push({
                    id: newId,
                    name: `${ch.name} (copy)`,
                    color: ch.color,
                    instrument: ch.instrument,
                    isDrum: ch.isDrum,
                    volume: ch.volume !== undefined ? ch.volume : 100,
                    pan: ch.pan !== undefined ? ch.pan : 64,
                  });
                  state.patterns.forEach((p) => {
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
                  renderChannelList();
                  pushHistory();
                },
              },
              {
                label: "Delete",
                color: "#ff5555",
                action: () => {
                  if (state.channels.length <= 1)
                    return alert("Must have at least one channel.");
                  state.channels = state.channels.filter((c) => c.id !== ch.id);
                  state.patterns.forEach((p) => {
                    delete p.data[ch.id];
                    if (p.automation) delete p.automation[ch.id];
                  });
                  if (state.activeChannelId === ch.id)
                    state.activeChannelId = state.channels[0].id;
                  renderChannelList();
                  renderPianoRollGrid();
                  pushHistory();
                },
              },
            ],
            true,
          );
        });
        makeListDraggableScoped(item, state.channels, ch, renderChannelList);
      });
      if (parent) parent.scrollTop = prevTop;
    }

    function renderPlaylistGrid() {
      const prevTop = playlistScroll.elm ? playlistScroll.elm.scrollTop : 0;
      const prevLeft = playlistScroll.elm ? playlistScroll.elm.scrollLeft : 0;

      playlistBg.clear();
      const numTracks = 10;

      let maxPlTick = 0;
      state.playlist.forEach((b) => {
        const len = getPatternLength(b.patternId);
        if (b.startTick + len > maxPlTick) maxPlTick = b.startTick + len;
      });

      const requiredPlWidthPx = (maxPlTick + 128 * 16) * state.playlistZoomX;
      const finalPlWidthPx = Math.max(8000, requiredPlWidthPx);
      const finalPlMaxTicks = finalPlWidthPx / state.playlistZoomX;

      playlistGridEl.styleJs({
        height: `${numTracks * state.playlistZoomY + RULER_HEIGHT}px`,
        width: `${finalPlWidthPx}px`,
      });

      new Html("div").classOn("st-timeline").appendTo(playlistBg);

      for (let i = 0; i < numTracks; i++) {
        new Html("div")
          .classOn("st-track-row")
          .styleJs({
            top: `${i * state.playlistZoomY + RULER_HEIGHT}px`,
            height: `${state.playlistZoomY}px`,
          })
          .appendTo(playlistBg);
      }
      for (let t = 0; t < finalPlMaxTicks; t += state.playlistSnap) {
        const col = new Html("div")
          .classOn("st-col-line")
          .styleJs({ left: `${t * state.playlistZoomX}px` })
          .appendTo(playlistBg);
        if (t % (512 * 4) === 0) col.classOn("bar");
        else col.classOn("beat");
      }
      renderPlaylistBlocks();

      if (playlistScroll.elm) {
        playlistScroll.elm.scrollTop = prevTop;
        playlistScroll.elm.scrollLeft = prevLeft;
      }
    }

    function renderPlaylistBlocks() {
      Array.from(
        playlistGridEl.elm.querySelectorAll(".st-pattern-block"),
      ).forEach((el) => el.remove());
      state.playlist.forEach((block) => {
        const pat = state.patterns.find((p) => p.id === block.patternId);
        if (!pat) return;
        const len = getPatternLength(pat.id);

        const el = new Html("div")
          .classOn("st-pattern-block")
          .appendTo(playlistGridEl);
        el.styleJs({
          top: `${block.trackIndex * state.playlistZoomY + RULER_HEIGHT + 1}px`,
          left: `${block.startTick * state.playlistZoomX}px`,
          width: `${len * state.playlistZoomX}px`,
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
                const leftPx = n.startTick * state.playlistZoomX;
                const widthPx = Math.max(
                  1,
                  n.durationTicks * state.playlistZoomX,
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

        if (state.selectedBlocks && state.selectedBlocks.includes(block))
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
          if (state.selectedBlocks.includes(block)) {
            state.playlist = state.playlist.filter(
              (b) => !state.selectedBlocks.includes(b),
            );
            state.selectedBlocks = [];
          } else
            state.playlist = state.playlist.filter((b) => b.id !== block.id);
          renderPlaylistBlocks();
          pushHistory();
        });

        el.on("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();

          if (state.activePatternId !== block.patternId) {
            state.activePatternId = block.patternId;
            state.selectedNotes = [];
            renderPatternList();
            renderEditorData();
          }
          if (!state.selectedBlocks) state.selectedBlocks = [];
          if (!state.selectedBlocks.includes(block)) {
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
              state.selectedBlocks = [block];
              document
                .querySelectorAll(".st-pattern-block")
                .forEach((node) => node.classList.remove("selected"));
            } else state.selectedBlocks.push(block);
            el.classOn("selected");
          }

          state.dragState = {
            active: true,
            hasMoved: false,
            type: "move_block",
            startX: e.clientX,
            startY: e.clientY,
            selectedBlocksStart: state.selectedBlocks.map((b) => ({
              block: b,
              startTick: b.startTick,
              startTrack: b.trackIndex,
            })),
          };
        });
      });
    }

    playlistGridEl.on("mousedown", (e) => {
      if (
        e.button !== 0 ||
        e.target.classList.contains("st-pattern-block") ||
        e.target.closest(".st-pattern-block")
      )
        return;
      const scrollRect =
        playlistGridEl.elm.parentElement.getBoundingClientRect();
      const viewportY = e.clientY - scrollRect.top;

      if (viewportY <= RULER_HEIGHT) {
        e.preventDefault();
        isScrubbing = true;
        scrubIsPlaylist = true;
        document.body.style.cursor = "ew-resize";
        handleScrub(e, true);
        return;
      }

      const rect = playlistGridEl.elm.getBoundingClientRect();
      const y = e.clientY - rect.top;

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        state.dragState = {
          active: true,
          type: "select_blocks",
          hasMoved: false,
        };
        dsStartX = e.clientX;
        dsStartY = e.clientY;
        dsRect = rect;
        selBox = new Html("div")
          .classOn("st-selection-box")
          .appendTo(playlistGridEl);
        const initialX = e.clientX - rect.left;
        const initialY = e.clientY - rect.top;
        selBox.styleJs({
          left: `${initialX}px`,
          top: `${initialY}px`,
          width: "0px",
          height: "0px",
        });
        return;
      }

      state.selectedBlocks = [];
      renderPlaylistBlocks();

      const x = e.clientX - rect.left;
      const startTick =
        Math.floor(x / state.playlistZoomX / state.playlistSnap) *
        state.playlistSnap;
      const trackIndex = Math.floor((y - RULER_HEIGHT) / state.playlistZoomY);

      state.playlist.push({
        id: state.nextBlockId++,
        patternId: state.activePatternId,
        trackIndex,
        startTick,
      });
      renderPlaylistBlocks();
      pushHistory();
    });

    function renderPianoRollGrid() {
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (!activeCh) return;

      const prevTop = prScroll.elm ? prScroll.elm.scrollTop : 0;
      const prevLeft = prScroll.elm ? prScroll.elm.scrollLeft : 0;
      const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
      const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;

      if (activeCh.isDrum) {
        prKeys.styleJs({ display: "none" });
        prBg.styleJs({ display: "none" });
        playheadEditor.styleJs({ display: "none" });
        editorGridEl.styleJs({ height: "100%", width: "100%" });
        renderEditorData();
        if (prScroll.elm) {
          prScroll.elm.scrollTop = prevTop;
          prScroll.elm.scrollLeft = prevLeft;
        }
        return;
      }

      prKeys.styleJs({ display: "block" });
      prBg.styleJs({ display: "block" });
      playheadEditor.styleJs({ display: "block" });
      prBg.clear();
      prKeys.clear();

      let maxPrTick = 0;
      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      if (activePat) {
        Object.values(activePat.data).forEach((notes) => {
          notes.forEach((n) => {
            if (n.startTick + n.durationTicks > maxPrTick)
              maxPrTick = n.startTick + n.durationTicks;
          });
        });
      }

      const requiredPrWidthPx = (maxPrTick + 128 * 16) * state.zoomX;
      const finalPrWidthPx = Math.max(8000, requiredPrWidthPx);
      const finalPrMaxTicks = finalPrWidthPx / state.zoomX;

      editorGridEl.styleJs({
        height: `${PITCHES.length * state.zoomY + RULER_HEIGHT}px`,
        width: `${finalPrWidthPx}px`,
      });
      new Html("div").classOn("st-timeline-corner").appendTo(prKeys);

      for (let i = 0; i < PITCHES.length; i++) {
        const pitch = PITCHES[i];
        const isBlack = pitch.includes("#");
        const isC = pitch.startsWith("C") && !isBlack;
        const key = new Html("div")
          .classOn("st-key", isBlack ? "black" : "white")
          .text(isC ? pitch : "")
          .styleJs({ top: `${i * state.zoomY + RULER_HEIGHT}px` })
          .appendTo(prKeys);
        if (isC) key.classOn("is-c");
        key.on("mousedown", () => playNotePreview(pitch, false, chVol, chPan));
      }

      const rootIndex = CHROMA.indexOf(state.scaleRoot);
      const scaleIntervals = SCALES[state.scaleType];

      new Html("div").classOn("st-timeline").appendTo(prBg);

      for (let i = 0; i < PITCHES.length; i++) {
        const row = new Html("div")
          .classOn("st-row")
          .styleJs({
            top: `${i * state.zoomY + RULER_HEIGHT}px`,
            height: `${state.zoomY}px`,
          })
          .appendTo(prBg);
        const pitchIdx = CHROMA.indexOf(PITCHES[i].replace(/[0-9]/g, ""));
        const relativeDiff = (pitchIdx - rootIndex + 12) % 12;
        if (relativeDiff === 0) row.classOn("root");
        else if (scaleIntervals.includes(relativeDiff)) row.classOn("in-scale");
      }

      for (let t = 0; t < finalPrMaxTicks; t += state.snapTicks) {
        const col = new Html("div")
          .classOn("st-col-line")
          .styleJs({ left: `${t * state.zoomX}px` })
          .appendTo(prBg);
        if (t % 128 === 0) col.classOn("beat");
        if (t % 512 === 0) col.classOn("bar");
      }

      renderEditorData();

      setTimeout(() => {
        if (!hasSnappedToC5) {
          const c5 = PITCHES.indexOf("C5");
          if (c5 > -1 && prScroll.elm) {
            prScroll.elm.scrollTop =
              c5 * state.zoomY + RULER_HEIGHT - prScroll.elm.clientHeight / 2;
            hasSnappedToC5 = true;
          }
        } else {
          if (prScroll.elm) {
            prScroll.elm.scrollTop = prevTop;
            prScroll.elm.scrollLeft = prevLeft;
          }
        }
      }, 0);
    }

    function renderControlGrid() {
      if (!controlGridEl || !controlGridEl.elm) return;
      Array.from(controlGridEl.elm.querySelectorAll(".st-lollipop")).forEach(
        (el) => el.remove(),
      );
      controlBg.clear();

      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (!activePat || !activeCh) return;

      let maxPrTick = 0;
      Object.values(activePat.data).forEach((notes) => {
        notes.forEach((n) => {
          if (n.startTick + n.durationTicks > maxPrTick)
            maxPrTick = n.startTick + n.durationTicks;
        });
      });
      const requiredPrWidthPx = (maxPrTick + 128 * 16) * state.zoomX;
      const finalPrWidthPx = Math.max(8000, requiredPrWidthPx);
      const finalPrMaxTicks = finalPrWidthPx / state.zoomX;

      controlGridEl.styleJs({ width: `${finalPrWidthPx}px` });

      for (let t = 0; t < finalPrMaxTicks; t += state.snapTicks) {
        const col = new Html("div")
          .classOn("st-col-line")
          .styleJs({ left: `${t * state.zoomX}px` })
          .appendTo(controlBg);
        if (t % 128 === 0) col.classOn("beat");
        if (t % 512 === 0) col.classOn("bar");
      }

      function drawLollipop(tick, percent, color, dataObj) {
        const heightPercent = Math.max(0, Math.min(100, percent * 100));
        const px = tick * state.zoomX;
        const isSelected =
          state.selectedNotes && state.selectedNotes.includes(dataObj);

        const container = new Html("div")
          .classOn("st-lollipop")
          .styleJs({ left: `${px}px`, height: "100%" })
          .appendTo(controlGridEl);
        new Html("div")
          .classOn("st-lollipop-head")
          .styleJs({
            background: color,
            filter: isSelected
              ? "brightness(1.5) drop-shadow(0 0 3px #fff)"
              : "",
          })
          .appendTo(container);
        new Html("div")
          .classOn("st-lollipop-stem")
          .styleJs({ background: color, height: `${heightPercent}%` })
          .appendTo(container);
      }

      if (state.activeControl === "velocity") {
        const notes = activePat.data[activeCh.id] || [];
        notes.forEach((n) => {
          drawLollipop(
            n.startTick,
            (n.velocity !== undefined ? n.velocity : 100) / 100,
            activePat.color,
            n,
          );
        });
      } else {
        const cc = state.activeControl;
        if (
          activePat.automation &&
          activePat.automation[activeCh.id] &&
          activePat.automation[activeCh.id][cc]
        ) {
          const events = activePat.automation[activeCh.id][cc];
          events.forEach((ev) => {
            drawLollipop(ev.startTick, ev.value / 127, activePat.color, ev);
          });
        }
      }
    }

    function renderDrumSequencer(activePat, activeCh) {
      const seqContainer = new Html("div")
        .classOn("st-drum-seq-container")
        .appendTo(editorGridEl);
      const lenTicks = getPatternLength(activePat.id);
      const totalSteps = Math.max(32, lenTicks / 32);
      const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
      const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;

      DRUMS.forEach((drum) => {
        const row = new Html("div")
          .classOn("st-step-row")
          .appendTo(seqContainer);
        const label = new Html("div")
          .classOn("st-step-label")
          .text(drum.name)
          .appendTo(row);
        label.on("mousedown", () =>
          playNotePreview(drum.pitch, true, chVol, chPan),
        );

        for (let i = 0; i < totalSteps; i++) {
          const btn = new Html("div")
            .classOn("st-step-btn")
            .attr({ "data-step": i })
            .appendTo(row);
          if (Math.floor(i / 4) % 2 === 0) btn.classOn("beat");

          const tick = i * 32;
          if (!activePat.data[activeCh.id]) activePat.data[activeCh.id] = [];
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
              playNotePreview(drum.pitch, true, chVol, chPan);
            }
            renderPlaylistBlocks();
            renderControlGrid();
            pushHistory();
          });
        }
      });
    }

    function renderLyricPreview() {
      if (!lyricPreviewContent) return;
      lyricPreviewContent.clear();

      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (
        !activePat ||
        !activeCh ||
        activeCh.isDrum ||
        !activePat.data[activeCh.id]
      ) {
        lyricPreviewContent.text("No lyrics available.");
        return;
      }

      const notes = [...activePat.data[activeCh.id]].sort(
        (a, b) => a.startTick - b.startTick,
      );
      const lyricNotes = notes.filter((n) => n.lyric);

      if (lyricNotes.length === 0) {
        lyricPreviewContent.text("No lyrics in this pattern.");
        return;
      }

      let displayableIndex = 0;
      lyricNotes.forEach((n) => {
        let textToRender = n.lyric;
        const cleanText = textToRender.replace(/[\r\n\/\\]/g, "");
        if (!cleanText || cleanText.startsWith("@")) return;

        const isLineBreak =
          textToRender.startsWith("/") || textToRender.startsWith("\\");
        if (isLineBreak && displayableIndex > 0) {
          new Html("br").appendTo(lyricPreviewContent);
          new Html("br").appendTo(lyricPreviewContent);
        }

        const span = new Html("span")
          .classOn("st-lyric-preview-syl")
          .text(cleanText)
          .attr({ "data-lyric-index": displayableIndex })
          .appendTo(lyricPreviewContent);
        if (state.selectedNotes && state.selectedNotes.includes(n))
          span.classOn("selected");

        span.on("mousedown", (e) => {
          e.stopPropagation();
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (!state.selectedNotes.includes(n)) state.selectedNotes.push(n);
            else
              state.selectedNotes = state.selectedNotes.filter(
                (sn) => sn !== n,
              );
          } else state.selectedNotes = [n];
          renderEditorData();
        });
        displayableIndex++;
      });
    }

    function renderEditorData() {
      Array.from(
        editorGridEl.elm.querySelectorAll(
          ".st-note, .st-drum-seq-container, .st-selection-box",
        ),
      ).forEach((el) => el.remove());

      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (!activePat || !activeCh) return;

      const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
      const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;

      if (!activePat.data[activeCh.id]) activePat.data[activeCh.id] = [];
      const notes = activePat.data[activeCh.id];

      if (activeCh.isDrum) {
        renderDrumSequencer(activePat, activeCh);
        renderLyricPreview();
        renderControlGrid();
        return;
      }

      notes.forEach((note) => {
        const row = PITCHES.indexOf(note.pitch);
        if (row === -1) return;

        const noteEl = new Html("div")
          .classOn("st-note")
          .appendTo(editorGridEl);
        noteEl.styleJs({
          top: `${row * state.zoomY + RULER_HEIGHT + 1}px`,
          left: `${note.startTick * state.zoomX}px`,
          width: `${note.durationTicks * state.zoomX}px`,
          height: `${state.zoomY - 2}px`,
          background: activePat.color,
        });

        if (note.lyric)
          new Html("div")
            .classOn("st-note-lyric")
            .text(note.lyric)
            .appendTo(noteEl);
        if (state.selectedNotes && state.selectedNotes.includes(note))
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
          if (state.selectedNotes.includes(note)) {
            activePat.data[activeCh.id] = activePat.data[activeCh.id].filter(
              (n) => !state.selectedNotes.includes(n),
            );
            state.selectedNotes = [];
          } else
            activePat.data[activeCh.id] = activePat.data[activeCh.id].filter(
              (n) => n !== note,
            );
          renderEditorData();
          renderPlaylistBlocks();
          pushHistory();
        });

        noteEl.on("dblclick", (e) => {
          e.stopPropagation();
          document
            .querySelectorAll(".st-lyric-popup")
            .forEach((el) => el.remove());

          const current = note.lyric || "";
          const isNewLine = current.startsWith("/") || current.startsWith("\\");
          const cleanText = current.replace(/^[\/\\]/, "");

          const popup = new Html("div")
            .classOn("st-lyric-popup")
            .appendTo(editorGridEl);
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
          const check = new Html("div")
            .classOn("st-custom-check")
            .appendTo(label);
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
            renderEditorData();
            pushHistory();
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
          setTimeout(
            () => window.addEventListener("mousedown", outsideClick),
            10,
          );
        });

        noteEl.on("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();

          state.lastNoteDuration[activeCh.id] = note.durationTicks;
          if (!state.selectedNotes) state.selectedNotes = [];
          if (!state.selectedNotes.includes(note)) {
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
              state.selectedNotes = [note];
              document
                .querySelectorAll(".st-note")
                .forEach((el) => el.classList.remove("selected"));
            } else state.selectedNotes.push(note);
            noteEl.classOn("selected");
          }

          state.dragState = {
            active: true,
            hasMoved: false,
            type: e.target.classList.contains("st-note-resize")
              ? "resize_note"
              : "move_note",
            startX: e.clientX,
            startY: e.clientY,
            selectedNotesStart: state.selectedNotes.map((n) => ({
              note: n,
              startTick: n.startTick,
              startRow: PITCHES.indexOf(n.pitch),
              startDur: n.durationTicks,
            })),
          };
          playNotePreview(note.pitch, false, chVol, chPan);
          renderControlGrid();
        });
      });

      renderLyricPreview();
      renderControlGrid();
    }

    editorGridEl.on("mousedown", (e) => {
      if (
        e.button !== 0 ||
        e.target.classList.contains("st-note") ||
        e.target.classList.contains("st-note-resize")
      )
        return;
      const activePat = state.patterns.find(
        (p) => p.id === state.activePatternId,
      );
      const activeCh = state.channels.find(
        (c) => c.id === state.activeChannelId,
      );
      if (!activePat || !activeCh || activeCh.isDrum) return;

      const scrollRect = editorGridEl.elm.parentElement.getBoundingClientRect();
      const viewportY = e.clientY - scrollRect.top;

      if (viewportY <= RULER_HEIGHT) {
        e.preventDefault();
        isScrubbing = true;
        scrubIsPlaylist = false;
        document.body.style.cursor = "ew-resize";
        handleScrub(e, false);
        return;
      }

      const rect = editorGridEl.elm.getBoundingClientRect();
      const y = e.clientY - rect.top;

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        state.dragState = { active: true, type: "select", hasMoved: false };
        dsStartX = e.clientX;
        dsStartY = e.clientY;
        dsRect = rect;
        selBox = new Html("div")
          .classOn("st-selection-box")
          .appendTo(editorGridEl);
        selBox.styleJs({
          left: `${e.clientX - rect.left}px`,
          top: `${y}px`,
          width: "0px",
          height: "0px",
        });
        return;
      }

      state.selectedNotes = [];
      renderEditorData();

      const startTick =
        Math.floor((e.clientX - rect.left) / state.zoomX / state.snapTicks) *
        state.snapTicks;
      const row = Math.floor((y - RULER_HEIGHT) / state.zoomY);
      const pitch = PITCHES[row];
      if (!pitch) return;

      const resolvedDuration =
        state.lastNoteDuration[activeCh.id] || state.snapTicks;

      if (!activePat.data[activeCh.id]) activePat.data[activeCh.id] = [];
      activePat.data[activeCh.id].push({
        pitch,
        startTick,
        durationTicks: resolvedDuration,
        velocity: 100,
      });
      state.lastNoteDuration[activeCh.id] = resolvedDuration;

      const chVol = activeCh.volume !== undefined ? activeCh.volume : 100;
      const chPan = activeCh.pan !== undefined ? activeCh.pan : 64;
      playNotePreview(pitch, false, chVol, chPan);

      renderEditorData();
      renderPlaylistBlocks();
      pushHistory();
    });

    function setPlayMode(mode) {
      if (state.playMode !== mode) {
        state.playMode = mode;
        updatePlayBtnText();
        if (state.isPlaying) {
          ForteEngine.stopTrack();
          compileAndPlay();
        }
      }
    }

    function updatePlayBtnText() {
      modeToggleBtn.text(state.playMode === "song" ? "🎵 Song" : "🧩 Pat");
      if (state.playMode === "song")
        modeToggleBtn.styleJs({
          borderColor: "var(--encore-blue)",
          color: "var(--encore-blue)",
        });
      else
        modeToggleBtn.styleJs({
          borderColor: "var(--encore-orange)",
          color: "var(--encore-orange)",
        });

      if (state.isPlaying) playToggleBtn.html(`■ Stop`).classOn("play-active");
      else playToggleBtn.html(`▶ Play`).classOff("play-active");
    }

    async function togglePlayback() {
      if (state.isPlaying) {
        ForteEngine.stopTrack();
        state.isPlaying = false;
        updatePlayBtnText();
      } else await compileAndPlay();
    }

    function generateMidiWriter() {
      const midiTracks = [];
      const firstTrack = new midiWriterJs.Track();
      firstTrack.setTempo(state.tempo);

      let absoluteLyrics = [];
      const absoluteNotesByChannel = {};
      const absoluteAutomationByChannel = {};
      state.channels.forEach((ch) => {
        absoluteNotesByChannel[ch.id] = [];
        absoluteAutomationByChannel[ch.id] = [];
      });

      if (state.playMode === "song") {
        if (state.playlist.length === 0) return null;
        state.playlist.forEach((block) => {
          const pat = state.patterns.find((p) => p.id === block.patternId);
          if (!pat) return;
          Object.keys(pat.data).forEach((chId) => {
            pat.data[chId].forEach((n) => {
              if (n.lyric)
                absoluteLyrics.push({
                  text: n.lyric,
                  startTick: block.startTick + n.startTick,
                });
              absoluteNotesByChannel[chId].push({
                pitch: n.pitch,
                startTick: block.startTick + n.startTick,
                durationTicks: n.durationTicks,
                velocity: n.velocity,
              });
            });
          });
          if (pat.automation) {
            Object.keys(pat.automation).forEach((chId) => {
              Object.keys(pat.automation[chId]).forEach((cc) => {
                pat.automation[chId][cc].forEach((ev) => {
                  absoluteAutomationByChannel[chId].push({
                    cc: parseInt(cc),
                    value: ev.value,
                    startTick: block.startTick + ev.startTick,
                  });
                });
              });
            });
          }
        });
      } else {
        const pat = state.patterns.find((p) => p.id === state.activePatternId);
        if (!pat) return null;
        Object.keys(pat.data).forEach((chId) => {
          pat.data[chId].forEach((n) => {
            if (n.lyric)
              absoluteLyrics.push({ text: n.lyric, startTick: n.startTick });
            absoluteNotesByChannel[chId].push({
              pitch: n.pitch,
              startTick: n.startTick,
              durationTicks: n.durationTicks,
              velocity: n.velocity,
            });
          });
        });
        if (pat.automation) {
          Object.keys(pat.automation).forEach((chId) => {
            Object.keys(pat.automation[chId]).forEach((cc) => {
              pat.automation[chId][cc].forEach((ev) => {
                absoluteAutomationByChannel[chId].push({
                  cc: parseInt(cc),
                  value: ev.value,
                  startTick: ev.startTick,
                });
              });
            });
          });
        }
      }

      absoluteLyrics.sort((a, b) => a.startTick - b.startTick);
      const lyricTrack = new midiWriterJs.Track();
      lyricTrack.addTrackName("Words");
      const metaEv = new midiWriterJs.TextEvent({
        text: "{#TITLE=Encore Track}{#ARTIST=Encore Studio}",
        delta: 0,
      });
      metaEv.tick = 0;
      lyricTrack.addEvent(metaEv);

      if (absoluteLyrics.length > 0) {
        let lastTick = 0;
        absoluteLyrics.forEach((l) => {
          let currentTick = Math.round(l.startTick);
          let deltaTicks = currentTick - lastTick;
          const lyricEv = new midiWriterJs.LyricEvent({
            text: l.text,
            delta: deltaTicks,
          });
          lyricEv.tick = currentTick;
          lyricTrack.addEvent(lyricEv);
          lastTick = currentTick;
        });
      }

      midiTracks.push(firstTrack);
      if (absoluteLyrics.length > 0) midiTracks.push(lyricTrack);

      state.channels.forEach((ch, index) => {
        const notes = absoluteNotesByChannel[ch.id];
        const autoEvents = absoluteAutomationByChannel[ch.id];
        if (notes.length === 0 && autoEvents.length === 0) return;

        let midiChan = ch.isDrum ? 10 : index + 1 >= 10 ? index + 2 : index + 1;
        const sortedNotes = notes.sort((a, b) => a.startTick - b.startTick);
        const subTracks = [];

        const ccTrack = new midiWriterJs.Track();
        const chVol = ch.volume !== undefined ? ch.volume : 100;
        const mappedVolume = Math.round((chVol / 100) * 127);
        ccTrack.addEvent(
          new midiWriterJs.ControllerChangeEvent({
            controllerNumber: 7,
            controllerValue: mappedVolume,
            channel: midiChan,
          }),
        );

        const chPan = ch.pan !== undefined ? ch.pan : 64;
        ccTrack.addEvent(
          new midiWriterJs.ControllerChangeEvent({
            controllerNumber: 10,
            controllerValue: chPan,
            channel: midiChan,
          }),
        );

        if (!ch.isDrum)
          ccTrack.addEvent(
            new midiWriterJs.ProgramChangeEvent({
              instrument: ch.instrument,
              channel: midiChan,
            }),
          );

        autoEvents.sort((a, b) => a.startTick - b.startTick);
        let lastAutoTick = 0;
        autoEvents.forEach((ev) => {
          const delta = ev.startTick - lastAutoTick;
          const cEv = new midiWriterJs.ControllerChangeEvent({
            controllerNumber: ev.cc,
            controllerValue: ev.value,
            channel: midiChan,
            delta: delta,
          });
          cEv.tick = Math.round(ev.startTick);
          ccTrack.addEvent(cEv);
          lastAutoTick = Math.round(ev.startTick);
        });
        midiTracks.push(ccTrack);

        sortedNotes.forEach((n) => {
          let st = subTracks.find((s) => s.endTick <= n.startTick);
          if (!st) {
            st = { endTick: 0, mTrack: new midiWriterJs.Track() };
            subTracks.push(st);
            midiTracks.push(st.mTrack);
          }
          st.mTrack.addEvent(
            new midiWriterJs.NoteEvent({
              pitch: n.pitch,
              duration: `T${n.durationTicks}`,
              wait: `T${n.startTick - st.endTick}`,
              channel: midiChan,
              velocity: n.velocity !== undefined ? n.velocity : 100,
            }),
          );
          st.endTick = n.startTick + n.durationTicks;
        });
      });

      if (midiTracks.length === 1) return null;
      return new midiWriterJs.Writer(midiTracks);
    }

    async function compileAndPlay() {
      const write = generateMidiWriter();
      if (!write) {
        if (state.isPlaying) {
          state.isPlaying = false;
          updatePlayBtnText();
        }
        return;
      }
      const loaded = await ForteEngine.loadMidiDataUri(write.dataUri());
      if (loaded) {
        ForteEngine.playTrack();
        state.isPlaying = true;
        updatePlayBtnText();
      }
    }

    async function exportMidi() {
      const write = generateMidiWriter();
      if (!write) return alert("Nothing to export! Add some notes first.");
      const a = document.createElement("a");
      a.href = write.dataUri();
      a.download = "EncoreTrack.mid";
      a.click();
    }

    function saveProject() {
      const saveState = {
        ...state,
        dragState: undefined,
        selectedNotes: undefined,
        selectedBlocks: undefined,
        draggedItem: undefined,
        history: undefined,
        historyIndex: undefined,
      };
      const blob = new Blob([JSON.stringify(saveState)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Project.esproj";
      a.click();
    }

    function loadProject() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".esproj,application/json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const parsed = JSON.parse(ev.target.result);
            Object.assign(state, parsed);
            state.lastNoteDuration = state.lastNoteDuration || {};
            state.selectedNotes = [];
            state.selectedBlocks = [];
            state.history = [];
            state.historyIndex = -1;
            state.isPlaying = false;
            hasSnappedToC5 = false;
            if (tempoInput && tempoInput.elm) tempoInput.val(state.tempo);
            updatePlayBtnText();
            renderPatternList();
            renderChannelList();
            renderPlaylistGrid();
            renderPianoRollGrid();
            pushHistory();
          } catch (err) {
            alert("Invalid project file.");
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    document.addEventListener("CherryTree.Forte.Playback.TimeUpdate", (e) => {
      const ticks = e.detail.currentTime * (state.tempo / 60) * 128;
      if (state.playMode === "song") {
        const px = ticks * state.playlistZoomX;
        if (playheadPlaylist.elm) playheadPlaylist.styleJs({ left: `${px}px` });
        const scr = playlistGridEl.elm.parentElement;
        if (
          state.isPlaying &&
          scr &&
          px > scr.scrollLeft + scr.clientWidth - 50
        )
          scr.scrollLeft = px - 50;
      } else {
        const activeCh = state.channels.find(
          (c) => c.id === state.activeChannelId,
        );
        if (activeCh && activeCh.isDrum) {
          const currentStep = Math.floor(ticks / 32);
          document
            .querySelectorAll(".st-step-btn")
            .forEach((b) => b.classList.remove("playing"));
          document
            .querySelectorAll(`.st-step-btn[data-step="${currentStep}"]`)
            .forEach((b) => b.classList.add("playing"));
        } else {
          const px = ticks * state.zoomX;
          if (playheadEditor.elm) playheadEditor.styleJs({ left: `${px}px` });
          const scr = editorGridEl.elm.parentElement;
          if (
            state.isPlaying &&
            scr &&
            px > scr.scrollLeft + scr.clientWidth - 50
          )
            scr.scrollLeft = px - 50;
        }
      }
    });

    document.addEventListener("CherryTree.Forte.Playback.Update", (e) => {
      if (e.detail.status === "stopped" && state.isPlaying) {
        state.isPlaying = false;
        updatePlayBtnText();
        if (playheadPlaylist.elm) playheadPlaylist.styleJs({ left: `0px` });
        if (playheadEditor.elm) playheadEditor.styleJs({ left: `0px` });
        document
          .querySelectorAll(".st-step-btn")
          .forEach((b) => b.classList.remove("playing"));
        document
          .querySelectorAll(".st-lyric-preview-syl.playing")
          .forEach((s) => s.classList.remove("playing"));
      }
    });

    document.addEventListener("CherryTree.Forte.Playback.LyricEvent", (e) => {
      if (!state.isPlaying) return;
      document
        .querySelectorAll(".st-lyric-preview-syl.playing")
        .forEach((el) => el.classList.remove("playing"));
      const target = document.querySelector(
        `.st-lyric-preview-syl[data-lyric-index="${e.detail.index}"]`,
      );
      if (target) {
        target.classList.add("playing");
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    pushHistory();
    renderPatternList();
    renderChannelList();
    renderPlaylistGrid();
    renderPianoRollGrid();
  },

  end: async function () {
    window.removeEventListener("contextmenu", blockContextMenu);
    if (wrapper) wrapper.cleanup();
    if (styleTag) styleTag.remove();
    if (previewCtx && previewCtx.state !== "closed") previewCtx.close();
    if (ForteEngine) ForteEngine.stopTrack();
  },
};

export default pkg;
