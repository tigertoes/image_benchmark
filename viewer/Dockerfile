FROM centos:7

RUN yum -y --enablerepo=extras install epel-release
RUN yum -y update
RUN yum -y install nginx
COPY nginx.conf /etc/nginx/nginx.conf
CMD ["nginx"]
