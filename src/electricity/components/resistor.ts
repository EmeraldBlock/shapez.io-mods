import regularImageBase64 from "../assets/resistor.png";
import blueprintImageBase64 from "shapez.io/../../res_raw/sprites/blueprints/filter.png";

import { Vector } from "shapez.io/core/vector";
import { defaultBuildingVariant } from "shapez.io/game/meta_building";
import { ModMetaBuilding } from "shapez.io/mods/mod_meta_building";
import type { Entity } from "shapez.io/game/entity";
import { CircuitComponent, registerCircuitData } from "../circuit";

registerCircuitData("resistor", data => -data.current * data.resistance);

export class MetaResistorBuilding extends ModMetaBuilding {
    constructor() {
        super("resistor");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: defaultBuildingVariant,
                name: "Resistor",
                description: "Has a resistance of 1Ω.",

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
                type: "resistor",
                data: {
                    current: 0,
                    resistance: 1,
                },
            }),
        );
    }
}
