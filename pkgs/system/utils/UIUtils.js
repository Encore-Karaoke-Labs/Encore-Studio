import Html from "/libs/html.js";

export function showDropdown(e, items, isContext = false) {
  e.stopPropagation();
  if (e.preventDefault) e.preventDefault();

  document
    .querySelectorAll(".st-floating-dropdown")
    .forEach((el) => el.remove());

  const menu = new Html("div").classOn("st-floating-dropdown").appendTo("body");
  menu.style({ top: "-9999px", left: "-9999px" });

  items.forEach((item) => {
    const div = new Html("div")
      .classOn("st-floating-dropdown-item")
      .text(item.label)
      .appendTo(menu);

    if (item.color) div.style({ color: item.color });

    div.on("mousedown", (ev) => {
      ev.stopPropagation();
      item.action();
      menu.cleanup();
    });
  });

  setTimeout(() => {
    if (!menu.elm) return;
    const rect = menu.elm.getBoundingClientRect();
    let top, left;

    if (isContext) {
      top = e.clientY;
      left = e.clientX;
    } else {
      const tRect = e.target.getBoundingClientRect();
      top = tRect.bottom + 5;
      left = tRect.left;
    }

    if (top + rect.height > window.innerHeight)
      top = window.innerHeight - rect.height - 10;
    if (left + rect.width > window.innerWidth)
      left = window.innerWidth - rect.width - 10;

    menu.style({
      top: `${Math.max(10, top)}px`,
      left: `${Math.max(10, left)}px`,
    });
  }, 0);

  const closer = () => {
    if (menu.elm) menu.cleanup();
    window.removeEventListener("mousedown", closer);
  };
  setTimeout(() => window.addEventListener("mousedown", closer), 10);
}

export function triggerRename(spanEl, obj, key, onUpdate, pushHistory) {
  setTimeout(() => {
    spanEl.attr({ contenteditable: "true" });
    spanEl.elm.focus();

    const range = document.createRange();
    range.selectNodeContents(spanEl.elm);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      spanEl.attr({ contenteditable: null });
      const newVal = spanEl.getText();
      if (obj[key] !== newVal) {
        obj[key] = newVal;
        if (onUpdate) onUpdate();
        if (pushHistory) pushHistory();
      }
      spanEl.un("blur", finish);
    };

    spanEl.on("blur", finish);
    spanEl.on("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        spanEl.elm.blur();
      }
    });
  }, 10);
}

export function triggerColorPicker(initialColor, onChange) {
  const input = document.createElement("input");
  input.type = "color";
  input.value = initialColor;
  input.style.position = "absolute";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
  document.body.appendChild(input);

  input.addEventListener("input", (e) => onChange(e.target.value));
  input.addEventListener("change", () => input.remove());
  input.click();
}

export function makeListDraggableScoped(
  itemEl,
  array,
  itemObj,
  stateData,
  onReorder,
  pushHistory,
) {
  itemEl.attr({ draggable: "true" });
  itemEl.on("dragstart", (e) => {
    if (
      e.target.closest(".st-btn") ||
      e.target.closest(".st-btn-delete") ||
      e.target.closest("input") ||
      e.target.getAttribute("contenteditable") === "true"
    ) {
      e.preventDefault();
      return;
    }
    stateData.draggedItem = itemObj;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemObj.id.toString());
    itemEl.classOn("dragging");
  });

  itemEl.on("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    itemEl.classOn("drag-over");
  });

  itemEl.on("dragleave", () => itemEl.classOff("drag-over"));

  itemEl.on("drop", (e) => {
    e.preventDefault();
    itemEl.classOff("drag-over");
    itemEl.classOff("dragging");

    if (stateData.draggedItem && stateData.draggedItem !== itemObj) {
      const fromIdx = array.indexOf(stateData.draggedItem);
      const toIdx = array.indexOf(itemObj);
      if (fromIdx > -1 && toIdx > -1) {
        array.splice(fromIdx, 1);
        array.splice(toIdx, 0, stateData.draggedItem);
        onReorder();
        if (pushHistory) pushHistory();
      }
    }
    stateData.draggedItem = null;
  });

  itemEl.on("dragend", () => {
    itemEl.classOff("dragging");
    itemEl.classOff("drag-over");
    stateData.draggedItem = null;
  });
}
