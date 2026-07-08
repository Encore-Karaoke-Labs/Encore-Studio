export const state = {
  playback: {
    status: "stopped",
    buffer: null,
    synthesizer: null,
    midiGain: null,
    sequencer: null,
    currentMidi: null,
    isMidi: false,
    isMultiplexed: false,
    decodedLyrics: [],
    lyricsEncoding: "utf-8",
    startTime: 0,
    pauseTime: 0,
    devices: [],
    currentDeviceId: "default",
    transpose: 0,
    multiplexPan: -1,
    leftPannerGain: null,
    rightPannerGain: null,
    volume: 1,
    sfxVolume: 1,
    smoothedTime: 0,
    lastFrameTime: 0,
  },
  verbose: true,
};

export function logVerbose(message, ...args) {
  if (!state.verbose) return;
  console.debug(`[FORTE STUDIO] ${message}`, ...args);
}

export function logVerboseWarn(message, ...args) {
  if (!state.verbose) return;
  console.warn(`[FORTE STUDIO] ${message}`, ...args);
}
