import { state, logVerbose } from "./core/State.js";
import { ForteAudioCore } from "./core/AudioCore.js";
import { ForteSynthesizer } from "./modules/Synthesizer.js";
import { FortePlayback } from "./modules/Playback.js";
import { ForteSFX } from "./modules/SFX.js";

let root;

let audioCore;
let synthesizer;
let playback;
let sfx;

function dispatchPlaybackUpdate() {
  document.dispatchEvent(
    new CustomEvent("CherryTree.Forte.Playback.Update", {
      detail: pkg.data.getPlaybackState(),
    }),
  );
  logVerbose("Dispatching playback update", pkg.data.getPlaybackState());
}

const pkg = {
  name: "Forte Sound Engine Service (Studio Edition)",
  svcName: "ForteSvc",
  type: "svc",
  privs: 0,

  start: async function (Root) {
    logVerbose("Starting Forte Sound Engine Service for Encore Studio.");
    root = Root;

    const config =
      window.config && typeof window.config.getAll === "function"
        ? await window.config.getAll()
        : { audioConfig: {} };

    audioCore = new ForteAudioCore(state, config);
    await audioCore.initialize();

    synthesizer = new ForteSynthesizer(
      state,
      audioCore,
      dispatchPlaybackUpdate,
    );
    await synthesizer.initialize();

    playback = new FortePlayback(
      state,
      audioCore,
      synthesizer,
      dispatchPlaybackUpdate,
    );
    sfx = new ForteSFX(state, audioCore, synthesizer);
  },

  data: {
    loadSfx: (url) => sfx.loadSfx(url),
    playSfx: (url, volume) => sfx.playSfx(url, volume),
    stopSfx: () => sfx.stopSfx(),

    getPlaybackDevices: () => audioCore.getPlaybackDevices(),
    setPlaybackDevice: (deviceId) =>
      audioCore.setPlaybackDevice(deviceId, dispatchPlaybackUpdate),

    loadSoundFont: (url) => synthesizer.loadSoundFont(url, playback),
    loadTrack: (url) => playback.loadTrack(url),
    loadMidiDataUri: (dataUri) => playback.loadMidiDataUri(dataUri),

    playTrack: () => playback.playTrack(),
    pauseTrack: () => playback.pauseTrack(),
    stopTrack: () => playback.stopTrack(),
    seekTrack: (timeInSeconds) => playback.seekTrack(timeInSeconds),

    setTrackVolume: (level) => audioCore.setTrackVolume(level),
    setSfxVolume: (level) => audioCore.setSfxVolume(level),

    setVerbose: (enabled) => {
      state.verbose = Boolean(enabled);
      if (state.verbose) logVerbose("Verbose logging enabled");
    },

    setMultiplexPan: (panValue) => playback.setMultiplexPan(panValue),
    setTranspose: (semitones) => playback.setTranspose(semitones),

    setChannelVolume: (channelNumber, volume) =>
      synthesizer.setChannelVolume(channelNumber, volume),
    setChannelExpression: (channelNumber, expression) =>
      synthesizer.setChannelExpression(channelNumber, expression),
    switchDrumPreset: (channelNumber, drumPreset) =>
      synthesizer.switchDrumPreset(channelNumber, drumPreset),
    getAvailableDrumPresets: () => synthesizer.getAvailableDrumPresets(),
    getCurrentDrumPreset: (channelNumber) =>
      synthesizer.getCurrentDrumPreset(channelNumber),

    getPlaybackState: () => playback.getPlaybackState(),
  },

  end: async function () {
    logVerbose("Shutting down.");
    if (audioCore) audioCore.cleanup();
    if (sfx) sfx.cleanup();
    if (playback) playback.cleanup();
    if (synthesizer) synthesizer.cleanup();
  },
};

export default pkg;
