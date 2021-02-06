module.exports = {
  // l: () => {} // noop,
  l: console.log.bind(window.console),
  cl: console.clear.bind(window.console),
}
