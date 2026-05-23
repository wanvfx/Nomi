import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transcodeWebmToMp4 } from "./ffmpegRunner";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-export-test-"));
  tempRoots.push(dir);
  return dir;
}

describe("transcodeWebmToMp4", () => {
  it("writes input webm to a temp file and asks ffmpeg to create a playable 1080p mp4", async () => {
    const projectDir = makeTempDir();
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await transcodeWebmToMp4({
      projectDir,
      inputBytes: Buffer.from("webm-bytes"),
      outputName: "My Export!",
      ffmpegPath: "/usr/local/bin/ffmpeg",
      runProcess: async (command, args) => {
        calls.push({ command, args });
        const outputPath = args[args.length - 1];
        fs.writeFileSync(outputPath, "mp4-bytes");
        return { code: 0, stderr: "" };
      },
    });

    expect(result.relativePath).toMatch(/^exports\/My-Export-\d+\.mp4$/);
    expect(result.absolutePath).toBe(path.join(projectDir, result.relativePath));
    expect(fs.readFileSync(result.absolutePath, "utf8")).toBe("mp4-bytes");
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("/usr/local/bin/ffmpeg");
    expect(calls[0].args).toContain("-c:v");
    expect(calls[0].args).toContain("libx264");
    expect(calls[0].args).toContain("-r");
    expect(calls[0].args).toContain("30");
    const vfIndex = calls[0].args.indexOf("-vf");
    expect(calls[0].args[vfIndex + 1]).toContain("scale=1920:1080:force_original_aspect_ratio=decrease");
    expect(fs.existsSync(path.join(projectDir, "cache", "exports"))).toBe(false);
  });

  it("surfaces ffmpeg stderr when conversion fails", async () => {
    const projectDir = makeTempDir();
    await expect(transcodeWebmToMp4({
      projectDir,
      inputBytes: Buffer.from("webm-bytes"),
      ffmpegPath: "/usr/local/bin/ffmpeg",
      runProcess: async () => ({ code: 1, stderr: "Unknown encoder libx264" }),
    })).rejects.toThrow("Unknown encoder libx264");
  });

  it("requires an ffmpeg binary", async () => {
    const projectDir = makeTempDir();
    await expect(transcodeWebmToMp4({
      projectDir,
      inputBytes: Buffer.from("webm-bytes"),
      ffmpegPath: "",
      runProcess: vi.fn(),
    })).rejects.toThrow("缺少 FFmpeg");
  });
});
