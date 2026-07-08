import { logVerbose } from "./State.js";

export class ForteAudioCore {
  constructor(state, config) {
    this.state = state;
    this.config = config;
    this.context = null;
    this.masterGain = null;
    this.masterCompressor = null;
    this.sfxGain = null;
  }

  async initialize() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 44100,
      });

      // Setup Master Out
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();

      this.masterCompressor = this.context.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(
        -24,
        this.context.currentTime,
      );
      this.masterCompressor.knee.setValueAtTime(40, this.context.currentTime);
      this.masterCompressor.ratio.setValueAtTime(4, this.context.currentTime);
      this.masterCompressor.attack.setValueAtTime(
        0.01,
        this.context.currentTime,
      );
      this.masterCompressor.release.setValueAtTime(
        0.25,
        this.context.currentTime,
      );

      this.masterGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.context.destination);

      this.sfxGain.connect(this.context.destination);
      this.sfxGain.gain.value = this.state.playback.volume;

      this.state.playback.midiGain = this.context.createGain();
      this.state.playback.midiGain.connect(this.masterGain);

      logVerbose("Studio Audio pipelines initialized.");
      this.state.playback.currentDeviceId = this.context.sinkId || "default";
      await this.getPlaybackDevices();
    } catch (e) {
      console.error("[FORTE STUDIO] FATAL: Web Audio API is not supported.", e);
    }
  }

  async getPlaybackDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = allDevices
        .filter((device) => device.kind === "audiooutput")
        .map((device) => ({
          deviceId: device.deviceId,
          label:
            device.label || `Output Device ${device.deviceId.substring(0, 8)}`,
        }));
      this.state.playback.devices = audioOutputs;
      return audioOutputs;
    } catch (e) {
      return [];
    }
  }

  async setPlaybackDevice(deviceId, dispatchCallback) {
    if (!this.context || typeof this.context.setSinkId !== "function")
      return false;
    try {
      await this.context.setSinkId(deviceId);
      this.state.playback.currentDeviceId = deviceId;
      if (typeof dispatchCallback === "function") dispatchCallback();
      return true;
    } catch (e) {
      return false;
    }
  }

  updateSfxGain() {
    if (!this.sfxGain || !this.context) return;
    const effectiveGain =
      this.state.playback.volume * this.state.playback.sfxVolume;
    this.sfxGain.gain.setValueAtTime(effectiveGain, this.context.currentTime);
  }

  setTrackVolume(level) {
    if (!this.masterGain) return;
    const clampedLevel = Math.max(0, Math.min(1, level));
    this.masterGain.gain.setValueAtTime(clampedLevel, this.context.currentTime);
    this.state.playback.volume = clampedLevel;
    this.updateSfxGain();
  }

  setSfxVolume(level) {
    const clampedLevel = Math.max(0, Math.min(1, level));
    this.state.playback.sfxVolume = clampedLevel;
    this.updateSfxGain();
  }

  cleanup() {
    if (this.context && this.context.state !== "closed") {
      if (this.masterCompressor) this.masterCompressor.disconnect();
      if (this.masterGain) this.masterGain.disconnect();
      if (this.sfxGain) this.sfxGain.disconnect();
      this.context.close();
    }
  }
}
