declare module "*.scss" {
    const css: string;
    export default css;
}

declare module "*.webp" {
    const url: string;
    export default url;
}

type Meta = {
    website: string,
    author: string,
    name: string,
    version: string,
    id: string,
    description: string,
    minimumGameVersion: string,
    doesNotAffectSavegame: boolean,

    extra: {
        authors: Array<{
            name: string,
            icon: string,
        }>,
        changelog: {
            [version: string]: Array<string>,
        },
        source: string,
        readme: string,
        icon?: string,
    },
};
