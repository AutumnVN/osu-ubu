import { existsSync, readFileSync, writeFileSync } from 'fs';

import { Beatmap, parseOsuDb, RankedStatus } from './osudb';

(async function () {
    if (!existsSync('.env')) {
        writeFileSync('.env', 'OSU_API_KEY=\nOSU_FOLDER_PATH=\n');
        return console.error('.env file not found, created one, please set OSU_API_KEY in .env file');
    }

    process.loadEnvFile();

    const { OSU_API_KEY, OSU_FOLDER_PATH, LOCALAPPDATA } = process.env;

    let osuPath = `${LOCALAPPDATA}\\osu!`;
    if (!existsSync(`${osuPath}\\osu!.db`)) {
        if (!OSU_FOLDER_PATH) return console.error('Default osu! folder not found, please set OSU_FOLDER_PATH in .env file');

        osuPath = OSU_FOLDER_PATH;
        if (!existsSync(`${osuPath}\\osu!.db`)) return console.error('osu!.db not found in OSU_FOLDER_PATH');
    }

    if (!OSU_API_KEY) return console.error('Please set OSU_API_KEY in .env file');

    const { beatmaps } = parseOsuDb(readFileSync(`${osuPath}\\osu!.db`));
    const unrankedBeatmaps = beatmaps.filter(b => ![RankedStatus.Unsubmitted, RankedStatus.Ranked, RankedStatus.Approved, RankedStatus.Loved].includes(b.rankedStatus));

    console.log(`Unranked beatmaps: ${unrankedBeatmaps.length}`);
    if (unrankedBeatmaps.length === 0) return;

    const outdatedBeatmaps: Beatmap[] = [];
    for (const beatmap of unrankedBeatmaps) {
        const res = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${OSU_API_KEY}&h=${beatmap.md5}`);
        if (!res.ok) return console.error('Invalid OSU_API_KEY');

        const text = await res.text();
        if (text === '[]') outdatedBeatmaps.push(beatmap);
    }

    console.log(`Outdated beatmaps: ${outdatedBeatmaps.length}`);
    if (outdatedBeatmaps.length === 0) return;

    for (let i = 0; i < outdatedBeatmaps.length; i++) {
        const beatmap = outdatedBeatmaps[i];
        console.log(`[${i + 1}/${outdatedBeatmaps.length}] Downloading ${beatmap.creatorName} | ${beatmap.artistName} - ${beatmap.songTitle} [${beatmap.difficulty}]`);
        const res = await fetch(`https://osu.ppy.sh/osu/${beatmap.beatmapId}`);
        if (!res.ok) {
            process.stdout.write('\u001b[1A\u001b[2K');
            console.error(`[${i + 1}/${outdatedBeatmaps.length}] Failed to download ${beatmap.creatorName} | ${beatmap.artistName} - ${beatmap.songTitle} [${beatmap.difficulty}]`);
            continue;
        }

        const text = await res.text();
        const osuFilePath = `${osuPath}\\Songs\\${beatmap.folderName}\\${beatmap.osuFileName}`;
        writeFileSync(osuFilePath, text);
        process.stdout.write('\u001b[1A\u001b[2K');
        console.log(`[${i + 1}/${outdatedBeatmaps.length}] Updated ${beatmap.creatorName} | ${beatmap.artistName} - ${beatmap.songTitle} [${beatmap.difficulty}]`);
    }
    console.log('Done.');
})().finally(() => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
});
