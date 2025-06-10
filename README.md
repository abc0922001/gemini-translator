# Mistral AI 字幕翻譯工具

一個強大的命令列工具，使用 Mistral AI API 將 SRT 字幕檔從英文翻譯成繁體中文。具備智慧上下文感知翻譯和自動內容摘要功能，提升翻譯品質。

## ✨ 功能特色

- 🚀 **快速批次處理**：可配置並發數量的批次字幕翻譯
- 🧠 **上下文感知翻譯**：生成內容摘要以提升翻譯準確度
- 🔧 **自動修復**：自動修復非連續的字幕編號
- 📝 **SRT 格式支援**：完整支援標準 SRT 字幕格式
- ⚡ **平行處理**：最多 5 個並發翻譯任務
- 🎯 **可自訂模型**：支援不同的 Mistral AI 模型
- 📊 **進度追蹤**：即時翻譯進度顯示

## 🚀 快速開始

### 使用 npx（無需安裝）

```bash
npx @willh/mistral-translator --input your-subtitle.srt
```

### 全域安裝

```bash
npm install -g @willh/mistral-translator
```

然後執行：

```bash
mistral-translator --input your-subtitle.srt
```

## 📋 先決條件

### API Key 設定

1. 取得 Mistral AI API Key
2. 設定環境變數：

**Windows (PowerShell):**
```powershell
$env:MISTRAL_API_KEY = "your-api-key-here"
```

**Windows (Command Prompt):**
```cmd
set MISTRAL_API_KEY=your-api-key-here
```

**macOS/Linux:**
```bash
export MISTRAL_API_KEY="your-api-key-here"
```

### Node.js 需求

確保已安裝 Node.js 14+，檢查版本：

```bash
node --version
```

## 📖 使用方法

### 基本翻譯

將字幕檔翻譯成繁體中文：

```bash
npx @willh/mistral-translator --input movie.srt
```

這會在同一目錄下建立 `movie.zh.srt`。

### 進階選項

```bash
# 自訂輸出檔名
npx @willh/mistral-translator --input movie.srt --output movie-chinese.srt

# 使用特定 Mistral 模型
npx @willh/mistral-translator --input movie.srt --model mistral-large-latest

# 自動修復字幕編號問題
npx @willh/mistral-translator --input movie.srt --autofix

# 組合選項
npx @willh/mistral-translator -i movie.srt -o output.srt -m mistral-large-latest --autofix
```

## ⚙️ 命令列選項

| 選項 | 別名 | 描述 | 預設值 |
|------|------|------|--------|
| `--input` | `-i` | 輸入 SRT 檔案路徑（必需） | - |
| `--output` | `-o` | 輸出 SRT 檔案路徑 | `<input>.zh.srt` |
| `--model` | `-m` | 使用的 Mistral 模型 | `mistral-small-latest` |
| `--autofix` | - | 自動修復非連續字幕編號 | `false` |
| `--help` | `-h` | 顯示說明資訊 | - |

## 🔄 工作流程

1. **內容分析**：工具首先分析整個字幕內容以生成摘要
2. **上下文生成**：建立包含主題、術語、角色和風格的上下文摘要
3. **批次處理**：將字幕分成 10 條一批進行高效處理
4. **平行翻譯**：使用 Mistral AI 同時處理最多 5 個批次
5. **品質保證**：驗證翻譯結果和時間戳序列
6. **輸出生成**：建立最終翻譯的 SRT 檔案

## 🤖 支援的模型

- `mistral-small-latest` (預設 - 快速且經濟)
- `mistral-large-latest` (最高品質)
- `mistral-medium-latest` (平衡效能與品質)
- 其他可用的 Mistral 模型

## 🛠️ 錯誤處理

工具包含強健的錯誤處理機制：

- **缺少 API Key**：清楚的設定環境變數指示
- **無效 SRT 格式**：詳細的格式問題錯誤訊息
- **非連續編號**：自動修復選項或手動修正指導
- **API 錯誤**：重試邏輯和詳細錯誤報告
- **網路問題**：優雅處理連線問題

## 📝 使用範例

### 基本使用

```bash
npx @willh/mistral-translator --input "My Movie.srt"
# 輸出: "My Movie.zh.srt"
```

### 自動修復編號

```bash
npx @willh/mistral-translator -i "Series S01E01.srt" --autofix
# 自動修復編號問題並翻譯
```

### 使用高品質模型

```bash
npx @willh/mistral-translator -i "Documentary.srt" -m mistral-large-latest -o "Documentary-TC.srt"
# 使用最先進的模型以獲得更好的準確度
```

## 🔧 故障排除

### 常見錯誤訊息

**"請設定 MISTRAL_API_KEY 環境變數"**
- 解決方案：按照先決條件部分設定 Mistral AI API key

**"字幕序號不連續"**
- 解決方案：使用 `--autofix` 標誌自動修正編號

**"翻譯數量與原始字幕數量不符"**
- 解決方案：檢查網路連線和 API key 有效性

**"找不到輸入檔案"**
- 解決方案：驗證檔案路徑並確保 SRT 檔案存在

### 效能優化建議

- 使用 `mistral-small-latest` 進行快速處理
- 使用 `mistral-large-latest` 進行高品質翻譯
- 確保穩定的網路連線以進行批次處理
- 大型檔案（1000+ 字幕）可能需要數分鐘處理時間

## 📁 專案結構

```
mistral-translator/
├── main.js              # 主要應用程式邏輯
├── package.json         # 套件配置
└── README.md           # 此檔案
```

## 🚀 開發設定

- 複製倉庫
- 安裝相依套件：
  ```bash
  npm install
  ```
- 設定你的 API key
- 本地測試：
  ```bash
  node main.js --input test.srt
  ```

## 📦 相依套件

- **axios**: Mistral AI API 呼叫的 HTTP 客戶端
- **yargs**: 命令列參數解析
- **@supercharge/promise-pool**: 並發處理控制
- **fs/path**: 檔案系統操作（Node.js 內建）

## 🌐 API 整合

工具使用 Mistral AI API，具備以下特性：

- 結構化 JSON 回應格式
- 上下文感知提示
- 批次處理優化
- 錯誤恢復機制

### 效能配置

- **批次大小**：每次 API 呼叫 10 條字幕
- **並發數**：最多 5 個並發請求
- **速率限制**：由 promise pool 自動處理
- **記憶體使用**：大型檔案的高效串流處理

## 📄 授權條款

MIT License - 詳見 LICENSE 檔案。

## 🤝 貢獻

- Fork 倉庫
- 建立功能分支
- 進行變更
- 如適用，新增測試
- 提交 pull request

## 📞 支援

如有問題和疑問：

- GitHub Issues: [Repository Issues](https://github.com/yourusername/mistral-translator/issues)
- Email: [您的電子郵件]

## 📈 版本歷史

### v1.0.0
- 初版發布
- 基本 SRT 翻譯功能
- 上下文感知翻譯
- 批次處理與並發
- 字幕編號自動修復
- NPX 支援

---

使用 ❤️ 和 Mistral AI 製作