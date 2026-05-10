/**
 * 一键套用模板：仅填充表单，**不是**产品默认提供商。
 * 实际 baseUrl / 模型名以你本机服务为准。
 */
export type ConnectionTemplate = {
  id: string;
  label: string;
  baseUrl: string;
  /** 填入 model 输入框的示例，用户应改成自己 pull 的模型名 */
  modelPlaceholder: string;
  hint?: string;
};

export const CONNECTION_TEMPLATES: ConnectionTemplate[] = [
  {
    id: "ollama",
    label: "Ollama（本机）",
    baseUrl: "http://127.0.0.1:11434/v1",
    modelPlaceholder: "",
    hint: "点选后会自动扫描本机已安装模型；也可再点「扫描模型列表」。",
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    modelPlaceholder: "",
    hint: "点选后会尝试读取 /v1/models；端口以 Server 设置为准。",
  },
  {
    id: "llamacpp",
    label: "llama.cpp server",
    baseUrl: "http://127.0.0.1:8080/v1",
    modelPlaceholder: "local",
    hint: "若启动参数不同，请改端口与路径。",
  },
  {
    id: "vllm",
    label: "vLLM OpenAI API",
    baseUrl: "http://127.0.0.1:8000/v1",
    modelPlaceholder: "填服务启动时的模型名",
  },
  {
    id: "generic",
    label: "自定义兼容端点",
    baseUrl: "",
    modelPlaceholder: "",
    hint: "自行填写 Base URL（含 /v1）与模型名。",
  },
];
