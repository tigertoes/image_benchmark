#!/bin/bash

export START=$(date --iso-8601=seconds);
export ENCODER="guetzli";
export SRC_DIR="/source";
export OUTPUT_DIR="/output";
export OUT_DIR="${OUTPUT_DIR}/${ENCODER}";

echo "Converting assets for ${ENCODER} at ${START}";
if [ -d ${OUT_DIR} ]; then rm -rf ${OUT_DIR}; fi;
mkdir -p ${OUT_DIR};
set -x;
exec 19>${OUT_DIR}/output.log;
export BASH_XTRACEFD="19";

(time {
    for image in ${SRC_DIR}/*.{jpg,png}; do
        if [ ! -f ${image} ]; then continue; fi;
        output_file=${image##*/};
        bin/Release/guetzli --verbose --quality 90 $image "${OUT_DIR}/${output_file}";
    done
}) > ${OUT_DIR}/output.log 2>&1
