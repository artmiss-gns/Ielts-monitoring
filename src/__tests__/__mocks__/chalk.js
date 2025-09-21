// Mock for chalk that preserves the text content
const chalk = {
  blue: (text) => text,
  gray: (text) => text,
  grey: (text) => text,
  cyan: (text) => text,
  green: (text) => text,
  yellow: (text) => text,
  red: (text) => text,
  white: (text) => text,
  bold: (text) => text,
  dim: (text) => text,
  underline: (text) => text,
  inverse: (text) => text,
  strikethrough: (text) => text,
  bgBlack: (text) => text,
  bgRed: (text) => text,
  bgGreen: (text) => text,
  bgYellow: (text) => text,
  bgBlue: (text) => text,
  bgMagenta: (text) => text,
  bgCyan: (text) => text,
  bgWhite: (text) => text,
};

module.exports = chalk;
module.exports.default = chalk;