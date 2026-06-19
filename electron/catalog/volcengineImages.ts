import type { HttpOperation, ProfileKind } from "./types";

// 火山 Seedream 图片传输配方（单源）。形状 100% 来自真实 API 验证（见 volcengineVendor.ts）。
// **同步**族：create 响应即结果（data[0].url），无 task_id / 无 query / 无 statusMapping
// ——runtime 见 response_mapping.image_url 有值即判 succeeded（同 apimart 音频同步族）。

const CREATE_HEADERS = { Authorization: "Bearer {{user_api_key}}", "Content-Type": "application/json" };

function seedreamCreateOp(): HttpOperation {
  return {
    method: "POST",
    path: "/api/v3/images/generations",
    headers: CREATE_HEADERS,
    // watermark:false 去掉火山默认的「AI生成」角标（真实验证：默认带角标，false 后干净）——创作工具默认要干净图。
    body: { model: "{{model.modelKey}}", prompt: "{{request.prompt}}", size: "{{request.params.size}}", watermark: false },
    response_mapping: { image_url: "data.0.url" },
  };
}

export type VolcengineImageModel = {
  modelKey: string;
  labelZh: string;
  archetypeId: string;
  mappings: { id: string; taskKind: ProfileKind; name: string; create: HttpOperation }[];
};

// v1 只接已开通且真实出图验证的 Seedream 5.0。其余 Seedream（4.5/4.0）与 Seedance 视频待用户开通。
export const VOLCENGINE_IMAGE_MODELS: VolcengineImageModel[] = [
  {
    modelKey: "doubao-seedream-5-0-260128",
    labelZh: "Seedream 5.0",
    archetypeId: "volcengine-seedream",
    mappings: [
      {
        id: "seed-volcengine-seedream-5-text_to_image",
        taskKind: "text_to_image",
        name: "Seedream 5.0 · 文生图",
        create: seedreamCreateOp(),
      },
    ],
  },
];
