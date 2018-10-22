FROM centos:7

ENV HOME /home/webp
RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false webp

USER webp

RUN yum -y --enablerepo=extras install epel-release
RUN yum -y update
RUN yum -y install libwebp libwebp-tools

WORKDIR $HOME
COPY run.sh .
CMD $HOME/run.sh

