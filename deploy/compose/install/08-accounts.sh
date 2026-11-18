# shellcheck shell=bash disable=SC2034,SC2154
# Step 8 of 10: create the service accounts, the API service account and the
# administrator, unless the database already has them.

# Skipped on --upgrade, or when step 6 copied the data: the accounts exist, and
# creating the administrator again would reset its password.
admin_password=""
if [ "$mode" = upgrade ] || $copied; then
  say "Accounts"
  echo "   left as they are"
else
  say "Creating accounts"

  # Each task sets the account to the password given, so they can run again.
  dc run --rm -e "SERVICES=$service_list" iam bundle exec rake service_accounts:create < /dev/null > /dev/null 2>&1 \
    || die "could not create the service accounts. $retry"
  echo "   seven service accounts, each with its own password"

  dc run --rm iam bundle exec rake api_key_service_account:create < /dev/null > /dev/null 2>&1 \
    || die "could not create the API service account. $retry"
  echo "   API service account"

  # Asked in step 1 for a new install; --provision asks here.
  [ -n "$admin_email" ] || admin_email=$(ask "Administrator email" "admin@example.com")
  admin_password=$(secret 20)
  dc run --rm -e "ADMIN_EMAIL=$admin_email" -e "ADMIN_PASSWORD=$admin_password" \
    -e "ADMIN_NAME=$admin_name" iam bundle exec rake admin:create < /dev/null > /dev/null 2>&1 \
    || die "could not create the administrator account. $retry"
  echo "   administrator $admin_email"
fi
