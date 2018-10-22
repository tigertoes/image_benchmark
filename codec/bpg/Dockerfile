FROM centos:7

ENV HOME /home/bpg
RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false bpg

USER bpg

RUN yum -y --enablerepo=extras install epel-release
RUN yum -y update
RUN yum -y install SDL_image-devel SDL-devel yasm wget gcc-c++ gcc make zlib-devel libjpeg-turbo-devel libpng-devel cmake

WORKDIR $HOME

RUN wget https://bellard.org/bpg/libbpg-0.9.8.tar.gz
RUN tar -xf libbpg-0.9.8.tar.gz --strip-components=1
RUN make

COPY run.sh .
CMD $HOME/run.sh

