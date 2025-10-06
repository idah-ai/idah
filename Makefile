# TODO: move to scripts
db_reset:
	docker compose exec dataset bundle exec rake db:migrate \
	docker compose exec iam bundle exec rake db:migrate \
	docker compose exec media bundle exec rake db:migrate

# TODO: move to scripts
db_dump:
# 	execute these commented in pulse's directory since db is currently there
	docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS idah_dataset_development WITH (FORCE);" \
	docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS idah_iam_development WITH (FORCE);" \
	docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS idah_media_development WITH (FORCE);"