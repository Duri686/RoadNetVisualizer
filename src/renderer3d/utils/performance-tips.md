# 性能优化指南

## 使用性能分析器

性能分析器会自动启动，每3秒在控制台输出详细报告。

### 控制台命令

```javascript
// 在浏览器控制台中使用（假设 renderer 是全局变量或可访问）

// 禁用性能分析
renderer.enableProfiling(false);

// 重新启用
renderer.enableProfiling(true);

// 获取实时统计
renderer.getProfilerStats();

// 获取性能信息
renderer.getPerformanceInfo();
```

## 性能报告解读

### 📊 帧时间分析
- **目标**: < 16.67ms (60 FPS)
- **可接受**: 16.67-33ms (30-60 FPS)
- **需优化**: > 33ms (< 30 FPS)

### 🔍 各阶段耗时
- 🟢 < 2ms: 正常
- 🟡 2-5ms: 注意
- 🔴 > 5ms: 瓶颈

### 📈 渲染统计
- **Draw Calls**: 应 < 100
- **三角形数**: 应 < 500,000
- **几何体**: 应 < 1,000

## 常见优化方案

### 1. 降低 Draw Calls
```javascript
// 合并几何体
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const merged = BufferGeometryUtils.mergeGeometries(geometries);

// 使用实例化渲染
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
```

### 2. 减少三角形数
```javascript
// 降低球体段数
const geometry = new THREE.SphereGeometry(radius, 8, 6); // 而不是 32, 32

// 使用 LOD (Level of Detail)
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 50);
lod.addLevel(lowDetailMesh, 100);
```

### 3. 优化材质
```javascript
// 使用更简单的材质
const material = new THREE.MeshBasicMaterial(); // 而不是 MeshStandardMaterial

// 禁用不必要的特性
material.transparent = false;
material.depthWrite = true;
```

### 4. 优化阴影
```javascript
// 降低阴影贴图尺寸
renderer.shadowMap.mapSize.set(512, 512); // 而不是 2048

// 使用更简单的阴影类型
renderer.shadowMap.type = THREE.BasicShadowMap;

// 或完全禁用
renderer.shadowMap.enabled = false;
```

### 5. 优化后期处理
```javascript
// 降低渲染分辨率
composer.setSize(width * 0.5, height * 0.5);

// 减少 bloom 强度
bloomPass.strength = 0.5;

// 或禁用后期处理
// 直接使用 renderer.render() 而不是 composer.render()
```

### 6. 对象池
```javascript
// 复用对象而不是频繁创建/销毁
class ObjectPool {
  constructor(createFn, resetFn) {
    this.pool = [];
    this.createFn = createFn;
    this.resetFn = resetFn;
  }
  
  get() {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}
```

### 7. 减少更新频率
```javascript
// 不是每帧都更新
let frameCount = 0;
function animate() {
  frameCount++;
  
  // 每3帧更新一次
  if (frameCount % 3 === 0) {
    updateExpensiveStuff();
  }
}
```

## 针对当前项目的建议

基于 RoadNet Visualizer 的特点：

1. **节点渲染**: 使用 InstancedMesh 渲染大量节点
2. **边渲染**: 合并所有边的几何体
3. **楼层**: 按需加载，只渲染当前楼层
4. **路径动画**: 使用 shader 动画而不是 CPU 动画
5. **障碍物**: 简化几何体，使用低多边形模型
