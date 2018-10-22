FROM centos:7

ENV HOME /home/original
RUN useradd -m -d $HOME -o -u 0 -g 0 -s /usr/bin/false original

USER original

WORKDIR $HOME

COPY run.sh .
CMD $HOME/run.sh

