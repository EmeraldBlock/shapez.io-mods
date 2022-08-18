import { globalConfig } from "shapez.io/core/config.js";
import type { DrawParameters } from "shapez.io/core/draw_parameters.js";
import { drawSpriteClipped } from "shapez.io/core/draw_utils.js";
import { getBuildingDataFromCode } from "shapez.io/game/building_codes.js";
import { CHUNK_OVERLAY_RES, MapChunkView } from "shapez.io/game/map_chunk_view.js";
import { THEME } from "shapez.io/game/theme.js";
import type { Mod } from "shapez.io/mods/mod.js";

declare module "shapez.io/game/map_chunk_view.js" {
    interface MapChunkView {
        /**
         * Draws only the belts of the background layer
         */
        drawBackgroundLayerBeltsOnly(parameters: DrawParameters): void;

        /**
         * Overlay with transparent background
         */
        drawOverlayNoBackground(parameters: DrawParameters): void;

        generateOverlayBufferNoBackground(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, w: number, h: number, dpi: number): void;
    }
}

export function initMapChunkView(mod: Mod) {
    mod.modInterface.extendClass(MapChunkView, () => ({
        /**
         * Draws only the belts of the background layer
         */
        drawBackgroundLayerBeltsOnly(parameters: DrawParameters) {
            const systems = this.root.systemMgr.systems;
        
            systems.beltUnderlays.drawChunk(parameters, this);
            systems.belt.drawChunk(parameters, this);
        },

        /**
         * Overlay with transparent background
         */
        drawOverlayNoBackground(parameters: DrawParameters) {
            const overlaySize = globalConfig.mapChunkSize * CHUNK_OVERLAY_RES;
            const sprite = this.root.buffers.getForKey({
                key: "chunknobg@" + this.root.currentLayer,
                subKey: this.renderKey!,
                w: overlaySize,
                h: overlaySize,
                dpi: 1,
                redrawMethod: this.generateOverlayBufferNoBackground.bind(this),
            });
    
            const dims = <number><number | null>globalConfig.mapChunkWorldSize;
            const extrude = 0.05;
    
            // Draw chunk "pixel" art
            parameters.context.imageSmoothingEnabled = false;
            drawSpriteClipped({
                parameters,
                sprite,
                x: this.x * dims - extrude,
                y: this.y * dims - extrude,
                w: dims + 2 * extrude,
                h: dims + 2 * extrude,
                originalW: overlaySize,
                originalH: overlaySize,
            });
    
            parameters.context.imageSmoothingEnabled = true;
        },

        generateOverlayBufferNoBackground(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, w: number, h: number, dpi: number) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const upperArray = this.contents[x];
                for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                    const upperContent = upperArray[y];
                    if (upperContent) {
                        const staticComp = upperContent.components.StaticMapEntity;
                        const data = getBuildingDataFromCode(staticComp.code);
                        const metaBuilding = data.metaInstance!;
    
                        const overlayMatrix = metaBuilding.getSpecialOverlayRenderMatrix(
                            staticComp.rotation,
                            data.rotationVariant!,
                            data.variant!,
                            upperContent
                        );
    
                        if (overlayMatrix) {
                            context.fillStyle = metaBuilding.getSilhouetteColor(
                                data.variant!,
                                data.rotationVariant!
                            )!;
                            for (let dx = 0; dx < 3; ++dx) {
                                for (let dy = 0; dy < 3; ++dy) {
                                    const isFilled = overlayMatrix[dx + dy * 3];
                                    if (isFilled) {
                                        context.fillRect(
                                            x * CHUNK_OVERLAY_RES + dx,
                                            y * CHUNK_OVERLAY_RES + dy,
                                            1,
                                            1
                                        );
                                    }
                                }
                            }
    
                            continue;
                        } else {
                            context.fillStyle = metaBuilding.getSilhouetteColor(
                                data.variant!,
                                data.rotationVariant!
                            )!;
                            context.fillRect(
                                x * CHUNK_OVERLAY_RES,
                                y * CHUNK_OVERLAY_RES,
                                CHUNK_OVERLAY_RES,
                                CHUNK_OVERLAY_RES
                            );
    
                            continue;
                        }
                    }
                }
            }
    
            if (this.root.currentLayer === "wires") {
                // Draw wires overlay
    
                context.fillStyle = THEME.map.wires.overlayColor;
                context.fillRect(0, 0, w, h);
    
                for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                    const wiresArray = this.wireContents[x];
                    for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                        const content = wiresArray[y];
                        if (!content) {
                            continue;
                        }
                        MapChunkView.drawSingleWiresOverviewTile({
                            context,
                            x: x * CHUNK_OVERLAY_RES,
                            y: y * CHUNK_OVERLAY_RES,
                            entity: content,
                            tileSizePixels: CHUNK_OVERLAY_RES,
                        });
                    }
                }
            }
        },
    }));
}
