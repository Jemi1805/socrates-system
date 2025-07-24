FROM composer:latest
RUN addgroup -g 1000 Laravel && adduser -G Laravel -g Laravel -s /bin/sh -D Laravel
USER Laravel
WORKDIR /var/www/html
ENTRYPOINT ["composer", "--ignore-platform-reqs"]
