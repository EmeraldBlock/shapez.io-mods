import regularImageBase64 from "../assets/capacitor.png";
import blueprintImageBase64 from "shapez.io/../../res_raw/sprites/blueprints/filter.png";

import { Vector } from "shapez.io/core/vector";
import { defaultBuildingVariant } from "shapez.io/game/meta_building";
import { ModMetaBuilding } from "shapez.io/mods/mod_meta_building";
import type { Entity } from "shapez.io/game/entity";
import { CircuitComponent, registerCircuitData } from "../circuit";

registerCircuitData("capacitor", data => {
    (data.charge as number) += data.current;
    const voltage = -(data.charge as number) * data.capacitance;
    return voltage;
});

export class MetaCapacitorBuilding extends ModMetaBuilding {
    constructor() {
        super("capacitor");
    }

    static getAllVariantCombinations() {
        return [
            {
                variant: defaultBuildingVariant,
                name: "Capacitor",
                description: "Has a capacitance of 1F.",

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
                type: "capacitor",
                data: {
                    current: 0,
                    capacitance: 1,
                    charge: 0,
                },
            }),
        );
    }
}
