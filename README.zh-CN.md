# RoadNet Visualizer

**高性能 3D 道路网络可视化与导航仿真平台**

RoadNet Visualizer 是一个专为复杂多层结构设计的 3D 可视化工具。它利用 **分层寻路 (Hierarchical Pathfinding)** 和 **Web Workers** 技术，实现了大规模路网（如多层建筑、立体交通枢纽）的流畅渲染与实时导航仿真。

[English README](./README.en.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Duri686/RoadNetVisualizer)
![Deploy](https://github.com/Duri686/RoadNetVisualizer/actions/workflows/deploy.yml/badge.svg?branch=main)
![Node](https://img.shields.io/badge/node-%3E=20-339933?logo=node.js&logoColor=white)
![Vite](https://img.shields.io/badge/vite-5-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-black?logo=three.js&logoColor=white)
![License](https://img.shields.io/badge/license-NonCommercial-orange)
![Stars](https://img.shields.io/github/stars/Duri686/RoadNetVisualizer?style=social)

## 在线体验

- Demo（GitHub Pages）：[GitHub Pages Demo](https://duri686.github.io/RoadNetVisualizer/)
- 桌面与移动端均已适配，推荐使用最新版本 Chrome/Edge。

## 目录

- [核心功能](#核心功能)
- [应用场景](#应用场景)
- [项目优势](#项目优势)
- [效果预览](#效果预览)
- [快速上手](#快速上手)
- [核心架构](#核心架构)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [FAQ](#faq)
- [许可证](#许可证)

## 核心功能

- **多层路网可视化**：支持多楼层、多层级的道路网络展示，精准呈现垂直交通连接（楼梯、电梯）与空间关系。
- **智能路径规划**：内置 **分层 A* (Hierarchical A*)** 算法，支持跨楼层长距离寻路、动态避障，并提供平滑的路径动画演示。
- **实时交互系统**：提供点击寻路、层级显隐控制、自由视角漫游及实时数据反馈（路径长度、节点统计）。
- **高品质渲染**：基于 Three.js 的定制化 3D 渲染引擎，集成 "Glass Night" 玻璃拟态夜间主题、动态光照及平滑粒子动画。

## 应用场景

- **室内导航仿真**：大型商场、机场、医院等复杂多层建筑的内部导航演示与路径指引。
- **游戏 AI 开发**：为游戏开发提供可视化的路网生成（NavMesh/Waypoints）与 AI 移动逻辑调试。
- **应急疏散模拟**：模拟多层建筑内的紧急疏散路线，辅助评估通行效率与识别拥堵瓶颈。
- **机器人路径规划**：自主移动机器人（AMR）在多层复杂环境下的路径规划算法验证与可视化监控。

## 项目优势

- **高性能架构**：利用 **Web Workers** 将繁重的路网构建、层级处理与主线程分离，确保在大数据量下依然保持 **60FPS** 的流畅交互。
- **高效寻路算法**：采用 **分层寻路** 策略（区域/门户搜索 + 局部 A*），在大规模地图中寻路效率远超传统算法。
- **现代视觉体验**：内置极具科技感的 UI 主题，配合高品质的 3D 材质与光效。
- **高可扩展性**：采用模块化设计（Managers, Renderers, Systems），各功能模块解耦，易于扩展。

## 效果预览

![路径演示](docs/images/showPath.gif)
![概览](docs/images/overview.png)
![路径实时预览](docs/images/PathPreview.png)
![路径动态规划](docs/images/PathDynamicPlanning.png)

## 快速上手

### 环境要求

- Node.js >= 20
- 包管理：Yarn（通过 Corepack 启用）
- 浏览器：现代浏览器（Chrome/Edge 最新）

### 本地开发

```bash
corepack enable
yarn install --immutable

# 启动开发
yarn dev

# 构建产物
yarn build

# 本地预览（构建后）
yarn preview
```

### 构建与部署

- 已提供 Pages 工作流：`.github/workflows/deploy.yml`
- 推送到 `main` 分支会自动构建并部署 `dist/` 到 GitHub Pages。

## 核心架构

- **技术栈**：
  - **核心语言**：JavaScript (ES6+)
  - **3D 渲染**：Three.js (模块化封装)
  - **并行计算**：Web Workers (用于 Hierarchy 构建、Layer 数据处理)
  - **核心算法**：Hierarchical A*, Voronoi, Spatial Indexing
  - **界面样式**：CSS3 (Variables, Glassmorphism)

- **目录结构**：
  ```text
  src/
  ├── core/                # 渲染核心与 Workers
  ├── managers/            # 应用逻辑管理器
  ├── renderer3d/          # Three.js 渲染器与系统
  ├── utils/               # 算法工具库
  ├── components/          # UI 组件
  └── main.js              # 入口文件
  ```

## 路线图

- [ ] 导入/导出更多数据格式（例如 GeoJSON）
- [ ] 更丰富的权重/约束（车道/转弯/禁行/成本函数）
- [ ] 路径优化策略增强（多目标/分段策略）
- [ ] 性能 Profiling 面板与指标可视化
- [ ] 单元测试与 E2E 测试覆盖
- [ ] 国际化（i18n）与可访问性（a11y）

## 贡献指南

1. Fork 本仓库并创建分支。
2. `yarn install` 并 `yarn dev`。
3. 提交 PR，附带截图与描述。

## FAQ

- **Pages 打开空白？** 检查 `base: './'` 配置。
- **Node 版本？** 需 Node >= 20。
- **性能优化？** 推荐使用硬件加速浏览器；大数据量请降低采样密度。

## 许可证

本项目以 **PolyForm Noncommercial License 1.0.0** 授权。详见 [LICENSE](./LICENSE)。
**禁止商业使用**。如需商业授权，请联系我们。

## 致谢

- [Three.js](https://threejs.org/)
- [d3-delaunay](https://github.com/d3/d3-delaunay)
- [Turf.js](https://turfjs.org/)
- Vite & GitHub Actions

---
项目地址：[Duri686/RoadNetVisualizer](https://github.com/Duri686/RoadNetVisualizer)
