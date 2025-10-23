# RoadNet Visualizer

基于 Web 技术（Vite + PixiJS + Web Workers）的多层道路网络生成与可视化工具。

https://pixijs.com/](https://deepwiki.com/badge-maker?url=https%3A%2F%2Fdeepwiki.com%2FDuri686%2FRoadNetVisualizer)
  
## 功能特性
- 生成多层道路网络：质心网络、Portal 中点、Voronoi 骨架（实验）。
- 障碍物驱动：可配置尺寸与数量，自动生成并裁剪穿障边。
- 空间索引优化：支持可调 `cellSize` 的均匀网格索引，显著降低碰撞候选。
- 交互可视化：缩放、平移、节点选取；A* 寻路（橙色路径）与动态小球动画。
- 性能信息：索引构建耗时、候选均值/边、渲染初始化/渲染总耗时、数据体积等。

## 本地开发
```bash
# 安装依赖（建议 Node.js 20+）
corepack enable
yarn install --immutable

# 启动开发
yarn dev

# 构建产物
yarn build
```

## 部署到 GitHub Pages
本仓库已提供 Actions 工作流：`.github/workflows/deploy.yml`
- 推送到 `main` 分支会自动构建并部署 `dist/` 到 Pages。
- 如需自定义基础路径，已在 `vite.config.js` 使用 `base: './'` 便于 Pages 子路径访问。

## 目录结构
```
src/
├── core/               # 渲染与交互核心（PixiJS）
├── utils/              # 几何/导航/生成工具模块
├── components/         # 简单 UI 组件（表单、进度、图层控制）
├── main.js             # 应用入口
└── style.css           # 样式
```

## 许可证（License）
本项目以 **非商用许可证（Non-Commercial License）** 开源：
- 允许任何人查看、分叉（fork）、修改与学习代码；
- 允许在非商业目的下使用本项目及其派生作品；
- **禁止任何形式的商业使用**（含直接或间接盈利、售卖、付费服务、企业内部商用等）；
- 再分发时必须保留本声明及版权信息。

如需商业授权，请通过 Issue 与我们联系。

## 致谢
- [PixiJS](https://pixijs.com/)
- [d3-delaunay](https://github.com/d3/d3-delaunay)
- [Turf.js](https://turfjs.org/)
- Vite & GitHub Actions
