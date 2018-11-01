
/**
 * Handler which fetches the list of samples and loads the UI
 */
class SampleLoader {

  constructor(){
    /*
     * `nativeSupported`: if by default or test the browser can decode the image
     * `worker`: if it comes with a decoder, wether that runs under a Worker()
     * `decoder`: relative path to the JS file to load to decode
     * `testImage`: a >= 1 pixel width image to test native decoding
     */
    this.supportedTypes = {
      'jpg': {
        'description': 'JPEG',
        'nativeSupported': true
      },
      'png': {
        'description': 'Portable Network Graphics',
        'nativeSupported': true,
      },
      'guetzli': {
        'description': 'Google Guetzli JPEG compressor',
        'nativeSupported': true
      },
      'webp': {
        'description': 'Google WebP',
        'nativeSupported': false,
        'worker': true,
        'decoder': 'js/codec/webpWorker.js',
        'testImage': 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgAmJaQAA3AA/v02aAA='
      },
      'bpg': {
        'description': "Fabrice Bellard's BPG",
        'nativeSupported': false,
        'worker': false,
        'decoder' : 'js/codec/bpgdec.js',
        'testImage': 'data:image/bpg;base64,QlBH+yAAICAAA5JHQEQBwXGBEgAAASYBr+DlCr/7ppY='
      },
      'pik': {
        'description': 'Google pik',
        'nativeSupported': false,
        'testImage': 'data:image/pik;base64,UMxLCgAAAAASgAACABABAQAZmD8PKABkAMSB9N9mmwsGAAAAdgwwEAC0AAAj'
      },
    };

    // List of all the images
    // key is the path to the file
    // `size`: in bytes
    // `codec`: which codec (not file type) generated
    this.images = {}

    // Timer used by {@Link setSplit()} for updating split
    this.splitTimer = undefined;

    // Update time for the split, in ms
    this.splitUpdateInterval = 20;

    this.split = {
      x: 0.5 * document.getElementById('rightSideContainer').getBoundingClientRect().width,
      y: 0.5 * document.getElementById('leftSideContainer').getBoundingClientRect().height
    };
    this.splitStep = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };

    this.pica = window.pica({
      features: ['js', 'wasm', 'cib', 'ww']
    });

  }

  /**
   * Determine if this user agent can handle specific types natively,
   * by loading a >= 1 pixel representation and seeing if an error is triggered.
   * @returns {Promise} that will update the `nativeSupported` values
   */
  confirmCodecSupport() {
    return new Promise((resolve, reject) => {
      window.sampleLoader.codecTest = {};
      var codecTest = window.sampleLoader.codecTest;

      Object.keys(window.sampleLoader.supportedTypes).forEach(type => {
        var supportedTypes = window.sampleLoader.supportedTypes;
        if(supportedTypes[type].nativeSupported === true) return;

        codecTest[type] = new Image();
        codecTest[type].onload = codecTest[type].onerror = () => {
          // Prioritise native decoding of image formats over using a JS shim
          if(codecTest[type].width && codecTest[type].width >= 1) {
            supportedTypes[type].nativeSupported = true;
          } else if (supportedTypes[type].decoder) {
            var head   = document.getElementsByTagName('head')[0],
                script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = supportedTypes[type].decoder;
            head.appendChild(script);
          }

        };

        codecTest[type].src = supportedTypes[type].testImage;
      });

      resolve();
    });
  }

  /**
   * Wrapper around `fetch()` that includes no error handling.
   * This assumes all calls made contain JSON responses.
   * @param {string} path absolute path to request
   * @return {Promise}
   */
  fetchDir(path) {
    var req = new Request(path);
    return fetch(req).then(res => {
      if (!res.ok)
        throw Error(res.statusText);
      return res;
    }).then(res => {
      return res.json();
    });
  }

  /**
   * Get a list of all the directories
   * @return {Promise} given an {@link Object} containing a directory listing
   */
  getFolders() {
    return this.fetchDir('/output/').then(res => {
      var folders = [];
      res.forEach(dir => {
        if(dir.type !== 'directory') return;
        folders.push(dir.name);
      });
      return folders;
    });
  }

  /**
   * For a given folder, grab a list of files
   * @param {Array} dirs list of directories
   */
  getFiles(dirs) {
    // FIXME: I am not proud of the data structure this generates - an array,
    // whose first element describes the "keys" for the other array elements.
    // But it works, So attempting to optimse this given the amount of time I've
    // spent wrapping my head around the Promises pattern will only cause
    // further brain damage.
    var promises = [[dirs]];
    dirs.forEach(dir => {
      promises.push(this.fetchDir(`/output/${dir}/`));
    })
    return Promise.all(promises);
  }

  /**
   * Populate the two select entities with all the files available, grouped by
   * the name of the codec used
   * @param {Array} files contains the data structure from {@link getFiles}
   */
  loadMenu(files) {
    var dirs = files.shift()[0];
    var supportedTypes = this.supportedTypes;

    return new Promise((resolve, reject) => {

      document.querySelectorAll('#leftSide, #rightSide').forEach(menu => {
        for(var i=0; i<dirs.length; i++){
          var dir = dirs[i],
              fi = files[i];

          var group = document.createElement('optgroup');
          var optgroupLabel = supportedTypes[dir] ?
            `${dir} - ${supportedTypes[dir].description}` : dir;
          group.setAttribute('label', optgroupLabel);
          menu.appendChild(group);
          fi.forEach(file => {
            if(file.name.endsWith('.log')) return;

            // Update the menu list
            var fileEl = document.createElement('option');
            let path = `/output/${dir}/${file.name}`;
            fileEl.setAttribute('value', path);
            fileEl.text = file.name;
            group.appendChild(fileEl);

            // Update the image metadata
            // FIXME: Esoteric filenames may make this blow up :{
            window.sampleLoader.images[path] = {
              size:  file.size,
              codec: dir
            };

          })
        }
      });
      resolve();
    });
  }

  /**
   * Load a natively supported image into a canvas
   * @param {String} url absolute path to download
   * @param {String} side in which to place the image
   */
  loadNativeImage(url, side) {
    var canInput   = document.createElement('canvas'),
        canOutput  = document.createElement('canvas');

    var inputCtx = canInput.getContext('2d'),
        img = new Image();

    img.src = url;
    img.onload = () => {
      canInput.width  = canOutput.width  = img.width;
      canInput.height = canOutput.height = img.height;
      inputCtx.drawImage(img, 0, 0);
      window.sampleLoader.resizeAndRender(canInput, canOutput, side);
    }

  }

  /**
   * Load a BPG image into the canvas
   * @param {String} url absolute path to download
   * @param {String} side in which to place the image
   */
  loadBPG(url, side) {
    var canInput   = document.createElement('canvas'),
        canOutput  = document.createElement('canvas');
    var ctx = canInput.getContext('2d');
    var bpg = new BPGDecoder(ctx);
    bpg.onload = function() {
        canInput.width  = canOutput.width  = this.imageData.width;
        canInput.height = canOutput.height = this.imageData.height;
        ctx.putImageData(this.imageData, 0, 0);
        window.sampleLoader.resizeAndRender(canInput, canOutput, side);
    };
    bpg.load(url);
  }

  /**
   * Resize (using Lanczos2) and render the image into the frame
   *
   * Among the various harnesses that inspired this codebase, a common theme is
   * for them to render images in brwoser this way - by performing a resample of
   * the image to fit it correctly, then taking the bitmap data out as lossless
   * PNG and sticking it into the background of a `<div>` element. This is
   * important, as it means we are also beholden to the browser's ability to do
   * that last piece of processing, and that the final denominator is PNG, no
   * matter the source.
   *
   * @param {Canvas} canInput the input canvas the resize reads from
   * @param {Canvas} canOutput the canvas to output the resized value onto
   * @param {String} side to load it on
   */
  resizeAndRender(canInput, canOutput, side) {
    var canDisplay = document.getElementById(`${side}Container`);
    window.sampleLoader.pica.resize(canInput, canOutput, {
      quality: 2,
      alpha: false,
      unsharpAmount: 0,
      unsharpThreshold: 0,
      transferable: true })
      .then(() => {
        canDisplay.style.backgroundImage = `url("${canOutput.toDataURL('image/png')}")`;
    });
  }

  /**
   * Load a given image for a particular side
   */
  loadImage() {
    // Assuming I have a path like /output/format/file.format
    var type = this.value.split('/')[2],
        side = this.id;
    // Everything not in the "original" folder matches by folder name,
    // but in original, we go by file extension.
    if(type === 'original') type = this.value.split('.')[1].toLowerCase();
    var typeDetails = window.sampleLoader.supportedTypes[type];
    if(typeDetails === undefined) {
      console.warn(`Unsupported type ${type} chosen!`);
      return false;
    }

    if(typeDetails.nativeSupported) {
      window.sampleLoader.loadNativeImage(this.value, side);
    } else if (typeDetails.worker) {
      // TODO
    } else if (type === 'bpg') {
      window.sampleLoader.loadBPG(this.value, side);
    } else {
      console.warn("I don't know what to do with this format!");
      return;
    }

    let info = document.getElementById(`${side}InfoText`);
    var hoverText = '';
    Object.keys(window.sampleLoader.images[this.value]).forEach(key => {
      hoverText += `${key}: ${window.sampleLoader.images[this.value][key]}</br>`;
      info.innerHTML = hoverText;
    });

  }

  /**
   * Determine where we need to place the dividing line
   * @param {Event} event
   */
  moveSplit(event){
    var offset = event.target.getBoundingClientRect();
    var targetX = event.clientX - offset.left,
        targetY = event.clientY - offset.top;
    if (targetX < 0) targetX = 0;
    if (targetX >= offset.width)  targetX = offset.width - 1;
    if (targetY >= offset.height) targetY = offset.height - 1;

    window.sampleLoader.target = {
      x: targetX,
      y: targetY
    };
    window.sampleLoader.setSplit(offset);
  }

  /**
   * Update timer for the view split so we don't have to
   * @param offset
   */
  setSplit(offset) {
    if(this.splitTimer) return;
    this.splitTimer = setInterval(() => {
      var sl = window.sampleLoader;
      sl.splitStep.x *= .5;
      sl.splitStep.y *= .5;
      sl.splitStep.x += (sl.target.x - sl.split.x) *.1;
      sl.splitStep.y += (sl.target.y - sl.split.y) *.1;

      sl.split.x += sl.splitStep.x;
      sl.split.y += sl.splitStep.y;

      if (Math.abs(sl.split.x - sl.target.x) < .5) sl.split.x = sl.target.x;
      if (Math.abs(sl.split.y - sl.target.y) < .5) sl.split.y = sl.target.y;
      document.getElementById('leftSideContainer').style.width
        = `${sl.split.x}px`;

      let infoTextLeft  = document.getElementById('leftSideInfoText'),
          infoTextRight = document.getElementById('rightSideInfoText');

      infoTextLeft.style.right = ((offset.height + (infoTextLeft.clientWidth)*2) - sl.split.x) + "px";
      infoTextLeft.style.top = (sl.split.y < 83 ? 83 : sl.split.y) + "px";
      infoTextRight.style.right = (offset.height - sl.split.x) + "px";
      infoTextRight.style.top = (sl.split.y < 83 ? 83 : sl.split.y) + "px";

      if (sl.split.x === sl.target.x && sl.split.y === sl.target.y) {
        clearInterval(this.splitTimer);
        this.splitTimer = null;
      }
    }, this.splitUpdateInterval);
  }

  /**
   * Set up the various event triggers in the UI
   */
  bindEvents() {
    // Callback for when menu to select image changes
    document.getElementById('rightSide').onchange = window.sampleLoader.loadImage;
    document.getElementById('leftSide').onchange  = window.sampleLoader.loadImage;

    // When the mouse moves in the split space
    document.getElementById('rightSideContainer').addEventListener('mousemove',
      window.sampleLoader.moveSplit, false);
    document.getElementById('rightSideContainer').addEventListener('click',
      window.sampleLoader.moveSplit, false);

  }

}


window.addEventListener('load', () => {
  window.pica.WW = true; // Enable WebWorkers

  window.sampleLoader = new SampleLoader();
  window.sampleLoader.confirmCodecSupport();
  window.sampleLoader.getFolders()
    .then(folders => this.sampleLoader.getFiles(folders))
    .then(files   => this.sampleLoader.loadMenu(files))
    .then(this.sampleLoader.bindEvents());
});
