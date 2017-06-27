/**
 * ElectronViewRenderer module
 */

const {app, protocol} = require('electron')
const log = require('captains-log')()
const ejs = require('ejs')
const path = require('path')
const url = require('url')

const parseFilePath = (urlString) => {
  const parsedUrl = url.parse(urlString)
  let fileName = parsedUrl.pathname

  if (process.platform === 'win32') fileName = pathname.substr(1)
  fileName = fileName.replace(/(?:\s|%20)/g, ' ')

  return fileName
}

class ElectronViewRenderer {
  get renderers() { return this._renderers }
  get currentRenderer() { return this._currentRenderer }
  get viewPath() { return this._viewPath }
  get viewProtcolName() { return this._viewProtcolName }
  get useAssets() { return this._useAssets }
  get assetsPath() { return this._assetsPath }
  get assetsProtocolName() { return this._assetsProtocolName }

  /**
   * @constructor
   * @param {Object} [options] - object instance options
   * @param {string} [options.viewPath = 'views'] -
   *     The path to the view directory where your template files live.
   *     Example: './app/views' or 'views'
   * @param {string} [options.viewProtcolName = 'view'] -
   *     The name of the protocol used to capture the requested rendering
   *     Example: 'view:///index' (note the extra slash signifying no host)
   * @param {boolean} [options.useAssets = false] -
   *     This option add an additional listener for 'asset://' protocol
   *     Example 1: 'asset://css/main.css' (note that a host 'css' is added and
   *         will be added in the search path before the remainder of the path
   *         after the path set by options.assetsPath)
   *     Example 1: 'asset:///main.css' (note that a host is not added and
   *         the search path will be the path main.css after the path set
   *         by options.assetsPath)
   * @param {string} [options.assetsPath = 'assets'] - defines the location
   *     where the assets will be searched for
   * @param {string} [options.assetsProtocolName = 'asset'] -
   *     The name of the protocol used to capture the requested asset path
   *     and re point it to the path set by options.assetsPath. This is
   *     really usefull when your assets are not in the same directory as your
   *     view files
   *     Example: 'asset://css/main.css' or 'asset://js/index.js'
   */
  constructor({
    viewPath = 'views',
    viewProtcolName = 'view',
    useAssets = false,
    assetsPath = 'assets',
    assetsProtocolName = 'asset'
  }) {
    this._renderers = {}
    this._currentRenderer = {}

    this._viewProtcolName = viewProtcolName
    this._useAssets = useAssets
    this._assetsPath = assetsPath
    this._assetsProtocolName = assetsProtocolName
    this._viewPath = viewPath

    this.populateDefaultRenderers()
  }

  add(name, data) {
    if (!name) throw new Error('Renderer name required')
    this._renderers[name] = data
    this._renderers[name].name = name
  }

  load(browserWindow, view, viewData) {
    return browserWindow.loadURL(url.format({
      pathname: view,
      protocol: 'view:',
      query: viewData,
      slashes: true,
    }))
  }

  populateEJSRenderer() {
    this.add('ejs', {
      extension: '.ejs',
      viewPath: 'views',
      rendererAction: (filePath, viewData, callback) => {
        ejs.renderFile(filePath, viewData, {}, (error, html) => {
          if (error) {
            if (error.file) error.message += `\n\nERROR @(${error.file}:${error.line}:${error.column})`
            throw new Error(error)
          }

          callback(html)
        })
      }
    })
  }

  populateHAMLRenderer() {
    // TODO: add HAML Renderer
  }

  populatePugRenderer() {
    // TODO: add Pug Renderer
  }

  populateDefaultRenderers() {
    this.populateEJSRenderer()
    this.populateHAMLRenderer()
    this.populatePugRenderer()
  }

  renderTemplate(request) {
    return new Promise((resolve, reject) => {
      const renderer = this.currentRenderer
      const parsedUrl = url.parse(request.url, true)
      const fileName = parseFilePath(request.url)
      const extension = renderer.extension || `.${renderer.name}`
      const filePath = path.join(this.viewPath, `${fileName}${extension}`)
      const viewData = parsedUrl.query

      renderer.rendererAction(filePath, viewData, (renderedHTML) => {
        resolve({
          mimeType: 'text/html',
          data: new Buffer(renderedHTML),
        })
      })
    })
  }

  setupViewProtocol() {
    protocol.registerBufferProtocol(this.viewProtcolName, (request, callback) => {
      this.renderTemplate(request).then((resolution) => {
        callback(resolution)
      }).catch((error) => log.error(error))
    }, (error) => { if (error) log.error('Failed to register view protocol') })
  }

  setupAssetsProtocol() {
    protocol.registerFileProtocol(this.assetsProtocolName, (request, callback) => {
      const hostName = url.parse(request.url).hostname
      const fileName = parseFilePath(request.url)
      const filePath = path.join(this.assetsPath, hostName, fileName)

      callback({path: filePath})
    }, (error) => { if (error) log.error('Failed to register asset protocol') })
  }

  use(name) {
    this._currentRenderer = this.renderers[name]

    app.on('ready', () => {
      this.setupViewProtocol()
      if (this.useAssets) this.setupAssetsProtocol()
    })
  }
}

module.exports = ElectronViewRenderer
