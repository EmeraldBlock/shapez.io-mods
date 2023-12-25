import conflictDot from "./assets/conflict_dot.png";
import conflictStub from "./assets/conflict_stub.png";
import cableIcon from "shapez.io/../../res/ui/icons/advantage_wires.png";
import batteryIcon from "shapez.io/../../res_raw/sprites/misc/processor_disconnected.png";
import resistorIcon from "shapez.io/../../res/ui/building_icons/constant_signal.png";
import capacitorIcon from "shapez.io/../../res/ui/building_icons/comparator.png";
import inductorIcon from "shapez.io/../../res/ui/icons/advantage_new_levels.png";
import METADATA from "./meta";

import { Mod } from "shapez.io/mods/mod";
import { MetaBatteryBuilding } from "./components/battery";
import { MetaResistorBuilding } from "./components/resistor";
import { MetaCapacitorBuilding } from "./components/capacitor";
import { MetaInductorBuilding } from "./components/inductor";
import { CableComponent, CableSerialized, CableSystem, HUDCableInfo, MetaCableBuilding } from "./cable";
import { GameHUD } from "shapez.io/game/hud/hud";
import type { GameRoot } from "shapez.io/game/root";
import type { Vector } from "shapez.io/core/vector";
import type { ModMetaBuilding } from "shapez.io/mods/mod_meta_building";
import { MapChunkView } from "shapez.io/game/map_chunk_view";
import { CircuitComponent, CircuitSerialized, CircuitSystem } from "./circuit";
import { HUDBuildingPlacerLogic } from "shapez.io/game/hud/parts/building_placer_logic";
import { createLogger } from "shapez.io/core/logging";

declare global {
    type Systems = GameRoot["systemMgr"]["systems"] & { cable: CableSystem,  circuit: CircuitSystem };
}

declare module "shapez.io/game/hud/hud_parts.d.ts" {
    interface HudParts {
        cableInfo: HUDCableInfo;
    }
}

declare module "shapez.io/game/hud/parts/building_placer_logic.js" {
    interface HUDBuildingPlacerLogic {
        lastPlaceTile: Vector | null,
    }
}

type ElectricitySerialized = {
    version: number,
    circuit: CircuitSerialized,
    cable: CableSerialized,
};

const logger = createLogger("electricity");

class ElectricityMod extends Mod {
    init() {
        // sprites for cables
        this.modInterface.registerSprite("sprites/wires/sets/conflict_dot.png", conflictDot);
        this.modInterface.registerSprite("sprites/wires/sets/conflict_stub.png", conflictStub);

        // circuit components
        this.registerCircuitComponent(MetaBatteryBuilding, batteryIcon);
        this.registerCircuitComponent(MetaResistorBuilding, resistorIcon);
        this.registerCircuitComponent(MetaCapacitorBuilding, capacitorIcon);
        this.registerCircuitComponent(MetaInductorBuilding, inductorIcon);

        this.modInterface.registerComponent(CircuitComponent);
        this.modInterface.registerGameSystem({
            id: "circuit",
            systemClass: CircuitSystem,
            before: "constantSignal",
        });

        this.modInterface.registerComponent(CableComponent);
        this.modInterface.registerNewBuilding({
            metaClass: MetaCableBuilding,
            buildingIconBase64: cableIcon,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "wires",
            location: "primary",
            metaClass: MetaCableBuilding,
        });
        this.modInterface.registerGameSystem({
            id: "cable",
            systemClass: CableSystem,
            before: "constantSignal",
        });
        this.modInterface.registerHudElement("cableInfo", HUDCableInfo);

        this.modInterface.runAfterMethod(GameHUD, "drawOverlays", function (parameters) {
            this.parts!.cableInfo.drawOverlays(parameters);
        });
        this.modInterface.runAfterMethod(MapChunkView, "drawWiresForegroundLayer", function (parameters) {
            const systems = this.root.systemMgr.systems as Systems;
            systems.cable.drawChunk(parameters, this);
            systems.circuit.drawChunk(parameters, this);
        });
        this.modInterface.replaceMethod(HUDBuildingPlacerLogic, "tryPlaceCurrentBuildingAt", function (oldMethod, [tile]) {
            const placed = oldMethod(tile);
            this.lastPlaceTile = tile;
            return placed;
        });
        this.modInterface.runAfterMethod(HUDBuildingPlacerLogic, "abortDragging", function () {
            this.lastPlaceTile = null;
        });

        this.signals.gameSerialized.add((root, data) => {
            const systems = root.systemMgr.systems as Systems;
            (data.modExtraData as { electricity: ElectricitySerialized }).electricity = {
                version: 1,
                circuit: systems.circuit.serialize(),
                cable: systems.cable.serialize(),
            };
        });
        this.signals.gameDeserialized.add((root, data) => {
            const modData = (data.modExtraData as { electricity: ElectricitySerialized }).electricity;
            if (modData == null) return;
            if (modData.version !== 1) {
                logger.error("Unknown version electricity data:", modData);
                return;
            }
            const systems = root.systemMgr.systems as Systems;
            systems.circuit.deserialize(modData.circuit);
            systems.cable.deserialize(modData.cable);
        });
    }

    registerCircuitComponent(building: typeof ModMetaBuilding, icon: string) {
        this.modInterface.registerNewBuilding({
            metaClass: building,
            buildingIconBase64: icon,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "regular",
            location: "secondary",
            metaClass: building,
        });
        this.modInterface.addNewBuildingToToolbar({
            toolbar: "wires",
            location: "secondary",
            metaClass: building,
        });
    }
}

window.$shapez_registerMod(ElectricityMod, METADATA);
