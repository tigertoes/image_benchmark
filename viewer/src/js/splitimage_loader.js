
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
        'decoder' : 'js/codec/bpgdec-0.9.4.js',
        'testImage': 'data:image/bpg;base64,QlBH+yAAICAAA5JHQEQBwXGBEgAAASYBr+DlCr/7ppY='
      },
      'pik': {
        'description': 'Google pik',
        'nativeSupported': false,
        'testImage': 'data:image/pik;base64,UMxLCgAAAAASgAACABABAQAZmD8PKABkAMSB9N9mmwsGAAAAdgwwEAC0AAAj'
      },
    };

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
    return new Promise(function(resolve, reject) {
      window.sampleLoader.codecTest = {};
      var codecTest = window.sampleLoader.codecTest;

      Object.keys(window.sampleLoader.supportedTypes).forEach(type => {
        var supportedTypes = window.sampleLoader.supportedTypes;
        if(supportedTypes[type].nativeSupported === true) return;

        codecTest[type] = new Image();
        codecTest[type].onload = codecTest[type].onerror = function() {
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

    return new Promise(function(resolve, reject){

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
            var fileEl = document.createElement('option');
            fileEl.setAttribute('value', `/output/${dir}/${file.name}`);
            fileEl.text = file.name;
            group.appendChild(fileEl);
          })
        }
      });
      resolve();
    });
  }

  /**
   * Render the image on a given side using the browser's own image processor.
   * 
   * This is not done by rendering an image directly, instead we draw it onto
   * a canvas, and feed that to pica to perform a Lanczos2 resampling (as 3
   * is apparently quite slow, and browser canvas resampling is blurry).
   * @param {String} url absolute path to download
   * @param {String} side in which to place the image
   */
  loadNativeImage(url, side) {
    var canInput   = document.createElement('canvas'),
        canOutput  = document.createElement('canvas'),
        canDisplay = document.getElementById(`${side}Container`);

    var inputCtx = canInput.getContext('2d'),
        img = new Image();

    img.src = url;
    img.onload = function() {
      canInput.width  = img.width;
      canInput.height = img.height;
      inputCtx.drawImage(img, 0, 0);

      canOutput.height = img.width;
      canOutput.width  = img.height;

      window.sampleLoader.pica.resize(canInput, canOutput, {
        quality: 2,
        alpha: false,
        unsharpAmount: 0,
        unsharpThreshold: 0,
        transferable: true })
        .then(function() {
          canDisplay.style.backgroundImage = `url("${canOutput.toDataURL('image/png')}")`;
      });
    }

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
      // TODO
    } else {
      console.warn("I don't know what to do with this format!");
      return;
    }

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
    window.sampleLoader.setSplit();
  }

  /**
   * Update timer for the view split so we don't have to
   */
  setSplit() {
    if(this.splitTimer) return;
    this.splitTimer = setInterval(function() {
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


window.addEventListener('load', function(){
  window.pica.WW = true; // Enable WebWorkers

  window.sampleLoader = new SampleLoader();
  window.sampleLoader.confirmCodecSupport();
  window.sampleLoader.getFolders()
    .then(folders => this.sampleLoader.getFiles(folders))
    .then(files   => this.sampleLoader.loadMenu(files))
    .then(this.sampleLoader.bindEvents());
});
