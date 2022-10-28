import metadata from "./meta.js";
import icon from "./icon.webp";
const METADATA: Meta = metadata;
METADATA.extra.icon = icon;

import css from "./dialogs.scss";

import { Mod } from "shapez.io/mods/mod.js";
import { initMapChunkView } from "./map_chunk_view";
import { initItemAcceptorSystem } from "./item_acceptor";
import { initHUDScreenshotExporter } from "./screenshot_exporter";

class ScreenshotMod extends Mod {
    init() {
        this.modInterface.registerCss(css);

        initMapChunkView(this);
        initItemAcceptorSystem(this);
        initHUDScreenshotExporter(this);
    }
}

window.$shapez_registerMod(ScreenshotMod, METADATA);
