release: cd back-end && bundle exec rails db:prepare
web: cd back-end && SOLID_QUEUE_IN_PUMA=true bundle exec rails server -p $PORT -e $RAILS_ENV
