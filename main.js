#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yargs = require('yargs');
const { PromisePool } = require('@supercharge/promise-pool');

// Mistral AI 配置
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

// 命令列參數設定
const argv = yargs
  .option('input', {
    alias: 'i',
    describe: '輸入字幕檔案路徑 (SRT/WebVTT)',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: '輸出字幕檔案路徑',
    type: 'string'
  })
  .option('model', {
    alias: 'm',
    describe: 'Mistral 模型名稱',
    type: 'string',
    default: MISTRAL_MODEL
  })
  .option('autofix', {
    describe: '自動修復字幕編號',
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

// 檢查 API Key
function checkApiKey() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('❌ 錯誤：請設定 MISTRAL_API_KEY 環境變數');
    console.log('\n設定方式：');
    console.log('Windows (PowerShell): $env:MISTRAL_API_KEY = "your-api-key-here"');
    console.log('Windows (Command Prompt): set MISTRAL_API_KEY=your-api-key-here');
    console.log('macOS/Linux: export MISTRAL_API_KEY="your-api-key-here"');
    process.exit(1);
  }
  return apiKey;
}

// 解析 SRT 檔案
function parseSRT(content) {
  const blocks = content.trim().split(/\n\s*\n/);
  const subtitles = [];
  
  blocks.forEach((block, index) => {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0]) || index + 1;
      const timeRange = lines[1];
      const text = lines.slice(2).join('\n');
      
      subtitles.push({
        id,
        timeRange,
        text: text.trim()
      });
    }
  });
  
  return subtitles;
}

// 解析 WebVTT 檔案
function parseWebVTT(content) {
  const subtitles = [];
  const lines = content.split('\n');
  let currentSubtitle = null;
  let id = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳過 WEBVTT 標頭和空行
    if (line === 'WEBVTT' || line === '' || line.startsWith('NOTE') || line.startsWith('STYLE')) {
      continue;
    }
    
    // 檢查是否為時間軸格式
    if (line.includes('-->')) {
      currentSubtitle = {
        id: id++,
        timeRange: convertWebVTTTimeToSRT(line),
        text: ''
      };
      
      // 收集字幕文字
      let j = i + 1;
      const textLines = [];
      while (j < lines.length && lines[j].trim() !== '' && !lines[j].includes('-->')) {
        const textLine = lines[j].trim();
        if (textLine) {
          // 移除 WebVTT 格式標籤 (如 <c>, </c>, <v>, </v> 等)
          const cleanText = textLine.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          textLines.push(cleanText);
        }
        j++;
      }
      
      if (textLines.length > 0) {
        currentSubtitle.text = textLines.join('\n');
        subtitles.push(currentSubtitle);
      }
      
      i = j - 1; // 調整循環索引
    }
  }
  
  return subtitles;
}

// 將 WebVTT 時間格式轉換為 SRT 格式
function convertWebVTTTimeToSRT(webvttTime) {
  // WebVTT: 00:00:12.500 --> 00:00:15.000
  // SRT: 00:00:12,500 --> 00:00:15,000
  return webvttTime.replace(/\./g, ',');
}

// 將 SRT 時間格式轉換回 WebVTT 格式
function convertSRTTimeToWebVTT(srtTime) {
  // SRT: 00:00:12,500 --> 00:00:15,000
  // WebVTT: 00:00:12.500 --> 00:00:15.000
  return srtTime.replace(/,/g, '.');
}

// 自動檢測檔案格式並解析
function parseSubtitleFile(content, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  if (extension === '.vtt') {
    console.log('📝 檢測到 WebVTT 格式');
    return parseWebVTT(content);
  } else if (extension === '.srt') {
    console.log('📝 檢測到 SRT 格式');
    return parseSRT(content);
  } else {
    // 嘗試根據內容自動檢測
    if (content.includes('WEBVTT')) {
      console.log('📝 自動檢測為 WebVTT 格式');
      return parseWebVTT(content);
    } else {
      console.log('📝 假設為 SRT 格式');
      return parseSRT(content);
    }
  }
}

// 生成 SRT 內容
function generateSRT(subtitles) {
  return subtitles.map(subtitle => 
    `${subtitle.id}\n${subtitle.timeRange}\n${subtitle.text}\n`
  ).join('\n');
}

// 生成 WebVTT 內容
function generateWebVTT(subtitles) {
  let content = 'WEBVTT\n\n';
  
  subtitles.forEach(subtitle => {
    content += `${convertSRTTimeToWebVTT(subtitle.timeRange)}\n`;
    content += `${subtitle.text}\n\n`;
  });
  
  return content;
}

// 生成輸出內容（根據檔案格式）
function generateSubtitleFile(subtitles, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  if (extension === '.vtt') {
    return generateWebVTT(subtitles);
  } else {
    return generateSRT(subtitles);
  }
}

// 自動修復字幕編號
function autoFixSubtitles(subtitles) {
  return subtitles.map((subtitle, index) => ({
    ...subtitle,
    id: index + 1
  }));
}

// 生成內容摘要
async function generateContentSummary(subtitles, apiKey, model) {
  const sampleText = subtitles.slice(0, 50).map(s => s.text).join('\n');
  
  const prompt = `請分析以下字幕內容並生成簡要摘要，包括：
1. 內容主題和類型
2. 主要角色和專業術語
3. 語言風格和語調
4. 翻譯時需要注意的文化背景

字幕內容：
${sampleText}

請用繁體中文回答，並保持簡潔。`;

  try {
    const response = await axios.post(MISTRAL_API_URL, {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.warn('⚠️  無法生成內容摘要，將繼續進行翻譯');
    return '一般影片內容，請保持自然的繁體中文翻譯風格。';
  }
}

// 翻譯字幕批次
async function translateBatch(subtitles, context, apiKey, model) {
  const subtitleTexts = subtitles.map((s, index) => 
    `${index + 1}. ${s.text}`
  ).join('\n');

  const prompt = `請將以下英文字幕翻譯成繁體中文。

內容背景：
${context}

翻譯要求：
1. 保持原意和語調
2. 使用自然的繁體中文表達
3. 保留專業術語的準確性
4. 考慮影片的文化背景
5. 回應格式必須嚴格按照 JSON 格式，包含 translations 陣列

英文字幕：
${subtitleTexts}

請回答 JSON 格式：
{
  "translations": [
    "翻譯後的第1句",
    "翻譯後的第2句",
    ...
  ]
}`;

  try {
    const response = await axios.post(MISTRAL_API_URL, {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    try {
      // 嘗試解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.translations && Array.isArray(parsed.translations)) {
          return parsed.translations;
        }
      }
      
      // 如果 JSON 解析失敗，嘗試手動提取翻譯結果
      const lines = content.split('\n').filter(line => line.trim());
      const translations = [];
      
      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)/) || line.match(/"(.+)"/);
        if (match) {
          translations.push(match[1]);
        }
      }
      
      if (translations.length === subtitles.length) {
        return translations;
      }
      
      throw new Error('無法解析翻譯結果');
      
    } catch (parseError) {
      console.error('JSON 解析錯誤:', parseError.message);
      console.error('API 回應內容:', content);
      throw new Error('翻譯回應格式錯誤');
    }
    
  } catch (error) {
    if (error.response) {
      console.error('API 錯誤:', error.response.status, error.response.data);
    } else {
      console.error('網路錯誤:', error.message);
    }
    throw error;
  }
}

// 主要執行函數
async function main() {
  try {
    console.log('🚀 Mistral AI 字幕翻譯工具啟動中...');
    
    // 檢查 API Key
    const apiKey = checkApiKey();
    
    // 檢查輸入檔案
    const inputFile = argv.input;
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 找不到輸入檔案: ${inputFile}`);
      process.exit(1);
    }
    
    // 設定輸出檔案
    let outputFile = argv.output;
    if (!outputFile) {
      const inputExt = path.extname(inputFile);
      const inputName = path.basename(inputFile, inputExt);
      const inputDir = path.dirname(inputFile);
      outputFile = path.join(inputDir, `${inputName}.zh${inputExt}`);
    }
    
    console.log(`📂 輸入檔案: ${inputFile}`);
    console.log(`📂 輸出檔案: ${outputFile}`);
    console.log(`🤖 使用模型: ${argv.model}`);
    
    // 讀取並解析字幕檔案
    console.log('📖 讀取字幕檔案...');
    const content = fs.readFileSync(inputFile, 'utf8');
    let subtitles = parseSubtitleFile(content, inputFile);
    
    if (subtitles.length === 0) {
      console.error('❌ 無法解析字幕檔案或檔案為空');
      process.exit(1);
    }
    
    console.log(`📊 找到 ${subtitles.length} 條字幕`);
    
    // 自動修復編號（如果需要）
    if (argv.autofix) {
      console.log('🔧 自動修復字幕編號...');
      subtitles = autoFixSubtitles(subtitles);
    }
    
    // 生成內容摘要
    console.log('🧠 分析內容並生成翻譯背景...');
    const context = await generateContentSummary(subtitles, apiKey, argv.model);
    console.log('📝 內容分析完成');
    
    // 分批處理字幕
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < subtitles.length; i += batchSize) {
      batches.push(subtitles.slice(i, i + batchSize));
    }
    
    console.log(`🔄 開始翻譯 ${batches.length} 個批次...`);
    
    let completedBatches = 0;
    const translatedSubtitles = [];
    
    // 使用 Promise Pool 控制並發數量
    const { results, errors } = await PromisePool
      .withConcurrency(5)  // 降低並發數量以避免 API 限制
      .for(batches)
      .process(async (batch, index) => {
        try {
          const translations = await translateBatch(batch, context, apiKey, argv.model);
          
          const translatedBatch = batch.map((subtitle, i) => ({
            ...subtitle,
            text: translations[i] || subtitle.text
          }));
          
          completedBatches++;
          const progress = Math.round((completedBatches / batches.length) * 100);
          console.log(`✅ 批次 ${index + 1}/${batches.length} 完成 (${progress}%)`);
          
          return { index, batch: translatedBatch };
        } catch (error) {
          console.error(`❌ 批次 ${index + 1} 翻譯失敗:`, error.message);
          return { index, batch: batch }; // 返回原始內容
        }
      });
    
    // 重新組合翻譯結果
    const sortedResults = results.sort((a, b) => a.index - b.index);
    sortedResults.forEach(result => {
      translatedSubtitles.push(...result.batch);
    });
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} 個批次翻譯時發生錯誤`);
    }
    
    // 驗證翻譯結果
    if (translatedSubtitles.length !== subtitles.length) {
      console.error('❌ 翻譯數量與原始字幕數量不符');
      process.exit(1);
    }
    
    // 生成並儲存翻譯後的字幕檔案
    console.log('💾 儲存翻譯結果...');
    const translatedContent = generateSubtitleFile(translatedSubtitles, outputFile);
    fs.writeFileSync(outputFile, translatedContent, 'utf8');
    
    console.log('🎉 翻譯完成！');
    console.log(`📁 翻譯檔案已儲存至: ${outputFile}`);
    console.log(`📊 成功翻譯 ${translatedSubtitles.length} 條字幕`);
    
  } catch (error) {
    console.error('❌ 程式執行錯誤:', error.message);
    process.exit(1);
  }
}

// 執行程式
if (require.main === module) {
  main();
}

module.exports = {
  parseSRT,
  parseWebVTT,
  parseSubtitleFile,
  generateSRT,
  generateWebVTT,
  generateSubtitleFile,
  autoFixSubtitles,
  translateBatch
};