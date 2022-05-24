import url from "url";
import path from "path";
import process from "process";
import fs from "fs/promises";

import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

const SRC = "./src/";
const BUILD = "./build/";

const ENTRYS = ["index.ts", "index.js"];
const META = "meta.js";

process.chdir(path.dirname(url.fileURLToPath(import.meta.url)));

const mods = (await fs.readdir(SRC, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);

const entry = Object.fromEntries(await Promise.all(mods.map(async (name) => {
    const files = await fs.readdir(path.resolve(SRC, name));
    const file = ENTRYS.find((val) => files.includes(val));
    return [name, path.resolve(SRC, name, file)];
})));

const banners = Object.fromEntries(await Promise.all(mods.map(async (name) => {
    const { id = "???", version = "???" } = (await import(url.pathToFileURL(path.resolve(SRC, name, META))).catch(() => undefined))?.default ?? {};
    return [name, `${id} version ${version}
source at https://github.com/EmeraldBlock/shapez.io-mods`];
})));

const fakeImports = {
    loader: "string-replace-loader",
    /** @type {import("string-replace-loader").Options} */
    options: {
        search: /import\s*\{([^}]*)\}\s*from\s*["']shapez.io\/[^"']*["']\s*;/gu,
        replace: (_, imports) => `const {${imports.replaceAll(/([^{,\s]\s*)\sas(\s+[^\s,}])/gu, "$1:$2")}} = window.shapez;`,
    },
}

/** @type {webpack.Configuration} */
export default ({
    entry,
    output: {
        path: path.resolve(process.cwd(), BUILD),
        filename: "[name].js",
        clean: {
            dry: true,
        },
    },
    mode: "production",
    module: {
        rules: [
            {
                test: /.ts$/,
                use: [
                    fakeImports,
                    "ts-loader",
                ],
            },
            {
                test: /.js$/,
                use: fakeImports,
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
