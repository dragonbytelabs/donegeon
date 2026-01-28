import { DonegeonConfig } from "../model/types";

function raf() {
    return new Promise<void>((r) => requestAnimationFrame(() => r()));
}

function mulberry32(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickWeightedIndex(rng: () => number, weights: number[]) {
    const total = weights.reduce((a, x) => a + x, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return weights.length - 1;
}

async function loadConfig(): Promise<DonegeonConfig> {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error(`GET /api/config failed: ${res.status}`);
    return (await res.json()) as DonegeonConfig;
}

export { raf, mulberry32, pickWeightedIndex, loadConfig };