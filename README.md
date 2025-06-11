# Mistral AI 字幕翻譯工具

一個功能強大的命令列工具，使用 Mistral AI API 將 SRT、WebVTT、ASS、Markdown 檔案從各種語言翻譯成繁體中文（或其他語言）。具備智慧型上下文感知翻譯和自動內容摘要功能，提升翻譯品質。

## ✨ 主要功能

- 🚀 **快速批次處理**：批次翻譯字幕，可配置並發數量
- 🧠 **上下文感知翻譯**：生成內容摘要以提升翻譯準確性
- 🔧 **自動修復**：自動修復非連續的字幕編號
- 📝 **多格式支援**：完整支援 SRT、WebVTT、ASS、Markdown 格式
- ⚡ **並行處理**：最多支援 20 個並發翻譯任務
- 🎯 **可自訂模型**：支援不同的 Mistral AI 模型
- 📊 **進度追蹤**：即時顯示翻譯進度
- 🎨 **翻譯風格**：支援正式、口語、技術、自然等風格
- 🌐 **多語言支援**：支援各種來源和目標語言
- 📋 **詳細報告**：生成翻譯統計和樣本報告

## 🚀 快速開始

### 直接使用 npx（推薦）

無需安裝，直接使用：

```bash
npx @your-username/mistral-translator --input your-subtitle.srt
```

### 全域安裝

```bash
npm install -g @your-username/mistral-translator
```

然後執行：

```bash
mistral-translator --input your-subtitle.srt
```

## 📋 前置需求

### 1. Node.js 環境

確保已安裝 Node.js 14 或更新版本：

```bash
node --version
```

### 2. 取得 Mistral AI API Key

1. 前往 [Mistral AI Console](https://console.mistral.ai/)
2. 註冊或登入帳戶
3. 建立新的 API Key

### 3. 設定環境變數

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

## 💡 使用方式

### 基本用法

翻譯字幕檔案為繁體中文：

```bash
npx @your-username/mistral-translator --input movie.srt
```

這會在同一目錄建立 `movie.zh.srt`。

### 進階用法

```bash
# 自訂輸出檔名
npx @your-username/mistral-translator --input movie.srt --output movie-chinese.srt

# 使用特定 Mistral 模型
npx @your-username/mistral-translator --input movie.srt --model mistral-large-latest

# 自動修復字幕編號問題
npx @your-username/mistral-translator --input movie.srt --autofix

# 設定翻譯風格
npx @your-username/mistral-translator --input movie.srt --style formal

# 自訂並發數和批次大小
npx @your-username/mistral-translator --input movie.srt --concurrency 3 --batch-size 5

# 翻譯其他語言
npx @your-username/mistral-translator --input movie.srt --from-lang Japanese --to-lang English

# 測試模式（僅分析檔案）
npx @your-username/mistral-translator --input movie.srt --dry-run

# 組合選項
npx @your-username/mistral-translator -i movie.srt -o output.srt -m mistral-large-latest --autofix --style casual
```

## 📚 參數說明

| 參數 | 簡寫 | 說明 | 預設值 |
|------|------|------|--------|
| `--input` | `-i` | 輸入字幕檔案路徑（必需） | - |
| `--output` | `-o` | 輸出字幕檔案路徑 | `<input>.zh.<ext>` |
| `--model` | `-m` | Mistral 模型名稱 | `mistral-small-latest` |
| `--autofix` | - | 自動修復非連續字幕編號 | `false` |
| `--concurrency` | `-c` | 並發處理數量 | `5` |
| `--batch-size` | `-b` | 批次處理大小 | `10` |
| `--from-lang` | `-f` | 來源語言 | `English` |
| `--to-lang` | `-t` | 目標語言 | `繁體中文` |
| `--style` | `-s` | 翻譯風格 | `natural` |
| `--dry-run` | - | 測試模式：僅分析檔案 | `false` |
| `--retry` | - | 翻譯失敗時的重試次數 | `3` |
| `--delay` | - | 請求間隔時間（毫秒） | `1000` |
| `--help` | `-h` | 顯示幫助資訊 | - |

### 翻譯風格選項

- `formal`：正式、專業的表達方式
- `casual`：輕鬆、口語化的表達方式
- `technical`：技術性、準確的表達方式
- `natural`：自然、流暢的表達方式（預設）

### 支援的 Mistral 模型

- `mistral-small-latest`：最快速，適合一般用途（預設）
- `mistral-medium-latest`：平衡速度和品質
- `mistral-large-latest`：最高品質，適合專業翻譯
- 其他 Mistral 模型依可用性而定

## 🎯 支援的檔案格式

### SRT (SubRip)
```
1
00:00:01,000 --> 00:00:04,000
Hello, world!

2
00:00:05,000 --> 00:00:08,000
This is a subtitle.
```

### WebVTT
```
WEBVTT

00:00:01.000 --> 00:00:04.000
Hello, world!

00:00:05.000 --> 00:00:08.000
This is a subtitle.
```

### ASS (Advanced SSA)
```
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello, world!
```

### Markdown
```markdown
# Title

This is content to be translated.

## Section

More content here.
```

## 🔧 工作原理

1. **內容分析**：工具首先分析整個字幕內容以生成摘要
2. **上下文生成**：建立包含主題、術語、角色和風格的上下文摘要
3. **批次處理**：將字幕分成批次進行高效處理
4. **並行翻譯**：使用 Mistral AI 同時處理多個批次
5. **品質保證**：驗證翻譯結果和時間軸順序
6. **輸出生成**：建立最終的翻譯字幕檔案

## 📊 效能最佳化

- 使用 `mistral-small-latest` 獲得最快處理速度
- 使用 `mistral-large-latest` 獲得最高翻譯品質
- 確保穩定的網路連線以進行批次處理
- 大型檔案（1000+ 字幕）可能需要數分鐘處理時間
- 調整 `--concurrency` 和 `--batch-size` 參數以最佳化效能

## 🛠️ 故障排除

### 常見錯誤解決方案

**"請設定 MISTRAL_API_KEY 環境變數"**
- 解決方案：按照前置需求設定 API Key

**"字幕序號不連續"**
- 解決方案：使用 `--autofix` 標誌自動修正編號

**"翻譯數量與原始字幕數量不符"**
- 解決方案：檢查網路連線和 API Key 有效性

**"找不到輸入檔案"**
- 解決方案：驗證檔案路徑並確保字幕檔案存在

**API 速率限制**
- 解決方案：增加 `--delay` 參數值或減少 `--concurrency`

## 📁 檔案結構

```
mistral-translator/
├── main.js              # 主要應用程式邏輯
├── package.json         # 套件設定
├── README.md           # 本文件
├── LICENSE             # 授權條款
└── examples/           # 範例檔案
    ├── sample.srt
    ├── sample.vtt
    └── sample.ass
```

## 🧪 開發和測試

### 本地開發

1. 複製儲存庫
2. 安裝相依套件：
   ```bash
   npm install
   ```
3. 設定 API Key
4. 本地測試：
   ```bash
   node main.js --input test.srt --dry-run
   ```

### 執行測試

```bash
npm test
```

### 程式碼格式化

```bash
npm run format
```

## 📝 使用範例

### 基本電影字幕翻譯

```bash
npx @your-username/mistral-translator --input "Avengers.srt"
# 輸出：Avengers.zh.srt
```

### 技術文件翻譯

```bash
npx @your-username/mistral-translator -i "Tutorial.srt" --style technical -m mistral-large-latest
```

### 批次處理多個檔案

```bash
# 建立批次處理腳本
for file in *.srt; do
  npx @your-username/mistral-translator --input "$file" --autofix
done
```

### 日文動畫字幕翻譯

```bash
npx @your-username/mistral-translator -i "anime.ass" --from-lang Japanese --to-lang "繁體中文" --style casual
```

## 🌟 進階功能

### 自訂翻譯提示

工具會根據內容類型自動生成最佳翻譯提示，包括：
- 電影和電視劇的對話風格
- 技術文件的專業術語
- 教育內容的清晰表達
- 新聞內容的客觀語調

### 智慧錯誤恢復

- 自動重試失敗的翻譯請求
- 在網路問題時優雅處理連線
- 保持原始格式和時間軸完整性

### 詳細進度報告

```
🔄 翻譯進度: [████████████████████] 100% (50/50) ✅ 2
✅ 翻譯完成：50/50 個批次成功

📊 翻譯統計：
   字幕數量: 500
   原文字元: 15,432
   譯文字元: 18,764
   擴展比例: 1.22x
   平均長度: 31 → 38 字元
```

## 🤝 貢獻

歡迎貢獻！請遵循以下步驟：

1. Fork 儲存庫
2. 建立功能分支
3. 提交變更
4. 新增測試（如適用）
5. 提交 Pull Request

### 開發指南

- 使用 ESLint 進行程式碼檢查
- 遵循現有的程式碼風格
- 為新功能新增適當的錯誤處理
- 更新文件以反映變更

## 📄 授權

MIT 授權 - 詳見 LICENSE 檔案。

## 🙋‍♂️ 支援

如有問題或建議：

- **GitHub Issues**：[Repository Issues](https://github.com/your-username/mistral-translator/issues)
- **電子郵件**：your.email@example.com
- **文件**：查看 [Wiki](https://github.com/your-username/mistral-translator/wiki) 獲得更多範例

## 🔄 版本歷史

### v2.0.0
- 新增 ASS 和 Markdown 格式支援
- 改進的上下文感知翻譯
- 可自訂翻譯風格和語言
- 增強的錯誤處理和重試機制
- 詳細的翻譯統計和進度追蹤

### v1.0.0
- 初始版本
- 基本 SRT 和 WebVTT 翻譯功能
- Mistral AI 整合
- 批次處理和並發支援

---

使用 ❤️ 和 Mistral AI 製作