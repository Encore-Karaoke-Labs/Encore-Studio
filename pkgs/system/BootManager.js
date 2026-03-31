import Html from "/libs/html.js";

let wrapper;

const pkg = {
  name: "Boot Manager",
  type: "app",
  privs: 1,
  start: async function (Root) {
    console.log("[BootManager] Started", Root);
    const loadingScreen = document.querySelector("#loading");
    if (loadingScreen) loadingScreen.remove();

    document.body.style.backgroundColor = "white";

    let columns = Math.floor(document.body.clientWidth / 50);
    let rows = Math.floor(document.body.clientHeight / 50);

    wrapper = new Html("div")
      .class("flex")
      .styleJs({
        width: "100%",
        height: "100%",
        position: "absolute",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        top: 0,
        left: 0,
        opacity: 1,
      })
      .appendTo("body");

    let tiles = new Html("div").classOn("tiles").appendTo(wrapper);
    const createTile = (index) => new Html("div").classOn("tile");
    const createTiles = (quantity) => {
      Array.from(Array(quantity)).map((tile, index) => {
        createTile(index).appendTo(tiles);
      });
    };

    tiles.elm.style.setProperty("--columns", columns);
    tiles.elm.style.setProperty("--rows", rows);
    createTiles(columns * rows);

    const terebiText = "ENCORE";
    const terebiH1 = new Html("h1")
      .styleJs({
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "15rem",
        lineHeight: "18rem",
        fontWeight: "bold",
        textAlign: "center",
        margin: 0,
        padding: 0,
        color: "white",
        display: "flex",
        opacity: 0,
        filter: "grayscale(1)",
      })
      .html(
        terebiText
          .split("")
          .map(
            (char) =>
              `<div class="char-mask" style="display: inline-block; overflow: hidden;">
                 <span class="terebi-char" style="display: inline-block;">${char}</span>
               </div>`,
          )
          .join(""),
      )
      .appendTo(wrapper);

    beginAnimation();

    function beginAnimation() {
      document.body.style.transition = "background-color 0.5s ease-in-out";
      const tl = anime.timeline({
        easing: "easeInOutExpo",
        complete: () => {
          document.body.style.backgroundColor = "white";
          showClickPrompt();
        },
      });

      tl.add({
        targets: ".terebi-char",
        translateY: ["100%", 0],
        opacity: [0, 1],
        delay: anime.stagger(80),
      });

      tl.add({
        targets: terebiH1.elm,
        scale: [1, 0.75],
        opacity: [1, 0],
        duration: 400,
      });

      tl.add({
        targets: ".tile",
        opacity: [1, 0],
        delay: anime.stagger(35, {
          grid: [columns, rows],
          from: "center",
          ease: "outExpo",
          duration: 100,
        }),
        duration: 100,
        ease: "outExpo",
      });
    }

    function showClickPrompt() {
      const clickPrompt = new Html("div")
        .styleJs({
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(255,255,255,0.9)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          zIndex: 9999,
        })
        .appendTo("body");

      const textDiv = new Html("div")
        .styleJs({
          fontSize: "2rem",
          color: "black",
          fontFamily: "Rajdhani, sans-serif",
          textAlign: "center",
        })
        .html("Click anywhere to start audio")
        .appendTo(clickPrompt);

      clickPrompt.elm.addEventListener("click", async () => {
        clickPrompt.cleanup();
        wrapper.cleanup();
        await Root.Core.pkg.run("services:Forte", [], true);
        checkServicesLoaded();
      });
    }

    // await Root.Core.pkg.run("services:Forte", [], true); // Moved to after click

    async function checkServicesLoaded() {
      let curInterval = setInterval(() => {
        try {
          Root.Processes.getService("ForteSvc").data;
          clearInterval(curInterval);
          doEverythingElse();
        } catch (e) {}
      }, 50);
    }

    async function doEverythingElse() {
      await Root.Core.pkg.run("system:EncoreStudio", [], true);
    }
  },
  end: async function () {
    document.body.style.backgroundColor = "";
    if (wrapper) {
      wrapper.cleanup();
    }
  },
};

export default pkg;
