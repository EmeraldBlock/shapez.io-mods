// @ts-check

/**
 * @template {Array<any>} T
 * @typedef {{
 *     add(receiver: (...args: T) => string | void, scope?: object),
 *     addToTop(receiver: (...args: T) => string | void, scope?: object),
 *     remove(receiver: (...args: T) => string | void),
 *     dispatch(...args: T): string | void,
 *     removeAll(),
 * }} TypedSignal
 **/

/**
 * @type {{
 *     Mod: typeof import("../src/js/mods/mod").Mod,
 *     Signal: typeof import("../src/js/core/signal").Signal,
 *     Vector: typeof import("../src/js/core/vector").Vector,
 *     enumMouseButton: typeof import("../src/js/game/camera").enumMouseButton,
 *     HUDConstantSignalEdit: typeof import("../src/js/game/hud/parts/constant_signal_edit").HUDConstantSignalEdit,
 *     HUDLeverToggle: typeof import("../src/js/game/hud/parts/lever_toggle").HUDLeverToggle,
 *     HUDWaypoints: typeof import("../src/js/game/hud/parts/waypoints").HUDWaypoints,
 * }}
 */
const {
    Mod: M,
    Signal,
    Vector,
    enumMouseButton,
    HUDConstantSignalEdit,
    HUDLeverToggle,
    HUDWaypoints,
    // @ts-ignore
} = window.shapez;

const METADATA = {
    website: "https://emeraldblock.github.io/",
    author: "Emerald Block",
    name: "Drag, don't edit!",
    version: "0.1.0",
    id: "upmouse",
    description: "Dragging the map is prioritized over triggering stuff",
    minimumGameVersion: ">=1.5.0",
    doesNotAffectSavegame: true,

    extra: {
        authors: [
            {
                name: "Emerald Block",
                icon: "https://avatars.githubusercontent.com/u/69981203",
            },
        ],
        changelog: {
            "0.1.0": [
                "Initial release",
                "Support for editing signals, toggling buttons, and interacting with markers",
            ],
        },
        source: "https://github.com/EmeraldBlock/shapez.io-mods",
        readme: `<p>Tried to drag the map but accidentally clicked on something? Fear no more!</p>
<p>This mod stops that. Instead of triggering when you press your mouse, things trigger when you release your mouse without moving.</p>
<p>This affects editing signals, toggling buttons, and interacting with markers.</p>
`,
    },
};

const numberToButton = [enumMouseButton.left, enumMouseButton.middle, enumMouseButton.right];

class Mod extends M {
    init() {
        const upmouse = /** @type {TypedSignal<[import("../src/js/core/vector").Vector, import("../src/js/game/camera").enumMouseButton]>} */ (new Signal());
        this.signals.gameInitialized.add(root => {
            let dragged = false;
            root.canvas.addEventListener("mousedown", () => {
                dragged = false;
            });
            root.canvas.addEventListener("mousemove", () => {
                dragged = true;
            });
            root.canvas.addEventListener("mouseup", event => {
                if (!dragged) {
                    upmouse.dispatch(new Vector(event.clientX, event.clientY), numberToButton[event.button]);
                }
            });
        });
        this.modInterface.replaceMethod(HUDConstantSignalEdit, "initialize", function () {
            upmouse.add(this.downPreHandler, this);
        });
        this.modInterface.replaceMethod(HUDLeverToggle, "initialize", function () {
            upmouse.add(this.downPreHandler, this);
        });
        this.modInterface.replaceMethod(HUDWaypoints, "initialize", function ($old) {
            $old();
            this.root.camera.downPreHandler.remove(this.onMouseDown);
            upmouse.add(this.onMouseDown, this);
        });
    }
}
