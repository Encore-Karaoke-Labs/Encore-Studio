// Forte Player Sound Engine for Encore Studio

import {
  Synthetizer,
  Sequencer,
} from "https://cdn.jsdelivr.net/npm/spessasynth_lib@3.27.8/+esm";

function dispatchPlaybackUpdate() {
  document.dispatchEvent(
    new CustomEvent("CherryTree.Forte.Playback.Update", {
      detail: pkg.data.getPlaybackState(),
    }),
  );
}

function detectEncoding(uint8Array) {
  const encodings = [
    "utf-8",
    "shift-jis",
    "euc-kr",
    "windows-1250",
    "windows-1252",
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

let root;
let audioContext;
let masterGain;
let masterCompressor;
let sourceNode = null;
let animationFrameId = null;
let sfxGain;
const sfxCache = new Map();

const state = {
  playback: {
    status: "stopped",
    buffer: null,
    synthesizer: null,
    midiGain: null,
    sequencer: null,
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
    smoothedTime: 0,
    lastFrameTime: 0,
  },
};

function timingLoop() {
  if (state.playback.status !== "playing") {
    animationFrameId = null;
    return;
  }

  const now = performance.now();
  let delta = (now - state.playback.lastFrameTime) / 1000;
  if (delta > 0.1) delta = 0.1;
  state.playback.lastFrameTime = now;

  const engineState = pkg.data.getPlaybackState();
  const engineTime = engineState.currentTime;
  const duration = engineState.duration;

  let rate = 1.0;
  if (!state.playback.isMidi && sourceNode) {
    rate = sourceNode.playbackRate.value;
  }

  state.playback.smoothedTime += delta * rate;

  const drift = engineTime - state.playback.smoothedTime;
  if (Math.abs(drift) > 0.5) {
    state.playback.smoothedTime = engineTime;
  } else {
    state.playback.smoothedTime += drift * 0.15;
  }

  const currentTime = Math.max(
    0,
    Math.min(state.playback.smoothedTime, duration),
  );

  document.dispatchEvent(
    new CustomEvent("CherryTree.Forte.Playback.TimeUpdate", {
      detail: { currentTime, duration },
    }),
  );

  if (engineTime >= duration && duration > 0) {
    animationFrameId = null;
    return;
  }
  animationFrameId = requestAnimationFrame(timingLoop);
}

const pkg = {
  name: "Forte Player Sound Engine",
  svcName: "ForteSvc",
  type: "svc",
  privs: 0,
  start: async function (Root) {
    if (audioContext) {
      console.warn("[FORTE SVC] Engine is already initialized.");
      return;
    }

    console.log("Starting Forte Player Sound Engine for Encore Studio.");
    root = Root;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive",
        sampleRate: 44100,
      });

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      masterGain = audioContext.createGain();
      sfxGain = audioContext.createGain();

      masterCompressor = audioContext.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-24, audioContext.currentTime);
      masterCompressor.knee.setValueAtTime(40, audioContext.currentTime);
      masterCompressor.ratio.setValueAtTime(4, audioContext.currentTime);
      masterCompressor.attack.setValueAtTime(0.01, audioContext.currentTime);
      masterCompressor.release.setValueAtTime(0.25, audioContext.currentTime);

      masterGain.connect(masterCompressor);
      masterCompressor.connect(audioContext.destination);

      sfxGain.connect(audioContext.destination);
      sfxGain.gain.value = state.playback.volume;

      state.playback.midiGain = audioContext.createGain();
      state.playback.midiGain.connect(masterGain);

      console.log("[FORTE SVC] Audio playback pipeline initialized.");

      state.playback.currentDeviceId = audioContext.sinkId || "default";
      pkg.data.getPlaybackDevices();

      try {
        await audioContext.audioWorklet.addModule(
          "/libs/spessasynth_lib/synthetizer/worklet_processor.min.js",
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        const soundFontUrl = "/libs/soundfonts/SAM2695.sf2";
        const soundFontBuffer = await (await fetch(soundFontUrl)).arrayBuffer();

        state.playback.synthesizer = new Synthetizer(
          state.playback.midiGain,
          soundFontBuffer,
        );
        console.log("[FORTE SVC] MIDI Synthesizer initialized successfully.");
      } catch (synthError) {
        console.error(
          "[FORTE SVC] FATAL: Could not initialize MIDI Synthesizer.",
          synthError,
        );
        state.playback.synthesizer = null;
      }
    } catch (e) {
      console.error("[FORTE SVC] FATAL: Web Audio API is not supported.", e);
    }
  },

  data: {
    loadSfx: async (url) => {
      if (!audioContext) return false;
      if (sfxCache.has(url)) return true;
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        sfxCache.set(url, audioBuffer);
        return true;
      } catch (e) {
        console.error(`[FORTE SVC] Failed to load SFX: ${url}`, e);
        return false;
      }
    },

    playSfx: async (url) => {
      if (!audioContext) return;
      if (audioContext.state === "suspended") await audioContext.resume();

      let audioBuffer = sfxCache.get(url);
      if (!audioBuffer) {
        const success = await pkg.data.loadSfx(url);
        if (!success) return;
        audioBuffer = sfxCache.get(url);
      }

      if (audioBuffer) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(sfxGain);
        source.start(0);
      }
    },

    getPlaybackDevices: async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = allDevices
          .filter((device) => device.kind === "audiooutput")
          .map((device) => ({
            deviceId: device.deviceId,
            label:
              device.label ||
              `Output Device ${device.deviceId.substring(0, 8)}`,
          }));
        state.playback.devices = audioOutputs;
        return audioOutputs;
      } catch (e) {
        return [];
      }
    },

    setPlaybackDevice: async (deviceId) => {
      if (!audioContext || typeof audioContext.setSinkId !== "function")
        return false;
      try {
        await audioContext.setSinkId(deviceId);
        state.playback.currentDeviceId = deviceId;
        dispatchPlaybackUpdate();
        return true;
      } catch (e) {
        return false;
      }
    },

    loadSoundFont: async (url) => {
      if (!audioContext) return false;

      if (state.playback.status !== "stopped") {
        pkg.data.stopTrack();
      }

      console.log(`[FORTE SVC] Swapping SoundFont with: ${url}`);

      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        if (state.playback.synthesizer) {
          state.playback.synthesizer = null;
        }

        state.playback.synthesizer = new Synthetizer(
          state.playback.midiGain,
          arrayBuffer,
        );

        if (state.playback.transpose !== 0) {
          state.playback.synthesizer.transpose(state.playback.transpose);
        }

        console.log(
          "[FORTE SVC] New SoundFont loaded and Synthesizer recreated.",
        );
        return true;
      } catch (e) {
        console.error(`[FORTE SVC] Failed to load custom SoundFont: ${url}`, e);
        return false;
      }
    },

    loadTrack: async (url) => {
      if (!audioContext) return false;
      if (state.playback.status !== "stopped") pkg.data.stopTrack();

      if (state.playback.sequencer) {
        state.playback.sequencer.stop();
        state.playback.sequencer = null;
      }
      state.playback.decodedLyrics = [];
      state.playback.lyricsEncoding = "utf-8";
      state.playback.transpose = 0;
      state.playback.isMultiplexed = false;
      state.playback.multiplexPan = -1;

      const isMidi =
        url.toLowerCase().endsWith(".mid") ||
        url.toLowerCase().endsWith(".midi") ||
        url.toLowerCase().endsWith(".kar");
      state.playback.isMidi = isMidi;

      if (!isMidi && url.toLowerCase().includes(".multiplexed.")) {
        state.playback.isMultiplexed = true;
      }

      if (toastElement) {
        toastElement.text(isMidi ? "Classic Karaoke" : "Real Sound");
      }

      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        if (isMidi) {
          if (!state.playback.synthesizer)
            throw new Error("MIDI Synthesizer not ready.");
          state.playback.sequencer = new Sequencer(
            [{ binary: arrayBuffer }],
            state.playback.synthesizer,
          );
          state.playback.sequencer.stop();
          state.playback.sequencer.loop = false;

          state.playback.sequencer.addOnSongEndedEvent(() => {
            if (state.playback.status !== "stopped") pkg.data.stopTrack();
          }, "forte-song-end");

          await new Promise((resolve) => {
            state.playback.sequencer.addOnSongChangeEvent(() => {
              const rawLyrics = state.playback.sequencer.midiData.lyrics;
              if (rawLyrics && rawLyrics.length > 0) {
                const totalLength = rawLyrics.reduce(
                  (acc, val) => acc + val.byteLength,
                  0,
                );
                const combinedBuffer = new Uint8Array(totalLength);
                let offset = 0;
                for (const buffer of rawLyrics) {
                  combinedBuffer.set(new Uint8Array(buffer), offset);
                  offset += buffer.byteLength;
                }

                state.playback.lyricsEncoding = detectEncoding(combinedBuffer);
                console.log(
                  `[FORTE SVC] Detected MIDI lyric encoding: ${state.playback.lyricsEncoding}`,
                );

                const decoder = new TextDecoder(state.playback.lyricsEncoding);

                state.playback.decodedLyrics = rawLyrics
                  .map((lyricBuffer) => decoder.decode(lyricBuffer))
                  .filter((text) => {
                    const clean = text.replace(/[\r\n\/\\]/g, "");
                    return !clean.startsWith("@");
                  });
              } else {
                state.playback.lyricsEncoding = "utf-8";
              }
              resolve();
            }, "forte-loader");
          });

          let displayableLyricIndex = 0;
          state.playback.sequencer.onTextEvent = (messageData, messageType) => {
            if (messageType === 5) {
              const text = new TextDecoder(
                state.playback.lyricsEncoding,
              ).decode(messageData.buffer);
              const cleanText = text.replace(/[\r\n\/\\]/g, "");
              if (cleanText && !cleanText.startsWith("@")) {
                document.dispatchEvent(
                  new CustomEvent("CherryTree.Forte.Playback.LyricEvent", {
                    detail: {
                      index: displayableLyricIndex,
                      text: cleanText,
                    },
                  }),
                );
                displayableLyricIndex++;
              }
            }
          };
          state.playback.buffer = null;
        } else {
          state.playback.buffer =
            await audioContext.decodeAudioData(arrayBuffer);
        }

        state.playback.status = "stopped";
        state.playback.pauseTime = 0;
        console.log(`[FORTE SVC] Track loaded: ${url}`);
        dispatchPlaybackUpdate();
        return true;
      } catch (e) {
        console.error(`[FORTE SVC] Failed to load track: ${url}`, e);
        return false;
      }
    },

    loadMidiDataUri: async (dataUri) => {
      if (!audioContext) return false;

      if (state.playback.status !== "stopped") pkg.data.stopTrack();

      if (state.playback.sequencer) {
        state.playback.sequencer.stop();
        state.playback.sequencer = null;
      }

      state.playback.decodedLyrics = [];
      state.playback.lyricsEncoding = "utf-8";
      state.playback.transpose = 0;
      state.playback.isMultiplexed = false;
      state.playback.multiplexPan = -1;
      state.playback.isMidi = true;

      try {
        const base64String = dataUri.split(",")[1];
        if (!base64String) throw new Error("Invalid Data URI provided.");

        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        if (!state.playback.synthesizer) {
          throw new Error("MIDI Synthesizer not ready.");
        }

        state.playback.sequencer = new Sequencer(
          [{ binary: arrayBuffer }],
          state.playback.synthesizer,
        );
        state.playback.sequencer.stop();
        state.playback.sequencer.loop = false;

        state.playback.sequencer.addOnSongEndedEvent(() => {
          if (state.playback.status !== "stopped") pkg.data.stopTrack();
        }, "forte-song-end");

        await new Promise((resolve) => {
          state.playback.sequencer.addOnSongChangeEvent(() => {
            const rawLyrics = state.playback.sequencer.midiData.lyrics;
            if (rawLyrics && rawLyrics.length > 0) {
              const totalLength = rawLyrics.reduce(
                (acc, val) => acc + val.byteLength,
                0,
              );
              const combinedBuffer = new Uint8Array(totalLength);
              let offset = 0;
              for (const buffer of rawLyrics) {
                combinedBuffer.set(new Uint8Array(buffer), offset);
                offset += buffer.byteLength;
              }

              state.playback.lyricsEncoding = detectEncoding(combinedBuffer);
              const decoder = new TextDecoder(state.playback.lyricsEncoding);

              state.playback.decodedLyrics = rawLyrics
                .map((lyricBuffer) => decoder.decode(lyricBuffer))
                .filter((text) => {
                  const clean = text.replace(/[\r\n\/\\]/g, "");
                  return !clean.startsWith("@");
                });
            } else {
              state.playback.lyricsEncoding = "utf-8";
            }
            resolve();
          }, "forte-loader");
        });

        let displayableLyricIndex = 0;
        state.playback.sequencer.onTextEvent = (messageData, messageType) => {
          if (messageType === 5) {
            const text = new TextDecoder(state.playback.lyricsEncoding).decode(
              messageData.buffer,
            );
            const cleanText = text.replace(/[\r\n\/\\]/g, "");
            if (cleanText && !cleanText.startsWith("@")) {
              document.dispatchEvent(
                new CustomEvent("CherryTree.Forte.Playback.LyricEvent", {
                  detail: {
                    index: displayableLyricIndex,
                    text: cleanText,
                  },
                }),
              );
              displayableLyricIndex++;
            }
          }
        };

        state.playback.buffer = null;
        state.playback.status = "stopped";
        state.playback.pauseTime = 0;

        console.log(
          `[FORTE SVC] Loaded Editor MIDI from Data URI successfully.`,
        );
        dispatchPlaybackUpdate();
        return true;
      } catch (e) {
        console.error(`[FORTE SVC] Failed to load MIDI from Data URI`, e);
        return false;
      }
    },

    playTrack: () => {
      if (audioContext.state === "suspended") audioContext.resume();

      if (state.playback.isMidi) {
        if (!state.playback.sequencer || state.playback.status === "playing")
          return;

        if (
          state.playback.status === "stopped" ||
          state.playback.sequencer.currentTime >=
            state.playback.sequencer.duration
        ) {
          state.playback.sequencer.currentTime = 0;
          state.playback.smoothedTime = 0;
        }

        state.playback.sequencer.play();
        state.playback.status = "playing";
      } else {
        if (!state.playback.buffer || state.playback.status === "playing")
          return;

        if (
          state.playback.status === "stopped" ||
          state.playback.pauseTime >= state.playback.buffer.duration
        ) {
          state.playback.pauseTime = 0;
          state.playback.smoothedTime = 0;
        }

        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = state.playback.buffer;
        sourceNode.playbackRate.value = Math.pow(
          2,
          state.playback.transpose / 12,
        );

        if (state.playback.isMultiplexed) {
          const splitter = audioContext.createChannelSplitter(2);
          const leftGain = audioContext.createGain();
          const rightGain = audioContext.createGain();
          const monoMixer = audioContext.createGain();

          state.playback.leftPannerGain = leftGain;
          state.playback.rightPannerGain = rightGain;

          sourceNode.connect(splitter);
          splitter.connect(leftGain, 0);
          splitter.connect(rightGain, 1);
          leftGain.connect(monoMixer);
          rightGain.connect(monoMixer);
          monoMixer.connect(masterGain);

          pkg.data.setMultiplexPan(state.playback.multiplexPan);
        } else {
          sourceNode.connect(masterGain);
        }

        sourceNode.onended = () => {
          if (state.playback.status === "playing") pkg.data.stopTrack();
        };
        sourceNode.start(0, state.playback.pauseTime);
        state.playback.startTime = audioContext.currentTime;
        state.playback.status = "playing";
      }

      dispatchPlaybackUpdate();

      state.playback.lastFrameTime = performance.now();
      state.playback.smoothedTime = pkg.data.getPlaybackState().currentTime;

      if (animationFrameId === null) timingLoop();
    },

    pauseTrack: () => {
      if (state.playback.status !== "playing") return;

      if (state.playback.isMidi) {
        state.playback.sequencer.pause();
        state.playback.status = "paused";
      } else {
        if (!sourceNode) return;
        const rate = sourceNode.playbackRate.value;
        const elapsed = audioContext.currentTime - state.playback.startTime;
        state.playback.pauseTime += elapsed * rate;
        sourceNode.stop();
        state.playback.leftPannerGain = null;
        state.playback.rightPannerGain = null;
        state.playback.status = "paused";
        sourceNode = null;
      }

      dispatchPlaybackUpdate();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    stopTrack: () => {
      if (state.playback.status === "stopped") return;

      if (state.playback.isMidi) {
        if (state.playback.sequencer) {
          state.playback.sequencer.stop();
        }
      } else {
        if (sourceNode) {
          sourceNode.onended = null;
          sourceNode.stop();
          sourceNode = null;
        }
      }

      state.playback.leftPannerGain = null;
      state.playback.rightPannerGain = null;
      state.playback.multiplexPan = -1;
      state.playback.status = "stopped";
      state.playback.pauseTime = 0;
      state.playback.smoothedTime = 0;

      dispatchPlaybackUpdate();

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    seekTrack: (timeInSeconds) => {
      const engineState = pkg.data.getPlaybackState();
      let newTime = Math.max(
        0,
        Math.min(timeInSeconds, engineState.duration || 0),
      );

      const wasPlaying = state.playback.status === "playing";

      if (state.playback.isMidi && state.playback.sequencer) {
        state.playback.sequencer.currentTime = newTime;
        state.playback.pauseTime = newTime;
        state.playback.smoothedTime = newTime;

        if (!wasPlaying) {
          state.playback.sequencer.pause();
          state.playback.status = "paused";
        }
      } else if (state.playback.buffer) {
        if (wasPlaying && sourceNode) {
          sourceNode.onended = null;
          sourceNode.stop();
          sourceNode = null;
        }
        state.playback.pauseTime = newTime;
        state.playback.smoothedTime = newTime;

        if (!wasPlaying) {
          state.playback.status = "paused";
        } else {
          state.playback.status = "paused";
          pkg.data.playTrack();
        }
      }

      state.playback.lastFrameTime = performance.now();
      document.dispatchEvent(
        new CustomEvent("CherryTree.Forte.Playback.TimeUpdate", {
          detail: { currentTime: newTime, duration: engineState.duration },
        }),
      );
      dispatchPlaybackUpdate();
    },

    setTrackVolume: (level) => {
      if (!masterGain) return;
      const clampedLevel = Math.max(0, Math.min(1, level));
      masterGain.gain.setValueAtTime(clampedLevel, audioContext.currentTime);
      sfxGain.gain.setValueAtTime(clampedLevel, audioContext.currentTime);
      state.playback.volume = clampedLevel;
    },

    setMultiplexPan: (panValue) => {
      const pan = Math.max(-1, Math.min(1, panValue));
      state.playback.multiplexPan = pan;
      const { leftPannerGain, rightPannerGain } = state.playback;
      if (leftPannerGain && rightPannerGain) {
        leftPannerGain.gain.setValueAtTime(
          (1 - pan) / 2,
          audioContext.currentTime,
        );
        rightPannerGain.gain.setValueAtTime(
          (1 + pan) / 2,
          audioContext.currentTime,
        );
      }
      dispatchPlaybackUpdate();
    },

    setTranspose: (semitones) => {
      const clamped = Math.max(-24, Math.min(24, Math.round(semitones)));
      if (
        !state.playback.isMidi &&
        state.playback.status === "playing" &&
        sourceNode
      ) {
        const rate = sourceNode.playbackRate.value;
        const elapsed = audioContext.currentTime - state.playback.startTime;
        state.playback.pauseTime += elapsed * rate;
        state.playback.startTime = audioContext.currentTime;
      }
      state.playback.transpose = clamped;
      if (state.playback.isMidi && state.playback.synthesizer) {
        state.playback.synthesizer.transpose(clamped);
      } else if (!state.playback.isMidi && sourceNode) {
        sourceNode.playbackRate.setValueAtTime(
          Math.pow(2, clamped / 12),
          audioContext.currentTime,
        );
      }
      dispatchPlaybackUpdate();
    },

    getPlaybackState: () => {
      let duration = 0;
      let currentTime = 0;

      if (state.playback.isMidi && state.playback.sequencer) {
        if (state.playback.sequencer.midiData) {
          duration = state.playback.sequencer.duration;
          currentTime = state.playback.sequencer.currentTime;
        }
      } else if (state.playback.buffer) {
        duration = state.playback.buffer.duration;
        if (state.playback.status === "playing" && sourceNode) {
          const rate = sourceNode.playbackRate.value;
          const elapsed = audioContext.currentTime - state.playback.startTime;
          currentTime = state.playback.pauseTime + elapsed * rate;
        } else {
          currentTime = state.playback.pauseTime;
        }
      }

      return {
        status: state.playback.status,
        currentTime: Math.min(currentTime, duration),
        duration,
        currentDeviceId: state.playback.currentDeviceId,
        isMidi: state.playback.isMidi,
        isMultiplexed: state.playback.isMultiplexed,
        decodedLyrics: state.playback.decodedLyrics,
        transpose: state.playback.transpose,
        multiplexPan: state.playback.multiplexPan,
      };
    },
  },

  end: async function () {
    console.log("[FORTE SVC] Shutting down.");

    if (audioContext && audioContext.state !== "closed") {
      if (masterCompressor) masterCompressor.disconnect();
      audioContext.close();
    }

    sfxCache.clear();

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (state.playback.synthesizer) state.playback.synthesizer.close();
  },
};

export default pkg;
