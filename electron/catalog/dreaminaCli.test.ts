// buildDreaminaEnv 回归：即梦是国内服务，子进程必须强制直连——抹掉一切出站代理变量 + NO_PROXY=*。
// 防的是「有人日后清理 spawn env 时，把 ...process.env 原样透传回去」这种静默复发（青阳的梯子 bug 根因）。
import { describe, it, expect } from "vitest";
import { buildDreaminaEnv } from "./dreaminaCli";

describe("dreamina 子进程强制直连（buildDreaminaEnv）", () => {
  const proxied: NodeJS.ProcessEnv = {
    HTTP_PROXY: "http://127.0.0.1:7897",
    http_proxy: "http://127.0.0.1:7897",
    HTTPS_PROXY: "http://127.0.0.1:7897",
    https_proxy: "http://127.0.0.1:7897",
    ALL_PROXY: "socks5://127.0.0.1:7897",
    all_proxy: "socks5://127.0.0.1:7897",
    NO_PROXY: "localhost,127.0.0.1",
    PATH: "/usr/bin:/bin",
    HOME: "/Users/tester",
  };

  it("六个出站代理变量（大小写）全被抹掉", () => {
    const env = buildDreaminaEnv(proxied);
    for (const key of ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"]) {
      expect(env[key], `${key} 应被删除`).toBeUndefined();
    }
  });

  it("NO_PROXY / no_proxy 被强制成 *（兜底：代理若从别处冒出来也绕开即梦）", () => {
    const env = buildDreaminaEnv(proxied);
    expect(env.NO_PROXY).toBe("*");
    expect(env.no_proxy).toBe("*");
  });

  it("无关变量保留；原 PATH 并入且补上 ~/.local/bin 兜底目录", () => {
    const env = buildDreaminaEnv(proxied);
    expect(env.HOME).toBe("/Users/tester");        // 无关变量不动
    expect(env.PATH).toContain("/usr/bin");         // 原 PATH 保留
    expect(env.PATH).toContain(".local/bin");       // GUI Electron 极简 PATH 的兜底
  });

  it("不改传入对象（返回新 env，不污染 process.env）", () => {
    const snapshot = { ...proxied };
    buildDreaminaEnv(proxied);
    expect(proxied).toEqual(snapshot);
  });
});
