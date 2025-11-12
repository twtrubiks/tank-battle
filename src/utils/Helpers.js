/**
 * 輔助函數
 * 提供常用的工具方法
 */

import Phaser from 'phaser';

/**
 * 計算兩點之間的距離
 * @param {number} x1 - 點 1 的 X 座標
 * @param {number} y1 - 點 1 的 Y 座標
 * @param {number} x2 - 點 2 的 X 座標
 * @param {number} y2 - 點 2 的 Y 座標
 * @returns {number} 距離
 */
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 計算兩點之間的角度
 * @param {number} x1 - 起點 X
 * @param {number} y1 - 起點 Y
 * @param {number} x2 - 終點 X
 * @param {number} y2 - 終點 Y
 * @returns {number} 角度（弧度）
 */
export function angleBetween(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * 角度轉弧度
 * @param {number} degrees - 角度
 * @returns {number} 弧度
 */
export function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * 弧度轉角度
 * @param {number} radians - 弧度
 * @returns {number} 角度
 */
export function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * 限制數值範圍
 * @param {number} value - 數值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制後的數值
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 線性插值
 * @param {number} start - 起始值
 * @param {number} end - 結束值
 * @param {number} t - 插值參數 (0-1)
 * @returns {number} 插值結果
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * 隨機整數
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 隨機整數
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 隨機浮點數
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 隨機浮點數
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 從陣列中隨機選擇一個元素
 * @param {Array} array - 陣列
 * @returns {*} 隨機元素
 */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 格式化分數（加入千位分隔符）
 * @param {number} score - 分數
 * @returns {string} 格式化後的分數
 */
export function formatScore(score) {
  return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化時間（秒 -> MM:SS）
 * @param {number} seconds - 秒數
 * @returns {string} 格式化時間
 */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 網格座標轉世界座標
 * @param {number} gridX - 網格 X
 * @param {number} gridY - 網格 Y
 * @param {number} tileSize - 瓦片大小
 * @returns {object} { x, y } 世界座標
 */
export function gridToWorld(gridX, gridY, tileSize = 32) {
  return {
    x: gridX * tileSize + tileSize / 2,
    y: gridY * tileSize + tileSize / 2
  };
}

/**
 * 世界座標轉網格座標
 * @param {number} x - 世界 X
 * @param {number} y - 世界 Y
 * @param {number} tileSize - 瓦片大小
 * @returns {object} { gridX, gridY } 網格座標
 */
export function worldToGrid(x, y, tileSize = 32) {
  return {
    gridX: Math.floor(x / tileSize),
    gridY: Math.floor(y / tileSize)
  };
}

/**
 * 檢查點是否在矩形內
 * @param {number} px - 點 X
 * @param {number} py - 點 Y
 * @param {number} rx - 矩形 X
 * @param {number} ry - 矩形 Y
 * @param {number} rw - 矩形寬度
 * @param {number} rh - 矩形高度
 * @returns {boolean} 是否在矩形內
 */
export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
