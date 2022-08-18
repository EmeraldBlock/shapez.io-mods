import { globalConfig } from "shapez.io/core/config.js";
import { fastArrayDelete } from "shapez.io/core/utils.js";
import { ItemAcceptorSystem } from "shapez.io/game/systems/item_acceptor.js";
import type { Mod } from "shapez.io/mods/mod.js";

declare module "shapez.io/game/systems/item_acceptor.js" {
    interface ItemAcceptorSystem {
        updateForScreenshot(): void;
    }
}

export function initItemAcceptorSystem(mod: Mod) {
    mod.modInterface.extendClass(ItemAcceptorSystem, () => ({
        updateForScreenshot() {
            // Compute how much ticks we missed
            const numTicks = this.accumulatedTicksWhileInMapOverview;
            const progress =
                this.root.dynamicTickrate.deltaSeconds! *
                2 *
                this.root.hubGoals.getBeltBaseSpeed() *
                globalConfig.itemSpacingOnBelts * // * 2 because its only a half tile
                numTicks;
    
            // Reset accumulated ticks
            this.accumulatedTicksWhileInMapOverview = 0;
    
            for (let i = 0; i < this.allEntities.length; ++i) {
                const entity = this.allEntities[i];
                const aceptorComp = entity.components.ItemAcceptor;
                const animations = aceptorComp.itemConsumptionAnimations!;
    
                // Process item consumption animations to avoid items popping from the belts
                for (let animIndex = 0; animIndex < animations.length; ++animIndex) {
                    const anim = animations[animIndex];
                    anim.animProgress += progress;
                    if (anim.animProgress > 1) {
                        fastArrayDelete(animations, animIndex);
                        animIndex -= 1;
                    }
                }
            }
        },
    }));
}
