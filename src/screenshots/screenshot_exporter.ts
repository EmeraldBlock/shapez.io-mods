import { makeOffscreenBuffer } from "shapez.io/core/buffer_utils.js";
import { globalConfig } from "shapez.io/core/config.js";
import { DrawParameters } from "shapez.io/core/draw_parameters.js";
import { createLogger } from "shapez.io/core/logging.js";
import { DialogWithForm } from "shapez.io/core/modal_dialog_elements.js";
import { FormElementCheckbox } from "shapez.io/core/modal_dialog_forms.js";
import { FormElementCheckboxList, FormElementEnum } from "./modal_dialog_forms";
import { Rectangle } from "shapez.io/core/rectangle.js";
import { ORIGINAL_SPRITE_SCALE } from "shapez.io/core/sprites.js";
import { clamp } from "shapez.io/core/utils.js";
import { Vector } from "shapez.io/core/vector.js";
import { StaticMapEntityComponent } from "shapez.io/game/components/static_map_entity.js";
import { HUDMassSelector } from "shapez.io/game/hud/parts/mass_selector.js";
import { HUDScreenshotExporter } from "shapez.io/game/hud/parts/screenshot_exporter.js";
import { KEYMAPPINGS } from "shapez.io/game/key_action_mapper.js";
import { CHUNK_OVERLAY_RES, MapChunkView } from "shapez.io/game/map_chunk_view.js";
import { enumHubGoalRewards } from "shapez.io/game/tutorial_goals.js";
import { T } from "shapez.io/translations.js";
import type { GameHUD } from "shapez.io/game/hud/hud.js";
import type { HUDWiresOverlay } from "shapez.io/game/hud/parts/wires_overlay";
import type { Mod } from "shapez.io/mods/mod.js";
import type { GameRoot } from "shapez.io/game/root";

declare module "shapez.io/game/hud/parts/screenshot_exporter.js" {
    interface HUDScreenshotExporter {
        startExport(): void;

        /**
         * Renders a screenshot of the entire base or a region as closely as possible to the ingame camera, then exports it
         */
        doExport(targetResolution: number, overlay: boolean, wiresLayer: boolean, hideBackground: boolean, allowBorder: boolean, tileBounds?: Rectangle): void;
    }
}

const logger = createLogger("screenshot_exporter");

const MAX_CANVAS_DIMS = 16384;
// should be odd so that the centers of tiles are rendered
// as pixels per tile must be a multiple of this
const TARGET_INVERSE_BORDER = 3;

type Quality = {
    id: "high" | "medium" | "low" | "pixels",
    resolution: number,
}

const screenshotQualities : Array<Quality> = [
    {
        id: "high",
        resolution: MAX_CANVAS_DIMS,
    },
    {
        id: "medium",
        resolution: MAX_CANVAS_DIMS / 4,
    },
    {
        id: "low",
        resolution: MAX_CANVAS_DIMS / 16,
    },
    {
        id: "pixels",
        resolution: 0,
    },
];
// @TODO: translation (T.dialogs.exportScreenshotWarning.qualities)
const qualityNames = { high: "High", medium: "Medium", low: "Low", pixels: "Pixels" };

export type ScreenshotOptions = {
    targetResolution: number;
    overlay: boolean;
    wiresLayer: boolean;
    hideBackground: boolean;
    allowBorder: boolean;
    tileBounds?: Rectangle;
};

/**
 * Renders a screenshot of the entire base or a region as closely as possible to the ingame camera
 */
export function takeScreenshot(root: GameRoot, {
    targetResolution,
    overlay,
    wiresLayer,
    hideBackground,
    allowBorder,
    tileBounds,
}: ScreenshotOptions) {
    logger.log("Starting render ...");

    if (!tileBounds) {
        // Find extends
        const staticEntities = root.entityMgr.getAllWithComponent(StaticMapEntityComponent);

        const minTile = new Vector(0, 0);
        const maxTile = new Vector(0, 0);
        for (let i = 0; i < staticEntities.length; ++i) {
            const entityBounds = staticEntities[i].components.StaticMapEntity.getTileSpaceBounds();
            minTile.x = Math.min(minTile.x, entityBounds.x);
            minTile.y = Math.min(minTile.y, entityBounds.y);

            maxTile.x = Math.max(maxTile.x, entityBounds.x + entityBounds.w);
            maxTile.y = Math.max(maxTile.y, entityBounds.y + entityBounds.h);
        }

        minTile.x = Math.floor(minTile.x / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;
        minTile.y = Math.floor(minTile.y / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;

        maxTile.x = Math.ceil(maxTile.x / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;
        maxTile.y = Math.ceil(maxTile.y / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;

        tileBounds = Rectangle.fromTwoPoints(minTile, maxTile).expandedInAllDirections(
            globalConfig.mapChunkSize
        );
    }

    // if the desired pixels per tile is too small, we do not create a border
    // so that we have more valid values for pixels per tile
    // we do not create a border for map view since there is no sprite overflow
    const border =
        allowBorder &&
        !overlay &&
        targetResolution / (Math.max(tileBounds.w, tileBounds.h) + 2 / TARGET_INVERSE_BORDER) >=
            3 * TARGET_INVERSE_BORDER;

    const bounds = border ? tileBounds.expandedInAllDirections(1 / TARGET_INVERSE_BORDER) : tileBounds;
    logger.log("Bounds:", bounds);

    const maxDimensions = Math.max(bounds.w, bounds.h);

    // at least 3 pixels per tile, for bearable quality
    // at most the resolution of the assets, to not be excessive
    const clamped = clamp(
        targetResolution / (maxDimensions + (border ? 2 / 3 : 0)),
        3,
        globalConfig.assetsDpi * globalConfig.tileSize
    );

    // 1 is a fake value since it behaves the same as a border width of 0
    const inverseBorder = border ? TARGET_INVERSE_BORDER : 1;
    const tileSizePixels = overlay
        ? // we floor to the nearest multiple of the map view tile resolution
          Math.floor(clamped / CHUNK_OVERLAY_RES) * CHUNK_OVERLAY_RES || CHUNK_OVERLAY_RES
        : // we floor to the nearest odd multiple so that the center of each building is rendered
          Math.floor((clamped + inverseBorder) / (2 * inverseBorder)) * (2 * inverseBorder) -
              inverseBorder || inverseBorder;
    logger.log("Pixels per tile:", tileSizePixels);

    if (Math.round(tileSizePixels * maxDimensions) > MAX_CANVAS_DIMS) {
        logger.error("Maximum canvas size exceeded, aborting");
        return;
    }

    const zoomLevel = tileSizePixels / globalConfig.tileSize;
    logger.log("Scale:", zoomLevel);

    // Compute atlas scale
    const lowQuality = root.app.settings!.getAllSettings().lowQualityTextures;
    const effectiveZoomLevel = (zoomLevel / globalConfig.assetsDpi) * globalConfig.assetsSharpness;

    let desiredAtlasScale = "0.25";
    if (effectiveZoomLevel > 0.5 && !lowQuality) {
        desiredAtlasScale = ORIGINAL_SPRITE_SCALE;
    } else if (effectiveZoomLevel > 0.35 && !lowQuality) {
        desiredAtlasScale = "0.5";
    }

    logger.log("Allocating buffer, if the factory grew too big it will crash here");
    const [canvas, context] = makeOffscreenBuffer(
        Math.round(bounds.w * tileSizePixels),
        Math.round(bounds.h * tileSizePixels),
        {
            smooth: true,
            reusable: false,
            label: "export-buffer",
        }
    );
    logger.log("Got buffer, rendering now ...");

    const visibleRect = bounds.allScaled(globalConfig.tileSize);
    const parameters = new DrawParameters({
        context,
        visibleRect,
        desiredAtlasScale,
        root: root,
        zoomLevel: zoomLevel,
    });

    context.scale(zoomLevel, zoomLevel);
    context.translate(-visibleRect.x, -visibleRect.y);

    // hack but works
    const currentLayer = root.currentLayer;
    const currentAlpha = (<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay.currentAlpha;
    if (wiresLayer) {
        root.currentLayer = "wires";
        (<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay.currentAlpha = 1;
    } else {
        root.currentLayer = "regular";
        (<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay.currentAlpha = 0;
    }
    root.systemMgr.systems.itemAcceptor.updateForScreenshot();

    // Render all relevant chunks
    root.signals.gameFrameStarted.dispatch();
    if (overlay) {
        root;
        if (hideBackground) {
            root.map.drawVisibleChunks(parameters, MapChunkView.prototype.drawOverlayNoBackground);
        } else {
            root.map.drawOverlay(parameters);
        }
    } else {
        if (hideBackground) {
            root.map.drawVisibleChunks(
                parameters,
                MapChunkView.prototype.drawBackgroundLayerBeltsOnly
            );
        } else {
            root.map.drawBackground(parameters);
        }
        root.systemMgr.systems.belt.drawBeltItems(parameters);
        root.map.drawForeground(parameters);
        root.systemMgr.systems.hub.draw(parameters);
        if ((<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay) {
            (<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay.draw(parameters);
        }
        if (root.currentLayer === "wires") {
            root.map.drawWiresForegroundLayer(parameters);
        }
    }

    root.currentLayer = currentLayer;
    (<GameHUD["parts"] & { wiresOverlay: HUDWiresOverlay }>root.hud.parts!).wiresOverlay.currentAlpha = currentAlpha;

    logger.log("Rendered buffer");
    return canvas;
}

export function initHUDScreenshotExporter(mod: Mod) {
    mod.modInterface.extendClass<HUDScreenshotExporter>(HUDScreenshotExporter, () => ({
        startExport() {
            if (!this.root.app.restrictionMgr!.getIsExportingScreenshotsPossible()) {
                this.root.hud.parts!.dialogs.showFeatureRestrictionInfo(T.demo.features.exportingBase);
                return;
            }

            let bounds: Rectangle | undefined = undefined;
            const massSelector = (<GameHUD["parts"] & { massSelector: HUDMassSelector }>this.root.hud.parts!).massSelector;
            if (massSelector instanceof HUDMassSelector) {
                if (massSelector.currentSelectionStartWorld) {
                    const worldStart = massSelector.currentSelectionStartWorld;
                    const worldEnd = this.root.camera.screenToWorld(massSelector.currentSelectionEnd!);

                    const tileStart = worldStart.toTileSpace();
                    const tileEnd = worldEnd.toTileSpace();

                    bounds = Rectangle.fromTwoPoints(tileStart, tileEnd);
                    bounds.w += 1;
                    bounds.h += 1;
                } else if (massSelector.selectedUids!.size > 0) {
                    const minTile = new Vector(Infinity, Infinity);
                    const maxTile = new Vector(-Infinity, -Infinity);

                    const entityUids = Array.from(massSelector.selectedUids!);
                    for (let i = 0; i < entityUids.length; ++i) {
                        const entityBounds = this.root.entityMgr
                            .findByUid(entityUids[i])
                            .components.StaticMapEntity.getTileSpaceBounds();

                        minTile.x = Math.min(minTile.x, entityBounds.x);
                        minTile.y = Math.min(minTile.y, entityBounds.y);

                        maxTile.x = Math.max(maxTile.x, entityBounds.x + entityBounds.w);
                        maxTile.y = Math.max(maxTile.y, entityBounds.y + entityBounds.h);
                    }

                    bounds = Rectangle.fromTwoPoints(minTile, maxTile);
                }
            }

            const qualityInput = new FormElementEnum({
                id: "screenshotQuality",
                label: "Quality",
                options: screenshotQualities,
                defaultValue: "medium",
                valueGetter: quality => quality.resolution,
                // @TODO: translation (T.dialogs.exportScreenshotWarning.qualityLabel)
                textGetter: quality => qualityNames[quality.id],
            });
            const overlayInput = new FormElementCheckbox({
                id: "screenshotView",
                // @TODO: translation (T.dialogs.exportScreenshotWarning.descOverlay)
                label: "Map view",
                defaultValue: this.root.camera.getIsMapOverlayActive(),
            });
            const layerInput = new FormElementCheckbox({
                id: "screenshotLayer",
                // @TODO: translation (T.dialogs.exportScreenshotWarning.descLayer)
                label: "Wires layer",
                defaultValue: this.root.currentLayer === "wires",
            });
            const backgroundInput = new FormElementCheckbox({
                id: "screenshotBackground",
                // @TODO: translation (T.dialogs.exportScreenshotWarning.descBackground)
                label: "Transparent background",
                defaultValue: false,
            });
            const checkboxInputs = new FormElementCheckboxList({
                id: "screenshotCheckboxes",
                checkboxes: [
                    overlayInput,
                    ...(this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_wires_painter_and_levers)
                        ? [layerInput]
                        : []),
                    backgroundInput,
                ],
            });
            const dialog = new DialogWithForm({
                app: this.root.app,
                title: T.dialogs.exportScreenshotWarning.title,
                desc: bounds
                    ? // @TODO: translation (T.dialogs.exportScreenshotWarning.descSelection)
                      "You requested to export a region of your base as a screenshot. Please note that this will be quite slow for a bigger region and could potentially crash your game!"
                    : // @TODO: update translation (T.dialogs.exportScreenshotWarning.desc)
                      "You requested to export your base as a screenshot. Please note that this will be quite slow for a bigger base and could potentially crash your game!" +
                      (this.root.app.settings?.getAllSettings().offerHints
                          ? // @TODO: translation (T.dialogs.exportScreenshotWarning.descTip)
                            "<br><br>Tip: You can select a region with <key> to only take a screenshot of that region.".replace(
                                "<key>",
                                "<code class='keybinding'>" +
                                    this.root.keyMapper
                                        .getBinding(KEYMAPPINGS.massSelect.massSelectStart)
                                        .getKeyCodeString() +
                                    "</code>"
                            )
                          : ""),
                formElements: [qualityInput, checkboxInputs],
                buttons: ["cancel:good", "ok:bad"],
            });

            dialog.inputReciever.keydown.add(({ keyCode }: { keyCode: number }) => {
                if (keyCode === KEYMAPPINGS.ingame.exportScreenshot.keyCode) {
                    this.root.hud.parts!.dialogs.closeDialog(dialog);
                }
            });

            this.root.hud.parts!.dialogs.internalShowDialog(dialog);
            dialog.buttonSignals.ok.add(
                () =>
                    this.doExport(
                        qualityInput.getValue(),
                        overlayInput.getValue(),
                        layerInput.getValue(),
                        backgroundInput.getValue(),
                        !!bounds,
                        bounds
                    ),
                this
            );
        },

        doExport(targetResolution: number, overlay: boolean, wiresLayer: boolean, hideBackground: boolean, allowBorder: boolean, tileBounds?: Rectangle) {
            const canvas = takeScreenshot(this.root, {
                targetResolution,
                overlay,
                wiresLayer,
                hideBackground,
                allowBorder,
                tileBounds,
            });
            if (canvas === undefined) {
                this.root.hud.parts!.dialogs.showInfo(
                    // @TODO: translation (T.dialogs.exportScreenshotFail.title)
                    "Too large",
                    tileBounds
                        ? // @TODO: translation (T.dialogs.exportScreenshotFail.descSelection)
                          "The region selected is too large to render, sorry! Try selecting a smaller region."
                        : // @TODO: translation (T.dialogs.exportScreenshotFail.desc)
                          "The base is too large to render, sorry! Try selecting just a region of your base with <key>.".replace(
                              "<key>",
                              "<code class='keybinding'>" +
                                  this.root.keyMapper
                                      .getBinding(KEYMAPPINGS.massSelect.massSelectStart)
                                      .getKeyCodeString() +
                                  "</code>"
                          )
                );
                return;
            }

            // Offer export
            logger.log("Exporting ...");
            const image = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            const timestamp = new Date().toLocaleString('sv').replace(/:/g, '-').replace(' ', '_');
            link.download = `base_${timestamp}.png`;
            link.href = image;
            link.click();
            logger.log("Done!");
        },
    }));
}
