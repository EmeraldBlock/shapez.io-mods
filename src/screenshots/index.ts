import metadata from "./meta.js";
import icon from "./icon.webp";
const METADATA: Meta = metadata;
METADATA.extra.icon = icon;

import css from "./dialogs.scss";

import { Mod } from "shapez.io/mods/mod.js";
import { initMapChunkView } from "./map_chunk_view";
import { initItemAcceptorSystem } from "./item_acceptor";
import { ScreenshotOptions, initHUDScreenshotExporter, takeScreenshot } from "./screenshot_exporter";
import type { GameRoot } from "shapez.io/game/root";

class ScreenshotMod extends Mod {
    init() {
        this.modInterface.registerCss(css);

        initMapChunkView(this);
        initItemAcceptorSystem(this);
        initHUDScreenshotExporter(this);
    }

    takeScreenshot(root: GameRoot, options: ScreenshotOptions) {
        return takeScreenshot(root, options);
    }
}

window.$shapez_registerMod(ScreenshotMod, METADATA);
