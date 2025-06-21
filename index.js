/**
 * TinyPNG 递归目录图片压缩工具
 * 
 * 功能特性：
 * - 递归扫描指定目录下的所有图片文件
 * - 支持 jpg、jpeg、png、webp 格式的图片压缩
 * - 使用 TinyPNG API 进行在线压缩
 * - 支持多并发处理提高效率
 * - 失败文件自动重试机制
 * - 保持原有目录结构
 * - 复制非压缩格式文件（如 svg, gif等）
 * - 失败文件单独存储便于重试
 * 
 * 使用方法：
 * - 正常压缩：node index.js
 * - 仅重试失败：node index.js --retry-failed
 * 
 * @author 无忧
 * @version 1.2.0
 * @since 2025
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const randomUseragent = require('random-useragent');
const ProgressBar = require('progress');

// 解析命令行参数
const args = process.argv.slice(2);
const retryOnly = args.includes('--retry-failed');

// ====================== 配置区域 ======================
/**
 * 全局配置对象
 * @typedef {Object} Config
 * @property {string} SOURCE_ROOT - 需要压缩的图片目录路径
 * @property {string} OUTPUT_ROOT - 压缩后图片输出目录路径
 * @property {string[]} SUPPORTED_FORMATS - 支持的图片格式列表
 * @property {number} MAX_CONCURRENT - 最大并发处理数，基于 CPU 核心数
 * @property {number} TASK_DELAY - 任务间延迟时间（毫秒），避免频繁请求
 * @property {number} TIMEOUT - 网络请求超时时间（毫秒）
 * @property {number} MAX_RETRIES - 失败重试最大次数
 * @property {string} LOG_LEVEL - 日志级别：'minimal'|'normal'|'verbose'
 * @property {boolean} PRESERVE_DIR_STRUCTURE - 是否保持原有目录结构
 * @property {boolean} SKIP_HIDDEN_DIRS - 是否跳过隐藏目录（以.开头）
 * @property {boolean} COPY_UNSUPPORTED_TO_OUTPUT - 是否复制非压缩格式文件到输出目录
 * @property {string} SAVE_FAILED_TO - 失败文件保存目录路径
 */
const CONFIG = {
  SOURCE_ROOT: path.join(__dirname, 'static'), // 输入需要压缩的图片目录
  OUTPUT_ROOT: path.join(__dirname, 'compressed_results'), // 输出压缩后的图片目录
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.webp'], // 支持的图片格式
  MAX_CONCURRENT: Math.max(1, os.cpus().length - 1), // 最大并发处理数，基于 CPU 核心数
  TASK_DELAY: 300, // 任务间延迟时间（毫秒），避免频繁请求
  TIMEOUT: 30000, // 网络请求超时时间（毫秒）
  MAX_RETRIES: 2, // 失败重试最大次数
  LOG_LEVEL: 'normal', // 日志级别：'minimal'|'normal'|'verbose'
  PRESERVE_DIR_STRUCTURE: true, // 是否保持原有目录结构
  SKIP_HIDDEN_DIRS: true, // 是否跳过隐藏目录（以.开头）
  COPY_UNSUPPORTED_TO_OUTPUT: true, // 是否复制非压缩格式文件到输出目录, 如 svg, gif等, 如果有非 ['.jpg', '.jpeg', '.png', '.webp'] 的文件，建议设置为 true
  SAVE_FAILED_TO: path.join(__dirname, 'failed_images'), // 压缩失败的图片统一放的目录
};
// ====================== 配置结束 ======================

/**
 * TinyPNG API 配置对象
 * @typedef {Object} TinyAPI
 * @property {string} STORE_URL - 图片上传存储接口地址
 * @property {string} PROCESS_URL - 图片压缩处理接口地址
 * @property {Object} HEADERS - 请求头配置
 */
const TINY_API = {
  STORE_URL: 'https://tinypng.com/backend/opt/store',
  PROCESS_URL: 'https://tinypng.com/backend/opt/process',
  HEADERS: {
    Referer: 'https://tinypng.com/',
    Origin: 'https://tinypng.com',
  }
};

/**
 * 获取随机请求头，包含随机 User-Agent
 * 用于模拟不同浏览器请求，避免被反爬虫机制拦截
 * 
 * @returns {Object} 包含随机 User-Agent 的请求头对象
 */
function getRandomHeaders() {
  return {
    'User-Agent': randomUseragent.getRandom(),
    ...TINY_API.HEADERS
  };
}

/**
 * 递归获取目录下所有支持格式的图片文件
 * 
 * @param {string} dir - 要扫描的目录路径
 * @returns {string[]} 所有图片文件的完整路径数组
 * 
 * @example
 * const images = getAllImageFiles('./static');
 * // 返回 ['./static/img1.jpg', './static/subdir/img2.png', ...]
 */
function getAllImageFiles(dir) {
  const results = [];
  
  // 跳过隐藏目录
  if (CONFIG.SKIP_HIDDEN_DIRS && path.basename(dir).startsWith('.')) return results;
  
  // 避免扫描失败目录，防止死循环或重复压缩
  if (path.resolve(dir) === path.resolve(CONFIG.SAVE_FAILED_TO)) return results;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 递归处理子目录
      results.push(...getAllImageFiles(fullPath));
    } else {
      // 检查文件扩展名是否为支持的图片格式
      const ext = path.extname(file).toLowerCase();
      if (CONFIG.SUPPORTED_FORMATS.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * 图片压缩处理结果对象
 * @typedef {Object} CompressionResult
 * @property {string} filePath - 原始文件路径
 * @property {string} outputPath - 输出文件路径
 * @property {string} fileName - 文件名
 * @property {number} originalSize - 原始文件大小（字节）
 * @property {number} compressedSize - 压缩后文件大小（字节）
 * @property {string} savedPercent - 节省空间百分比
 * @property {boolean} success - 处理是否成功
 * @property {string} [error] - 错误信息（失败时）
 */

/**
 * 单个图片文件压缩处理工作器
 * 使用 TinyPNG API 进行图片压缩，支持自动重试
 * 
 * @param {string} filePath - 要压缩的图片文件路径
 * @param {string} outputRoot - 输出根目录路径
 * @returns {Promise<CompressionResult>} 压缩处理结果
 * 
 * @example
 * const result = await compressImageWorker('./static/image.jpg', './output');
 * if (result.success) {
 *   console.log(`压缩成功，节省 ${result.savedPercent}%`);
 * }
 */
async function compressImageWorker(filePath, outputRoot) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  // 根据文件扩展名确定 MIME 类型
  const fileType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  
  let retryCount = 0;
  
  // 重试循环
  while (retryCount <= CONFIG.MAX_RETRIES) {
    try {
      // 1. 读取原始文件
      const fileData = fs.readFileSync(filePath);
      const fileSize = fileData.length;
      const headers = getRandomHeaders();
      
      // 2. 上传文件到 TinyPNG 存储服务
      const storeRes = await axios.post(TINY_API.STORE_URL, fileData, {
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileSize,
        },
        timeout: CONFIG.TIMEOUT
      });
      
      // 3. 从响应头获取文件标识 key
      const key = storeRes.headers['location'].split('/').pop();
      
      // 4. 请求压缩处理
      const processRes = await axios.post(TINY_API.PROCESS_URL, {
        key,
        originalSize: fileSize,
        originalType: fileType,
      }, {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        timeout: CONFIG.TIMEOUT
      });
      
      // 5. 获取压缩后的下载链接
      const downloadUrl = processRes.data.url;
      
      // 6. 确定输出文件路径
      let outputPath;
      if (CONFIG.PRESERVE_DIR_STRUCTURE) {
        // 保持原有目录结构
        const relativePath = path.relative(CONFIG.SOURCE_ROOT, path.dirname(filePath));
        outputPath = path.join(outputRoot, relativePath, fileName);
      } else {
        // 所有文件放在输出根目录
        outputPath = path.join(outputRoot, fileName);
      }
      
      // 7. 创建输出目录（如果不存在）
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      
      // 8. 下载并保存压缩后的文件
      const downloadRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: CONFIG.TIMEOUT
      });
      fs.writeFileSync(outputPath, downloadRes.data);
      
      // 9. 计算压缩效果
      const compressedSize = fs.statSync(outputPath).size;
      const savedPercent = ((fileSize - compressedSize) / fileSize * 100).toFixed(1);
      
      return {
        filePath,
        outputPath,
        fileName,
        originalSize: fileSize,
        compressedSize,
        savedPercent,
        success: true
      };
      
    } catch (err) {
      retryCount++;
      
      // 达到最大重试次数，返回失败结果
      if (retryCount > CONFIG.MAX_RETRIES) {
        let errorDetails = '';
        if (err.response) errorDetails = `HTTP ${err.response.status}: ${err.response.data?.error || 'Unknown error'}`;
        else if (err.request) errorDetails = 'No response from server';
        else errorDetails = err.message || 'Unknown error';
        
        return { fileName, filePath, error: errorDetails, success: false };
      }
      
      // 等待一段时间后重试（递增延迟）
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}

/**
 * 复制非压缩格式文件到输出目录
 * 递归遍历源目录，将不支持压缩的文件（如 svg、gif 等）复制到输出目录
 * 
 * @param {string} dir - 要处理的目录路径
 * @param {string} outputRoot - 输出根目录路径
 * 
 * @example
 * copyUnsupportedFiles('./static', './output');
 * // 将 ./static 下的所有 .svg 文件复制到 ./output 对应位置
 */
function copyUnsupportedFiles(dir, outputRoot) {
  // 跳过隐藏目录
  if (CONFIG.SKIP_HIDDEN_DIRS && path.basename(dir).startsWith('.')) return;
  
  // 跳过失败目录
  if (path.resolve(dir) === path.resolve(CONFIG.SAVE_FAILED_TO)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 递归处理子目录
      copyUnsupportedFiles(fullPath, outputRoot);
    } else {
      const ext = path.extname(file).toLowerCase();
      
      // 只处理非压缩格式文件
      if (!CONFIG.SUPPORTED_FORMATS.includes(ext)) {
        // 确定输出路径
        let outputPath;
        if (CONFIG.PRESERVE_DIR_STRUCTURE) {
          const relativePath = path.relative(CONFIG.SOURCE_ROOT, path.dirname(fullPath));
          outputPath = path.join(outputRoot, relativePath, file);
        } else {
          outputPath = path.join(outputRoot, file);
        }
        
        // 创建输出目录
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        // 复制文件
        fs.copyFileSync(fullPath, outputPath);
        
        if (CONFIG.LOG_LEVEL === 'verbose') {
          console.log(`📄 复制非压缩文件: ${fullPath} → ${outputPath}`);
        }
      }
    }
  }
}

/**
 * 图片处理工作器
 * 从文件队列中取出文件进行处理，支持并发执行
 * 
 * @param {string[]} files - 待处理文件路径数组（引用传递，会被修改）
 * @param {string} outputRoot - 输出根目录路径
 * @param {Object} results - 结果统计对象，包含 success 和 failed 数组
 * @param {ProgressBar|null} bar - 进度条对象，可为空
 * @param {boolean} [isRetry=false] - 是否为重试模式
 * 
 * @example
 * const files = ['image1.jpg', 'image2.png'];
 * const results = { success: [], failed: [] };
 * await processWorker(files, './output', results, progressBar, false);
 */
async function processWorker(files, outputRoot, results, bar, isRetry = false) {
  // 持续处理直到队列为空
  while (files.length > 0) {
    // 从队列中取出一个文件
    const file = files.shift();
    const relativePath = path.relative(CONFIG.SOURCE_ROOT, file);
    
    if (CONFIG.LOG_LEVEL === 'verbose') console.log(`🔧 处理: ${relativePath}`);
    
    try {
      // 执行压缩处理
      const result = await compressImageWorker(file, outputRoot);
      
      if (result.success) {
        results.success.push(result);
        
        if (CONFIG.LOG_LEVEL === 'verbose') {
          console.log(`✅ ${relativePath}: ${(result.originalSize/1024).toFixed(2)}KB → ${(result.compressedSize/1024).toFixed(2)}KB (节省 ${result.savedPercent}%)`);
        }
        
        // 重试模式下成功时，删除失败目录中的原文件
        if (isRetry) {
          try {
            fs.unlinkSync(file);
            if (CONFIG.LOG_LEVEL === 'verbose') {
              console.log(`🗑️ 删除失败目录中的文件: ${file}`);
            }
          } catch (err) {
            console.warn(`⚠️ 无法删除失败目录文件: ${file}`, err.message);
          }
        }
      } else {
        results.failed.push(result);
        if (CONFIG.LOG_LEVEL !== 'minimal') {
          console.log(`❌ ${relativePath}: ${result.error}`);
        }
      }
      
    } catch (err) {
      results.failed.push({ filePath: file, error: err.message || 'Unknown error', success: false });
      if (CONFIG.LOG_LEVEL !== 'minimal') {
        console.log(`❌ ${relativePath}: ${err.message}`);
      }
    }
    
    // 更新进度条
    if (bar) bar.tick();
    
    // 任务间延迟，避免过于频繁的请求
    await new Promise(resolve => setTimeout(resolve, CONFIG.TASK_DELAY));
  }
}

/**
 * 主压缩函数
 * 扫描源目录中的所有图片文件并进行压缩处理
 * 
 * @async
 * @function compressFolder
 * @returns {Promise<void>}
 * 
 * @description
 * 执行流程：
 * 1. 扫描源目录获取所有支持的图片文件
 * 2. 创建输出目录
 * 3. 启动多个并发工作器进行压缩
 * 4. 处理失败文件（复制到失败目录）
 * 5. 输出统计信息
 * 6. 复制非压缩格式文件
 */
async function compressFolder() {
  console.log('🚀 TinyPNG 递归目录图片压缩工具');
  
  // 检查源目录是否存在
  if (!fs.existsSync(CONFIG.SOURCE_ROOT)) return console.error(`❌ 源目录不存在: ${CONFIG.SOURCE_ROOT}`);

  // 1. 获取所有支持格式的图片
  const allFiles = getAllImageFiles(CONFIG.SOURCE_ROOT);
  if (allFiles.length === 0) {
    console.log('⚠️ 没有找到可处理的图片文件。');
  } else {
    // 2. 创建输出目录
    if (!fs.existsSync(CONFIG.OUTPUT_ROOT)) fs.mkdirSync(CONFIG.OUTPUT_ROOT, { recursive: true });
    
    // 3. 初始化结果统计和进度条
    const results = { success: [], failed: [] };
    const bar = CONFIG.LOG_LEVEL === 'normal' ? new ProgressBar('[:bar] :current/:total :percent :etas', {
      complete: '=', incomplete: ' ', width: 40, total: allFiles.length
    }) : null;

    // 4. 启动并发处理工作器
    const filesToProcess = [...allFiles];
    const workers = [];
    for (let i = 0; i < Math.min(allFiles.length, CONFIG.MAX_CONCURRENT); i++) {
      workers.push(processWorker(filesToProcess, CONFIG.OUTPUT_ROOT, results, bar));
    }
    await Promise.all(workers);

    // 5. 处理失败文件 - 复制到失败目录
    if (CONFIG.SAVE_FAILED_TO && results.failed.length > 0) {
      if (!fs.existsSync(CONFIG.SAVE_FAILED_TO)) fs.mkdirSync(CONFIG.SAVE_FAILED_TO, { recursive: true });
      
      for (const f of results.failed) {
        try {
          const targetPath = path.join(CONFIG.SAVE_FAILED_TO, path.basename(f.filePath));
          fs.copyFileSync(f.filePath, targetPath);
          if (CONFIG.LOG_LEVEL === 'verbose') {
            console.log(`📂 已复制失败文件: ${f.filePath} → ${targetPath}`);
          }
        } catch (err) {
          console.warn(`⚠️ 无法复制失败文件: ${f.filePath}`, err.message);
        }
      }
      console.log(`📁 所有失败文件已保存到目录: ${CONFIG.SAVE_FAILED_TO}`);
    }

    // 6. 输出统计信息
    const totalOriginal = results.success.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = results.success.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSaved = totalOriginal - totalCompressed;
    const totalSavedPercent = totalOriginal > 0 ? (totalSaved / totalOriginal * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(50));
    console.log(`✅ 成功压缩: ${results.success.length} 张`);
    console.log(`❌ 处理失败: ${results.failed.length} 张`);
    console.log(`📦 原始大小: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📦 压缩后大小: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`💾 节省空间: ${(totalSaved / 1024 / 1024).toFixed(2)} MB (${totalSavedPercent}%)`);
  }

  // 7. 复制非压缩格式文件（如 svg）
  if (CONFIG.COPY_UNSUPPORTED_TO_OUTPUT) {
    copyUnsupportedFiles(CONFIG.SOURCE_ROOT, CONFIG.OUTPUT_ROOT);
  }
  console.log(`📁 复制非压缩格式文件完成`);

  console.log(`\n🎉 初次压缩完成！结果保存在: ${CONFIG.OUTPUT_ROOT}`);
}

/**
 * 重试压缩失败的图片文件
 * 处理之前压缩失败的图片，尝试重新压缩
 * 
 * @async
 * @function retryFailedFolder
 * @returns {Promise<void>}
 * 
 * @description
 * 执行流程：
 * 1. 检查失败目录是否存在
 * 2. 获取失败目录中的所有图片文件
 * 3. 重新压缩这些文件
 * 4. 成功的文件从失败目录中删除
 * 5. 输出重试结果统计
 */
async function retryFailedFolder() {
  const retrySource = CONFIG.SAVE_FAILED_TO;
  const retryOutput = CONFIG.OUTPUT_ROOT;

  // 检查失败目录是否存在
  if (!fs.existsSync(retrySource)) {
    console.log('📁 没有失败图片目录，跳过重试。');
    return;
  }

  // 获取失败目录中的所有图片文件
  const failedFiles = fs.readdirSync(retrySource)
    .filter(f => CONFIG.SUPPORTED_FORMATS.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(retrySource, f));

  if (failedFiles.length === 0) {
    console.log('✅ 没有需要重试的失败图片。');
    return;
  }

  console.log(`🔁 开始重新压缩失败图片 (${failedFiles.length} 张)...`);

  // 初始化结果统计和进度条
  const results = { success: [], failed: [] };
  const bar = CONFIG.LOG_LEVEL === 'normal' ? new ProgressBar('[:bar] :current/:total :percent :etas', {
    complete: '=', incomplete: ' ', width: 40, total: failedFiles.length
  }) : null;

  // 启动并发处理工作器（重试模式）
  const filesToProcess = [...failedFiles];
  const workers = [];
  for (let i = 0; i < Math.min(failedFiles.length, CONFIG.MAX_CONCURRENT); i++) {
    workers.push(processWorker(filesToProcess, retryOutput, results, bar, true));
  }

  await Promise.all(workers);

  // 输出重试结果
  console.log(`🎯 重新压缩完成，成功 ${results.success.length} 张，失败 ${results.failed.length} 张`);

  if (results.failed.length > 0) {
    console.log('⚠️ 仍有失败文件，保留在失败目录中，需手动处理。');
  } else {
    // 如果全部成功，失败目录可选删除（此处不自动删除）
    console.log('✅ 所有失败文件已成功处理，失败目录可清理。');
  }
}

/**
 * 主程序入口
 * 根据命令行参数决定执行模式
 * 
 * @async
 * @function main
 * @returns {Promise<void>}
 * 
 * @description
 * 支持两种运行模式：
 * 1. 正常模式（默认）：先执行完整压缩，再重试失败文件
 * 2. 重试模式（--retry-failed）：仅重试失败目录中的文件
 */
(async () => {
  try {
    if (retryOnly) {
      console.log('⚡ 只执行失败目录重试压缩');
      await retryFailedFolder();
    } else {
      await compressFolder();
      await retryFailedFolder();
    }
  } catch (err) {
    console.error('❌ 压缩过程中出错:', err);
  }
})();