import METADATA from "./meta.js";

/**
 * @type {{
 *     Mod: typeof import("shapez.io/mods/mod").Mod,
 *     Signal: typeof import("shapez.io/core/signal").Signal,
 *     Vector: typeof import("shapez.io/core/vector").Vector,
 *     enumMouseButton: typeof import("shapez.io/game/camera").enumMouseButton,
 *     HUDConstantSignalEdit: typeof import("shapez.io/game/hud/parts/constant_signal_edit").HUDConstantSignalEdit,
 *     HUDLeverToggle: typeof import("shapez.io/game/hud/parts/lever_toggle").HUDLeverToggle,
 *     HUDWaypoints: typeof import("shapez.io/game/hud/parts/waypoints").HUDWaypoints,
 * }}
 */
const {
    Mod,
    Signal,
    Vector,
    enumMouseButton,
    HUDConstantSignalEdit,
    HUDLeverToggle,
    HUDWaypoints,
} = window.shapez;

const numberToButton = [enumMouseButton.left, enumMouseButton.middle, enumMouseButton.right];

class UpmouseMod extends Mod {
    init() {
        const upmouse = /** @type {TypedSignal<[import("shapez.io/core/vector").Vector, import("shapez.io/game/camera").enumMouseButton]>} */ (new Signal());
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

window.$shapez_registerMod(UpmouseMod, METADATA);
