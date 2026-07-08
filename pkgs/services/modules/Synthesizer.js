import { WorkletSynthesizer as Synthetizer } from "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.8/+esm";
import { MIDIControllers as midiControllers } from "https://cdn.jsdelivr.net/npm/spessasynth_core@4.3.12/+esm";
import { logVerbose, logVerboseWarn } from "../core/State.js";

export function bindSpessaEvent(handler, eventName, id, callback) {
  if (!handler || !handler.events) return;
  if (handler.events[eventName] !== undefined) {
    try {
      if (typeof handler.addEvent === "function") {
        handler.addEvent(eventName, id, callback);
        return;
      }
      if (typeof handler.events[eventName].set === "function")
        handler.events[eventName].set(id, callback);
      else handler.events[eventName][id] = callback;
    } catch (e) {
      logVerboseWarn(`Error binding event '${eventName}': ${e.message}`);
    }
  } else {
    logVerboseWarn(`Event '${eventName}' does not exist on this handler.`);
  }
}

export class ForteSynthesizer {
  constructor(state, audioCore, dispatchUpdate) {
    this.state = state;
    this.audioCore = audioCore;
    this.dispatchUpdate = dispatchUpdate;
    this.currentLoadController = null;
  }

  async initialize() {
    try {
      if (!this.audioCore.context) return;

      const workletUrl =
        "/libs/spessasynth_lib/dist/spessasynth_processor.min.js";
      await this.audioCore.context.audioWorklet.addModule(workletUrl);

      const soundFontUrl = "/libs/soundfonts/SAM2634.sf3";
      const soundFontBuffer = await (await fetch(soundFontUrl)).arrayBuffer();

      this.state.playback.synthesizer = new Synthetizer(this.audioCore.context);
      this.state.playback.synthesizer.setLogLevel(true, true, true);
      await this.state.playback.synthesizer.soundBankManager.addSoundBank(
        soundFontBuffer,
      );
      this.state.playback.synthesizer.connect(this.state.playback.midiGain);

      console.log("[FORTE STUDIO] MIDI Synthesizer initialized successfully.");
    } catch (synthError) {
      console.error(
        "[FORTE STUDIO] FATAL: Could not initialize MIDI Synthesizer.",
        synthError,
      );
      this.state.playback.synthesizer = null;
    }
  }

  async loadSoundFont(url, playback) {
    if (!this.audioCore.context) return false;
    if (this.currentLoadController) this.currentLoadController.abort();

    this.currentLoadController = new AbortController();
    const signal = this.currentLoadController.signal;

    if (this.state.playback.status !== "stopped") playback.stopTrack();

    try {
      const response = await fetch(url, { signal });
      const arrayBuffer = await response.arrayBuffer();
      if (signal.aborted) return false;

      if (this.state.playback.synthesizer) {
        const sbm = this.state.playback.synthesizer.soundBankManager;
        if (sbm) {
          if (Array.isArray(sbm.soundBankList)) {
            const bankIds = sbm.soundBankList.map((b) => b.id);
            for (const bankId of bankIds) {
              if (typeof sbm.deleteSoundBank === "function")
                sbm.deleteSoundBank(bankId);
            }
          } else if (typeof sbm.destroy === "function") {
            sbm.destroy();
          }
          await sbm.addSoundBank(arrayBuffer);

          if (this.state.playback.transpose !== 0) {
            this.state.playback.synthesizer.setSystemParameter(
              "keyShift",
              this.state.playback.transpose,
            );
          }
          this.currentLoadController = null;
          return true;
        }
      }

      this.state.playback.synthesizer = new Synthetizer(this.audioCore.context);
      await this.state.playback.synthesizer.soundBankManager.addSoundBank(
        arrayBuffer,
      );
      this.state.playback.synthesizer.connect(this.state.playback.midiGain);

      if (this.state.playback.transpose !== 0) {
        this.state.playback.synthesizer.setSystemParameter(
          "keyShift",
          this.state.playback.transpose,
        );
      }
      this.currentLoadController = null;
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
      console.error(
        `[FORTE STUDIO] Failed to load custom SoundBank: ${url}`,
        e,
      );
      return false;
    }
  }

  setChannelVolume(channelNumber, volume) {
    if (!this.state.playback.synthesizer) return false;
    try {
      let midiChannel =
        this.state.playback.synthesizer.midiChannels[channelNumber];
      midiChannel.setSystemParameter("presetLock", false);
      this.state.playback.synthesizer.controllerChange(
        channelNumber,
        midiControllers.mainVolume,
        Math.floor(volume),
      );
      midiChannel.setSystemParameter("presetLock", true);
    } catch (e) {
      console.error(e);
    }
  }

  setChannelExpression(channelNumber, expression) {
    if (!this.state.playback.synthesizer) return false;
    try {
      let midiChannel =
        this.state.playback.synthesizer.midiChannels[channelNumber];
      midiChannel.setSystemParameter("presetLock", false);
      this.state.playback.synthesizer.controllerChange(
        channelNumber,
        midiControllers.expression,
        Math.floor(expression),
      );
      midiChannel.setSystemParameter("presetLock", true);
    } catch (e) {
      console.error(e);
    }
  }

  switchDrumPreset(channelNumber, drumPreset) {
    if (!this.state.playback.synthesizer) return false;
    try {
      let midiChannel =
        this.state.playback.synthesizer.midiChannels[channelNumber];
      midiChannel.setSystemParameter("presetLock", false);
      if (!drumPreset.isGMGSDrum) {
        this.state.playback.synthesizer.controllerChange(
          channelNumber,
          midiControllers.bankSelect,
          drumPreset.bankMSB,
        );
        this.state.playback.synthesizer.controllerChange(
          channelNumber,
          midiControllers.bankSelectLSB,
          drumPreset.bankLSB,
        );
      }
      this.state.playback.synthesizer.programChange(
        channelNumber,
        drumPreset.program,
      );
      midiChannel.setSystemParameter("presetLock", true);
      this.dispatchUpdate();
      return true;
    } catch (e) {
      return false;
    }
  }

  getAvailableDrumPresets() {
    if (!this.state.playback.synthesizer) return [];
    try {
      return (this.state.playback.synthesizer.presetList || []).filter(
        (p) => p.isAnyDrums || p.isGMGSDrum,
      );
    } catch (e) {
      return [];
    }
  }

  getCurrentDrumPreset(channelNumber) {
    if (!this.state.playback.synthesizer) return null;
    try {
      const channel =
        this.state.playback.synthesizer.channelProperties[channelNumber];
      if (!channel) return null;
      return {
        program: channel.program || 0,
        bankMSB: channel.bankMSB || 0,
        bankLSB: channel.bankLSB || 0,
        name: channel.presetName || "Unknown",
        isGMGSDrum:
          channel.isGMGSDrum ??
          (channel.isDrum === true && channel.bankMSB !== undefined
            ? channel.bankMSB === 0
            : false),
      };
    } catch (e) {
      return null;
    }
  }

  unlockAllChannels() {
    if (
      !this.state.playback.synthesizer ||
      !this.state.playback.synthesizer.midiChannels
    )
      return;
    try {
      for (let i = 0; i < 16; i++) {
        let midiChannel = this.state.playback.synthesizer.midiChannels[i];
        if (
          midiChannel &&
          typeof midiChannel.setSystemParameter === "function"
        ) {
          midiChannel.setSystemParameter("presetLock", false);
        }
      }
    } catch (e) {}
  }

  reset() {
    if (
      this.state.playback.synthesizer &&
      typeof this.state.playback.synthesizer.reset === "function"
    ) {
      this.state.playback.synthesizer.reset();
    }
  }

  cleanup() {
    if (this.currentLoadController) this.currentLoadController.abort();
    if (this.state.playback.synthesizer) {
      this.state.playback.synthesizer.disconnect();
      if (
        this.state.playback.synthesizer.port &&
        typeof this.state.playback.synthesizer.port.close === "function"
      ) {
        this.state.playback.synthesizer.port.close();
      }
      if (typeof this.state.playback.synthesizer.dispose === "function")
        this.state.playback.synthesizer.dispose();
      else if (typeof this.state.playback.synthesizer.destroy === "function")
        this.state.playback.synthesizer.destroy();
      this.state.playback.synthesizer = null;
    }
  }
}
