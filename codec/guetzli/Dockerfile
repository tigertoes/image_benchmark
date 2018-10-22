FROM centos:7

ENV HOME /home/guetzli
RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false guetzli

USER guetzli

RUN yum -y --enablerepo=extras install epel-release
RUN yum -y update
RUN yum -y install libpng-devel wget gcc-c++ gcc make

WORKDIR $HOME

RUN wget https://github.com/google/guetzli/archive/v1.0.1.tar.gz
RUN tar -xf v1.0.1.tar.gz --strip-components=1
RUN make

COPY run.sh .
CMD $HOME/run.sh

