/* shapez.io/src/js/core/modal_dialog_forms.js */
import { ClickDetector } from "shapez.io/core/click_detector.js";
import { createLogger } from "shapez.io/core/logging.js";
import { FormElement } from "shapez.io/core/modal_dialog_forms.js";
import { safeModulo } from "shapez.io/core/utils.js";
import type { FormElementCheckbox } from "shapez.io/core/modal_dialog_forms.js";

const logger = createLogger("dialog_forms");

export class FormElementCheckboxList extends FormElement {
    checkboxes: Array<FormElementCheckbox>;
    constructor({ id, label = null, checkboxes = [] }: { id: string, label?: string | null, checkboxes: Array<FormElementCheckbox> }) {
        super(id, label);
        this.checkboxes = checkboxes;
    }

    getHtml() {
        return `
            <div class="formElement checkBoxGridFormElem">
                ${this.checkboxes.map(checkbox => checkbox.getHtml()).join("\n")}
            </div>
        `;
    }

    bindEvents(parent: HTMLElement, clickTrackers: Array<ClickDetector>) {
        this.checkboxes.forEach(checkbox => checkbox.bindEvents(parent, clickTrackers));
    }

    getValue() {
        return this.checkboxes.map(checkbox => checkbox.getValue());
    }

    focus() {}
}

export class FormElementEnum<T extends { id: string }, U> extends FormElement {
    id!: string;
    label!: string | null;
    options: Array<T>;
    valueGetter: (option: T) => U;
    textGetter: (option: T) => string;
    index: number;
    element: HTMLElement | null;
    constructor({ id, label = null, options, defaultValue = null, valueGetter, textGetter } :
        { id: string, label: string | null, options: Array<T>, defaultValue: string | null, valueGetter: (option: T) => U, textGetter: (option: T) => string }) {
        super(id, label);
        this.options = options;
        this.valueGetter = valueGetter;
        this.textGetter = textGetter;
        this.index = 0;
        if (defaultValue !== null) {
            const index = this.options.findIndex(option => option.id === defaultValue);
            if (index >= 0) {
                this.index = index;
            } else {
                logger.warn("Option ID", defaultValue, "not found in", options, "!");
            }
        }

        this.element = null;
    }

    getHtml() {
        return `
            <div class="formElement enumFormElem">
                ${this.label ? `<label>${this.label}</label>` : ""}
                <div class="enum" data-formId="${this.id}">
                    <div class="toggle prev">⯇</div>
                    <div class="value">${this.textGetter(this.options[this.index])}</div>
                    <div class="toggle next">⯈</div>
                </div>
            </div>
            `;
    }

    bindEvents(parent: HTMLElement, clickTrackers: Array<ClickDetector>) {
        this.element = this.getFormElement(parent)!;

        const children = this.element.children;
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            const detector = new ClickDetector(child, { preventDefault: false });
            clickTrackers.push(detector);
            const change = child.classList.contains("prev") ? -1 : 1;
            detector.click.add(() => this.toggle(change), this);
        }
    }

    getValue() {
        return this.valueGetter(this.options[this.index]);
    }

    toggle(amount: number) {
        this.index = safeModulo(this.index + amount, this.options.length);
        (<HTMLElement>this.element!.querySelector(".value")!).innerText = this.textGetter(this.options[this.index]);
    }

    focus() {}
}
