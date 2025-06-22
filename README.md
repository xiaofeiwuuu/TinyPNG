# TinyPNG 递归目录图片压缩工具 🚀

一个基于 node 和 TinyPNG API 的高效图片批量压缩工具，支持递归处理整个目录结构，自动压缩图片并保持原有文件组织结构。

## ✨ 功能特性

### 🎯 核心功能
- **递归目录扫描** - 自动扫描指定目录及其所有子目录中的图片文件
- **批量图片压缩** - 使用 TinyPNG 官方 API 进行高质量图片压缩
- **多格式支持** - 支持 `.jpg`、`.jpeg`、`.png`、`.webp` 格式的图片压缩
- **目录结构保持** - 压缩后的文件保持与原目录相同的文件夹结构
- **非压缩文件复制** - 自动复制 `.svg`、`.gif` 等非压缩格式文件到输出目录

### ⚡ 性能优化
- **多并发处理** - 基于 CPU 核心数自动调整并发数量，提高处理效率
- **智能重试机制** - 失败文件自动重试，最大重试次数可配置
- **任务延迟控制** - 避免过于频繁的 API 请求，防止被限流
- **进度条显示** - 实时显示压缩进度和处理状态

### 🛡️ 错误处理
- **失败文件管理** - 压缩失败的文件单独存储到失败目录
- **独立重试模式** - 支持单独重试之前失败的文件
- **详细错误日志** - 提供详细的错误信息和处理状态
- **网络超时保护** - 设置请求超时时间，避免长时间等待

## 📦 安装要求

### Node.js 环境
- **Node.js** >= 14.0.0
- **npm** 或 **pnpm** 包管理器

### 依赖包安装

```bash
# 使用 npm 安装依赖
npm install

# 或使用 pnpm 安装依赖
pnpm install
```

## 🚀 快速开始


### 1. 准备图片文件
将需要压缩的图片放在 `static` 目录中（或修改配置中的 `SOURCE_ROOT` 路径）

### 2. 运行压缩
```bash
# 执行完整压缩流程
node index.js

# 仅重试之前压缩失败的文件
node index.js --retry-failed
```


## ⚙️ 配置说明

**所有配置项都在 `index.js` 文件顶部的 `CONFIG` 对象中**


## 📖 使用方法

### 基本使用

#### 1. 正常压缩模式
```bash
node index.js
```
**功能说明：**
- 扫描源目录中的所有图片文件
- 使用 TinyPNG API 进行压缩
- 将压缩后的文件保存到输出目录
- 复制非压缩格式文件（如 SVG、GIF）
- 将失败的文件复制到失败目录
- 自动重试失败目录中的文件

#### 2. 仅重试失败模式
```bash
node index.js --retry-failed
```
**功能说明：**
- 只处理之前压缩失败的文件
- 从失败目录中读取文件进行重新压缩
- 成功后从失败目录中移除文件

### 目录结构示例

#### 压缩前的目录结构：
```
项目根目录/
├── static/                    # 源图片目录
│   ├── images/
│   │   ├── photo1.jpg
│   │   ├── photo2.png
│   │   └── icon.svg
│   ├── avatars/
│   │   ├── user1.jpg
│   │   └── user2.png
│   └── banner.webp
├── index.js
└── README.md
```

#### 压缩后的目录结构：
```
项目根目录/
├── static/                    # 原始图片目录（保持不变）
├── compressed_results/        # 压缩后的图片目录
│   ├── images/
│   │   ├── photo1.jpg        # 已压缩
│   │   ├── photo2.png        # 已压缩
│   │   └── icon.svg          # 直接复制
│   ├── avatars/
│   │   ├── user1.jpg         # 已压缩
│   │   └── user2.png         # 已压缩
│   └── banner.webp           # 已压缩
├── failed_images/             # 失败文件目录（如果有失败）
│   └── failed_image.jpg
├── index.js
└── README.md
```

## 📊 处理结果示例

### 控制台输出示例
```
🚀 TinyPNG 递归目录图片压缩工具
[====================] 15/15 100% 0.0s

==================================================
✅ 成功压缩: 13 张
❌ 处理失败: 2 张
📦 原始大小: 25.67 MB
📦 压缩后大小: 18.32 MB
💾 节省空间: 7.35 MB (28.6%)
📁 复制非压缩格式文件完成
📁 所有失败文件已保存到目录: /path/to/failed_images

🎉 初次压缩完成！结果保存在: /path/to/compressed_results

🔁 开始重新压缩失败图片 (2 张)...
[====================] 2/2 100% 0.0s
🎯 重新压缩完成，成功 1 张，失败 1 张
⚠️ 仍有失败文件，保留在失败目录中，需手动处理。
```

## 🔧 高级配置

### 自定义源目录和输出目录
```javascript
const CONFIG = {
  SOURCE_ROOT: path.join(__dirname, 'my-images'),      // 自定义需要压缩的图片目录
  OUTPUT_ROOT: path.join(__dirname, 'compressed'),     // 自定义输出目录
  // ... 其他配置
};
```

### 调整并发数量
```javascript
const CONFIG = {
  MAX_CONCURRENT: 3,  // 设置为固定的并发数
  // 或者
  MAX_CONCURRENT: Math.min(6, os.cpus().length), // 最大不超过6个并发
  // ... 其他配置
};
```

### 


### 调整网络设置
```javascript
const CONFIG = {
  TIMEOUT: 60000,     // 增加超时时间到60秒
  MAX_RETRIES: 5,     // 增加重试次数到5次
  TASK_DELAY: 500,    // 增加任务间延迟到500毫秒
  // ... 其他配置
};
```

## ⚠️ 注意事项

**禁止添加修改 SUPPORTED_FORMATS,这个是 TinyPNG 支持的图片, 添加修改不支持的图片格式会压缩失败**
```javascript
const CONFIG = {
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.webp'],
};
```

### TinyPNG API 限制
- **免费额度**：每月500张图片的免费压缩额度
- **API密钥**：本工具使用 TinyPNG 网页版的接口，无需 API Key
- **请求频率**：建议不要设置过小的 `TASK_DELAY` 值，避免被限流

### 文件处理说明
- **原始文件保护**：工具不会修改或删除源目录中的原始文件
- **覆盖行为**：如果输出目录中已存在同名文件，会被覆盖
- **失败文件**：压缩失败的文件会被复制到失败目录，便于后续处理

### 性能优化建议
- **并发数量**：根据网络状况和机器性能调整 `MAX_CONCURRENT`
- **任务延迟**：网络较慢时可适当增加 `TASK_DELAY`
- **超时时间**：大文件处理时可适当增加 `TIMEOUT` 值


## 📄 许可证

本项目仅供学习和个人使用，请遵守 TinyPNG 的使用条款。

---

**作者**: 无忧  
**版本**: 1.2.0  
**更新时间**: 2025

> 💡 **小贴士**：首次使用建议先用少量图片测试，确认配置正确后再处理大批量文件。 

# TinyPNG 图片压缩器 VS Code 插件 🚀

一个功能强大的 VS Code 插件，基于 TinyPNG API 的高效图片批量压缩工具。支持右键点击文件夹一键压缩，无需复杂配置，极大提升开发效率。

![插件演示](https://img.shields.io/badge/VS%20Code-Extension-blue?style=flat-square&logo=visual-studio-code)
![版本](https://img.shields.io/badge/version-1.0.0-green?style=flat-square)
![许可证](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

## ✨ 功能特性

### 🎯 核心功能
- **一键右键压缩** - 右键点击文件夹即可开始压缩，无需输入路径
- **批量图片压缩** - 使用 TinyPNG 官方 API 进行高质量图片压缩
- **多格式支持** - 支持 `.jpg`、`.jpeg`、`.png`、`.webp` 格式的图片压缩
- **目录结构保持** - 压缩后的文件保持与原目录相同的文件夹结构
- **非压缩文件复制** - 自动复制 `.svg`、`.gif` 等非压缩格式文件到输出目录

### ⚡ 性能优化
- **多并发处理** - 可配置并发数量，提高处理效率
- **智能重试机制** - 失败文件自动重试，最大重试次数可配置
- **任务延迟控制** - 避免过于频繁的 API 请求，防止被限流
- **实时进度显示** - VS Code 原生进度条，实时显示压缩进度

### 🛡️ 错误处理
- **详细错误日志** - 提供详细的错误信息和处理状态
- **失败文件统计** - 显示失败文件列表和具体错误原因
- **网络超时保护** - 设置请求超时时间，避免长时间等待
- **友好用户界面** - 清晰的成功/失败提示和统计信息

## 🚀 VS Code 插件安装和使用

### 安装方法

#### 方法一：从 VS Code 市场安装（推荐）
1. 打开 VS Code
2. 点击左侧扩展图标 或按 `Ctrl+Shift+X`
3. 搜索 "TinyPNG 图片压缩器"
4. 点击安装

#### 方法二：手动安装
1. 下载插件文件
2. 在 VS Code 中按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Extensions: Install from VSIX"
4. 选择下载的 .vsix 文件

### 使用方法

#### 🖱️ 右键压缩（推荐）
1. 在 VS Code 文件浏览器中找到包含图片的文件夹
2. **右键点击文件夹**
3. 选择 **"TinyPNG 压缩图片"** 选项
4. 等待压缩完成，查看结果统计
5. 可选择 **"打开输出文件夹"** 查看压缩后的图片

#### ⌨️ 命令面板
1. 在 VS Code 中按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "TinyPNG 压缩图片"
3. 选择要压缩的文件夹

### 🔧 插件配置

在 VS Code 设置中搜索 "tinypng" 可以找到以下配置选项：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `tinypng-compressor.maxConcurrent` | `3` | 最大并发处理数量 (1-10) |
| `tinypng-compressor.taskDelay` | `300` | 任务间延迟时间（毫秒）(100-2000) |
| `tinypng-compressor.timeout` | `30000` | 网络请求超时时间（毫秒）(5000-60000) |
| `tinypng-compressor.maxRetries` | `2` | 失败重试最大次数 (0-5) |
| `tinypng-compressor.preserveStructure` | `true` | 是否保持原有目录结构 |
| `tinypng-compressor.copyUnsupported` | `true` | 是否复制非压缩格式文件到输出目录 |
| `tinypng-compressor.outputSuffix` | `"_compressed"` | 输出目录后缀名 |

### 📊 使用示例

#### 压缩前的目录结构：
```
my-project/
├── assets/
│   ├── images/
│   │   ├── photo1.jpg      (2.5MB)
│   │   ├── photo2.png      (1.8MB)
│   │   └── icon.svg        (复制)
│   ├── avatars/
│   │   ├── user1.jpg       (800KB)
│   │   └── user2.png       (1.2MB)
│   └── banner.webp         (3.1MB)
```

#### 右键点击 `assets` 文件夹 → 选择 "TinyPNG 压缩图片"

#### 压缩后的目录结构：
```
my-project/
├── assets/                 # 原始文件（保持不变）
├── assets_compressed/      # 压缩后文件
│   ├── images/
│   │   ├── photo1.jpg      (1.8MB, 节省28%)
│   │   ├── photo2.png      (1.3MB, 节省28%)
│   │   └── icon.svg        (直接复制)
│   ├── avatars/
│   │   ├── user1.jpg       (580KB, 节省28%)
│   │   └── user2.png       (860KB, 节省28%)
│   └── banner.webp         (2.2MB, 节省29%)
```

#### 结果统计：
```
✅ 成功: 5 张
❌ 失败: 0 张
💾 节省空间: 2.7 MB (28.5%)
📁 输出目录: assets_compressed
```

## 📦 开发环境安装

如果您想参与开发或本地调试，请按以下步骤操作：

### Node.js 环境
- **Node.js** >= 14.0.0
- **npm** 或 **pnpm** 包管理器

### 依赖包安装

```bash
# 克隆仓库
git clone https://github.com/xiaofeiwuuu/TinyPNG.git
cd TinyPNG

# 安装依赖
pnpm install
# 或
npm install
```

### 开发调试

```bash
# 启动开发模式
code .

# 在 VS Code 中按 F5 启动调试
# 这将打开一个新的 VS Code 窗口，插件已加载
```

### 打包插件

```bash
# 安装 vsce 工具
npm install -g vsce

# 打包插件
vsce package
```

## ⚙️ 配置详解

### 性能优化配置
```json
{
  "tinypng-compressor.maxConcurrent": 3,     // 推荐值：2-5
  "tinypng-compressor.taskDelay": 300,       // 网络慢时增加到500-1000
  "tinypng-compressor.timeout": 30000        // 大文件时增加到60000
}
```

### 功能配置
```json
{
  "tinypng-compressor.preserveStructure": true,    // 保持目录结构
  "tinypng-compressor.copyUnsupported": true,      // 复制SVG等文件
  "tinypng-compressor.outputSuffix": "_compressed"  // 自定义输出目录名
}
```

## ⚠️ 注意事项

### TinyPNG API 限制
- **免费额度**：每月500张图片的免费压缩额度
- **API接口**：本插件使用 TinyPNG 网页版的接口，无需 API Key
- **请求频率**：建议不要设置过小的 `taskDelay` 值，避免被限流

### 文件处理说明
- **原始文件保护**：插件不会修改或删除源目录中的原始文件
- **覆盖行为**：如果输出目录中已存在同名文件，会被覆盖
- **安全性**：所有操作都在本地进行，除了向 TinyPNG 发送图片数据

### 使用建议
- **首次使用**：建议先用少量图片测试，确认效果后再处理大批量文件
- **网络状况**：网络不稳定时可适当增加超时时间和重试次数
- **文件大小**：超大文件（>5MB）建议先手动优化后再使用插件

## 🐛 故障排除

### 常见问题

#### 1. 右键菜单没有出现
**解决方案**：
- 确保右键点击的是文件夹，不是文件
- 重启 VS Code
- 检查插件是否正确安装和启用

#### 2. 压缩失败率过高
**解决方案**：
- 增加 `taskDelay` 值（如 500-1000ms）
- 减少 `maxConcurrent` 值
- 检查网络连接状态

#### 3. 进度条卡住不动
**解决方案**：
- 等待网络请求完成
- 增加 `timeout` 值
- 检查防火墙设置

#### 4. 输出目录权限错误
**解决方案**：
- 检查目录权限
- 确保有足够的磁盘空间
- 尝试更换输出目录位置

## 🎯 路线图

### 计划中的功能
- [ ] 支持更多图片格式（BMP、TIFF）
- [ ] 批量重命名功能
- [ ] 压缩质量可选
- [ ] 集成其他压缩服务
- [ ] 压缩历史记录
- [ ] 快捷键支持

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个插件！

### 如何贡献
1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📞 支持

如果您遇到任何问题或有功能建议，请：

- 在 [GitHub Issues](https://github.com/xiaofeiwuuu/TinyPNG/issues) 中提交问题
- 发送邮件至：your-email@example.com
- 在 [Gitee Issues](https://gitee.com/xiaofeiwuu/tiny-png/issues) 中提交问题

---

**作者**: xiaofeiwu  
**版本**: 1.0.0  
**更新时间**: 2024-12-20

> 💡 **小贴士**：使用插件前建议先备份重要图片文件，虽然插件不会修改原始文件，但谨慎总是好的！

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xiaofeiwuuu/TinyPNG&type=Date)](https://star-history.com/#xiaofeiwuuu/TinyPNG&Date)

**如果这个插件对您有帮助，请给我们一个 ⭐️ Star！** 