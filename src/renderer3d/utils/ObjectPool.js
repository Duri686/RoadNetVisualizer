/**
 * 对象池 - 复用对象避免频繁创建/销毁
 */

import * as THREE from 'three';

/**
 * Vector3 对象池
 */
export class Vector3Pool {
  constructor(initialSize = 50) {
    this.pool = [];
    this.used = new Set();

    // 预创建对象
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new THREE.Vector3());
    }
  }

  /**
   * 获取一个 Vector3
   */
  get(x = 0, y = 0, z = 0) {
    let vec;
    if (this.pool.length > 0) {
      vec = this.pool.pop();
      vec.set(x, y, z);
    } else {
      vec = new THREE.Vector3(x, y, z);
    }
    this.used.add(vec);
    return vec;
  }

  /**
   * 释放一个 Vector3
   */
  release(vec) {
    if (this.used.has(vec)) {
      this.used.delete(vec);
      this.pool.push(vec);
    }
  }

  /**
   * 释放所有使用中的对象
   */
  releaseAll() {
    this.used.forEach((vec) => this.pool.push(vec));
    this.used.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      usedCount: this.used.size,
      totalCreated: this.pool.length + this.used.size,
    };
  }
}

/**
 * 通用对象池
 */
export class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.pool = [];
    this.used = new Set();
    this.createFn = createFn;
    this.resetFn = resetFn;

    // 预创建对象
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  /**
   * 获取对象
   */
  get() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }
    this.used.add(obj);
    return obj;
  }

  /**
   * 释放对象
   */
  release(obj) {
    if (this.used.has(obj)) {
      this.resetFn(obj);
      this.used.delete(obj);
      this.pool.push(obj);
    }
  }

  /**
   * 释放所有对象
   */
  releaseAll() {
    this.used.forEach((obj) => {
      this.resetFn(obj);
      this.pool.push(obj);
    });
    this.used.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      poolSize: this.pool.length,
      usedCount: this.used.size,
      totalCreated: this.pool.length + this.used.size,
    };
  }
}

// 全局 Vector3 池（单例）
export const globalVector3Pool = new Vector3Pool(100);
