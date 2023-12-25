import forwardImage from "shapez.io/../../res_raw/sprites/wires/sets/conflict_forward.png";

import { defaultBuildingVariant } from "shapez.io/game/meta_building";
import { ModMetaBuilding } from "shapez.io/mods/mod_meta_building";
import { clamp, generateMatrixRotations } from "shapez.io/core/utils";
import { SOUNDS } from "shapez.io/platform/sound";
import { GameSystemWithFilter } from "shapez.io/game/game_system_with_filter";
import { Component } from "shapez.io/game/component";
import { deserializeSchema, serializeSchema, types } from "shapez.io/savegame/serialization";
import type { DrawParameters } from "shapez.io/core/draw_parameters";
import type { Entity } from "shapez.io/game/entity";
import { BaseHUDPart } from "shapez.io/game/hud/base_hud_part";
import type { AtlasSprite } from "shapez.io/core/sprites";
import type { MapChunkView } from "shapez.io/game/map_chunk_view";
import { globalConfig } from "shapez.io/core/config";
import { Loader } from "shapez.io/core/loader";
import { Vector, arrayAllDirections, enumDirectionToVector } from "shapez.io/core/vector";
import { GameRoot } from "shapez.io/game/root";
import { getCodeFromBuildingData } from "shapez.io/game/building_codes";
import { gMetaBuildingRegistry } from "shapez.io/core/global_registries";
import { CircuitData, edgeConfig } from "./circuit";
import { createLogger } from "shapez.io/core/logging";

declare module "shapez.io/game/entity_components.d.ts" {
    interface EntityComponentStorage {
        Cable?: CableComponent;
    }
}

enum CableRotationVariant {
    dot,
    stub,
    forward,
    turn,
    split,
    cross,
}

const CRV = CableRotationVariant;
/** const-typed `enumDirection` */
const D = {
    top: "top",
    right: "right",
    bottom: "bottom",
    left: "left",
} as const;

type Rotation = 0 | 90 | 180 | 270;
type Direction = typeof D[keyof typeof D];
type Connections = { [K in Direction]: boolean };

export const cableVariants = [
    CRV.dot,
    CRV.stub,
    CRV.forward,
    CRV.turn,
    CRV.split,
    CRV.cross
] as const;

const cableOverlayMatrices = {
    [CRV.dot]: generateMatrixRotations([0, 0, 0, 0, 1, 0, 0, 0, 0]),
    [CRV.stub]: generateMatrixRotations([0, 0, 0, 0, 1, 0, 0, 1, 0]),
    [CRV.forward]: generateMatrixRotations([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    [CRV.turn]: generateMatrixRotations([0, 0, 0, 0, 1, 1, 0, 1, 0]),
    [CRV.split]: generateMatrixRotations([0, 0, 0, 1, 1, 1, 0, 1, 0]),
    [CRV.cross]: generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 0]),
} as const;

const cableConnections = {
    [CRV.dot]: { [D.top]: false, [D.right]: false, [D.bottom]: false, [D.left]: false },
    [CRV.stub]: { [D.top]: false, [D.right]: false, [D.bottom]: true, [D.left]: false },
    [CRV.forward]: { [D.top]: true, [D.right]: false, [D.bottom]: true, [D.left]: false },
    [CRV.turn]: { [D.top]: false, [D.right]: true, [D.bottom]: true, [D.left]: false },
    [CRV.split]: { [D.top]: false, [D.right]: true, [D.bottom]: true, [D.left]: true },
    [CRV.cross]: { [D.top]: true, [D.right]: true, [D.bottom]: true, [D.left]: true },
} as const;

const cableSprites = {
    [CRV.dot]: "sprites/wires/sets/conflict_dot.png",
    [CRV.stub]: "sprites/wires/sets/conflict_stub.png",
    [CRV.forward]: "sprites/wires/sets/conflict_forward.png",
    [CRV.turn]: "sprites/wires/sets/conflict_turn.png",
    [CRV.split]: "sprites/wires/sets/conflict_split.png",
    [CRV.cross]: "sprites/wires/sets/conflict_cross.png",
} as const;

function assert(condition: boolean, failureMessage: string): asserts condition {
    return window.assert(condition, failureMessage);
}

function rotationsFromConnections(connections: Connections) {
    const arr = [connections[D.top], connections[D.right], connections[D.bottom], connections[D.left]];
    const count = arr.filter(b => b).length;
    switch (count) {
        case 0:
            return { rotation: 0 as Rotation, rotationVariant: CRV.dot };
        case 1:
            return { rotation: (arr.indexOf(true) + 2) % 4 * 90 as Rotation, rotationVariant: CRV.stub };
        case 2: {
            const first = arr.indexOf(true);
            const last = arr.lastIndexOf(true);
            if (first % 2 === last % 2) {
                return { rotation: first * 90 as Rotation, rotationVariant: CRV.forward};
            }
            return { rotation: ((first === 0 && last === 3 ? first : last) + 2) % 4 * 90 as Rotation, rotationVariant: CRV.turn };
        }
        case 3:
            return { rotation: arr.indexOf(false) * 90 as Rotation, rotationVariant: CRV.split };
        case 4:
            return { rotation: 0 as Rotation, rotationVariant: CRV.cross };
    }
    assert(false, `Invalid connections array: ${arr}`);
}

function rotate(direction: Direction, rotation: Rotation | 360) {
    return Vector.transformDirectionFromMultipleOf90(direction, rotation) as Direction;
}

function connectionsFromRotations({ rotation, rotationVariant }: { rotation: Rotation, rotationVariant: CableRotationVariant }) {
    const connections = cableConnections[rotationVariant];
    return Object.fromEntries(
        (arrayAllDirections as Direction[]).map(direction =>
            [direction, connections[rotate(direction, 360 - rotation as Rotation | 360) as Direction]]
        )
    ) as Connections;
}

function directionFromVector(v: Vector) {
    return Object.entries(enumDirectionToVector).find(([, w]) => w.equals(v))?.[0] as Direction;
}

function updateConnection(entity: Entity, direction: Direction, connected: boolean) {
    const cableComp = entity.components.Cable!;
    cableComp.connections[direction] = connected;
    const { rotation, rotationVariant } = rotationsFromConnections(cableComp.connections);
    const staticComp = entity.components.StaticMapEntity!;
    staticComp.rotation = rotation;
    staticComp.code = getCodeFromBuildingData(gMetaBuildingRegistry.findByClass(MetaCableBuilding), defaultBuildingVariant, rotationVariant);
}

export class CableComponent extends Component {
    static getId() {
        return "Cable";
    }

    static getSchema() {
        return {
            connections: types.structured({
                [D.top]: types.bool,
                [D.right]: types.bool,
                [D.bottom]: types.bool,
                [D.left]: types.bool,
            }),
        };
    }

    constructor(public connections: Connections) {
        super();
    }
}

const edgeSchema = {
    input: types.vector,
    output: types.vector,
    data: types.keyValueMap(types.float),
};

export type CableSerialized = {
    edges: object[],
};

const logger = createLogger("systems/cable");

export class CableSystem extends GameSystemWithFilter {
    public edges: Set<CircuitData>;
    public edgesFromEntity: WeakMap<Entity, { [K in Direction]: CircuitData | null }>;

    constructor(root: GameRoot) {
        super(root, [CableComponent]);

        this.edges = new Set();
        this.edgesFromEntity = new WeakMap();

        this.root.signals.entityAdded.add(this.onEntityAdded, this);
        this.root.signals.entityDestroyed.add(this.onEntityDestroyed, this);
        this.root.signals.gameRestored.add(this.onGameRestored, this);
    }

    serialize(): CableSerialized {
        return {
            edges: [...this.edges].map(edge => serializeSchema(edge, edgeSchema)),
        };
    }

    deserialize(data: CableSerialized) {
        this.edges = new Set(data.edges.map(edge => {
            const obj = {} as Record<string, unknown>;
            deserializeSchema(obj, edgeSchema, edge);
            obj.type = "cable";
            return obj as CircuitData;
        }));
    }

    /**
     * Verifies edges are correct
     * and restores `this.edgesFromEntity`.
     */
    onGameRestored() {
        const edges: Map<string, { serialized: CircuitData | null, first: Entity | null, second: Entity | null }> = new Map();
        const get = (key: string) => {
            let arr = edges.get(key);
            if (arr === undefined) {
                arr = { serialized: null, first: null, second: null };
                edges.set(key, arr);
            }
            return arr;
        };
        const offsetFromIndex = {
            [D.top]: new Vector(0, -1),
            [D.right]: new Vector(0, 0),
            [D.bottom]: new Vector(0, 0),
            [D.left]: new Vector(-1, 0),
        } as const;
        for (const entity of this.allEntities) {
            const tile = entity.components.StaticMapEntity!.origin;
            const cableComp = entity.components.Cable!;
            for (const [direction, connected] of Object.entries(cableComp.connections) as [Direction, boolean][]) {
                if (!connected) continue;
                const offset = offsetFromIndex[direction];
                const vertical = direction === D.top || direction === D.bottom;
                get(`${tile.add(offset)},${vertical ? 1 : 0}`)[offset.equals(new Vector(0, 0)) ? "first" : "second"] = entity;
            }
        }
        for (const edge of this.edges) {
            const { input, output } = edge;
            if (edge.type !== "cable") {
                logger.error(`Cable edge from (${input}) to (${output}) of type "${edge.type}"`);
                edge.type = "cable";
            }
            const inputFirst = input.x < output.x || input.y < output.y;
            const first = inputFirst ? input : output;
            const second = inputFirst ? output : input;
            const offset = second.sub(first);
            const vertical = offset.equals(new Vector(0, 1));
            if (!vertical && !offset.equals(new Vector(1, 0))) {
                logger.error(`Invalid cable edge from (${input}) to (${output})`);
                continue;
            }
            get(`${first},${vertical ? 1 : 0}`).serialized = edge;
        }
        for (const [key, { serialized: edge, first: firstEntity, second: secondEntity }] of edges) {
            const [x, y, verticalInt] = key.split(",").map(s => parseInt(s));
            const vertical = verticalInt !== 0;
            const first = new Vector(x, y);
            const second = first.add(vertical ? new Vector(0, 1) : new Vector(1, 0));
            const hasFirst = firstEntity != null;
            const hasSecond = secondEntity != null;
            if (hasFirst && !hasSecond) {
                logger.error(`Incomplete cable connection from (${first}) to (${second})`);
                updateConnection(firstEntity, vertical ? D.bottom : D.right, false);
            } else if (hasSecond && !hasFirst) {
                logger.error(`Incomplete cable connection from (${second}) to (${first})`);
                updateConnection(secondEntity, vertical ? D.top : D.left, false);
            }
            const hasConnection = hasFirst && hasSecond;
            const hasEdge = edge != null;
            if (hasConnection && !hasEdge) {
                logger.error(`Cable connection from (${first}) to (${second}) has no edge`);
                const newEdge = {
                    input: first.copy(),
                    output: second.copy(),
                    type: "cable",
                    data: {
                        current: 0,
                    },
                };
                this.edges.add(newEdge);
                this.setEdge(firstEntity, vertical ? D.bottom : D.right, newEdge);
                this.setEdge(secondEntity, vertical ? D.top : D.left, newEdge);
            } else if (!hasConnection && hasEdge) {
                logger.error(`Edge from (${first}) to (${second}) has no cable connection`);
                this.edges.delete(edge);
            } else if (hasConnection && hasEdge) {
                this.setEdge(firstEntity, vertical ? D.bottom : D.right, edge);
                this.setEdge(secondEntity, vertical ? D.top : D.left, edge);
            }
        }
    }

    setEdge(entity: Entity, index: Direction, edge: CircuitData | null) {
        let edges = this.edgesFromEntity.get(entity);
        if (edges == null) {
            edges = { [D.top]: null, [D.right]: null, [D.bottom]: null, [D.left]: null };
            this.edgesFromEntity.set(entity, edges);
        }
        edges[index] = edge;
    }

    getEdge(entity: Entity, index: Direction) {
        let edges = this.edgesFromEntity.get(entity);
        if (edges == null) {
            return null;
        }
        return edges[index];
    }

    onEntityAdded(entity: Entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        const cableComp = entity.components.Cable;
        if (cableComp == null) {
            return;
        }

        const tile = entity.components.StaticMapEntity!.origin;

        connect: {
            const from = this.root.hud.parts!.buildingPlacer.lastPlaceTile;
            if (from == null) {
                break connect;
            }
            const direction = directionFromVector(from.sub(tile));
            if (direction == null) {
                break connect;
            }
            const fromEntity = this.root.map.getLayerContentXY(from.x, from.y, "wires");
            if (fromEntity.components.Cable == null) {
                break connect;
            }
            updateConnection(entity, direction, true);
        }

        for (const [direction, connected] of Object.entries(cableComp.connections) as [Direction, boolean][]) {
            if (!connected) continue;
            const { x: dx, y: dy } = enumDirectionToVector[direction];
            const toEntity = this.root.map.getLayerContentXY(tile.x + dx, tile.y + dy, "wires");
            if (toEntity == null || toEntity.components.Cable == null) {
                // this can happen with blueprints
                updateConnection(entity, direction, false);
                continue;
            }
            const toDirection = rotate(direction, 180);
            updateConnection(toEntity, toDirection, true);
            const edge = {
                input: tile.copy(),
                output: new Vector(tile.x + dx, tile.y + dy),
                type: "cable",
                data: {
                    current: 0,
                },
            };
            this.edges.add(edge);
            this.setEdge(entity, direction, edge);
            this.setEdge(toEntity, toDirection, edge);
        }
    }

    onEntityDestroyed(entity: Entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        const cableComp = entity.components.Cable;
        if (cableComp == null) {
            return;
        }

        const { x, y } = entity.components.StaticMapEntity!.origin;
        for (const [direction, connected] of Object.entries(cableComp.connections) as [Direction, boolean][]) {
            if (!connected) continue;
            const { x: dx, y: dy } = enumDirectionToVector[direction];
            const toEntity = this.root.map.getLayerContentXY(x + dx, y + dy, "wires");
            if (toEntity == null || toEntity.components.Cable == null) {
                continue;
            }
            const toDirection = rotate(direction, 180);
            updateConnection(toEntity, toDirection, false);
            this.edges.delete(this.getEdge(entity, direction)!);
            this.setEdge(toEntity, toDirection, null);
        }
    }

    drawChunk(parameters: DrawParameters, chunk: MapChunkView) {
        const contents = chunk.wireContents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity == null || entity.components.Cable == null) {
                    continue;
                }
                const sprite = Loader.getSprite(cableSprites[entity.components.StaticMapEntity!.getRotationVariant() as CableRotationVariant]);
                entity.components.StaticMapEntity!.drawSpriteOnBoundsClipped(parameters, sprite, 0);
            }
        }
        parameters.context.globalAlpha = 1;
    }
}

export class MetaCableBuilding extends ModMetaBuilding {
    constructor() {
        super("cable");
    }

    static getAllVariantCombinations() {
        return cableVariants.map(rotationVariant => ({
            variant: defaultBuildingVariant,
            rotationVariant,

            name: "Cable",
            description: "Transmits electricity. For simulation purposes, each tile has a 10mF capacitor to ground, and each connection betweeen tiles is 50mΩ and 90mF.",
            tutorialImageBase64: forwardImage,
        }));
    }

    getSprite() {
        return null as AtlasSprite | null as AtlasSprite;
    }

    getPreviewSprite(rotationVariant: CableRotationVariant) {
        return Loader.getSprite(cableSprites[rotationVariant]);
    }

    getBlueprintSprite(rotationVariant: CableRotationVariant) {
        return this.getPreviewSprite(rotationVariant);
    }

    getLayer(): Layer {
        return "wires";
    }

    getHasDirectionLockAvailable() {
        return true;
    }

    getPlacementSound() {
        return SOUNDS.placeBelt;
    }

    getStayInPlacementMode() {
        return true;
    }

    getIsReplaceable() {
        return true;
    }

    setupEntityComponents(entity: Entity) {
        const staticComp = entity.components.StaticMapEntity;
        if (staticComp == null) {
            entity.addComponent(new CableComponent({ [D.top]: true, [D.right]: false, [D.bottom]: true, [D.left]: false }));
            return;
        }
        entity.addComponent(new CableComponent(connectionsFromRotations({
            rotation: staticComp.rotation as Rotation,
            rotationVariant: staticComp.getRotationVariant(),
        })));
    }

    getSpecialOverlayRenderMatrix(rotation: number, rotationVariant: number) {
        return cableOverlayMatrices[rotationVariant as CableRotationVariant][rotation];
    }

    computeOptimalDirectionAndRotationVariantAtTile({ root, tile }: { root: GameRoot; tile: Vector }) {
        const entity = root.map.getLayerContentXY(tile.x, tile.y, "wires");
        if (entity == null || entity.components.Cable == null) {
            return { rotation: 0, rotationVariant: CRV.dot };
        }
        const staticComp = entity.components.StaticMapEntity!;
        return { rotation: staticComp.rotation, rotationVariant: staticComp.getRotationVariant() };
    }
}

export class HUDCableInfo extends BaseHUDPart {
    initialize() {}

    drawOverlays(parameters: DrawParameters) {
        if (this.root.currentLayer !== "wires") {
            return;
        }
        const mousePos = this.root.app.mousePosition;
        if (mousePos == null) {
            return;
        }
        const worldPos = this.root.camera.screenToWorld(mousePos);
        const tile = worldPos.toTileSpace();
        const entity = this.root.map.getLayerContentXY(tile.x, tile.y, "wires");
        if (entity == null || entity.components.Cable == null) {
            return;
        }
        if (
            !this.root.camera.getIsMapOverlayActive() &&
            !this.root.logic.getIsEntityIntersectedWithMatrix(entity, worldPos)
        ) {
            return;
        }

        const charge = (this.root.systemMgr.systems as Systems).circuit.getCharge(tile);
        const text = `${(charge / edgeConfig.capacitance).toFixed(2)}V`;
        const ctx = parameters.context;
        ctx.save();
        ctx.font = "60px 'GameFont'";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "white";
        ctx.fillText(text, mousePos.x + 20, mousePos.y - 20);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "gray";
        ctx.strokeText(text, mousePos.x + 20, mousePos.y - 20);
        ctx.restore();
    }
}
