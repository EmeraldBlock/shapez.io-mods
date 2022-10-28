import url from "url";
import path from "path";
import process from "process";
import fs from "fs/promises";

import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

import config from "./config.js";

const SRC = "./src/";
const BUILD = "./build/";

const ENTRYS = ["index.ts", "index.js"];
const META = "meta.js";

const FAKE_IMPORTS = {
    loader: "string-replace-loader",
    /** @type {import("string-replace-loader").Options} */
    options: {
        search: /import\s*\{([^}]*)\}\s*from\s*["']shapez.io\/[^"']*["']\s*;/gu,
        replace: (_, imports) => `const {${imports.replaceAll(/([^{,\s]\s*)\sas(\s+[^\s,}])/gu, "$1:$2")}} = window.shapez;`,
    },
}

process.chdir(path.dirname(url.fileURLToPath(import.meta.url)));

export default async (env) => {
    const { mod } = env;
    const mods = (mod === undefined)
        ? (await fs.readdir(SRC, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)
        : [mod];
    
    const entry = Object.fromEntries(await Promise.all(mods.map(async (name) => {
        const files = await fs.readdir(path.resolve(SRC, name));
        const file = ENTRYS.find((val) => files.includes(val));
        if (file === undefined) throw new Error(`Mod ${name} is missing an entry point!`);
        return [name, path.resolve(SRC, name, file)];
    })));
    
    const banners = Object.fromEntries(await Promise.all(mods.map(async (name) => {
        const { id = "???", version = "???" } = (await import(url.pathToFileURL(path.resolve(SRC, name, META))).catch(() => undefined))?.default ?? {};
        return [name, `${id} version ${version}
    source at https://github.com/EmeraldBlock/shapez.io-mods`];
    })));

    /** @type {webpack.Configuration} */
    return ({
        entry,
        output: {
            path: path.resolve(process.cwd(), BUILD),
            filename: "[name].js",
            clean: {
                dry: true,
            },
        },
        mode: "production",
        resolve: {
            extensions: [".ts", "..."],
            alias: {
                "shapez.io": path.resolve(config.shapezDir, "src/css"),
            },
        },
        module: {
            rules: [
                {
                    test: /.ts$/,
                    use: [
                        FAKE_IMPORTS,
                        {
                            loader: "ts-loader",
                            options: {
                                transpileOnly: true,
                            },
                        },
                    ],
                },
                {
                    test: /.js$/,
                    use: FAKE_IMPORTS,
                },
                {
                    test: /.scss$/,
                    use: {
                        loader: "sass-loader",
                        options: {
                            sassOptions: {
                                quietDeps: true,
                            },
                        },
                    },
                    type: "asset/source",
                },
                {
                    test: /.webp$/,
                    type: "asset/inline",
                },
            ],
        },
        optimization: {
            minimizer: [new TerserPlugin({ extractComments: false })],
        },
        plugins: [
            new webpack.BannerPlugin((data) => banners[data.chunk.name]),
        ],
    });
};
