# 更新日志

所有对 TinyPNG 图片压缩器插件的重要更改都将记录在此文件中。

## [1.0.0] - 2024-12-20

### 新增功能
- ✅ 右键点击文件夹直接压缩图片功能
- ✅ 支持 JPG、JPEG、PNG、WebP 格式图片压缩
- ✅ 使用 TinyPNG API 进行高质量压缩
- ✅ 多并发处理提高压缩效率
- ✅ 自动重试失败文件机制
- ✅ 保持原有目录结构
- ✅ 自动复制非压缩格式文件（SVG、GIF等）
- ✅ 可配置的压缩参数设置
- ✅ 实时进度显示和详细结果统计
- ✅ 友好的用户界面和错误提示

### 配置选项
- `tinypng-compressor.maxConcurrent`: 最大并发处理数量 (默认: 3)
- `tinypng-compressor.taskDelay`: 任务间延迟时间 (默认: 300ms)
- `tinypng-compressor.timeout`: 网络请求超时时间 (默认: 30000ms)
- `tinypng-compressor.maxRetries`: 失败重试最大次数 (默认: 2)
- `tinypng-compressor.preserveStructure`: 是否保持原有目录结构 (默认: true)
- `tinypng-compressor.copyUnsupported`: 是否复制非压缩格式文件 (默认: true)
- `tinypng-compressor.outputSuffix`: 输出目录后缀名 (默认: "_compressed")

### 使用方法
1. 在 VS Code 文件浏览器中右键点击任意文件夹
2. 选择 "TinyPNG 压缩图片" 选项
3. 等待压缩完成，查看结果统计
4. 可选择打开输出文件夹查看压缩后的图片

### 技术特性
- 基于 TinyPNG 官方 API
- 智能错误处理和重试机制
- 内存优化的并发处理
- 详细的处理日志和统计信息 