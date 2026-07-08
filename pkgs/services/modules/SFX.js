import { Sequencer } from "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.8/+esm";
import { BasicMIDI } from "https://cdn.jsdelivr.net/npm/spessasynth_core@4.3.12/+esm";
import { bindSpessaEvent } from "./Synthesizer.js";
import { logVerbose } from "../core/State.js";

export class ForteSFX {
  constructor(state, audioCore, synthesizer) {
    this.state = state;
    this.audioCore = audioCore;
    this.synthesizer = synthesizer;

    this.sfxCache = new Map();
    this.sfxSourceNode = null;
    this.sfxSequencer = null;
    this.sfxResolve = null;
    this.sfxMidiOriginalVolume = null;
    this.currentSfxMidi = null;
  }

  async loadSfx(url) {
    if (!this.audioCore.context) return false;
    if (this.sfxCache.has(url)) return true;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      const isMidi =
        url.toLowerCase().endsWith(".mid") ||
        url.toLowerCase().endsWith(".midi") ||
        url.toLowerCase().endsWith(".kar");

      if (isMidi) {
        this.sfxCache.set(url, { isMidi: true, buffer: arrayBuffer });
        return true;
      }

      const audioBuffer =
        await this.audioCore.context.decodeAudioData(arrayBuffer);
      this.sfxCache.set(url, { isMidi: false, buffer: audioBuffer });
      return true;
    } catch (e) {
      console.error(`[FORTE STUDIO] Failed to load SFX: ${url}`, e);
      return false;
    }
  }

  async playSfx(url, volume = 1) {
    await this.stopSfx();

    return new Promise(async (resolve) => {
      if (!this.audioCore.context) return resolve(false);
      if (this.audioCore.context.state === "suspended")
        await this.audioCore.context.resume();

      let cached = this.sfxCache.get(url);
      if (!cached) {
        const success = await this.loadSfx(url);
        if (!success) return resolve(false);
        cached = this.sfxCache.get(url);
      }

      const clampedVolume = Math.max(0, Math.min(1, volume));

      if (cached) {
        this.sfxResolve = resolve;

        if (cached.isMidi) {
          if (!this.state.playback.synthesizer || !this.state.playback.midiGain)
            return resolve(false);

          this.synthesizer.unlockAllChannels();
          this.synthesizer.reset();

          this.sfxMidiOriginalVolume = this.state.playback.midiGain.gain.value;
          const sfxTargetVolume =
            this.state.playback.volume *
            this.state.playback.sfxVolume *
            clampedVolume;

          this.state.playback.midiGain.gain.setTargetAtTime(
            sfxTargetVolume,
            this.audioCore.context.currentTime,
            0.01,
          );

          this.sfxSequencer = new Sequencer(this.state.playback.synthesizer);
          this.sfxSequencer.loop = false;

          try {
            this.currentSfxMidi = BasicMIDI.fromArrayBuffer(cached.buffer);
          } catch (e) {
            this.currentSfxMidi = { binary: cached.buffer };
          }
          this.sfxSequencer.loadNewSongList([this.currentSfxMidi]);
          this.sfxSequencer.play();

          bindSpessaEvent(
            this.sfxSequencer.eventHandler,
            "songEnded",
            "forte-sfx-end",
            () => {
              if (
                this.sfxMidiOriginalVolume !== null &&
                this.state.playback.midiGain
              ) {
                this.state.playback.midiGain.gain.setTargetAtTime(
                  this.sfxMidiOriginalVolume,
                  this.audioCore.context.currentTime,
                  0.01,
                );
                this.sfxMidiOriginalVolume = null;
              }

              this.synthesizer.unlockAllChannels();
              this.synthesizer.reset();

              if (
                this.currentSfxMidi &&
                typeof this.currentSfxMidi.flush === "function"
              ) {
                try {
                  this.currentSfxMidi.flush();
                } catch (e) {}
              }
              this.currentSfxMidi = null;

              if (this.sfxResolve) {
                this.sfxResolve(true);
                this.sfxResolve = null;
              }
              if (this.sfxSequencer) {
                try {
                  this.sfxSequencer.pause();
                } catch (e) {}
                this.sfxSequencer = null;
              }
            },
          );
        } else {
          this.sfxSourceNode = this.audioCore.context.createBufferSource();
          this.sfxSourceNode.buffer = cached.buffer;

          const sfxIndividualGain = this.audioCore.context.createGain();
          sfxIndividualGain.gain.value = clampedVolume;
          this.sfxSourceNode.connect(sfxIndividualGain);
          sfxIndividualGain.connect(this.audioCore.sfxGain);

          this.sfxSourceNode.onended = () => {
            if (this.sfxResolve) {
              this.sfxResolve(true);
              this.sfxResolve = null;
            }
          };
          this.sfxSourceNode.start(0);
        }
      } else {
        resolve(false);
      }
    });
  }

  async stopSfx() {
    if (this.sfxSourceNode) {
      this.sfxSourceNode.onended = null;
      this.sfxSourceNode.stop();
      this.sfxSourceNode = null;
    }

    if (this.sfxSequencer) {
      try {
        this.sfxSequencer.pause();
      } catch (e) {}
      this.sfxSequencer = null;

      if (this.sfxMidiOriginalVolume !== null && this.state.playback.midiGain) {
        this.state.playback.midiGain.gain.setTargetAtTime(
          this.sfxMidiOriginalVolume,
          this.audioCore.context.currentTime,
          0.01,
        );
        this.sfxMidiOriginalVolume = null;
      }
    }

    if (
      this.currentSfxMidi &&
      typeof this.currentSfxMidi.flush === "function"
    ) {
      this.synthesizer.unlockAllChannels();
      this.synthesizer.reset();
      try {
        this.currentSfxMidi.flush();
      } catch (e) {}
      this.currentSfxMidi = null;
    }

    if (this.sfxResolve) {
      this.sfxResolve(false);
      this.sfxResolve = null;
    }
  }

  cleanup() {
    this.stopSfx();
    this.sfxCache.clear();
  }
}
