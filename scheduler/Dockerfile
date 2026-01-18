FROM alpine:latest

RUN apk add --no-cache curl

WORKDIR /scheduler
COPY entrypoint.sh /scheduler/entrypoint.sh
COPY cron-call.sh /scheduler/cron-call.sh
RUN chmod +x /scheduler/entrypoint.sh /scheduler/cron-call.sh

CMD ["sh", "/scheduler/entrypoint.sh"]
