import midiWriterJs from "https://cdn.skypack.dev/midi-writer-js@2.1.4";
import { CHROMA } from "../utils/Constants.js";

export default class PlaybackManager {
  constructor(stateManager, forteEngine) {
    this.stateManager = stateManager;
    this.forteEngine = forteEngine;
    this.data = this.stateManager.data;
    this.previewCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.uiManager = null;

    this.onForteTimeUpdate = this.onForteTimeUpdate.bind(this);
    this.onForteUpdate = this.onForteUpdate.bind(this);
    this.onForteLyricEvent = this.onForteLyricEvent.bind(this);
  }

  setPlayMode(mode) {
    if (this.data.playMode !== mode) {
      this.data.playMode = mode;
      if (this.uiManager) this.uiManager.updatePlayBtnText();

      if (this.data.isPlaying) {
        if (this.forteEngine) this.forteEngine.stopTrack();
        this.compileAndPlay();
      }
    }
  }

  async togglePlayback() {
    if (this.data.isPlaying) {
      if (this.forteEngine) this.forteEngine.stopTrack();
      this.data.isPlaying = false;
      if (this.uiManager) this.uiManager.updatePlayBtnText();
    } else {
      await this.compileAndPlay();
    }
  }

  async compileAndPlay() {
    const write = this.generateMidiWriter();
    if (!write) {
      if (this.data.isPlaying) {
        this.data.isPlaying = false;
        if (this.uiManager) this.uiManager.updatePlayBtnText();
      }
      return;
    }

    if (this.forteEngine) {
      const loaded = await this.forteEngine.loadMidiDataUri(write.dataUri());
      if (loaded) {
        this.forteEngine.playTrack();
        this.data.isPlaying = true;
        if (this.uiManager) this.uiManager.updatePlayBtnText();
      }
    }
  }

  handleScrub(e, isPlaylist, containerEl) {
    if (!containerEl || !containerEl.elm) return;
    const rect = containerEl.elm.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zoomX = isPlaylist ? this.data.playlistZoomX : this.data.zoomX;
    const ticks = Math.max(0, x / zoomX);
    const tps = (this.data.tempo / 60) * 128;
    const timeInSeconds = ticks / tps;

    if (this.forteEngine && typeof this.forteEngine.seekTrack === "function") {
      this.forteEngine.seekTrack(timeInSeconds);
    }
  }

  playNotePreview(pitchStr, isDrum, vol = 100, pan = 64) {
    if (this.previewCtx.state === "suspended") this.previewCtx.resume();
    const osc = this.previewCtx.createOscillator();
    const gain = this.previewCtx.createGain();
    const panner = this.previewCtx.createStereoPanner();

    const mult = vol / 100;
    panner.pan.value = (pan - 64) / 64;

    if (isDrum) {
      if (pitchStr === "C2") {
        osc.frequency.setValueAtTime(120, this.previewCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          0.01,
          this.previewCtx.currentTime + 0.3,
        );
        gain.gain.setValueAtTime(1 * mult, this.previewCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          this.previewCtx.currentTime + 0.3,
        );
      } else if (pitchStr === "D2" || pitchStr === "D#2") {
        osc.type = "square";
        osc.frequency.setValueAtTime(200, this.previewCtx.currentTime);
        gain.gain.setValueAtTime(0.4 * mult, this.previewCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          this.previewCtx.currentTime + 0.15,
        );
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, this.previewCtx.currentTime);
        gain.gain.setValueAtTime(0.1 * mult, this.previewCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          this.previewCtx.currentTime + 0.05,
        );
      }
    } else {
      const note = pitchStr.replace(/[0-9]/g, "");
      const octave = parseInt(pitchStr.replace(/[^0-9]/g, ""));
      const midiNumber = CHROMA.indexOf(note) + (octave + 1) * 12;
      const freq = 440 * Math.pow(2, (midiNumber - 69) / 12);

      osc.type = "sawtooth";
      const filter = this.previewCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2000, this.previewCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(
        100,
        this.previewCtx.currentTime + 0.5,
      );

      osc.frequency.setValueAtTime(freq, this.previewCtx.currentTime);
      gain.gain.setValueAtTime(0.15 * mult, this.previewCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        this.previewCtx.currentTime + 0.4,
      );

      osc.connect(filter);
      filter.connect(gain);
    }

    gain.connect(panner);
    panner.connect(this.previewCtx.destination);
    osc.start();
    osc.stop(this.previewCtx.currentTime + 0.5);
  }

  generateMidiWriter() {
    const midiTracks = [];
    const firstTrack = new midiWriterJs.Track();
    firstTrack.setTempo(this.data.tempo);

    let absoluteLyrics = [];
    const absoluteNotesByChannel = {};
    const absoluteAutomationByChannel = {};

    this.data.channels.forEach((ch) => {
      absoluteNotesByChannel[ch.id] = [];
      absoluteAutomationByChannel[ch.id] = [];
    });

    if (this.data.playMode === "song") {
      if (this.data.playlist.length === 0) return null;
      this.data.playlist.forEach((block) => {
        const pat = this.data.patterns.find((p) => p.id === block.patternId);
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
      const pat = this.data.patterns.find(
        (p) => p.id === this.data.activePatternId,
      );
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

    this.data.channels.forEach((ch, index) => {
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

  registerForteEvents(uiManager) {
    this.uiManager = uiManager;
    document.addEventListener(
      "CherryTree.Forte.Playback.TimeUpdate",
      this.onForteTimeUpdate,
    );
    document.addEventListener(
      "CherryTree.Forte.Playback.Update",
      this.onForteUpdate,
    );
    document.addEventListener(
      "CherryTree.Forte.Playback.LyricEvent",
      this.onForteLyricEvent,
    );
  }

  onForteTimeUpdate(e) {
    if (!this.uiManager) return;
    const ticks = e.detail.currentTime * (this.data.tempo / 60) * 128;

    if (this.data.playMode === "song") {
      const px = ticks * this.data.playlistZoomX;
      if (
        this.uiManager.elements.playheadPlaylist &&
        this.uiManager.elements.playheadPlaylist.elm
      ) {
        this.uiManager.elements.playheadPlaylist.styleJs({ left: `${px}px` });
      }
      const scr = this.uiManager.elements.playlistGridEl.elm.parentElement;
      if (
        this.data.isPlaying &&
        scr &&
        px > scr.scrollLeft + scr.clientWidth - 50
      ) {
        scr.scrollLeft = px - 50;
      }
    } else {
      const activeCh = this.data.channels.find(
        (c) => c.id === this.data.activeChannelId,
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
        const px = ticks * this.data.zoomX;
        if (
          this.uiManager.elements.playheadEditor &&
          this.uiManager.elements.playheadEditor.elm
        ) {
          this.uiManager.elements.playheadEditor.styleJs({ left: `${px}px` });
        }
        const scr = this.uiManager.elements.editorGridEl.elm.parentElement;
        if (
          this.data.isPlaying &&
          scr &&
          px > scr.scrollLeft + scr.clientWidth - 50
        ) {
          scr.scrollLeft = px - 50;
        }
      }
    }
  }

  onForteUpdate(e) {
    if (e.detail.status === "stopped" && this.data.isPlaying) {
      this.data.isPlaying = false;
      if (this.uiManager) {
        this.uiManager.updatePlayBtnText();
        if (
          this.uiManager.elements.playheadPlaylist &&
          this.uiManager.elements.playheadPlaylist.elm
        ) {
          this.uiManager.elements.playheadPlaylist.styleJs({ left: `0px` });
        }
        if (
          this.uiManager.elements.playheadEditor &&
          this.uiManager.elements.playheadEditor.elm
        ) {
          this.uiManager.elements.playheadEditor.styleJs({ left: `0px` });
        }
      }
      document
        .querySelectorAll(".st-step-btn")
        .forEach((b) => b.classList.remove("playing"));
      document
        .querySelectorAll(".st-lyric-preview-syl.playing")
        .forEach((s) => s.classList.remove("playing"));
    }
  }

  onForteLyricEvent(e) {
    if (!this.data.isPlaying) return;
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
  }

  cleanup() {
    document.removeEventListener(
      "CherryTree.Forte.Playback.TimeUpdate",
      this.onForteTimeUpdate,
    );
    document.removeEventListener(
      "CherryTree.Forte.Playback.Update",
      this.onForteUpdate,
    );
    document.removeEventListener(
      "CherryTree.Forte.Playback.LyricEvent",
      this.onForteLyricEvent,
    );

    if (this.previewCtx && this.previewCtx.state !== "closed") {
      this.previewCtx.close();
    }
    if (this.forteEngine) {
      this.forteEngine.stopTrack();
    }
  }
}
