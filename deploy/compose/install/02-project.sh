# shellcheck shell=bash disable=SC2034,SC2154
# Step 2 of 10: pick the compose project name, which prefixes the install's
# containers and volumes.

# Compose names the project after this directory unless COMPOSE_PROJECT_NAME
# is set. If another directory already uses that name, this install would share
# its containers and volumes, and fail much later on the other database's
# password. So clashes are caught here.

# Volumes a project left behind, even with its containers gone.
project_volumes() { # <name>
  docker volume ls --filter "label=com.docker.compose.project=$1" \
    --format '{{.Name}}' 2> /dev/null | head -1 || true
}

# The directory that owns a project, if not this one.
project_owner() { # <name>
  docker ps -a --filter "label=com.docker.compose.project=$1" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2> /dev/null \
    | sort -u | grep -v "^$PWD\$" | head -1 || true
}

project=$(get COMPOSE_PROJECT_NAME)
if [ "$mode" != new ]; then
  # An existing install keeps its project: the name in .env, or the directory's.
  # Its own containers and volumes are not a clash.
  [ -n "$project" ] || project=$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9_-')
elif [ -n "$project" ]; then
  # Set on purpose, so a clash is an error rather than worked around.
  owner=$(project_owner "$project")
  [ -z "$owner" ] || die "COMPOSE_PROJECT_NAME is '$project', which belongs to
       $owner

       Sharing it would mean sharing that project's containers and volumes,
       including its database. Choose another name in $env_file."

  leftover=$(project_volumes "$project")
  [ -z "$leftover" ] || die "volumes of a project named '$project' are still here, such as
       $leftover

       A new install would adopt that database and fail to authenticate against
       it, since its password is not the one generated here. Remove them, or
       choose another name in $env_file:

           docker volume ls --filter label=com.docker.compose.project=$project"
else
  # The directory's name is taken: use the next free one (name-2, name-3...).
  project=$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9_-')
  [ -n "$project" ] || project=idah
  owner=$(project_owner "$project")
  if [ -n "$owner" ]; then
    reason="belongs to $owner"
  elif [ -n "$(project_volumes "$project")" ]; then
    reason="still has volumes from an earlier install"
  else
    reason=""
  fi
  if [ -n "$reason" ]; then
    base=$project
    n=2
    while [ -n "$(project_owner "$base-$n")" ] || [ -n "$(project_volumes "$base-$n")" ]; do
      n=$((n + 1))
      [ "$n" -le 20 ] || die "every name from $base-2 to $base-20 belongs to another directory.
       Set COMPOSE_PROJECT_NAME in $env_file to one of your own."
    done
    project="$base-$n"
    printf '\n   note: the project name %s %s,\n   so this install uses %s for its containers and volumes.\n' \
      "$base" "$reason" "$project"
  fi
fi
