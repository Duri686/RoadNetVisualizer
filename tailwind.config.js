/**
 * TailwindCSS 配置（ESM）
 * 仅做最小化内容扫描与暗色模式启用，颜色等通过 CSS 变量在类中直接使用。
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
