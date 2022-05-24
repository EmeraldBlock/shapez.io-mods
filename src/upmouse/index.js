import METADATA from "./meta.js";

import { Mod } from "shapez.io/mods/mod";
import { Signal } from "shapez.io/core/signal";
import { Vector } from "shapez.io/core/vector";
import { enumMouseButton } from "shapez.io/game/camera";
import { HUDConstantSignalEdit } from "shapez.io/game/hud/parts/constant_signal_edit";
import { HUDLeverToggle } from "shapez.io/game/hud/parts/lever_toggle";
import { HUDWaypoints } from "shapez.io/game/hud/parts/waypoints";

const numberToButton = [enumMouseButton.left, enumMouseButton.middle, enumMouseButton.right];

class UpmouseMod extends Mod {
    init() {
        const upmouse = /** @type {TypedSignal<[Vector, enumMouseButton]>} */ (new Signal());
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
