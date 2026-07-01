import { describe, it, expect } from "vitest";
import { NEWAPI_IMAGE_EDIT_OP, NEWAPI_IMAGE_CREATE_OP, NEWAPI_IMAGE_PARAM_MAP } from "./newapiTransport";
import { taskTemplateParams } from "./taskParams";
import { applyParamMap } from "./paramTranslate";
import { renderTemplateValue, buildTemplateContext } from "../ai/requestPipeline";

type AnyRec = Record<string, unknown>;

function renderBody(op: typeof NEWAPI_IMAGE_EDIT_OP, prompt: string, params: AnyRec): AnyRec {
  const ctx = buildTemplateContext({
    request: { prompt },
    params,
    model: {},
    modelKey: "gemini-2.5-flash-image",
    apiKey: "sk-test",
  });
  return renderTemplateValue(op.body, ctx) as AnyRec;
}

describe("通用中转 image_edit（chat/completions 多模态）请求装配", () => {
  it("多张参考图 → content 扁平 = [text 项, image_url 项×N]", () => {
    const params = taskTemplateParams({ extras: { referenceImages: ["https://x/a.png", "https://x/b.png"] } });
    const body = renderBody(NEWAPI_IMAGE_EDIT_OP, "把背景换成夜晚", params);
    expect(body.model).toBe("gemini-2.5-flash-image");
    expect(body.stream).toBe(false);
    const content = (body.messages as AnyRec[])[0].content;
    expect(content).toEqual([
      { type: "text", text: "把背景换成夜晚" },
      { type: "image_url", image_url: { url: "https://x/a.png" } },
      { type: "image_url", image_url: { url: "https://x/b.png" } },
    ]);
  });

  it("无参考图 → content 只剩 text 项（无空 image_url 残留）", () => {
    const params = taskTemplateParams({ extras: {} });
    const body = renderBody(NEWAPI_IMAGE_EDIT_OP, "画只猫", params);
    expect((body.messages as AnyRec[])[0].content).toEqual([{ type: "text", text: "画只猫" }]);
  });
});

describe("通用中转 text_to_image 分辨率派生（治「只能出 1K」）", () => {
  const derive = (aspect: string, res: string): unknown => {
    const params = applyParamMap(NEWAPI_IMAGE_PARAM_MAP, taskTemplateParams({ extras: { aspect_ratio: aspect, resolution: res } }));
    const body = renderBody(NEWAPI_IMAGE_CREATE_OP, "一只小猪", params);
    return body.size;
  };
  it("1:1 · 1K → 1024x1024", () => expect(derive("1:1", "1K")).toBe("1024x1024"));
  it("16:9 · 2K → 长边 2048", () => expect(derive("16:9", "2K")).toBe("2048x1152"));
  it("9:16 · 4K → 竖版长边 3840（受像素预算内）", () => {
    const size = derive("9:16", "4K") as string;
    const [w, h] = size.split("x").map(Number);
    expect(h).toBeGreaterThan(w); // 竖版
    expect(h).toBeGreaterThanOrEqual(2048); // 确实比 1K/2K 大
  });
  it("body 不再钉死 1024：2K/4K 能选出", () => {
    expect(derive("1:1", "2K")).not.toBe("1024x1024");
  });
});
