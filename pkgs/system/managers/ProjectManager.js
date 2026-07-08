export default class ProjectManager {
  constructor(stateManager, uiManager, playbackManager) {
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.playbackManager = playbackManager;
  }

  saveProject() {
    const data = this.stateManager.data;

    const saveState = {
      ...data,
      dragState: undefined,
      selectedNotes: undefined,
      selectedBlocks: undefined,
      draggedItem: undefined,
    };

    const blob = new Blob([JSON.stringify(saveState)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Project.esproj";
    a.click();
  }

  loadProject() {
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

          Object.assign(this.stateManager.data, parsed);

          this.stateManager.data.lastNoteDuration =
            this.stateManager.data.lastNoteDuration || {};
          this.stateManager.data.selectedNotes = [];
          this.stateManager.data.selectedBlocks = [];
          this.stateManager.data.dragState = {
            active: false,
            type: null,
            hasMoved: false,
          };
          this.stateManager.data.isPlaying = false;

          this.stateManager.history = [];
          this.stateManager.historyIndex = -1;

          this.uiManager.hasSnappedToC5 = false;

          if (
            this.uiManager.elements.tempoInput &&
            this.uiManager.elements.tempoInput.elm
          ) {
            this.uiManager.elements.tempoInput.val(
              this.stateManager.data.tempo,
            );
          }

          this.uiManager.updatePlayBtnText();
          this.uiManager.fullRender();

          this.stateManager.pushHistory();
        } catch (err) {
          alert("Invalid project file.");
          console.error("Error loading project:", err);
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  async exportMidi() {
    const write = this.playbackManager.generateMidiWriter();
    if (!write) return alert("Nothing to export! Add some notes first.");

    const a = document.createElement("a");
    a.href = write.dataUri();
    a.download = "EncoreTrack.mid";
    a.click();
  }
}
