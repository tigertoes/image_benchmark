FROM centos:7

ENV HOME /home/imagemagick

RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false imagemagick

USER imagemagick

RUN yum -y update
RUN yum -y install ImageMagick 

WORKDIR $HOME

