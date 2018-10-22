#

The goal of this codebase is to be a harness to provide benchmarking of raster
image formats specifically for web use cases to allow for both objective and
subjective quality measurements, as well as compute and file size comparisons.
It aims to do so in a consistent and repeatable manner, and remain as impartial
as possible - the author is not a codec developer and does not endorse any
particular format.

## Quick start

    git clone --recurse-submodules
    cd 
    docker-compose up

### Current supported formats and codecs:
* [BPG](https://bellard.org/bpg/)
* [WebP](https://developers.google.com/speed/webp/)
* [Guetzli](https://github.com/google/guetzli)
* [Pik](https://github.com/google/pik)

Adding support for new formats is relatively simple. Creating a subdirectory
under `codec` with the name, creating a Dockerfile with the means to build a
functioning binary, and a bash script to execute when the container is started.

## Building
As this repository contains git submodules, you should either clone it with the
`--recurse-submodules` flag set, or running `git submodule init && git submodule
update` to grab the dependencies.

You'll need an up to date version of Docker and docker-compose present. Running
`docker-compose build` will start the process, however it will take a while to
compile everything.

## Running
Put your test assets (JPG, PNG, and TIFF are supported, but certain codecs will
only use specific types) into `source/`, then running `docker-compose up`. Each
of the encoders will run, dumping their files into `output`, and the UI
container remaining running - use Ctrl+C to kill it.

## Analysis
The harness exposes a web service at
[http://localhost:8080](http://localhost:8080), which provides renders of the
images generated for subjective analysis as well as reporting of the job runs.
This front end will attempt to natively render images if available, otherwise
falling back to provided decoders.

## Thanks
A lot of this codebase was inspired by
[](https://github.com/WyohKnott/image-formats-comparison) and

## Contributing
If you are supplying additional encoders please be wearing of matching existing
conventions, and that improving current standards should be han
