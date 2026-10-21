# 复古百货商场手绘资源

这些资源根据用户提供的实际游戏截图，按“斜俯视全景 + 复古百货商场 + 细线稿和柔和材质上色”方向重新制作。

## 运行文件

- department-store-v2.webp：餐厅、百货店面、商场通道和道路背景。
- props-v2.webp：4×4 图集，16 个家具、猫狗行走帧和车辆。
- people-walk-front-v2.webp / people-walk-back-v2.webp：每张 4×6 图集，12 个身份，每人两个步态。
- people-actions-v2.webp：4×6 图集，落座吃饭和店员动作。
- food-v2.webp：4×3 图集，10 道菜、备料盘、脏碗碟。
- atlas-v2.json：各帧的源像素矩形和布局标定。

PNG 原稿保留在同目录。source/people-walk-front-source-v2.png 为工作前稿；source/comic-scene-vector-v1.js 为替换前绘制器的回退副本，二者不用于运行。

## 生成来源与提示词

全部使用内置 image_gen 工具。环境布局以 source/layout-guide.png 为构图约束；用户截图仅作为画风参考。完整提示词分别保存在：

- prompts.json：环境、家具和首版人物。
- action-prompts.json：正式正面、背面、坐姿及工作动作。
- food-prompt.txt：餐点图集。

透明图集保留真实 alpha。工作版展示图中的暗色区域不是游戏里使用的背景；运行时由透明通道裁切出人物和物件。

## 维护脚本

scripts/create-art-guide.mjs 生成布局标定图；scripts/prepare-painted-assets.mjs 测量精灵透明边界并将原始 PNG 编码成 WebP。两个脚本需要 sharp，可通过 ART_NODE_MODULES 指向已有 Node 包目录；它们不属于游戏启动或构建流程。

运行脚本不会重绘原图。生成资源需要更新时，继续使用内置 image_gen 并保持布局、身份和图集顺序，再重新运行资源准备脚本。正式游戏通过 Vite 导入 WebP，导出路径不依赖 Codex 的默认图片目录。

