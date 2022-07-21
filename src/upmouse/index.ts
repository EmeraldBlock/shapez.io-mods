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

const UPMOUSE = Symbol("upmouse");
declare module "shapez.io/game/camera" {
    interface Camera {
        [UPMOUSE]: TypedSignal<[Vector, enumMouseButton]>;
    }
}

const numberToButton = [enumMouseButton.left, enumMouseButton.middle, enumMouseButton.right];

class UpmouseMod extends Mod {
    symbols: Record<string, symbol>;
    constructor(...args: ConstructorParameters<typeof Mod>) {
        super(...args);
        this.symbols = {
            upmouse: UPMOUSE,
        };
    }

    init() {
        this.modInterface.runBeforeMethod(Camera, "internalInitEvents", function () {
            this[UPMOUSE] = new Signal();
        });

        let focused = false;
        this.modInterface.runBeforeMethod(Camera, "onMouseUp", function (): false {
            const { blueprintPlacer, buildingPlacer, massSelector } = <GameHUD["parts"] & { massSelector: HUDMassSelector }>this.root.hud.parts!;
            focused = !this.isCurrentlyInteracting()
                && blueprintPlacer.currentBlueprint!.get() === null
                && buildingPlacer.currentMetaBuilding!.get() === null
                && !(massSelector !== undefined && this.root.keyMapper.getBinding(KEYMAPPINGS.massSelect.massSelectStart).pressed);
            return false;
        });
        this.modInterface.runAfterMethod(Camera, "onMouseUp", function (eventu): false {
            const event = eventu!;
            if (focused) {
                this.root.camera[UPMOUSE].dispatch(new Vector(event.clientX, event.clientY), numberToButton[event.button]);
            }
            return false;
        });

        this.modInterface.runAfterMethod(HUDConstantSignalEdit, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.downPreHandler);
            this.root.camera[UPMOUSE].add(this.downPreHandler, this);
        });
        this.modInterface.runAfterMethod(HUDLeverToggle, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.downPreHandler);
            this.root.camera[UPMOUSE].add(this.downPreHandler, this);
        });
        this.modInterface.runAfterMethod(HUDWaypoints, "initialize", function () {
            this.root.camera.downPreHandler.remove(this.onMouseDown);
            this.root.camera[UPMOUSE].add(this.onMouseDown, this);
        });
    }
}

window.$shapez_registerMod(UpmouseMod, METADATA);
