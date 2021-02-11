const wc = window.console
module.exports = {
  // l: () => {} // noop,
  l: console.log.bind(wc),
  cl: console.clear.bind(wc),
}
