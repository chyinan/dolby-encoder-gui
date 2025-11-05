const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: 'src/preload.js',
      builderOptions: {
        appId: 'com.dolby.encoder.gui',
        productName: 'Dolby Encoding Engine',
        icon: 'logo.png',
        win: {
          icon: 'logo.png'
        },
        extraResources: [
          {
            from: 'encode.exe',
            to: 'encode.exe'
          },
          {
            from: 'encode.c',
            to: 'encode.c'
          },
          {
            from: 'xml_templates',
            to: 'xml_templates'
          },
          {
            from: 'logo.png',
            to: 'logo.png'
          }
        ]
      }
    }
  }
})
