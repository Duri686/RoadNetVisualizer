/**
 * 随机数工具函数
 * 提供种子随机数生成器，确保可重现性
 */

class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  /**
   * 生成 0-1 之间的随机数
   */
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * 生成 min-max 之间的随机整数
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * 生成 min-max 之间的随机浮点数
   */
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /**
   * 重置种子
   */
  setSeed(seed) {
    this.seed = seed;
  }
}

/**
 * 全局随机数生成器
 */
const globalRng = new SeededRandom();

export function randomBetween(min, max) {
  return globalRng.randomInt(min, max);
}

export function randomFloat(min, max) {
  return globalRng.randomFloat(min, max);
}

export function setSeed(seed) {
  globalRng.setSeed(seed);
}

export { SeededRandom };
