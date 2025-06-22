/**
 * TinyPNG 图片压缩 VS Code 插件
 * 
 * 功能特性：
 * - 右键点击目录即可压缩其中的图片文件
 * - 支持 jpg、jpeg、png、webp 格式的图片压缩
 * - 使用 TinyPNG API 进行在线压缩
 * - 支持多并发处理提高效率
 * - 失败文件自动重试机制
 * - 保持原有目录结构
 * - 复制非压缩格式文件（如 svg）
 * - 可配置的压缩参数
 * 
 * @author xiaofeiwu
 * @version 1.0.0
 * @since 2024
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const randomUseragent = require('random-useragent');

/**
 * TinyPNG API 配置对象
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
 * 支持的图片格式
 */
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp'];

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
 * 从 VS Code 配置中获取插件设置
 * 
 * @returns {Object} 配置对象
 */
function getConfig() {
    const config = vscode.workspace.getConfiguration('tinypng-compressor');
    return {
        maxConcurrent: config.get('maxConcurrent', 3),
        taskDelay: config.get('taskDelay', 300),
        timeout: config.get('timeout', 30000),
        maxRetries: config.get('maxRetries', 2),
        preserveStructure: config.get('preserveStructure', true),
        copyUnsupported: config.get('copyUnsupported', true),
        outputSuffix: config.get('outputSuffix', '_compressed')
    };
}

/**
 * 递归获取目录下所有支持格式的图片文件
 * 
 * @param {string} dir - 要扫描的目录路径
 * @param {string} outputDir - 输出目录（避免扫描输出目录）
 * @returns {string[]} 所有图片文件的完整路径数组
 */
function getAllImageFiles(dir, outputDir = '') {
    const results = [];
    
    // 跳过隐藏目录和输出目录
    if (path.basename(dir).startsWith('.')) return results;
    if (outputDir && path.resolve(dir) === path.resolve(outputDir)) return results;

    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // 递归处理子目录
                results.push(...getAllImageFiles(fullPath, outputDir));
            } else {
                // 检查文件扩展名是否为支持的图片格式
                const ext = path.extname(file).toLowerCase();
                if (SUPPORTED_FORMATS.includes(ext)) {
                    results.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.error(`扫描目录失败: ${dir}`, error);
    }
    
    return results;
}

/**
 * 单个图片文件压缩处理工作器
 * 使用 TinyPNG API 进行图片压缩，支持自动重试
 * 
 * @param {string} filePath - 要压缩的图片文件路径
 * @param {string} sourceRoot - 源根目录路径
 * @param {string} outputRoot - 输出根目录路径
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 压缩处理结果
 */
async function compressImageWorker(filePath, sourceRoot, outputRoot, config) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // 根据文件扩展名确定 MIME 类型
    const fileType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    let retryCount = 0;
    
    // 重试循环
    while (retryCount <= config.maxRetries) {
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
                timeout: config.timeout
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
                timeout: config.timeout
            });
            
            // 5. 获取压缩后的下载链接
            const downloadUrl = processRes.data.url;
            
            // 6. 确定输出文件路径
            let outputPath;
            if (config.preserveStructure) {
                // 保持原有目录结构
                const relativePath = path.relative(sourceRoot, path.dirname(filePath));
                outputPath = path.join(outputRoot, relativePath, fileName);
            } else {
                // 所有文件放在输出根目录
                outputPath = path.join(outputRoot, fileName);
            }
            
            // 7. 创建输出目录（如果不存在）
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // 8. 下载并保存压缩后的文件
            const downloadRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: config.timeout
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
            if (retryCount > config.maxRetries) {
                let errorDetails = '';
                if (err.response) {
                    errorDetails = `HTTP ${err.response.status}: ${err.response.data?.error || 'Unknown error'}`;
                } else if (err.request) {
                    errorDetails = 'No response from server';
                } else {
                    errorDetails = err.message || 'Unknown error';
                }
                
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
 * @param {string} sourceRoot - 源根目录路径
 * @param {string} outputRoot - 输出根目录路径
 * @param {Object} config - 配置对象
 */
function copyUnsupportedFiles(dir, sourceRoot, outputRoot, config) {
    // 跳过隐藏目录和输出目录
    if (path.basename(dir).startsWith('.')) return;
    if (path.resolve(dir) === path.resolve(outputRoot)) return;
    
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // 递归处理子目录
                copyUnsupportedFiles(fullPath, sourceRoot, outputRoot, config);
            } else {
                const ext = path.extname(file).toLowerCase();
                
                // 只处理非压缩格式文件
                if (!SUPPORTED_FORMATS.includes(ext)) {
                    // 确定输出路径
                    let outputPath;
                    if (config.preserveStructure) {
                        const relativePath = path.relative(sourceRoot, path.dirname(fullPath));
                        outputPath = path.join(outputRoot, relativePath, file);
                    } else {
                        outputPath = path.join(outputRoot, file);
                    }
                    
                    // 创建输出目录
                    const outputDir = path.dirname(outputPath);
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, { recursive: true });
                    }
                    
                    // 复制文件
                    fs.copyFileSync(fullPath, outputPath);
                }
            }
        }
    } catch (error) {
        console.error(`复制非压缩文件失败: ${dir}`, error);
    }
}

/**
 * 图片处理工作器
 * 从文件队列中取出文件进行处理，支持并发执行
 * 
 * @param {string[]} files - 待处理文件路径数组（引用传递，会被修改）
 * @param {string} sourceRoot - 源根目录路径
 * @param {string} outputRoot - 输出根目录路径
 * @param {Object} results - 结果统计对象，包含 success 和 failed 数组
 * @param {Object} config - 配置对象
 * @param {Function} progressCallback - 进度回调函数
 */
async function processWorker(files, sourceRoot, outputRoot, results, config, progressCallback) {
    // 持续处理直到队列为空
    while (files.length > 0) {
        // 从队列中取出一个文件
        const file = files.shift();
        const relativePath = path.relative(sourceRoot, file);
        
        try {
            // 执行压缩处理
            const result = await compressImageWorker(file, sourceRoot, outputRoot, config);
            
            if (result.success) {
                results.success.push(result);
            } else {
                results.failed.push(result);
            }
            
        } catch (err) {
            results.failed.push({ 
                filePath: file, 
                error: err.message || 'Unknown error', 
                success: false 
            });
        }
        
        // 调用进度回调
        if (progressCallback) {
            progressCallback(relativePath, result?.success || false);
        }
        
        // 任务间延迟，避免过于频繁的请求
        await new Promise(resolve => setTimeout(resolve, config.taskDelay));
    }
}

/**
 * 主压缩函数
 * 扫描指定目录中的所有图片文件并进行压缩处理
 * 
 * @param {string} sourceDir - 源目录路径
 * @returns {Promise<Object>} 处理结果统计
 */
async function compressFolder(sourceDir) {
    const config = getConfig();
    
    // 检查源目录是否存在
    if (!fs.existsSync(sourceDir)) {
        throw new Error(`源目录不存在: ${sourceDir}`);
    }

    // 创建输出目录
    const outputDir = sourceDir + config.outputSuffix;
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. 获取所有支持格式的图片
    const allFiles = getAllImageFiles(sourceDir, outputDir);
    if (allFiles.length === 0) {
        return {
            success: [],
            failed: [],
            message: '没有找到可处理的图片文件'
        };
    }

    // 2. 初始化结果统计
    const results = { success: [], failed: [] };
    let processedCount = 0;
    
    // 进度回调函数
    const progressCallback = (fileName, success) => {
        processedCount++;
        // 这里可以更新进度条或发送进度通知
    };

    // 3. 启动并发处理工作器
    const filesToProcess = [...allFiles];
    const workers = [];
    const workerCount = Math.min(allFiles.length, config.maxConcurrent);
    
    for (let i = 0; i < workerCount; i++) {
        workers.push(processWorker(
            filesToProcess, 
            sourceDir, 
            outputDir, 
            results, 
            config, 
            progressCallback
        ));
    }
    
    await Promise.all(workers);

    // 4. 复制非压缩格式文件
    if (config.copyUnsupported) {
        copyUnsupportedFiles(sourceDir, sourceDir, outputDir, config);
    }

    // 5. 计算统计信息
    const totalOriginal = results.success.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = results.success.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSaved = totalOriginal - totalCompressed;
    const totalSavedPercent = totalOriginal > 0 ? (totalSaved / totalOriginal * 100).toFixed(1) : 0;

    return {
        success: results.success,
        failed: results.failed,
        outputDir,
        stats: {
            successCount: results.success.length,
            failedCount: results.failed.length,
            totalOriginal,
            totalCompressed,
            totalSaved,
            totalSavedPercent
        }
    };
}

/**
 * 插件激活函数
 * 
 * @param {vscode.ExtensionContext} context - VS Code 插件上下文
 */
function activate(context) {
    console.log('TinyPNG 图片压缩插件已激活');

    // 注册压缩文件夹命令
    let disposable = vscode.commands.registerCommand('tinypng-compressor.compressFolder', async (uri) => {
        try {
            // 获取选中的文件夹路径
            const folderPath = uri ? uri.fsPath : undefined;
            
            if (!folderPath) {
                vscode.window.showErrorMessage('请选择一个文件夹进行压缩');
                return;
            }

            // 检查是否为文件夹
            const stat = fs.statSync(folderPath);
            if (!stat.isDirectory()) {
                vscode.window.showErrorMessage('请选择一个文件夹，而不是文件');
                return;
            }

            // 显示开始压缩的提示
            vscode.window.showInformationMessage(`开始压缩文件夹: ${path.basename(folderPath)}`);

            // 显示进度条
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "TinyPNG 图片压缩中...",
                cancellable: false
            }, async (progress, token) => {
                progress.report({ increment: 0, message: "正在扫描图片文件..." });
                
                try {
                    const result = await compressFolder(folderPath);
                    progress.report({ increment: 100, message: "压缩完成" });
                    return result;
                } catch (error) {
                    throw error;
                }
            });

            // 显示结果
            if (result.success.length === 0 && result.failed.length === 0) {
                vscode.window.showWarningMessage(result.message || '没有找到可处理的图片文件');
            } else {
                const { stats } = result;
                const message = `压缩完成！
✅ 成功: ${stats.successCount} 张
❌ 失败: ${stats.failedCount} 张
💾 节省空间: ${(stats.totalSaved / 1024 / 1024).toFixed(2)} MB (${stats.totalSavedPercent}%)
📁 输出目录: ${path.basename(result.outputDir)}`;

                vscode.window.showInformationMessage(message, '打开输出文件夹').then(selection => {
                    if (selection === '打开输出文件夹') {
                        // 在 VS Code 中打开输出文件夹
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.outputDir));
                    }
                });

                // 如果有失败的文件，显示详细信息
                if (result.failed.length > 0) {
                    const failedFiles = result.failed.map(f => `• ${path.basename(f.filePath)}: ${f.error}`).join('\n');
                    vscode.window.showWarningMessage(
                        `${result.failed.length} 个文件压缩失败`,
                        '查看详情'
                    ).then(selection => {
                        if (selection === '查看详情') {
                            vscode.window.showInformationMessage(
                                `失败文件列表:\n${failedFiles}`,
                                { modal: true }
                            );
                        }
                    });
                }
            }

        } catch (error) {
            console.error('压缩过程中出错:', error);
            vscode.window.showErrorMessage(`压缩失败: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

/**
 * 插件停用函数
 */
function deactivate() {
    console.log('TinyPNG 图片压缩插件已停用');
}

module.exports = {
    activate,
    deactivate
}; 