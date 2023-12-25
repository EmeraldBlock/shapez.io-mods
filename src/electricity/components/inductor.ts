import regularImageBase64 from "../assets/inductor.png";
import blueprintImageBase64 from "shapez.io/../../res_raw/sprites/blueprints/filter.png";

import { Vector } from "shapez.io/core/vector";
import { defaultBuildingVariant } from "shapez.io/game/meta_building";
import { ModMetaBuilding } from "shapez.io/mods/mod_meta_building";
import type { Entity } from "shapez.io/game/entity";
import { CircuitComponent, registerCircuitData } from "../circuit";

registerCircuitData("inductor", (data, dt) => {
    const voltage = -(data.current - (data.lastCurrent as number)) / dt * data.inductance;
    (data.lastCurrent as number) = data.current;
    return voltage;
});

export class MetaInductorBuilding extends ModMetaBuilding {
    constructor() {
        super("inductor");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: defaultBuildingVariant,
                name: "Inductor",
                description: "Has an inductance of 10mH. Yes, this is pretty much useless. 1H causes values to spiral out of control and I don't know why.",

                regularImageBase64,
                blueprintImageBase64,
                tutorialImageBase64: regularImageBase64,
            },
        ];
    }

    getDimensions() {
        return new Vector(2, 1);
    }

    setupEntityComponents(entity: Entity) {
        entity.addComponent(
            new CircuitComponent({
                input: new Vector(0, 0),
                output: new Vector(1, 0),
                type: "inductor",
                data: {
                    current: 0,
                    inductance: .01,
                    lastCurrent: 0,
                },
            }),
        );
    }
}
