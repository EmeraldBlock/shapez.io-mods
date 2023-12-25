import type { DrawParameters, GameRoot } from "shapez.io/core/draw_parameters";
import type { MapChunkView } from "shapez.io/game/map_chunk_view";
import { createLogger } from "shapez.io/core/logging";
import { Vector } from "shapez.io/core/vector";
import { Component } from "shapez.io/game/component";
import { Entity } from "shapez.io/game/entity";
import { GameSystemWithFilter } from "shapez.io/game/game_system_with_filter";
import { types } from "shapez.io/savegame/serialization";
import { globalConfig } from "shapez.io/core/config";

declare module "shapez.io/game/entity_components.d.ts" {
    interface EntityComponentStorage {
        Circuit?: CircuitComponent;
    }
}

export const edgeConfig = {
    capacitance: .01,
    inductance: .09,
    resistance: .05,
    maxDt: .02,
};

export type VoltageFunction = (edge: Record<string, number>, dt: number) => number;

const voltageFunctions: Record<string, VoltageFunction> = {};

export function registerCircuitData(type: string, voltageFunction: VoltageFunction) {
    voltageFunctions[type] = voltageFunction;
}
registerCircuitData("cable", () => 0);

export type CircuitData = {
    input: Vector,
    output: Vector,
    type: string,
    data: Record<string, number>,
};

export class CircuitComponent extends Component {
    public input: Vector;
    public output: Vector;
    public type: string;
    public data: Record<string, number>;
    
    static getId() {
        return "Circuit";
    }

    static getSchema() {
        return {
            input: types.vector,
            output: types.vector,
            type: types.string,
            data: types.keyValueMap(types.float),
        };
    }

    constructor({ input, output, type, data }: CircuitData) {
        super();

        this.input = input;
        this.output = output;
        this.type = type;
        this.data = data;
    }
}

export type CircuitSerialized = {
    nodes: [number, [number, number][]][],
};

const logger = createLogger("systems/circuit");

export class CircuitSystem extends GameSystemWithFilter {
    public nodes: Map<number, Map<number, { charge: number, refs: number }>>;
    public edges: Set<CircuitData>;
    public edgeFromComp: WeakMap<CircuitComponent, CircuitData>;

    constructor(root: GameRoot) {
        super(root, [CircuitComponent]);

        this.nodes = new Map();
        this.edges = new Set();
        this.edgeFromComp = new WeakMap();

        this.root.signals.entityAdded.add(this.onEntityAdded, this);
        this.root.signals.entityDestroyed.add(this.onEntityDestroyed, this);
        this.root.signals.gameRestored.add(this.onGameRestored, this);
    }

    serialize(): CircuitSerialized {
        return {
            nodes: [...this.nodes].map(([x, row]) => [x, [...row].map(([y, node]) => [y, node.charge])]),
        };
    }

    deserialize(data: CircuitSerialized) {
        // `refs = 0` is unstable and is updated by `this.onGameRestored()`.
        this.nodes = new Map(data.nodes.map(([x, row]) => [x, new Map(row.map(([y, charge]) => [y, { charge, refs: 0 }]))] as const));
    }

    /**
     * Verifies nodes are correct
     * and restores `this.edges` and `this.edgeFromComp`,
     * as well as the `refs` count of each node.
     */
    onGameRestored() {
        enum Presence {
            none = 0b00,
            serialized = 0b01,
            entity = 0b10,
            both = 0b11,
        }
        const nodes: Map<string, Presence> = new Map();
        const update = (key: string, presence: Presence) => {
            nodes.set(key, (nodes.get(key) ?? Presence.none) | presence);
        };
        // check nodes first since they will be auto-created by `this.refCharge()`
        for (const [x, row] of this.nodes) {
            for (const [y] of row) {
                update(new Vector(x, y).toString(), Presence.serialized);
            }
        }
        for (const entity of this.allEntities) {
            const circuitComp = entity.components.Circuit!;
            const staticComp = entity.components.StaticMapEntity!;
    
            const edge = {
                input: staticComp.localTileToWorld(circuitComp.input),
                output: staticComp.localTileToWorld(circuitComp.output),
                type: circuitComp.type,
                data: circuitComp.data,
            };
            this.edges.add(edge);
            this.edgeFromComp.set(circuitComp, edge);

            this.refCharge(edge.input, 1);
            this.refCharge(edge.output, 1);
            update(edge.input.toString(), Presence.entity);
            update(edge.output.toString(), Presence.entity);
        }
        for (const entity of (this.root.systemMgr.systems as Systems).cable.allEntities) {
            const tile = entity.components.StaticMapEntity!.origin;
            this.refCharge(tile, 1);
            update(tile.toString(), Presence.entity);
        }
        for (const [key, presence] of nodes) {
            const [x, y] = key.split(",").map(s => parseInt(s));
            switch (presence) {
                case Presence.serialized: {
                    logger.error(`Circuit node at (${key}) has no building`);
                    this.refCharge(new Vector(x, y), 0);
                    break;
                }
                case Presence.entity: {
                    logger.error(`Building missing circuit node at (${key})`);
                    // no need to do anything since node was auto-created by `this.refCharge()`
                    break;
                }
                case Presence.both: // obviously ok
                    break;
                case Presence.none: // there's a problem with this method
                default:
                    assertAlways(false);
            }
        }
    }

    onEntityAdded(entity: Entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (entity.components.Cable != null) {
            this.refCharge(entity.components.StaticMapEntity!.origin, 1);
            return;
        }

        const circuitComp = entity.components.Circuit;
        if (circuitComp == null) {
            return;
        }
        const staticComp = entity.components.StaticMapEntity!;

        const edge = {
            input: staticComp.localTileToWorld(circuitComp.input),
            output: staticComp.localTileToWorld(circuitComp.output),
            type: circuitComp.type,
            data: circuitComp.data,
        };
        this.refCharge(edge.input, 1);
        this.refCharge(edge.output, 1);
        this.edges.add(edge);
        this.edgeFromComp.set(circuitComp, edge);
    }

    onEntityDestroyed(entity: Entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (entity.components.Cable != null) {
            this.refCharge(entity.components.StaticMapEntity!.origin, -1);
            return;
        }

        const circuitComp = entity.components.Circuit;
        if (circuitComp == null) {
            return;
        }

        const edge = this.edgeFromComp.get(circuitComp)!;
        this.refCharge(edge.input, -1);
        this.refCharge(edge.output, -1);
        this.edges.delete(edge);
    }

    /**
     * Works with `delta = 0` (deletes unstable entry).
     */
    refCharge(tile: Vector, delta: number) {
        let row = this.nodes.get(tile.x);
        if (row == null) {
            if (delta < 0) {
                logger.error(`Tried to decrement refs of nonexistent node (${tile})`);
                return;
            }
            row = new Map();
            this.nodes.set(tile.x, row);
        }
        let node = row.get(tile.y);
        if (node == null) {
            if (delta < 0) {
                logger.error(`Tried to decrement refs of nonexistent node (${tile})`);
                return;
            }
            node = { charge: 0, refs: delta };
            row.set(tile.y, node);
            return;
        }
        node.refs += delta;
        if (node.refs > 0) {
            return;
        }
        if (node.refs < 0) {
            logger.error(`Tried to decrement refs of node (${tile}) to negative number`);
        }
        row.delete(tile.y);
        if (row.size > 0) {
            return;
        }
        this.nodes.delete(tile.x);
    }

    getCharge(tile: Vector) {
        const row = this.nodes.get(tile.x);
        if (row == null) {
            logger.error(`Tried to get charge of nonexistent node (${tile})`);
            return 0;
        }
        const node = row.get(tile.y);
        if (node == null) {
            logger.error(`Tried to get charge of nonexistent node (${tile})`);
            return 0;
        }
        return node.charge;
    }

    addCharge(tile: Vector, dq: number) {
        const row = this.nodes.get(tile.x);
        if (row == null) {
            logger.error(`Tried to add charge to nonexistent node (${tile})`);
            return;
        }
        const node = row.get(tile.y);
        if (node == null) {
            logger.error(`Tried to add charge to nonexistent node (${tile})`);
            return;
        }
        node.charge += dq;
    }

    allEdges() {
        const self = this;
        return {
            *[Symbol.iterator]() {
                yield* self.edges;
                yield* (self.root.systemMgr.systems as Systems).cable.edges;
            }
        };
    }

    update() {
        if (!this.root.gameInitialized) {
            return;
        }

        let dt = this.root.dynamicTickrate.deltaSeconds!;
        if (dt > edgeConfig.maxDt) {
            // logger.warn(`dt = ${dt} exceeded maxDt of ${edgeConfig.maxDt}, clamping`);
            dt = edgeConfig.maxDt;
        }
        for (const edge of this.allEdges()) {
            const charge = this.getCharge(edge.output) - this.getCharge(edge.input);
            const voltage = voltageFunctions[edge.type](edge.data, dt);
            edge.data.current += (-charge / edgeConfig.capacitance - edge.data.current * edgeConfig.resistance + voltage) / edgeConfig.inductance * dt;
        }
        for (const edge of this.allEdges()) {
            this.addCharge(edge.input, -edge.data.current * dt);
            this.addCharge(edge.output, edge.data.current * dt);
        }
    }

    drawNode(parameters: DrawParameters, tile: Vector, voltage: number) {
        const ctx = parameters.context;
        ctx.save();
        ctx.translate(
            tile.x * globalConfig.tileSize + globalConfig.halfTileSize,
            tile.y * globalConfig.tileSize + globalConfig.halfTileSize,
        );
        ctx.scale(globalConfig.tileSize / 8, globalConfig.tileSize / 8);
        const positiveColors = [20, 40, 60, 80, 100].map(sat => `hsl(120deg ${sat}% 50%)`);
        const negativeColors = [20, 40, 60, 80, 100].map(sat => `hsl(0deg ${sat}% 50%)`);
        const colors = voltage >= 0 ? positiveColors : negativeColors;
        const magnitude = Math.abs(voltage);
        ctx.strokeStyle = "black";
        ctx.lineWidth = .1;
        ctx.fillStyle = `hsl(0 0% 50%)`;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.strokeRect(-1, -1, 2, 2);
        for (let order = 5 - 1; order >= 0; --order) {
            const value = magnitude / 10 ** (order - 1);
            const height = value % 1;
            const shift = Math.log10(value) + 1;
            const to = Math.min(1 - 2 / 3 * shift, 1);
            const from = Math.max(1 - 2 / 3 * (shift + 1), -1);
            if (to <= -1 || 1 <= from) {
                continue;
            }
            if (to === 1) {
                ctx.fillStyle = `hsl(0 0% 25%)`;
                ctx.fillRect(from, -1, to - from, 2);
            }
            ctx.fillStyle = colors[order] ?? `hsl(0 0% 50%)`;
            ctx.fillRect(from, 1 - height * 2, to - from, height * 2);
            ctx.strokeRect(from, 1 - height * 2, to - from, height * 2);
        }
        ctx.restore();
    }

    drawChunk(parameters: DrawParameters, chunk: MapChunkView) {
        const { tileX: x, tileY: y } = chunk;
        for (let dx = 0; dx < globalConfig.mapChunkSize; ++dx) {
            const row = this.nodes.get(x + dx);
            if (row == null) continue;
            for (let dy = 0; dy < globalConfig.mapChunkSize; ++dy) {
                const node = row.get(y + dy);
                if (node == null) continue;
                this.drawNode(parameters, new Vector(x + dx, y + dy), node.charge / edgeConfig.capacitance);
            }
        }
    }
}
