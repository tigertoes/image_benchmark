FROM centos:7

ENV HOME /home/pik
RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false pik

USER pik

RUN yum -y --enablerepo=extras install epel-release
RUN yum -y update
RUN yum -y install wget gcc-c++ gcc make git

WORKDIR $HOME

RUN git clone https://github.com/google/pik.git
RUN cd pik && git submodule init && git submodule update && make

COPY run.sh .
CMD $HOME/run.sh

