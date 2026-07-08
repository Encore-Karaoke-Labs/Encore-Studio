import { Sequencer } from "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.8/+esm";
import {
  BasicMIDI,
  MIDIMessageTypes as midiMessageTypes,
} from "https://cdn.jsdelivr.net/npm/spessasynth_core@4.3.12/+esm";
import { logVerbose } from "../core/State.js";
import { bindSpessaEvent } from "./Synthesizer.js";

function detectEncoding(uint8Array) {
  const encodings = [
    "utf-8",
    "shift-jis",
    "euc-kr",
    "windows-1250",
    "windows-1252",
    "utf-16le",
  ];
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      const text = decoder.decode(uint8Array);
      if (text.includes("\uFFFD")) continue;
      const controlChars = (text.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g) || [])
        .length;
      if (text.length > 0 && controlChars / text.length > 0.05) continue;
      return encoding;
    } catch (e) {
      continue;
    }
  }
  return "utf-8";
}

export class FortePlayback {
  constructor(state, audioCore, synthesizer, dispatchUpdate) {
    this.state = state;
    this.audioCore = audioCore;
    this.synthesizer = synthesizer;
    this.dispatchUpdate = dispatchUpdate;
    this.sourceNode = null;
    this.audioElement = null;
    this.animationFrameId = null;
    this.timingLoop = this.timingLoop.bind(this);
  }

  timingLoop() {
    if (this.state.playback.status !== "playing") {
      this.animationFrameId = null;
      return;
    }

    const now = performance.now();
    let delta = (now - this.state.playback.lastFrameTime) / 1000;
    if (delta > 0.1) delta = 0.1;
    this.state.playback.lastFrameTime = now;

    const engineState = this.getPlaybackState();
    const engineTime = engineState.currentTime;
    const duration = engineState.duration;

    let rate = 1.0;
    if (!this.state.playback.isMidi && this.audioElement) {
      rate = this.audioElement.playbackRate;
    }

    this.state.playback.smoothedTime += delta * rate;

    const drift = engineTime - this.state.playback.smoothedTime;
    if (Math.abs(drift) > 0.5) this.state.playback.smoothedTime = engineTime;
    else this.state.playback.smoothedTime += drift * 0.15;

    const currentTime = Math.max(
      0,
      Math.min(this.state.playback.smoothedTime, duration),
    );

    document.dispatchEvent(
      new CustomEvent("CherryTree.Forte.Playback.TimeUpdate", {
        detail: { currentTime, duration },
      }),
    );

    if (engineTime >= duration && duration > 0) {
      this.animationFrameId = null;
      if (this.state.playback.status === "playing") this.stopTrack();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.timingLoop);
  }

  _parseLyricsAndBindEvents(parsedMidi) {
    this.state.playback.sequencer = new Sequencer(
      this.state.playback.synthesizer,
    );
    this.state.playback.sequencer.loop = false;
    this.state.playback.synthesizer.setSystemParameter("keyShift", 0);

    bindSpessaEvent(
      this.state.playback.sequencer.eventHandler,
      "songEnded",
      "forte-song-end",
      () => {
        if (this.state.playback.status !== "stopped") this.stopTrack();
      },
    );

    let displayableLyricIndex = 0;
    bindSpessaEvent(
      this.state.playback.sequencer.eventHandler,
      "metaEvent",
      "forte-meta",
      (e) => {
        if (this.state.playback.status === "stopped") return;
        if (!e || !e.event || !e.event.data) return;

        // In SpessaSynth v4, track Lyrics and Text meta events
        if (
          e.event.statusByte !== midiMessageTypes.lyric &&
          e.event.statusByte !== midiMessageTypes.text
        )
          return;

        let text = new TextDecoder(this.state.playback.lyricsEncoding).decode(
          e.event.data,
        );
        const cleanText = text.replace(/[\r\n\/\\]/g, "");

        if (
          cleanText &&
          !cleanText.startsWith("@") &&
          !cleanText.startsWith("#")
        ) {
          document.dispatchEvent(
            new CustomEvent("CherryTree.Forte.Playback.LyricEvent", {
              detail: { index: displayableLyricIndex, text: cleanText },
            }),
          );
          displayableLyricIndex++;
        }
      },
    );

    // Parse static lyrics for Studio timeline UI preview
    let rawTrackEvents = parsedMidi.lyrics || [];
    if (rawTrackEvents.length === 0) {
      parsedMidi.tracks.forEach((track) => {
        const textEvents = track.events.filter(
          (e) =>
            e.statusByte === midiMessageTypes.lyric ||
            e.statusByte === midiMessageTypes.text,
        );
        if (textEvents.length > rawTrackEvents.length)
          rawTrackEvents = textEvents;
      });
    }

    rawTrackEvents.sort((a, b) => a.ticks - b.ticks);
    const totalLength = rawTrackEvents.reduce(
      (acc, val) => acc + (val.data ? val.data.byteLength : 0),
      0,
    );
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const msg of rawTrackEvents) {
      if (msg.data) {
        combinedBuffer.set(msg.data, offset);
        offset += msg.data.byteLength;
      }
    }

    this.state.playback.lyricsEncoding =
      totalLength > 0 ? detectEncoding(combinedBuffer) : "utf-8";
    const decoder = new TextDecoder(this.state.playback.lyricsEncoding);
    this.state.playback.decodedLyrics = [];

    rawTrackEvents.forEach((message) => {
      if (!message.data) return;
      let text = decoder.decode(message.data);
      const clean = text.replace(/[\r\n\/\\]/g, "");
      if (!clean.startsWith("@") && !clean.startsWith("#")) {
        this.state.playback.decodedLyrics.push(text.replace(/[\/\\]/g, "\n"));
      }
    });

    this.state.playback.sequencer.loadNewSongList([parsedMidi]);
  }

  async loadTrack(url) {
    if (!this.audioCore.context) return false;
    if (this.state.playback.status !== "stopped") this.stopTrack();

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute("src");
      this.audioElement.load();
      this.audioElement = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.state.playback.sequencer) {
      try {
        this.state.playback.sequencer.pause();
      } catch (e) {}
      this.state.playback.sequencer = null;
    }

    this.state.playback.decodedLyrics = [];
    this.state.playback.lyricsEncoding = "utf-8";
    this.state.playback.transpose = 0;
    this.state.playback.isMultiplexed = false;
    this.state.playback.multiplexPan = -1;

    const isMidi =
      url.toLowerCase().endsWith(".mid") ||
      url.toLowerCase().endsWith(".midi") ||
      url.toLowerCase().endsWith(".kar");
    this.state.playback.isMidi = isMidi;
    if (!isMidi && url.toLowerCase().includes(".multiplexed."))
      this.state.playback.isMultiplexed = true;

    try {
      if (isMidi) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        if (!this.state.playback.synthesizer)
          throw new Error("MIDI Synthesizer not ready.");
        let parsedMidi = BasicMIDI.fromArrayBuffer(arrayBuffer);
        this.state.playback.currentMidi = parsedMidi;

        this._parseLyricsAndBindEvents(parsedMidi);
        this.state.playback.buffer = null;
      } else {
        this.audioElement = new Audio(url);
        this.audioElement.crossOrigin = "anonymous";
        this.audioElement.preservesPitch = false;

        await new Promise((resolve, reject) => {
          this.audioElement.addEventListener("canplay", resolve, {
            once: true,
          });
          this.audioElement.addEventListener("error", reject, { once: true });
        });

        this.sourceNode = this.audioCore.context.createMediaElementSource(
          this.audioElement,
        );
        this.state.playback.buffer = null;
      }

      this.state.playback.status = "stopped";
      this.state.playback.pauseTime = 0;
      this.dispatchUpdate();
      return true;
    } catch (e) {
      console.error(`[FORTE STUDIO] Failed to load track: ${url}`, e);
      return false;
    }
  }

  async loadMidiDataUri(dataUri) {
    if (!this.audioCore.context) return false;
    if (this.state.playback.status !== "stopped") this.stopTrack();

    if (this.state.playback.sequencer) {
      try {
        this.state.playback.sequencer.pause();
      } catch (e) {}
      this.state.playback.sequencer = null;
    }

    this.state.playback.decodedLyrics = [];
    this.state.playback.lyricsEncoding = "utf-8";
    this.state.playback.transpose = 0;
    this.state.playback.isMultiplexed = false;
    this.state.playback.multiplexPan = -1;
    this.state.playback.isMidi = true;

    try {
      const base64String = dataUri.split(",")[1];
      if (!base64String) throw new Error("Invalid Data URI provided.");

      const binaryString = atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (!this.state.playback.synthesizer)
        throw new Error("MIDI Synthesizer not ready.");

      let parsedMidi = BasicMIDI.fromArrayBuffer(bytes.buffer);
      this.state.playback.currentMidi = parsedMidi;

      this._parseLyricsAndBindEvents(parsedMidi);

      this.state.playback.buffer = null;
      this.state.playback.status = "stopped";
      this.state.playback.pauseTime = 0;
      this.dispatchUpdate();
      return true;
    } catch (e) {
      console.error(`[FORTE STUDIO] Failed to load MIDI from Data URI`, e);
      return false;
    }
  }

  playTrack() {
    if (this.audioCore.context.state === "suspended")
      this.audioCore.context.resume();

    if (this.state.playback.isMidi) {
      if (
        !this.state.playback.sequencer ||
        this.state.playback.status === "playing"
      )
        return;
      this.state.playback.sequencer.currentTime = this.state.playback.pauseTime;
      this.state.playback.sequencer.play();
      this.state.playback.status = "playing";
    } else {
      if (!this.audioElement || this.state.playback.status === "playing")
        return;

      try {
        this.sourceNode.disconnect();
      } catch (e) {}

      this.audioElement.playbackRate = Math.pow(
        2,
        this.state.playback.transpose / 12,
      );
      this.audioElement.preservesPitch = false;

      if (this.state.playback.isMultiplexed) {
        const splitter = this.audioCore.context.createChannelSplitter(2);
        const leftGain = this.audioCore.context.createGain();
        const rightGain = this.audioCore.context.createGain();
        const monoMixer = this.audioCore.context.createGain();

        this.state.playback.leftPannerGain = leftGain;
        this.state.playback.rightPannerGain = rightGain;

        this.sourceNode.connect(splitter);
        splitter.connect(leftGain, 0);
        splitter.connect(rightGain, 1);
        leftGain.connect(monoMixer);
        rightGain.connect(monoMixer);
        monoMixer.connect(this.audioCore.masterGain);

        this.setMultiplexPan(this.state.playback.multiplexPan);
      } else {
        this.sourceNode.connect(this.audioCore.masterGain);
      }

      this.audioElement.onended = () => {
        if (this.state.playback.status === "playing") this.stopTrack();
      };

      this.audioElement.currentTime = this.state.playback.pauseTime || 0;
      this.audioElement.play().catch((e) => console.error(e));
      this.state.playback.startTime = this.audioCore.context.currentTime;
      this.state.playback.status = "playing";
    }

    this.dispatchUpdate();
    this.state.playback.lastFrameTime = performance.now();
    this.state.playback.smoothedTime = this.getPlaybackState().currentTime;

    if (this.animationFrameId === null) this.timingLoop();
  }

  pauseTrack() {
    if (this.state.playback.status !== "playing") return;

    if (this.state.playback.isMidi) {
      if (this.state.playback.sequencer) {
        this.state.playback.pauseTime =
          this.state.playback.sequencer.currentTime;
        try {
          this.state.playback.sequencer.pause();
        } catch (e) {}
      }
      this.state.playback.status = "paused";
    } else {
      if (!this.audioElement) return;
      this.state.playback.pauseTime = this.audioElement.currentTime;
      this.audioElement.pause();
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.state.playback.leftPannerGain = null;
      this.state.playback.rightPannerGain = null;
      this.state.playback.status = "paused";
    }

    this.dispatchUpdate();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  stopTrack() {
    if (this.state.playback.status === "stopped") return;
    this.state.playback.status = "stopped";

    if (this.state.playback.isMidi) {
      if (this.state.playback.sequencer) {
        try {
          this.state.playback.sequencer.pause();
        } catch (e) {}
        try {
          this.state.playback.sequencer.currentTime = 0;
        } catch (e) {}
      }
      this.synthesizer.unlockAllChannels();
      this.synthesizer.reset();

      if (
        this.state.playback.currentMidi &&
        typeof this.state.playback.currentMidi.flush === "function"
      ) {
        try {
          this.state.playback.currentMidi.flush();
        } catch (e) {}
      }
    } else {
      if (this.audioElement) {
        this.audioElement.onended = null;
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (e) {}
      }
    }

    this.state.playback.leftPannerGain = null;
    this.state.playback.rightPannerGain = null;
    this.state.playback.multiplexPan = -1;
    this.state.playback.pauseTime = 0;
    this.state.playback.smoothedTime = 0;

    this.dispatchUpdate();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  seekTrack(timeInSeconds) {
    const engineState = this.getPlaybackState();
    let newTime = Math.max(
      0,
      Math.min(timeInSeconds, engineState.duration || 0),
    );
    const wasPlaying = this.state.playback.status === "playing";

    if (this.state.playback.isMidi && this.state.playback.sequencer) {
      this.state.playback.sequencer.currentTime = newTime;
      this.state.playback.pauseTime = newTime;
      this.state.playback.smoothedTime = newTime;
      if (!wasPlaying) {
        try {
          this.state.playback.sequencer.pause();
        } catch (e) {}
        this.state.playback.status = "paused";
      }
    } else if (this.audioElement) {
      if (wasPlaying) this.audioElement.pause();
      this.audioElement.currentTime = newTime;
      this.state.playback.pauseTime = newTime;
      this.state.playback.smoothedTime = newTime;

      if (wasPlaying) {
        this.audioElement.play().catch(() => {});
      } else {
        this.state.playback.status = "paused";
      }
    }

    this.state.playback.lastFrameTime = performance.now();
    document.dispatchEvent(
      new CustomEvent("CherryTree.Forte.Playback.TimeUpdate", {
        detail: { currentTime: newTime, duration: engineState.duration },
      }),
    );
    this.dispatchUpdate();
  }

  setMultiplexPan(panValue) {
    const pan = Math.max(-1, Math.min(1, panValue));
    this.state.playback.multiplexPan = pan;
    const { leftPannerGain, rightPannerGain } = this.state.playback;
    if (leftPannerGain && rightPannerGain) {
      leftPannerGain.gain.setValueAtTime(
        (1 - pan) / 2,
        this.audioCore.context.currentTime,
      );
      rightPannerGain.gain.setValueAtTime(
        (1 + pan) / 2,
        this.audioCore.context.currentTime,
      );
    }
    this.dispatchUpdate();
  }

  setTranspose(semitones) {
    const clamped = Math.max(-24, Math.min(24, Math.round(semitones)));
    if (
      !this.state.playback.isMidi &&
      this.state.playback.status === "playing" &&
      this.audioElement
    ) {
      this.state.playback.pauseTime = this.audioElement.currentTime;
      this.state.playback.startTime = this.audioCore.context.currentTime;
    }

    this.state.playback.transpose = clamped;

    if (this.state.playback.isMidi && this.state.playback.synthesizer) {
      this.state.playback.synthesizer.setSystemParameter("keyShift", clamped);
    } else if (!this.state.playback.isMidi && this.audioElement) {
      this.audioElement.playbackRate = Math.pow(2, clamped / 12);
      this.audioElement.preservesPitch = false;
    }
    this.dispatchUpdate();
  }

  getPlaybackState() {
    let duration = 0;
    let currentTime = 0;

    if (this.state.playback.isMidi && this.state.playback.sequencer) {
      duration = this.state.playback.sequencer.duration || 0;
      currentTime = this.state.playback.sequencer.currentTime || 0;
    } else if (this.audioElement) {
      duration = this.audioElement.duration || 0;
      currentTime = this.audioElement.currentTime || 0;
    }

    return {
      status: this.state.playback.status,
      currentTime: Math.min(currentTime, duration),
      duration,
      currentDeviceId: this.state.playback.currentDeviceId,
      isMidi: this.state.playback.isMidi,
      isMultiplexed: this.state.playback.isMultiplexed,
      decodedLyrics: this.state.playback.decodedLyrics,
      transpose: this.state.playback.transpose,
      multiplexPan: this.state.playback.multiplexPan,
    };
  }

  cleanup() {
    this.stopTrack();
  }
}
