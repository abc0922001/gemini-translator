#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yargs = require('yargs');
const { PromisePool } = require('@supercharge/promise-pool');

// Mistral AI 配置
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

// 支援的檔案格式
const SUPPORTED_EXTENSIONS = ['.srt', '.vtt', '.ass', '.md'];

// 命令列參數設定
const argv = yargs
  .option('input', {
    alias: 'i',
    describe: '輸入字幕檔案路徑 (SRT/WebVTT/ASS/Markdown)',
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
  .option('concurrency', {
    alias: 'c',
    describe: '並發處理數量',
    type: 'number',
    default: 5
  })
  .option('batch-size', {
    alias: 'b',
    describe: '批次處理大小',
    type: 'number',
    default: 10
  })
  .option('from-lang', {
    alias: 'f',
    describe: '來源語言 (預設: 英文)',
    type: 'string',
    default: 'English'
  })
  .option('to-lang', {
    alias: 't',
    describe: '目標語言 (預設: 繁體中文)',
    type: 'string',
    default: '繁體中文'
  })
  .option('style', {
    alias: 's',
    describe: '翻譯風格 (formal/casual/technical)',
    type: 'string',
    default: 'natural',
    choices: ['formal', 'casual', 'technical', 'natural']
  })
  .option('dry-run', {
    describe: '測試模式：僅分析檔案，不進行翻譯',
    type: 'boolean',
    default: false
  })
  .option('retry', {
    describe: '翻譯失敗時的重試次數',
    type: 'number',
    default: 3
  })
  .option('delay', {
    describe: '請求間隔時間（毫秒）',
    type: 'number',
    default: 1000
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
    console.log('\n取得 API Key：');
    console.log('1. 前往 https://console.mistral.ai/');
    console.log('2. 註冊或登入帳戶');
    console.log('3. 建立新的 API Key');
    process.exit(1);
  }
  return apiKey;
}

// 驗證檔案格式
function validateFileFormat(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    console.error(`❌ 不支援的檔案格式: ${extension}`);
    console.log(`支援的格式: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    process.exit(1);
  }
  return extension;
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
      
      // 驗證時間格式
      if (timeRange.includes('-->')) {
        subtitles.push({
          id,
          timeRange,
          text: text.trim(),
          originalText: text.trim()
        });
      }
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
        text: '',
        originalText: ''
      };
      
      // 收集字幕文字
      let j = i + 1;
      const textLines = [];
      while (j < lines.length && lines[j].trim() !== '' && !lines[j].includes('-->')) {
        const textLine = lines[j].trim();
        if (textLine) {
          // 移除 WebVTT 格式標籤
          const cleanText = textLine.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          textLines.push(cleanText);
        }
        j++;
      }
      
      if (textLines.length > 0) {
        currentSubtitle.text = textLines.join('\n');
        currentSubtitle.originalText = currentSubtitle.text;
        subtitles.push(currentSubtitle);
      }
      
      i = j - 1;
    }
  }
  
  return subtitles;
}

// 解析 ASS 檔案
function parseASS(content) {
  const subtitles = [];
  const lines = content.split('\n');
  let inEventsSection = false;
  let formatLine = '';
  let id = 1;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '[Events]') {
      inEventsSection = true;
      continue;
    }
    
    if (trimmedLine.startsWith('[') && trimmedLine !== '[Events]') {
      inEventsSection = false;
      continue;
    }
    
    if (inEventsSection) {
      if (trimmedLine.startsWith('Format:')) {
        formatLine = trimmedLine;
      } else if (trimmedLine.startsWith('Dialogue:')) {
        const subtitle = parseASSDialogue(trimmedLine, formatLine, id++);
        if (subtitle) {
          subtitles.push(subtitle);
        }
      }
    }
  }
  
  return subtitles;
}

// 解析 ASS 對話行
function parseASSDialogue(dialogueLine, formatLine, id) {
  const formatFields = formatLine.replace('Format:', '').split(',').map(f => f.trim());
  const dialogueFields = dialogueLine.replace('Dialogue:', '').split(',');
  
  const startIndex = formatFields.indexOf('Start');
  const endIndex = formatFields.indexOf('End');
  const textIndex = formatFields.indexOf('Text');
  
  if (startIndex === -1 || endIndex === -1 || textIndex === -1) {
    return null;
  }
  
  const startTime = convertASSTimeToSRT(dialogueFields[startIndex]);
  const endTime = convertASSTimeToSRT(dialogueFields[endIndex]);
  const text = dialogueFields.slice(textIndex).join(',').replace(/\\N/g, '\n').replace(/\{[^}]*\}/g, '');
  
  return {
    id,
    timeRange: `${startTime} --> ${endTime}`,
    text: text.trim(),
    originalText: text.trim()
  };
}

// 解析 Markdown 檔案
function parseMarkdown(content) {
  const lines = content.split('\n');
  const subtitles = [];
  let id = 1;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('```')) {
      subtitles.push({
        id: id++,
        timeRange: '00:00:00,000 --> 00:00:01,000', // 預設時間
        text: trimmedLine,
        originalText: trimmedLine
      });
    }
  }
  
  return subtitles;
}

// 轉換時間格式
function convertWebVTTTimeToSRT(webvttTime) {
  return webvttTime.replace(/\./g, ',');
}

function convertSRTTimeToWebVTT(srtTime) {
  return srtTime.replace(/,/g, '.');
}

function convertASSTimeToSRT(assTime) {
  // ASS 時間格式: 0:00:00.00
  // SRT 時間格式: 00:00:00,000
  const parts = assTime.split(':');
  if (parts.length === 3) {
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    const seconds = parts[2].replace('.', ',');
    // 補齊毫秒位數
    const [sec, ms] = seconds.split(',');
    const milliseconds = (ms || '0').padEnd(3, '0');
    return `${hours}:${minutes}:${sec.padStart(2, '0')},${milliseconds}`;
  }
  return assTime;
}

// 自動檢測檔案格式並解析
function parseSubtitleFile(content, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.vtt':
      console.log('📝 檢測到 WebVTT 格式');
      return parseWebVTT(content);
    case '.srt':
      console.log('📝 檢測到 SRT 格式');
      return parseSRT(content);
    case '.ass':
      console.log('📝 檢測到 ASS 格式');
      return parseASS(content);
    case '.md':
      console.log('📝 檢測到 Markdown 格式');
      return parseMarkdown(content);
    default:
      // 嘗試根據內容自動檢測
      if (content.includes('WEBVTT')) {
        console.log('📝 自動檢測為 WebVTT 格式');
        return parseWebVTT(content);
      } else if (content.includes('[Events]')) {
        console.log('📝 自動檢測為 ASS 格式');
        return parseASS(content);
      } else {
        console.log('📝 假設為 SRT 格式');
        return parseSRT(content);
      }
  }
}

// 生成輸出檔案
function generateSRT(subtitles) {
  return subtitles.map(subtitle => 
    `${subtitle.id}\n${subtitle.timeRange}\n${subtitle.text}\n`
  ).join('\n');
}

function generateWebVTT(subtitles) {
  let content = 'WEBVTT\n\n';
  
  subtitles.forEach(subtitle => {
    content += `${convertSRTTimeToWebVTT(subtitle.timeRange)}\n`;
    content += `${subtitle.text}\n\n`;
  });
  
  return content;
}

function generateASS(subtitles) {
  let content = `[Script Info]
Title: Translated Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  subtitles.forEach(subtitle => {
    const [startTime, endTime] = subtitle.timeRange.split(' --> ');
    const assStartTime = convertSRTTimeToASS(startTime);
    const assEndTime = convertSRTTimeToASS(endTime);
    const text = subtitle.text.replace(/\n/g, '\\N');
    
    content += `Dialogue: 0,${assStartTime},${assEndTime},Default,,0,0,0,,${text}\n`;
  });
  
  return content;
}

function convertSRTTimeToASS(srtTime) {
  // SRT: 00:00:00,000 -> ASS: 0:00:00.00
  const [time, ms] = srtTime.split(',');
  const [hours, minutes, seconds] = time.split(':');
  const centiseconds = Math.floor(parseInt(ms) / 10);
  return `${parseInt(hours)}:${minutes}:${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

function generateMarkdown(subtitles) {
  return subtitles.map(subtitle => subtitle.text).join('\n\n');
}

// 根據檔案格式生成內容
function generateSubtitleFile(subtitles, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.vtt':
      return generateWebVTT(subtitles);
    case '.ass':
      return generateASS(subtitles);
    case '.md':
      return generateMarkdown(subtitles);
    default:
      return generateSRT(subtitles);
  }
}

// 自動修復字幕編號
function autoFixSubtitles(subtitles) {
  console.log('🔧 正在修復字幕編號...');
  
  const fixed = subtitles.map((subtitle, index) => ({
    ...subtitle,
    id: index + 1
  }));
  
  // 檢查時間軸順序
  let timeIssues = 0;
  for (let i = 1; i < fixed.length; i++) {
    const prevEnd = getTimeStamp(fixed[i-1].timeRange.split(' --> ')[1]);
    const currStart = getTimeStamp(fixed[i].timeRange.split(' --> ')[0]);
    
    if (currStart < prevEnd) {
      timeIssues++;
    }
  }
  
  if (timeIssues > 0) {
    console.warn(`⚠️  發現 ${timeIssues} 個時間軸重疊問題`);
  }
  
  console.log(`✅ 字幕編號已修復 (${fixed.length} 條字幕)`);
  return fixed;
}

// 轉換時間為毫秒
function getTimeStamp(timeStr) {
  const [time, ms] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + Number(ms);
}

// 生成內容摘要
async function generateContentSummary(subtitles, apiKey, model) {
  console.log('🧠 正在分析內容特徵...');
  
  // 取樣字幕進行分析
  const sampleSize = Math.min(50, subtitles.length);
  const sampleText = subtitles.slice(0, sampleSize).map(s => s.text).join('\n');
  
  // 統計資訊
  const stats = {
    totalSubtitles: subtitles.length,
    avgLength: Math.round(subtitles.reduce((sum, s) => sum + s.text.length, 0) / subtitles.length),
    maxLength: Math.max(...subtitles.map(s => s.text.length)),
    minLength: Math.min(...subtitles.map(s => s.text.length))
  };
  
  const styleMap = {
    'formal': '正式、專業',
    'casual': '輕鬆、口語化',
    'technical': '技術性、準確',
    'natural': '自然、流暢'
  };
  
  const prompt = `請分析以下${argv.fromLang}字幕內容並生成翻譯指導摘要：

統計資訊：
- 總字幕數：${stats.totalSubtitles}
- 平均長度：${stats.avgLength} 字元
- 翻譯風格：${styleMap[argv.style]}
- 目標語言：${argv.toLang}

字幕範例：
${sampleText}

請提供簡要分析，包括：
1. 內容類型和主題
2. 語言特色和專業術語
3. 翻譯建議和注意事項

請用${argv.toLang}回答，並保持簡潔 (200字以內)。`;

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
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = response.data.choices[0].message.content;
    console.log('📋 內容分析結果：');
    console.log(summary);
    console.log('');
    
    return summary;
  } catch (error) {
    console.warn('⚠️  無法生成內容摘要，將使用預設翻譯策略');
    return `一般${argv.fromLang}內容，請翻譯成${argv.toLang}，保持${styleMap[argv.style]}風格。`;
  }
}

// 翻譯字幕批次
async function translateBatch(subtitles, context, apiKey, model, retryCount = 0) {
  const subtitleTexts = subtitles.map((s, index) => 
    `${index + 1}. ${s.text}`
  ).join('\n');

  const styleInstructions = {
    'formal': '使用正式、書面語體',
    'casual': '使用口語化、親切的表達',
    'technical': '保持技術術語準確性',
    'natural': '使用自然流暢的表達'
  };

  const prompt = `請將以下${argv.fromLang}字幕翻譯成${argv.toLang}。

內容背景：
${context}

翻譯要求：
1. ${styleInstructions[argv.style]}
2. 保持原意和語調
3. 考慮文化背景差異
4. 保持字幕長度適中
5. 必須嚴格按照 JSON 格式回應

${argv.fromLang}字幕：
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
          if (parsed.translations.length !== subtitles.length) {
            throw new Error(`翻譯數量不符：期望 ${subtitles.length}，得到 ${parsed.translations.length}`);
          }
          return parsed.translations;
        }
      }
      
      // 如果 JSON 解析失敗，嘗試手動提取
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
      
      throw new Error(`手動解析失敗：期望 ${subtitles.length}，得到 ${translations.length}`);
      
    } catch (parseError) {
      console.error('JSON 解析錯誤:', parseError.message);
      throw new Error('翻譯回應格式錯誤');
    }
    
  } catch (error) {
    if (retryCount < argv.retry) {
      console.warn(`⚠️  批次翻譯失敗，正在重試 (${retryCount + 1}/${argv.retry})...`);
      await new Promise(resolve => setTimeout(resolve, argv.delay * (retryCount + 1)));
      return translateBatch(subtitles, context, apiKey, model, retryCount + 1);
    }
    
    if (error.response) {
      console.error('API 錯誤:', error.response.status, error.response.data);
    } else {
      console.error('網路錯誤:', error.message);
    }
    throw error;
  }
}

// 進度追蹤
function createProgressTracker(total) {
  let completed = 0;
  let failed = 0;
  
  return {
    update: (success = true) => {
      if (success) {
        completed++;
      } else {
        failed++;
      }
      
      const progress = Math.round(((completed + failed) / total) * 100);
      const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
      
      process.stdout.write(`\r🔄 翻譯進度: [${bar}] ${progress}% (${completed}/${total})`);
      
      if (failed > 0) {
        process.stdout.write(` ❌ ${failed}`);
      }
    },
    
    finish: () => {
      process.stdout.write('\n');
      if (failed > 0) {
        console.log(`⚠️  ${failed} 個批次翻譯失敗`);
      }
      console.log(`✅ 翻譯完成：${completed}/${total} 個批次成功`);
    }
  };
}

// 文件統計
function generateStatistics(originalSubtitles, translatedSubtitles) {
  const originalChars = originalSubtitles.reduce((sum, s) => sum + s.text.length, 0);
  const translatedChars = translatedSubtitles.reduce((sum, s) => sum + s.text.length, 0);
  
  const avgOriginalLength = Math.round(originalChars / originalSubtitles.length);
  const avgTranslatedLength = Math.round(translatedChars / translatedSubtitles.length);
  
  return {
    subtitleCount: originalSubtitles.length,
    originalChars,
    translatedChars,
    expansionRatio: Math.round((translatedChars / originalChars) * 100) / 100,
    avgOriginalLength,
    avgTranslatedLength
  };
}

// 主要執行函數
async function main() {
  try {
    console.log('🚀 Mistral AI 字幕翻譯工具 v2.0 啟動中...');
    
    // 檢查 API Key
    const apiKey = checkApiKey();
    
    // 檢查輸入檔案
    const inputFile = argv.input;
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ 找不到輸入檔案: ${inputFile}`);
      process.exit(1);
    }
    
    // 驗證檔案格式
    const inputExtension = validateFileFormat(inputFile);
    
    // 設定輸出檔案
    let outputFile = argv.output;
    if (!outputFile) {
      const inputName = path.basename(inputFile, inputExtension);
      const inputDir = path.dirname(inputFile);
      outputFile = path.join(inputDir, `${inputName}.zh${inputExtension}`);
    }
    
    console.log(`📂 輸入檔案: ${inputFile}`);
    console.log(`📂 輸出檔案: ${outputFile}`);
    console.log(`🤖 使用模型: ${argv.model}`);
    console.log(`🌐 翻譯: ${argv.fromLang} → ${argv.toLang}`);
    console.log(`🎨 風格: ${argv.style}`);
    console.log(`⚡ 並發數: ${argv.concurrency}`);
    console.log(`📦 批次大小: ${argv.batchSize}`);
    
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
      subtitles = autoFixSubtitles(subtitles);
    }
    
    // 測試模式
    if (argv.dryRun) {
      console.log('🧪 測試模式：僅分析檔案結構');
      const stats = generateStatistics(subtitles, subtitles);
      console.log(`📈 統計資訊：`);
      console.log(`   字幕數量: ${stats.subtitleCount}`);
      console.log(`   總字元數: ${stats.originalChars}`);
      console.log(`   平均長度: ${stats.avgOriginalLength} 字元`);
      console.log('✅ 分析完成，未進行翻譯');
      return;
    }
    
    // 生成內容摘要
    console.log('🧠 分析內容並生成翻譯背景...');
    const context = await generateContentSummary(subtitles, apiKey, argv.model);
    
    // 分批處理字幕
    const batchSize = argv.batchSize;
    const batches = [];
    for (let i = 0; i < subtitles.length; i += batchSize) {
      batches.push(subtitles.slice(i, i + batchSize));
    }
    
    console.log(`🔄 開始翻譯 ${batches.length} 個批次...`);
    
    // 初始化進度追蹤
    const progress = createProgressTracker(batches.length);
    const translatedSubtitles = [];
    
    // 使用 Promise Pool 控制並發數量
    const { results, errors } = await PromisePool
      .withConcurrency(argv.concurrency)
      .for(batches)
      .process(async (batch, index) => {
        try {
          // 添加延遲避免 API 限制
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, argv.delay));
          }
          
          const translations = await translateBatch(batch, context, apiKey, argv.model);
          
          const translatedBatch = batch.map((subtitle, i) => ({
            ...subtitle,
            text: translations[i] || subtitle.text
          }));
          
          progress.update(true);
          return { index, batch: translatedBatch };
        } catch (error) {
          progress.update(false);
          console.error(`\n❌ 批次 ${index + 1} 翻譯失敗:`, error.message);
          
          // 返回原始內容作為備用
          return { index, batch: batch };
        }
      });
    
    progress.finish();
    
    // 重新組合翻譯結果
    const sortedResults = results.sort((a, b) => a.index - b.index);
    sortedResults.forEach(result => {
      translatedSubtitles.push(...result.batch);
    });
    
    // 驗證翻譯結果
    if (translatedSubtitles.length !== subtitles.length) {
      console.error('❌ 翻譯數量與原始字幕數量不符');
      console.error(`原始: ${subtitles.length}, 翻譯後: ${translatedSubtitles.length}`);
      process.exit(1);
    }
    
    // 生成統計資訊
    const stats = generateStatistics(subtitles, translatedSubtitles);
    
    // 儲存翻譯結果
    console.log('💾 儲存翻譯結果...');
    const translatedContent = generateSubtitleFile(translatedSubtitles, outputFile);
    
    // 確保輸出目錄存在
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputFile, translatedContent, 'utf8');
    
    // 輸出完成資訊
    console.log('🎉 翻譯完成！');
    console.log(`📁 翻譯檔案已儲存至: ${outputFile}`);
    console.log('');
    console.log('📊 翻譯統計：');
    console.log(`   字幕數量: ${stats.subtitleCount}`);
    console.log(`   原文字元: ${stats.originalChars.toLocaleString()}`);
    console.log(`   譯文字元: ${stats.translatedChars.toLocaleString()}`);
    console.log(`   擴展比例: ${stats.expansionRatio}x`);
    console.log(`   平均長度: ${stats.avgOriginalLength} → ${stats.avgTranslatedLength} 字元`);
    
    if (errors.length > 0) {
      console.log('');
      console.warn(`⚠️  ${errors.length} 個批次處理時發生錯誤，已使用原文替代`);
    }
    
    // 生成翻譯報告
    if (argv.report) {
      await generateTranslationReport(subtitles, translatedSubtitles, stats, outputFile);
    }
    
  } catch (error) {
    console.error('❌ 程式執行錯誤:', error.message);
    if (error.stack && argv.debug) {
      console.error('詳細錯誤：', error.stack);
    }
    process.exit(1);
  }
}

// 生成翻譯報告
async function generateTranslationReport(original, translated, stats, outputFile) {
  const reportFile = outputFile.replace(path.extname(outputFile), '.report.md');
  
  let report = `# 翻譯報告

## 基本資訊
- 翻譯時間: ${new Date().toLocaleString('zh-TW')}
- 來源語言: ${argv.fromLang}
- 目標語言: ${argv.toLang}
- 翻譯風格: ${argv.style}
- 使用模型: ${argv.model}

## 統計資訊
- 字幕數量: ${stats.subtitleCount}
- 原文字元數: ${stats.originalChars.toLocaleString()}
- 譯文字元數: ${stats.translatedChars.toLocaleString()}
- 文本擴展比例: ${stats.expansionRatio}x
- 平均字幕長度: ${stats.avgOriginalLength} → ${stats.avgTranslatedLength} 字元

## 翻譯樣本 (前10條)
`;

  for (let i = 0; i < Math.min(10, original.length); i++) {
    report += `\n### ${i + 1}. ${original[i].timeRange}\n`;
    report += `**原文:** ${original[i].originalText}\n\n`;
    report += `**譯文:** ${translated[i].text}\n\n`;
  }
  
  fs.writeFileSync(reportFile, report, 'utf8');
  console.log(`📋 翻譯報告已儲存至: ${reportFile}`);
}

// 錯誤處理和清理
process.on('SIGINT', () => {
  console.log('\n👋 程式被中斷，正在清理...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的異常:', error.message);
  if (argv.debug) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  if (argv.debug) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

// 執行程式
if (require.main === module) {
  main();
}

// 導出模組函數供測試使用
module.exports = {
  parseSRT,
  parseWebVTT,
  parseASS,
  parseMarkdown,
  parseSubtitleFile,
  generateSRT,
  generateWebVTT,
  generateASS,
  generateMarkdown,
  generateSubtitleFile,
  autoFixSubtitles,
  translateBatch,
  generateContentSummary,
  generateStatistics,
  validateFileFormat,
  convertWebVTTTimeToSRT,
  convertSRTTimeToWebVTT,
  convertASSTimeToSRT,
  convertSRTTimeToASS
};