import METADATA from "./meta.js";

import { Mod } from "shapez.io/mods/mod";
import { Signal } from "shapez.io/core/signal";
import { Vector } from "shapez.io/core/vector";
import { Camera, enumMouseButton } from "shapez.io/game/camera";
import { HUDConstantSignalEdit } from "shapez.io/game/hud/parts/constant_signal_edit";
import { HUDLeverToggle } from "shapez.io/game/hud/parts/lever_toggle";
import { HUDWaypoints } from "shapez.io/game/hud/parts/waypoints";
import { KEYMAPPINGS } from "shapez.io/game/key_action_mapper.js";
import type { HUDMassSelector } from "shapez.io/game/hud/parts/mass_selector.js";
import type { GameHUD } from "shapez.io/game/hud/hud.js";

const upmouseHandler = Symbol("upmouseHandler");
const onUpmouse = Symbol("onUpmouse");
declare module "shapez.io/game/camera" {
    interface Camera {
        [upmouseHandler]: TypedSignal<[Vector, enumMouseButton]>;
        [onUpmouse]: (this: Camera, event: MouseEvent) => void;
    }
}

const numberToButton = [enumMouseButton.left, enumMouseButton.middle, enumMouseButton.right];

class UpmouseMod extends Mod {
    symbols: Record<string, symbol>;
    constructor(...args: ConstructorParameters<typeof Mod>) {
        super(...args);
        this.symbols = {
            upmouseHandler,
            onUpmouse,
        };
    }

    init() {
        Camera.prototype[onUpmouse] = function (event) {
            const { blueprintPlacer, buildingPlacer, massSelector } = <GameHUD["parts"] & { massSelector: HUDMassSelector }>this.root.hud.parts!;
            if (
                !this.isCurrentlyInteracting()
                && blueprintPlacer.currentBlueprint!.get() === null
                && buildingPlacer.currentMetaBuilding!.get() === null
                && !(massSelector !== undefined && this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectStart).pressed)
            ) {
                this.root.camera[upmouseHandler].dispatch(new Vector(event.clientX, event.clientY), numberToButton[event.button]);
            }
        };
        let eventListenerUpmouse: ((event: MouseEvent) => void) | undefined;
        this.modInterface.runBeforeMethod(Camera, "internalInitEvents", function () {
            this[upmouseHandler] = new Signal();
            eventListenerUpmouse = this[onUpmouse].bind(this);
            this.root.canvas.addEventListener("mouseup", eventListenerUpmouse);
        });
        this.modInterface.runBeforeMethod(Camera, "cleanup", function () {
            this.root.canvas.removeEventListener("mouseup", eventListenerUpmouse!);
            eventListenerUpmouse = undefined;
        });

        this.modInterface.runAfterMethod(HUDConstantSignalEdit, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.downPreHandler);
            this.root.camera[upmouseHandler].add(this.downPreHandler, this);
        });
        this.modInterface.runAfterMethod(HUDLeverToggle, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.downPreHandler);
            this.root.camera[upmouseHandler].add(this.downPreHandler, this);
        });
        this.modInterface.runAfterMethod(HUDWaypoints, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.onMouseDown);
            this.root.camera[upmouseHandler].add(this.onMouseDown, this);
        });
    }
}

window.$shapez_registerMod(UpmouseMod, METADATA);
