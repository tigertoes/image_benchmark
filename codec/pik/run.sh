#!/bin/bash

export START=$(date --iso-8601=seconds);
export ENCODER="pik";
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
    for image in ${SRC_DIR}/*.png; do
        if [ ! -f ${image} ]; then continue; fi;
        output_file=${image##*/};
        pik/bin/cpik $image "${OUT_DIR}/${output_file%%.*}.pik";
    done
}) >> ${OUT_DIR}/output.log 2>&1
