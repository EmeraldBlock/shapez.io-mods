import url from "url";
import path from "path";
import process from "process";
import fs from "fs/promises";

import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

process.chdir(path.dirname(url.fileURLToPath(import.meta.url)));

const mods = (await fs.readdir("./src/", { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);

const entry = Object.fromEntries(mods.map((name) => [name, path.resolve("./src/", name, "./index.js")]));

const banners = Object.fromEntries(await Promise.all(mods.map(async (name) => {
    const { id = "???", version = "???" } = (await import(url.pathToFileURL(path.resolve("./src/", name, "./meta.js"))).catch(() => undefined))?.default ?? {};
    return [name, `${id} version ${version}
source at https://github.com/EmeraldBlock/shapez.io-mods`];
})));

export default {
    entry,
    output: {
        path: path.resolve(process.cwd(), "./build/"),
        filename: "[name].js",
        clean: {
            dry: true,
        },
    },
    mode: "production",
    optimization: {
        minimizer: [new TerserPlugin({ extractComments: false })],
    },
    plugins: [
        new webpack.BannerPlugin((data) => banners[data.chunk.name]),
    ]
};
