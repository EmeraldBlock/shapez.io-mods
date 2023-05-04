import type { ModInterface } from "shapez.io/mods/mod_interface";
declare module "shapez.io/mods/mod_interface" {
    interface ModInterface {
        extendClass<T extends U, U = T>(classHandle: Class<T>, extender: ({ $super, $old }: { $super: U, $old: T }) => { [propertyName: string]: (this: T, ...args: Array<never>) => unknown }): void;
    }
}

import type { DialogWithForm } from "shapez.io/core/modal_dialog_elements.js";
declare module "shapez.io/core/modal_dialog_elements.js" {
    interface DialogWithForm {
        buttonSignals: Record<string, TypedSignal<Array<unknown>>>;
    }
}

import type { FormElement } from "shapez.io/core/modal_dialog_forms.js";
declare module "shapez.io/core/modal_dialog_forms.js" {
    interface FormElement {
        getFormElement(parent: HTMLElement): HTMLElement | null;
    }
}

import type { MetaBuilding } from "shapez.io/game/meta_building.js";
declare module "shapez.io/game/meta_building.js" {
    interface MetaBuilding {
        getSilhouetteColor(variant: string, rotationVariant: number): string | null;
    }
}
