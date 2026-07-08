import Html from "/libs/html.js";
import StateManager from "./managers/StateManager.js";
import PlaybackManager from "./managers/PlaybackManager.js";
import UIManager from "./managers/UIManager.js";
import InputManager from "./managers/InputManager.js";
import ProjectManager from "./managers/ProjectManager.js";

const pkg = {
  name: "Encore Studio",
  type: "app",
  privs: 1,

  start: async function (Root) {
    const ForteEngine = Root.Processes.getService("ForteSvc").data;

    this.stateManager = new StateManager();
    this.playbackManager = new PlaybackManager(this.stateManager, ForteEngine);
    this.uiManager = new UIManager(this.stateManager, this.playbackManager);
    this.projectManager = new ProjectManager(
      this.stateManager,
      this.uiManager,
      this.playbackManager,
    );
    this.inputManager = new InputManager(
      this.stateManager,
      this.uiManager,
      this.playbackManager,
      this.projectManager,
    );

    this.wrapper = new Html("div")
      .classOn("full-ui", "st-wrap")
      .appendTo("body");

    this.stateManager.onHistoryChange = (requiresFullRender) => {
      this.uiManager.updateHistoryButtons();
      if (requiresFullRender) {
        this.uiManager.fullRender();
      }
    };

    this.uiManager.injectStyles();
    this.uiManager.buildLayout(this.wrapper, this.projectManager);
    this.inputManager.registerGlobalEvents();
    this.playbackManager.registerForteEvents(this.uiManager);

    this.stateManager.pushHistory();
    this.uiManager.fullRender();
  },

  end: async function () {
    this.inputManager.cleanup();
    this.playbackManager.cleanup();
    if (this.wrapper) this.wrapper.cleanup();
  },
};

export default pkg;
